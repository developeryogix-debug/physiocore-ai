import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentContext,
  AgentResult,
  NutritionRequest,
  NutritionPlan,
} from '@physiocore/types';
import { calculateBMR, calculateTDEE, calculateMacros } from './calculators.js';
import {
  buildNutritionSystemPrompt,
  buildNutritionUserPrompt,
} from './prompts.js';
import {
  webSearchToolDefinition,
  executeWebSearch,
  type WebSearchInput,
} from './webSearchTool.js';

const MAX_AGENTIC_ITERATIONS = 5;

export class NutritionAgent {
  private readonly agentId = 'nutrition-agent';
  private readonly version = '1.0.0';
  private readonly client: Anthropic;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
  }

  async generateNutritionPlan(
    request: NutritionRequest,
    context: AgentContext,
  ): Promise<AgentResult<NutritionPlan>> {
    const startTime = Date.now();
    const { userProfile } = context;

    const bmr = calculateBMR(userProfile);
    const tdee = calculateTDEE(bmr, userProfile.fitnessLevel);
    const macros = calculateMacros(tdee, request.goal);

    const systemPrompt = buildNutritionSystemPrompt(userProfile);
    const userPrompt = buildNutritionUserPrompt(request, tdee, macros);

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userPrompt },
    ];

    const totalTokens = { input: 0, output: 0 };

    try {
      const finalText = await this.runAgenticLoop(
        messages,
        systemPrompt,
        totalTokens,
      );
      const plan = this.parseNutritionPlan(finalText);
      return this.buildResult(plan, startTime, totalTokens);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error generating plan';
      const isRetryable =
        message.includes('overloaded') || message.includes('rate_limit');
      return {
        success: false,
        data: undefined as unknown as NutritionPlan,
        error: {
          code: isRetryable ? 'RATE_LIMIT' : 'GENERATION_FAILED',
          message,
          retryable: isRetryable,
        },
        metadata: {
          agentId: this.agentId,
          agentVersion: this.version,
          processingMs: Date.now() - startTime,
          tokensUsed: totalTokens.input + totalTokens.output,
        },
      };
    }
  }

  private async runAgenticLoop(
    messages: Anthropic.MessageParam[],
    systemPrompt: string,
    totalTokens: { input: number; output: number },
  ): Promise<string> {
    let iterations = 0;

    while (iterations < MAX_AGENTIC_ITERATIONS) {
      iterations += 1;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: [webSearchToolDefinition],
        messages,
      });

      totalTokens.input += response.usage.input_tokens;
      totalTokens.output += response.usage.output_tokens;

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        );
        if (textBlock === undefined) {
          throw new Error('Model returned end_turn with no text content');
        }
        return textBlock.text;
      }

      if (response.stop_reason === 'tool_use') {
        // Append the assistant turn with tool_use blocks
        messages.push({ role: 'assistant', content: response.content });

        // Execute each tool and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          if (block.name === 'web_search') {
            const input = block.input as WebSearchInput;
            const result = await executeWebSearch(input.query);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Unexpected stop reason (max_tokens, stop_sequence, etc.)
      throw new Error(
        `Unexpected stop_reason from model: ${response.stop_reason}`,
      );
    }

    throw new Error(
      `Agentic loop exceeded maximum iterations (${MAX_AGENTIC_ITERATIONS})`,
    );
  }

  private parseNutritionPlan(content: string): NutritionPlan {
    // Strip markdown code fences if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = jsonMatch !== null ? jsonMatch[1] ?? content : content;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      throw new Error(
        `Failed to parse NutritionPlan JSON. Raw content: ${raw.slice(0, 200)}`,
      );
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('NutritionPlan JSON must be an object');
    }

    // TypeScript cast — the system prompt instructs the model to match the schema
    return parsed as NutritionPlan;
  }

  private buildResult<T>(
    data: T,
    startTime: number,
    tokens: { input: number; output: number },
  ): AgentResult<T> {
    return {
      success: true,
      data,
      metadata: {
        agentId: this.agentId,
        agentVersion: this.version,
        processingMs: Date.now() - startTime,
        tokensUsed: tokens.input + tokens.output,
      },
    };
  }
}

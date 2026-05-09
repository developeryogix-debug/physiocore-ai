import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentContext,
  AgentResult,
  AgentMetadata,
  FeedbackRequest,
  FeedbackResponse,
  FormCorrection,
} from '@physiocore/types';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;
const LOW_FORM_SCORE_THRESHOLD = 40;

/** Minimum shape expected in the parsed LLM response. */
interface RawFeedbackResponse {
  summary: string;
  formCorrections: Array<{
    bodyPart: string;
    issue: string;
    instruction: string;
    priority: string;
  }>;
  motivationalMessage: string;
  nextSteps: string[];
  safetyWarnings: string[];
}

function isValidPriority(value: string): value is FormCorrection['priority'] {
  return ['low', 'medium', 'high', 'stop'].includes(value);
}

export class FeedbackAgent {
  private readonly agentId = 'feedback-agent';
  private readonly version = '1.0.0';
  private readonly client: Anthropic;
  private readonly model = MODEL;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
  }

  /**
   * Generates personalised physiotherapy feedback for a completed exercise session.
   *
   * Steps:
   * 1. Build system and user prompts from the request and user profile
   * 2. Call Claude with the prompts
   * 3. Parse and validate the JSON response
   * 4. Enforce safety rule: form score < 40 always produces at least one warning
   * 5. Return a typed AgentResult with token and timing metadata
   */
  async generateFeedback(
    request: FeedbackRequest,
    context: AgentContext,
  ): Promise<AgentResult<FeedbackResponse>> {
    const startTime = Date.now();

    const systemPrompt = buildSystemPrompt(request.userProfile);
    const userPrompt = buildUserPrompt(request);

    let message: Anthropic.Message;

    try {
      message = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        err instanceof Error && 'status' in err && (err as { status?: number }).status === 429;

      const metadata: AgentMetadata = {
        agentId: this.agentId,
        agentVersion: this.version,
        processingMs: Date.now() - startTime,
      };

      return {
        success: false,
        error: {
          code: isRateLimit ? 'RATE_LIMIT' : 'API_ERROR',
          message: `Anthropic API call failed: ${errorMessage}`,
          retryable: isRateLimit,
        },
        metadata,
      };
    }

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;

    const textBlock = message.content.find((b) => b.type === 'text');
    if (textBlock === undefined || textBlock.type !== 'text') {
      const metadata: AgentMetadata = {
        agentId: this.agentId,
        agentVersion: this.version,
        processingMs: Date.now() - startTime,
        tokensUsed: inputTokens + outputTokens,
      };
      return {
        success: false,
        error: {
          code: 'EMPTY_RESPONSE',
          message: 'LLM returned no text content',
          retryable: true,
        },
        metadata,
      };
    }

    let feedback: FeedbackResponse;

    try {
      feedback = this.parseResponse(textBlock.text);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const metadata: AgentMetadata = {
        agentId: this.agentId,
        agentVersion: this.version,
        processingMs: Date.now() - startTime,
        tokensUsed: inputTokens + outputTokens,
      };
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: `Failed to parse LLM response: ${errorMessage}`,
          retryable: true,
        },
        metadata,
      };
    }

    // Safety enforcement: low form score must carry at least one explicit warning
    if (request.poseAnalysis.formScore < LOW_FORM_SCORE_THRESHOLD) {
      const hasWarning = feedback.safetyWarnings.length > 0;
      if (!hasWarning) {
        feedback = {
          ...feedback,
          safetyWarnings: [
            'Your form score is significantly below safe thresholds. Please reduce the load, slow down the movement, and consider working with a physiotherapist before continuing.',
          ],
        };
      }

      // Escalate any "high" corrections to "stop" if form score is critically low
      if (request.poseAnalysis.formScore < 25) {
        feedback = {
          ...feedback,
          formCorrections: feedback.formCorrections.map((c) =>
            c.priority === 'high' ? { ...c, priority: 'stop' } : c,
          ),
        };
      }
    }

    return this.buildResult(feedback, startTime, inputTokens, outputTokens);
  }

  /**
   * Extracts and validates the JSON payload from the raw LLM response text.
   * The model is instructed to return bare JSON but may occasionally wrap it
   * in markdown fences — this handles both cases.
   */
  private parseResponse(content: string): FeedbackResponse {
    // Strip markdown code fences if present
    const stripped = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let raw: unknown;

    try {
      raw = JSON.parse(stripped);
    } catch {
      throw new Error(`Response is not valid JSON. Received:\n${content.slice(0, 500)}`);
    }

    if (typeof raw !== 'object' || raw === null) {
      throw new Error('Parsed response is not an object');
    }

    const obj = raw as Record<string, unknown>;

    if (typeof obj['summary'] !== 'string') {
      throw new Error('Missing or invalid "summary" field');
    }
    if (!Array.isArray(obj['formCorrections'])) {
      throw new Error('Missing or invalid "formCorrections" field');
    }
    if (typeof obj['motivationalMessage'] !== 'string') {
      throw new Error('Missing or invalid "motivationalMessage" field');
    }
    if (!Array.isArray(obj['nextSteps'])) {
      throw new Error('Missing or invalid "nextSteps" field');
    }
    if (!Array.isArray(obj['safetyWarnings'])) {
      throw new Error('Missing or invalid "safetyWarnings" field');
    }

    const rawObj = obj as RawFeedbackResponse;

    const formCorrections: FormCorrection[] = rawObj.formCorrections.map((c, i) => {
      if (typeof c.bodyPart !== 'string') throw new Error(`formCorrections[${i}].bodyPart missing`);
      if (typeof c.issue !== 'string') throw new Error(`formCorrections[${i}].issue missing`);
      if (typeof c.instruction !== 'string') throw new Error(`formCorrections[${i}].instruction missing`);
      if (!isValidPriority(c.priority)) {
        throw new Error(`formCorrections[${i}].priority "${c.priority}" is not valid`);
      }
      return {
        bodyPart: c.bodyPart,
        issue: c.issue,
        instruction: c.instruction,
        priority: c.priority,
      };
    });

    const nextSteps = rawObj.nextSteps.map((s, i) => {
      if (typeof s !== 'string') throw new Error(`nextSteps[${i}] is not a string`);
      return s;
    });

    const safetyWarnings = rawObj.safetyWarnings.map((s, i) => {
      if (typeof s !== 'string') throw new Error(`safetyWarnings[${i}] is not a string`);
      return s;
    });

    return {
      summary: rawObj.summary,
      formCorrections,
      motivationalMessage: rawObj.motivationalMessage,
      nextSteps,
      safetyWarnings,
    };
  }

  private buildResult<T>(
    data: T,
    startTime: number,
    inputTokens: number,
    outputTokens: number,
  ): AgentResult<T> {
    const metadata: AgentMetadata = {
      agentId: this.agentId,
      agentVersion: this.version,
      processingMs: Date.now() - startTime,
      tokensUsed: inputTokens + outputTokens,
    };

    return {
      success: true,
      data,
      metadata,
    };
  }
}

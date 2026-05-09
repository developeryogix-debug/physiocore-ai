import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentContext,
  AgentResult,
  BehaviorProfile,
  RetentionIntervention,
} from '@physiocore/types';
import {
  calculateChurnRisk,
  detectEngagementPatterns,
  type SessionSummary,
} from './churnPredictor.js';
import { selectInterventions, detectMotivationStyle } from './interventionEngine.js';

export interface BehaviorAgentInput {
  sessionHistory: SessionSummary[];
  currentStreak: number;
  totalSessions: number;
  averageDurationMin: number;
}

export class BehaviorAgent {
  private readonly agentId = 'behavior-agent';
  private readonly version = '1.0.0';
  private readonly client: Anthropic;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
  }

  async analyzeAndRetain(
    input: BehaviorAgentInput,
    context: AgentContext,
  ): Promise<AgentResult<{ profile: BehaviorProfile; interventions: RetentionIntervention[] }>> {
    const startTime = Date.now();
    const { userProfile } = context;

    // 1. Detect engagement patterns from session history
    const patterns = detectEngagementPatterns(input.sessionHistory);

    // 2. Calculate adherence score
    const adherenceScore = this.calculateAdherenceScore(input);

    // 3. Bootstrap a minimal profile to detect motivation style
    const bootstrapProfile: BehaviorProfile = {
      userId: userProfile.id,
      adherenceScore,
      streakDays: input.currentStreak,
      longestStreakDays: input.currentStreak,
      totalSessionsCompleted: input.totalSessions,
      averageSessionDurationMin: input.averageDurationMin,
      churnRisk: { score: 0, level: 'low', factors: [] },
      motivationStyle: 'purpose',
      engagementPatterns: patterns,
    };

    const motivationStyle = detectMotivationStyle(bootstrapProfile);

    // 4. Build full profile with real motivation style
    const profile: BehaviorProfile = {
      ...bootstrapProfile,
      motivationStyle,
    };

    // 5. Calculate churn risk with fully populated profile
    profile.churnRisk = calculateChurnRisk(profile);

    // 6. Select rule-based interventions
    const interventions = selectInterventions(profile);

    // 7. If high/critical churn, personalize via Claude
    if (profile.churnRisk.level === 'high' || profile.churnRisk.level === 'critical') {
      await this.personalizeInterventions(interventions, profile, context);
    }

    return {
      success: true,
      data: { profile, interventions },
      metadata: {
        agentId: this.agentId,
        agentVersion: this.version,
        processingMs: Date.now() - startTime,
      },
    };
  }

  private calculateAdherenceScore(input: BehaviorAgentInput): number {
    const completionRate =
      input.sessionHistory.length > 0
        ? input.sessionHistory.filter(s => s.completed).length / input.sessionHistory.length
        : 0;
    const streakBonus = Math.min(input.currentStreak * 2, 20);
    return Math.min(100, Math.round(completionRate * 80 + streakBonus));
  }

  private async personalizeInterventions(
    interventions: RetentionIntervention[],
    profile: BehaviorProfile,
    context: AgentContext,
  ): Promise<void> {
    if (interventions.length === 0) return;

    const systemPrompt =
      `You are a health coach specializing in behavioral psychology and retention. ` +
      `User profile: name=${context.userProfile.name}, goal=${context.userProfile.primaryGoal}, ` +
      `motivation_style=${profile.motivationStyle}, churn_risk=${profile.churnRisk.level}. ` +
      `Rewrite each intervention message to be highly personal, warm, and specific to this user. ` +
      `Return ONLY a JSON array of strings, one per intervention.`;

    const userPrompt =
      `Personalize these ${interventions.length} messages:\n` +
      interventions.map((iv, idx) => `${idx}: ${iv.message}`).join('\n');

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '[]';
      const messages = JSON.parse(text) as string[];

      messages.forEach((msg, idx) => {
        const intervention = interventions[idx];
        if (intervention !== undefined && typeof msg === 'string') {
          intervention.message = msg;
        }
      });
    } catch {
      // Non-critical: keep original messages on error
    }
  }
}

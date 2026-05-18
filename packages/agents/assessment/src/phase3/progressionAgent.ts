/**
 * progressionAgent.ts — Phase 3 Progression Review Agent (Haiku)
 *
 * Fires every 4 sessions. Evaluates recent session performance against
 * the current ArbiterVerdict to determine intensity adjustments.
 *
 * Rules:
 *   2-for-2 rule   — increase only if last 2 sessions both completed
 *   Pain spike     — pain increased >2pts from verdict baseline → decrease
 *   3× decrease    — 3 consecutive decreases → triggerFullReassessment = true
 *   nextReview     — always sessionCount + 4
 *
 * SaMD Class II — all output is decision support only, never autonomous clinical action.
 * DO NOT modify safetyRules.ts or any Phase 2 agent.
 *
 * Model: claude-haiku-4-5-20251001 | Max tokens: 500
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ArbiterVerdict } from '../types/phase3.js';
import type { SessionSummary } from '../types/findings.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdjustmentType = 'increase' | 'maintain' | 'decrease' | 'reassess';

export interface ProgressionInput {
  patientId:       string;
  sessionCount:    number;
  lastVerdict:     ArbiterVerdict;
  recentSessions:  SessionSummary[];   // last 4 sessions (may be fewer on first review)
}

export interface ProgressionUpdate {
  agentId:                  'progression-agent-phase3';
  version:                  '1.0.0';
  patientId:                string;
  generatedAt:              string;

  adjustmentType:           AdjustmentType;
  intensityDelta:           number;           // -2 to +2 on 10-point scale
  exerciseChanges:          string[];
  rationale:                string;
  triggerFullReassessment:  boolean;
  nextReviewSessionCount:   number;           // sessionCount + 4
  processingMs:             number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL      = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 500;

// ── Deterministic pre-checks ──────────────────────────────────────────────────

interface PreCheck {
  forcedAdjustment: AdjustmentType | null;
  forcedDelta:      number;
  reasons:          string[];
}

function runPreChecks(input: ProgressionInput): PreCheck {
  const { recentSessions } = input;
  const reasons: string[] = [];

  // Pain spike check — compare most recent pain_before vs earlier baseline
  const painScores = recentSessions
    .map(s => s.pain_before)
    .filter((p): p is number => p !== undefined);

  if (painScores.length >= 2) {
    const latest   = painScores[painScores.length - 1];
    const baseline = painScores[0];
    if (latest - baseline > 2) {
      reasons.push(`Pain increased ${latest - baseline} pts (${baseline} → ${latest}) — decrease mandatory`);
      return { forcedAdjustment: 'decrease', forcedDelta: -1, reasons };
    }
  }

  // 2-for-2 rule — increase blocked unless last 2 sessions completed
  // A session is "completed" when reps > 0
  const completed = recentSessions.filter(s => s.reps > 0);
  const last2Complete = recentSessions.length >= 2
    && recentSessions[recentSessions.length - 1].reps > 0
    && recentSessions[recentSessions.length - 2].reps > 0;

  if (!last2Complete && completed.length < 2) {
    reasons.push('2-for-2 rule: fewer than 2 consecutive completed sessions — increase blocked');
  }

  return { forcedAdjustment: null, forcedDelta: 0, reasons };
}

// ── Consecutive decrease tracker (from rationale history not stored — inferred) ──

/** Count consecutive 'decrease' signals from form-score slope in recent sessions */
function countConsecutiveDeclines(recentSessions: SessionSummary[]): number {
  // Use avg_score declining across consecutive sessions as a proxy
  let count = 0;
  for (let i = recentSessions.length - 1; i > 0; i--) {
    if (recentSessions[i].avg_score < recentSessions[i - 1].avg_score) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You are a physiotherapy progression specialist reviewing a patient's last 4 sessions.
Your task: determine whether to increase, maintain, decrease, or reassess treatment intensity.

Output ONLY valid JSON — no prose, no markdown fences:
{
  "adjustmentType": "increase|maintain|decrease|reassess",
  "intensityDelta": <number from -2 to 2>,
  "exerciseChanges": ["change 1", "change 2"],
  "rationale": "1-2 sentence clinical rationale"
}

Rules you MUST follow:
- Increase allowed ONLY if last 2 sessions both completed (reps > 0)
- If pain rose >2pts since last verdict baseline → decrease (intensityDelta ≤ -1)
- If form score (avg_score) has declined 3 sessions in a row → reassess
- intensityDelta must be an integer -2 to +2
- exerciseChanges: 1-3 concrete exercise modifications (sets/reps/load)
- SaMD Class II: output is decision support only`;

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(input: ProgressionInput, preCheck: PreCheck): string {
  const { patientId, sessionCount, lastVerdict, recentSessions } = input;

  const sessionRows = recentSessions.map((s, i) =>
    `  S${i + 1}: ${s.exercise}, reps=${s.reps}, form=${s.avg_score}/100, ` +
    `pain_before=${s.pain_before ?? 'n/a'}, pain_after=${s.pain_after ?? 'n/a'}`
  ).join('\n');

  const preCheckNote = preCheck.reasons.length > 0
    ? `\nPRE-CHECK FLAGS:\n${preCheck.reasons.map(r => `  - ${r}`).join('\n')}`
    : '';

  return `PATIENT: ${patientId}
Total sessions to date: ${sessionCount}
Arbiter verdict: ${lastVerdict.winner} (confidence ${lastVerdict.confidenceScore.toFixed(2)})
Arbiter rationale: ${lastVerdict.arbitrationReason}

RECENT 4 SESSIONS:
${sessionRows || '  (no sessions available)'}
${preCheckNote}

Determine the progression update for this patient.`;
}

// ── Response parser ────────────────────────────────────────────────────────────

interface LLMResponse {
  adjustmentType: AdjustmentType;
  intensityDelta: number;
  exerciseChanges: string[];
  rationale: string;
}

function parseResponse(raw: string): LLMResponse {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('ProgressionAgent: no JSON in response');
  const parsed = JSON.parse(match[0]) as LLMResponse;

  // Clamp intensityDelta to -2..+2
  parsed.intensityDelta = Math.max(-2, Math.min(2, Math.round(parsed.intensityDelta)));

  return parsed;
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export class ProgressionAgent {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: ProgressionInput): Promise<ProgressionUpdate> {
    const t0 = Date.now();
    const { patientId, sessionCount, recentSessions } = input;

    // Deterministic pre-checks
    const preCheck = runPreChecks(input);

    // Consecutive decline check (triggers reassess regardless of LLM output)
    const consecutiveDeclines = countConsecutiveDeclines(recentSessions);
    const forceReassess = consecutiveDeclines >= 3;

    let result: LLMResponse;

    try {
      const msg = await this.client.messages.create({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     SYSTEM,
        messages:   [{ role: 'user', content: buildPrompt(input, preCheck) }],
      });

      const raw = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');

      result = parseResponse(raw);
    } catch {
      // Parse / API failure → safe default
      result = {
        adjustmentType: 'maintain',
        intensityDelta:  0,
        exerciseChanges: [],
        rationale:       'Progression agent error — defaulted to maintain per safety-first rule.',
      };
    }

    // Apply deterministic overrides
    if (preCheck.forcedAdjustment !== null) {
      result.adjustmentType = preCheck.forcedAdjustment;
      result.intensityDelta  = preCheck.forcedDelta;
      result.rationale       = `${preCheck.reasons.join('; ')}. ${result.rationale}`;
    }

    if (forceReassess) {
      result.adjustmentType = 'reassess';
      result.rationale      = `3 consecutive session declines detected. ${result.rationale}`;
    }

    // Block increase if 2-for-2 not met
    const last2Complete = recentSessions.length >= 2
      && recentSessions[recentSessions.length - 1].reps > 0
      && recentSessions[recentSessions.length - 2].reps > 0;

    if (result.adjustmentType === 'increase' && !last2Complete) {
      result.adjustmentType = 'maintain';
      result.intensityDelta  = 0;
      result.rationale       = `2-for-2 rule blocked increase. ${result.rationale}`;
    }

    return {
      agentId:                 'progression-agent-phase3',
      version:                 '1.0.0',
      patientId,
      generatedAt:             new Date().toISOString(),

      adjustmentType:          result.adjustmentType,
      intensityDelta:          result.intensityDelta,
      exerciseChanges:         result.exerciseChanges ?? [],
      rationale:               result.rationale,
      triggerFullReassessment: forceReassess || result.adjustmentType === 'reassess',
      nextReviewSessionCount:  sessionCount + 4,
      processingMs:            Date.now() - t0,
    };
  }
}

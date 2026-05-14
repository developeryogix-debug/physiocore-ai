/**
 * ProgressionAgent.ts
 * Phase 3 — runs after every 4 sessions to adjust the treatment plan.
 *
 * Stage 1 (TypeScript): linear regression on form scores, pain trend,
 *   algorithmic action decision (no LLM).
 * Stage 2 (Haiku): clinical rationale, updated exercise list, clinician flags.
 *
 * Spec: docs/PHASE3_TREATMENT_PLANNING.md §4.4
 * Model: claude-haiku-4-5-20251001 / 500 tokens
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SessionSummary } from '../types/findings.js';
import type {
  ProgressionInput,
  ProgressionOutput,
  FinalTreatmentPlan,
  TreatmentPhase,
  LoadingStrategy,
  PrescribedExerciseP3,
} from '../types/phase3.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL      = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 500;

// ─── Stage 1: Algorithmic helpers ─────────────────────────────────────────────

/**
 * Linear regression on form scores (0–100).
 * Algorithm from PHASE3_TREATMENT_PLANNING.md §4.4.
 */
function computeProgressScore(sessions: SessionSummary[]): {
  slope: number;
  trend: 'improving' | 'plateaued' | 'declining';
  score: number;
} {
  const n = sessions.length;
  if (n < 2) return { slope: 0, trend: 'plateaued', score: sessions[0]?.avg_score ?? 50 };

  const xs = sessions.map((_, i) => i);
  const ys = sessions.map(s => s.avg_score);
  const xBar = (n - 1) / 2;
  const yBar = ys.reduce((a, b) => a + b, 0) / n;
  const ssXY = xs.reduce((acc, x, i) => acc + (x - xBar) * ((ys[i] ?? yBar) - yBar), 0);
  const ssXX = xs.reduce((acc, x) => acc + (x - xBar) ** 2, 0);
  const slope  = ssXX === 0 ? 0 : ssXY / ssXX;
  const score  = Math.round(Math.max(0, Math.min(100, yBar)));
  const trend  = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'plateaued';
  return { slope: Math.round(slope * 100) / 100, trend, score };
}

/** Resolve the active TreatmentPhase from the current week. */
function resolvePhase(plan: FinalTreatmentPlan, week: number): TreatmentPhase {
  let cumulative = 0;
  for (const phase of plan.phases) {
    cumulative += phase.durationWeeks;
    if (week <= cumulative) return phase;
  }
  return plan.phases[plan.phases.length - 1]!;
}

/** Decide action pre-LLM using decision table from spec. */
function decideAction(
  slope:          number,
  avgPain:        number,
  highPainCount:  number,
): ProgressionOutput['action'] {
  if (highPainCount >= 2)             return 'regress';  // pain >7 on 2+ sessions — immediate
  if (slope > 1.0 && avgPain < 3)    return 'advance';
  if (slope >= 0  && avgPain <= 5)   return 'hold';
  if (slope < 0   && avgPain <= 5)   return 'modify';
  return 'regress';                                       // slope < 0 AND avgPain > 5
}

/** Advance or retract loading strategy by one step. */
function shiftLoading(
  current: LoadingStrategy,
  action:  ProgressionOutput['action'],
): LoadingStrategy {
  const order: LoadingStrategy[] = ['rest', 'gentle', 'moderate', 'progressive', 'high'];
  const idx = order.indexOf(current);
  if (action === 'advance') return order[Math.min(idx + 1, order.length - 1)] ?? 'high';
  if (action === 'regress') return order[Math.max(idx - 1, 0)] ?? 'rest';
  return current;
}

/** Compute phase number to target after action. */
function targetPhaseNumber(
  plan:           FinalTreatmentPlan,
  currentPhaseNo: number,
  action:         ProgressionOutput['action'],
): number {
  if (action === 'advance') return Math.min(currentPhaseNo + 1, plan.phases.length);
  if (action === 'regress') return Math.max(currentPhaseNo - 1, 1);
  return currentPhaseNo;
}

// ─── ProgressionAgent ─────────────────────────────────────────────────────────

export class ProgressionAgent {
  private readonly client = new Anthropic();

  async run(input: ProgressionInput): Promise<ProgressionOutput> {
    const t0 = Date.now();

    // ── Stage 1: Algorithmic analysis ──────────────────────────────────────────
    const { slope, trend, score } = computeProgressScore(input.recentSessions);

    const avgPain = input.recentPainScores.length
      ? input.recentPainScores.reduce((a, b) => a + b, 0) / input.recentPainScores.length
      : 0;
    const highPainCount = input.recentPainScores.filter(p => p > 7).length;

    const action            = decideAction(slope, avgPain, highPainCount);
    const activePhase       = resolvePhase(input.currentPlan, input.currentWeek);
    const tPhaseNo          = targetPhaseNumber(input.currentPlan, activePhase.phaseNumber, action);
    const newLoadingStrategy = shiftLoading(activePhase.loadingStrategy, action);

    // Pre-compute clinician flags
    const flags: string[] = [];
    if (avgPain > 5)
      flags.push(`Average pain ${avgPain.toFixed(1)}/10 over last ${input.recentPainScores.length} sessions — above acceptable threshold`);
    if (slope < -1.0)
      flags.push('Significant form score decline — review exercise technique and loading');
    if (input.recentSessions.length < 4)
      flags.push(`Only ${input.recentSessions.length} sessions recorded — progression data may be insufficient`);
    if (highPainCount >= 2)
      flags.push(`Pain >7/10 on ${highPainCount} sessions — urgent clinician review recommended`);

    const psfsLatest = input.recentPSFS?.at(-1) ?? null;
    const psfsFirst  = input.recentPSFS?.[0]    ?? null;
    const psfsChange = psfsLatest !== null && psfsFirst !== null
      ? +(psfsLatest - psfsFirst).toFixed(1)
      : null;

    // Immediate regress path — skip Haiku
    if (action === 'regress' && highPainCount >= 2) {
      const tPhase = input.currentPlan.phases.find(p => p.phaseNumber === tPhaseNo) ?? activePhase;
      return {
        action:            'regress',
        targetPhase:        tPhaseNo,
        reasoning:          `Pain exceeded 7/10 on ${highPainCount} of the last ${input.recentPainScores.length} sessions. Immediate regression to Phase ${tPhaseNo} (${tPhase.label}). Clinician review required before next session.`,
        progressScore:      score,
        formScoreSlope:     slope,
        sessionsTrend:      trend,
        updatedExercises:   tPhase.exercises,
        newLoadingStrategy,
        flagsForClinician:  flags,
        processingMs:       Date.now() - t0,
      };
    }

    // ── Stage 2: Haiku adjustment ──────────────────────────────────────────────
    const haikusInput = JSON.stringify({
      currentWeek:              input.currentWeek,
      currentPhase:             activePhase.phaseNumber,
      currentPhaseLabel:        activePhase.label,
      action,
      progressScore:            score,
      formSlope:                slope,
      trend,
      avgPain:                  +avgPain.toFixed(1),
      psfsChange,
      currentExercises:         activePhase.exercises.map(e => e.name),
      phaseProgressionTrigger:  activePhase.progressionTrigger,
      phaseRegressionTrigger:   activePhase.regressionTrigger,
      newLoadingStrategy,
      contraindications:        input.currentPlan.contraindications,
      outputSchema: {
        reasoning:         'string — 2–3 sentences clinical rationale in plain language for patient',
        updatedExercises: [{
          name:             'string',
          sets:             3,
          reps:             10,
          holdSeconds:      null,
          frequencyPerWeek: 3,
          rationale:        'string — one-sentence clinical rationale',
          loadingStrategy:  'moderate',
        }],
        flagsForClinician: ['string'],
      },
    });

    const SYSTEM = `You are a physiotherapy progression analyst. Algorithmic stage is complete — your role:
1. Write 2–3 sentence clinical rationale confirming the action (${action}) in plain English for the patient.
2. Adjust the exercise list for the new loading strategy (${newLoadingStrategy}):
   ${action === 'advance' ? '→ suggest harder progressions or increase load/reps' : ''}
   ${action === 'regress' ? '→ suggest easier regressions, reduce sets/reps/load' : ''}
   ${action === 'modify'  ? '→ swap underperforming exercises, keep similar difficulty' : ''}
   ${action === 'hold'    ? '→ keep current exercises, fine-tune cues only' : ''}
3. Add clinician flags for unexpected findings (plateau, new symptoms, adherence concern).
Output ONLY valid JSON — no preamble, no markdown fences.`;

    // Fallback values (algorithmic defaults)
    let reasoning     = `${action === 'advance' ? 'Progressing' : action === 'regress' ? 'Regressing' : action === 'modify' ? 'Modifying' : 'Maintaining'} treatment plan. Form score ${score}/100 (${trend}), average pain ${avgPain.toFixed(1)}/10.`;
    let updatedExercises: PrescribedExerciseP3[] = activePhase.exercises;
    let haikusFlags:  string[] = [];

    try {
      const resp = await this.client.messages.create({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     SYSTEM,
        messages:   [{ role: 'user', content: haikusInput }],
      });
      const txt = (resp.content[0] as { text: string }).text ?? '';
      const raw = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as {
        reasoning?:        string;
        updatedExercises?: PrescribedExerciseP3[];
        flagsForClinician?: string[];
      };
      if (typeof raw.reasoning === 'string' && raw.reasoning.length > 0)
        reasoning = raw.reasoning;
      if (Array.isArray(raw.updatedExercises) && raw.updatedExercises.length > 0)
        updatedExercises = raw.updatedExercises;
      if (Array.isArray(raw.flagsForClinician))
        haikusFlags = raw.flagsForClinician;
    } catch { /* fall through to algorithmic fallback */ }

    return {
      action,
      targetPhase:        tPhaseNo,
      reasoning,
      progressScore:      score,
      formScoreSlope:     slope,
      sessionsTrend:      trend,
      updatedExercises,
      newLoadingStrategy,
      flagsForClinician:  [...flags, ...haikusFlags],
      processingMs:       Date.now() - t0,
    };
  }
}

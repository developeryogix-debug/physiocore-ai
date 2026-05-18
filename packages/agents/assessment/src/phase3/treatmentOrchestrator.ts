/**
 * treatmentOrchestrator.ts — Phase 3 Treatment Planning Orchestrator
 *
 * Pipeline (strict sequential after Step 1):
 *   Step 1 — ConservativeProtocolAgent + EarlyMobProtocolAgent (parallel)
 *   Step 2 — TreatmentArbiterPhase3Agent (Opus 3-round debate → verdict)
 *   Step 3 — PrescriptionAgentPhase3 (Sonnet → FHIR R4 CarePlan + Supabase care_plans)
 *   Step 4 — ProgressionAgent (Haiku) — only when sessionCount % 4 === 0 AND > 0
 *   Step 5 — Persist full output to Supabase treatment_plans table
 *
 * Export:
 *   runPhase3Assessment(input: PlanningInput, sessionCount: number): Phase3OrchestratorOutput
 *
 * SaMD Class II — all output is decision support only, never autonomous clinical action.
 * DO NOT modify safetyRules.ts or any Phase 2 agent.
 */

import { createClient } from '@supabase/supabase-js';

import { ConservativeProtocolAgent }    from './conservativeAgent.js';
import type { ConservativeProtocol }    from './conservativeAgent.js';
import { EarlyMobProtocolAgent }        from './earlyMobAgent.js';
import type { EarlyMobProtocol }        from './earlyMobAgent.js';
import { TreatmentArbiterPhase3Agent }  from './treatmentArbiterAgent.js';
import type { Phase3ArbiterVerdict }    from './treatmentArbiterAgent.js';
import { PrescriptionAgentPhase3 }      from './prescriptionAgent.js';
import type { Phase3CarePlan }          from './prescriptionAgent.js';
import { ProgressionAgent }             from './progressionAgent.js';
import type { ProgressionUpdate }       from './progressionAgent.js';
import type { PlanningInput, ArbiterVerdict } from '../types/phase3.js';

// ── Public output type ────────────────────────────────────────────────────────

export interface Phase3OrchestratorOutput {
  conservative:      ConservativeProtocol;
  earlyMob:          EarlyMobProtocol;
  verdict:           Phase3ArbiterVerdict;
  carePlan:          Phase3CarePlan;
  progression?:      ProgressionUpdate;
  supabaseRowId:     string | null;
  totalProcessingMs: number;
}

// ── Adapter — Phase3ArbiterVerdict → ArbiterVerdict (for ProgressionAgent) ───

function toArbiterVerdict(v: Phase3ArbiterVerdict): ArbiterVerdict {
  return {
    winner:            v.winner === 'blended' ? 'hybrid' : v.winner,
    hybridRationale:   v.winner === 'blended' ? v.clinicalRationale : null,
    phaseSource:       [],
    rejectedElements:  [],
    safetyOverrides:   v.safetyOverrideReasons,
    arbitrationReason: v.clinicalRationale,
    confidenceScore:   v.confidence,
    processingMs:      v.processingMs,
  };
}

// ── Supabase persistence ──────────────────────────────────────────────────────

function makeSupabase() {
  const url = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['VITE_SUPABASE_ANON_KEY'] ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function persistTreatmentPlan(
  output:       Phase3OrchestratorOutput,
  patientId:    string,
  assessmentId: string,
): Promise<string | null> {
  const sb = makeSupabase();
  if (!sb) {
    console.warn('[TreatmentOrchestrator] Supabase env vars missing — skipping treatment_plans write');
    return null;
  }

  const row = {
    user_id:       patientId,
    assessment_id: assessmentId,
    verdict_winner: output.verdict.winner,
    confidence:    output.verdict.confidence,
    evidence_grade: output.verdict.evidenceGrade,
    safety_override: output.verdict.safetyOverride,
    care_plan_id:   output.carePlan.supabaseId,
    progression_adjustment: output.progression?.adjustmentType ?? null,
    trigger_reassessment:   output.progression?.triggerFullReassessment ?? false,
    total_processing_ms:    output.totalProcessingMs,
    plan_json: {
      conservative: {
        mckenzieClassification: output.conservative.mckenzieClassification,
        mckenzieExercises:      output.conservative.mckenzieExercises,
        homeExerciseProgram:    output.conservative.homeExerciseProgram,
        expectedTimeline:       output.conservative.expectedTimeline,
        redFlags:               output.conservative.redFlags,
      },
      earlyMob: {
        fearAvoidanceProfile: output.earlyMob.fearAvoidanceProfile,
        fearLadder:           output.earlyMob.fearLadder.slice(0, 4),
        expectedTimeline:     output.earlyMob.expectedTimeline,
        contraindicationsToEarlyMob: output.earlyMob.contraindicationsToEarlyMob,
      },
      verdict: {
        winner:            output.verdict.winner,
        confidence:        output.verdict.confidence,
        modifications:     output.verdict.modifications,
        clinicalRationale: output.verdict.clinicalRationale,
        reviewTriggers:    output.verdict.reviewTriggers,
        evidenceGrade:     output.verdict.evidenceGrade,
        safetyOverride:    output.verdict.safetyOverride,
      },
      fhirCarePlan: output.carePlan.fhirCarePlan,
      progression:  output.progression ?? null,
    },
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from('treatment_plans')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error('[TreatmentOrchestrator] treatment_plans insert error:', error.message);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.id ?? null;
  } catch (err) {
    console.error('[TreatmentOrchestrator] treatment_plans write threw:', err);
    return null;
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Runs the full Phase 3 treatment planning pipeline.
 *
 * @param input        PlanningInput — assessment findings + patient profile.
 *                     Include `sessionHistory` (last 4 sessions) for accurate
 *                     ProgressionAgent firing when sessionCount % 4 === 0.
 * @param sessionCount Total completed sessions this patient has done.
 *                     When % 4 === 0 AND > 0, ProgressionAgent runs.
 * @param apiKey       Optional Anthropic API key (falls back to env).
 */
export async function runPhase3Assessment(
  input:        PlanningInput,
  sessionCount: number,
  apiKey?:      string,
): Promise<Phase3OrchestratorOutput> {
  const t0 = Date.now();

  // ── Step 1: Parallel protocol generation ──────────────────────────────────
  console.log('[Phase3] Step 1: ConservativeAgent + EarlyMobAgent (parallel)…');
  const [conservative, earlyMob] = await Promise.all([
    new ConservativeProtocolAgent(apiKey).run(input),
    new EarlyMobProtocolAgent(apiKey).run(input),
  ]);
  console.log(`[Phase3] Step 1 done — conservative ${conservative.processingMs}ms, earlyMob ${earlyMob.processingMs}ms`);

  // ── Step 2: Arbiter debate (Opus) ─────────────────────────────────────────
  console.log('[Phase3] Step 2: TreatmentArbiterAgent (Opus)…');
  const verdict = await new TreatmentArbiterPhase3Agent(apiKey).run({
    conservative,
    earlyMob,
    patientContext: input,
  });
  console.log(`[Phase3] Step 2 done — winner: ${verdict.winner}, confidence: ${(verdict.confidence * 100).toFixed(0)}%, safetyOverride: ${verdict.safetyOverride}`);

  // ── Step 3: Prescription + FHIR R4 CarePlan ──────────────────────────────
  console.log('[Phase3] Step 3: PrescriptionAgentPhase3 (Sonnet → FHIR)…');
  const carePlan = await new PrescriptionAgentPhase3(apiKey).run({
    verdict,
    conservative,
    earlyMob,
    patientContext: input,
  });
  console.log(`[Phase3] Step 3 done — care_plans supabaseId: ${carePlan.supabaseId ?? 'not saved'}, ${carePlan.processingMs}ms`);

  // ── Step 4: Progression review (every 4 sessions, skip on session 0) ──────
  let progression: ProgressionUpdate | undefined;
  if (sessionCount > 0 && sessionCount % 4 === 0) {
    console.log(`[Phase3] Step 4: ProgressionAgent (session ${sessionCount}, every-4 review)…`);
    const recentSessions = (input.sessionHistory ?? []).slice(-4);
    progression = await new ProgressionAgent(apiKey).run({
      patientId:      input.patientId,
      sessionCount,
      lastVerdict:    toArbiterVerdict(verdict),
      recentSessions,
    });
    console.log(`[Phase3] Step 4 done — adjustment: ${progression.adjustmentType}, delta: ${progression.intensityDelta}, triggerReassess: ${progression.triggerFullReassessment}`);
  } else {
    console.log(`[Phase3] Step 4 skipped — sessionCount ${sessionCount} (fires at multiples of 4)`);
  }

  const totalProcessingMs = Date.now() - t0;

  const output: Phase3OrchestratorOutput = {
    conservative,
    earlyMob,
    verdict,
    carePlan,
    progression,
    supabaseRowId:  null,
    totalProcessingMs,
  };

  // ── Step 5: Persist to treatment_plans ────────────────────────────────────
  console.log('[Phase3] Step 5: persisting to treatment_plans…');
  output.supabaseRowId = await persistTreatmentPlan(output, input.patientId, input.assessmentId);
  console.log(`[Phase3] Step 5 done — rowId: ${output.supabaseRowId ?? 'write failed'}`);

  console.log(`[Phase3] Pipeline complete — total ${Date.now() - t0}ms`);
  return output;
}

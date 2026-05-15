/**
 * TreatmentOrchestrator.ts
 * Wires all 5 Phase 3 treatment agents into a single pipeline:
 *
 *   Step 1+2 (parallel): ConservativeAgent + EarlyMobAgent
 *   Step 3: TreatmentArbiterAgent (waits for both)
 *   Step 4: PrescriptionAgent (waits for arbiter)
 *   Step 5: Save FinalTreatmentPlan to Supabase treatment_plans table
 *
 * SaMD Class II: every decision is traceable through agent outputs + timing log.
 */
import { createClient } from '@supabase/supabase-js';

import { ConservativeAgent }     from './ConservativeAgent.js';
import { EarlyMobAgent }         from './EarlyMobAgent.js';
import { TreatmentArbiterAgent } from './TreatmentArbiterAgent.js';
import { PrescriptionAgent }     from './PrescriptionAgent.js';

import type { SlimUserProfile, ClinicalAssessmentReport } from '../types/findings.js';
import type { TreatmentPlan, ArbiterVerdict, FinalTreatmentPlan } from '../types/phase3.js';
import type { FilterableExercise }  from './PrescriptionAgent.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TreatmentOrchestratorInput {
  userId:             string;
  assessmentId:       string;
  userProfile:        SlimUserProfile;
  /** Minimal ClinicalAssessmentReport for ConservativeAgent / EarlyMobAgent. */
  consensusReport:    ClinicalAssessmentReport;
  availableEquipment: string[];
  availableExercises: FilterableExercise[];
  currentWeek:        number;
  /** Derived from consensusReport risk level — default 'routine'. */
  urgencyLevel?:      'routine' | 'urgent' | 'emergency';
}

export interface TreatmentOrchestratorResult {
  conservativePlan:  TreatmentPlan;
  earlyMobPlan:      TreatmentPlan;
  verdict:           ArbiterVerdict;
  finalPlan:         FinalTreatmentPlan;
  totalProcessingMs: number;
  timings: {
    conservativeMs: number;
    earlyMobMs:     number;
    parallelMs:     number;
    arbiterMs:      number;
    prescriptionMs: number;
    supabaseMs:     number;
  };
}

// ─── Supabase client (server-side only — uses service role key) ───────────────

function makeSupabaseClient() {
  const url = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal PlanningInput from orchestrator input for both planning agents. */
function toPlanningInput(input: TreatmentOrchestratorInput) {
  return {
    assessmentId:    input.assessmentId,
    patientId:       input.userId,
    consensusReport: input.consensusReport,
    userProfile:     input.userProfile,
    // FilterableExercise satisfies the loose PlanningInput exercise shape
    availableExercises: input.availableExercises.map(ex => ({
      name:               ex.displayName,
      evidenceGrade:      ex.evidenceGrade,
      rationale:          ex.primaryReference,
      cptCodeSuggestion:  ex.cptCodeSuggestion,
    })),
    equipmentAvailable: input.availableEquipment,
  };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class TreatmentOrchestrator {
  private conservative:  ConservativeAgent;
  private earlyMob:      EarlyMobAgent;
  private arbiter:       TreatmentArbiterAgent;
  private prescription:  PrescriptionAgent;

  constructor() {
    this.conservative = new ConservativeAgent();
    this.earlyMob     = new EarlyMobAgent();
    this.arbiter      = new TreatmentArbiterAgent();
    this.prescription = new PrescriptionAgent();
  }

  async run(input: TreatmentOrchestratorInput): Promise<TreatmentOrchestratorResult> {
    const totalStart = Date.now();
    const planInput  = toPlanningInput(input);

    // ── Step 1+2: ConservativeAgent + EarlyMobAgent in parallel ──────────────
    console.log('[TreatmentOrchestrator] Step 1+2: running conservative + earlyMob in parallel…');
    const parallelStart = Date.now();

    const [
      { result: conservativePlan, ms: conservativeMs },
      { result: earlyMobPlan,     ms: earlyMobMs },
    ] = await Promise.all([
      this._timed(() => this.conservative.run(planInput)),
      this._timed(() => this.earlyMob.run(planInput)),
    ]);

    const parallelMs = Date.now() - parallelStart;
    console.log(`[TreatmentOrchestrator] Step 1+2 done — conservative ${conservativeMs}ms, earlyMob ${earlyMobMs}ms (wall ${parallelMs}ms)`);

    // ── Step 3: TreatmentArbiterAgent ─────────────────────────────────────────
    console.log('[TreatmentOrchestrator] Step 3: arbiter…');
    const { result: verdict, ms: arbiterMs } = await this._timed(() =>
      this.arbiter.run({
        patientId:    input.userId,
        assessmentId: input.assessmentId,
        conservative: conservativePlan,
        earlyMob:     earlyMobPlan,
        userProfile:  input.userProfile,
        urgencyLevel: input.urgencyLevel ?? 'routine',
      }),
    );
    console.log(`[TreatmentOrchestrator] Step 3 done — winner: ${verdict.winner}, confidence: ${verdict.confidenceScore}/100 (${arbiterMs}ms)`);

    // ── Step 4: PrescriptionAgent ─────────────────────────────────────────────
    const winningPlan: TreatmentPlan =
      verdict.winner === 'early_mob' ? earlyMobPlan : conservativePlan;

    console.log('[TreatmentOrchestrator] Step 4: prescription…');
    const { result: finalPlan, ms: prescriptionMs } = await this._timed(() =>
      this.prescription.run({
        verdict,
        winningPlan,
        userProfile:        input.userProfile,
        availableEquipment: input.availableEquipment,
        availableExercises: input.availableExercises,
        currentWeek:        input.currentWeek,
        assessmentId:       input.assessmentId,
        patientId:          input.userId,
      }),
    );
    console.log(`[TreatmentOrchestrator] Step 4 done — ${finalPlan.totalDurationWeeks}wk plan, ${finalPlan.weeklySchedule.length} weeks generated (${prescriptionMs}ms)`);

    // ── Step 5: Persist to Supabase treatment_plans ───────────────────────────
    let supabaseMs = 0;
    const sbStart  = Date.now();
    const sb       = makeSupabaseClient();

    if (sb) {
      try {
        await sb.from('treatment_plans').insert({
          user_id:        input.userId,
          assessment_id:  input.assessmentId,
          plan_json:      finalPlan as unknown as Record<string, unknown>,
          verdict_winner: verdict.winner,
          total_weeks:    finalPlan.totalDurationWeeks,
        });
        supabaseMs = Date.now() - sbStart;
        console.log(`[TreatmentOrchestrator] Step 5: saved to Supabase treatment_plans (${supabaseMs}ms)`);
      } catch (err) {
        supabaseMs = Date.now() - sbStart;
        console.warn('[TreatmentOrchestrator] Step 5: Supabase write failed (non-fatal):', err);
      }
    } else {
      console.warn('[TreatmentOrchestrator] Step 5: Supabase client unavailable — SUPABASE_SERVICE_ROLE_KEY missing');
    }

    const totalProcessingMs = Date.now() - totalStart;
    console.log(`[TreatmentOrchestrator] Complete — total ${totalProcessingMs}ms`);

    return {
      conservativePlan,
      earlyMobPlan,
      verdict,
      finalPlan,
      totalProcessingMs,
      timings: {
        conservativeMs,
        earlyMobMs,
        parallelMs,
        arbiterMs,
        prescriptionMs,
        supabaseMs,
      },
    };
  }

  /** Runs fn(), returns result + elapsed ms. */
  private async _timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
    const t = Date.now();
    const result = await fn();
    return { result, ms: Date.now() - t };
  }
}

/**
 * treatmentOrchestrator.ts — Phase 3 Treatment Planning Orchestrator
 *
 * Pipeline:
 *   Step 1 — ConservativeProtocolAgent + EarlyMobProtocolAgent (parallel)
 *   Step 2 — TreatmentArbiterPhase3Agent (Opus debate → verdict)
 *   Step 3 — PrescriptionAgentPhase3 (FHIR R4 CarePlan)
 *   Step 4 — ProgressionAgent (Haiku) — only when sessionCount % 4 === 0
 *
 * SaMD Class II — all output is decision support only, never autonomous clinical action.
 * DO NOT modify safetyRules.ts or any Phase 2 agent.
 */

import { ConservativeProtocolAgent }  from './conservativeAgent.js';
import type { ConservativeProtocol }  from './conservativeAgent.js';
import { EarlyMobProtocolAgent }      from './earlyMobAgent.js';
import type { EarlyMobProtocol }      from './earlyMobAgent.js';
import { TreatmentArbiterPhase3Agent }from './treatmentArbiterAgent.js';
import type { Phase3ArbiterVerdict }  from './treatmentArbiterAgent.js';
import { PrescriptionAgentPhase3 }    from './prescriptionAgent.js';
import type { Phase3CarePlan }        from './prescriptionAgent.js';
import { ProgressionAgent }           from './progressionAgent.js';
import type { ProgressionUpdate }     from './progressionAgent.js';
import type { PlanningInput }         from '../types/phase3.js';
import type { ArbiterVerdict }        from '../types/phase3.js';
import type { SessionSummary }        from '../types/findings.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Phase3OrchestratorInput {
  planningInput:  PlanningInput;
  sessionCount:   number;
  recentSessions: SessionSummary[];
  apiKey?:        string;
}

export interface Phase3OrchestratorOutput {
  conservative:      ConservativeProtocol;
  earlyMob:          EarlyMobProtocol;
  verdict:           Phase3ArbiterVerdict;
  carePlan:          Phase3CarePlan;
  progression?:      ProgressionUpdate;
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

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runPhase3Assessment(
  input: Phase3OrchestratorInput,
): Promise<Phase3OrchestratorOutput> {
  const t0 = Date.now();
  const { planningInput, sessionCount, recentSessions, apiKey } = input;

  // ── Step 1: Conservative + EarlyMob in parallel ──────────────────────────
  const [conservative, earlyMob] = await Promise.all([
    new ConservativeProtocolAgent(apiKey).run(planningInput),
    new EarlyMobProtocolAgent(apiKey).run(planningInput),
  ]);

  // ── Step 2: Arbiter debate (Opus) ─────────────────────────────────────────
  const verdict = await new TreatmentArbiterPhase3Agent(apiKey).run({
    conservative,
    earlyMob,
    patientContext: planningInput,
  });

  // ── Step 3: Prescription + FHIR CarePlan ─────────────────────────────────
  const carePlan = await new PrescriptionAgentPhase3(apiKey).run({
    verdict,
    conservative,
    earlyMob,
    patientContext: planningInput,
  });

  // ── Step 4: Progression review (every 4 sessions only) ───────────────────
  let progression: ProgressionUpdate | undefined;
  if (sessionCount > 0 && sessionCount % 4 === 0) {
    progression = await new ProgressionAgent(apiKey).run({
      patientId:      planningInput.patientId,
      sessionCount,
      lastVerdict:    toArbiterVerdict(verdict),
      recentSessions,
    });
  }

  return {
    conservative,
    earlyMob,
    verdict,
    carePlan,
    progression,
    totalProcessingMs: Date.now() - t0,
  };
}

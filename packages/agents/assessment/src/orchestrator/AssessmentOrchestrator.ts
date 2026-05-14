/**
 * AssessmentOrchestrator.ts
 * Phase 2 Assessment Swarm — wires all 6 specialist agents.
 *
 * Execution sequence:
 *   Phase 1 (parallel)   — PostureAgent, ROMAgent, PainMapAgent,
 *                           FunctionalAgent, GaitAgent (only if data present)
 *   Phase 2 (sequential) — SpecialTestsAgent (clinician mode only)
 *   Phase 3 (sequential) — AdversarialAgent  (critiques phase 1+2)
 *   Phase 4 (sequential) — ConsensusAgent    (only if adversarial approved)
 *   Phase 5 (always)     — SafetyRuleEngine  (hard-coded, non-bypassable)
 *
 * Safety contract: if ANY red flag fires, execution stops immediately and only
 * safety alerts are returned. No agent output reaches caller.
 *
 * Persistence: result saved to Supabase `full_assessments` table.
 *
 * Sources:
 *   APA Red Flags Guidelines (2021)
 *   Kendall et al. Muscles Testing and Function, 5th Ed.
 */

import { createClient }      from '@supabase/supabase-js';
import { SafetyRuleEngine }  from '@physiocore/clinical-agent';
import type {
  CurrentSymptoms,
  RedFlagAlert as SafetyRedFlagAlert,
} from '@physiocore/clinical-agent';

import { GaitAgent }        from '../gait/GaitAgent.js';
import { ROMAgent }         from '../rom/ROMAgent.js';
import { FunctionalAgent }  from '../functional/FunctionalAgent.js';
import { runPainMapAgent }  from '../pain/painMapAgent.js';
import { AdversarialAgent } from '../adversarial/AdversarialAgent.js';
import { ConsensusAgent }   from '../consensus/ConsensusAgent.js';
import { createSpecialTestsAgent } from '../specialTests/SpecialTestsAgent.js';

import type {
  PostureReport,
  GaitReport,
  ROMReport,
  FunctionalReport,
  FunctionalAgentInput,
  AdversarialInput,
  AdversarialReport,
  SpecialTestsReport,
  RedFlagAlert,
  FrameData,
  SlimUserProfile,
  SessionSummary,
  PainMapOutput,
  ClinicalAssessmentReport,
  ConsensusInput,
} from '../types/findings.js';

import type {
  PainMapInput,
  PainMapReport,
  PainRegion,
} from '../pain/painMapAgent.js';

// ─── Local UserProfile alias ─────────────────────────────────────────────────
// Mirrors @physiocore/types UserProfile without a cross-rootDir import.
// Must stay structurally compatible with that type at runtime.

export interface OrchestratorUserProfile {
  id:          string;
  email:       string;
  name:        string;
  dateOfBirth: string;
  gender:      'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  heightCm:    number;
  weightKg:    number;
  primaryGoal: string;
  injuries:    Array<{
    id:       string;
    bodyPart: string;
    type:     'acute' | 'chronic' | 'overuse';
    severity: number;
    isActive: boolean;
  }>;
  conditions: Array<{
    id:      string;
    name:    string;
    icdCode?: string;
    isActive: boolean;
  }>;
  medications: Array<{
    id:   string;
    name: string;
  }>;
}

// ─── Input / Output types ────────────────────────────────────────────────────

export interface PostureCapture {
  anterior:     string;
  rightLateral: string;
  posterior:    string;
  leftLateral:  string;
  landmarks?:   Record<string, unknown>;
}

export interface FunctionalAnswers {
  psfsActivities:           Array<{ activity: string; baseline: number; current: number }>;
  tugSeconds:               number | null;
  thirtySecChairStandCount: number | null;
  grocScore:                number | null;
  adherencePercent:         number;
}

export interface AvailableData {
  postureData?:          PostureCapture;
  sessionHistory?:       StoredSession[];
  painRegions?:          PainRegion[];
  globalNprs?:           number;
  functionalLimitation?: string;
  functionalAnswers?:    FunctionalAnswers;
  walkingFrames?:        FrameData[];
  currentSymptoms?:      Partial<CurrentSymptoms>;
}

export interface StoredSession {
  id:           string;
  exercise:     string;
  reps:         number;
  form_score:   number;
  created_at:   string;
  ai_feedback?: string;
  pain_before?: number;
  pain_after?:  number;
}

export interface AssessmentInput {
  userId:        string;
  sessionId:     string;
  userProfile:   OrchestratorUserProfile;
  availableData: AvailableData;
  mode:          'patient' | 'clinician';
}

export interface AgentReports {
  posture?:      PostureReport;
  gait?:         GaitReport;
  rom?:          ROMReport;
  painMap?:      PainMapOutput;
  functional?:   FunctionalReport;
  specialTests?: SpecialTestsReport;
}

export interface FullAssessmentResult {
  safetyAlerts:      RedFlagAlert[];
  adversarialReport: AdversarialReport | null;
  consensusReport:   ClinicalAssessmentReport | null;
  agentReports:      AgentReports;
  completedAt:       string;
  durationMs:        number;
  dataQuality:       'full' | 'partial' | 'minimal';
}

// ─── Supabase (server-side, uses process.env) ────────────────────────────────

function getSupabase() {
  const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  return createClient(url, key);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ageFromDob(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  return now.getFullYear() - dob.getFullYear()
    - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
}

function toSlimProfile(profile: OrchestratorUserProfile): SlimUserProfile {
  const sex: 'male' | 'female' | 'other' =
    profile.gender === 'male' ? 'male' :
    profile.gender === 'female' ? 'female' : 'other';

  return {
    ageYears:       ageFromDob(profile.dateOfBirth),
    sex,
    primaryGoal:    profile.primaryGoal,
    activeInjuries: profile.injuries
      .filter(i => i.isActive)
      .map(i => ({ bodyPart: i.bodyPart, type: i.type, severity: i.severity })),
    conditions: profile.conditions
      .filter(c => c.isActive)
      .map(c => ({ name: c.name, ...(c.icdCode !== undefined && { icdCode: c.icdCode }) })),
    medications: profile.medications.map(m => ({ name: m.name })),
  };
}

function toSessionSummaries(sessions: StoredSession[]): SessionSummary[] {
  return sessions.map(s => ({
    date:                s.created_at,
    exercise:            s.exercise,
    reps:                s.reps,
    avg_score:           s.form_score,
    top_deviation:       '',
    ai_feedback_summary: s.ai_feedback ?? '',
    ...(s.pain_before !== undefined && { pain_before: s.pain_before }),
    ...(s.pain_after  !== undefined && { pain_after:  s.pain_after  }),
  }));
}

function buildCurrentSymptoms(data: AvailableData): CurrentSymptoms {
  return {
    painScore:    data.globalNprs ?? 0,
    painLocation: (data.painRegions ?? []).map(r => r.bodyPart),
    ...(data.currentSymptoms ?? {}),
  };
}

function toRedFlagAlerts(raw: SafetyRedFlagAlert[]): RedFlagAlert[] {
  return raw.map(a => ({
    type:            a.redFlag.id,
    description:     a.redFlag.name,
    immediateAction: a.redFlag.mandatoryAction,
    emergencyLevel:  a.redFlag.emergencyLevel === 'call_999'
      ? 'call_999'
      : a.redFlag.emergencyLevel === 'urgent_referral'
      ? 'urgent_referral'
      : 'monitor',
  }));
}

function dataQualityScore(reports: AgentReports): FullAssessmentResult['dataQuality'] {
  const count = Object.values(reports).filter(Boolean).length;
  if (count >= 4) return 'full';
  if (count >= 2) return 'partial';
  return 'minimal';
}

// ─── PostureAgent shim ───────────────────────────────────────────────────────
// Full PostureAgent (grid overlay + angle extraction) is Phase 3.

async function runPostureAgent(
  _capture: PostureCapture,
  _patientId: string,
): Promise<PostureReport | null> {
  return null;
}

// ─── AdversarialInput builder ────────────────────────────────────────────────
// Conditional spread satisfies exactOptionalPropertyTypes.

function buildAdversarialInput(
  reports: AgentReports,
  profile: SlimUserProfile,
): AdversarialInput {
  return {
    userProfile: profile,
    ...(reports.posture      && { postureReport:      reports.posture }),
    ...(reports.gait         && { gaitReport:         reports.gait }),
    ...(reports.rom          && { romReport:          reports.rom }),
    ...(reports.painMap      && { painMapOutput:      reports.painMap }),
    ...(reports.functional   && { functionalReport:   reports.functional }),
    ...(reports.specialTests && { specialTestsReport: reports.specialTests }),
  };
}

// ─── ConsensusInput builder ──────────────────────────────────────────────────

function buildConsensusInput(
  sessionId:   string,
  userId:      string,
  profile:     OrchestratorUserProfile,
  slim:        SlimUserProfile,
  reports:     AgentReports,
  adversarial: AdversarialReport,
): ConsensusInput {
  return {
    assessmentId:       sessionId,
    patientId:          userId,
    patientAge:         slim.ageYears,
    ...(slim.sex !== 'other' && { patientSex: slim.sex }),
    existingConditions: profile.conditions.map(c => c.name),
    currentMedications: profile.medications.map(m => m.name),
    allFindings: {
      posture:      (reports.posture ?? null) as Record<string, unknown> | null,
      gait:         reports.gait         ?? null,
      rom:          reports.rom          ?? null,
      specialTests: reports.specialTests ?? null,
      pain:         reports.painMap      ?? null,
      functional:   reports.functional   ?? null,
    },
    adversarialReport: adversarial,
  };
}

// ─── Supabase persistence ────────────────────────────────────────────────────

async function persistResult(
  userId:    string,
  sessionId: string,
  result:    FullAssessmentResult,
): Promise<void> {
  const sb = getSupabase();
  await sb.from('full_assessments').insert({
    user_id:             userId,
    session_id:          sessionId,
    result_json:         result as unknown as Record<string, unknown>,
    safety_alerts_count: result.safetyAlerts.length,
    approved:            result.adversarialReport?.approvedForConsensus ?? true,
  });
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export class AssessmentOrchestrator {
  private readonly safety: SafetyRuleEngine;

  constructor() {
    this.safety = new SafetyRuleEngine();
  }

  /**
   * Run the full 5-phase assessment swarm.
   *
   * Returns FullAssessmentResult. If safety red flags fire, only safetyAlerts
   * is populated; all other fields are empty/null. This is non-bypassable.
   */
  async run(input: AssessmentInput): Promise<FullAssessmentResult> {
    const wallStart = Date.now();
    const { userId, sessionId, userProfile, availableData, mode } = input;

    // ── Phase 5 (ALWAYS FIRST) — SafetyRuleEngine ──────────────────────────
    // Cross-boundary cast: OrchestratorUserProfile is structurally identical
    // to @physiocore/types UserProfile at runtime.
    const symptoms = buildCurrentSymptoms(availableData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawAlerts    = this.safety.checkForRedFlags(userProfile as any, symptoms);
    const safetyAlerts = toRedFlagAlerts(rawAlerts);

    if (safetyAlerts.length > 0) {
      const result: FullAssessmentResult = {
        safetyAlerts,
        adversarialReport: null,
        consensusReport:   null,
        agentReports:      {},
        completedAt:       new Date().toISOString(),
        durationMs:        Date.now() - wallStart,
        dataQuality:       'minimal',
      };
      await persistResult(userId, sessionId, result).catch(() => { /* non-fatal */ });
      return result;
    }

    // ── Phase 1 — Parallel specialist agents ─────────────────────────────────
    const phase1Start = Date.now();
    const phase1 = await Promise.allSettled([
      // PostureAgent
      availableData.postureData
        ? runPostureAgent(availableData.postureData, userId)
        : Promise.resolve(null),

      // ROMAgent
      availableData.sessionHistory && availableData.sessionHistory.length > 0
        ? new ROMAgent().analyseFromSessions(
            userId,
            toSessionSummaries(availableData.sessionHistory),
          )
        : Promise.resolve(null),

      // PainMapAgent
      availableData.painRegions && availableData.painRegions.length > 0
        ? runPainMapAgent({
            userId,
            sessionId,
            regions:              availableData.painRegions,
            globalNprs:           availableData.globalNprs ?? 0,
            functionalLimitation: availableData.functionalLimitation ?? '',
          } satisfies PainMapInput)
        : Promise.resolve(null),

      // FunctionalAgent
      availableData.functionalAnswers
        ? (() => {
            const fa  = availableData.functionalAnswers!;
            const age = ageFromDob(userProfile.dateOfBirth);
            const funcInput: FunctionalAgentInput = {
              patientId:                userId,
              psfsActivities:           fa.psfsActivities,
              tugSeconds:               fa.tugSeconds,
              thirtySecChairStandCount: fa.thirtySecChairStandCount,
              grocScore:                fa.grocScore,
              sessionCount:             availableData.sessionHistory?.length ?? 0,
              adherencePercent:         fa.adherencePercent,
              ageYears:                 age,
              ...(userProfile.gender === 'male' || userProfile.gender === 'female'
                ? { sex: userProfile.gender }
                : {}),
            };
            return new FunctionalAgent().run(funcInput);
          })()
        : Promise.resolve(null),

      // GaitAgent
      availableData.walkingFrames && availableData.walkingFrames.length > 10
        ? new GaitAgent().analyseWalk(availableData.walkingFrames)
        : Promise.resolve(null),
    ]);

    console.log(`[AssessmentOrchestrator] Phase 1 in ${Date.now() - phase1Start}ms`);

    const agentReports: AgentReports = {};
    const [postureR, romR, painR, functionalR, gaitR] = phase1;

    if (postureR.status === 'fulfilled' && postureR.value) {
      agentReports.posture = postureR.value;
    }
    if (romR.status === 'fulfilled' && romR.value) {
      agentReports.rom = romR.value;
    }
    if (painR.status === 'fulfilled' && painR.value) {
      const r = painR.value as PainMapReport;
      agentReports.painMap = {
        riskLevel:              r.riskLevel,
        painTrend:              r.painTrend,
        redFlags:               r.redFlags,
        clinicalSummary:        r.clinicalSummary,
        differentialHypotheses: r.differentialHypotheses,
        safeToExercise:         r.safeToExercise,
        icd10Codes:             r.icd10Codes,
      };
    }
    if (functionalR.status === 'fulfilled' && functionalR.value) {
      agentReports.functional = functionalR.value;
    }
    if (gaitR.status === 'fulfilled' && gaitR.value) {
      agentReports.gait = gaitR.value;
    }

    // Log Phase 1 failures (non-fatal)
    for (const [name, r] of [
      ['posture',    postureR],
      ['rom',        romR],
      ['pain',       painR],
      ['functional', functionalR],
      ['gait',       gaitR],
    ] as const) {
      if (r.status === 'rejected') {
        console.warn(`[AssessmentOrchestrator] ${name} agent failed:`, r.reason);
      }
    }

    // ── Phase 2 — SpecialTestsAgent (clinician mode only) ────────────────────
    if (mode === 'clinician') {
      const phase2Start = Date.now();
      try {
        const stAgent = createSpecialTestsAgent();
        const joint   = availableData.painRegions?.[0]?.bodyPart ?? 'knee';
        const report: SpecialTestsReport = stAgent.selectTests(joint);
        agentReports.specialTests = report;
        console.log(`[AssessmentOrchestrator] Phase 2 in ${Date.now() - phase2Start}ms`);
      } catch (err) {
        console.warn('[AssessmentOrchestrator] SpecialTestsAgent failed (non-fatal):', err);
      }
    }

    // ── Phase 3 — AdversarialAgent ────────────────────────────────────────────
    const phase3Start = Date.now();
    let adversarialReport: AdversarialReport | null = null;
    try {
      adversarialReport = await new AdversarialAgent().critique(
        buildAdversarialInput(agentReports, toSlimProfile(userProfile)),
        userId,
      );
      console.log(`[AssessmentOrchestrator] Phase 3 in ${Date.now() - phase3Start}ms`);
    } catch (err) {
      console.error('[AssessmentOrchestrator] AdversarialAgent failed:', err);
    }

    // ── Phase 4 — ConsensusAgent (only if adversarial approved) ──────────────
    let consensusReport: ClinicalAssessmentReport | null = null;
    if (adversarialReport?.approvedForConsensus) {
      const phase4Start = Date.now();
      try {
        const slim = toSlimProfile(userProfile);
        consensusReport = await new ConsensusAgent().run(
          buildConsensusInput(sessionId, userId, userProfile, slim, agentReports, adversarialReport),
        );
        console.log(`[AssessmentOrchestrator] Phase 4 in ${Date.now() - phase4Start}ms`);
      } catch (err) {
        console.error('[AssessmentOrchestrator] ConsensusAgent failed:', err);
      }
    } else if (adversarialReport) {
      console.warn('[AssessmentOrchestrator] Adversarial review blocked consensus');
    }

    const result: FullAssessmentResult = {
      safetyAlerts:      [],
      adversarialReport,
      consensusReport,
      agentReports,
      completedAt:       new Date().toISOString(),
      durationMs:        Date.now() - wallStart,
      dataQuality:       dataQualityScore(agentReports),
    };

    await persistResult(userId, sessionId, result).catch(() => { /* non-fatal */ });
    return result;
  }
}

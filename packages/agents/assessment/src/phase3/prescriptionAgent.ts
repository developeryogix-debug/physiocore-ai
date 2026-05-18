/**
 * prescriptionAgent.ts — Phase 3 Prescription Agent
 *
 * Converts Phase3ArbiterVerdict → FHIR R4 CarePlan + Supabase persistence.
 *
 * Pipeline:
 *   1. Sonnet synthesises winning protocol exercises + return-to-activity milestones → JSON
 *   2. Deterministic FHIR R4 CarePlan builder (DO NOT call FHIRClient — it lacks CarePlan)
 *   3. Supabase upsert to care_plans table
 *
 * SaMD Class II — output is decision support only, never autonomous clinical action.
 *
 * Model: claude-sonnet-4-20250514  |  Max tokens: 1200
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { Phase3ArbiterVerdict }  from './treatmentArbiterAgent.js';
import type { ConservativeProtocol }  from './conservativeAgent.js';
import type { EarlyMobProtocol }      from './earlyMobAgent.js';
import type { PlanningInput }         from '../types/phase3.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Phase3PrescriptionInput {
  verdict:        Phase3ArbiterVerdict;
  conservative:   ConservativeProtocol;
  earlyMob:       EarlyMobProtocol;
  patientContext: PlanningInput;
}

interface SonnetActivity {
  name:            string;
  cptCode:         string;
  sets:            number;
  reps:            number | null;
  holdSeconds:     number | null;
  frequencyPerWeek: number;
  rationale:       string;
  citation:        string;
}

interface SonnetGoal {
  description:   string;
  timeframeWeeks: number;
  measure:       string;
}

interface SonnetPlan {
  activities: SonnetActivity[];
  goals:      SonnetGoal[];
}

export interface Phase3CarePlan {
  agentId:       'prescription-agent-phase3';
  version:       '1.0.0';
  patientId:     string;
  assessmentId:  string;
  generatedAt:   string;
  winner:        Phase3ArbiterVerdict['winner'];
  fhirCarePlan:  FHIRCarePlan;
  supabaseId:    string | null;
  processingMs:  number;
}

// Minimal FHIR R4 CarePlan shape (no external FHIR utility — per spec)
interface FHIRCoding   { system: string; code: string; display?: string }
interface FHIRCodeable { coding: FHIRCoding[]; text?: string }

interface FHIRCarePlanActivity {
  detail: {
    kind:    'ServiceRequest';
    code:    FHIRCodeable;
    status:  'scheduled';
    scheduledTiming: { repeat: { frequency: number; period: 1; periodUnit: 'wk' } };
    description: string;
  };
}

interface FHIRCarePlanGoal {
  description: FHIRCodeable;
  target: Array<{ measure: FHIRCodeable; dueDate: string }>;
}

export interface FHIRCarePlan {
  resourceType: 'CarePlan';
  status:       'active';
  intent:       'plan';
  category:     FHIRCodeable[];
  title:        string;
  description:  string;
  subject:      { reference: string };
  period:       { start: string; end: string };
  activity:     FHIRCarePlanActivity[];
  goal:         FHIRCarePlanGoal[];
  note:         Array<{ text: string }>;
  extension:    Array<{ url: string; valueString: string }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL      = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1200;

const PHYSIOTHERAPY_CATEGORY: FHIRCodeable = {
  coding: [{
    system:  'http://snomed.info/sct',
    code:    '91251008',
    display: 'Physical therapy procedure (regime/therapy)',
  }],
  text: 'Physiotherapy',
};

// ── Sonnet prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a clinical physiotherapy prescription expert converting a treatment arbiter verdict into a structured exercise programme.
Output ONLY valid JSON matching this exact schema:
{
  "activities": [
    {
      "name": "string",
      "cptCode": "string (e.g. 97110)",
      "sets": number,
      "reps": number|null,
      "holdSeconds": number|null,
      "frequencyPerWeek": number,
      "rationale": "string (≤10 words)",
      "citation": "string (Author Year Journal)"
    }
  ],
  "goals": [
    {
      "description": "string — specific, measurable return-to-activity milestone",
      "timeframeWeeks": number,
      "measure": "string — observable outcome measure (e.g. NPRS ≤2/10, PSFS ≥7/10)"
    }
  ]
}

Rules:
- activities: 4–8 exercises matching the winning protocol and modifications
- goals: 2–4 milestones (acute, subacute, return-to-activity, discharge)
- Evidence grade D exercises: omit
- reps OR holdSeconds, not both (null the other)
- cptCode: 97110 (therapeutic exercise), 97530 (therapeutic activities), 97032 (e-stim), 97012 (traction), 97140 (manual therapy)
- SaMD Class II: every activity must be safe to include without human review override
- Output ONLY the JSON object. No markdown fences, no explanation.`;

function buildSonnetPrompt(
  verdict:      Phase3ArbiterVerdict,
  conservative: ConservativeProtocol,
  earlyMob:     EarlyMobProtocol,
  patient:      PlanningInput,
): string {
  const dx       = patient.consensusReport.primaryDiagnosis?.name ?? 'unspecified diagnosis';
  const nprs     = patient.currentPainLevel ?? 'unknown';
  const winner   = verdict.winner;
  const mods     = verdict.modifications.slice(0, 4).join('; ') || 'none';
  const rationale = verdict.clinicalRationale;

  const conservExs = conservative.mckenzieExercises
    .slice(0, 4)
    .map(e => `${e.name} (${e.sets}×${e.reps}, hold ${e.holdSeconds ?? 0}s) — ${e.citation}`)
    .join('\n');

  const manualTx = conservative.manualTherapy
    .slice(0, 2)
    .map(t => `${t.name} Grade ${t.maitlandGrade} — ${t.citation}`)
    .join('\n');

  const ladderExs = earlyMob.fearLadder
    .slice(0, 4)
    .map(s => `Step ${s.step}: ${s.activity} (SUDS ${s.fearRating})`)
    .join('\n');

  return [
    `PATIENT: ${patient.userProfile.ageYears}y ${patient.userProfile.sex}, NPRS ${nprs}/10`,
    `Diagnosis: ${dx}`,
    `Conditions: ${patient.userProfile.conditions.map(c => c.name).join(', ') || 'none'}`,
    `Active injuries: ${patient.userProfile.activeInjuries.map(i => `${i.bodyPart} ${i.type}`).join(', ') || 'none'}`,
    ``,
    `ARBITER VERDICT: winner=${winner} confidence=${(verdict.confidence * 100).toFixed(0)}%`,
    `Rationale: ${rationale}`,
    `Blended modifications: ${mods}`,
    `Evidence grade: ${verdict.evidenceGrade}`,
    ``,
    `CONSERVATIVE exercises (McKenzie/Maitland):`,
    conservExs || 'none',
    manualTx   || '',
    ``,
    `EARLY MOB fear ladder (select low-SUDS steps if blended/early_mob winner):`,
    ladderExs || 'none',
    ``,
    `CONTRAINDICATIONS (must not appear in activities): ${verdict.contraindications.slice(0, 4).join('; ')}`,
    `REVIEW TRIGGERS → goals: ${verdict.reviewTriggers.slice(0, 3).join('; ')}`,
    ``,
    `Generate activities + goals JSON now.`,
  ].join('\n');
}

// ── Sonnet call ───────────────────────────────────────────────────────────────

async function callSonnet(
  verdict:      Phase3ArbiterVerdict,
  conservative: ConservativeProtocol,
  earlyMob:     EarlyMobProtocol,
  patient:      PlanningInput,
  client:       Anthropic,
): Promise<SonnetPlan> {
  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: buildSonnetPrompt(verdict, conservative, earlyMob, patient) }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('PrescriptionAgentPhase3: Sonnet returned no JSON');

  return JSON.parse(match[0]) as SonnetPlan;
}

// ── FHIR R4 CarePlan builder (deterministic) ──────────────────────────────────

function addWeeks(iso: string, weeks: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0] ?? iso;
}

function buildFHIRCarePlan(
  plan:      SonnetPlan,
  verdict:   Phase3ArbiterVerdict,
  patientId: string,
  startDate: string,
): FHIRCarePlan {
  const maxGoalWeeks = plan.goals.reduce((m, g) => Math.max(m, g.timeframeWeeks), 12);

  const activities: FHIRCarePlanActivity[] = plan.activities.map(act => ({
    detail: {
      kind:   'ServiceRequest',
      code: {
        coding: [{
          system:  'http://www.ama-assn.org/go/cpt',
          code:    act.cptCode,
          display: act.name,
        }],
        text: act.name,
      },
      status: 'scheduled',
      scheduledTiming: {
        repeat: { frequency: act.frequencyPerWeek, period: 1, periodUnit: 'wk' },
      },
      description: [
        `${act.sets} set${act.sets !== 1 ? 's' : ''}`,
        act.reps        != null ? `${act.reps} reps`           : null,
        act.holdSeconds != null ? `${act.holdSeconds}s hold`   : null,
        `| ${act.rationale}`,
        `| Ref: ${act.citation}`,
      ].filter(Boolean).join(', '),
    },
  }));

  const goals: FHIRCarePlanGoal[] = plan.goals.map(goal => ({
    description: { coding: [{ system: 'http://snomed.info/sct', code: '709137006', display: 'Rehabilitation goal' }], text: goal.description },
    target: [{
      measure: { coding: [{ system: 'http://snomed.info/sct', code: '278844005', display: 'Functional outcome measure' }], text: goal.measure },
      dueDate: addWeeks(startDate, goal.timeframeWeeks),
    }],
  }));

  const arbiterNote = [
    `Winner: ${verdict.winner} (confidence ${(verdict.confidence * 100).toFixed(0)}%).`,
    verdict.clinicalRationale,
    verdict.safetyOverride ? `SAFETY OVERRIDE: ${verdict.safetyOverrideReasons.join('; ')}` : null,
    `Evidence grade: ${verdict.evidenceGrade}.`,
    `Review triggers: ${verdict.reviewTriggers.join('; ')}.`,
  ].filter(Boolean).join(' ');

  return {
    resourceType: 'CarePlan',
    status:       'active',
    intent:       'plan',
    category:     [PHYSIOTHERAPY_CATEGORY],
    title:        `PhysioCore AI Physiotherapy Plan — ${verdict.winner} protocol`,
    description:  `Phase 3 treatment plan generated by PhysioCore AI (SaMD Class II — decision support only). Assessment ID: ${verdict.assessmentId}.`,
    subject:      { reference: `Patient/${patientId}` },
    period: {
      start: startDate,
      end:   addWeeks(startDate, maxGoalWeeks),
    },
    activity: activities,
    goal:     goals,
    note:     [{ text: arbiterNote }],
    extension: [
      { url: 'https://physiocore.ai/fhir/ext/assessmentId',    valueString: verdict.assessmentId },
      { url: 'https://physiocore.ai/fhir/ext/arbiterWinner',   valueString: verdict.winner },
      { url: 'https://physiocore.ai/fhir/ext/evidenceGrade',   valueString: verdict.evidenceGrade },
      { url: 'https://physiocore.ai/fhir/ext/safetyOverride',  valueString: String(verdict.safetyOverride) },
      { url: 'https://physiocore.ai/fhir/ext/samdClass',       valueString: 'II — decision support only' },
    ],
  };
}

// ── Supabase persistence ──────────────────────────────────────────────────────

function makeSupabaseClient() {
  const url = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['VITE_SUPABASE_ANON_KEY'] ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function persistToSupabase(
  plan:        Phase3CarePlan,
  fhirCarePlan: FHIRCarePlan,
): Promise<string | null> {
  const sb = makeSupabaseClient();
  if (!sb) {
    console.warn('[PrescriptionAgentPhase3] Supabase env vars missing — skipping persistence');
    return null;
  }

  const row = {
    patient_id:    plan.patientId,
    assessment_id: plan.assessmentId,
    winner:        plan.winner,
    care_plan:     fhirCarePlan as unknown as Record<string, unknown>,
    generated_at:  plan.generatedAt,
    evidence_grade: (fhirCarePlan.extension.find(e => e.url.endsWith('evidenceGrade'))?.valueString) ?? 'B',
    safety_override: plan.winner === 'conservative' && fhirCarePlan.extension.find(e => e.url.endsWith('safetyOverride'))?.valueString === 'true',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('care_plans')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[PrescriptionAgentPhase3] Supabase insert error:', error.message);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.id ?? null;
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export class PrescriptionAgentPhase3 {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: Phase3PrescriptionInput): Promise<Phase3CarePlan> {
    const t0 = Date.now();
    const { verdict, conservative, earlyMob, patientContext } = input;

    // Stage 1 — Sonnet generates activities + goals
    const plan = await callSonnet(verdict, conservative, earlyMob, patientContext, this.client);

    // Stage 2 — Deterministic FHIR R4 CarePlan
    const startDate   = new Date().toISOString().split('T')[0] ?? new Date().toDateString();
    const fhirCarePlan = buildFHIRCarePlan(plan, verdict, verdict.patientId, startDate);

    const result: Phase3CarePlan = {
      agentId:      'prescription-agent-phase3',
      version:      '1.0.0',
      patientId:    verdict.patientId,
      assessmentId: verdict.assessmentId,
      generatedAt:  new Date().toISOString(),
      winner:       verdict.winner,
      fhirCarePlan,
      supabaseId:   null,
      processingMs: 0,
    };

    // Stage 3 — Supabase persistence
    result.supabaseId = await persistToSupabase(result, fhirCarePlan);
    result.processingMs = Date.now() - t0;

    return result;
  }
}

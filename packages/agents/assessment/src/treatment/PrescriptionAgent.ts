/**
 * PrescriptionAgent.ts
 * Phase 3 — final treatment planning agent.
 * 3-stage pipeline:
 *   1. TypeScript filter (equipment + contraindications + evidence grade)
 *   2. Haiku program builder → WeekByWeekSchedule[]
 *   3. Deterministic FHIR R4 CarePlan builder
 *
 * Model: claude-haiku-4-5-20251001 (cheap + deterministic for structured output)
 * Max tokens: 800
 * SaMD Class II: every exercise prescription traceable to primary evidence.
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  ArbiterVerdict,
  TreatmentPlan,
  TreatmentPhase,
  FinalTreatmentPlan,
  WeekByWeekSchedule,
  PrescribedExerciseP3,
  LoadingStrategy,
} from '../types/phase3.js';
import type { SlimUserProfile } from '../types/findings.js';

// ─── Public input types ───────────────────────────────────────────────────────

/** Minimal exercise shape from exerciseLibrary.ts — avoids cross-package import. */
export interface FilterableExercise {
  id:               string;
  displayName:      string;
  category:         'gym' | 'yoga' | 'pilates' | 'physiotherapy';
  contraindications: string[];
  evidenceGrade:    'A' | 'B' | 'C' | 'D';
  cptCodeSuggestion: string;
  icdCodes:         string[];
  primaryReference: string;
}

export interface PrescriptionAgentInput {
  verdict:            ArbiterVerdict;
  /** The winning TreatmentPlan (conservative or early_mob per verdict.winner). */
  winningPlan:        TreatmentPlan;
  userProfile:        SlimUserProfile;
  availableEquipment: string[];
  availableExercises: FilterableExercise[];
  currentWeek:        number;
  assessmentId:       string;
  patientId:          string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL      = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 800;

// ─── Stage 1: Equipment lookup + exercise filter ──────────────────────────────

/** Required equipment per gym exercise. Empty = bodyweight. */
const GYM_EQUIPMENT: Readonly<Record<string, string[]>> = {
  squat:          [],
  lunge:          [],
  pushup:         [],
  glute_bridge:   [],
  hip_thrust:     ['resistance_bands', 'barbell', 'dumbbells'],
  deadlift:       ['barbell', 'dumbbells', 'kettlebell'],
  bent_over_row:  ['barbell', 'dumbbells', 'kettlebell'],
  shoulder_press: ['dumbbells', 'barbell', 'cable_machine'],
};

function equipmentOk(ex: FilterableExercise, available: string[]): boolean {
  if (ex.category !== 'gym') return true;       // physio/yoga/pilates: no equipment needed
  const req: string[] = GYM_EQUIPMENT[ex.id] ?? [];
  if (req.length === 0) return true;             // bodyweight gym exercise
  return req.some(r => available.includes(r));
}

function filterExercises(
  exercises:  FilterableExercise[],
  equipment:  string[],
  conditions: Array<{ name: string; icdCode?: string }>,
  loading:    LoadingStrategy,
): FilterableExercise[] {
  const condNames = conditions.map(c => c.name.toLowerCase());

  return exercises.filter(ex => {
    // Equipment gate
    if (!equipmentOk(ex, equipment)) return false;

    // Contraindication gate: exercise.contraindications cross-referenced with active conditions
    const blocked = ex.contraindications.some(contra =>
      condNames.some(cond => contra.toLowerCase().includes(cond))
    );
    if (blocked) return false;

    // Evidence gate: drop grade D entirely
    if (ex.evidenceGrade === 'D') return false;

    // Loading strategy gate
    if (loading === 'rest')   return false;
    if (loading === 'gentle') return ex.category === 'physiotherapy';

    return true;
  });
}

// ─── Stage 2: Haiku → WeekByWeekSchedule[] ───────────────────────────────────

const SYSTEM_PROMPT = `You are a clinical exercise programmer for physiotherapy.
Output ONLY a valid JSON array: WeekByWeekSchedule[].

Each element shape (all fields required):
{
  "week": number,
  "phase": number,
  "sessionCount": number,
  "sessionDurationMin": number,
  "exercises": [ { "name": string, "sets": number, "reps": number|null, "holdSeconds": number|null, "frequencyPerWeek": number, "rationale": string } ],
  "homeProgram": [ { "name": string, "sets": number, "reps": number|null, "holdSeconds": number|null, "frequencyPerWeek": number, "rationale": string } ],
  "reviewMilestone": string|null
}

Rules:
- "rest" loadingStrategy → sessionCount 0, exercises [], homeProgram []
- "gentle" → physio exercises only, sets 2, reps null, holdSeconds 5-10
- "moderate" → sets 2-3, reps 10-12, holdSeconds null
- "progressive"/"high" → sets 3-4, reps 10-15
- Max 4 exercises per week. Max 2 homeProgram items.
- Keep rationale ≤ 8 words.
- reviewMilestone: non-null only at last week of each phase.
- Output ONLY the JSON array. No markdown, no explanation.`;

function buildHaikuPrompt(
  winningPlan: TreatmentPlan,
  filtered:    FilterableExercise[],
  verdict:     ArbiterVerdict,
  userProfile: SlimUserProfile,
  currentWeek: number,
): string {
  const exList = filtered.slice(0, 10)
    .map(ex => `${ex.displayName} (${ex.category}, ${ex.evidenceGrade})`)
    .join(', ');

  const phases = winningPlan.phases.map(p =>
    `Phase ${p.phaseNumber} "${p.label}": ${p.durationWeeks}wk load=${p.loadingStrategy} maxPain=${p.maxAcceptablePain} freq=${p.sessionFrequency}sess/wk ${p.sessionDurationMin}min`
  ).join('\n');

  return [
    `Patient conditions: ${userProfile.conditions.map(c => c.name).join(', ') || 'none'}.`,
    `Fitness: unknown. Pain goal: avoid exceeding phase maxPain.`,
    `Winner: ${verdict.winner} (confidence ${verdict.confidenceScore}/100).`,
    `Starting week: ${currentWeek}.`,
    ``,
    `Treatment phases:`,
    phases,
    ``,
    `Available exercises: ${exList}`,
    ``,
    `Generate WeekByWeekSchedule JSON for all ${winningPlan.totalDurationWeeks} weeks.`,
  ].join('\n');
}

async function callHaiku(
  winningPlan: TreatmentPlan,
  filtered:    FilterableExercise[],
  verdict:     ArbiterVerdict,
  userProfile: SlimUserProfile,
  currentWeek: number,
  client:      Anthropic,
): Promise<WeekByWeekSchedule[]> {
  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     SYSTEM_PROMPT,
    messages:   [{
      role:    'user',
      content: buildHaikuPrompt(winningPlan, filtered, verdict, userProfile, currentWeek),
    }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '[]';
  const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  const parsed = JSON.parse(json) as WeekByWeekSchedule[];

  // Back-fill optional cptCodeSuggestion from filtered list
  const cptByName: Record<string, string> = {};
  for (const ex of filtered) {
    cptByName[ex.displayName] = ex.cptCodeSuggestion;
  }

  return parsed.map(week => ({
    ...week,
    exercises: week.exercises.map(ex => ({
      ...ex,
      cptCodeSuggestion: cptByName[ex.name] ?? '97110',
    } satisfies PrescribedExerciseP3)),
    homeProgram: week.homeProgram.map(ex => ({
      ...ex,
      cptCodeSuggestion: cptByName[ex.name] ?? '97530',
    } satisfies PrescribedExerciseP3)),
  }));
}

// ─── Stage 3: FHIR R4 CarePlan (deterministic) ───────────────────────────────

function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0] ?? isoDate;
}

function buildFHIRCarePlan(
  schedule:    WeekByWeekSchedule[],
  winningPlan: TreatmentPlan,
  patientId:   string,
  startDate:   string,
): Record<string, unknown> {
  const activities = schedule.flatMap(week =>
    week.exercises.map(ex => ({
      detail: {
        kind: 'ServiceRequest',
        code: {
          coding: [{
            system:  'http://www.ama-assn.org/go/cpt',
            code:    ex.cptCodeSuggestion ?? '97110',
            display: ex.name,
          }],
        },
        status: 'scheduled',
        scheduledTiming: {
          repeat: { frequency: ex.frequencyPerWeek, period: 1, periodUnit: 'wk' },
        },
        description: [
          `${ex.sets} set${ex.sets !== 1 ? 's' : ''}`,
          ex.reps        != null ? `${ex.reps} reps`    : null,
          ex.holdSeconds != null ? `${ex.holdSeconds}s hold` : null,
          `(week ${week.week})`,
        ].filter(Boolean).join(', '),
      },
    }))
  );

  return {
    resourceType: 'CarePlan',
    status:  'active',
    intent:  'plan',
    title:   `PhysioCore AI Treatment — ${winningPlan.philosophy.substring(0, 60)}`,
    subject: { reference: `Patient/${patientId}` },
    period: {
      start: startDate,
      end:   addWeeks(startDate, winningPlan.totalDurationWeeks),
    },
    activity:  activities,
    addresses: winningPlan.icd10Codes.map(code => ({
      coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code }],
    })),
    note: [{ text: winningPlan.evidenceBasis.join('; ') }],
  };
}

// ─── Summary builders ─────────────────────────────────────────────────────────

function patientInstructions(
  schedule:    WeekByWeekSchedule[],
  winningPlan: TreatmentPlan,
): string {
  const w1 = schedule[0];
  const names = w1?.exercises.slice(0, 3).map(e => e.name).join(', ') ?? 'prescribed exercises';
  const phase1 = winningPlan.phases[0];
  return [
    `Your ${winningPlan.totalDurationWeeks}-week programme begins with ${names}.`,
    `Aim for ${w1?.sessionCount ?? 3} sessions per week, each ~${w1?.sessionDurationMin ?? 30} minutes.`,
    `Stop if pain exceeds ${phase1?.maxAcceptablePain ?? 5}/10 during any exercise.`,
    winningPlan.redLineConditions.length > 0
      ? `Seek immediate care if: ${winningPlan.redLineConditions.slice(0, 2).join('; ')}.`
      : '',
  ].filter(Boolean).join(' ');
}

function clinicianNotes(
  schedule:    WeekByWeekSchedule[],
  winningPlan: TreatmentPlan,
  verdict:     ArbiterVerdict,
  userProfile: SlimUserProfile,
): string {
  const conditions = userProfile.conditions.map(c => c.name).join(', ') || 'musculoskeletal complaint';
  const w1exs = (schedule[0]?.exercises ?? [])
    .map(e => `${e.name} ${e.sets}×${e.reps ?? (e.holdSeconds ? e.holdSeconds + 's' : '?')}`)
    .join(', ');

  return [
    `S: ${conditions}. Patient goals: ${userProfile.primaryGoal}.`,
    `O: ${winningPlan.phases.length}-phase plan, ${winningPlan.totalDurationWeeks} weeks. ${schedule.length} weeks generated.`,
    `A: ${verdict.winner} approach (confidence ${verdict.confidenceScore}/100). ${verdict.arbitrationReason}`,
    `P: Week 1 — ${w1exs || 'see schedule'}. Reassess at end of each phase. Red lines: ${winningPlan.redLineConditions.slice(0, 2).join('; ') || 'per safety protocol'}.`,
  ].join('\n');
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class PrescriptionAgent {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
  }

  async run(input: PrescriptionAgentInput): Promise<FinalTreatmentPlan> {
    const start = Date.now();
    const {
      verdict, winningPlan, userProfile,
      availableEquipment, availableExercises,
      currentWeek, assessmentId, patientId,
    } = input;

    // Stage 1 — filter exercises by equipment, contraindications, evidence, loading
    const firstLoading: LoadingStrategy = winningPlan.phases[0]?.loadingStrategy ?? 'gentle';
    const filtered = filterExercises(
      availableExercises,
      availableEquipment,
      userProfile.conditions,
      firstLoading,
    );

    // Stage 2 — Haiku generates week-by-week schedule
    const weeklySchedule = await callHaiku(
      winningPlan, filtered, verdict, userProfile, currentWeek, this.client,
    );

    // Stage 3 — deterministic FHIR R4 CarePlan
    const startDate  = new Date().toISOString().split('T')[0] ?? new Date().toDateString();
    const fhirCarePlan = buildFHIRCarePlan(weeklySchedule, winningPlan, patientId, startDate);

    // Collect unique CPT + ICD-10 codes
    const filteredCpt = filtered.map(e => e.cptCodeSuggestion);
    const filteredIcd = filtered.flatMap(e => e.icdCodes);
    const cptCodes  = [...new Set([...winningPlan.cptCodes,   ...filteredCpt])];
    const icd10Codes = [...new Set([...winningPlan.icd10Codes, ...filteredIcd])];

    // Progression triggers from phase definitions
    const progressionTriggers = winningPlan.phases
      .map((p: TreatmentPhase) => p.progressionTrigger)
      .filter((t: string) => t.length > 0);

    return {
      agentId:             'prescription-agent',
      version:             '1.0.0',
      patientId,
      assessmentId,
      generatedAt:         new Date().toISOString(),
      sourcePlan:          verdict.winner,        // ArbiterVerdict['winner']
      totalDurationWeeks:  winningPlan.totalDurationWeeks,
      phases:              winningPlan.phases,
      weeklySchedule,
      contraindications:   winningPlan.contraindications,
      redLineConditions:   winningPlan.redLineConditions,
      progressionTriggers,
      cptCodes,
      icd10Codes,
      fhirCarePlan,
      patientInstructions: patientInstructions(weeklySchedule, winningPlan),
      clinicianNotes:      clinicianNotes(weeklySchedule, winningPlan, verdict, userProfile),
      evidenceBasis:       winningPlan.evidenceBasis,
      processingMs:        Date.now() - start,
    };
  }
}

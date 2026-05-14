import Anthropic from '@anthropic-ai/sdk';
import type {
  ClinicalAssessmentReport,
  SlimUserProfile,
} from '../types/findings.js';
import type {
  TreatmentPlan,
  TreatmentPhase,
  PlanningInput,
} from '../types/phase3.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 1800;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an early mobilisation physiotherapy treatment planner. Your clinical philosophy:
1. Pain education: hurt does not equal harm — explain pain approach (Moseley GL. Man Ther. 2004)
2. Graded exposure: graduated return to feared/avoided movements (Vlaeyen JWS. Pain. 2000)
3. Neuroplasticity: 3–5 sessions/week at moderate load drives cortical reorganisation
4. Progressive overload: 5–15% load increase per session when pain <4/10 (Schoenfeld BJ. J Strength Cond Res. 2010)
5. Psychosocial: track pain catastrophising; high catastrophisers need slower progression
6. Pain gate: modify (not stop) when pain 4–6/10; pause only at >7/10
7. Early loading protects cartilage, tendons, bone (Khan KM. Br J Sports Med. 2009)
Output ONLY valid JSON matching the schema. No preamble.`;

// ── Output schema ──────────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = `{
  "philosophy": "string — 1-sentence rationale for early mobilisation approach",
  "totalDurationWeeks": 10,
  "phases": [
    {
      "phaseNumber": 1,
      "label": "string — e.g. Pain Education + Active Movement",
      "durationWeeks": 2,
      "loadingStrategy": "gentle|moderate|progressive|high",
      "maxAcceptablePain": 6,
      "exercises": [
        {
          "name": "string",
          "sets": 3,
          "reps": 12,
          "holdSeconds": null,
          "frequencyPerWeek": 4,
          "rationale": "string — clinical rationale referencing evidence where possible",
          "cptCodeSuggestion": "97110",
          "loadingStrategy": "moderate"
        }
      ],
      "homeProgram": [],
      "progressionTrigger": "string — measurable condition to advance",
      "regressionTrigger": "string — measurable condition to drop back",
      "sessionFrequency": 4,
      "sessionDurationMin": 50,
      "clinicianNotes": "string",
      "citations": ["Author. Journal. Year."]
    }
  ],
  "contraindications": ["string"],
  "redLineConditions": ["string"],
  "expectedOutcomes": [
    { "outcome": "string", "timeframe": "string", "measure": "string" }
  ],
  "evidenceBasis": ["Author. Journal. Year."],
  "cptCodes": ["97110"],
  "icd10Codes": ["string"]
}`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildPrompt(input: PlanningInput): string {
  const { consensusReport, userProfile, availableExercises, jointNormativeROM } = input;

  const diagnosisBlock = consensusReport.primaryDiagnosis
    ? `Primary: ${consensusReport.primaryDiagnosis.name} (${consensusReport.primaryDiagnosis.icd10}, confidence ${consensusReport.primaryDiagnosis.confidence})`
    : 'No primary diagnosis established';

  // Determine psychosocial risk from PHQ-4 / catastrophising indicators
  const psychRisk = input.phq4Score !== undefined
    ? input.phq4Score > 6 ? 'HIGH — slow graded exposure, more pain education' : input.phq4Score > 3 ? 'MODERATE' : 'LOW'
    : 'unknown';

  const exerciseSummary = availableExercises.slice(0, 20).map(e =>
    `  - ${e.name} (${e.evidenceGrade ?? 'C'}, CPT ${e.cptCodeSuggestion ?? '97110'}): ${e.rationale}`
  ).join('\n');

  const romSummary = Object.entries(jointNormativeROM ?? {}).map(([joint, movements]) =>
    `  ${joint}: ${Object.entries(movements).map(([mv, r]) => `${mv} ${r.min}–${r.max}°`).join(', ')}`
  ).join('\n');

  return `ASSESSMENT CONTEXT:
${diagnosisBlock}
Differentials: ${consensusReport.differentialDiagnoses.map(d => d.name).join(', ') || 'none'}
Treatment priorities: ${consensusReport.treatmentPriorities.map(p => p.priority).join('; ')}
Referral recommended: ${consensusReport.referralRecommended ? `YES (${consensusReport.referralUrgency})` : 'no'}
Pain level (NPRS): ${input.currentPainLevel ?? 'unknown'}/10
PSFS average: ${input.psfsAverage ?? 'not available'}/10

PATIENT:
Age: ${userProfile.ageYears}y, Sex: ${userProfile.sex}
Fitness level: ${input.fitnessLevel ?? 'general'}
Goal: ${userProfile.primaryGoal}
Equipment: ${input.equipmentAvailable?.join(', ') ?? 'none specified'}
Active injuries: ${userProfile.activeInjuries.map(i => `${i.bodyPart} (severity ${i.severity}/5)`).join(', ') || 'none'}
Conditions: ${userProfile.conditions.map(c => c.name).join(', ') || 'none'}
Psychosocial risk: ${psychRisk}

NORMATIVE ROM TARGETS:
${romSummary || '  (not provided)'}

AVAILABLE EXERCISES (filtered for equipment + contraindications):
${exerciseSummary || '  (none provided — use general clinical knowledge)'}

INSTRUCTION: Build an EARLY MOBILISATION treatment plan. Start patients moving sooner.
Use graded exposure. If psychosocial risk is HIGH, add explicit pain education activities in Phase 1.
Do NOT prescribe rest-only phases. At minimum, gentle active movement from session 1.

Output schema:
${OUTPUT_SCHEMA}`;
}

function parsePlan(raw: string, input: PlanningInput, ms: number): TreatmentPlan {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('EarlyMobAgent: no JSON in response');
  const parsed = JSON.parse(match[0]) as Partial<TreatmentPlan>;

  return {
    agentId: 'early-mob-agent',
    version: '1.0.0',
    patientId: input.patientId,
    assessmentId: input.assessmentId,
    generatedAt: new Date().toISOString(),
    philosophy: parsed.philosophy ?? 'Early movement and graded loading for neuroplasticity and fear-avoidance reduction.',
    totalDurationWeeks: parsed.totalDurationWeeks ?? 10,
    phases: (parsed.phases ?? []) as TreatmentPhase[],
    contraindications: parsed.contraindications ?? [],
    redLineConditions: parsed.redLineConditions ?? [
      'Pain >7/10 for 2 or more consecutive sessions',
      'New neurological symptoms',
      'Acute inflammatory flare (joint hot, swollen)',
    ],
    expectedOutcomes: parsed.expectedOutcomes ?? [],
    evidenceBasis: parsed.evidenceBasis ?? [],
    cptCodes: parsed.cptCodes ?? ['97110', '97112'],
    icd10Codes: parsed.icd10Codes ?? (input.consensusReport.primaryDiagnosis ? [input.consensusReport.primaryDiagnosis.icd10] : []),
    processingMs: ms,
  };
}

// ── Agent class ────────────────────────────────────────────────────────────────

export class EarlyMobAgent {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: PlanningInput): Promise<TreatmentPlan> {
    const t0 = Date.now();

    const message = await this.client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: buildPrompt(input) }],
    });

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return parsePlan(raw, input, Date.now() - t0);
  }
}

import Anthropic from '@anthropic-ai/sdk';
import type {
  ClinicalAssessmentReport,
  PrescribedExercise,
  SessionSummary,
  SlimUserProfile,
} from '../types/findings.js';
import type {
  LoadingStrategy,
  TreatmentPlan,
  TreatmentPhase,
  PlanningInput,
} from '../types/phase3.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 1800;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a conservative physiotherapy treatment planner. Your clinical philosophy:
1. Tissue healing timeline: inflammatory (0–3 days) → proliferative (3–21 days) → remodelling (21 days–2 years)
2. Load progression: isometric only → isotonic pain-free → full ROM → functional loading
3. Pain gate: STOP or regress if pain exceeds 3/10 at rest or 5/10 during exercise
4. Loading increments: maximum 10% increase per week (Dye SF. Clin Orthop Relat Res. 2005)
5. Recovery: minimum 48h rest between sessions targeting the same muscle group
6. Contraindications are absolute — never prescribe an exercise that matches an active injury contraindication
7. Evidence: prefer Grade A/B exercises from the exercise library
Output ONLY valid JSON matching the schema. No preamble.`;

// ── Output schema ──────────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = `{
  "philosophy": "string — 1-sentence rationale for conservative approach",
  "totalDurationWeeks": 12,
  "phases": [
    {
      "phaseNumber": 1,
      "label": "string — e.g. Acute Protection",
      "durationWeeks": 3,
      "loadingStrategy": "rest|gentle|moderate|progressive|high",
      "maxAcceptablePain": 3,
      "exercises": [
        {
          "name": "string",
          "sets": 2,
          "reps": 10,
          "holdSeconds": null,
          "frequencyPerWeek": 3,
          "rationale": "string — one sentence clinical rationale",
          "cptCodeSuggestion": "97110",
          "loadingStrategy": "gentle"
        }
      ],
      "homeProgram": [],
      "progressionTrigger": "string — measurable condition to advance",
      "regressionTrigger": "string — measurable condition to drop back",
      "sessionFrequency": 3,
      "sessionDurationMin": 45,
      "clinicianNotes": "string",
      "citations": ["Author. Journal. Year."]
    }
  ],
  "contraindications": ["string"],
  "redLineConditions": ["string — stop-exercise conditions"],
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
Medications: ${userProfile.medications.map(m => m.name).join(', ') || 'none'}

NORMATIVE ROM TARGETS:
${romSummary || '  (not provided)'}

AVAILABLE EXERCISES (filtered for equipment + contraindications):
${exerciseSummary || '  (none provided — use general clinical knowledge)'}

INSTRUCTION: Build a CONSERVATIVE treatment plan. Err on the side of protection. Start from exercise regressions.
Use phases 1–3 minimum. Phase 1 = acute protection. Phase 2 = controlled mobility. Phase 3 = strength/function.

Output schema:
${OUTPUT_SCHEMA}`;
}

function parsePlan(raw: string, input: PlanningInput, ms: number): TreatmentPlan {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('ConservativeAgent: no JSON in response');
  const parsed = JSON.parse(match[0]) as Partial<TreatmentPlan>;

  return {
    agentId: 'conservative-agent',
    version: '1.0.0',
    patientId: input.patientId,
    assessmentId: input.assessmentId,
    generatedAt: new Date().toISOString(),
    philosophy: parsed.philosophy ?? 'Conservative tissue-healing-first approach.',
    totalDurationWeeks: parsed.totalDurationWeeks ?? 12,
    phases: (parsed.phases ?? []) as TreatmentPhase[],
    contraindications: parsed.contraindications ?? [],
    redLineConditions: parsed.redLineConditions ?? [
      'Pain >7/10 at rest',
      'New neurological symptoms (numbness, weakness, bowel/bladder changes)',
      'Fever or unexplained weight loss',
    ],
    expectedOutcomes: parsed.expectedOutcomes ?? [],
    evidenceBasis: parsed.evidenceBasis ?? [],
    cptCodes: parsed.cptCodes ?? ['97110'],
    icd10Codes: parsed.icd10Codes ?? (input.consensusReport.primaryDiagnosis ? [input.consensusReport.primaryDiagnosis.icd10] : []),
    processingMs: ms,
  };
}

// ── Agent class ────────────────────────────────────────────────────────────────

export class ConservativeAgent {
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

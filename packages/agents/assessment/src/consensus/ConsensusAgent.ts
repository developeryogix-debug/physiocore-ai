import Anthropic from '@anthropic-ai/sdk';
import type {
  ConsensusInput,
  ClinicalAssessmentReport,
  AdversarialReport,
  DiagnosticHypothesis,
  TreatmentPriority,
  PrescribedExercise,
  EvidenceCitation,
  RedFlagAlert,
  EvidenceGrade,
} from '../types/findings.js';

// ── §4.4 base weights (PHASE2_ASSESSMENT_SWARM.md) ────────────────────────────

const BASE_WEIGHTS: Record<string, number> = {
  'special-tests-agent': 0.30,
  'posture-agent':       0.20,
  'rom-agent':           0.20,
  'pain-agent':          0.15,
  'functional-agent':    0.10,
  'gait-agent':          0.05,
};

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior physiotherapy clinical AI performing multi-agent evidence synthesis.
You receive findings from up to 6 specialist assessment agents, each with an evidence grade and adversarial confidence weighting.

Rules:
1. Weight each finding by: baseWeight × agentConfidence × adversarialMultiplier (provided in the input).
2. Explicitly call out where agents disagreed in clinicianSummary.
3. Flag remaining uncertainty — never overstate confidence. Use confidence scores 0.0–1.0 honestly.
4. If adversarialOverallConfidence is 'low', reduce all confidence scores by 20%.
5. clinicianSummary MUST follow SOAP format with explicit S:, O:, A:, P: sections.
6. patientSummary MUST be plain English, no clinical jargon, maximum 3 sentences.
7. nextAssessmentDate MUST be ISO 8601 date (YYYY-MM-DD), typically 4–8 weeks from today.
8. Output ONLY valid JSON matching the schema. No markdown, no preamble, no trailing text.`;

// ── JSON output schema embedded in user prompt ────────────────────────────────

const OUTPUT_SCHEMA = `{
  "primaryFindings": ["string — top 5 cross-agent findings, ordered by clinical importance"],
  "primaryDiagnosis": {
    "name": "string",
    "icd10": "string",
    "confidence": 0.0,
    "evidenceGrade": "A|B|C|D",
    "supportingFindings": ["string"],
    "adversarialChallenged": false
  },
  "differentialDiagnoses": [
    {
      "name": "string",
      "icd10": "string",
      "probability": "high|moderate|low",
      "confidence": 0.0,
      "keyDistinguishingFeature": "string",
      "toExcludeWith": "string",
      "adversarialChallenged": false
    }
  ],
  "treatmentPriorities": [
    {
      "priority": 1,
      "intervention": "string",
      "rationale": "string",
      "evidenceGrade": "A|B|C|D",
      "citation": "Author et al. Journal. Year.",
      "cptCodes": ["97110"],
      "timeframeWeeks": 4
    }
  ],
  "prescribedProgram": [
    {
      "name": "string",
      "sets": 3,
      "reps": 10,
      "holdSeconds": null,
      "frequencyPerWeek": 3,
      "rationale": "string"
    }
  ],
  "referralRecommended": false,
  "referralUrgency": "routine|urgent|emergency|null",
  "referralReason": null,
  "progressionTimeline": "string — expected recovery trajectory",
  "nextAssessmentDate": "YYYY-MM-DD",
  "recommendedCPTCodes": ["97110"],
  "evidenceSummary": [
    {
      "claim": "string",
      "citation": "string",
      "evidenceGrade": "A|B|C|D",
      "agentSource": "functional-agent|rom-agent|gait-agent|pain-agent|special-tests-agent|posture-agent"
    }
  ],
  "clinicianSummary": "S: [subjective]\\nO: [objective findings from all agents]\\nA: [assessment/diagnosis]\\nP: [plan]",
  "patientSummary": "Plain English 2–3 sentence summary for the patient."
}`;

// ── Pure helpers ──────────────────────────────────────────────────────────────

function deriveAdversarialVerdict(report: AdversarialReport | null): string {
  if (!report) return 'not_run';
  if (!report.approvedForConsensus) return 'rejected';
  if (report.overallConfidence === 'low') return 'low_confidence';
  if (report.critiques.some(c => c.severity === 'critical')) return 'critical_concerns';
  if (report.critiques.some(c => c.severity === 'moderate')) return 'moderate_concerns';
  return 'accepted';
}

/**
 * Derive per-agent confidence multipliers from critiques.
 * critical → 0.30, moderate → 0.70, minor → 0.90.
 * Takes the lowest multiplier if an agent has multiple critiques.
 */
function applyConfidenceAdjustments(
  adversarialReport: AdversarialReport | null,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!adversarialReport) return map;

  const severityMultiplier: Record<string, number> = {
    critical: 0.30,
    moderate: 0.70,
    minor:    0.90,
  };

  for (const critique of adversarialReport.critiques) {
    const m = severityMultiplier[critique.severity] ?? 1.0;
    const existing = map.get(critique.targetAgent) ?? 1.0;
    map.set(critique.targetAgent, Math.min(existing, m));
  }

  return map;
}

function computeDataCompleteness(findings: ConsensusInput['allFindings']): number {
  const values = [
    findings.posture,
    findings.gait,
    findings.rom,
    findings.specialTests,
    findings.pain,
    findings.functional,
  ];
  const present = values.filter(v => v !== null).length;
  return Math.round((present / 6) * 100) / 100;
}

function computeDataQuality(
  completeness: number,
  adversarialReport: AdversarialReport | null,
): ClinicalAssessmentReport['dataQuality'] {
  if (completeness === 0) return 'insufficient';
  if (completeness < 0.50) return 'low';
  if (completeness < 0.83) return 'medium';
  if (adversarialReport?.overallConfidence === 'low') return 'medium';
  return 'high';
}

function computeHealthScore(
  synthesis: Partial<SynthesisResult>,
  referralFlags: RedFlagAlert[],
  functional: ConsensusInput['allFindings']['functional'],
): number {
  const levelMap: Record<string, number> = {
    normal:              85,
    mildly_impaired:     65,
    moderately_impaired: 45,
    severely_impaired:   20,
  };

  let score = functional
    ? (levelMap[functional.overallFunctionLevel] ?? 70)
    : 70;

  for (const flag of referralFlags) {
    if (flag.emergencyLevel === 'call_999')             score -= 40;
    else if (flag.emergencyLevel === 'urgent_referral') score -= 20;
    else                                                score -= 10;
  }

  if (synthesis.primaryDiagnosis) {
    score = Math.round(score * (0.5 + synthesis.primaryDiagnosis.confidence * 0.5));
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildFHIRCarePlan(
  assessmentId: string,
  patientId: string,
  treatmentPriorities: TreatmentPriority[],
  nextAssessmentDate: string,
): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    resourceType: 'CarePlan',
    id:           assessmentId,
    status:       'active',
    intent:       'plan',
    subject:      { reference: `Patient/${patientId}` },
    period:       { start: today, end: nextAssessmentDate || undefined },
    activity:     treatmentPriorities.map(tp => ({
      detail: {
        kind:   'ServiceRequest',
        code:   {
          coding: tp.cptCodes.map(code => ({
            system: 'http://www.ama-assn.org/go/cpt',
            code,
          })),
          text: tp.intervention,
        },
        status:           'not-started',
        description:      tp.rationale,
        scheduledTiming:  {
          repeat: { periodUnit: 'wk', period: tp.timeframeWeeks },
        },
      },
    })),
  };
}

function buildPartialReport(input: ConsensusInput, t0: number): ClinicalAssessmentReport {
  const adv = input.adversarialReport!;
  const referralFlags: RedFlagAlert[] = adv.safetyGapsFound.map(gap => ({
    type:           'safety_gap',
    description:    gap,
    immediateAction: 'Clinician review required before proceeding.',
    emergencyLevel: 'urgent_referral' as const,
  }));

  const completeness = computeDataCompleteness(input.allFindings);

  return {
    agentId:   'consensus-agent',
    version:   '1.0.0',
    assessmentId: input.assessmentId,
    patientId:    input.patientId,
    generatedAt:  new Date().toISOString(),

    approvedForConsensus:      false,
    adversarialVerdict:        deriveAdversarialVerdict(adv),
    adversarialOverrideApplied: true,

    overallHealthScore: 0,
    dataQuality:        'insufficient',
    dataCompleteness:   completeness,

    primaryFindings: [
      'Assessment rejected by AdversarialAgent — critical concerns detected.',
      'Manual clinician review required before treatment recommendations can be issued.',
    ],
    primaryDiagnosis:      null,
    differentialDiagnoses: [],
    treatmentPriorities:   [],
    prescribedProgram:     [],

    referralFlags,
    referralRecommended: referralFlags.length > 0,
    referralUrgency:     referralFlags.length > 0 ? 'urgent' : null,
    referralReason:      referralFlags.length > 0
      ? 'AdversarialAgent identified critical safety concerns requiring clinician review.'
      : null,

    progressionTimeline: 'Cannot be determined — assessment rejected.',
    nextAssessmentDate:  '',
    recommendedCPTCodes: [],

    fhirCarePlan:     buildFHIRCarePlan(input.assessmentId, input.patientId, [], ''),
    evidenceSummary:  [],
    clinicianSummary: 'Assessment synthesis rejected by AdversarialAgent. All findings require manual clinician review before any recommendations are issued.',
    patientSummary:   'Your assessment could not be completed automatically. A clinician will review your results and contact you shortly.',

    processingMs: Date.now() - t0,
  };
}

// ── Synthesis output type (Sonnet JSON) ────────────────────────────────────────

interface SynthesisResult {
  primaryFindings:       string[];
  primaryDiagnosis?: {
    name: string;
    icd10: string;
    confidence: number;
    evidenceGrade: EvidenceGrade;
    supportingFindings: string[];
    adversarialChallenged: boolean;
  };
  differentialDiagnoses: DiagnosticHypothesis[];
  treatmentPriorities:   TreatmentPriority[];
  prescribedProgram:     PrescribedExercise[];
  referralRecommended:   boolean;
  referralUrgency:       ClinicalAssessmentReport['referralUrgency'];
  referralReason:        string | null;
  progressionTimeline:   string;
  nextAssessmentDate:    string;
  recommendedCPTCodes:   string[];
  evidenceSummary:       EvidenceCitation[];
  clinicianSummary:      string;
  patientSummary:        string;
}

function parseSynthesisOutput(raw: string): Partial<SynthesisResult> {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw) as Partial<SynthesisResult>;
    return {
      primaryFindings:       Array.isArray(parsed.primaryFindings)       ? parsed.primaryFindings       : [],
      ...(parsed.primaryDiagnosis ? { primaryDiagnosis: parsed.primaryDiagnosis } : {}),
      differentialDiagnoses: Array.isArray(parsed.differentialDiagnoses) ? parsed.differentialDiagnoses : [],
      treatmentPriorities:   Array.isArray(parsed.treatmentPriorities)   ? parsed.treatmentPriorities   : [],
      prescribedProgram:     Array.isArray(parsed.prescribedProgram)     ? parsed.prescribedProgram     : [],
      referralRecommended:   typeof parsed.referralRecommended === 'boolean' ? parsed.referralRecommended : false,
      referralUrgency:       parsed.referralUrgency                                                      ?? null,
      referralReason:        parsed.referralReason                                                       ?? null,
      progressionTimeline:   typeof parsed.progressionTimeline === 'string' ? parsed.progressionTimeline : '',
      nextAssessmentDate:    typeof parsed.nextAssessmentDate  === 'string' ? parsed.nextAssessmentDate  : '',
      recommendedCPTCodes:   Array.isArray(parsed.recommendedCPTCodes)   ? parsed.recommendedCPTCodes   : [],
      evidenceSummary:       Array.isArray(parsed.evidenceSummary)       ? parsed.evidenceSummary       : [],
      clinicianSummary:      typeof parsed.clinicianSummary === 'string' ? parsed.clinicianSummary      : 'Synthesis unavailable.',
      patientSummary:        typeof parsed.patientSummary    === 'string' ? parsed.patientSummary        : 'Synthesis unavailable.',
    };
  } catch {
    return {
      primaryFindings:       ['Synthesis parse error — manual review required.'],
      differentialDiagnoses: [],
      treatmentPriorities:   [],
      prescribedProgram:     [],
      referralRecommended:   false,
      referralUrgency:       null,
      referralReason:        null,
      progressionTimeline:   '',
      nextAssessmentDate:    '',
      recommendedCPTCodes:   [],
      evidenceSummary:       [],
      clinicianSummary:      'Synthesis failed. Manual clinician review required.',
      patientSummary:        'Your assessment results require manual review by your clinician.',
    };
  }
}

function buildSynthesisPrompt(
  input: ConsensusInput,
  adjustments: Map<string, number>,
): string {
  const agentSummaries: Record<string, unknown> = {};

  if (input.allFindings.functional) {
    const f    = input.allFindings.functional;
    const mult = adjustments.get('functional-agent') ?? 1.0;
    agentSummaries['functional-agent'] = {
      adjustedWeight:         Math.round(BASE_WEIGHTS['functional-agent']! * mult * 100) / 100,
      overallFunctionLevel:   f.overallFunctionLevel,
      psfsAverage:            f.psfsAverage,
      psfsChangeFromBaseline: f.psfsChangeFromBaseline,
      psfsMcidMet:            f.psfsMcidMet,
      tugRiskCategory:        f.tugRiskCategory,
      goalProgressPercent:    f.goalProgressPercent,
      clinicalSummary:        f.clinicalSummary,
      evidenceGrade:          f.evidenceGrade,
    };
  }

  if (input.allFindings.rom) {
    const r    = input.allFindings.rom;
    const mult = adjustments.get('rom-agent') ?? 1.0;
    agentSummaries['rom-agent'] = {
      adjustedWeight:     Math.round(BASE_WEIGHTS['rom-agent']! * mult * 100) / 100,
      overallMobility:    r.overallMobility,
      significantDeficits: Object.values(r.joints)
        .filter(j => j.clinicallySignificant)
        .map(j => `${j.joint} ${j.movement} ${j.deficitPercent.toFixed(0)}%`),
      clinicalSummary: r.clinicalSummary,
      evidenceGrade:   r.evidenceGrade,
    };
  }

  if (input.allFindings.gait) {
    const g    = input.allFindings.gait;
    const mult = adjustments.get('gait-agent') ?? 1.0;
    agentSummaries['gait-agent'] = {
      adjustedWeight: Math.round(BASE_WEIGHTS['gait-agent']! * mult * 100) / 100,
      stepSymmetry:   g.stepSymmetry,
      trunkSway:      g.trunkSway,
      dataQuality:    g.dataQuality,
      flags:          g.flags,
      clinicalSummary: g.clinicalSummary,
      evidenceGrade:  g.evidenceGrade,
    };
  }

  if (input.allFindings.specialTests) {
    const s    = input.allFindings.specialTests;
    const mult = adjustments.get('special-tests-agent') ?? 1.0;
    agentSummaries['special-tests-agent'] = {
      adjustedWeight:  Math.round(BASE_WEIGHTS['special-tests-agent']! * mult * 100) / 100,
      joint:           s.joint,
      positiveTests:   s.positiveTests   ?? [],
      likelyDiagnoses: s.likelyDiagnoses ?? [],
      clinicalSummary: s.clinicalSummary ?? '',
      evidenceGrade:   s.evidenceGrade,
    };
  }

  if (input.allFindings.pain) {
    const p    = input.allFindings.pain;
    const mult = adjustments.get('pain-agent') ?? 1.0;
    agentSummaries['pain-agent'] = {
      adjustedWeight:  Math.round(BASE_WEIGHTS['pain-agent']! * mult * 100) / 100,
      riskLevel:       p.riskLevel,
      painTrend:       p.painTrend,
      redFlags:        p.redFlags,
      safeToExercise:  p.safeToExercise,
      icd10Codes:      p.icd10Codes,
      clinicalSummary: p.clinicalSummary,
    };
  }

  if (input.allFindings.posture) {
    const mult = adjustments.get('posture-agent') ?? 1.0;
    agentSummaries['posture-agent'] = {
      adjustedWeight: Math.round(BASE_WEIGHTS['posture-agent']! * mult * 100) / 100,
      ...input.allFindings.posture,
    };
  }

  const adversarialSummary = input.adversarialReport
    ? {
        approved:              input.adversarialReport.approvedForConsensus,
        overallConfidence:     input.adversarialReport.overallConfidence,
        critiques:             input.adversarialReport.critiques,
        safetyGapsFound:       input.adversarialReport.safetyGapsFound,
        recommendAdditional:   input.adversarialReport.recommendAdditionalAssessment,
      }
    : null;

  const ctx = {
    assessmentId:       input.assessmentId,
    patientId:          input.patientId,
    patientAge:         input.patientAge,
    patientSex:         input.patientSex,
    existingConditions: input.existingConditions,
    currentMedications: input.currentMedications,
    agentFindings:      agentSummaries,
    adversarialReport:  adversarialSummary,
    today:              new Date().toISOString().split('T')[0],
  };

  return `Synthesise the following multi-agent physiotherapy assessment into a clinical report.\n\nAssessment data:\n${JSON.stringify(ctx, null, 2)}\n\nOutput schema (return ONLY valid JSON):\n${OUTPUT_SCHEMA}`;
}

// ── ConsensusAgent ─────────────────────────────────────────────────────────────

export class ConsensusAgent {
  private readonly client: Anthropic;
  private readonly model = MODEL;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: ConsensusInput): Promise<ClinicalAssessmentReport> {
    const t0 = Date.now();
    const adversarialReport = input.adversarialReport;

    if (adversarialReport !== null && !adversarialReport.approvedForConsensus) {
      return buildPartialReport(input, t0);
    }

    const adjustments  = applyConfidenceAdjustments(adversarialReport);
    const completeness = computeDataCompleteness(input.allFindings);
    const dataQuality  = computeDataQuality(completeness, adversarialReport);
    const prompt       = buildSynthesisPrompt(input, adjustments);

    let rawText = '{}';
    try {
      const msg = await this.client.messages.create({
        model:      this.model,
        max_tokens: MAX_TOKENS,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: prompt }],
      });
      const block = msg.content[0];
      if (block?.type === 'text') rawText = block.text;
    } catch {
      // parseSynthesisOutput handles '{}' gracefully
    }

    const synthesis = parseSynthesisOutput(rawText);

    // Force low confidence when adversarial has critical concerns but still approved
    const adversarialOverrideApplied =
      adversarialReport?.critiques.some(c => c.severity === 'critical') ?? false;
    if (adversarialOverrideApplied && synthesis.primaryDiagnosis) {
      synthesis.primaryDiagnosis.confidence = Math.min(
        synthesis.primaryDiagnosis.confidence, 0.49,
      );
    }

    // Collect referral flags from adversarial safety gaps + agent reports
    const referralFlags: RedFlagAlert[] = [
      ...(adversarialReport?.safetyGapsFound.map(gap => ({
        type:            'safety_gap',
        description:     gap,
        immediateAction: 'Clinician review required.',
        emergencyLevel:  'urgent_referral' as const,
      })) ?? []),
      ...(input.allFindings.functional?.referralFlags ?? []),
      ...(input.allFindings.gait?.referralFlags       ?? []),
    ];

    const overallHealthScore = computeHealthScore(
      synthesis, referralFlags, input.allFindings.functional,
    );

    return {
      agentId:   'consensus-agent',
      version:   '1.0.0',
      assessmentId: input.assessmentId,
      patientId:    input.patientId,
      generatedAt:  new Date().toISOString(),

      approvedForConsensus:      true,
      adversarialVerdict:        deriveAdversarialVerdict(adversarialReport),
      adversarialOverrideApplied,

      overallHealthScore,
      dataQuality,
      dataCompleteness: completeness,

      primaryFindings:       synthesis.primaryFindings       ?? [],
      primaryDiagnosis:      synthesis.primaryDiagnosis      ?? null,
      differentialDiagnoses: synthesis.differentialDiagnoses ?? [],
      treatmentPriorities:   synthesis.treatmentPriorities   ?? [],
      prescribedProgram:     synthesis.prescribedProgram     ?? [],

      referralFlags,
      referralRecommended: synthesis.referralRecommended ?? referralFlags.length > 0,
      referralUrgency:     synthesis.referralUrgency     ?? null,
      referralReason:      synthesis.referralReason      ?? null,

      progressionTimeline: synthesis.progressionTimeline ?? '',
      nextAssessmentDate:  synthesis.nextAssessmentDate  ?? '',
      recommendedCPTCodes: synthesis.recommendedCPTCodes ?? [],

      fhirCarePlan: buildFHIRCarePlan(
        input.assessmentId,
        input.patientId,
        synthesis.treatmentPriorities ?? [],
        synthesis.nextAssessmentDate  ?? '',
      ),

      evidenceSummary:  synthesis.evidenceSummary  ?? [],
      clinicianSummary: synthesis.clinicianSummary ?? 'Synthesis unavailable.',
      patientSummary:   synthesis.patientSummary   ?? 'Synthesis unavailable.',

      processingMs: Date.now() - t0,
    };
  }
}

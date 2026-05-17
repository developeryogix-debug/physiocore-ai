/**
 * earlyMobAgent.ts — Phase 3 Early Mobilisation & Graded Exposure Agent
 *
 * Opposing approach to ConservativeProtocolAgent. Applies:
 *   • Fear-Avoidance Model (Vlaeyen & Linton 2000) — TSK proxy + fear belief profiling
 *   • Graded Activity (time-contingent quota, NOT pain-contingent)
 *   • Graded Exposure — 0–10 fear ladder (PHODA-SeV inspired)
 *   • Progressive loading per body region (2-for-2 progression rule)
 *   • Pain Neuroscience Education (Moseley 2003)
 *
 * TreatmentArbiterAgent (Opus) debates this output against ConservativeProtocol.
 * SaMD Class II — decision support only, never autonomous clinical action.
 *
 * Evidence anchors:
 *   Vlaeyen JWS & Linton SJ. Pain. 2000;85:317–332.
 *   Moseley GL. Manual Therapy. 2003;8(3):130–137.
 *   George SZ et al. Phys Ther. 2011;91(5):722–738.
 *   Leeuw M et al. Clin J Pain. 2007;23(5):408–417.
 *   Nicholas MK et al. Eur J Pain. 2011;15(8):783–789.
 *
 * Model: claude-sonnet-4-20250514  |  Max tokens: 2000
 * Output: EarlyMobProtocol
 */

import Anthropic from '@anthropic-ai/sdk';
import type { PlanningInput } from '../types/phase3.js';
import type { EvidenceCitation } from './conservativeAgent.js';

// ── Re-export shared primitive ────────────────────────────────────────────────

export type { EvidenceCitation };

// ── EarlyMob-specific types ───────────────────────────────────────────────────

export type FearAvoidanceCategory = 'low' | 'moderate' | 'high';
export type ExposureMethod        = 'imaginal' | 'in_vivo' | 'interoceptive';
export type LoadType              = 'bodyweight' | 'resistance_band' | 'free_weight' | 'machine' | 'functional';
export type ContingencyBasis      = 'time' | 'repetition';

/** TSK proxy derived from clinical data — not a validated direct questionnaire */
export interface FearAvoidanceProfile {
  tskScoreProxy:              number;             // 17–68 estimated; ≥37 = elevated
  fearAvoidanceCategory:      FearAvoidanceCategory; // low <37, moderate 37–44, high >44
  keyFearBeliefs:             string[];           // specific activities or movements feared
  catastrophizingIndicators:  string[];           // clinical signs of pain catastrophizing
  workRelatedFearPresent:     boolean;
  avoidanceBehaviours:        string[];           // observed avoidance patterns
  clinicalRationale:          string;             // one-sentence justification for category
  citation:                   string;             // Vlaeyen & Linton 2000
}

/**
 * One rung of the fear hierarchy — ordered low-to-high fear.
 * Inspired by PHODA-SeV (Leeuw et al. 2007).
 */
export interface FearLadderStep {
  step:                 number;      // 1 (lowest fear) → 10 (highest)
  activity:             string;      // specific, concrete, observable activity
  fearRating:           number;      // 0–10 SUDS at baseline
  exposureMethod:       ExposureMethod;
  startingDose:         string;      // e.g. "3 min, once daily"
  targetDose:           string;      // e.g. "30 min, 5×/week"
  progressionCriterion: string;      // SUDS <3/10 on 2 consecutive exposures
  regressionCriterion:  string;      // SUDS >7/10 or avoidance — drop one step
  rationale:            string;
}

/** Time-contingent quota — patient works to quota, not to pain signal */
export interface GradedActivityQuota {
  targetActivity:         string;
  baselineDose:           string;      // measured baseline from first session
  contingencyBasis:       ContingencyBasis;
  weeklyIncrementPercent: number;      // typically 10–20%
  week4Target:            string;
  week8Target:            string;
  week12Target:           string;
  reinfocementStrategy:   string;      // e.g. "verbal praise for quota adherence, not pain reports"
  citation:               string;      // Vlaeyen & Linton 2000
}

/** Region-specific loading protocol using 2-for-2 progression */
export interface LoadingProtocol {
  bodyRegion:                 string;
  phase:                      number;   // 1 = early, 2 = mid, 3 = late
  loadingPrinciple:           string;   // 1 sentence rationale
  startingLoad:               string;   // e.g. "30% 1RM, bodyweight"
  progressionRule:            string;   // e.g. "2-for-2: add 5% if 2 extra reps on 2 sessions"
  maxWeeklyIncrementPercent:  number;   // cap at 10%
  exercises: Array<{
    name:          string;
    sets:          number;
    reps:          number | null;
    holdSeconds:   number | null;
    tempo:         string;             // e.g. "3-1-2" eccentric–hold–concentric
    loadType:      LoadType;
    rpeTarget:     number;             // Borg CR10 0–10; early phase ≤5
    citation:      string;
  }>;
}

/** Measurable return-to-activity milestone — all criteria must be met */
export interface ReturnToActivityMilestone {
  milestone:    string;
  targetWeek:   number;
  criteria:     string[];   // ALL must be satisfied (measurable)
  activities:   string[];   // activities unlocked at this milestone
  riskIfRushed: string;     // one sentence clinical risk statement
}

/** PNE point — plain-language metaphor for pain reconceptualisation */
export interface PainNeurosciencePoint {
  concept:   string;   // clinical concept
  metaphor:  string;   // brief plain-language patient-facing metaphor
  citation:  string;
}

// ── EarlyMobProtocol (root output) ───────────────────────────────────────────

export interface EarlyMobProtocol {
  agentId:      'early-mob-protocol-agent';
  version:      '1.0.0';
  patientId:    string;
  assessmentId: string;
  generatedAt:  string;

  fearAvoidanceProfile:       FearAvoidanceProfile;
  fearLadder:                 FearLadderStep[];          // 4–8 steps, low→high
  gradedActivityQuotas:       GradedActivityQuota[];     // 1–3 target activities
  loadingProtocols:           LoadingProtocol[];         // per body region
  returnToActivityMilestones: ReturnToActivityMilestone[]; // 3–5 milestones
  painNeuroscienceEducation:  PainNeurosciencePoint[];   // 4–6 PNE concepts

  homeExerciseProgram: Array<{
    name:            string;
    frequencyPerDay: number;
    sets:            number;
    reps:            number | null;
    holdSeconds:     number | null;
    instructions:    string;   // plain English
    rationale:       string;
    quotaBased:      boolean;  // true = time-contingent, false = reps-contingent
  }>;

  patientEducation:             string[];   // 3–6 education points
  clinicianNotes:               string;
  contraindicationsToEarlyMob: string[];   // conditions where this plan is unsafe

  expectedTimeline: {
    pneWeeks:              number;   // pain neuroscience education
    gradedExposureWeeks:   number;   // fear ladder work
    progressiveLoadWeeks:  number;   // quota-based loading
    returnToActivityWeeks: number;   // full reintegration
    totalWeeks:            number;
  };

  evidenceCitations: EvidenceCitation[];
  redFlags:          string[];   // stop + refer immediately if ANY present
  processingMs:      number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL      = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2000;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You are a senior physiotherapist specialising in pain psychology, graded exposure, and early mobilisation.

Clinical philosophy and rules:
1. Fear-Avoidance Model: avoidance behaviour driven by pain catastrophizing perpetuates disability (Vlaeyen & Linton, Pain 2000).
2. TSK proxy: estimate Tampa Scale of Kinesiophobia from clinical context. ≥37 = clinically elevated fear.
3. Graded Exposure: hierarchical exposure to feared activities, starting with lowest SUDS. Progression: SUDS <3/10 on 2 consecutive sessions.
4. Graded Activity: ALWAYS time-contingent (quota-based), NEVER pain-contingent. Reinforce quota adherence, NOT pain reports.
5. Pain Neuroscience Education (PNE): reconceptualise pain as a protective output, not tissue damage signal (Moseley 2003).
6. Loading: 2-for-2 rule — increase load only when patient completes 2 extra reps on 2 consecutive sessions.
7. Maximum weekly load increment: 10% of current load.
8. RPE targets: Phase 1 ≤5/10, Phase 2 ≤7/10, Phase 3 ≤8/10 (Borg CR10).
9. Contraindications to early mob: acute fracture, active infection, uncontrolled systemic disease, cauda equina.
10. SaMD Class II: never state diagnosis as certain. Output ONLY valid JSON. No preamble.`;

// ── JSON schema (embedded in prompt) ─────────────────────────────────────────

const SCHEMA = `{
  "fearAvoidanceProfile": {
    "tskScoreProxy": 42,
    "fearAvoidanceCategory": "low|moderate|high",
    "keyFearBeliefs": ["string"],
    "catastrophizingIndicators": ["string"],
    "workRelatedFearPresent": false,
    "avoidanceBehaviours": ["string"],
    "clinicalRationale": "one sentence",
    "citation": "Vlaeyen JWS & Linton SJ. Pain. 2000;85:317–332."
  },
  "fearLadder": [
    {
      "step": 1,
      "activity": "string — specific activity",
      "fearRating": 2,
      "exposureMethod": "in_vivo|imaginal|interoceptive",
      "startingDose": "string",
      "targetDose": "string",
      "progressionCriterion": "SUDS <3/10 on 2 consecutive sessions",
      "regressionCriterion": "SUDS >7/10 or avoidance — drop one step",
      "rationale": "string"
    }
  ],
  "gradedActivityQuotas": [
    {
      "targetActivity": "string",
      "baselineDose": "string — measured from first session",
      "contingencyBasis": "time|repetition",
      "weeklyIncrementPercent": 15,
      "week4Target": "string",
      "week8Target": "string",
      "week12Target": "string",
      "reinfocementStrategy": "string",
      "citation": "Vlaeyen JWS & Linton SJ. Pain. 2000;85:317–332."
    }
  ],
  "loadingProtocols": [
    {
      "bodyRegion": "string",
      "phase": 1,
      "loadingPrinciple": "string — one sentence",
      "startingLoad": "string",
      "progressionRule": "2-for-2: add 5–10% if 2 extra reps on 2 sessions",
      "maxWeeklyIncrementPercent": 10,
      "exercises": [
        {
          "name": "string",
          "sets": 3,
          "reps": 12,
          "holdSeconds": null,
          "tempo": "3-1-2",
          "loadType": "bodyweight|resistance_band|free_weight|machine|functional",
          "rpeTarget": 5,
          "citation": "string"
        }
      ]
    }
  ],
  "returnToActivityMilestones": [
    {
      "milestone": "string",
      "targetWeek": 4,
      "criteria": ["string — measurable criterion"],
      "activities": ["string — activities unlocked"],
      "riskIfRushed": "string — one sentence risk"
    }
  ],
  "painNeuroscienceEducation": [
    {
      "concept": "string — clinical concept",
      "metaphor": "string — plain-language patient-facing metaphor",
      "citation": "Moseley GL. Manual Therapy. 2003;8(3):130–137."
    }
  ],
  "homeExerciseProgram": [
    {
      "name": "string",
      "frequencyPerDay": 2,
      "sets": 2,
      "reps": 10,
      "holdSeconds": null,
      "instructions": "plain English",
      "rationale": "string",
      "quotaBased": true
    }
  ],
  "patientEducation": ["string × 3–6 points"],
  "clinicianNotes": "string",
  "contraindicationsToEarlyMob": ["string"],
  "expectedTimeline": {
    "pneWeeks": 2,
    "gradedExposureWeeks": 4,
    "progressiveLoadWeeks": 4,
    "returnToActivityWeeks": 2,
    "totalWeeks": 12
  },
  "evidenceCitations": [
    { "claim": "string", "citation": "Author. Journal. Year.", "year": 2000, "evidenceGrade": "A" }
  ],
  "redFlags": ["string"]
}`;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(input: PlanningInput): string {
  const { consensusReport, userProfile } = input;

  const dx = consensusReport.primaryDiagnosis
    ? `${consensusReport.primaryDiagnosis.name} (${consensusReport.primaryDiagnosis.icd10}), confidence ${(consensusReport.primaryDiagnosis.confidence * 100).toFixed(0)}%`
    : 'Primary diagnosis not established';

  const findings   = consensusReport.primaryFindings.slice(0, 5).join('; ');
  const injuries   = userProfile.activeInjuries.map(i => `${i.bodyPart} ${i.type} sev${i.severity}/5`).join(', ') || 'none';
  const conditions = userProfile.conditions.map(c => c.name).join(', ') || 'none';
  const meds       = userProfile.medications.map(m => m.name).join(', ') || 'none';
  const pain       = input.currentPainLevel ?? 'unknown';
  const psfs       = input.psfsAverage ?? 'not assessed';

  return `PATIENT:
Age: ${userProfile.ageYears}y, Sex: ${userProfile.sex}
Active injuries: ${injuries}
Conditions: ${conditions}
Medications: ${meds}
Current NPRS pain: ${pain}/10
PSFS average: ${psfs}/10
PHQ-4 score: ${input.phq4Score ?? 'not assessed'}/12

ASSESSMENT FINDINGS:
Primary diagnosis: ${dx}
Differentials: ${consensusReport.differentialDiagnoses.map(d => `${d.name} (${d.probability})`).join(', ') || 'none'}
Key findings: ${findings}
Referral: ${consensusReport.referralRecommended ? `YES — ${consensusReport.referralUrgency}` : 'no'}
Data quality: ${consensusReport.dataQuality}

CLINICAL TASK:
1. Estimate Fear-Avoidance profile (TSK proxy) from available clinical data.
2. Build a 4–8 step fear ladder, lowest SUDS first, concrete specific activities.
3. Prescribe 1–3 time-contingent graded activity quotas for main functional targets.
4. Design region-specific loading protocols (2-for-2 rule, RPE-guided phases).
5. Set 3–5 return-to-activity milestones with measurable criteria (ALL must be met).
6. Write 4–6 Pain Neuroscience Education points with plain-language metaphors.
7. Cite: Vlaeyen & Linton 2000, Moseley 2003, George 2011, Leeuw 2007.
8. Flag all contraindications to early mobilisation explicitly.

Output ONLY valid JSON matching this schema:
${SCHEMA}`;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseProtocol(raw: string, input: PlanningInput, ms: number): EarlyMobProtocol {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('EarlyMobProtocolAgent: no JSON in response');

  const p = JSON.parse(match[0]) as Partial<EarlyMobProtocol>;

  const defaultCitations: EvidenceCitation[] = [
    { claim: 'Fear-avoidance behaviour drives chronic pain disability via catastrophizing cycle.',
      citation: 'Vlaeyen JWS & Linton SJ. Pain. 2000;85(3):317–332.', year: 2000, evidenceGrade: 'A' },
    { claim: 'Pain reconceptualisation via PNE reduces fear-avoidance and improves function.',
      citation: 'Moseley GL. Manual Therapy. 2003;8(3):130–137.', year: 2003, evidenceGrade: 'B' },
    { claim: 'Graded exposure outperforms graded activity for fear-avoidant chronic LBP.',
      citation: 'George SZ et al. Phys Ther. 2011;91(5):722–738.', year: 2011, evidenceGrade: 'A' },
    { claim: 'PHODA hierarchy guides clinician selection of exposure stimuli.',
      citation: 'Leeuw M et al. Clin J Pain. 2007;23(5):408–417.', year: 2007, evidenceGrade: 'B' },
  ];

  return {
    agentId:      'early-mob-protocol-agent',
    version:      '1.0.0',
    patientId:    input.patientId,
    assessmentId: input.assessmentId,
    generatedAt:  new Date().toISOString(),

    fearAvoidanceProfile: p.fearAvoidanceProfile ?? {
      tskScoreProxy: 37, fearAvoidanceCategory: 'moderate',
      keyFearBeliefs: ['movement may cause re-injury'],
      catastrophizingIndicators: ['guarding', 'excessive rest'],
      workRelatedFearPresent: false,
      avoidanceBehaviours: ['activity restriction', 'passive rest'],
      clinicalRationale: 'Moderate fear-avoidance inferred from pain behaviour and avoidance pattern.',
      citation: 'Vlaeyen JWS & Linton SJ. Pain. 2000;85(3):317–332.',
    },
    fearLadder:                 p.fearLadder                 ?? [],
    gradedActivityQuotas:       p.gradedActivityQuotas       ?? [],
    loadingProtocols:           p.loadingProtocols           ?? [],
    returnToActivityMilestones: p.returnToActivityMilestones ?? [],
    painNeuroscienceEducation:  p.painNeuroscienceEducation  ?? [],
    homeExerciseProgram:        p.homeExerciseProgram        ?? [],

    patientEducation: p.patientEducation ?? [
      'Pain does not equal damage — movement is medicine when dosed correctly.',
      'Working to your time quota protects you better than stopping at first pain.',
      'Report SUDS scores honestly — we use them to keep exposure safe.',
    ],
    clinicianNotes: p.clinicianNotes ?? 'Review fear ladder SUDS ratings weekly. Reassess TSK at 4 and 8 weeks.',
    contraindicationsToEarlyMob: (p.contraindicationsToEarlyMob ?? []).length > 0
      ? p.contraindicationsToEarlyMob!
      : ['Acute fracture or dislocation', 'Active systemic infection', 'Cauda equina syndrome', 'Uncontrolled cardiac disease'],

    expectedTimeline: p.expectedTimeline ?? {
      pneWeeks: 2, gradedExposureWeeks: 4, progressiveLoadWeeks: 4, returnToActivityWeeks: 2, totalWeeks: 12,
    },

    evidenceCitations: (p.evidenceCitations ?? []).length > 0 ? p.evidenceCitations! : defaultCitations,
    redFlags: (p.redFlags ?? []).length > 0
      ? p.redFlags!
      : [
          'New or worsening neurological deficit (drop foot, hand weakness)',
          'Cauda equina symptoms (bladder/bowel dysfunction, saddle anaesthesia)',
          'Fever + MSK pain — possible infectious aetiology',
          'SUDS consistently ≥9/10 — psychological crisis threshold, refer psychology',
          'PHQ-4 ≥6 — refer for mental health assessment before proceeding',
        ],
    processingMs: ms,
  };
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export class EarlyMobProtocolAgent {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: PlanningInput): Promise<EarlyMobProtocol> {
    const t0 = Date.now();

    const msg = await this.client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: buildPrompt(input) }],
    });

    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    return parseProtocol(raw, input, Date.now() - t0);
  }
}

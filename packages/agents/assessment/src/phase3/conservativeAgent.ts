/**
 * conservativeAgent.ts — Phase 3 Conservative Physiotherapy Protocol Agent
 *
 * Applies McKenzie Mechanical Diagnosis & Therapy (MDT) classification,
 * Maitland manual therapy grading, and evidence-based activity modification.
 *
 * SaMD Class II — all output is decision support only, never autonomous clinical action.
 * Evidence anchors:
 *   McKenzie RA. The Lumbar Spine: Mechanical Diagnosis and Therapy. Spinal Publications, 1981.
 *   Maitland GD. Vertebral Manipulation. 7th ed. Butterworth-Heinemann, 2005.
 *   Clare HA et al. Cochrane Database Syst Rev. 2004.
 *   Konstantinou K & Dunn KM. Spine (Phila Pa 1976). 2008.
 *
 * Model: claude-sonnet-4-20250514
 * Max tokens: 2000
 * Output: ConservativeProtocol
 */

import Anthropic from '@anthropic-ai/sdk';
import type { PlanningInput } from '../types/phase3.js';

// ── Output types ──────────────────────────────────────────────────────────────

export type MaitlandGrade = 'I' | 'II' | 'III' | 'IV' | 'V';
export type McKenzieSyndrome = 'postural' | 'dysfunction' | 'derangement' | 'other';
export type MovementDirection = 'flexion' | 'extension' | 'lateral_left' | 'lateral_right' | 'rotation' | 'combined';
export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';
export type ActivityModType = 'avoid' | 'reduce' | 'modify';

export interface McKenzieClassification {
  syndrome:                   McKenzieSyndrome;
  preferredMovementDirection: MovementDirection | null;
  centralisationPresent:      boolean;
  derangementLevel:           number | null;  // 1–7 for derangement syndrome; null otherwise
  clinicalRationale:          string;         // one sentence explaining classification
}

export interface McKenzieExercise {
  name:                string;   // e.g. "Prone press-up extension"
  movementDirection:   MovementDirection;
  sets:                number;
  reps:                number;
  holdSeconds:         number | null;
  frequencyPerDay:     number;
  progressionCriteria: string;   // measurable — e.g. "centralisation of distal symptoms"
  regressionCriteria:  string;   // measurable — e.g. "peripheralisation or pain >5/10"
  rationale:           string;
  citation:            string;   // McKenzie 1981 or clinical derivative
}

export interface ManualTherapyTechnique {
  name:              string;   // e.g. "PA central vertebral pressure L3–L4"
  maitlandGrade:     MaitlandGrade;
  targetStructure:   string;   // joint, segment, or soft tissue
  indication:        string;
  absoluteContra:    string[];
  relativeContra:    string[];
  dosePerSession:    string;   // e.g. "3 × 30 sec oscillations"
  sessionsPerWeek:   number;
  totalSessions:     number;
  citation:          string;   // Maitland 2005 or derived source
}

export interface ActivityModification {
  activity:          string;
  modification:      ActivityModType;
  rationale:         string;
  durationWeeks:     number;
  returnCriterion:   string;   // measurable condition to safely resume
  patientInstruction: string;  // plain-language instruction
}

export interface RestProtocol {
  acuteRestDays:        number;
  relativeRestDays:     number;    // after acute phase — reduced activity, not bed rest
  icingInstruction:     string;    // e.g. "10 min on, 10 off × 3 per session"
  postureCorrections:   string[];
  sleepPosition:        string;
  avoidPositions:       string[];
}

export interface EvidenceCitation {
  claim:         string;
  citation:      string;          // full APA-style author. journal. year.
  year:          number;
  evidenceGrade: EvidenceGrade;
}

export interface ConservativeProtocol {
  agentId:     'conservative-protocol-agent';
  version:     '1.0.0';
  patientId:   string;
  assessmentId: string;
  generatedAt: string;

  mckenzieClassification: McKenzieClassification;
  mckenzieExercises:      McKenzieExercise[];
  manualTherapy:          ManualTherapyTechnique[];
  activityModifications:  ActivityModification[];
  restProtocol:           RestProtocol;

  homeExerciseProgram: Array<{
    name:            string;
    frequencyPerDay: number;
    sets:            number;
    reps:            number | null;
    holdSeconds:     number | null;
    instructions:    string;
    rationale:       string;
  }>;

  patientEducation: string[];      // 3–6 plain-language education points
  clinicianNotes:   string;        // clinical caveats, red-line conditions, review schedule

  expectedTimeline: {
    acuteWeeks:            number;  // tissue protection phase
    subacuteWeeks:         number;  // controlled mobility phase
    rehabilitationWeeks:   number;  // strengthening and function phase
    totalWeeks:            number;
  };

  evidenceCitations: EvidenceCitation[];
  redFlags:          string[];      // must stop and refer if ANY present
  processingMs:      number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL      = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2000;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You are a senior physiotherapist specialising in McKenzie Mechanical Diagnosis & Therapy (MDT) and Maitland manual therapy.

Clinical rules:
1. McKenzie classification: Postural (pain with sustained postures), Dysfunction (pain at end-range only, no centralisation), Derangement (directional preference, possible centralisation).
2. Centralisation > peripheralisation: always direct MDT exercises toward centralisation.
3. Maitland grades: I–II for pain-dominant; III–IV for stiffness-dominant. Grade V only if clinician-performed.
4. Activity modification: "avoid" for structurally harmful; "reduce" for load management; "modify" for adapted participation.
5. Bed rest: NO prolonged bed rest. Maximum 2 days acute; thereafter encourage controlled movement (Waddell G. 1987 BJMP).
6. McKenzie citation: McKenzie RA. Spinal Publications. 1981.
7. Maitland citation: Maitland GD. 7th ed. Butterworth-Heinemann. 2005.
8. SaMD Class II: never state a diagnosis as certain. Use "consistent with", "suggestive of".
9. Output ONLY valid JSON matching the schema provided. No preamble or markdown.`;

// ── Output schema (embedded in prompt) ───────────────────────────────────────

const SCHEMA = `{
  "mckenzieClassification": {
    "syndrome": "postural|dysfunction|derangement|other",
    "preferredMovementDirection": "flexion|extension|lateral_left|lateral_right|rotation|combined|null",
    "centralisationPresent": false,
    "derangementLevel": null,
    "clinicalRationale": "one sentence"
  },
  "mckenzieExercises": [
    {
      "name": "string",
      "movementDirection": "extension",
      "sets": 3,
      "reps": 10,
      "holdSeconds": null,
      "frequencyPerDay": 3,
      "progressionCriteria": "string — measurable",
      "regressionCriteria": "string — measurable",
      "rationale": "string",
      "citation": "McKenzie RA. Spinal Publications. 1981."
    }
  ],
  "manualTherapy": [
    {
      "name": "string",
      "maitlandGrade": "III",
      "targetStructure": "string",
      "indication": "string",
      "absoluteContra": ["string"],
      "relativeContra": ["string"],
      "dosePerSession": "string",
      "sessionsPerWeek": 2,
      "totalSessions": 6,
      "citation": "Maitland GD. 7th ed. Butterworth-Heinemann. 2005."
    }
  ],
  "activityModifications": [
    {
      "activity": "string",
      "modification": "avoid|reduce|modify",
      "rationale": "string",
      "durationWeeks": 2,
      "returnCriterion": "string — measurable",
      "patientInstruction": "plain English"
    }
  ],
  "restProtocol": {
    "acuteRestDays": 2,
    "relativeRestDays": 5,
    "icingInstruction": "string",
    "postureCorrections": ["string"],
    "sleepPosition": "string",
    "avoidPositions": ["string"]
  },
  "homeExerciseProgram": [
    {
      "name": "string",
      "frequencyPerDay": 2,
      "sets": 2,
      "reps": 10,
      "holdSeconds": null,
      "instructions": "plain English",
      "rationale": "string"
    }
  ],
  "patientEducation": ["string × 3–6 points"],
  "clinicianNotes": "string",
  "expectedTimeline": {
    "acuteWeeks": 2,
    "subacuteWeeks": 4,
    "rehabilitationWeeks": 6,
    "totalWeeks": 12
  },
  "evidenceCitations": [
    { "claim": "string", "citation": "Author. Journal/Book. Year.", "year": 2005, "evidenceGrade": "A" }
  ],
  "redFlags": ["string"]
}`;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(input: PlanningInput): string {
  const { consensusReport, userProfile } = input;

  const dx = consensusReport.primaryDiagnosis
    ? `${consensusReport.primaryDiagnosis.name} (${consensusReport.primaryDiagnosis.icd10}), confidence ${(consensusReport.primaryDiagnosis.confidence * 100).toFixed(0)}%`
    : 'Primary diagnosis not established';

  const differentials = consensusReport.differentialDiagnoses
    .map(d => `${d.name} (${d.probability})`)
    .join(', ') || 'none';

  const injuries = userProfile.activeInjuries
    .map(i => `${i.bodyPart} ${i.type} sev ${i.severity}/5`)
    .join(', ') || 'none reported';

  const conditions = userProfile.conditions.map(c => c.name).join(', ') || 'none';
  const meds       = userProfile.medications.map(m => m.name).join(', ') || 'none';

  return `PATIENT:
Age: ${userProfile.ageYears}y, Sex: ${userProfile.sex}
Active injuries: ${injuries}
Conditions: ${conditions}
Medications: ${meds}
Current NPRS pain: ${input.currentPainLevel ?? 'unknown'}/10
PSFS average: ${input.psfsAverage ?? 'not assessed'}/10

ASSESSMENT FINDINGS:
Primary diagnosis: ${dx}
Differentials: ${differentials}
Referral recommended: ${consensusReport.referralRecommended ? `YES — ${consensusReport.referralUrgency}` : 'no'}
Primary findings: ${consensusReport.primaryFindings.slice(0, 5).join('; ')}

CLINICAL TASK:
1. Classify using McKenzie MDT syndrome taxonomy.
2. Select 2–4 directional MDT exercises matching preferred movement direction.
3. Recommend 1–3 Maitland manual therapy techniques appropriate to pain/stiffness level.
4. Prescribe activity modifications (avoid/reduce/modify) for aggravating activities.
5. Define rest protocol — no prolonged bed rest per Waddell 1987.
6. Write 4–6 home exercises.
7. Cite McKenzie 1981 and Maitland 2005 as primary sources. Add secondary citations as needed.

MANDATORY: Output ONLY valid JSON matching this schema (no extra keys, no preamble):
${SCHEMA}`;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseProtocol(raw: string, input: PlanningInput, ms: number): ConservativeProtocol {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('ConservativeProtocolAgent: no JSON in response');

  const p = JSON.parse(match[0]) as Partial<ConservativeProtocol>;

  return {
    agentId:     'conservative-protocol-agent',
    version:     '1.0.0',
    patientId:   input.patientId,
    assessmentId: input.assessmentId,
    generatedAt: new Date().toISOString(),

    mckenzieClassification: p.mckenzieClassification ?? {
      syndrome: 'other',
      preferredMovementDirection: null,
      centralisationPresent: false,
      derangementLevel: null,
      clinicalRationale: 'Insufficient data to classify — defaulted to other.',
    },
    mckenzieExercises:     p.mckenzieExercises     ?? [],
    manualTherapy:         p.manualTherapy         ?? [],
    activityModifications: p.activityModifications ?? [],
    restProtocol: p.restProtocol ?? {
      acuteRestDays:      2,
      relativeRestDays:   5,
      icingInstruction:   '10 min ice on, 10 min off — 3×/day for first 48 hours.',
      postureCorrections: ['Maintain neutral lumbar lordosis when seated.'],
      sleepPosition:      'Side-lying with pillow between knees.',
      avoidPositions:     ['Sustained end-range flexion', 'Prolonged sitting >30 min'],
    },
    homeExerciseProgram: p.homeExerciseProgram ?? [],
    patientEducation:    p.patientEducation    ?? [
      'Pain is not always a sign of tissue damage — movement is medicine.',
      'Report any new neurological symptoms (numbness, tingling, weakness) immediately.',
    ],
    clinicianNotes: p.clinicianNotes ?? 'Review in 2 weeks. Reassess McKenzie classification at each session.',
    expectedTimeline: p.expectedTimeline ?? {
      acuteWeeks: 2, subacuteWeeks: 4, rehabilitationWeeks: 6, totalWeeks: 12,
    },
    evidenceCitations: (p.evidenceCitations ?? []).length > 0
      ? p.evidenceCitations!
      : [
          { claim: 'McKenzie MDT classification guides directional exercise prescription.',
            citation: 'McKenzie RA. The Lumbar Spine: Mechanical Diagnosis and Therapy. Spinal Publications. 1981.',
            year: 1981, evidenceGrade: 'B' },
          { claim: 'Maitland graded oscillations reduce joint stiffness and pain via neurophysiological mechanisms.',
            citation: 'Maitland GD. Vertebral Manipulation. 7th ed. Butterworth-Heinemann. 2005.',
            year: 2005, evidenceGrade: 'B' },
        ],
    redFlags: (p.redFlags ?? []).length > 0
      ? p.redFlags!
      : [
          'Cauda equina symptoms (bladder/bowel dysfunction, saddle anaesthesia)',
          'Progressive neurological deficit',
          'Fever + back pain (possible discitis/osteomyelitis)',
          'Unexplained weight loss',
          'Pain unrelieved by any position or movement',
        ],
    processingMs: ms,
  };
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export class ConservativeProtocolAgent {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: PlanningInput): Promise<ConservativeProtocol> {
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

// ─── PostureReport (minimal schema for adversarial review) ──────────────────

export interface PostureReport {
  agentId: 'posture-agent';
  version: '1.0.0';
  patientId: string;
  generatedAt: string;
  headForwardPostureCm: number;
  thoracicKyphosisDeg: number;
  lumbarLordosisDeg: number;
  pelvicTiltDeg: number;
  shoulderHeightDiffCm: number;
  pelvisObliquityDeg: number;
  spinalDeviationDeg: number;
  kneeValgusRightDeg: number;
  kneeValgusLeftDeg: number;
  flags: string[];
  clinicalSummary: string;
  evidenceGrade: EvidenceGrade;
  processingMs: number;
}

// ─── AdversarialAgent I/O ────────────────────────────────────────────────────

export interface AdversarialInput {
  postureReport?:      PostureReport;
  gaitReport?:         GaitReport;
  romReport?:          ROMReport;
  painMapOutput?:      PainMapOutput;
  functionalReport?:   FunctionalReport;
  specialTestsReport?: SpecialTestsReport;
  userProfile:         SlimUserProfile;
}

export interface Critique {
  targetAgent:     string;              // e.g. 'gait-agent', 'rom-agent'
  finding:         string;             // specific flaw found
  severity:        'minor' | 'moderate' | 'critical';
  recommendation:  string;             // what should have been done / flagged
}

export interface AdversarialReport {
  agentId:                       'adversarial-agent';
  version:                       '1.0.0';
  patientId:                     string;
  generatedAt:                   string;
  critiques:                     Critique[];
  overallConfidence:             'high' | 'medium' | 'low';
  safetyGapsFound:               string[];
  recommendAdditionalAssessment: string[];
  approvedForConsensus:          boolean;   // false if any critique.severity === 'critical'
  processingMs:                  number;
}

// Slim profile sent to adversarial — no PII beyond clinically relevant fields
export interface SlimUserProfile {
  ageYears:       number;
  sex:            'male' | 'female' | 'other';
  primaryGoal:    string;
  activeInjuries: Array<{ bodyPart: string; type: string; severity: number }>;
  conditions:     Array<{ name: string; icdCode?: string }>;
  medications:    Array<{ name: string }>;
}

// PainMapOutput alias for adversarial consumption (matches painMapAgent.ts PainMapReport)
export type PainMapOutput = {
  riskLevel:              'green' | 'moderate' | 'high' | 'red_flag';
  painTrend:              string;
  redFlags:               string[];
  clinicalSummary:        string;
  differentialHypotheses: string[];
  safeToExercise:         boolean;
  icd10Codes:             string[];
};

// ─── SpecialTestsAgent I/O ────────────────────────────────────────────────────

/**
 * A single orthopaedic special test result as recorded by the clinician.
 * testId = test name used as a stable key (e.g. 'Lachman Test').
 */
export interface CompletedTest {
  testId:  string;
  result:  'positive' | 'negative' | 'unclear';
  notes?:  string;
}

/**
 * An orthopaedic special test selected by SpecialTestsAgent.selectTests().
 * Includes voice guide for SpeechSynthesis and pre-computed likelihood ratios.
 */
export interface SelectedSpecialTest {
  testId:          string;
  testName:        string;
  joint:           string;
  targetPathology: string;   // derived from procedure "= positive for X"
  sensitivity:     number;   // 0–1
  specificity:     number;   // 0–1
  positiveLR:      number;   // sensitivity / (1 - specificity)
  negativeLR:      number;   // (1 - sensitivity) / specificity
  voiceGuide:      string;   // SpeechSynthesis-ready instruction string
  procedureText:   string;   // original clinical procedure description
  citation:        string;
  needsReview?:    true;
  priority:        'high' | 'medium' | 'low';  // positiveLR ≥5 high, ≥2 medium, <2 low
}

/** A probable diagnosis produced by Phase B interpretation. */
export interface LikelyDiagnosis {
  name:                string;
  icd10:               string;
  probability:         'high' | 'moderate' | 'low';
  postTestProbability: number;    // 0–1 Bayesian posterior
  supportingTests:     string[];  // positive test names that support this
  opposingTests:       string[];  // negative tests that argue against this
}

/**
 * Full output of SpecialTestsAgent.
 * phase 'selection'     — only selectedTests populated (Phase A complete).
 * phase 'interpretation' — all fields populated after Phase B.
 */
export interface SpecialTestsReport {
  agentId:  'special-tests-agent';
  version:  '1.0.0';
  joint:    string;
  phase:    'selection' | 'interpretation';

  // ── Phase A ──────────────────────────────────────────────────────────────
  selectedTests: SelectedSpecialTest[];

  // ── Phase B (undefined until interpretResults() called) ──────────────────
  findings?:            string[];         // key clinical findings in plain language
  positiveTests?:       string[];         // names of positive tests
  likelyDiagnoses?:     LikelyDiagnosis[];
  referralRecommended?: boolean;
  referralReason?:      string | null;
  clinicalSummary?:     string;           // Claude Sonnet, 3 sentences

  evidenceGrade: EvidenceGrade;
  processingMs:  number;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

// ── ROM Agent types ──────────────────────────────────────────────────────────

export interface SessionSummary {
  date: string;
  exercise: string;
  reps: number;
  avg_score: number;    // 0–100 form score (proxy for ROM quality)
  top_deviation: string;
  ai_feedback_summary: string;
  pain_before?: number;
  pain_after?: number;
}

export interface JointROM {
  joint: string;
  movement: string;
  normalMax: number;                // degrees, from jointDatabase
  movementQualityPercent: number;   // 0–100% form-quality proxy (was estimatedROMPercent)
  deficitPercent: number;           // 100 - movementQualityPercent
  clinicallySignificant: boolean;   // deficit >20%
  sessionCount: number;
  lastMeasuredAt: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
  dataSource: 'session_score_proxy';
  assessmentType: 'exercise_quality_proxy';
}

export interface Asymmetry {
  joint: string;
  movement: string;
  leftScoreAvg: number;
  rightScoreAvg: number;
  asymmetryPercent: number;   // |left - right| / max(left,right) × 100
  dominantSide: 'left' | 'right';
  clinicallySignificant: boolean; // >10%
}

export interface Trend {
  joint: string;
  movement: string;
  exercise: string;
  direction: 'improving' | 'declining' | 'stable';
  slopePerSession: number;    // avg score change per session
  sessionsAnalysed: number;
}

export interface ROMReport {
  agentId: 'rom-agent';
  version: '1.0.0';
  patientId: string;
  generatedAt: string;

  joints: Record<string, JointROM>;
  overallMobility: number;      // 0–100 weighted average
  asymmetries: Asymmetry[];
  trends: Trend[];

  clinicalSummary: string;      // Claude Haiku generated
  dataCompleteness: number;     // 0–1 fraction of expected joints with data
  sessionsAnalysed: number;

  evidenceGrade: EvidenceGrade;
  citation: string;
  processingMs: number;
}



export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface RedFlagAlert {
  type: string;
  description: string;
  immediateAction: string;
  emergencyLevel: 'monitor' | 'urgent_referral' | 'call_999';
}

// ─── MediaPipe normalised landmark (mirrors PostureAssessment type) ─────────

export interface NormalizedLandmark {
  x: number;           // 0–1, horizontal (0 = left of camera frame)
  y: number;           // 0–1, vertical   (0 = top of frame)
  z: number;           // depth (relative)
  visibility?: number; // 0–1 confidence
}

// ─── GaitAgent I/O ──────────────────────────────────────────────────────────

export interface FrameData {
  frameIndex: number;
  timestampMs: number;
  landmarks: NormalizedLandmark[];  // 33 MediaPipe pose landmarks
}

/**
 * Simplified report matching the public GaitAgent.analyseWalk() contract.
 * Maps to the fuller GaitFindings for PHASE2_ASSESSMENT_SWARM orchestration.
 * Citation: Krebs DE et al. Reliability of observational kinematic gait analysis.
 *           Phys Ther. 1985;65(7):1027-1033. Evidence Grade B.
 */
export interface GaitReport {
  agentId: 'gait-agent';
  version: '1.0.0';

  // ── Primary metrics ──────────────────────────────────────────────────────
  stepSymmetry:    number;   // 0–100 (100 = perfect left/right symmetry)
  cadence:         number;   // steps per minute
  trunkSway:       'normal' | 'mild' | 'moderate' | 'severe';
  armSwing:        'symmetrical' | 'reduced_right' | 'reduced_left' | 'absent';

  // ── Extended gait findings ───────────────────────────────────────────────
  heelStrikePattern:   'normal' | 'flat_foot' | 'toe_strike' | 'antalgic';
  trendelenburgSign:   'absent' | 'positive_left' | 'positive_right';
  antalgicPattern:     boolean;
  antalgicSide:        'left' | 'right' | null;

  // ── Computed intermediates (for ConsensusAgent weighting) ────────────────
  stepLengthSymmetryPercent: number;   // mirror of stepSymmetry, explicit name
  trunkSwayAmplitudeNorm:   number;    // normalised x-deviation of hip midpoint (0–1)
  leftArmAmplitude:          number;   // normalised wrist x-range (0–1)
  rightArmAmplitude:         number;

  // ── Quality & confidence ─────────────────────────────────────────────────
  framesAnalysed: number;
  dataQuality:    'good' | 'acceptable' | 'poor' | 'insufficient';
  confidence:     number;              // 0–1, mean landmark visibility across frames

  // ── Clinical interpretation (Claude Sonnet) ──────────────────────────────
  flags:           string[];           // e.g. ["Possible Trendelenburg right"]
  gaitDeviations:  GaitDeviation[];
  referralFlags:   RedFlagAlert[];
  clinicalSummary: string;            // 2–3 sentence narrative

  // ── Evidence provenance ──────────────────────────────────────────────────
  evidenceGrade:  EvidenceGrade;      // always 'B' for observational gait analysis
  citation:       string;             // Krebs DE et al. Phys Ther. 1985

  processingMs: number;
}

export interface GaitDeviation {
  name:        string;
  phase:       'stance' | 'swing' | 'double_support' | 'overall';
  severity:    'mild' | 'moderate' | 'severe';
  likelyCause: string;
}

// ── Intermediate metrics (internal to GaitAgent) ─────────────────────────────

export interface GaitMetrics {
  cadenceStepsPerMin:       number;
  stepTimesMs: {
    left:  number[];
    right: number[];
  };
  stepSymmetryPercent:      number;
  trunkSwayAmplitudeNorm:   number;
  leftArmAmplitudeNorm:     number;
  rightArmAmplitudeNorm:    number;
  hipDropMetric: {
    leftDrop:  number;   // max normalised hip drop during right swing
    rightDrop: number;   // max normalised hip drop during left swing
  };
  meanLandmarkVisibility: number;
  usableFrameCount:       number;
}

// ── FunctionalAgent I/O ──────────────────────────────────────────────────────

export interface FunctionalAgentInput {
  patientId: string;
  psfsActivities: Array<{ activity: string; baseline: number; current: number }>;
  tugSeconds: number | null;
  thirtySecChairStandCount: number | null;
  grocScore: number | null;       // -7 to +7
  sessionCount: number;
  adherencePercent: number;
  ageYears?: number;              // for 30s chair stand normative comparison
  sex?: 'male' | 'female';       // for 30s chair stand normative comparison
}

export interface FunctionalReport {
  agentId: 'functional-agent';
  version: '1.0.0';
  patientId: string;
  generatedAt: string;

  psfsAverage: number;               // 0–10 mean of current scores
  psfsChangeFromBaseline: number;    // current mean - baseline mean
  psfsInterpretation: string;
  psfsMcidMet: boolean;              // change >= 2.0 (Stratford PW et al. 1995)

  tugSeconds: number | null;
  tugRiskCategory: 'low' | 'moderate' | 'high' | 'not_tested';

  thirtySecChairStand: number | null;
  thirtySecNormative: string;

  overallFunctionLevel: 'normal' | 'mildly_impaired' | 'moderately_impaired' | 'severely_impaired';
  goalProgressPercent: number;       // 0–100, PSFS 50% + TUG 30% + chair 20%
  grocInterpretation: string | null;

  referralFlags: RedFlagAlert[];
  clinicalSummary: string;           // Claude Haiku, 400 tokens max

  evidenceGrade: EvidenceGrade;
  citations: string[];
  processingMs: number;
}

// ── ConsensusAgent I/O ────────────────────────────────────────────────────────
// AdversarialReport defined above (line ~42) — ConsensusInput references it.

export interface ConsensusInput {
  assessmentId: string;
  patientId: string;
  patientAge?: number;
  patientSex?: 'male' | 'female';
  existingConditions: string[];
  currentMedications: string[];
  allFindings: {
    posture:      Record<string, unknown> | null;
    gait:         GaitReport | null;
    rom:          ROMReport | null;
    specialTests: SpecialTestsReport | null;
    pain:         PainMapOutput | null;
    functional:   FunctionalReport | null;
  };
  adversarialReport: AdversarialReport | null;
}

export interface DiagnosticHypothesis {
  name: string;
  icd10: string;
  probability: 'high' | 'moderate' | 'low';
  confidence: number;
  keyDistinguishingFeature: string;
  toExcludeWith: string;
  adversarialChallenged: boolean;
}

export interface TreatmentPriority {
  priority: number;
  intervention: string;
  rationale: string;
  evidenceGrade: EvidenceGrade;
  citation: string;
  cptCodes: string[];
  timeframeWeeks: number;
}

export interface PrescribedExercise {
  name: string;
  sets: number;
  reps: number | null;
  holdSeconds: number | null;
  frequencyPerWeek: number;
  rationale: string;
}

export interface EvidenceCitation {
  claim: string;
  citation: string;
  evidenceGrade: EvidenceGrade;
  agentSource: string;
}

export interface ClinicalAssessmentReport {
  agentId: 'consensus-agent';
  version: '1.0.0';
  assessmentId: string;
  patientId: string;
  generatedAt: string;

  approvedForConsensus: boolean;
  adversarialVerdict: string;
  adversarialOverrideApplied: boolean;

  overallHealthScore: number;
  dataQuality: 'high' | 'medium' | 'low' | 'insufficient';
  dataCompleteness: number;

  primaryFindings: string[];
  primaryDiagnosis: {
    name: string;
    icd10: string;
    confidence: number;
    evidenceGrade: EvidenceGrade;
    supportingFindings: string[];
    adversarialChallenged: boolean;
  } | null;
  differentialDiagnoses: DiagnosticHypothesis[];
  treatmentPriorities: TreatmentPriority[];
  prescribedProgram: PrescribedExercise[];
  referralFlags: RedFlagAlert[];
  referralRecommended: boolean;
  referralUrgency: 'routine' | 'urgent' | 'emergency' | null;
  referralReason: string | null;
  progressionTimeline: string;
  nextAssessmentDate: string;
  recommendedCPTCodes: string[];

  fhirCarePlan: Record<string, unknown>;
  evidenceSummary: EvidenceCitation[];
  clinicianSummary: string;
  patientSummary: string;

  processingMs: number;
}

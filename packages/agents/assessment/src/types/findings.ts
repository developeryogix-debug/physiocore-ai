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
  normalMax: number;            // degrees, from jointDatabase
  estimatedROMPercent: number;  // 0–100% of normalMax
  estimatedDegrees: number;     // normalMax × estimatedROMPercent/100
  deficitPercent: number;       // 100 - estimatedROMPercent
  clinicallySignificant: boolean; // deficit >20%
  sessionCount: number;
  lastMeasuredAt: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
  dataSource: 'session_score_proxy';
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

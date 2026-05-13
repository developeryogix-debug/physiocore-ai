// ─── Shared primitives ────────────────────────────────────────────────────────

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

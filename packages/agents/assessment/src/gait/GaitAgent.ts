import Anthropic from '@anthropic-ai/sdk';
import type {
  FrameData,
  GaitReport,
  GaitDeviation,
  GaitMetrics,
  NormalizedLandmark,
  RedFlagAlert,
} from '../types/findings.js';

// ─── MediaPipe landmark indices ──────────────────────────────────────────────
// Ref: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
const LM = {
  LEFT_SHOULDER:  11, RIGHT_SHOULDER: 12,
  LEFT_HIP:       23, RIGHT_HIP:      24,
  LEFT_KNEE:      25, RIGHT_KNEE:     26,
  LEFT_ANKLE:     27, RIGHT_ANKLE:    28,
  LEFT_HEEL:      29, RIGHT_HEEL:     30,
  LEFT_WRIST:     15, RIGHT_WRIST:    16,
} as const;

const MIN_VISIBILITY   = 0.35;  // discard landmark if below this
const MIN_USABLE_FRAMES = 15;   // need at least this many frames for valid analysis
const TRENDELENBURG_THRESHOLD = 0.04;  // normalised hip drop (>4% of frame height)
const ANTALGIC_THRESHOLD = 0.20;       // >20% stance time asymmetry

// ─── Gait thresholds (Krebs DE et al. Phys Ther. 1985) ──────────────────────
const CADENCE_NORMAL_MIN = 90;   // steps/min
const CADENCE_NORMAL_MAX = 130;

// Trunk sway thresholds (normalised frame width)
// Perry & Burnfield, Gait Analysis, 2nd ed., 2010, Chapter 14
const SWAY_MILD     = 0.025;
const SWAY_MODERATE = 0.050;
const SWAY_SEVERE   = 0.080;

// Step symmetry thresholds
const SYMMETRY_MILD     = 90;
const SYMMETRY_MODERATE = 75;

// Arm swing: wrist x-range thresholds (normalised)
const ARM_ABSENT_THRESHOLD = 0.012;
const ARM_REDUCED_RATIO    = 0.50;  // one side < 50% of contralateral

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lm(frame: FrameData, index: number): NormalizedLandmark | null {
  const p = frame.landmarks[index];
  if (!p) return null;
  return (p.visibility ?? 1) >= MIN_VISIBILITY ? p : null;
}

/** Running average of an array. */
function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Peak-to-peak range of a numeric array. */
function range(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.max(...arr) - Math.min(...arr);
}

/**
 * Detect local maxima in a signal (step events on ground = max y of ankle).
 * Returns indices of frames where foot is in ground contact (max ankle Y).
 */
function detectStepEvents(
  frames: FrameData[],
  ankleLmIdx: number,
  windowMs = 250,         // minimum 250ms between steps (~120 steps/min max)
): number[] {
  const events: number[] = [];
  let lastEventMs = -Infinity;

  for (let i = 1; i < frames.length - 1; i++) {
    const prev = frames[i - 1]!, curr = frames[i]!, next = frames[i + 1]!;
    const pAnkle = lm(prev, ankleLmIdx);
    const cAnkle = lm(curr, ankleLmIdx);
    const nAnkle = lm(next, ankleLmIdx);
    if (!pAnkle || !cAnkle || !nAnkle) continue;

    // Foot on ground = local maximum in Y (higher Y = lower on screen)
    const isLocalMax = cAnkle.y > pAnkle.y && cAnkle.y > nAnkle.y;
    const gapOk = curr.timestampMs - lastEventMs >= windowMs;

    if (isLocalMax && gapOk) {
      events.push(i);
      lastEventMs = curr.timestampMs;
    }
  }
  return events;
}

// ─── Algorithmic gait metric extraction ──────────────────────────────────────

function computeMetrics(frames: FrameData[]): GaitMetrics {
  const usable = frames.filter(f => {
    const lAnkle = lm(f, LM.LEFT_ANKLE);
    const rAnkle = lm(f, LM.RIGHT_ANKLE);
    return lAnkle !== null || rAnkle !== null;
  });

  if (usable.length < MIN_USABLE_FRAMES) {
    return {
      cadenceStepsPerMin: 0, stepTimesMs: { left: [], right: [] },
      stepSymmetryPercent: 0, trunkSwayAmplitudeNorm: 0,
      leftArmAmplitudeNorm: 0, rightArmAmplitudeNorm: 0,
      hipDropMetric: { leftDrop: 0, rightDrop: 0 },
      meanLandmarkVisibility: 0, usableFrameCount: usable.length,
    };
  }

  // ── Step events ──────────────────────────────────────────────────────────
  const leftSteps  = detectStepEvents(usable, LM.LEFT_ANKLE);
  const rightSteps = detectStepEvents(usable, LM.RIGHT_ANKLE);

  const totalSteps = leftSteps.length + rightSteps.length;
  const durationMs = usable[usable.length - 1]!.timestampMs - usable[0]!.timestampMs;
  const durationMin = durationMs / 60_000;
  const cadenceStepsPerMin = durationMin > 0 ? totalSteps / durationMin : 0;

  // Inter-step intervals per side
  const leftStepTimesMs  = leftSteps.slice(1).map((i, k) =>
    usable[i]!.timestampMs - usable[leftSteps[k]!]!.timestampMs);
  const rightStepTimesMs = rightSteps.slice(1).map((i, k) =>
    usable[i]!.timestampMs - usable[rightSteps[k]!]!.timestampMs);

  const meanLeft  = mean(leftStepTimesMs);
  const meanRight = mean(rightStepTimesMs);
  // Symmetry ratio: shorter/longer × 100 (Krebs 1985)
  const stepSymmetryPercent = (meanLeft > 0 && meanRight > 0)
    ? (Math.min(meanLeft, meanRight) / Math.max(meanLeft, meanRight)) * 100
    : 0;

  // ── Trunk sway (lateral x-displacement of hip midpoint) ──────────────────
  const hipXSeries: number[] = [];
  for (const f of usable) {
    const lh = lm(f, LM.LEFT_HIP), rh = lm(f, LM.RIGHT_HIP);
    if (lh && rh) hipXSeries.push((lh.x + rh.x) / 2);
  }
  const trunkSwayAmplitudeNorm = range(hipXSeries);

  // ── Arm swing (wrist x-amplitude per side) ────────────────────────────────
  const lwX: number[] = [], rwX: number[] = [];
  for (const f of usable) {
    const lw = lm(f, LM.LEFT_WRIST);  if (lw) lwX.push(lw.x);
    const rw = lm(f, LM.RIGHT_WRIST); if (rw) rwX.push(rw.x);
  }
  const leftArmAmplitudeNorm  = range(lwX);
  const rightArmAmplitudeNorm = range(rwX);

  // ── Trendelenburg / hip drop ──────────────────────────────────────────────
  // During right swing phase (right foot off ground), check if left hip drops
  const hipDropMetric = { leftDrop: 0, rightDrop: 0 };
  for (const fi of rightSteps) {
    // Right foot just hit ground — during preceding swing, left hip should be level
    const swingStart = Math.max(0, fi - 5);
    for (let s = swingStart; s < fi; s++) {
      const frame = usable[s]!;
      const lh = lm(frame, LM.LEFT_HIP), rh = lm(frame, LM.RIGHT_HIP);
      if (!lh || !rh) continue;
      const drop = lh.y - rh.y;  // positive = left hip lower (Trendelenburg right)
      if (drop > hipDropMetric.rightDrop) hipDropMetric.rightDrop = drop;
    }
  }
  for (const fi of leftSteps) {
    const swingStart = Math.max(0, fi - 5);
    for (let s = swingStart; s < fi; s++) {
      const frame = usable[s]!;
      const lh = lm(frame, LM.LEFT_HIP), rh = lm(frame, LM.RIGHT_HIP);
      if (!lh || !rh) continue;
      const drop = rh.y - lh.y;  // positive = right hip lower (Trendelenburg left)
      if (drop > hipDropMetric.leftDrop) hipDropMetric.leftDrop = drop;
    }
  }

  // ── Mean landmark visibility (confidence proxy) ───────────────────────────
  const visibilities: number[] = [];
  for (const f of usable) {
    for (const lmI of Object.values(LM)) {
      const p = f.landmarks[lmI];
      if (p) visibilities.push(p.visibility ?? 1);
    }
  }
  const meanLandmarkVisibility = mean(visibilities);

  return {
    cadenceStepsPerMin,
    stepTimesMs: { left: leftStepTimesMs, right: rightStepTimesMs },
    stepSymmetryPercent,
    trunkSwayAmplitudeNorm,
    leftArmAmplitudeNorm,
    rightArmAmplitudeNorm,
    hipDropMetric,
    meanLandmarkVisibility,
    usableFrameCount: usable.length,
  };
}

// ─── Rules-based classification ──────────────────────────────────────────────

function classifyTrunkSway(norm: number): GaitReport['trunkSway'] {
  if (norm < SWAY_MILD)     return 'normal';
  if (norm < SWAY_MODERATE) return 'mild';
  if (norm < SWAY_SEVERE)   return 'moderate';
  return 'severe';
}

function classifyArmSwing(
  leftAmp: number, rightAmp: number,
): GaitReport['armSwing'] {
  const bothAbsent = leftAmp < ARM_ABSENT_THRESHOLD && rightAmp < ARM_ABSENT_THRESHOLD;
  if (bothAbsent) return 'absent';
  const maxAmp = Math.max(leftAmp, rightAmp);
  if (maxAmp < 0.001) return 'absent';
  if (leftAmp  < rightAmp * ARM_REDUCED_RATIO) return 'reduced_left';
  if (rightAmp < leftAmp  * ARM_REDUCED_RATIO) return 'reduced_right';
  return 'symmetrical';
}

function classifyTrendelenburg(
  hipDrop: GaitMetrics['hipDropMetric'],
): GaitReport['trendelenburgSign'] {
  if (hipDrop.rightDrop > TRENDELENBURG_THRESHOLD) return 'positive_right';
  if (hipDrop.leftDrop  > TRENDELENBURG_THRESHOLD) return 'positive_left';
  return 'absent';
}

function classifyHeelStrike(
  frames: FrameData[],
): GaitReport['heelStrikePattern'] {
  // Compare heel vs ankle Y at step events; if heel Y < ankle Y → toe strike
  const heelLeadRatio: number[] = [];
  for (const f of frames) {
    const lHeel = lm(f, LM.LEFT_HEEL),  lAnkle = lm(f, LM.LEFT_ANKLE);
    const rHeel = lm(f, LM.RIGHT_HEEL), rAnkle = lm(f, LM.RIGHT_ANKLE);
    if (lHeel && lAnkle) heelLeadRatio.push(lHeel.y - lAnkle.y);
    if (rHeel && rAnkle) heelLeadRatio.push(rHeel.y - rAnkle.y);
  }
  if (heelLeadRatio.length === 0) return 'normal';
  const avg = mean(heelLeadRatio);
  // Positive avg → heel below ankle (normal heel strike)
  // Negative avg → heel above ankle (toe strike)
  if (avg < -0.015) return 'toe_strike';
  if (avg < 0.005)  return 'flat_foot';
  return 'normal';
}

function classifyDataQuality(
  metrics: GaitMetrics,
): GaitReport['dataQuality'] {
  if (metrics.usableFrameCount < MIN_USABLE_FRAMES) return 'insufficient';
  if (metrics.meanLandmarkVisibility > 0.70 && metrics.cadenceStepsPerMin > 50) return 'good';
  if (metrics.meanLandmarkVisibility > 0.45) return 'acceptable';
  return 'poor';
}

// ─── Claude Sonnet clinical interpretation ────────────────────────────────────

interface ClaudeInterpretation {
  flags:          string[];
  gaitDeviations: GaitDeviation[];
  referralFlags:  RedFlagAlert[];
  clinicalSummary: string;
}

const FALLBACK_INTERPRETATION: ClaudeInterpretation = {
  flags: [],
  gaitDeviations: [],
  referralFlags: [],
  clinicalSummary: 'Gait analysis complete. Manual clinical review recommended.',
};

async function interpretWithClaude(
  metrics: GaitMetrics,
  rules: {
    cadence: number;
    trunkSway: string;
    armSwing: string;
    symmetry: number;
    trendelenburg: string;
    heelStrike: string;
    antalgic: boolean;
    antalgicSide: 'left' | 'right' | null;
    dataQuality: string;
  },
  client: Anthropic,
): Promise<ClaudeInterpretation> {
  const prompt = `You are a clinical physiotherapist interpreting observational gait analysis data.

COMPUTED GAIT METRICS:
- Cadence: ${rules.cadence.toFixed(1)} steps/min (normal: ${CADENCE_NORMAL_MIN}–${CADENCE_NORMAL_MAX})
- Step symmetry: ${metrics.stepSymmetryPercent.toFixed(1)}% (100 = perfect)
- Trunk sway amplitude: ${(metrics.trunkSwayAmplitudeNorm * 100).toFixed(1)}% of frame width → classified: ${rules.trunkSway}
- Arm swing: ${rules.armSwing}
- Trendelenburg sign: ${rules.trendelenburg}
- Heel strike pattern: ${rules.heelStrike}
- Antalgic gait: ${rules.antalgic ? `YES — ${rules.antalgicSide} side` : 'NO'}
- Data quality: ${rules.dataQuality}
- Mean landmark visibility: ${(metrics.meanLandmarkVisibility * 100).toFixed(0)}%

CLINICAL TASK:
Return ONLY valid JSON matching this schema exactly:
{
  "flags": ["string"],
  "gaitDeviations": [
    { "name": "string", "phase": "stance|swing|double_support|overall", "severity": "mild|moderate|severe", "likelyCause": "string" }
  ],
  "referralFlags": [
    { "type": "string", "description": "string", "immediateAction": "string", "emergencyLevel": "monitor|urgent_referral|call_999" }
  ],
  "clinicalSummary": "string (2–3 sentences max, plain English)"
}

Rules:
- Only flag referral if Trendelenburg positive, cadence <60, severe antalgic, or data suggests neurological gait
- flags: brief clinical observations only (e.g. "Possible Trendelenburg right", "Antalgic gait pattern")
- citation basis: Krebs DE et al. Phys Ther. 1985;65(7):1027-1033
- If data quality is poor or insufficient, state that in clinicalSummary and keep flags minimal
- DO NOT add diagnostic labels (ICD-10) — this is observational screening only`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return FALLBACK_INTERPRETATION;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ClaudeInterpretation>;
    return {
      flags:           Array.isArray(parsed.flags)           ? parsed.flags           : [],
      gaitDeviations:  Array.isArray(parsed.gaitDeviations)  ? parsed.gaitDeviations  : [],
      referralFlags:   Array.isArray(parsed.referralFlags)   ? parsed.referralFlags   : [],
      clinicalSummary: typeof parsed.clinicalSummary === 'string' ? parsed.clinicalSummary : '',
    };
  } catch {
    return FALLBACK_INTERPRETATION;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class GaitAgent {
  private readonly agentId  = 'gait-agent' as const;
  private readonly version  = '1.0.0' as const;
  private readonly evidence: GaitReport['evidenceGrade'] = 'B';
  private readonly citation = 'Krebs DE et al. Reliability of observational kinematic gait analysis. Phys Ther. 1985;65(7):1027-1033';

  private readonly client: Anthropic;

  constructor(anthropicApiKey?: string) {
    this.client = new Anthropic({
      apiKey: anthropicApiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
  }

  /**
   * Analyse a walking sequence from per-frame MediaPipe landmark data.
   *
   * Frames should be extracted every ~10th frame from a 30-second walking clip
   * captured at the end of the PostureAssessment 4-view protocol.
   *
   * @param frames   Array of frame data with MediaPipe landmarks
   * @returns        GaitReport with step symmetry, sway, arm swing, flags, and
   *                 Claude Sonnet clinical interpretation
   *
   * @citation Krebs DE et al. Phys Ther. 1985;65(7):1027-1033 (Grade B)
   */
  async analyseWalk(frames: FrameData[]): Promise<GaitReport> {
    const t0 = Date.now();

    // ── 1. Algorithmic metric extraction ─────────────────────────────────────
    const metrics = computeMetrics(frames);

    // ── 2. Rules-based classification ────────────────────────────────────────
    const trunkSway     = classifyTrunkSway(metrics.trunkSwayAmplitudeNorm);
    const armSwing      = classifyArmSwing(metrics.leftArmAmplitudeNorm, metrics.rightArmAmplitudeNorm);
    const trendelenburg = classifyTrendelenburg(metrics.hipDropMetric);
    const heelStrike    = classifyHeelStrike(frames);
    const dataQuality   = classifyDataQuality(metrics);

    // Antalgic: significant stance-time asymmetry (>20%)
    const meanL = mean(metrics.stepTimesMs.left);
    const meanR = mean(metrics.stepTimesMs.right);
    const stanceAsymmetry = (meanL > 0 && meanR > 0)
      ? Math.abs(meanL - meanR) / Math.max(meanL, meanR)
      : 0;
    const antalgicPattern = stanceAsymmetry > ANTALGIC_THRESHOLD;
    const antalgicSide: GaitReport['antalgicSide'] = antalgicPattern
      ? (meanL < meanR ? 'left' : 'right')
      : null;

    // ── 3. Claude Sonnet interpretation ──────────────────────────────────────
    const interpretation = dataQuality !== 'insufficient'
      ? await interpretWithClaude(
          metrics,
          {
            cadence: metrics.cadenceStepsPerMin, trunkSway, armSwing,
            symmetry: metrics.stepSymmetryPercent, trendelenburg, heelStrike,
            antalgic: antalgicPattern, antalgicSide, dataQuality,
          },
          this.client,
        )
      : {
          ...FALLBACK_INTERPRETATION,
          flags: ['Insufficient frame data for reliable gait analysis'],
          clinicalSummary:
            'Insufficient landmark data to perform reliable gait analysis. ' +
            'Ensure patient is visible for the full walking trial and repeat if needed.',
        };

    // ── 4. Assemble GaitReport ────────────────────────────────────────────────
    const report: GaitReport = {
      agentId:   this.agentId,
      version:   this.version,

      stepSymmetry:              Math.round(metrics.stepSymmetryPercent * 10) / 10,
      cadence:                   Math.round(metrics.cadenceStepsPerMin * 10) / 10,
      trunkSway,
      armSwing,

      heelStrikePattern: heelStrike,
      trendelenburgSign: trendelenburg,
      antalgicPattern,
      antalgicSide,

      stepLengthSymmetryPercent: Math.round(metrics.stepSymmetryPercent * 10) / 10,
      trunkSwayAmplitudeNorm:    Math.round(metrics.trunkSwayAmplitudeNorm * 10_000) / 10_000,
      leftArmAmplitude:          Math.round(metrics.leftArmAmplitudeNorm  * 10_000) / 10_000,
      rightArmAmplitude:         Math.round(metrics.rightArmAmplitudeNorm * 10_000) / 10_000,

      framesAnalysed: metrics.usableFrameCount,
      dataQuality,
      confidence: Math.round(metrics.meanLandmarkVisibility * 100) / 100,

      flags:           interpretation.flags,
      gaitDeviations:  interpretation.gaitDeviations,
      referralFlags:   interpretation.referralFlags,
      clinicalSummary: interpretation.clinicalSummary,

      evidenceGrade: this.evidence,
      citation:      this.citation,

      processingMs: Date.now() - t0,
    };

    return report;
  }
}

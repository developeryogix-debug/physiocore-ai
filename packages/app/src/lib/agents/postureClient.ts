/**
 * postureClient.ts
 * Posture analysis agent — measurement extraction + Claude Sonnet call.
 * Implements POSTURE_SYSTEM.md AI Analysis Prompt.
 * Every finding must cite Kendall et al. or equivalent primary source.
 */
import { callClaude, extractJson } from './anthropicClient.js';

// ─── Landmark type (matches MediaPipe normalised output) ───────────────────────
type MPLandmark = { x: number; y: number; z?: number; visibility?: number };

// ─── Measurement types ────────────────────────────────────────────────────────

export interface PostureMeasurements {
  // Frontal plane — anterior (front) view
  shoulderLevelDiff:  number;  // degrees off horizontal (0 = level)
  headTiltAngle:      number;  // degrees nose displaced from shoulder-midpoint vertical
  hipLevelDiff:       number;  // degrees off horizontal
  plumbDeviation:     number;  // degrees shoulder+hip midpoints displaced from centre

  // Sagittal plane — right lateral view (if visible)
  headForwardPosture:  number;  // ear→shoulder horizontal gap as % of shoulder→hip distance
  earShoulderHipAngle: number;  // angle at shoulder landmark (degrees; ideal ≈ 0° = vertical)
  lateralAvailable:    boolean;
}

export interface PostureFinding {
  name:               string;
  severity:           'normal' | 'mild' | 'moderate' | 'severe';
  measurement:        string;  // human-readable value, e.g., "3.2° rightward tilt"
  clinicalSignificance: string;
  citation:           string;
  evidenceGrade:      'A' | 'B' | 'C' | 'D';
}

export interface PostureReport {
  overallScore:    number;          // 0-100
  sagittalScore:   number;
  frontalScore:    number;
  clinicalSummary: string;          // 3-sentence summary
  findings:        PostureFinding[];
  muscleImbalancePattern: {
    name:              string;      // e.g. "Upper Crossed Syndrome (Janda)"
    shortenedMuscles:  string[];
    lengthenedMuscles: string[];
    citation:          string;
  } | null;
  correctionExercises: Array<{ name: string; sets: string; focus: string }>;
  referralFlags:       string[];
  homeCare: {
    stretches:      Array<{ name: string; instructions: string }>;
    strengthening:  Array<{ name: string; instructions: string }>;
  };
}

// ─── Sapiens HF Space client ──────────────────────────────────────────────────
//
// Supports Gradio 4.x (POST /run/predict → JSON) and
//          Gradio 5/6.x (POST /call/fn → event_id, GET /call/fn/{id} → SSE).
//
// VITE_SAPIENS_ENDPOINT — full URL or base URL; trailing path stripped internally.
// VITE_HF_TOKEN         — bearer token for ZeroGPU / private spaces.
//
// Returns MPLandmark[] on success, null on any failure → caller uses MediaPipe.

interface SapiensLandmark {
  x:          number;   // 0–1 normalised
  y:          number;
  z?:         number;
  confidence: number;   // 0–1
}

interface SapiensResponse {
  landmarks:        SapiensLandmark[];
  sapiensAvailable: boolean;
}

const SAPIENS_BASE = (
  (import.meta.env['VITE_SAPIENS_ENDPOINT'] as string | undefined)
  ?? 'https://physiocoreai-physiocore-sapiens.hf.space'
).replace(/\/(run\/predict|call\/[\w-]+)\/?$/, '');  // strip any trailing path

const HF_TOKEN = import.meta.env['VITE_HF_TOKEN'] as string | undefined;

function sapiensHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
  };
}

/** Unwrap and validate a parsed Gradio result object. */
function parseSapiensResult(result: unknown): MPLandmark[] | null {
  const r = result as SapiensResponse | null;
  if (!r?.sapiensAvailable || !Array.isArray(r.landmarks) || r.landmarks.length === 0) return null;
  const lms = r.landmarks
    .filter(lm => lm.confidence >= 0.3)
    .map(lm => ({ x: lm.x, y: lm.y, z: lm.z ?? 0, visibility: lm.confidence }));
  return lms.length > 0 ? lms : null;
}

/** Unwrap a Gradio data[0] value (may be a JSON string or plain object). */
function unwrapGradioData(raw: unknown): SapiensResponse | null {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return obj as SapiensResponse;
  } catch { return null; }
}

/**
 * Try Sapiens pose estimation for a single JPEG/PNG frame (base64 data-URL).
 * Returns MPLandmark[] on success, null on any failure → caller uses MediaPipe.
 *
 * Strategy:
 *   1. Gradio 4.x — POST /run/predict → { data: ["<json string>"] }
 *   2. Gradio 5/6.x — POST /call/analyse_pose → { event_id }
 *                   → GET /call/analyse_pose/{event_id} → SSE stream
 */
export async function callSapiensLandmarks(imageBase64: string): Promise<MPLandmark[] | null> {
  const body = JSON.stringify({ data: [imageBase64] });
  const h    = sapiensHeaders();

  // ── Strategy 1: Gradio 4.x /run/predict ────────────────────────────────────
  try {
    const r1 = await fetch(`${SAPIENS_BASE}/run/predict`, {
      method: 'POST', headers: h, body,
      signal: AbortSignal.timeout(15_000),
    });
    if (r1.ok) {
      const j = await r1.json() as { data?: unknown[] };
      const result = unwrapGradioData(j.data?.[0]);
      const lms    = parseSapiensResult(result);
      if (lms) return lms;
    }
  } catch { /* fall through to strategy 2 */ }

  // ── Strategy 2: Gradio 5/6.x /call/{fn} + SSE poll ─────────────────────────
  try {
    const r2 = await fetch(`${SAPIENS_BASE}/call/analyse_pose`, {
      method: 'POST', headers: h, body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!r2.ok) return null;

    const { event_id } = await r2.json() as { event_id: string };
    if (!event_id) return null;

    const r3 = await fetch(`${SAPIENS_BASE}/call/analyse_pose/${event_id}`, {
      headers: { ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}) },
      signal:  AbortSignal.timeout(30_000),
    });
    if (!r3.ok) return null;

    // SSE body: one or more "data: <json>\n\n" lines; last one carries the result
    const text  = await r3.text();
    const match = text.match(/data:\s*(\[.+\]|\{.+\})\s*$/ms);
    if (!match) return null;

    const parsed = JSON.parse(match[1] ?? '');
    // Gradio 5/6 wraps fn return in an array: [result] or ["json string"]
    const inner  = Array.isArray(parsed) ? parsed[0] : parsed;
    return parseSapiensResult(unwrapGradioData(inner));
  } catch (e) {
    console.log('[Sapiens] Falling back to MediaPipe:', e);
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function angleDeg3(a: MPLandmark, b: MPLandmark, c: MPLandmark): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.sqrt((abx ** 2 + aby ** 2) * (cbx ** 2 + cby ** 2));
  return mag === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

/** Angle of line AB off horizontal (0° = perfectly level). */
function levelAngle(a: MPLandmark, b: MPLandmark): number {
  return Math.abs(Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x)) * 180 / Math.PI);
}

function visible(lm: MPLandmark | undefined, thr = 0.3): boolean {
  return !!lm && (lm.visibility ?? 1) >= thr;
}

function round1(n: number): number { return Math.round(n * 10) / 10; }

// ─── Measurement extraction ───────────────────────────────────────────────────

/**
 * Extracts postural measurements from captured MediaPipe landmark arrays.
 * @param anteriorLms  Landmarks from front-facing (anterior) frame
 * @param lateralLms   Landmarks from right-lateral frame (may be null)
 */
export function extractMeasurements(
  anteriorLms: MPLandmark[] | null,
  lateralLms:  MPLandmark[] | null,
): PostureMeasurements {
  const m: PostureMeasurements = {
    shoulderLevelDiff:   0,
    headTiltAngle:       0,
    hipLevelDiff:        0,
    plumbDeviation:      0,
    headForwardPosture:  0,
    earShoulderHipAngle: 90,
    lateralAvailable:    false,
  };

  // ── Anterior measurements ─────────────────────────────────────────────────
  if (anteriorLms && anteriorLms.length >= 25) {
    const nose = anteriorLms[0];
    const lShoulder = anteriorLms[11], rShoulder = anteriorLms[12];
    const lHip      = anteriorLms[23], rHip      = anteriorLms[24];

    if (visible(lShoulder) && visible(rShoulder)) {
      m.shoulderLevelDiff = round1(levelAngle(lShoulder!, rShoulder!));

      const sMidX = (lShoulder!.x + rShoulder!.x) / 2;
      const sMidY = (lShoulder!.y + rShoulder!.y) / 2;

      if (visible(nose)) {
        // Head tilt: angle of nose from the shoulder-midpoint vertical axis
        const dx = Math.abs((nose!.x) - sMidX);
        const dy = Math.max(Math.abs((nose!.y) - sMidY), 0.001);
        m.headTiltAngle = round1(Math.atan2(dx, dy) * 180 / Math.PI);
      }

      if (visible(lHip) && visible(rHip)) {
        m.hipLevelDiff = round1(levelAngle(lHip!, rHip!));

        // Plumb deviation: how far body centre deviates from frame centre (x=0.5)
        const hMidX = (lHip!.x + rHip!.x) / 2;
        const maxOff = Math.max(Math.abs(sMidX - 0.5), Math.abs(hMidX - 0.5));
        m.plumbDeviation = round1(maxOff * 30); // ~1% frame width ≈ 0.3° at 2.5 m
      }
    }
  }

  // ── Right lateral measurements ────────────────────────────────────────────
  if (lateralLms && lateralLms.length >= 25) {
    // Landmark indices: 7 = left_ear, 8 = right_ear, 11 = lShoulder, 12 = rShoulder
    // For right lateral view the right side faces camera → prefer right landmarks
    const ear      = visible(lateralLms[8]) ? lateralLms[8]! : (visible(lateralLms[7]) ? lateralLms[7]! : null);
    const shoulder = visible(lateralLms[12]) ? lateralLms[12]! : (visible(lateralLms[11]) ? lateralLms[11]! : null);
    const hip      = visible(lateralLms[24]) ? lateralLms[24]! : (visible(lateralLms[23]) ? lateralLms[23]! : null);

    if (ear && shoulder && hip) {
      m.lateralAvailable = true;

      // Head forward posture: horizontal distance of ear relative to shoulder,
      // normalised by shoulder-to-hip distance (so body size doesn't matter).
      const shDist = Math.sqrt(
        (shoulder.x - hip.x) ** 2 + (shoulder.y - hip.y) ** 2,
      );
      // In right-lateral view, patient faces LEFT in camera frame (lower x = anterior)
      // Positive = ear is anterior (forward) relative to shoulder
      const earForwardNorm = (shoulder.x - ear.x) / Math.max(shDist, 0.01);
      m.headForwardPosture = round1(earForwardNorm * 100); // express as %

      // Ear-shoulder-hip angle at shoulder.
      // Ideal: ~0° (ear directly above hip — perfect vertical line)
      // As ear moves anterior, this angle decreases from 180° toward 90°.
      m.earShoulderHipAngle = round1(angleDeg3(ear, shoulder, hip));
    }
  }

  return m;
}

// ─── Claude API call ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a clinical physiotherapist specialising in postural assessment (SaMD Class II context).
Analyse the provided postural measurements and respond with a structured JSON report.

Requirements:
- Every finding MUST cite Kendall et al. (Muscles: Testing and Function, 5th Ed.) or an equivalent primary source.
- Every recommendation must carry an evidence grade (A/B/C/D per Oxford CEBM hierarchy).
- Use Latin anatomical muscle names (e.g., "trapezius (upper)") throughout.
- Identify Janda patterns when measurements support them (Upper Crossed, Lower Crossed, Layer Syndrome). Hip or shoulder difference ≥3° indicates muscle imbalance — apply Janda lateral chain analysis.
- Apply POSTURE_SYSTEM.md severity thresholds:
  Shoulder/hip tilt: <3°=normal, 3-5°=mild, 5-10°=moderate, >10°=severe (threshold is ≥3°, NOT >4°)
  Head tilt: ≤2°=normal, 2-5°=mild, >5°=significant
  Head forward posture (% of S-H dist): ≤15%=normal, 15-30%=mild, 30-50%=moderate, >50%=severe
  Ear-shoulder-hip angle: 155-180°=normal, 140-155°=mild, 120-140°=moderate, <120°=severe
- referralFlags must include: any scoliosis suspicion (plumbDeviation >7°), neurological signs, or structural red flags.
- IMPORTANT: Any shoulder or hip tilt ≥3° MUST appear as a finding with severity at least "mild". Do not omit or normalise values in the 3–4° range.

Output ONLY valid JSON matching exactly:
{
  "overallScore": number,
  "sagittalScore": number,
  "frontalScore": number,
  "clinicalSummary": "string (3 sentences max)",
  "findings": [
    {
      "name": "string",
      "severity": "normal|mild|moderate|severe",
      "measurement": "string (value + unit)",
      "clinicalSignificance": "string",
      "citation": "string",
      "evidenceGrade": "A|B|C|D"
    }
  ],
  "muscleImbalancePattern": {
    "name": "string",
    "shortenedMuscles": ["string"],
    "lengthenedMuscles": ["string"],
    "citation": "string"
  } | null,
  "correctionExercises": [
    { "name": "string", "sets": "string", "focus": "string" }
  ],
  "referralFlags": ["string"],
  "homeCare": {
    "stretches": [{ "name": "string", "instructions": "string" }],
    "strengthening": [{ "name": "string", "instructions": "string" }]
  }
}`;

export async function analysePosture(
  measurements: PostureMeasurements,
  userConditions: string[],
): Promise<PostureReport> {
  const condStr = userConditions.length > 0
    ? `Patient conditions: ${userConditions.join(', ')}.`
    : 'No known conditions reported.';

  // Imbalance gate: ≥3° triggers explicit clinical note so Claude cannot miss it.
  // Changed from >4 to >=3 — catches borderline cases e.g. 3.9° hip obliquity.
  const hipDiff      = measurements.hipLevelDiff;
  const shoulderDiff = measurements.shoulderLevelDiff;
  const hasImbalance = hipDiff >= 3 || shoulderDiff >= 3;

  const measureStr = [
    `FRONTAL PLANE (anterior view):`,
    `  shoulderLevelDiff: ${shoulderDiff}° off horizontal`,
    `  headTiltAngle: ${measurements.headTiltAngle}° from vertical`,
    `  hipLevelDiff: ${hipDiff}° off horizontal`,
    `  plumbDeviation: ${measurements.plumbDeviation}° body-centre offset`,
    measurements.lateralAvailable
      ? [
          `SAGITTAL PLANE (right lateral view):`,
          `  headForwardPosture: ${measurements.headForwardPosture}% of shoulder-to-hip distance`,
          `  earShoulderHipAngle: ${measurements.earShoulderHipAngle}° at shoulder`,
        ].join('\n')
      : `SAGITTAL PLANE: lateral view not available — skip sagittal findings.`,
  ].join('\n');

  const imbalanceNote = hasImbalance
    ? `\nCLINICAL FLAG: Frontal-plane imbalance threshold exceeded (≥3°) — shoulder ${shoulderDiff}°, hip ${hipDiff}°. Classify as minimum severity "mild". Do not omit this finding.`
    : '';

  const userMsg = `${condStr}

Postural measurements:
${measureStr}${imbalanceNote}

Provide the JSON posture report.`;

  const raw = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 2048,
  });

  return extractJson<PostureReport>(raw);
}

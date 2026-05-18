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
// Gradio 6.x /gradio_api/ two-step queue (confirmed working on RTX PRO 6000):
//   POST /gradio_api/call/analyse_pose → { event_id }
//   GET  /gradio_api/call/analyse_pose/{event_id} → SSE → first data line
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


/**
 * Try Sapiens pose estimation for a single JPEG/PNG frame (base64 data-URL).
 * Returns MPLandmark[] on success, null on any failure → caller uses MediaPipe.
 *
 * Gradio 6.x /gradio_api/ two-step queue (confirmed working on RTX PRO 6000):
 *   Step 1: POST /gradio_api/call/analyse_pose → { event_id }
 *   Step 2: GET  /gradio_api/call/analyse_pose/{event_id} → SSE
 *           First "data:" line → JSON array → [0] → landmarks
 */
export async function callSapiensLandmarks(imageBase64: string): Promise<MPLandmark[] | null> {
  const BASE = 'https://physiocoreai-physiocore-sapiens.hf.space/gradio_api';

  // ── Step 1: Submit job ──────────────────────────────────────────────────────
  console.log('[Sapiens] Calling:', `${BASE}/call/analyse_pose`);
  console.log('[Sapiens] Image size:', imageBase64.length, 'chars');

  let event_id: string;
  try {
    const submitRes = await fetch(`${BASE}/call/analyse_pose`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ data: [imageBase64] }),
      signal:  AbortSignal.timeout(10_000),
    });
    console.log('[Sapiens] Submit status:', submitRes.status);
    console.log('[Sapiens] Submit ok:', submitRes.ok);
    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => '(unreadable)');
      console.error('[Sapiens] Submit error body:', errText);
      return null;
    }
    const json = await submitRes.json() as { event_id?: string };
    console.log('[Sapiens] Submit response JSON:', JSON.stringify(json));
    if (!json.event_id) {
      console.error('[Sapiens] No event_id in response');
      return null;
    }
    event_id = json.event_id;
    console.log('[Sapiens] Event ID:', event_id);
  } catch (e) {
    console.error('[Sapiens] Submit failed:', e);
    console.error('[Sapiens] Error type:', typeof e);
    if (e instanceof Error) {
      console.error('[Sapiens] Message:', e.message);
      console.error('[Sapiens] Stack:', e.stack);
    }
    return null;
  }

  // ── Step 2: SSE stream — read full text, find first data line ──────────────
  try {
    const streamUrl = `${BASE}/call/analyse_pose/${event_id}`;
    console.log('[Sapiens] Streaming from:', streamUrl);
    const streamRes = await fetch(streamUrl, {
      signal: AbortSignal.timeout(120_000),
    });
    console.log('[Sapiens] Stream status:', streamRes.status);
    console.log('[Sapiens] Stream ok:', streamRes.ok);
    if (!streamRes.ok) {
      const errText = await streamRes.text().catch(() => '(unreadable)');
      console.error('[Sapiens] Stream error body:', errText);
      return null;
    }

    const text = await streamRes.text();
    console.log('[Sapiens] Raw SSE text (first 500 chars):', text.slice(0, 500));

    const dataLine = text.split('\n').find(l => l.startsWith('data:'));
    if (!dataLine) {
      console.error('[Sapiens] No data: line found in SSE. Full text:', text.slice(0, 1000));
      return null;
    }
    console.log('[Sapiens] Data line:', dataLine.slice(0, 300));

    const arr   = JSON.parse(dataLine.slice(5).trim()) as unknown[];
    const inner = arr[0];
    console.log('[Sapiens] inner type:', typeof inner, '— preview:', JSON.stringify(inner)?.slice(0, 200));
    const result = (typeof inner === 'string' ? JSON.parse(inner) : inner) as SapiensResponse | null;
    console.log('[Sapiens] sapiensAvailable:', result?.sapiensAvailable, '— landmark count:', result?.landmarks?.length ?? 0);

    if (!result?.sapiensAvailable || !Array.isArray(result.landmarks) || result.landmarks.length === 0) {
      console.warn('[Sapiens] Result unusable — sapiensAvailable:', result?.sapiensAvailable, 'landmarks:', result?.landmarks?.length);
      return null;
    }

    const filtered = result.landmarks.filter(lm => lm.confidence >= 0.3);
    console.log('[Sapiens] ✅ Returning', filtered.length, 'landmarks (confidence ≥ 0.3)');
    return filtered.map(lm => ({ x: lm.x, y: lm.y, z: 0, visibility: lm.confidence }));
  } catch (e) {
    console.error('[Sapiens] Stream failed, falling back to MediaPipe:', e);
    console.error('[Sapiens] Error type:', typeof e);
    if (e instanceof Error) {
      console.error('[Sapiens] Message:', e.message);
      console.error('[Sapiens] Stack:', e.stack);
    }
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
  imageBase64?: string,
): Promise<PostureReport> {
  // ── Sapiens 308-keypoint precision fallback ──────────────────────────────────
  // If VITE_SAPIENS_ENDPOINT is configured and a frame image is provided, try
  // Sapiens first (8 s timeout). On success, re-derive measurements from the
  // higher-density landmarks. Any failure falls through to MediaPipe measurements.
  const sapiensEndpoint = (import.meta.env['VITE_SAPIENS_ENDPOINT'] as string | undefined) ?? '';
  if (imageBase64 && sapiensEndpoint) {
    try {
      const sRes = await fetch(sapiensEndpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: [imageBase64] }),
        signal:  AbortSignal.timeout(8_000),
      });
      if (sRes.ok) {
        const payload = await sRes.json() as {
          data: [{ landmarks: SapiensLandmark[]; sapiensAvailable: boolean; processingMs: number }];
        };
        const hit = payload.data?.[0];
        if (hit?.sapiensAvailable && Array.isArray(hit.landmarks) && hit.landmarks.length > 0) {
          console.log('[Sapiens] Using Sapiens 308-keypoint precision');
          measurements = extractMeasurements(
            hit.landmarks.map(lm => ({ x: lm.x, y: lm.y, z: 0, visibility: lm.confidence })),
            null,
          );
        }
      }
    } catch {
      // Fall through to MediaPipe-derived measurements
    }
  }

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

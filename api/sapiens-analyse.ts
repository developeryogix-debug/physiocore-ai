/**
 * api/sapiens-analyse.ts
 * Vercel serverless function — Phase 6a (Sapiens Precision)
 * POST { imageBase64, userId, imageWidth?, imageHeight?, mediapipeLandmarks? }
 * → { landmarks: SapiensLandmark[], confidence: number, sapiensAvailable: boolean, fallback?: string }
 *
 * NOTE: Meta Sapiens is NOT hosted on Replicate (HuggingFace only, no inference provider).
 * Phase 6a uses graceful fallback: if Sapiens unavailable, return mediapipeLandmarks
 * unchanged so posture/ROM pages continue working perfectly with MediaPipe 33-point data.
 *
 * To enable Sapiens: deploy facebook/sapiens-pose-1b to HuggingFace Inference Endpoints
 * or a self-hosted GPU, then update SAPIENS_ENDPOINT env var and the callSapiens() fn below.
 *
 * Spec: docs/PHASE6_SAPIENS_PRECISION.md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  imageBase64: string;
  userId: string;
  imageWidth?: number;           // px — used for x-normalisation; parsed from JPEG/PNG header if omitted
  imageHeight?: number;          // px
  mediapipeLandmarks?: Array<{   // fallback: client's existing MediaPipe results
    index: number;
    x: number;
    y: number;
    confidence?: number;
  }>;
}

/** Subset of MediaPipe NormalizedLandmark, augmented with Sapiens confidence. */
export interface SapiensLandmark {
  index:      number;  // MediaPipe landmark index (0–32)
  x:          number;  // 0–1 normalised
  y:          number;  // 0–1 normalised
  confidence: number;  // 0–1
}

// ── COCO 133 → MediaPipe 33 index map (user-specified) ───────────────────────

const COCO_TO_MEDIAPIPE: Record<number, number> = {
  0:  0,   // nose
  5:  11,  // left shoulder
  6:  12,  // right shoulder
  11: 23,  // left hip
  12: 24,  // right hip
  13: 25,  // left knee
  14: 26,  // right knee
  15: 27,  // left ankle
  16: 28,  // right ankle
  7:  13,  // left elbow
  8:  14,  // right elbow
  9:  15,  // left wrist
  10: 16,  // right wrist
};

// ── Replicate output normalisation ────────────────────────────────────────────

/**
 * Sapiens-pose keypoints arrive as [[x, y, score], ...] (COCO WholeBody pixel coords).
 * Flat arrays [x, y, s, x, y, s, ...] are also handled.
 */
function parseKeypointArray(raw: unknown): Array<[number, number, number]> {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Already nested: [[x,y,s], ...]
  if (Array.isArray(raw[0])) {
    return (raw as Array<unknown[]>).map(pt => {
      const [x = 0, y = 0, s = 0] = pt as number[];
      return [x, y, s] as [number, number, number];
    });
  }

  // Flat: [x, y, s, x, y, s, ...]
  const result: Array<[number, number, number]> = [];
  for (let i = 0; i + 2 < raw.length; i += 3) {
    result.push([raw[i] as number, raw[i + 1] as number, raw[i + 2] as number]);
  }
  return result;
}

/**
 * Lightweight JPEG/PNG dimension extractor — avoids needing sharp/jimp in a
 * serverless function.  Returns null if format is unrecognised.
 */
function getImageDimensions(base64: string): { width: number; height: number } | null {
  try {
    const buf = Buffer.from(base64, 'base64');

    // JPEG: look for SOF0/SOF1/SOF2 markers (0xFFC0/C1/C2)
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      let offset = 2;
      while (offset < buf.length - 8) {
        if (buf[offset] !== 0xFF) break;
        const marker = buf[offset + 1]!;
        const segLen = buf.readUInt16BE(offset + 2);
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          return {
            height: buf.readUInt16BE(offset + 5),
            width:  buf.readUInt16BE(offset + 7),
          };
        }
        offset += 2 + segLen;
      }
    }

    // PNG: IHDR chunk at bytes 16–24
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return {
        width:  buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
      };
    }
  } catch { /* non-fatal */ }
  return null;
}

// ── Sapiens endpoint (future: HuggingFace Inference Endpoints / self-hosted GPU) ─

/**
 * SAPIENS_ENDPOINT: set this env var when a self-hosted Sapiens endpoint is ready.
 * Expected POST body: { image: "data:image/jpeg;base64,..." }
 * Expected response:  { keypoints: [[x, y, score], ...] }  (COCO 133 pixel coords)
 */
const SAPIENS_ENDPOINT = process.env['SAPIENS_ENDPOINT'] ?? '';
const SAPIENS_API_KEY  = process.env['SAPIENS_API_KEY']  ?? '';

async function callSapiens(imageBase64: string): Promise<Array<[number, number, number]> | null> {
  if (!SAPIENS_ENDPOINT) return null;

  try {
    const r = await fetch(SAPIENS_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(SAPIENS_API_KEY ? { Authorization: `Bearer ${SAPIENS_API_KEY}` } : {}),
      },
      body:    JSON.stringify({ image: `data:image/jpeg;base64,${imageBase64}` }),
      signal:  AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      console.warn(`[sapiens-analyse] endpoint returned ${r.status} — falling back to MediaPipe`);
      return null;
    }
    const data = await r.json() as { keypoints?: unknown };
    return parseKeypointArray(data.keypoints ?? data);
  } catch (err) {
    console.warn('[sapiens-analyse] endpoint error — falling back to MediaPipe:', err);
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // POST only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse + validate body
  const body = req.body as Partial<RequestBody>;
  const {
    imageBase64,
    userId,
    imageWidth:  wOverride,
    imageHeight: hOverride,
    mediapipeLandmarks,
  } = body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  // 10 MB cap on base64 payload (~7.5 MB raw)
  if (imageBase64.length > 14_000_000) {
    return res.status(400).json({ error: 'imageBase64 too large (max ~10 MB)' });
  }

  // ── Sapiens path ──────────────────────────────────────────────────────────
  //
  // Sapiens (Meta, 308 keypoints) is NOT available on Replicate.
  // It lives on HuggingFace (facebook/sapiens-pose-1b) but has no hosted
  // inference provider. To enable: deploy to HuggingFace Inference Endpoints
  // or a self-hosted GPU and set SAPIENS_ENDPOINT in Vercel env vars.
  //
  // Until then, every request falls through to the MediaPipe fallback below.

  const sapiensKps = await callSapiens(imageBase64);

  if (sapiensKps && sapiensKps.length > 0) {
    // Sapiens available — map COCO 133 → MediaPipe 33 + normalise
    const dims = wOverride && hOverride
      ? { width: wOverride, height: hOverride }
      : getImageDimensions(imageBase64) ?? { width: 1280, height: 720 };

    const landmarks: SapiensLandmark[] = [];
    let confSum = 0, confCount = 0;

    for (const [cocoIdx, mpIdx] of Object.entries(COCO_TO_MEDIAPIPE)) {
      const kp = sapiensKps[Number(cocoIdx)];
      if (!kp) continue;
      const [xPx, yPx, score] = kp;
      landmarks.push({
        index:      mpIdx,
        x:          Math.max(0, Math.min(1, xPx / dims.width)),
        y:          Math.max(0, Math.min(1, yPx / dims.height)),
        confidence: Math.max(0, Math.min(1, score)),
      });
      confSum += score; confCount++;
    }

    const confidence = confCount > 0
      ? Math.round((confSum / confCount) * 1000) / 1000
      : 0;

    return res.status(200).json({ landmarks, confidence, sapiensAvailable: true });
  }

  // ── Fallback: return MediaPipe landmarks unchanged ────────────────────────
  //
  // Posture/ROM pages work perfectly with MediaPipe 33-point data.
  // The client should pass its current mediapipeLandmarks so this endpoint
  // can relay them back; if absent, return an empty array (client keeps its own).

  const fallbackLandmarks: SapiensLandmark[] = (mediapipeLandmarks ?? []).map(lm => ({
    index:      lm.index,
    x:          lm.x,
    y:          lm.y,
    confidence: lm.confidence ?? 0.5,
  }));

  return res.status(200).json({
    landmarks:        fallbackLandmarks,
    confidence:       fallbackLandmarks.length > 0
      ? fallbackLandmarks.reduce((s, l) => s + l.confidence, 0) / fallbackLandmarks.length
      : 0,
    sapiensAvailable: false,
    fallback:         'mediapipe',
    note:             'Sapiens not yet deployed. Set SAPIENS_ENDPOINT env var to enable 308-keypoint precision.',
  });
}

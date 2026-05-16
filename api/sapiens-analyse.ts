/**
 * api/sapiens-analyse.ts
 * Vercel serverless function — Phase 6a (Sapiens Precision)
 * POST { imageBase64, userId, imageWidth?, imageHeight? }
 * → { landmarks: SapiensLandmark[], confidence: number }
 *
 * Calls Replicate meta/sapiens-pose, maps COCO 133 → MediaPipe 33 indices.
 * REPLICATE_API_TOKEN required (replicate.com free tier: 500 predictions/month).
 * Spec: docs/PHASE6_SAPIENS_PRECISION.md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Replicate from 'replicate';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  imageBase64: string;
  userId: string;
  imageWidth?: number;   // px — used for x-normalisation; parsed from JPEG/PNG header if omitted
  imageHeight?: number;  // px
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

// ── Handler ───────────────────────────────────────────────────────────────────

const replicate = new Replicate({ auth: process.env['REPLICATE_API_TOKEN'] });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // POST only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Env guard
  if (!process.env['REPLICATE_API_TOKEN']) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured' });
  }

  // Parse + validate body
  const body = req.body as Partial<RequestBody>;
  const { imageBase64, userId, imageWidth: wOverride, imageHeight: hOverride } = body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Generous 10 MB cap on base64 payload (~7.5 MB raw)
  if (imageBase64.length > 14_000_000) {
    return res.status(400).json({ error: 'imageBase64 too large (max ~10 MB)' });
  }

  // Resolve image dimensions for normalisation
  const dims = wOverride && hOverride
    ? { width: wOverride, height: hOverride }
    : getImageDimensions(imageBase64) ?? { width: 1280, height: 720 };

  // Call Replicate
  let replicateOutput: unknown;
  try {
    replicateOutput = await replicate.run(
      'meta/sapiens-pose:latest',
      { input: { image: `data:image/jpeg;base64,${imageBase64}` } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: 'Replicate API error', detail: msg });
  }

  // Extract keypoints from Replicate response
  // Model may return: { keypoints: [...] } | [...] | { predictions: { keypoints: [...] } }
  let rawKps: unknown;
  if (Array.isArray(replicateOutput)) {
    rawKps = replicateOutput;
  } else if (replicateOutput && typeof replicateOutput === 'object') {
    const obj = replicateOutput as Record<string, unknown>;
    rawKps = obj['keypoints'] ?? obj['predictions'] ?? obj['output'] ?? replicateOutput;
    // Handle nested: { predictions: { keypoints: [...] } }
    if (rawKps && typeof rawKps === 'object' && !Array.isArray(rawKps)) {
      rawKps = (rawKps as Record<string, unknown>)['keypoints'] ?? rawKps;
    }
  }

  const kps = parseKeypointArray(rawKps);
  if (kps.length === 0) {
    return res.status(200).json({
      landmarks:  [],
      confidence: 0,
      warning:    'No keypoints returned by Replicate — check model output format',
      raw:        replicateOutput,
    });
  }

  // Map COCO keypoints → MediaPipe landmarks, normalise to [0, 1]
  const landmarks: SapiensLandmark[] = [];
  let confSum = 0;
  let confCount = 0;

  for (const [cocoIdx, mpIdx] of Object.entries(COCO_TO_MEDIAPIPE)) {
    const cocoIdxNum = Number(cocoIdx);
    const kp = kps[cocoIdxNum];
    if (!kp) continue;

    const [xPx, yPx, score] = kp;
    landmarks.push({
      index:      mpIdx,
      x:          Math.max(0, Math.min(1, xPx / dims.width)),
      y:          Math.max(0, Math.min(1, yPx / dims.height)),
      confidence: Math.max(0, Math.min(1, score)),
    });
    confSum   += score;
    confCount += 1;
  }

  // Overall confidence: mean of mapped landmark scores
  const confidence = confCount > 0
    ? Math.round((confSum / confCount) * 1000) / 1000
    : 0;

  return res.status(200).json({ landmarks, confidence });
}

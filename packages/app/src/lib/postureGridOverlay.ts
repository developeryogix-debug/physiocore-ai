/**
 * postureGridOverlay.ts
 * SAPO-style clinical grid overlay for all 4 posture views.
 * Evidence: Cheung et al. 2025 — lateral optimal for sagittal plane,
 * frontal optimal for symmetry. Lau & Armstrong 2011 — orthogonal views.
 */

type MPLandmark = { x: number; y: number; z: number; visibility?: number };

interface CapturedFrame {
  dataUrl: string;
  landmarks: MPLandmark[] | null;
}

export type ViewKey = 'anterior' | 'rightLateral' | 'posterior' | 'leftLateral';

// ─── Colour helpers ───────────────────────────────────────────────────────────

export function deviationColor(deg: number): string {
  return deg <= 2 ? '#00E676' : deg <= 5 ? '#FFB830' : '#FF4444';
}

// ─── Angle annotation helper ──────────────────────────────────────────────────

/**
 * Draws text with a semi-transparent dark pill background for legibility.
 * background: #00000088, padding: 2px 6px, borderRadius: 4px.
 * Font is always "bold 14px 'Space Mono', monospace".
 */
function fillTextPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  textAlign: CanvasTextAlign,
  color: string,
  fontSize = 14,
): void {
  ctx.save();
  ctx.font = `bold ${fontSize}px 'Space Mono', monospace`;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'alphabetic';
  const tw  = ctx.measureText(text).width;
  const ph  = fontSize + 4;          // pill height: font + 2px padding each side
  const pw  = tw + 12;               // pill width:  text + 6px padding each side

  let bx: number;
  if (textAlign === 'right')  bx = x - tw - 6;
  else if (textAlign === 'center') bx = x - pw / 2;
  else                        bx = x - 6;

  const by = y - fontSize;           // align box top to text top

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#00000088';
  if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: (...a: unknown[]) => void }).roundRect === 'function') {
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
      .roundRect(bx, by, pw, ph, 4);
    ctx.fill();
  } else {
    ctx.fillRect(bx, by, pw, ph);    // fallback for older browsers
  }

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.98;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ─── Confidence ───────────────────────────────────────────────────────────────

/**
 * Average visibility of key postural landmarks (0–100).
 * Key landmarks: ears (7,8), shoulders (11,12), hips (23,24),
 * knees (25,26), ankles (27,28).
 */
export function calcLandmarkConfidence(lms: MPLandmark[] | null): number {
  if (!lms) return 0;
  const indices = [7, 8, 11, 12, 23, 24, 25, 26, 27, 28];
  let sum = 0, count = 0;
  for (const i of indices) {
    const lm = lms[i];
    if (lm) { sum += (lm.visibility ?? 1); count++; }
  }
  return count === 0 ? 0 : Math.round((sum / count) * 100);
}

// ─── Frontal overlay (anterior + posterior) ───────────────────────────────────

function drawFrontalOverlay(
  ctx: CanvasRenderingContext2D,
  lms: MPLandmark[] | null,
  w: number, h: number,
  confidence = 100,
) {
  let plumbDev = 0;
  let sMidX = w / 2, hMidX = w / 2, sMidY = h * 0.3, hMidY = h * 0.6;

  if (lms) {
    const s11 = lms[11], s12 = lms[12], h23 = lms[23], h24 = lms[24];
    if (s11 && s12 && h23 && h24) {
      const sMid = (s11.x + s12.x) / 2;
      const hMid = (h23.x + h24.x) / 2;
      plumbDev = Math.round(Math.max(Math.abs(sMid - 0.5), Math.abs(hMid - 0.5)) * 30 * 10) / 10;
      sMidX = (1 - sMid) * w;  hMidX = (1 - hMid) * w;
      sMidY = ((s11.y + s12.y) / 2) * h;
      hMidY = ((h23.y + h24.y) / 2) * h;
    }
  }

  // Layer 3: vertical plumb line (true neutral reference — white)
  const plumbColor = deviationColor(plumbDev);
  ctx.save();
  ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  ctx.setLineDash([]);
  fillTextPill(ctx, `▼ ${plumbDev.toFixed(1)}°`, w / 2, 20, 'center', plumbColor);
  ctx.restore();

  if (!lms) return;

  // Spine midline (shoulder-mid → hip-mid) — deviation indicator, skip when low confidence
  if (confidence >= 75) {
    const spineOffPx = Math.abs(sMidX - hMidX);
    const spineColor = deviationColor(Math.round((spineOffPx / w) * 30 * 10) / 10);
    const dY = hMidY - sMidY;
    const dX = hMidX - sMidX;
    const slope = Math.abs(dY) > 1 ? dX / dY : 0;
    ctx.save();
    ctx.strokeStyle = spineColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(sMidX - sMidY * slope, 0);
    ctx.lineTo(sMidX + (h - sMidY) * slope, h);
    ctx.stroke();
    ctx.fillStyle = spineColor; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(sMidX, sMidY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hMidX, hMidY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // SAPO horizontal reference lines: EAR → SHOULDER → HIP → KNEE → ANKLE
  const hLines: { name: string; li: number; ri: number }[] = [
    { name: 'EAR',      li: 7,  ri: 8  },
    { name: 'SHOULDER', li: 11, ri: 12 },
    { name: 'HIP',      li: 23, ri: 24 },
    { name: 'KNEE',     li: 25, ri: 26 },
    { name: 'ANKLE',    li: 27, ri: 28 },
  ];

  for (const hl of hLines) {
    const lm = lms[hl.li], rm = lms[hl.ri];
    if (!lm || !rm) continue;
    if ((lm.visibility ?? 1) < 0.25 || (rm.visibility ?? 1) < 0.25) continue;

    const lxS = (1 - lm.x) * w, lyS = lm.y * h;
    const rxS = (1 - rm.x) * w, ryS = rm.y * h;
    const midX = (lxS + rxS) / 2, midY = (lyS + ryS) / 2;
    const dx = rxS - lxS, dy = ryS - lyS;
    const angleDeg = Math.abs(Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI);
    const color = deviationColor(angleDeg);
    const slope = Math.abs(dx) > 1 ? dy / dx : 0;

    // Layer 1: TRUE horizontal reference (faint dashed, perfectly level) — always drawn
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.globalAlpha = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (confidence >= 75) {
      // Layer 2: DEVIATION line (actual landmarks — shows tilt)
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(lxS, lyS); ctx.lineTo(rxS, ryS); ctx.stroke();

      // Teal landmark dots
      ctx.fillStyle = '#00D4AA'; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.arc(lxS, lyS, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rxS, ryS, 4, 0, Math.PI * 2); ctx.fill();

      // Label + angle
      fillTextPill(ctx, `${hl.name}  ${angleDeg.toFixed(1)}°`, w - 8, midY - 4, 'right', color);
    }
    ctx.restore();
  }

  // Head tilt — nose vs shoulder midpoint — deviation indicator, skip when low confidence
  if (confidence >= 75) {
    const nose = lms[0], ls = lms[11], rs = lms[12];
    if (nose && ls && rs
      && (nose.visibility ?? 1) > 0.3
      && (ls.visibility ?? 1) > 0.3 && (rs.visibility ?? 1) > 0.3) {
      const noseX = (1 - nose.x) * w, noseY = nose.y * h;
      const shCX = ((1 - ls.x) + (1 - rs.x)) / 2 * w;
      const shCY = (ls.y + rs.y) / 2 * h;
      const headDeg = Math.round((Math.abs(noseX - shCX) / w) * 30 * 10) / 10;
      const headColor = deviationColor(headDeg);
      ctx.save();
      ctx.strokeStyle = headColor; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(noseX, noseY); ctx.lineTo(shCX, shCY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = headColor; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(noseX, noseY, 4, 0, Math.PI * 2); ctx.fill();
      fillTextPill(ctx, `HEAD  ${headDeg.toFixed(1)}°`, 8, noseY - 4, 'left', headColor);
      ctx.restore();
    }
  }
}

// ─── Lateral overlay (right + left lateral) ───────────────────────────────────

function drawLateralOverlay(
  ctx: CanvasRenderingContext2D,
  lms: MPLandmark[] | null,
  w: number, h: number,
) {
  // Ghost ideal vertical (white dashed centre line)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "bold 9px 'Space Mono', monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.textAlign = 'center';
  ctx.fillText('IDEAL', w / 2, 14);
  ctx.restore();

  if (!lms) return;

  // Pick more visible ear side
  const rEar = lms[8], lEar = lms[7];
  const useRight = (rEar?.visibility ?? 0) >= (lEar?.visibility ?? 0);
  const ear      = useRight ? rEar      : lEar;
  const shoulder = useRight ? lms[12]   : lms[11];
  const hip      = useRight ? lms[24]   : lms[23];
  const knee     = useRight ? lms[26]   : lms[25];
  const ankle    = useRight ? lms[28]   : lms[27];

  const vis = (lm: MPLandmark | undefined) => (lm?.visibility ?? 1) > 0.2;
  const pts: { lm: MPLandmark; label: string }[] = [];
  if (ear     && vis(ear))     pts.push({ lm: ear,     label: 'EAR'     });
  if (shoulder && vis(shoulder)) pts.push({ lm: shoulder, label: 'SHOULDER' });
  if (hip     && vis(hip))     pts.push({ lm: hip,     label: 'HIP'     });
  if (knee    && vis(knee))    pts.push({ lm: knee,    label: 'KNEE'    });
  if (ankle   && vis(ankle))   pts.push({ lm: ankle,   label: 'ANKLE'   });

  if (pts.length < 2) return;

  const sx = (lm: MPLandmark) => (1 - lm.x) * w;
  const sy = (lm: MPLandmark) => lm.y * h;

  // Ideal plumb reference anchored at ankle
  const anchorPt = pts[pts.length - 1]!.lm;
  const anchorX  = sx(anchorPt);

  ctx.save();
  ctx.strokeStyle = 'rgba(0,212,170,0.35)'; ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(anchorX, 0); ctx.lineTo(anchorX, h); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Chain line ear→shoulder→hip→knee→ankle
  ctx.save();
  ctx.strokeStyle = '#00D4AA'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.85;
  ctx.beginPath();
  pts.forEach(({ lm }, i) => {
    if (i === 0) ctx.moveTo(sx(lm), sy(lm));
    else ctx.lineTo(sx(lm), sy(lm));
  });
  ctx.stroke();
  ctx.restore();

  // Dots + deviation labels
  for (const { lm, label } of pts) {
    const px = sx(lm), py = sy(lm);
    const devPx = px - anchorX;
    const devDeg = Math.round(Math.abs(devPx / h) * 30 * 10) / 10;
    const color  = deviationColor(devDeg);

    // Deviation dash to ideal plumb
    if (Math.abs(devPx) > 5) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(anchorX, py); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Dot
    ctx.save();
    ctx.fillStyle = '#00D4AA'; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Label
    const isLeft = px < w / 2;
    fillTextPill(ctx, `${label}  ${devDeg.toFixed(1)}°`, isLeft ? px + 8 : px - 8, py - 4, isLeft ? 'left' : 'right', color);
  }

  // Ear-shoulder-hip angle (ESH) — ideal ≈ 180° straight
  if (ear && vis(ear) && shoulder && vis(shoulder) && hip && vis(hip)) {
    const eX = sx(ear), eY = sy(ear);
    const sX = sx(shoulder), sY = sy(shoulder);
    const hX = sx(hip), hY = sy(hip);
    const abX = eX - sX, abY = eY - sY;
    const cbX = hX - sX, cbY = hY - sY;
    const dot = abX * cbX + abY * cbY;
    const mag = Math.sqrt((abX ** 2 + abY ** 2) * (cbX ** 2 + cbY ** 2));
    if (mag > 0) {
      const esh = Math.round(Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI * 10) / 10;
      const eshColor = esh >= 155 ? '#00E676' : esh >= 140 ? '#FFB830' : '#FF4444';
      fillTextPill(ctx, `ESH  ${esh.toFixed(1)}°`, w - 8, sY - 4, 'right', eshColor);
    }
  }

  // Hip-knee-ankle angle
  if (hip && vis(hip) && knee && vis(knee) && ankle && vis(ankle)) {
    const hX = sx(hip), hY = sy(hip);
    const kX = sx(knee), kY = sy(knee);
    const aX = sx(ankle), aY = sy(ankle);
    const abX = hX - kX, abY = hY - kY;
    const cbX = aX - kX, cbY = aY - kY;
    const dot = abX * cbX + abY * cbY;
    const mag = Math.sqrt((abX ** 2 + abY ** 2) * (cbX ** 2 + cbY ** 2));
    if (mag > 0) {
      const hka = Math.round(Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI * 10) / 10;
      const hkaColor = hka >= 170 ? '#00E676' : hka >= 155 ? '#FFB830' : '#FF4444';
      fillTextPill(ctx, `HKA  ${hka.toFixed(1)}°`, w - 8, kY - 4, 'right', hkaColor);
    }
  }
}

// ─── Ideal comparison ghost ───────────────────────────────────────────────────

/**
 * Draws the user's landmark chain + a ghost ideal silhouette overlay.
 * Ideal = all horizontal-plane landmarks perfectly level and centred.
 */
export function drawIdealComparison(
  canvas: HTMLCanvasElement,
  frame: CapturedFrame,
  viewKey: ViewKey,
) {
  const img = new Image();
  img.onload = () => {
    const w = img.width, h = img.height;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw dimmed user image
    ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.globalAlpha = 0.5; ctx.drawImage(img, 0, 0);
    ctx.restore();

    const lms = frame.landmarks;
    const isLateral = viewKey === 'rightLateral' || viewKey === 'leftLateral';

    if (!lms) {
      isLateral ? drawLateralOverlay(ctx, null, w, h)
                : drawFrontalOverlay(ctx, null, w, h);
      return;
    }

    if (isLateral) {
      // Ideal ghost: vertical line from ear-level to ankle-level at anchor x
      const rEar = lms[8], lEar = lms[7];
      const useRight = (rEar?.visibility ?? 0) >= (lEar?.visibility ?? 0);
      const ear    = useRight ? rEar    : lEar;
      const ankle  = useRight ? lms[28] : lms[27];
      if (ear && ankle && (ankle.visibility ?? 1) > 0.2) {
        const ankleX = (1 - ankle.x) * w;
        const earY   = ear.y * h;
        const ankY   = ankle.y * h;
        // Ideal ghost — teal translucent vertical bar
        ctx.save();
        ctx.strokeStyle = 'rgba(0,212,170,0.5)'; ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(ankleX, earY); ctx.lineTo(ankleX, ankY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "bold 9px 'Space Mono', monospace";
        ctx.fillStyle = 'rgba(0,212,170,0.7)'; ctx.textAlign = 'left';
        ctx.fillText('IDEAL', ankleX + 6, earY + 14);
        ctx.restore();
      }
      drawLateralOverlay(ctx, lms, w, h);
    } else {
      // Ideal ghost: perfectly horizontal lines at each pair's avg y, centred at x=0.5
      const pairs: [number, number][] = [[7, 8], [11, 12], [23, 24], [25, 26], [27, 28]];
      for (const [li, ri] of pairs) {
        const lm = lms[li], rm = lms[ri];
        if (!lm || !rm || (lm.visibility ?? 1) < 0.25 || (rm.visibility ?? 1) < 0.25) continue;
        const avgY = ((lm.y + rm.y) / 2) * h;
        const halfW = Math.abs(((1 - lm.x) - (1 - rm.x)) / 2) * w;
        // Ideal ghost line — perfectly centred and horizontal
        ctx.save();
        ctx.strokeStyle = 'rgba(0,212,170,0.4)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(w / 2 - halfW, avgY);
        ctx.lineTo(w / 2 + halfW, avgY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      drawFrontalOverlay(ctx, lms, w, h, calcLandmarkConfidence(lms));
    }
  };
  img.src = frame.dataUrl;
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export function drawGridOverlay(
  canvas: HTMLCanvasElement,
  frame: CapturedFrame,
  viewKey: ViewKey,
) {
  const img = new Image();
  img.onload = () => {
    const w = img.width, h = img.height;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0); ctx.restore();

    const isLateral = viewKey === 'rightLateral' || viewKey === 'leftLateral';
    if (isLateral) drawLateralOverlay(ctx, frame.landmarks, w, h);
    else           drawFrontalOverlay(ctx, frame.landmarks, w, h, calcLandmarkConfidence(frame.landmarks));
  };
  img.src = frame.dataUrl;
}

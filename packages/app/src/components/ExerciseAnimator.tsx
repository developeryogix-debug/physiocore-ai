// ExerciseAnimator.tsx — Kaia-style live exercise animation guide
// Phase 2.5 F5. Pure SVG + requestAnimationFrame — zero external deps.
// Shows: animated stick figure cycling through ideal rep + goniometer arc
// showing user's live angle vs target zone. Clinical Noir palette.
// Constitutional: font-weight ≤600, no "use client", no WASM, SPA only.

import { useEffect, useRef, useState } from 'react';

// ── Point type ────────────────────────────────────────────────────────────────
type P = [number, number];

// ── Stick figure joint set (viewBox 0 0 80 140) ───────────────────────────────
interface StickPose {
  head: P; neck: P;
  lSho: P; rSho: P;
  lElb: P; rElb: P;
  lWri: P; rWri: P;
  mHip: P; lHip: P; rHip: P;
  lKne: P; rKne: P;
  lAnk: P; rAnk: P;
}

// ── Neutral standing (t = 0 for all exercises) ────────────────────────────────
const STAND: StickPose = {
  head: [40, 9],  neck: [40, 18],
  lSho: [28, 26], rSho: [52, 26],
  lElb: [22, 44], rElb: [58, 44],
  lWri: [18, 60], rWri: [62, 60],
  mHip: [40, 68], lHip: [34, 68], rHip: [46, 68],
  lKne: [34, 97], rKne: [46, 97],
  lAnk: [34, 127], rAnk: [46, 127],
};

// ── Per-exercise key action pose (t = 1) ──────────────────────────────────────
// Covers 8 gym exercises. Yoga/pilates return null — handled by Session.tsx.
const POSES: Partial<Record<string, StickPose>> = {
  squat: {
    head: [40, 46], neck: [40, 55],
    lSho: [28, 63], rSho: [52, 63],
    lElb: [18, 76], rElb: [62, 76],  // arms forward for balance
    lWri: [10, 89], rWri: [70, 89],
    mHip: [40, 88], lHip: [34, 88], rHip: [46, 88],
    lKne: [20, 112], rKne: [60, 112], // knees track over toes
    lAnk: [30, 127], rAnk: [50, 127],
  },
  deadlift: {
    head: [26, 24], neck: [28, 32],
    lSho: [16, 40], rSho: [42, 40],  // torso ~45° forward
    lElb: [14, 58], rElb: [40, 60],  // arms hanging
    lWri: [13, 76], rWri: [39, 78],
    mHip: [40, 68], lHip: [34, 68], rHip: [46, 68],
    lKne: [34, 95], rKne: [46, 95],  // soft knee
    lAnk: [34, 127], rAnk: [46, 127],
  },
  pushup: {
    head: [40, 9],  neck: [40, 18],
    lSho: [28, 26], rSho: [52, 26],
    lElb: [19, 36], rElb: [61, 36],  // elbows bent ~90°
    lWri: [13, 42], rWri: [67, 42],  // hands at chest level
    mHip: [40, 68], lHip: [34, 68], rHip: [46, 68],
    lKne: [34, 97], rKne: [46, 97],
    lAnk: [34, 127], rAnk: [46, 127],
  },
  lunge: {
    head: [40, 24], neck: [40, 33],
    lSho: [28, 41], rSho: [52, 41],
    lElb: [22, 57], rElb: [58, 57],
    lWri: [18, 71], rWri: [62, 71],
    mHip: [40, 76], lHip: [34, 76], rHip: [46, 76],
    lKne: [20, 104], rKne: [58, 100], // front + back knee
    lAnk: [14, 127], rAnk: [60, 127],
  },
  shoulder_press: {
    head: [40, 9],  neck: [40, 18],
    lSho: [28, 26], rSho: [52, 26],
    lElb: [22, 16], rElb: [58, 16],  // elbows up, arms rising
    lWri: [22, 5],  rWri: [58, 5],   // fully overhead
    mHip: [40, 68], lHip: [34, 68], rHip: [46, 68],
    lKne: [34, 97], rKne: [46, 97],
    lAnk: [34, 127], rAnk: [46, 127],
  },
  hip_thrust: {
    head: [40, 9],  neck: [40, 18],
    lSho: [28, 26], rSho: [52, 26],
    lElb: [22, 44], rElb: [58, 44],
    lWri: [18, 60], rWri: [62, 60],
    mHip: [40, 56], lHip: [34, 56], rHip: [46, 56], // hips thrust up
    lKne: [26, 84], rKne: [54, 84],  // knees bent ~90°
    lAnk: [24, 112], rAnk: [56, 112],
  },
  glute_bridge: {
    head: [40, 9],  neck: [40, 18],
    lSho: [28, 26], rSho: [52, 26],
    lElb: [22, 44], rElb: [58, 44],
    lWri: [18, 60], rWri: [62, 60],
    mHip: [40, 52], lHip: [34, 52], rHip: [46, 52], // higher than hip_thrust
    lKne: [24, 80], rKne: [56, 80],
    lAnk: [22, 108], rAnk: [58, 108],
  },
  bent_over_row: {
    head: [26, 24], neck: [28, 32],
    lSho: [16, 40], rSho: [42, 40],  // torso forward
    lElb: [8,  44], rElb: [52, 44],  // elbows pulled back behind torso
    lWri: [10, 52], rWri: [48, 52],
    mHip: [40, 68], lHip: [34, 68], rHip: [46, 68],
    lKne: [34, 95], rKne: [46, 95],
    lAnk: [34, 127], rAnk: [46, 127],
  },
};

// ── Lerp utilities ────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function lerpP(a: P, b: P, t: number): P {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
function lerpPose(from: StickPose, to: StickPose, t: number): StickPose {
  const lp = (a: P, b: P) => lerpP(a, b, t);
  return {
    head: lp(from.head, to.head), neck: lp(from.neck, to.neck),
    lSho: lp(from.lSho, to.lSho), rSho: lp(from.rSho, to.rSho),
    lElb: lp(from.lElb, to.lElb), rElb: lp(from.rElb, to.rElb),
    lWri: lp(from.lWri, to.lWri), rWri: lp(from.rWri, to.rWri),
    mHip: lp(from.mHip, to.mHip), lHip: lp(from.lHip, to.lHip), rHip: lp(from.rHip, to.rHip),
    lKne: lp(from.lKne, to.lKne), rKne: lp(from.rKne, to.rKne),
    lAnk: lp(from.lAnk, to.lAnk), rAnk: lp(from.rAnk, to.rAnk),
  };
}

// ── Stick figure renderer ─────────────────────────────────────────────────────
function Stickman({ pose: p, color, opacity = 1 }: { pose: StickPose; color: string; opacity?: number }) {
  const ln = (a: P, b: P, w = 2.4) => (
    <line key={`${a}-${b}`}
      x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
      stroke={color} strokeWidth={w} strokeLinecap="round" opacity={opacity} />
  );
  return (
    <g>
      {/* Head */}
      <circle cx={p.head[0]} cy={p.head[1]} r={7.5}
        fill="none" stroke={color} strokeWidth={2} opacity={opacity} />
      {/* Spine */}
      {ln(p.neck, p.mHip, 2.2)}
      {/* Clavicles */}
      {ln(p.neck, p.lSho)} {ln(p.neck, p.rSho)}
      {/* Arms */}
      {ln(p.lSho, p.lElb)} {ln(p.lElb, p.lWri)}
      {ln(p.rSho, p.rElb)} {ln(p.rElb, p.rWri)}
      {/* Hip bar */}
      {ln(p.lHip, p.rHip, 2)}
      {/* Legs */}
      {ln(p.lHip, p.lKne)} {ln(p.lKne, p.lAnk)}
      {ln(p.rHip, p.rKne)} {ln(p.rKne, p.rAnk)}
      {/* Feet */}
      {ln(p.lAnk, [p.lAnk[0] - 6, p.lAnk[1]], 1.8)}
      {ln(p.rAnk, [p.rAnk[0] + 6, p.rAnk[1]], 1.8)}
      {/* Joint dots on key joints */}
      {[p.lKne, p.rKne, p.lElb, p.rElb, p.mHip].map((pt, i) => (
        <circle key={i} cx={pt[0]} cy={pt[1]} r={2.2}
          fill={color} opacity={opacity * 0.8} />
      ))}
    </g>
  );
}

// ── Goniometer arc (viewBox 0 0 80 56) ───────────────────────────────────────
function arcPt(deg: number, cx = 40, cy = 46, r = 34): P {
  // 0° = left end of semicircle, 180° = right end, peak at 90° (top)
  const rad = (deg / 180) * Math.PI;
  return [cx - r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function ArcGoniometer({
  targetRange, current, ideal, inRange,
}: {
  targetRange: [number, number];
  current: number | null;
  ideal: number;
  inRange: boolean;
}) {
  const [lo, hi] = targetRange;
  const start = arcPt(lo);
  const end   = arcPt(hi);
  const idealPt = arcPt(ideal);
  const currentPt = current !== null ? arcPt(current) : null;
  const largeArc = (hi - lo) > 90 ? 1 : 0;
  const userColor = inRange ? '#00E676' : '#FF4444';

  return (
    <svg viewBox="0 0 80 56" width="100%" style={{ marginTop: 2, display: 'block' }}>
      {/* Background semicircle */}
      <path
        d="M 6,46 A 34,34 0 0 1 74,46"
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} strokeLinecap="round"
      />
      {/* Target zone */}
      <path
        d={`M ${start[0].toFixed(1)},${start[1].toFixed(1)} A 34,34 0 ${largeArc} 1 ${end[0].toFixed(1)},${end[1].toFixed(1)}`}
        fill="none" stroke="rgba(0,212,170,0.35)" strokeWidth={7} strokeLinecap="round"
      />
      {/* Ideal angle arm */}
      <line x1={40} y1={46} x2={idealPt[0].toFixed(1)} y2={idealPt[1].toFixed(1)}
        stroke="#00D4AA" strokeWidth={2.2} strokeLinecap="round" opacity={0.85} />
      <circle cx={idealPt[0]} cy={idealPt[1]} r={3.5} fill="#00D4AA" opacity={0.9} />

      {/* User's live angle arm */}
      {currentPt && (
        <>
          <line x1={40} y1={46} x2={currentPt[0].toFixed(1)} y2={currentPt[1].toFixed(1)}
            stroke={userColor} strokeWidth={3} strokeLinecap="round" />
          <circle cx={currentPt[0]} cy={currentPt[1]} r={4} fill={userColor} />
        </>
      )}

      {/* Pivot dot */}
      <circle cx={40} cy={46} r={2.5} fill="rgba(255,255,255,0.25)" />

      {/* Angle labels */}
      <text x={6}  y={54} fontSize={7} fill="rgba(255,255,255,0.25)" textAnchor="middle">0°</text>
      <text x={40} y={10} fontSize={7} fill="rgba(255,255,255,0.25)" textAnchor="middle">90°</text>
      <text x={74} y={54} fontSize={7} fill="rgba(255,255,255,0.25)" textAnchor="middle">180°</text>

      {/* Range label */}
      <text x={40} y={54} fontSize={7.5} fill="rgba(0,212,170,0.6)" textAnchor="middle">
        {lo}°–{hi}°
      </text>
    </svg>
  );
}

// ── Public props ──────────────────────────────────────────────────────────────
export interface ExerciseAnimatorProps {
  exercise: string;
  currentAngle: number | null;
  targetRange: [number, number];
  inRange: boolean;
  isRunning: boolean;
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ExerciseAnimator({
  exercise, currentAngle, targetRange, inRange, isRunning,
}: ExerciseAnimatorProps) {
  const [t, setT] = useState(0);
  const rafRef = useRef(0);
  const CYCLE_MS = 3200; // one rep cycle

  useEffect(() => {
    if (!isRunning) { setT(0); return; }
    const origin = performance.now();
    const tick = (now: number) => {
      const phase = ((now - origin) % (CYCLE_MS * 2)) / (CYCLE_MS * 2);
      // Smooth cosine easing: 0 → 1 → 0
      setT(0.5 - 0.5 * Math.cos(phase * 2 * Math.PI));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning]);

  const bottomPose = POSES[exercise];
  if (!bottomPose) return null; // yoga / pilates — no stick figure for those

  const pose = lerpPose(STAND, bottomPose, t);
  const midTarget = (targetRange[0] + targetRange[1]) / 2;
  const idealAngle = lerp(170, midTarget, t);
  const accentColor = inRange ? '#00D4AA' : '#4DB8FF';

  // Human-readable exercise name
  const exLabel = exercise.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${inRange ? 'rgba(0,212,170,0.35)' : 'var(--border-subtle)'}`,
      borderRadius: 14,
      padding: '12px 10px 10px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      transition: 'border-color 0.4s',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: '0.6rem',
        letterSpacing: '0.1em',
        color: accentColor,
        textTransform: 'uppercase',
        marginBottom: 8,
        alignSelf: 'flex-start',
      }}>
        IDEAL FORM · {exLabel}
      </div>

      {/* Stick figure SVG */}
      <svg
        viewBox="0 0 80 140"
        width={148}
        height={258}
        aria-label={`Animated ${exLabel} exercise guide`}
        style={{ overflow: 'visible' }}
      >
        {/* Ghost: neutral standing pose */}
        <Stickman pose={STAND}  color="rgba(255,255,255,0.07)" opacity={1} />
        {/* Animated: current rep position */}
        <Stickman pose={pose}   color={accentColor} opacity={0.92} />
      </svg>

      {/* Goniometer arc */}
      <ArcGoniometer
        targetRange={targetRange}
        current={currentAngle}
        ideal={idealAngle}
        inRange={inRange}
      />

      {/* Live angle readout */}
      <div style={{
        marginTop: 8,
        fontFamily: "'Space Mono', monospace",
        fontSize: '0.7rem',
        textAlign: 'center',
        color: currentAngle !== null
          ? (inRange ? '#00E676' : '#FF4444')
          : 'rgba(255,255,255,0.3)',
        letterSpacing: '0.06em',
      }}>
        {currentAngle !== null ? `${Math.round(currentAngle)}° ` : '— '}
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>
          · target {targetRange[0]}°–{targetRange[1]}°
        </span>
      </div>

      {/* In-range badge */}
      <div style={{
        marginTop: 6,
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: '0.65rem',
        fontFamily: "'Space Mono', monospace",
        fontWeight: 600,
        letterSpacing: '0.08em',
        background: inRange ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.04)',
        color: inRange ? '#00E676' : 'rgba(255,255,255,0.25)',
        border: `1px solid ${inRange ? 'rgba(0,230,118,0.25)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.3s',
      }}>
        {inRange ? '✓ IN RANGE' : currentAngle !== null ? 'ADJUST DEPTH' : 'DETECTING'}
      </div>
    </div>
  );
}

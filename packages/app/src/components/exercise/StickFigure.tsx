// StickFigure.tsx — SVG stick figure renderer (returns <g>, parent owns <svg>)
// Phase 2.5 F5. Constitutional: no "use client", font-weight ≤600.

import type { StickPose } from '../../lib/exercisePoses.js';

interface StickFigureProps {
  pose: StickPose;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
}

const JOINT_DOT_RADIUS = 1.8;
const JOINT_DOTS: Array<keyof StickPose> = ['lElb', 'rElb', 'lKne', 'rKne'];
const HEAD_RADIUS = 6.5;
const JOINT_COLOR = 'rgba(255,255,255,0.55)';

export function StickFigure({
  pose,
  color = '#00D4AA',
  opacity = 1,
  strokeWidth = 2.2,
}: StickFigureProps) {
  const p = pose;
  const sw = strokeWidth;
  const commonProps = {
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <g opacity={opacity}>
      {/* Head */}
      <circle cx={p.head.x} cy={p.head.y} r={HEAD_RADIUS} fill="none" stroke={color} strokeWidth={sw} />

      {/* Neck → shoulder midpoint → spine → hip */}
      <line x1={p.neck.x} y1={p.neck.y} x2={p.lSho.x} y2={p.lSho.y} {...commonProps} />
      <line x1={p.neck.x} y1={p.neck.y} x2={p.rSho.x} y2={p.rSho.y} {...commonProps} />

      {/* Spine: neck → mHip */}
      <line x1={p.neck.x} y1={p.neck.y} x2={p.mHip.x} y2={p.mHip.y} {...commonProps} />

      {/* Pelvis: lHip ↔ rHip */}
      <line x1={p.lHip.x} y1={p.lHip.y} x2={p.rHip.x} y2={p.rHip.y} {...commonProps} />

      {/* Left arm */}
      <line x1={p.lSho.x} y1={p.lSho.y} x2={p.lElb.x} y2={p.lElb.y} {...commonProps} />
      <line x1={p.lElb.x} y1={p.lElb.y} x2={p.lWri.x} y2={p.lWri.y} {...commonProps} />

      {/* Right arm */}
      <line x1={p.rSho.x} y1={p.rSho.y} x2={p.rElb.x} y2={p.rElb.y} {...commonProps} />
      <line x1={p.rElb.x} y1={p.rElb.y} x2={p.rWri.x} y2={p.rWri.y} {...commonProps} />

      {/* Left leg */}
      <line x1={p.lHip.x} y1={p.lHip.y} x2={p.lKne.x} y2={p.lKne.y} {...commonProps} />
      <line x1={p.lKne.x} y1={p.lKne.y} x2={p.lAnk.x} y2={p.lAnk.y} {...commonProps} />

      {/* Right leg */}
      <line x1={p.rHip.x} y1={p.rHip.y} x2={p.rKne.x} y2={p.rKne.y} {...commonProps} />
      <line x1={p.rKne.x} y1={p.rKne.y} x2={p.rAnk.x} y2={p.rAnk.y} {...commonProps} />

      {/* Joint dots at elbows + knees */}
      {JOINT_DOTS.map(j => (
        <circle
          key={j}
          cx={p[j].x}
          cy={p[j].y}
          r={JOINT_DOT_RADIUS}
          fill={JOINT_COLOR}
          stroke="none"
        />
      ))}
    </g>
  );
}

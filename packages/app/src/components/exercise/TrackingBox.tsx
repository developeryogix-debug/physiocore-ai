// TrackingBox.tsx — Bounding box overlay on stick figure's primary joints
// Phase 2.5 F5. Constitutional: no "use client".

import type { StickPose } from '../../lib/exercisePoses.js';

interface TrackingBoxProps {
  pose: StickPose;
  primaryJoints: Array<keyof StickPose>;
  formOk: boolean;
  flash: boolean;
  padding?: number;
}

const CORNER_SIZE = 8;
const GOOD_COLOR = '#00D4AA';
const BAD_COLOR = '#FF4444';

export function TrackingBox({
  pose,
  primaryJoints,
  formOk,
  flash,
  padding = 16,
}: TrackingBoxProps) {
  if (primaryJoints.length === 0) return null;

  const xs = primaryJoints.map(j => pose[j].x);
  const ys = primaryJoints.map(j => pose[j].y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;
  const w = maxX - minX;
  const h = maxY - minY;
  const color = formOk ? GOOD_COLOR : BAD_COLOR;
  const cs = CORNER_SIZE;

  return (
    <g opacity={flash ? 0.5 : 1}>
      {/* Main bounding rect */}
      <rect
        x={minX} y={minY} width={w} height={h}
        fill="none"
        stroke={color}
        strokeWidth={formOk ? 0.8 : 1}
        strokeDasharray={formOk ? undefined : '3 2'}
        opacity={0.55}
      />

      {/* Corner L-brackets */}
      {/* Top-left */}
      <polyline
        points={`${minX},${minY + cs} ${minX},${minY} ${minX + cs},${minY}`}
        fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
      {/* Top-right */}
      <polyline
        points={`${maxX - cs},${minY} ${maxX},${minY} ${maxX},${minY + cs}`}
        fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
      {/* Bottom-left */}
      <polyline
        points={`${minX},${maxY - cs} ${minX},${maxY} ${minX + cs},${maxY}`}
        fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
      {/* Bottom-right */}
      <polyline
        points={`${maxX - cs},${maxY} ${maxX},${maxY} ${maxX},${maxY - cs}`}
        fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
    </g>
  );
}

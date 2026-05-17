/**
 * ScoreRing.tsx — Animated SVG arc showing recovery score 0–100.
 * Colour: teal (≥75), amber (50–74), red (<50).
 * Clinical Noir design system. Font weight max 600.
 * Score is deterministic — no LLM. Insight text shown below ring.
 */
import { useState, useEffect } from 'react';

interface ScoreRingProps {
  score: number;          // 0–100
  delta?: number;         // change vs previous (can be negative)
  insight?: string;       // Haiku-generated motivational text
  size?: number;          // SVG canvas size (default 160)
}

function scoreColor(s: number): string {
  if (s >= 75) return '#00D4AA';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}

export function ScoreRing({ score, delta, insight, size = 160 }: ScoreRingProps) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnim(score), 100);
    return () => clearTimeout(t);
  }, [score]);

  const cx = size / 2;
  const r  = cx - 14;
  const circ = 2 * Math.PI * r;
  const arc  = circ * 0.75;   // 270° sweep
  const fill = arc * (anim / 100);
  const color = scoreColor(score);

  const deltaPositive = delta != null && delta > 0;
  const deltaZero     = delta != null && delta === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={10}
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cx})`}
        />
        {/* Fill */}
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cx})`}
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color}44)` }}
        />
        {/* Score number */}
        <text
          x={cx} y={cx - 4}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.22}
          fontWeight={600}
          fontFamily="'Space Mono', monospace"
        >
          {Math.round(anim)}
        </text>
        {/* Label */}
        <text
          x={cx} y={cx + size * 0.14}
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize={size * 0.065}
          fontFamily="'Space Mono', monospace"
          letterSpacing="0.06em"
        >
          RECOVERY
        </text>
      </svg>

      {/* Delta badge */}
      {delta != null && !deltaZero && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: '0.72rem', fontFamily: "'Space Mono', monospace",
          color: deltaPositive ? '#00D4AA' : '#ef4444',
          background: deltaPositive ? 'rgba(0,212,170,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${deltaPositive ? 'rgba(0,212,170,0.2)' : 'rgba(239,68,68,0.2)'}`,
          borderRadius: 99, padding: '3px 10px',
        }}>
          {deltaPositive ? '↗' : '↘'} {Math.abs(delta)} pts this week
        </div>
      )}
      {delta === 0 && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace" }}>
          — holding steady
        </div>
      )}

      {/* Insight text — Haiku generated, motivational only */}
      {insight && (
        <p style={{
          fontSize: '0.78rem', color: 'var(--text-secondary)',
          textAlign: 'center', lineHeight: 1.6, maxWidth: 200,
          fontStyle: 'italic', margin: 0,
        }}>
          {insight}
        </p>
      )}
    </div>
  );
}

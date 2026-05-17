// RepDots.tsx — Row of rep-completion dots with quality colouring
// Phase 2.5 F5. Constitutional: no "use client", font-weight ≤600.

interface RepDotsProps {
  totalReps: number;
  completedReps: number;
  qualities: number[];   // 0-100 per completed rep
  currentRep: number;    // index of in-progress rep (0-based)
}

const DOT_R = 5;
const DOT_GAP = 14;
const WRAP_AT = 10;

function qualityColor(q: number): string {
  if (q >= 80) return '#00E676';
  if (q >= 60) return '#FFB830';
  return '#FF4444';
}

export function RepDots({ totalReps, completedReps, qualities, currentRep }: RepDotsProps) {
  const rows = Math.ceil(totalReps / WRAP_AT);
  const svgW = Math.min(totalReps, WRAP_AT) * DOT_GAP + 4;
  const svgH = rows * DOT_GAP + 4;

  return (
    <>
      <style>{`
        @keyframes teal-pulse {
          0%,100% { opacity:1; r:${DOT_R}px; }
          50% { opacity:0.65; r:${DOT_R + 2}px; }
        }
        .rep-dot-current { animation: teal-pulse 1s ease-in-out infinite; }
      `}</style>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={svgW}
        height={svgH}
        style={{ overflow: 'visible' }}
      >
        {Array.from({ length: totalReps }, (_, i) => {
          const row = Math.floor(i / WRAP_AT);
          const col = i % WRAP_AT;
          const cx = col * DOT_GAP + DOT_R + 2;
          const cy = row * DOT_GAP + DOT_R + 2;
          const isCurrent = i === currentRep;
          const isDone = i < completedReps;
          const quality = qualities[i] ?? 0;

          if (isCurrent) {
            return (
              <circle
                key={i}
                className="rep-dot-current"
                cx={cx} cy={cy} r={DOT_R}
                fill="#00D4AA"
                stroke="none"
              />
            );
          }
          if (isDone) {
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={DOT_R}
                fill={qualityColor(quality)}
                stroke="none"
                opacity={0.85}
              />
            );
          }
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={DOT_R}
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
            />
          );
        })}
      </svg>
    </>
  );
}

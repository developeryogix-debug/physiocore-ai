// FaceIcon.tsx — NPRS 0-10 emoji-style SVG faces for PainCheckIn
// Constitutional: Clinical Noir, font-weight ≤600, no hardcoded colors except brand palette

export interface FaceIconProps {
  score: number;    // 0–10
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  label?: boolean;
}

function scoreColor(s: number): string {
  if (s <= 2) return '#00D4AA';   // teal-500
  if (s <= 4) return '#22c55e';   // green
  if (s <= 6) return '#FFB830';   // amber
  if (s <= 8) return '#f97316';   // orange
  return '#FF4444';               // danger
}

function scoreBg(s: number): string {
  if (s <= 2) return 'rgba(0,212,170,0.12)';
  if (s <= 4) return 'rgba(34,197,94,0.12)';
  if (s <= 6) return 'rgba(255,184,48,0.12)';
  if (s <= 8) return 'rgba(249,115,22,0.12)';
  return 'rgba(255,68,68,0.12)';
}

// Mouth: smile→neutral→frown as score rises
function mouthD(s: number): string {
  if (s <= 1) return 'M 10,21 Q 18,28 26,21';  // big smile
  if (s <= 3) return 'M 11,22 Q 18,26 25,22';  // gentle smile
  if (s <= 5) return 'M 11,23 L 25,23';          // flat / neutral
  if (s <= 7) return 'M 11,24 Q 18,20 25,24';  // frown
  return      'M 10,25 Q 18,19 26,25';           // deep frown
}

export function FaceIcon({ score, size = 40, selected = false, onClick, label = false }: FaceIconProps) {
  const c = scoreColor(score);
  const bg = selected ? scoreBg(score) : 'transparent';
  const borderColor = selected ? c : 'rgba(255,255,255,0.08)';
  const eyeR = score >= 9 ? 1 : 1.8;
  const isTearful = score >= 7;
  const isXEyes  = score >= 9;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={`Pain score ${score}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        style={{
          borderRadius: '50%',
          background: bg,
          border: `2px solid ${borderColor}`,
          transition: 'all 0.15s ease',
          transform: selected ? 'scale(1.12)' : 'scale(1)',
          display: 'block',
        }}
      >
        {/* Face circle */}
        <circle cx={18} cy={18} r={15} fill="none" stroke={c} strokeWidth={1.5} opacity={0.85} />

        {/* Eyes */}
        {isXEyes ? (
          <>
            {/* X eyes for score 9-10 */}
            <line x1={10} y1={12} x2={14} y2={16} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
            <line x1={14} y1={12} x2={10} y2={16} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
            <line x1={22} y1={12} x2={26} y2={16} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
            <line x1={26} y1={12} x2={22} y2={16} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx={12} cy={13} r={eyeR} fill={c} />
            <circle cx={24} cy={13} r={eyeR} fill={c} />
            {/* Furrowed brow for scores 6+ */}
            {score >= 6 && (
              <>
                <path d="M 9,10 L 14,11.5" stroke={c} strokeWidth={1.2} strokeLinecap="round" />
                <path d="M 27,10 L 22,11.5" stroke={c} strokeWidth={1.2} strokeLinecap="round" />
              </>
            )}
            {/* Tears for 7+ */}
            {isTearful && (
              <>
                <ellipse cx={11} cy={17} rx={1.2} ry={2.2} fill={c} opacity={0.45} />
                <ellipse cx={25} cy={17} rx={1.2} ry={2.2} fill={c} opacity={0.45} />
              </>
            )}
          </>
        )}

        {/* Mouth */}
        <path d={mouthD(score)} stroke={c} strokeWidth={1.5} fill="none" strokeLinecap="round" />

        {/* Sweat drop (score 7-8) */}
        {score >= 7 && score < 9 && (
          <ellipse cx={29} cy={9} rx={1.3} ry={2.0} fill={c} opacity={0.4} />
        )}
      </svg>

      {label && (
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: '0.65rem',
          color: selected ? c : 'rgba(255,255,255,0.3)',
          letterSpacing: '0.04em',
          lineHeight: 1,
          transition: 'color 0.15s',
        }}>
          {score}
        </span>
      )}
    </div>
  );
}

// Convenience: score label text
export function scoreLabel(s: number): string {
  if (s === 0) return 'No pain';
  if (s <= 2) return 'Minimal';
  if (s <= 4) return 'Mild';
  if (s <= 6) return 'Moderate';
  if (s <= 8) return 'Severe';
  return 'Worst imaginable';
}

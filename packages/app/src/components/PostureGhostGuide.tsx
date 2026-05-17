// PostureGhostGuide.tsx — Translucent body alignment overlay for posture capture
// Shows during capturing phase before countdown starts.
// Constitutional: pointer-events none, no layout impact, PDPA compliant microcopy.

import { useEffect, useState } from 'react';

type ViewKey = 'anterior' | 'rightLateral' | 'posterior' | 'leftLateral';

interface PostureGhostGuideProps {
  viewKey: ViewKey;
  visible: boolean;
  color?: string;
}

// ── Body silhouette paths (36×100 normalised viewbox) ───────────────────────
// Front + back: symmetric silhouette
const FRONT_BODY = `
  M 50,8
  C 44,8 38,14 38,20
  L 36,28 C 34,30 32,32 30,34
  L 26,36 C 24,36 22,38 22,40
  L 22,50 C 22,52 24,54 26,54
  L 30,54 L 30,70 L 28,90
  L 32,90 L 34,72 L 36,90
  L 40,90 L 38,70 L 38,54
  L 44,54 L 44,70 L 42,90
  L 46,90 L 48,72 L 50,90
  L 54,90 L 52,70 L 52,54
  L 58,54 L 60,70 L 58,90
  L 62,90 L 60,72 L 60,54
  L 66,54 L 70,54
  C 72,54 74,52 74,50
  L 74,40 C 74,38 72,36 70,36
  L 66,34 C 64,32 62,30 60,28
  L 58,20 C 58,14 56,8 50,8
  Z
`;

// Side silhouette: subtle head+torso+leg profile
const SIDE_BODY = `
  M 50,8
  C 47,8 44,11 43,14
  L 42,22 C 38,28 36,32 35,38
  L 34,48 C 34,52 36,54 38,54
  L 40,54 L 40,72 L 38,90
  L 44,90 L 45,72 L 46,54
  L 52,54 L 52,72 L 50,90
  L 56,90 L 57,72 L 58,54
  L 62,54
  C 64,54 66,52 66,48
  L 66,38 C 65,32 64,28 62,24
  L 60,14 C 58,10 54,8 50,8
  Z
`;

const PATHS: Record<ViewKey, { d: string; instruction: string }> = {
  anterior:     { d: FRONT_BODY, instruction: 'Face the camera\nFeet shoulder-width apart\nArms relaxed at your sides' },
  rightLateral: { d: SIDE_BODY,  instruction: 'Turn to your LEFT\nProfile to camera\nLook straight ahead' },
  posterior:    { d: FRONT_BODY, instruction: 'Face AWAY from camera\nFeet shoulder-width apart\nStand tall' },
  leftLateral:  { d: SIDE_BODY,  instruction: 'Turn to your RIGHT\nProfile to camera\nLook straight ahead' },
};

// ── Breathing pulse animation (CSS keyframes via style tag) ──────────────────
const PULSE_STYLE = `
@keyframes ghost-pulse {
  0%, 100% { opacity: 0.18; transform: scale(1); }
  50%       { opacity: 0.28; transform: scale(1.015); }
}
@keyframes ghost-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;

export function PostureGhostGuide({ viewKey, visible, color = '#00D4AA' }: PostureGhostGuideProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      // small delay so it doesn't flash on countdown transitions
      const t = setTimeout(() => setMounted(true), 200);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
    }
  }, [visible]);

  if (!mounted) return null;

  const { d, instruction } = PATHS[viewKey] ?? PATHS.anterior;

  return (
    <>
      <style>{PULSE_STYLE}</style>

      {/* Ghost silhouette layer — pointer-events none, purely visual */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 6,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'ghost-fade-in 0.4s ease',
        }}
      >
        {/* Body outline SVG */}
        <svg
          viewBox="20 0 60 100"
          width="min(28vw, 180px)"
          height="min(50vh, 320px)"
          style={{
            animation: 'ghost-pulse 2.8s ease-in-out infinite',
            filter: `drop-shadow(0 0 20px ${color}50)`,
            transform: viewKey === 'leftLateral' ? 'scaleX(-1)' : undefined,
          }}
          aria-hidden="true"
        >
          {/* Head */}
          <circle
            cx={50} cy={8} r={7}
            fill="none"
            stroke={color}
            strokeWidth={1.2}
            opacity={0.7}
          />
          {/* Body */}
          <path
            d={d}
            fill={color}
            fillOpacity={0.06}
            stroke={color}
            strokeWidth={1.2}
            strokeOpacity={0.5}
            strokeLinejoin="round"
          />
          {/* Spine centre line (front/back only) */}
          {(viewKey === 'anterior' || viewKey === 'posterior') && (
            <line
              x1={50} y1={28} x2={50} y2={70}
              stroke={color}
              strokeWidth={0.6}
              strokeDasharray="2 3"
              opacity={0.35}
            />
          )}
          {/* Floor line */}
          <line
            x1={24} y1={91} x2={76} y2={91}
            stroke={color}
            strokeWidth={0.6}
            opacity={0.25}
          />
          {/* Shoulder width indicators (front only) */}
          {viewKey === 'anterior' && (
            <>
              <line x1={34} y1={94} x2={34} y2={98} stroke={color} strokeWidth={0.6} opacity={0.3} />
              <line x1={66} y1={94} x2={66} y2={98} stroke={color} strokeWidth={0.6} opacity={0.3} />
              <path d="M 34,96 L 50,96 L 66,96" stroke={color} strokeWidth={0.5} fill="none" opacity={0.2} />
            </>
          )}
        </svg>

        {/* Position instruction */}
        <div style={{
          marginTop: '1rem',
          textAlign: 'center',
          padding: '8px 16px',
          background: 'rgba(5,8,16,0.75)',
          backdropFilter: 'blur(8px)',
          borderRadius: '10px',
          border: `1px solid ${color}25`,
          maxWidth: 260,
        }}>
          {instruction.split('\n').map((line, i) => (
            <div key={i} style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '0.7rem',
              color: i === 0 ? color : 'rgba(255,255,255,0.5)',
              letterSpacing: '0.06em',
              lineHeight: 1.8,
              fontWeight: i === 0 ? 600 : 400,
            }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* PDPA microcopy — bottom left, always visible */}
      <div style={{
        position: 'absolute',
        bottom: '5.5rem',
        left: '1rem',
        zIndex: 11,
        pointerEvents: 'none',
        maxWidth: 260,
        padding: '5px 10px',
        background: 'rgba(5,8,16,0.65)',
        backdropFilter: 'blur(6px)',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={{
          margin: 0,
          fontFamily: "'Space Mono', monospace",
          fontSize: '0.58rem',
          color: 'rgba(255,255,255,0.3)',
          lineHeight: 1.6,
          letterSpacing: '0.03em',
        }}>
          🔒 Camera processed on-device only. No images uploaded or stored. PDPA compliant.
        </p>
      </div>
    </>
  );
}

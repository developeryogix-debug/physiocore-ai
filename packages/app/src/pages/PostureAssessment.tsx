import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewKey = 'anterior' | 'rightLateral' | 'posterior' | 'leftLateral';

interface ViewConfig {
  key: ViewKey;
  label: string;
  shortLabel: string;
  voiceCue: string;
  transitionCue: string;
  color: string;
}

type Phase = 'intro' | 'capturing' | 'review';

const VIEWS: ViewConfig[] = [
  {
    key: 'anterior',
    label: 'ANTERIOR',
    shortLabel: 'Front',
    voiceCue: 'Face the camera. Feet hip-width apart. Arms relaxed by your sides. Look straight ahead.',
    transitionCue: 'Perfect. Now turn to your right.',
    color: '#00D4AA',
  },
  {
    key: 'rightLateral',
    label: 'RIGHT LATERAL',
    shortLabel: 'Right Side',
    voiceCue: 'Turn to your right. I can see your right side. Stand tall.',
    transitionCue: 'Good. Now turn so your back faces the camera.',
    color: '#4DB8FF',
  },
  {
    key: 'posterior',
    label: 'POSTERIOR',
    shortLabel: 'Back',
    voiceCue: 'Turn so your back faces the camera. Stand naturally.',
    transitionCue: 'Well done. Now face your right. I will see your left side.',
    color: '#FFB830',
  },
  {
    key: 'leftLateral',
    label: 'LEFT LATERAL',
    shortLabel: 'Left Side',
    voiceCue: 'Turn to face your right. I can see your left side now. Stand tall.',
    transitionCue: 'All four views captured. Great work.',
    color: '#a78bfa',
  },
];

// ─── Speech helper ────────────────────────────────────────────────────────────

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92;
  u.pitch = 1;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PostureAssessment() {
  const navigate = useNavigate();

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // State
  const [phase, setPhase] = useState<Phase>('intro');
  const [viewIndex, setViewIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownStage, setCountdownStage] = useState<'green' | 'amber' | 'red' | 'hold'>('green');
  const [frames, setFrames] = useState<Partial<Record<ViewKey, string>>>({});
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCue, setShowCue] = useState(false);

  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Camera start ──────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions and refresh.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      window.speechSynthesis?.cancel();
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [stopCamera]);

  // ── Capture frame ─────────────────────────────────────────────────────────

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // ── Countdown sequence ────────────────────────────────────────────────────

  const runCountdown = useCallback((viewIdx: number) => {
    const view = VIEWS[viewIdx]!;
    setShowCue(true);
    speak(view.voiceCue);

    // After voice cue (2.5s), start countdown
    countdownTimerRef.current = setTimeout(() => {
      setShowCue(false);
      let tick = 8;
      setCountdown(tick);
      setCountdownStage('green');

      const tick$ = setInterval(() => {
        tick--;
        if (tick > 0) {
          setCountdown(tick);
          setCountdownStage(tick > 4 ? 'green' : tick > 2 ? 'amber' : 'red');
          speak(String(tick));
        } else {
          clearInterval(tick$);
          setCountdown(null);
          setCountdownStage('hold');
          speak('Hold');

          // Capture frame
          const dataUrl = captureFrame();
          if (dataUrl) {
            setFrames(prev => ({ ...prev, [view.key]: dataUrl }));
          }

          // Transition after 1.5s
          countdownTimerRef.current = setTimeout(() => {
            setCountdownStage('green');
            if (viewIdx < VIEWS.length - 1) {
              speak(view.transitionCue);
              countdownTimerRef.current = setTimeout(() => {
                setViewIndex(viewIdx + 1);
                runCountdown(viewIdx + 1);
              }, 2800);
            } else {
              speak(view.transitionCue);
              countdownTimerRef.current = setTimeout(() => {
                setPhase('review');
                stopCamera();
              }, 2000);
            }
          }, 1500);
        }
      }, 1000);
    }, 2500);
  }, [captureFrame, stopCamera]);

  // ── Start session ─────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    setPhase('capturing');
    setViewIndex(0);
    setFrames({});
    await startCamera();
    speak('Starting posture assessment. Please stand 2 to 3 metres from the camera.');
    countdownTimerRef.current = setTimeout(() => {
      runCountdown(0);
    }, 3000);
  }, [startCamera, runCountdown]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const currentView = VIEWS[viewIndex]!;

  const countdownColor =
    countdownStage === 'hold' ? '#00E676' :
    countdownStage === 'red'  ? '#FF4444' :
    countdownStage === 'amber'? '#FFB830' : '#00D4AA';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Intro
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-void)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '2rem',
        paddingTop: '100px',
      }}>
        <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: '18px', margin: '0 auto 2rem',
            background: 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(77,184,255,0.1))',
            border: '1px solid var(--border-teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
              <path d="M12 8v4m0 0-2 4m2-4 2 4M8 14l-2 4M16 14l2 4"/>
            </svg>
          </div>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Posture Assessment
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            4-view capture takes under 2 minutes. Stand 2–3 metres from camera at umbilicus height.
          </p>

          {/* Setup checklist */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '2rem',
            textAlign: 'left',
          }}>
            {[
              'Stand 2–3 metres from camera',
              'Camera at navel height',
              'Plain background, even lighting',
              'Fitted clothing — shoulders, hips, knees visible',
              'Bare feet or flat shoes',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item}</span>
              </div>
            ))}
          </div>

          {/* View sequence */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {VIEWS.map((v, i) => (
              <div key={v.key} style={{
                padding: '6px 14px', borderRadius: '20px',
                background: `rgba(${v.color === '#00D4AA' ? '0,212,170' : v.color === '#4DB8FF' ? '77,184,255' : v.color === '#FFB830' ? '255,184,48' : '167,139,250'}, 0.1)`,
                border: `1px solid ${v.color}33`,
                color: v.color, fontSize: '0.78rem', fontFamily: "'Space Mono', monospace",
              }}>
                {i + 1}. {v.shortLabel}
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={handleStart} style={{ fontSize: '1rem', padding: '0.875rem 2.5rem' }}>
            Begin Assessment
          </button>

          {cameraError && (
            <p style={{ marginTop: '1rem', color: 'var(--danger)', fontSize: '0.875rem' }}>{cameraError}</p>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Capture
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'capturing') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50 }}>
        {/* Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', transform: 'scaleX(-1)',
          }}
        />

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Progress dots — top */}
        <div style={{
          position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '10px', alignItems: 'center', zIndex: 10,
        }}>
          {VIEWS.map((v, i) => (
            <div key={v.key} style={{
              width: i === viewIndex ? 32 : 8,
              height: 8, borderRadius: '4px',
              background: frames[v.key] ? '#00E676' : i === viewIndex ? currentView.color : 'rgba(255,255,255,0.2)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* View label — centre top */}
        <div style={{
          position: 'absolute', top: '4rem', left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', zIndex: 10,
        }}>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
            fontWeight: 600, color: currentView.color,
            textShadow: `0 0 40px ${currentView.color}80`,
            letterSpacing: '0.1em',
          }}>
            {currentView.label}
          </div>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.5)', marginTop: '4px',
          }}>
            View {viewIndex + 1} of {VIEWS.length}
          </div>
        </div>

        {/* Voice cue overlay */}
        {showCue && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 10,
            background: 'rgba(0,0,0,0.55)',
          }}>
            <div style={{
              maxWidth: 480, padding: '2rem 2.5rem', textAlign: 'center',
              background: 'rgba(8,13,20,0.9)', border: `1px solid ${currentView.color}40`,
              borderRadius: '16px', backdropFilter: 'blur(20px)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={currentView.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <p style={{ color: 'var(--text-primary)', fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', lineHeight: 1.6, fontWeight: 500 }}>
                {currentView.voiceCue}
              </p>
            </div>
          </div>
        )}

        {/* Countdown — centre */}
        {countdown !== null && (
          <div style={{
            position: 'absolute', bottom: '30%', left: '50%', transform: 'translateX(-50%)',
            textAlign: 'center', zIndex: 10,
          }}>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 'clamp(5rem, 20vw, 10rem)',
              fontWeight: 600, color: countdownColor,
              textShadow: `0 0 60px ${countdownColor}80`,
              lineHeight: 1,
              transition: 'color 0.3s',
            }}>
              {countdown}
            </div>
          </div>
        )}

        {/* HOLD flash */}
        {countdownStage === 'hold' && countdown === null && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,230,118,0.08)',
          }}>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(3rem, 12vw, 6rem)',
              fontWeight: 600, color: '#00E676',
              textShadow: '0 0 80px rgba(0,230,118,0.6)',
              letterSpacing: '0.15em',
            }}>
              HOLD
            </div>
          </div>
        )}

        {/* Corner guide lines */}
        {['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map(corner => (
          <div key={corner} style={{
            position: 'absolute', zIndex: 5,
            ...(corner === 'topLeft'     ? { top: 90, left: '10%' }  : {}),
            ...(corner === 'topRight'    ? { top: 90, right: '10%' } : {}),
            ...(corner === 'bottomLeft'  ? { bottom: 100, left: '10%' }  : {}),
            ...(corner === 'bottomRight' ? { bottom: 100, right: '10%' } : {}),
            width: 40, height: 40,
            borderTop: corner.startsWith('top')    ? `2px solid ${currentView.color}80` : 'none',
            borderBottom: corner.startsWith('bottom') ? `2px solid ${currentView.color}80` : 'none',
            borderLeft: corner.endsWith('Left')  ? `2px solid ${currentView.color}80` : 'none',
            borderRight: corner.endsWith('Right') ? `2px solid ${currentView.color}80` : 'none',
          }} />
        ))}

        {/* Captured tick badges — bottom */}
        <div style={{
          position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '8px', zIndex: 10,
        }}>
          {VIEWS.map(v => frames[v.key] ? (
            <div key={v.key} style={{
              padding: '4px 10px', borderRadius: '20px',
              background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)',
              color: '#00E676', fontSize: '0.72rem', fontFamily: "'Space Mono', monospace",
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {v.shortLabel}
            </div>
          ) : null)}
        </div>

        {/* Escape */}
        <button onClick={() => { stopCamera(); window.speechSynthesis?.cancel(); navigate('/dashboard'); }} style={{
          position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 20,
          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '6px 14px',
          fontSize: '0.78rem', fontFamily: "'Space Mono', monospace", cursor: 'pointer',
        }}>
          ✕ Exit
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Review — 2×2 grid
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-void)',
      padding: '100px 2rem 4rem',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Capture Complete
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              4 views captured — analysis coming in Phase 2
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn-ghost"
              onClick={() => { setPhase('intro'); setFrames({}); setViewIndex(0); }}
            >
              Retake
            </button>
            <button className="btn-primary" onClick={() => navigate('/dashboard')}>
              Save &amp; Exit
            </button>
          </div>
        </div>

        {/* 2×2 grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
        }}>
          {VIEWS.map((v, i) => (
            <div key={v.key} style={{
              position: 'relative', borderRadius: '12px', overflow: 'hidden',
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              aspectRatio: '16/9',
            }}>
              {frames[v.key] ? (
                <img
                  src={frames[v.key]}
                  alt={v.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No frame</span>
                </div>
              )}

              {/* Label badge */}
              <div style={{
                position: 'absolute', top: '10px', left: '10px',
                padding: '4px 10px', borderRadius: '20px',
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                border: `1px solid ${v.color}40`,
                color: v.color, fontSize: '0.72rem', fontFamily: "'Space Mono', monospace",
                letterSpacing: '0.06em',
              }}>
                {i + 1}. {v.label}
              </div>

              {/* Captured indicator */}
              {frames[v.key] && (
                <div style={{
                  position: 'absolute', top: '10px', right: '10px',
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Phase 2 teaser */}
        <div style={{
          marginTop: '2rem', padding: '1.25rem 1.5rem',
          background: 'var(--teal-dim)', border: '1px solid var(--border-teal)',
          borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Grid overlay, angle measurements, and AI analysis will be added in Phase 2.
          </span>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewKey = 'anterior' | 'rightLateral' | 'posterior' | 'leftLateral';

interface ViewConfig {
  key: ViewKey;
  label: string;
  displayLabel: string;
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
    displayLabel: 'FRONT VIEW',
    shortLabel: 'Front',
    voiceCue: 'Face the camera. Feet hip-width apart. Arms relaxed.',
    transitionCue: 'Perfect. Now turn to your right.',
    color: '#00D4AA',
  },
  {
    key: 'rightLateral',
    label: 'RIGHT LATERAL',
    displayLabel: 'RIGHT SIDE',
    shortLabel: 'Right Side',
    voiceCue: 'Turn to your right. I can see your right side.',
    transitionCue: 'Good. Now turn so your back faces the camera.',
    color: '#4DB8FF',
  },
  {
    key: 'posterior',
    label: 'POSTERIOR',
    displayLabel: 'BACK VIEW',
    shortLabel: 'Back',
    voiceCue: 'Turn so your back faces the camera.',
    transitionCue: 'Well done. Now face your right. I will see your left side.',
    color: '#FFB830',
  },
  {
    key: 'leftLateral',
    label: 'LEFT LATERAL',
    displayLabel: 'LEFT SIDE',
    shortLabel: 'Left Side',
    voiceCue: 'Turn to face right. I can see your left side.',
    transitionCue: 'All four views captured. Great work.',
    color: '#a78bfa',
  },
];

// ─── MediaPipe types ──────────────────────────────────────────────────────────

type MPLandmark = { x: number; y: number; z: number; visibility?: number };
interface Landmarker {
  detectForVideo(el: HTMLVideoElement, ts: number): { landmarks: MPLandmark[][] };
  close(): void;
}

const POSE_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],
  [11,13],[13,15],[15,17],[17,19],[19,15],[15,21],
  [12,14],[14,16],[16,18],[18,20],[20,16],[16,22],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[27,29],[29,31],[31,27],
  [24,26],[26,28],[28,30],[30,32],[32,28],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92; u.pitch = 1; u.volume = 1;
  window.speechSynthesis.speak(u);
}

let audioCtx: AudioContext | null = null;
function beep(double = false) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const play = (offset: number) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.connect(gain); gain.connect(audioCtx!.destination);
      osc.frequency.value = 440; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, audioCtx!.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + offset + 0.1);
      osc.start(audioCtx!.currentTime + offset);
      osc.stop(audioCtx!.currentTime + offset + 0.12);
    };
    play(0);
    if (double) play(0.18);
  } catch { /* ignore */ }
}

async function loadLandmarker(): Promise<Landmarker | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error CDN dynamic import
    const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs') as {
      FilesetResolver: { forVisionTasks(p: string): Promise<unknown> };
      PoseLandmarker: { createFromOptions(fs: unknown, opts: unknown): Promise<Landmarker> };
    };
    const fs = await mod.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );
    return await mod.PoseLandmarker.createFromOptions(fs, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  } catch { return null; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostureAssessment() {
  const navigate = useNavigate();

  const videoRef          = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef  = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const landmarkerRef     = useRef<Landmarker | null>(null);
  const rafRef            = useRef<number>(0);
  const timerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase]             = useState<Phase>('intro');
  const [viewIndex, setViewIndex]     = useState(0);
  const [countdown, setCountdown]     = useState<number | null>(null);
  const [isHold, setIsHold]           = useState(false);
  const [frames, setFrames]           = useState<Partial<Record<ViewKey, string>>>({});
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCue, setShowCue]         = useState(false);
  const [isRetake, setIsRetake]       = useState(false);

  // Countdown color: amber 8-4, red 3-1, green on HOLD
  const countdownColor = isHold ? '#00E676'
    : countdown !== null && countdown <= 3 ? '#FF4444'
    : '#FFB830';

  const currentView = VIEWS[viewIndex]!;

  // ── Camera ──────────────────────────────────────────────────────────────────

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
      setCameraError('Camera access denied. Allow camera permissions and refresh.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // ── Skeleton render loop ─────────────────────────────────────────────────────

  const renderLoop = useCallback(() => {
    const video  = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(renderLoop); return;
    }
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = requestAnimationFrame(renderLoop); return; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (landmarkerRef.current) {
      try {
        const result = landmarkerRef.current.detectForVideo(video, performance.now());
        const lms = result.landmarks[0];
        if (lms) {
          const w = canvas.width; const h = canvas.height;
          ctx.strokeStyle = 'rgba(0,212,170,0.75)'; ctx.lineWidth = 2;
          for (const [a, b] of POSE_CONNECTIONS) {
            const lmA = lms[a]; const lmB = lms[b];
            if (!lmA || !lmB) continue;
            ctx.beginPath();
            ctx.moveTo(lmA.x * w, lmA.y * h);
            ctx.lineTo(lmB.x * w, lmB.y * h);
            ctx.stroke();
          }
          ctx.fillStyle = '#00D4AA';
          for (const lm of lms) {
            if (!lm || (lm.visibility ?? 1) < 0.3) continue;
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } catch { /* skip frame */ }
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, []);

  // ── Frame capture ────────────────────────────────────────────────────────────

  const captureFrame = useCallback((): string | null => {
    const video  = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return null;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // ── Single view countdown ────────────────────────────────────────────────────

  const runCountdown = useCallback((viewIdx: number, onDone: () => void) => {
    const view = VIEWS[viewIdx]!;
    setViewIndex(viewIdx);
    setShowCue(true);
    setIsHold(false);
    setCountdown(null);
    speak(view.voiceCue);

    timerRef.current = setTimeout(() => {
      setShowCue(false);
      let tick = 8;
      setCountdown(tick);

      const interval = setInterval(() => {
        tick--;
        if (tick > 0) {
          setCountdown(tick);
          beep(false);
        } else {
          clearInterval(interval);
          setCountdown(null);
          setIsHold(true);
          beep(true);
          const dataUrl = captureFrame();
          if (dataUrl) setFrames(prev => ({ ...prev, [view.key]: dataUrl }));
          timerRef.current = setTimeout(() => { setIsHold(false); onDone(); }, 1500);
        }
      }, 1000);
    }, 2500);
  }, [captureFrame]);

  // ── Full 4-view sequence ─────────────────────────────────────────────────────

  const runAllViews = useCallback((startIdx: number) => {
    if (startIdx >= VIEWS.length) {
      speak('All four views captured. Great work.');
      timerRef.current = setTimeout(() => { stopCamera(); setPhase('review'); }, 1500);
      return;
    }
    runCountdown(startIdx, () => {
      speak(VIEWS[startIdx]!.transitionCue);
      timerRef.current = setTimeout(() => runAllViews(startIdx + 1), 2800);
    });
  }, [runCountdown, stopCamera]);

  // ── Start full assessment ────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    setPhase('capturing');
    setViewIndex(0);
    setFrames({});
    setIsRetake(false);
    await startCamera();
    loadLandmarker().then(lm => { landmarkerRef.current = lm; }).catch(() => {});
    rafRef.current = requestAnimationFrame(renderLoop);
    speak('Starting posture assessment. Stand 2 to 3 metres from the camera.');
    timerRef.current = setTimeout(() => runAllViews(0), 3000);
  }, [startCamera, renderLoop, runAllViews]);

  // ── Retake single view ───────────────────────────────────────────────────────

  const startRetake = useCallback(async (viewKey: ViewKey) => {
    const viewIdx = VIEWS.findIndex(v => v.key === viewKey);
    setIsRetake(true);
    setPhase('capturing');
    setViewIndex(viewIdx);
    await startCamera();
    loadLandmarker().then(lm => { landmarkerRef.current = lm; }).catch(() => {});
    rafRef.current = requestAnimationFrame(renderLoop);
    speak('Retaking this view. Get ready.');
    timerRef.current = setTimeout(() => {
      runCountdown(viewIdx, () => {
        speak('View captured.');
        timerRef.current = setTimeout(() => { stopCamera(); setPhase('review'); setIsRetake(false); }, 1500);
      });
    }, 2000);
  }, [startCamera, renderLoop, runCountdown, stopCamera]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  useEffect(() => () => {
    stopCamera();
    landmarkerRef.current?.close();
    window.speechSynthesis?.cancel();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [stopCamera]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Intro
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'intro') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', paddingTop: '100px' }}>
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '18px', margin: '0 auto 2rem', background: 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(77,184,255,0.1))', border: '1px solid var(--border-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M12 8v4m0 0-2 4m2-4 2 4M8 14l-2 4M16 14l2 4"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Posture Assessment</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          4-view capture takes under 2 minutes. Stand 2–3 metres from camera at umbilicus height.
        </p>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
          {['Stand 2–3 metres from camera','Camera at navel height','Plain background, even lighting','Fitted clothing — shoulders, hips, knees visible','Bare feet or flat shoes'].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {VIEWS.map((v, i) => (
            <div key={v.key} style={{ padding: '6px 14px', borderRadius: '20px', background: `${v.color}18`, border: `1px solid ${v.color}33`, color: v.color, fontSize: '0.78rem', fontFamily: "'Space Mono', monospace" }}>
              {i + 1}. {v.shortLabel}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={() => { void handleStart(); }} style={{ fontSize: '1rem', padding: '0.875rem 2.5rem' }}>
          Begin Assessment
        </button>
        {cameraError && <p style={{ marginTop: '1rem', color: 'var(--danger)', fontSize: '0.875rem' }}>{cameraError}</p>}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Capture
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'capturing') return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50 }}>
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      <canvas ref={overlayCanvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

      {/* Progress dots */}
      <div style={{ position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', alignItems: 'center', zIndex: 10 }}>
        {VIEWS.map((v, i) => (
          <div key={v.key} style={{ width: i === viewIndex ? 32 : 8, height: 8, borderRadius: '4px', background: frames[v.key] ? '#00E676' : i === viewIndex ? currentView.color : 'rgba(255,255,255,0.2)', transition: 'all 0.3s ease' }} />
        ))}
      </div>

      {/* View label */}
      <div style={{ position: 'absolute', top: '4rem', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 10 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 600, color: currentView.color, textShadow: `0 0 40px ${currentView.color}80`, letterSpacing: '0.1em' }}>
          {currentView.displayLabel}
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px', letterSpacing: '0.08em' }}>
          {isRetake ? 'RETAKE' : `VIEW ${viewIndex + 1} OF ${VIEWS.length}`} · {currentView.label}
        </div>
      </div>

      {/* Voice cue overlay */}
      {showCue && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(0,0,0,0.55)' }}>
          <div style={{ maxWidth: 480, padding: '2rem 2.5rem', textAlign: 'center', background: 'rgba(8,13,20,0.9)', border: `1px solid ${currentView.color}40`, borderRadius: '16px', backdropFilter: 'blur(20px)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={currentView.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <p style={{ color: 'var(--text-primary)', fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', lineHeight: 1.6, fontWeight: 500 }}>
              {currentView.voiceCue}
            </p>
          </div>
        </div>
      )}

      {/* Countdown */}
      {countdown !== null && (
        <div style={{ position: 'absolute', bottom: '30%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 10 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 'clamp(5rem, 20vw, 10rem)', fontWeight: 600, color: countdownColor, textShadow: `0 0 60px ${countdownColor}80`, lineHeight: 1, transition: 'color 0.3s' }}>
            {countdown}
          </div>
        </div>
      )}

      {/* HOLD flash */}
      {isHold && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,0.08)' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(3rem, 12vw, 6rem)', fontWeight: 600, color: '#00E676', textShadow: '0 0 80px rgba(0,230,118,0.6)', letterSpacing: '0.15em' }}>
            HOLD
          </div>
        </div>
      )}

      {/* Corner guides */}
      {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map(corner => (
        <div key={corner} style={{
          position: 'absolute', zIndex: 5, width: 40, height: 40,
          ...(corner === 'topLeft'     ? { top: 90, left: '10%' }    : {}),
          ...(corner === 'topRight'    ? { top: 90, right: '10%' }   : {}),
          ...(corner === 'bottomLeft'  ? { bottom: 100, left: '10%' }  : {}),
          ...(corner === 'bottomRight' ? { bottom: 100, right: '10%' } : {}),
          borderTop:    corner.startsWith('top')    ? `2px solid ${currentView.color}80` : 'none',
          borderBottom: corner.startsWith('bottom') ? `2px solid ${currentView.color}80` : 'none',
          borderLeft:   corner.endsWith('Left')     ? `2px solid ${currentView.color}80` : 'none',
          borderRight:  corner.endsWith('Right')    ? `2px solid ${currentView.color}80` : 'none',
        }} />
      ))}

      {/* Captured badges */}
      <div style={{ position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 10 }}>
        {VIEWS.map(v => frames[v.key] ? (
          <div key={v.key} style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: '#00E676', fontSize: '0.72rem', fontFamily: "'Space Mono', monospace", display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {v.shortLabel}
          </div>
        ) : null)}
      </div>

      {/* Exit */}
      <button onClick={() => { stopCamera(); window.speechSynthesis?.cancel(); navigate('/dashboard'); }} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 20, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.78rem', fontFamily: "'Space Mono', monospace", cursor: 'pointer' }}>
        ✕ Exit
      </button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Review — 2×2 grid
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '100px 2rem 4rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Capture Complete</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>All 4 views captured. Retake any view or proceed to analysis.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-ghost" onClick={() => { void handleStart(); }}>Retake All</button>
            <button className="btn-primary" disabled title="Coming soon — Phase 2" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
              Analyse Posture
            </button>
          </div>
        </div>

        {/* 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {VIEWS.map((v, i) => (
            <div key={v.key} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', aspectRatio: '16/9' }}>
              {frames[v.key] ? (
                <img src={frames[v.key]} alt={v.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No frame</span>
                </div>
              )}

              {/* Label */}
              <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${v.color}40`, color: v.color, fontSize: '0.72rem', fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em' }}>
                {i + 1}. {v.displayLabel}
              </div>

              {/* Captured tick */}
              {frames[v.key] && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              )}

              {/* Retake button */}
              <button onClick={() => { void startRetake(v.key); }} style={{ position: 'absolute', bottom: '10px', right: '10px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', fontFamily: "'Space Mono', monospace", cursor: 'pointer' }}>
                ↺ Retake
              </button>
            </div>
          ))}
        </div>

        {/* Phase 2 teaser */}
        <div style={{ marginTop: '2rem', padding: '1.25rem 1.5rem', background: 'var(--teal-dim)', border: '1px solid var(--border-teal)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Grid overlay, angle measurements, and AI analysis coming in Phase 2.
          </span>
        </div>
      </div>
    </div>
  );
}

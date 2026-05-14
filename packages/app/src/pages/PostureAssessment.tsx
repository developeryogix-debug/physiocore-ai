import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@physiocore/supabase';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { extractMeasurements, analysePosture } from '../lib/agents/postureClient.js';
import type { PostureReport } from '../lib/agents/postureClient.js';
import PostureReportCard from '../components/PostureReportCard.js';
import {
  drawGridOverlay,
  drawIdealComparison,
  calcLandmarkConfidence,
} from '../lib/postureGridOverlay.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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

interface CapturedFrame {
  dataUrl: string;
  landmarks: MPLandmark[] | null;
}

type Phase = 'intro' | 'calibration' | 'capturing' | 'review';

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

// ─── Audio helpers ────────────────────────────────────────────────────────────

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
  const { userProfile } = useUserProfile();

  const videoRef          = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef  = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const landmarkerRef     = useRef<Landmarker | null>(null);
  const lastLandmarksRef  = useRef<MPLandmark[] | null>(null);
  const rafRef            = useRef<number>(0);
  const timerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridCanvasRefs    = useRef<Partial<Record<ViewKey, HTMLCanvasElement>>>({});
  const compareCanvasRefs = useRef<Partial<Record<ViewKey, HTMLCanvasElement>>>({});

  const [phase, setPhase]             = useState<Phase>('intro');
  const [viewIndex, setViewIndex]     = useState(0);
  const [countdown, setCountdown]     = useState<number | null>(null);
  const [isHold, setIsHold]           = useState(false);
  const [frames, setFrames]           = useState<Partial<Record<ViewKey, CapturedFrame>>>({});
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCue, setShowCue]         = useState(false);
  const [isRetake, setIsRetake]       = useState(false);
  const [analysing, setAnalysing]     = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [postureReport, setPostureReport] = useState<PostureReport | null>(null);
  const [savedToDb, setSavedToDb]     = useState(false);
  const [calibrated, setCalibrated]   = useState(false);
  const [exportingPdf, setExportingPdf] = useState<'patient' | 'clinician' | null>(null);

  const countdownColor = isHold ? '#00E676'
    : countdown !== null && countdown <= 3 ? '#FF4444'
    : '#FFB830';

  const currentView = VIEWS[viewIndex]!;

  // ── Draw grid overlays in review phase ──────────────────────────────────────

  useEffect(() => {
    if (phase !== 'review') return;
    for (const v of VIEWS) {
      const frame = frames[v.key];
      const canvas = gridCanvasRefs.current[v.key];
      if (frame && canvas) drawGridOverlay(canvas, frame, v.key);
    }
  }, [phase, frames]);

  useEffect(() => {
    if (!postureReport) return;
    for (const v of VIEWS) {
      const frame = frames[v.key];
      const canvas = compareCanvasRefs.current[v.key];
      if (frame && canvas) drawIdealComparison(canvas, frame, v.key);
    }
  }, [postureReport, frames]);

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
        lastLandmarksRef.current = lms ?? null;
        if (lms) {
          const w = canvas.width, h = canvas.height;
          ctx.strokeStyle = 'rgba(0,212,170,0.75)'; ctx.lineWidth = 2;
          for (const [a, b] of POSE_CONNECTIONS) {
            const lmA = lms[a], lmB = lms[b];
            if (!lmA || !lmB) continue;
            ctx.beginPath();
            ctx.moveTo(lmA.x * w, lmA.y * h);
            ctx.lineTo(lmB.x * w, lmB.y * h);
            ctx.stroke();
          }
          ctx.fillStyle = '#00D4AA';
          for (const lm of lms) {
            if (!lm || (lm.visibility ?? 1) < 0.3) continue;
            ctx.beginPath(); ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2); ctx.fill();
          }
        }
      } catch { /* skip frame */ }
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, []);

  // ── Frame capture (stores landmark snapshot) ─────────────────────────────────

  const captureFrame = useCallback((): CapturedFrame | null => {
    const video  = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return null;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.85),
      landmarks: lastLandmarksRef.current ? [...lastLandmarksRef.current] : null,
    };
  }, []);

  // ── Single view countdown ────────────────────────────────────────────────────

  const runCountdown = useCallback((viewIdx: number, onDone: () => void) => {
    const view = VIEWS[viewIdx]!;
    setViewIndex(viewIdx); setShowCue(true); setIsHold(false); setCountdown(null);
    speak(view.voiceCue);

    timerRef.current = setTimeout(() => {
      setShowCue(false);
      let tick = 8;
      setCountdown(tick);

      const interval = setInterval(() => {
        tick--;
        if (tick > 0) {
          setCountdown(tick); beep(false);
        } else {
          clearInterval(interval);
          setCountdown(null); setIsHold(true); beep(true);
          const captured = captureFrame();
          if (captured) setFrames(prev => ({ ...prev, [view.key]: captured }));
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

  // ── Begin capture (called from calibration confirm or Retake All) ────────────

  const handleBeginCapture = useCallback(async () => {
    setPhase('capturing'); setViewIndex(0); setFrames({}); setIsRetake(false);
    await startCamera();
    loadLandmarker().then(lm => { landmarkerRef.current = lm; }).catch(() => {});
    rafRef.current = requestAnimationFrame(renderLoop);
    speak('Starting posture assessment. Stand 2 to 3 metres from the camera.');
    timerRef.current = setTimeout(() => runAllViews(0), 3000);
  }, [startCamera, renderLoop, runAllViews]);

  // ── Go to calibration screen (from intro) ────────────────────────────────────

  const handleStart = useCallback(() => {
    setCalibrated(false);
    setPhase('calibration');
  }, []);

  // ── Retake single view ───────────────────────────────────────────────────────

  const startRetake = useCallback(async (viewKey: ViewKey) => {
    const viewIdx = VIEWS.findIndex(v => v.key === viewKey);
    setIsRetake(true); setPhase('capturing'); setViewIndex(viewIdx);
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

  // ── Posture analysis ─────────────────────────────────────────────────────────

  const handleAnalyse = useCallback(async () => {
    const anteriorLms  = frames.anterior?.landmarks ?? null;
    const lateralLms   = frames.rightLateral?.landmarks ?? null;

    setAnalysing(true);
    setAnalysisError(null);
    setSavedToDb(false);

    try {
      const measurements = extractMeasurements(anteriorLms, lateralLms);

      const conditions = (userProfile?.injuries ?? [])
        .filter(i => i.isActive)
        .map(i => i.bodyPart);

      const report = await analysePosture(measurements, conditions);
      setPostureReport(report);

      // Save to Supabase posture_assessments
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await db.from('posture_assessments').insert({
          user_id:       user.id,
          date:          new Date().toISOString().split('T')[0],
          overall_score: report.overallScore,
          findings:      report.findings,
          grid_images: {
            anterior:     frames.anterior?.dataUrl  ?? null,
            rightLateral: frames.rightLateral?.dataUrl ?? null,
            posterior:    frames.posterior?.dataUrl ?? null,
            leftLateral:  frames.leftLateral?.dataUrl  ?? null,
          },
        });
        setSavedToDb(true);
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setAnalysing(false);
    }
  }, [frames, userProfile]);

  // ── PDF export ───────────────────────────────────────────────────────────────

  const exportPosturePdf = useCallback(async (variant: 'patient' | 'clinician') => {
    if (!postureReport) return;
    setExportingPdf(variant);
    try {
      const firstName = ((userProfile?.name ?? 'Patient').split(' ')[0] ?? 'Patient').replace(/[^a-zA-Z0-9]/g, '') || 'Patient';
      const dateStr   = new Date().toISOString().slice(0, 10);
      const filename  = variant === 'clinician'
        ? `${firstName}_PostureReport_Clinical_${dateStr}.pdf`
        : `${firstName}_PostureReport_${dateStr}.pdf`;

      // Build confidence map from captured frames
      const confidences: Partial<Record<ViewKey, number>> = {};
      for (const v of VIEWS) {
        if (frames[v.key]) confidences[v.key] = calcLandmarkConfidence(frames[v.key]!.landmarks);
      }

      const [{ pdf }, { PostureReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../components/PostureReportPDF.js'),
      ]);

      const blob = await pdf(
        <PostureReportPDF
          report={postureReport}
          userName={firstName}
          capturedFrames={frames}
          variant={variant}
          confidences={confidences}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPdf(null);
    }
  }, [postureReport, frames, userProfile]);

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
  // RENDER: Calibration (Pausic et al. 2010 — 1.5 m, 115 cm camera height)
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'calibration') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', paddingTop: '100px' }}>
      <div style={{ maxWidth: 580, width: '100%' }}>
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Step 1 of 2 — Camera Setup</p>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Calibrate Your Camera</h1>

        {/* Setup cards */}
        {[
          {
            icon: '📏',
            title: 'Camera height — navel level',
            detail: 'Place your phone or webcam at umbilicus (belly button) height. Pausic et al. 2010 recommend 115 cm from floor for standard adults.',
            color: '#00D4AA',
          },
          {
            icon: '↔',
            title: 'Distance — 2.5 to 3 metres',
            detail: 'Stand far enough that your full body from head to ankle is visible. Align the camera with a vertical door frame edge for a true plumb reference.',
            color: '#4DB8FF',
          },
          {
            icon: '📄',
            title: 'Scale reference — A4 paper (21 × 29.7 cm)',
            detail: 'Optionally hold an A4 sheet at hip level for the first frame. This lets the system estimate real-world scale from landmark proportions.',
            color: '#FFB830',
          },
          {
            icon: '✕',
            title: 'Stand on the X mark',
            detail: 'Place a strip of tape in an X on the floor 2.5 m from the camera. Return to this mark for every view to keep distance consistent.',
            color: '#a78bfa',
          },
        ].map(card => (
          <div key={card.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '10px' }}>
            <div style={{ fontSize: '1.25rem', minWidth: 28, textAlign: 'center' as const }}>{card.icon}</div>
            <div>
              <p style={{ fontWeight: 600, color: card.color, fontSize: '0.875rem', marginBottom: 3 }}>{card.title}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.55, margin: 0 }}>{card.detail}</p>
            </div>
          </div>
        ))}

        {/* Visual plumb-line guide */}
        <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Animated vertical line SVG */}
          <svg width={40} height={80} viewBox="0 0 40 80" style={{ flexShrink: 0 }}>
            <line x1={20} y1={0} x2={20} y2={80} stroke="rgba(0,212,170,0.3)" strokeWidth={2} strokeDasharray="5 4" />
            <line x1={20} y1={0} x2={20} y2={80} stroke="#00D4AA" strokeWidth={2} strokeDasharray="5 4">
              <animate attributeName="stroke-dashoffset" from="0" to="18" dur="1.2s" repeatCount="indefinite" />
            </line>
            <circle cx={20} cy={40} r={5} fill="#00D4AA" opacity={0.85} />
          </svg>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: 1.55, margin: 0 }}>
            Align the camera so a vertical door-frame edge runs through the centre of frame — this becomes your plumb reference for all measurements.
          </p>
        </div>

        {/* Confirm + begin */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!calibrated ? (
            <button
              className="btn-ghost"
              onClick={() => setCalibrated(true)}
              style={{ flex: 1 }}
            >
              ✓ Camera is set up correctly
            </button>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: '8px', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)' }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ color: '#00E676', fontFamily: "'Space Mono',monospace", fontSize: '0.75rem' }}>Camera calibrated ✓</span>
            </div>
          )}
          <button
            className="btn-primary"
            onClick={() => { void handleBeginCapture(); }}
            style={{ flex: 1 }}
          >
            {calibrated ? 'Begin Assessment →' : 'Skip & Begin'}
          </button>
        </div>
        <button onClick={() => setPhase('intro')} style={{ marginTop: '1rem', background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '0.8rem', cursor: 'pointer', width: '100%' }}>← Back</button>
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
  // RENDER: Review — 2×2 grid with grid overlay canvases
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '100px 2rem 4rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Capture Complete</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Grid overlay applied. Retake any view or proceed to analysis.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-ghost" onClick={() => { void handleBeginCapture(); }}>Retake All</button>
            <button className="btn-primary" onClick={() => { void handleAnalyse(); }} disabled={analysing}>
              {analysing ? 'Analysing…' : 'Analyse Posture'}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[['#00E676', '≤2°  Normal'], ['#FFB830', '2-5°  Mild'], ['#FF4444', '>5°  Significant']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{ width: 24, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: "'Space Mono', monospace" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {VIEWS.map((v, i) => (
            <div key={v.key} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', aspectRatio: '16/9' }}>
              {frames[v.key] ? (
                <canvas
                  ref={el => { if (el) gridCanvasRefs.current[v.key] = el; }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
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

              {/* Confidence badge */}
              {frames[v.key] && (() => {
                const conf = calcLandmarkConfidence(frames[v.key]!.landmarks);
                const confColor = conf >= 70 ? '#00E676' : conf >= 50 ? '#FFB830' : '#FF4444';
                const confMsg   = conf >= 70 ? '' : conf >= 50 ? ' — retake recommended' : ' — poor capture';
                return (
                  <div style={{ position: 'absolute', bottom: '40px', left: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', color: confColor, fontSize: '0.65rem', fontFamily: "'Space Mono',monospace" }}>
                    {conf}% confidence{confMsg}
                  </div>
                );
              })()}

              {/* Retake button */}
              <button onClick={() => { void startRetake(v.key); }} style={{ position: 'absolute', bottom: '10px', right: '10px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', fontFamily: "'Space Mono', monospace", cursor: 'pointer' }}>
                ↺ Retake
              </button>
            </div>
          ))}
        </div>

        {analysisError && (
          <div style={{ marginTop: '1rem', color: 'var(--danger)', fontSize: '0.875rem', padding: '0.75rem 1rem', background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', borderRadius: '8px' }}>
            {analysisError}
          </div>
        )}

        {postureReport && <PostureReportCard report={postureReport} savedToDb={savedToDb} />}

        {postureReport && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => { void exportPosturePdf('patient'); }}
              disabled={exportingPdf !== null}
              style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', background: 'var(--teal-500)', color: '#000', opacity: exportingPdf === 'patient' ? 0.7 : 1 }}
            >
              {exportingPdf === 'patient' ? 'Generating…' : '↓ Export PDF — For Patient'}
            </button>
            <button
              onClick={() => { void exportPosturePdf('clinician'); }}
              disabled={exportingPdf !== null}
              style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', opacity: exportingPdf === 'clinician' ? 0.7 : 1 }}
            >
              {exportingPdf === 'clinician' ? 'Generating…' : '↓ Export PDF — For Clinician'}
            </button>
          </div>
        )}

        {/* Improvement 5 — Ideal vs actual comparison grid */}
        {postureReport && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.75rem', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '0.75rem' }}>
              Ideal Alignment Comparison
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Teal ghost line = ideal plumb. Your joint chain shows deviation from vertical.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {VIEWS.map((v, i) => (
                <div key={v.key} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', aspectRatio: '16/9' }}>
                  {frames[v.key] ? (
                    <canvas
                      ref={el => { if (el) compareCanvasRefs.current[v.key] = el; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No frame</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,0,0,0.7)', border: `1px solid ${v.color}40`, color: v.color, fontSize: '0.65rem', fontFamily: "'Space Mono',monospace" }}>
                    {i + 1}. {v.shortLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

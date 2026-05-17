import { useState, useRef, useCallback, useEffect } from 'react';
import { speak } from '../lib/voiceGuide.js';
import { supabase } from '@physiocore/supabase';
import { useAuth } from '../hooks/useAuth.js';
import ROMResults from '../components/ROMResults.js';
import {
  ALL_TESTS, REGION_MAP, GRID_REGIONS, NEW_BADGE_REGIONS, buildQueue,
  romStatus, statusClr, BONES, type ROMTest, type ROMResult, type ROMInterp,
} from '../lib/romData.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Mode  = 'self-select' | 'prescribed' | 'ai-suggested';
type Phase = 'intro' | 'capturing' | 'reviewing' | 'analysing' | 'results';

type MPLandmark = { x: number; y: number; z: number; visibility?: number };
interface Landmarker {
  detectForVideo(el: HTMLVideoElement, ts: number): { landmarks: MPLandmark[][] };
  close(): void;
}
interface AISuggestion { region: string; reasoning: string; evidenceGrade: 'A'|'B'; citation: string; sourceBadge: 'Posture'|'Last ROM'|'Check-in' }

// ─── Audio ────────────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
function beep(dbl = false) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const play = (t: number) => {
      const o = audioCtx!.createOscillator(), g = audioCtx!.createGain();
      o.connect(g); g.connect(audioCtx!.destination); o.frequency.value = 440; o.type = 'sine';
      g.gain.setValueAtTime(0.3, audioCtx!.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + t + 0.1);
      o.start(audioCtx!.currentTime + t); o.stop(audioCtx!.currentTime + t + 0.12);
    };
    play(0); if (dbl) play(0.18);
  } catch { /**/ }
}

// ─── MediaPipe ────────────────────────────────────────────────────────────────
async function loadLandmarker(): Promise<Landmarker | null> {
  try {
    // @ts-expect-error CDN import
    const m = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs') as {
      FilesetResolver: { forVisionTasks(p: string): Promise<unknown> };
      PoseLandmarker: { createFromOptions(fs: unknown, o: unknown): Promise<Landmarker> };
    };
    const fs = await m.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
    return await m.PoseLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' },
      runningMode: 'VIDEO', numPoses: 1,
    });
  } catch { return null; }
}

function angle3pt(a: MPLandmark, b: MPLandmark, c: MPLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }, cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y, mag = Math.sqrt(ab.x ** 2 + ab.y ** 2) * Math.sqrt(cb.x ** 2 + cb.y ** 2);
  return mag < 1e-6 ? 0 : Math.round(Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180 / Math.PI);
}

function liveAngle(lms: MPLandmark[], t: ROMTest): number {
  const a = lms[t.lmA], b = lms[t.lmB];
  if (!a || !b) return 0;
  if (t.isCervLat) return Math.round(Math.atan2(Math.abs(a.x - b.x), Math.max(0.01, b.y - a.y)) * 180 / Math.PI);
  if (t.isCervRot) {
    const ls = lms[11], rs = lms[12]; // shoulders
    if (!ls || !rs) return 0;
    const midX = (ls.x + rs.x) / 2;
    const sw = Math.abs(rs.x - ls.x);
    if (sw < 0.05) return 0;
    const offset = t.side === 'right' ? (a.x - midX) / sw : (midX - a.x) / sw;
    return Math.round(Math.max(0, Math.min(1, offset)) * 80);
  }
  const c = lms[t.lmC]; return c ? angle3pt(a, b, c) : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ROMAssessment() {
  const { user } = useAuth();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const lmRef      = useRef<Landmarker | null>(null);
  const lastLmsRef = useRef<MPLandmark[] | null>(null);
  const rafRef     = useRef<number>(0);
  const tmRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef   = useRef<ROMTest[]>([]);

  const [mode, setMode]         = useState<Mode>('self-select');
  const [phase, setPhase]       = useState<Phase>('intro');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aiSugg, setAiSugg]     = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [tidx, setTidx]         = useState(0);
  const [cntdn, setCntdn]       = useState<number | null>(null);
  const [isHold, setIsHold]     = useState(false);
  const [angle, setAngle]       = useState<number | null>(null);
  const [captured, setCaptured] = useState<Record<string, number>>({});
  const [camErr, setCamErr]     = useState<string | null>(null);
  const [results, setResults]   = useState<ROMResult[]>([]);
  const [interp, setInterp]     = useState<ROMInterp | null>(null);
  const [interpErr, setInterpErr] = useState<string | null>(null);
  const [saved, setSaved]       = useState(false);

  const cur = queueRef.current[tidx];

  // ─── Camera ──────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
    } catch { setCamErr('Camera access denied.'); }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
  }, []);

  const renderLoop = useCallback((qi: number) => {
    const v = videoRef.current, c = overlayRef.current;
    if (!v || !c || v.readyState < 2) { rafRef.current = requestAnimationFrame(() => renderLoop(qi)); return; }
    c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
    const ctx = c.getContext('2d'); if (!ctx) { rafRef.current = requestAnimationFrame(() => renderLoop(qi)); return; }
    ctx.clearRect(0, 0, c.width, c.height);
    if (lmRef.current) {
      try {
        const r = lmRef.current.detectForVideo(v, performance.now()), lms = r.landmarks[0];
        lastLmsRef.current = lms ?? null;
        if (lms) {
          const [w, h] = [c.width, c.height];
          ctx.strokeStyle = 'rgba(0,212,170,0.75)'; ctx.lineWidth = 2;
          for (const [a, b] of BONES) { const la = lms[a], lb = lms[b]; if (!la || !lb) continue; ctx.beginPath(); ctx.moveTo(la.x * w, la.y * h); ctx.lineTo(lb.x * w, lb.y * h); ctx.stroke(); }
          ctx.fillStyle = '#00D4AA';
          for (const lm of lms) { if (!lm || (lm.visibility ?? 1) < 0.3) continue; ctx.beginPath(); ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2); ctx.fill(); }
          const tst = queueRef.current[qi]; if (tst) setAngle(liveAngle(lms, tst));
        }
      } catch { /**/ }
    }
    rafRef.current = requestAnimationFrame(() => renderLoop(qi));
  }, []);

  const runTest = useCallback((qi: number, onDone: () => void) => {
    const tst = queueRef.current[qi]!;
    setTidx(qi); setIsHold(false); setCntdn(null); setAngle(null);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => renderLoop(qi));
    speak(tst.voiceCue);
    tmRef.current = setTimeout(() => {
      let tick = 8; setCntdn(tick);
      const iv = setInterval(() => {
        tick--;
        if (tick > 0) { setCntdn(tick); beep(false); }
        else {
          clearInterval(iv); setCntdn(null); setIsHold(true); beep(true);
          const a = lastLmsRef.current ? liveAngle(lastLmsRef.current, tst) : 0;
          setCaptured(p => ({ ...p, [tst.key]: a }));
          tmRef.current = setTimeout(() => { setIsHold(false); onDone(); }, 1500);
        }
      }, 1000);
    }, 2500);
  }, [renderLoop]);

  const runAll = useCallback((qi: number) => {
    if (qi >= queueRef.current.length) {
      speak('All measurements complete. Excellent work.');
      tmRef.current = setTimeout(() => { stopCamera(); setPhase('reviewing'); }, 1500);
      return;
    }
    const prev = queueRef.current[qi - 1], curr = queueRef.current[qi]!;
    const viewChanged = prev && prev.view !== curr.view;
    if (viewChanged) {
      const msg = curr.view === 'lateral-right' ? 'Now turn your RIGHT side to face the camera.'
        : curr.view === 'lateral-left' ? 'Now turn your LEFT side to face the camera.'
        : 'Face the camera again.';
      speak(msg);
    }
    tmRef.current = setTimeout(() => runTest(qi, () => { tmRef.current = setTimeout(() => runAll(qi + 1), 2000); }), viewChanged ? 3500 : 500);
  }, [runTest, stopCamera]);

  const handleStart = useCallback(async (queue: ROMTest[]) => {
    if (!queue.length) return;
    queueRef.current = queue;
    setPhase('capturing'); setCaptured({}); setCamErr(null); setSaved(false); setTidx(0);
    await startCamera();
    loadLandmarker().then(lm => { lmRef.current = lm; }).catch(() => {});
    rafRef.current = requestAnimationFrame(() => renderLoop(0));
    speak('Starting ROM assessment. Stand two to three metres from the camera.');
    tmRef.current = setTimeout(() => runAll(0), 3000);
  }, [startCamera, renderLoop, runAll]);

  const handleRetake = useCallback(async (key: string) => {
    const qi = queueRef.current.findIndex(t => t.key === key); if (qi < 0) return;
    setPhase('capturing');
    await startCamera();
    loadLandmarker().then(lm => { lmRef.current = lm; }).catch(() => {});
    speak('Retaking. Get ready.');
    tmRef.current = setTimeout(() => runTest(qi, () => { speak('Captured.'); tmRef.current = setTimeout(() => { stopCamera(); setPhase('reviewing'); }, 1500); }), 2500);
  }, [startCamera, runTest, stopCamera]);

  const handleAnalyse = useCallback(async () => {
    const res: ROMResult[] = queueRef.current
      .filter(t => captured[t.key] !== undefined)
      .map(t => ({ key: t.key, joint: t.joint, movement: t.movement, side: t.side, angle: captured[t.key]!, normalMin: t.normalMin, normalMax: t.normalMax, higherIsBetter: t.higherIsBetter, clinicalLabel: t.clinicalLabel, status: romStatus(captured[t.key]!, t), region: t.region }));
    setResults(res); setPhase('analysing');
    const apiKey = (import.meta.env as Record<string, string | undefined>)['VITE_ANTHROPIC_KEY'] ?? '';
    const meas = res.map(r => `${r.joint} ${r.movement} (${r.side}): ${r.angle}° [norm ${r.clinicalLabel}] – ${r.status}`).join('\n');
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: `Physiotherapist interpreting camera-based active ROM (±5–10° precision).\n${meas}\nJSON only: {"summary":"2–3 sentences","findings":[{"joint":"...","finding":"..."}],"overallRisk":"low|moderate|high","referral":true|false}` }] }),
      });
      const j = await resp.json() as { content?: { type: string; text: string }[] };
      const txt = j.content?.[0]?.text ?? '{}';
      const parsed = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Partial<ROMInterp>;
      setInterp({ summary: parsed.summary ?? 'Assessment complete.', findings: parsed.findings ?? [], overallRisk: parsed.overallRisk ?? 'low', referral: parsed.referral ?? false });
    } catch { setInterpErr('AI interpretation unavailable.'); }
    if (user) {
      try { await db.from('rom_assessments').insert({ user_id: user.id, date: new Date().toISOString().split('T')[0], measurements: captured, results: res }); setSaved(true); } catch { /**/ }
    }
    setPhase('results');
  }, [captured, user]);

  // ─── AI suggestions ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'ai-suggested' || aiSugg.length || aiLoading) return;
    setAiLoading(true);
    const key = (import.meta.env as Record<string, string | undefined>)['VITE_ANTHROPIC_KEY'] ?? '';
    void fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 600,
        messages: [{ role: 'user', content: 'Suggest 3 ROM regions for a physiotherapy assessment. Return JSON array: [{"region":"Head/Neck","reasoning":"...","evidenceGrade":"A","citation":"Norkin 2016","sourceBadge":"Posture"}]. Regions: Head/Neck,Shoulder,Elbow,Trunk,Hip,Knee,Ankle. sourceBadge options: Posture, Last ROM, Check-in.' }],
      }),
    }).then(r => r.json()).then((j: { content?: { type: string; text: string }[] }) => {
      const txt = j.content?.[0]?.text ?? '[]';
      const parsed = JSON.parse(txt.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as AISuggestion[];
      setAiSugg(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
    }).catch(() => setAiSugg([])).finally(() => setAiLoading(false));
  }, [mode, aiSugg.length, aiLoading]);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); if (tmRef.current) clearTimeout(tmRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  // ─── Results phase ────────────────────────────────────────────────────────────
  if (phase === 'results') return <ROMResults results={results} interp={interp} interpErr={interpErr} saved={saved} onRepeat={() => { setPhase('intro'); setSelected(new Set()); }} />;

  // ─── Analysing ────────────────────────────────────────────────────────────────
  if (phase === 'analysing') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ fontFamily: "'Space Mono',monospace", color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Analysing with Clinical AI…</div>
    </div>
  );

  // ─── Reviewing ────────────────────────────────────────────────────────────────
  if (phase === 'reviewing') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '100px 24px 80px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontSize: '0.72rem', fontFamily: "'Space Mono',monospace", color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>REVIEW</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: 6 }}>{Object.keys(captured).length} / {queueRef.current.length} Captured</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: 20 }}>Retake any measurement, then proceed to AI analysis.</p>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {['Joint', 'Movement', 'Side', 'Angle', 'Normal', ''].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace", letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {queueRef.current.map(t => {
                const a = captured[t.key]; const st = a !== undefined ? romStatus(a, t) : null;
                return <tr key={t.key} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '9px 14px', fontSize: '0.84rem', color: 'var(--text-primary)' }}>{t.joint}</td>
                  <td style={{ padding: '9px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.movement}</td>
                  <td style={{ padding: '9px 14px' }}><span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', background: t.side === 'right' ? 'rgba(77,184,255,0.1)' : 'rgba(167,139,250,0.1)', color: t.side === 'right' ? 'var(--blue-400)' : '#a78bfa' }}>{t.side}</span></td>
                  <td style={{ padding: '9px 14px', fontFamily: "'Space Mono',monospace", fontWeight: 600, color: st ? statusClr(st) : 'var(--text-tertiary)' }}>{a !== undefined ? `${a}°` : '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace" }}>{t.clinicalLabel}</td>
                  <td style={{ padding: '9px 14px' }}><button onClick={() => { void handleRetake(t.key); }} style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Retake</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { void handleStart(queueRef.current); }} style={{ padding: '11px 22px', borderRadius: 50, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.84rem' }}>Redo All</button>
          <button onClick={() => { void handleAnalyse(); }} disabled={Object.keys(captured).length === 0} style={{ padding: '11px 28px', borderRadius: 50, background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', border: 'none', color: '#000', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>Analyse with AI →</button>
        </div>
      </div>
    </div>
  );

  // ─── Capturing ────────────────────────────────────────────────────────────────
  if (phase === 'capturing') {
    const prog = Math.round(((tidx + 1) / queueRef.current.length) * 100);
    const aStatus = angle !== null && cur ? romStatus(angle, cur) : null;
    return (
      <div style={{ minHeight: '100vh', background: '#000', paddingTop: 72, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {camErr ? <div style={{ color: '#FF4444', padding: 40 }}>{camErr}</div> : <>
          <div style={{ position: 'relative', width: '100%', maxWidth: 800 }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 12, display: 'block' }} />
            <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            {angle !== null && <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(5,8,16,0.85)', border: `2px solid ${aStatus ? statusClr(aStatus) : 'var(--teal-500)'}`, borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '2rem', fontWeight: 700, color: aStatus ? statusClr(aStatus) : 'var(--teal-500)' }}>{angle}°</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>LIVE</div>
            </div>}
            {cntdn !== null && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: "'Space Mono',monospace", fontSize: '5rem', fontWeight: 700, color: '#FFB830', textShadow: '0 0 30px rgba(255,184,48,0.8)' }}>{cntdn}</div>}
            {isHold && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: "'Space Mono',monospace", fontSize: '2.5rem', fontWeight: 700, color: '#00E676', textShadow: '0 0 30px rgba(0,230,118,0.8)' }}>HOLD ✓</div>}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: '0 0 12px 12px' }}>
              <div style={{ height: '100%', width: `${prog}%`, background: 'var(--teal-500)', transition: 'width 0.5s', borderRadius: '0 0 12px 12px' }} />
            </div>
          </div>
          {cur && <div style={{ marginTop: 16, maxWidth: 800, width: '100%', padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.7rem', color: 'var(--teal-500)', background: 'var(--teal-dim)', border: '1px solid var(--border-teal)', borderRadius: 20, padding: '3px 10px' }}>{tidx + 1}/{queueRef.current.length}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em', background: cur.side === 'right' ? 'rgba(77,184,255,0.1)' : 'rgba(167,139,250,0.1)', color: cur.side === 'right' ? 'var(--blue-400)' : '#a78bfa', border: `1px solid ${cur.side === 'right' ? 'rgba(77,184,255,0.25)' : 'rgba(167,139,250,0.25)'}` }}>{cur.side}</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{cur.joint} {cur.movement}</span>
            </div>
            <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid var(--border-teal)', borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{cur.voiceCue}"</div>
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace" }}>NORMAL: {cur.clinicalLabel} · Move to max range, then HOLD</div>
          </div>}
        </>}
      </div>
    );
  }

  // ─── Intro — mode switcher + mode UI ─────────────────────────────────────────
  const selfQueue  = buildQueue(selected);
  const aiQueue    = buildQueue(new Set(aiSugg.map(s => s.region)));
  const allQueue   = ALL_TESTS;

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 0', borderRadius: 50, fontSize: '0.82rem', fontWeight: active ? 600 : 400,
    border: 'none', cursor: 'pointer',
    background: active ? 'var(--teal-500)' : 'transparent',
    color: active ? '#000' : 'var(--text-secondary)',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: 100, paddingBottom: 60, padding: '100px 24px 60px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ fontSize: '0.72rem', fontFamily: "'Space Mono',monospace", color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>ACTIVE ROM ASSESSMENT</div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '2rem', color: 'var(--text-primary)', marginBottom: 20 }}>Range of Motion Test</h1>

        {/* Mode switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 50, padding: 4, marginBottom: 28 }}>
          {(['self-select','prescribed','ai-suggested'] as Mode[]).map(m => (
            <button key={m} style={TAB_STYLE(mode === m)} onClick={() => setMode(m)}>
              {m === 'self-select' ? 'Self-Select' : m === 'prescribed' ? 'Prescribed' : 'AI-Suggested'}
            </button>
          ))}
        </div>

        {/* Self-Select grid */}
        {mode === 'self-select' && <>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>Tap body regions to add to your test queue. Tests run proximal → distal.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
            {GRID_REGIONS.map(r => {
              const haTests = (REGION_MAP[r]?.length ?? 0) > 0;
              const isNew   = NEW_BADGE_REGIONS.has(r);
              const isOn    = selected.has(r);
              return (
                <button key={r} disabled={!haTests} onClick={() => setSelected(prev => { const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n; })}
                  style={{ position: 'relative', padding: '16px 10px', borderRadius: 12, border: `1px solid ${isOn ? 'var(--teal-500)' : 'var(--border-subtle)'}`, background: isOn ? 'rgba(0,212,170,0.08)' : 'var(--bg-surface)', color: haTests ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: haTests ? 'pointer' : 'default', fontSize: '0.84rem', fontFamily: "'Figtree',sans-serif", fontWeight: isOn ? 600 : 400, textAlign: 'center', opacity: haTests ? 1 : 0.45, transition: 'all 0.18s' }}>
                  {isNew && haTests && <span style={{ position: 'absolute', top: 6, right: 6, fontSize: '0.5rem', fontWeight: 600, padding: '1px 5px', borderRadius: 8, background: 'var(--teal-500)', color: '#000', letterSpacing: '0.06em' }}>NEW</span>}
                  {r}
                  {haTests && <div style={{ fontSize: '0.62rem', color: isOn ? 'var(--teal-500)' : 'var(--text-tertiary)', marginTop: 4, fontFamily: "'Space Mono',monospace" }}>{REGION_MAP[r]!.length} tests</div>}
                  {!haTests && <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Coming soon</div>}
                </button>
              );
            })}
          </div>
          {selfQueue.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace", marginBottom: 16 }}>
              Queue: {selfQueue.map(t => `${t.joint} ${t.movement}`).join(' · ')}
            </div>
          )}
          <button onClick={() => { void handleStart(selfQueue); }} disabled={selfQueue.length === 0}
            style={{ background: selfQueue.length > 0 ? 'linear-gradient(135deg,var(--teal-500),var(--blue-400))' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 50, padding: '14px 40px', fontSize: '0.9rem', fontWeight: 600, color: selfQueue.length > 0 ? '#000' : 'var(--text-tertiary)', cursor: selfQueue.length > 0 ? 'pointer' : 'default' }}>
            {selfQueue.length > 0 ? `Start ${selfQueue.length} tests` : 'Select at least 1 region'}
          </button>
        </>}

        {/* Prescribed */}
        {mode === 'prescribed' && <>
          <div style={{ background: 'rgba(77,184,255,0.06)', border: '1px solid rgba(77,184,255,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.7rem', fontFamily: "'Space Mono',monospace", color: 'var(--blue-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Standard Protocol</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>Full ROM screen — all {ALL_TESTS.length} joints · {ALL_TESTS.length} measurements</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>Allow 15–20 minutes · Norkin &amp; White 2016 reference values</div>
          </div>
          <div style={{ background: 'rgba(255,184,48,0.07)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: '0.8rem', color: '#FFB830', lineHeight: 1.5 }}>
            ⚠ Camera estimates have ±5–10° precision. Not a substitute for clinical goniometry. Stop if you feel pain.
          </div>
          <button onClick={() => { void handleStart(allQueue); }} style={{ background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', border: 'none', borderRadius: 50, padding: '14px 40px', fontSize: '0.9rem', fontWeight: 600, color: '#000', cursor: 'pointer' }}>
            Begin Full Assessment
          </button>
        </>}

        {/* AI-Suggested */}
        {mode === 'ai-suggested' && <>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>Haiku analyses your posture findings, last ROM deficits, and pain check-in to recommend the most clinically relevant tests.</p>
          {aiLoading && <div style={{ fontFamily: "'Space Mono',monospace", color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: 20 }}>Generating suggestions…</div>}
          {aiSugg.map((s, i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,212,170,0.1)', color: 'var(--teal-500)', border: '1px solid var(--border-teal)' }}>{s.sourceBadge}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(77,184,255,0.1)', color: 'var(--blue-400)', border: '1px solid rgba(77,184,255,0.2)' }}>Grade {s.evidenceGrade}</span>
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{s.region}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', fontStyle: 'italic', margin: '0 0 8px' }}>{s.reasoning}</p>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace", marginBottom: 10 }}>{s.citation}</div>
              <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: 'rgba(0,212,170,0.1)', border: '1px solid var(--border-teal)', color: 'var(--teal-500)', fontSize: '0.72rem', fontWeight: 600 }}>
                → {(REGION_MAP[s.region] ?? []).length} tests recommended
              </div>
            </div>
          ))}
          {!aiLoading && aiSugg.length > 0 && (
            <button onClick={() => { void handleStart(aiQueue); }} disabled={aiQueue.length === 0}
              style={{ marginTop: 8, background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', border: 'none', borderRadius: 50, padding: '14px 40px', fontSize: '0.9rem', fontWeight: 600, color: '#000', cursor: 'pointer' }}>
              Start {aiQueue.length} Suggested Tests
            </button>
          )}
        </>}
      </div>
    </div>
  );
}

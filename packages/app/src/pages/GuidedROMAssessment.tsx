import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@physiocore/supabase';
import { useAuth } from '../hooks/useAuth.js';
import { useUserProfile } from '../hooks/useUserProfile.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type MPLandmark = { x: number; y: number; z: number; visibility?: number };
interface Landmarker {
  detectForVideo(el: HTMLVideoElement, ts: number): { landmarks: MPLandmark[][] };
  close(): void;
}
type Phase = 'intro' | 'capturing' | 'reviewing' | 'analysing' | 'results';

interface ROMTest {
  key: string; joint: string; movement: string; side: 'right' | 'left';
  view: 'anterior' | 'lateral-right' | 'lateral-left'; voiceCue: string;
  normalMin: number; normalMax: number; higherIsBetter: boolean;
  lmA: number; lmB: number; lmC: number; clinicalLabel: string;
}
interface ROMResult {
  key: string; joint: string; movement: string; side: 'right' | 'left';
  angle: number; clinicalLabel: string; status: 'normal' | 'mild' | 'significant';
}
interface Asymmetry { movement: string; joint: string; rightDeg: number; leftDeg: number; diff: number; }
interface Interp {
  summary: string;
  findings: { joint: string; finding: string }[];
  soap: string;
  overallRisk: 'low' | 'moderate' | 'high';
  referral: boolean;
}

// ─── 8-test configuration: 4 bilateral joints ────────────────────────────────

const TESTS: ROMTest[] = [
  { key:'sflex-r', joint:'Shoulder', movement:'Flexion',   side:'right', view:'lateral-right',
    voiceCue:'RIGHT side to camera. Raise right arm forward and up as high as possible. Hold.',
    normalMin:155, normalMax:180, higherIsBetter:true,  lmA:24, lmB:12, lmC:14, clinicalLabel:'160–180°' },
  { key:'sflex-l', joint:'Shoulder', movement:'Flexion',   side:'left',  view:'lateral-left',
    voiceCue:'LEFT side to camera. Raise left arm forward and up as high as possible. Hold.',
    normalMin:155, normalMax:180, higherIsBetter:true,  lmA:23, lmB:11, lmC:13, clinicalLabel:'160–180°' },
  { key:'sabd-r',  joint:'Shoulder', movement:'Abduction', side:'right', view:'anterior',
    voiceCue:'Face the camera. Raise RIGHT arm straight out to the side as high as possible. Hold.',
    normalMin:155, normalMax:180, higherIsBetter:true,  lmA:24, lmB:12, lmC:14, clinicalLabel:'160–180°' },
  { key:'sabd-l',  joint:'Shoulder', movement:'Abduction', side:'left',  view:'anterior',
    voiceCue:'Lower arm. Raise LEFT arm out to the side as high as possible. Hold.',
    normalMin:155, normalMax:180, higherIsBetter:true,  lmA:23, lmB:11, lmC:13, clinicalLabel:'160–180°' },
  { key:'hflex-r', joint:'Hip',      movement:'Flexion',   side:'right', view:'lateral-right',
    voiceCue:'RIGHT side to camera. Lift RIGHT knee toward your chest as high as you can. Hold.',
    normalMin:55,  normalMax:70,  higherIsBetter:false, lmA:12, lmB:24, lmC:26, clinicalLabel:'110–125°' },
  { key:'hflex-l', joint:'Hip',      movement:'Flexion',   side:'left',  view:'lateral-left',
    voiceCue:'LEFT side to camera. Lift LEFT knee toward chest as high as you can. Hold.',
    normalMin:55,  normalMax:70,  higherIsBetter:false, lmA:11, lmB:23, lmC:25, clinicalLabel:'110–125°' },
  { key:'kflex-r', joint:'Knee',     movement:'Flexion',   side:'right', view:'lateral-right',
    voiceCue:'RIGHT side to camera. Bend RIGHT knee — heel toward your buttock. Hold.',
    normalMin:30,  normalMax:50,  higherIsBetter:false, lmA:24, lmB:26, lmC:28, clinicalLabel:'130–145°' },
  { key:'kflex-l', joint:'Knee',     movement:'Flexion',   side:'left',  view:'lateral-left',
    voiceCue:'LEFT side to camera. Bend LEFT knee — heel toward your buttock. Hold.',
    normalMin:30,  normalMax:50,  higherIsBetter:false, lmA:23, lmB:25, lmC:27, clinicalLabel:'130–145°' },
];

const BONES: [number,number][] = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[0,7],[0,8]];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function speak(t: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.rate = 0.92; u.pitch = 1.05;
  window.speechSynthesis.speak(u);
}

function beep(isHold: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = isHold ? 880 : 440; g.gain.value = 0.18;
    osc.start(); osc.stop(ctx.currentTime + (isHold ? 0.22 : 0.09));
  } catch { /* ignore */ }
}

function liveAngle(lms: MPLandmark[], t: ROMTest): number {
  const a = lms[t.lmA], b = lms[t.lmB], c = lms[t.lmC];
  if (!a || !b || !c) return 0;
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  return Math.round(Math.acos(Math.min(1, Math.max(-1, mag < 1e-6 ? 1 : dot / mag))) * 180 / Math.PI);
}

function romStatus(angle: number, t: ROMTest): ROMResult['status'] {
  const ok = t.higherIsBetter ? angle >= t.normalMin : angle <= t.normalMax;
  if (ok) return 'normal';
  const mild = t.higherIsBetter ? angle >= t.normalMin - 15 : angle <= t.normalMax + 20;
  return mild ? 'mild' : 'significant';
}
const statusClr = (s: ROMResult['status']) =>
  s === 'normal' ? '#00D4AA' : s === 'mild' ? '#FFB830' : '#FF4444';

async function loadLandmarker(): Promise<Landmarker> {
  // @ts-ignore — CDN ESM import, no type declarations
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs') as {
    FilesetResolver: { forVisionTasks(b: string): Promise<unknown> };
    PoseLandmarker: { createFromOptions(fs: unknown, opts: unknown): Promise<Landmarker> };
  };
  const fs = await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  return mod.PoseLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1,
  });
}

// ─── Movement SVG guides ──────────────────────────────────────────────────────

function MovementGuide({ testKey }: { testKey: string }) {
  const type = testKey.startsWith('sflex') ? 'sflex' : testKey.startsWith('sabd') ? 'sabd' : testKey.startsWith('hflex') ? 'hflex' : 'kflex';
  const S  = { stroke:'#4DB8FF', strokeWidth:3, fill:'none', strokeLinecap:'round' as const };
  const Sg = { stroke:'rgba(136,146,164,0.6)', strokeWidth:2.5, fill:'none', strokeLinecap:'round' as const };
  const base = <>
    <circle cx="50" cy="16" r="9" {...Sg}/>
    <line x1="50" y1="25" x2="50" y2="70" {...Sg}/>
    <line x1="35" y1="58" x2="65" y2="58" {...Sg}/>
    <line x1="35" y1="58" x2="30" y2="108" {...Sg}/>
    <line x1="65" y1="58" x2="70" y2="108" {...Sg}/>
  </>;
  if (type === 'sflex') return (
    <svg viewBox="0 0 100 128" width={88} height={112}>
      <style>{`@keyframes sflex{0%,100%{transform:rotate(25deg)}50%{transform:rotate(-145deg)}}`}</style>
      {base}
      <line x1="50" y1="38" x2="34" y2="54" {...Sg}/>
      <g style={{transformOrigin:'50px 38px',animation:'sflex 2s ease-in-out infinite'}}>
        <line x1="50" y1="38" x2="70" y2="54" {...S}/>
        <line x1="70" y1="54" x2="80" y2="63" {...S}/>
      </g>
    </svg>
  );
  if (type === 'sabd') return (
    <svg viewBox="0 0 100 128" width={88} height={112}>
      <style>{`@keyframes sabd{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-150deg)}}`}</style>
      {base}
      <line x1="50" y1="38" x2="34" y2="54" {...Sg}/>
      <g style={{transformOrigin:'50px 38px',animation:'sabd 2s ease-in-out infinite'}}>
        <line x1="50" y1="38" x2="70" y2="54" {...S}/>
        <line x1="70" y1="54" x2="80" y2="60" {...S}/>
      </g>
    </svg>
  );
  if (type === 'hflex') return (
    <svg viewBox="0 0 100 128" width={88} height={112}>
      <style>{`@keyframes hflex{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-115deg)}}`}</style>
      {base}
      <line x1="50" y1="38" x2="34" y2="54" {...Sg}/><line x1="50" y1="38" x2="66" y2="54" {...Sg}/>
      <line x1="65" y1="58" x2="70" y2="108" {...Sg}/>
      <g style={{transformOrigin:'35px 58px',animation:'hflex 2s ease-in-out infinite'}}>
        <line x1="35" y1="58" x2="32" y2="93" {...S}/>
        <line x1="32" y1="93" x2="29" y2="108" {...S}/>
      </g>
    </svg>
  );
  return (
    <svg viewBox="0 0 100 128" width={88} height={112}>
      <style>{`@keyframes kflex{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-130deg)}}`}</style>
      {base}
      <line x1="50" y1="38" x2="34" y2="54" {...Sg}/><line x1="50" y1="38" x2="66" y2="54" {...Sg}/>
      <line x1="65" y1="58" x2="70" y2="108" {...Sg}/>
      <line x1="35" y1="58" x2="30" y2="90" {...Sg}/>
      <g style={{transformOrigin:'30px 90px',animation:'kflex 2s ease-in-out infinite'}}>
        <line x1="30" y1="90" x2="27" y2="110" {...S}/>
      </g>
    </svg>
  );
}

// ─── Angle color (continuous red → amber → green) ─────────────────────────────

function angleColor(angle: number, t: ROMTest): string {
  const pct = t.higherIsBetter
    ? (angle / t.normalMin) * 100
    : (t.normalMax / Math.max(angle, 1)) * 100;
  if (pct >= 100) return '#00D4AA';
  if (pct >= 88)  return '#4DB8FF';
  if (pct >= 72)  return '#FFB830';
  return '#FF4444';
}

// ─── Asymmetry clinical interpretation ───────────────────────────────────────

function asymmetryInterpretation(a: Asymmetry): string {
  const test = TESTS.find(t => t.joint === a.joint && t.movement === a.movement);
  const weakRight = test?.higherIsBetter ? a.rightDeg < a.leftDeg : a.rightDeg > a.leftDeg;
  const w = weakRight ? 'Right' : 'Left';
  if (a.joint === 'Shoulder' && a.movement === 'Flexion')
    return `${w} shoulder flexion is ${a.diff}° less than the opposite side. May indicate anterior capsular restriction, rotator cuff tightness, or glenohumeral hypomobility on the ${w.toLowerCase()} side.`;
  if (a.joint === 'Shoulder' && a.movement === 'Abduction')
    return `${w} shoulder abduction is ${a.diff}° restricted. Suggests possible subacromial impingement, supraspinatus weakness, or acromioclavicular restriction on the ${w.toLowerCase()} side.`;
  if (a.joint === 'Hip' && a.movement === 'Flexion')
    return `${w} hip flexion is ${a.diff}° less than the opposite side. May indicate iliopsoas restriction, hip flexor tightness, anterior labral pathology, or early hip osteoarthritis on the ${w.toLowerCase()} side.`;
  if (a.joint === 'Knee' && a.movement === 'Flexion')
    return `${w} knee flexion is ${a.diff}° restricted. Suggests possible joint effusion, quadriceps tightness, posterior capsule restriction, or meniscal pathology on the ${w.toLowerCase()} side.`;
  return `${w} ${a.joint.toLowerCase()} ${a.movement.toLowerCase()} is ${a.diff}° less than the opposite side. Further clinical assessment recommended.`;
}

function computeAsymmetries(results: ROMResult[]): Asymmetry[] {
  const joints = [...new Set(results.map(r => `${r.joint}|${r.movement}`))];
  return joints.flatMap(jk => {
    const [joint, movement] = jk.split('|') as [string, string];
    const R = results.find(r => r.joint === joint && r.movement === movement && r.side === 'right');
    const L = results.find(r => r.joint === joint && r.movement === movement && r.side === 'left');
    if (!R || !L) return [];
    const diff = Math.abs(R.angle - L.angle);
    return diff >= 10 ? [{ joint, movement, rightDeg: R.angle, leftDeg: L.angle, diff }] : [];
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuidedROMAssessment() {
  const navigate    = useNavigate();
  const { user }   = useAuth();
  const { userProfile } = useUserProfile();

  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const lmRef      = useRef<Landmarker | null>(null);
  const lastLmsRef = useRef<MPLandmark[] | null>(null);
  const rafRef     = useRef<number>(0);
  const tmRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase]       = useState<Phase>('intro');
  const [tidx, setTidx]         = useState(0);
  const [cntdn, setCntdn]       = useState<number | null>(null);
  const [isHold, setIsHold]     = useState(false);
  const [angle, setAngle]       = useState<number | null>(null);
  const [captured, setCaptured] = useState<Record<string, number>>({});
  const [camErr, setCamErr]     = useState<string | null>(null);
  const [results, setResults]   = useState<ROMResult[]>([]);
  const [interp, setInterp]     = useState<Interp | null>(null);
  const [interpErr, setInterpErr] = useState<string | null>(null);
  const [saved, setSaved]       = useState(false);
  const [exportingPdf, setExportingPdf] = useState<'patient' | 'clinician' | null>(null);

  const cur = TESTS[tidx]!;

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

  const renderLoop = useCallback((ti: number) => {
    const v = videoRef.current, c = overlayRef.current;
    if (!v || !c || v.readyState < 2) { rafRef.current = requestAnimationFrame(() => renderLoop(ti)); return; }
    c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
    const ctx = c.getContext('2d'); if (!ctx) { rafRef.current = requestAnimationFrame(() => renderLoop(ti)); return; }
    ctx.clearRect(0, 0, c.width, c.height);
    if (lmRef.current) {
      try {
        const r = lmRef.current.detectForVideo(v, performance.now()), lms = r.landmarks[0];
        lastLmsRef.current = lms ?? null;
        if (lms) {
          const [w, h] = [c.width, c.height];
          ctx.strokeStyle = 'rgba(0,212,170,0.75)'; ctx.lineWidth = 2;
          for (const [a, b] of BONES) {
            const la = lms[a], lb = lms[b];
            if (!la || !lb) continue;
            ctx.beginPath(); ctx.moveTo(la.x * w, la.y * h); ctx.lineTo(lb.x * w, lb.y * h); ctx.stroke();
          }
          ctx.fillStyle = '#00D4AA';
          for (const lm of lms) { if (!lm || (lm.visibility ?? 1) < 0.3) continue; ctx.beginPath(); ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2); ctx.fill(); }
          const tst = TESTS[ti]; if (tst) setAngle(liveAngle(lms, tst));
        }
      } catch { /**/ }
    }
    rafRef.current = requestAnimationFrame(() => renderLoop(ti));
  }, []);

  const runTest = useCallback((idx: number, onDone: () => void) => {
    const tst = TESTS[idx]!; setTidx(idx); setIsHold(false); setCntdn(null); setAngle(null);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => renderLoop(idx));
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

  const runAll = useCallback((si: number) => {
    if (si >= TESTS.length) {
      speak('All measurements complete. Excellent work.');
      tmRef.current = setTimeout(() => { stopCamera(); setPhase('reviewing'); }, 1500);
      return;
    }
    const prev = TESTS[si - 1], curr = TESTS[si]!;
    const viewChanged = prev && prev.view !== curr.view;
    if (viewChanged) {
      const msg = curr.view === 'lateral-right' ? 'Now turn your RIGHT side to face the camera.'
        : curr.view === 'lateral-left' ? 'Now turn your LEFT side to face the camera.'
        : 'Face the camera again.';
      speak(msg);
    }
    tmRef.current = setTimeout(() => runTest(si, () => { tmRef.current = setTimeout(() => runAll(si + 1), 2000); }), viewChanged ? 3500 : 500);
  }, [runTest, stopCamera]);

  const handleStart = useCallback(async () => {
    setPhase('capturing'); setCaptured({}); setCamErr(null); setSaved(false);
    await startCamera();
    loadLandmarker().then(lm => { lmRef.current = lm; }).catch(() => {});
    rafRef.current = requestAnimationFrame(() => renderLoop(0));
    speak('Starting ROM assessment. Stand two to three metres from the camera.');
    tmRef.current = setTimeout(() => runAll(0), 3000);
  }, [startCamera, renderLoop, runAll]);

  const handleRetake = useCallback(async (key: string) => {
    const idx = TESTS.findIndex(t => t.key === key); if (idx < 0) return;
    setPhase('capturing');
    await startCamera();
    loadLandmarker().then(lm => { lmRef.current = lm; }).catch(() => {});
    speak('Retaking. Get ready.');
    tmRef.current = setTimeout(() => runTest(idx, () => {
      speak('Captured.'); tmRef.current = setTimeout(() => { stopCamera(); setPhase('reviewing'); }, 1500);
    }), 2500);
  }, [startCamera, runTest, stopCamera]);

  const handleAnalyse = useCallback(async () => {
    const res: ROMResult[] = TESTS.filter(t => captured[t.key] !== undefined).map(t => ({
      key: t.key, joint: t.joint, movement: t.movement, side: t.side,
      angle: captured[t.key]!, clinicalLabel: t.clinicalLabel, status: romStatus(captured[t.key]!, t),
    }));
    setResults(res); setPhase('analysing');
    const asyms = computeAsymmetries(res);

    const key = (import.meta.env as Record<string, string | undefined>)['VITE_ANTHROPIC_KEY'] ?? '';
    const meas = res.map(r => `${r.joint} ${r.movement} (${r.side}): ${r.angle}° [norm ${r.clinicalLabel}] – ${r.status}`).join('\n');
    const asymStr = asyms.length ? '\nAsymmetries >10°:\n' + asyms.map(a => `  ${a.joint} ${a.movement}: R ${a.rightDeg}° vs L ${a.leftDeg}° (Δ${a.diff}°)`).join('\n') : '';
    const prompt = `You are a physiotherapist interpreting camera-based active ROM (MediaPipe, ±5–10° precision).

Measurements:
${meas}${asymStr}

Respond with JSON only — no markdown:
{"summary":"2–3 sentence clinical assessment","soap":"SOAP note: S:\\n...\\nO:\\n...\\nA:\\n...\\nP:\\n...","findings":[{"joint":"...","finding":"..."}],"overallRisk":"low|moderate|high","referral":true|false}`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
      });
      const j = await resp.json() as { content?: { type: string; text: string }[] };
      const txt = j.content?.[0]?.text ?? '{}';
      const parsed = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Partial<Interp>;
      setInterp({
        summary: parsed.summary ?? 'Assessment complete.',
        soap: parsed.soap ?? '',
        findings: parsed.findings ?? [],
        overallRisk: parsed.overallRisk ?? 'low',
        referral: parsed.referral ?? false,
      });
    } catch { setInterpErr('AI interpretation unavailable.'); }

    if (user) {
      try {
        await db.from('rom_assessments').insert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          measurements: captured,
          results: res,
          asymmetries: asyms,
        });
        setSaved(true);
      } catch { /**/ }
    }
    setPhase('results');
  }, [captured, user]);

  const handleExportPdf = useCallback(async (variant: 'patient' | 'clinician') => {
    if (!interp) return;
    setExportingPdf(variant);
    try {
      const dateStr = new Date().toISOString().split('T')[0]!;
      const firstName = userProfile?.name?.split(' ')[0] ?? 'Patient';
      const fileName = variant === 'clinician'
        ? `${firstName}_ROMReport_Clinical_${dateStr}.pdf`
        : `${firstName}_ROMReport_${dateStr}.pdf`;
      const [{ pdf }, { ROMReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../components/ROMReportPDF.js'),
      ]);
      const blob = await pdf(
        // @ts-ignore dynamic import
        <ROMReportPDF results={results} asymmetries={computeAsymmetries(results)} interp={interp} userName={userProfile?.name ?? 'Patient'} variant={variant} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('PDF export failed:', err); }
    finally { setExportingPdf(null); }
  }, [interp, results, userProfile]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (tmRef.current) clearTimeout(tmRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ─── Intro ────────────────────────────────────────────────────────────────────

  if (phase === 'intro') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '100px 24px 60px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontSize: '0.72rem', fontFamily: "'Space Mono',monospace", color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>GUIDED ROM ASSESSMENT</div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '2rem', color: 'var(--text-primary)', marginBottom: 16 }}>Range of Motion Test</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 12 }}>
          Camera-guided active ROM for 4 bilateral joints: shoulder flexion, shoulder abduction, hip flexion, knee flexion.
          Voice cues guide each movement. Results compared to <em>Norkin &amp; White 2016</em> reference values.
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 24 }}>
          Allow <strong style={{ color: 'var(--text-primary)' }}>10 minutes</strong> in a clear space 2–3 m from the camera. Claude Sonnet analysis included.
        </p>
        <div style={{ background: 'rgba(255,184,48,0.07)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 28, fontSize: '0.8rem', color: '#FFB830', lineHeight: 1.5 }}>
          ⚠ Camera estimates ±5–10° precision. Not a substitute for clinical goniometry. Stop if you feel pain.
        </div>
        <button onClick={() => { void handleStart(); }} style={{ background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', border: 'none', borderRadius: 50, padding: '14px 40px', fontSize: '0.9rem', fontWeight: 600, color: '#000', cursor: 'pointer' }}>
          Begin Assessment
        </button>
      </div>
    </div>
  );

  // ─── Capturing ────────────────────────────────────────────────────────────────

  if (phase === 'capturing') {
    const prog = Math.round(((tidx + 1) / TESTS.length) * 100);
    const aStatus = angle !== null ? romStatus(angle, cur) : null;
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
          <div style={{ marginTop: 16, maxWidth: 800, width: '100%', padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.7rem', color: 'var(--teal-500)', background: 'var(--teal-dim)', border: '1px solid var(--border-teal)', borderRadius: 20, padding: '3px 10px' }}>{tidx + 1}/{TESTS.length}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em', background: cur.side === 'right' ? 'rgba(77,184,255,0.1)' : 'rgba(167,139,250,0.1)', color: cur.side === 'right' ? 'var(--blue-400)' : '#a78bfa', border: `1px solid ${cur.side === 'right' ? 'rgba(77,184,255,0.25)' : 'rgba(167,139,250,0.25)'}` }}>{cur.side}</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{cur.joint} {cur.movement}</span>
            </div>
            <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid var(--border-teal)', borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{cur.voiceCue}"</div>
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace" }}>NORMAL: {cur.clinicalLabel} · Move to max range, then HOLD</div>
          </div>
        </>}
      </div>
    );
  }

  // ─── Reviewing ────────────────────────────────────────────────────────────────

  if (phase === 'reviewing') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '100px 24px 80px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontSize: '0.72rem', fontFamily: "'Space Mono',monospace", color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>REVIEW</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: 6 }}>{Object.keys(captured).length} / {TESTS.length} Captured</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: 20 }}>Retake any measurement, then proceed to AI analysis.</p>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {['Joint', 'Movement', 'Side', 'Angle', 'Normal', ''].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace", letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {TESTS.map(t => {
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
          <button onClick={() => { void handleStart(); }} style={{ padding: '11px 22px', borderRadius: 50, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.84rem' }}>Redo All</button>
          <button onClick={() => { void handleAnalyse(); }} disabled={Object.keys(captured).length === 0} style={{ padding: '11px 28px', borderRadius: 50, background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', border: 'none', color: '#000', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>Analyse with AI →</button>
        </div>
      </div>
    </div>
  );

  // ─── Analysing ────────────────────────────────────────────────────────────────

  if (phase === 'analysing') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ fontFamily: "'Space Mono',monospace", color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Analysing with Claude Sonnet…</div>
    </div>
  );

  // ─── Results ──────────────────────────────────────────────────────────────────

  const asymmetries = computeAsymmetries(results);
  const riskClr = interp?.overallRisk === 'low' ? '#00D4AA' : interp?.overallRisk === 'moderate' ? '#FFB830' : '#FF4444';
  const joints = ['Shoulder', 'Hip', 'Knee'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '100px 24px 80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontSize: '0.72rem', fontFamily: "'Space Mono',monospace", color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>ROM RESULTS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1.8rem', color: 'var(--text-primary)', margin: 0 }}>Active ROM Report</h1>
          {interp && <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: `${riskClr}20`, color: riskClr, border: `1px solid ${riskClr}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{interp.overallRisk} risk</span>}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace", marginBottom: 20 }}>
          {new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} · Camera-based ±5–10° · Norkin &amp; White 2016
          {saved && <span style={{ marginLeft: 16, color: 'var(--teal-500)' }}>✓ Saved</span>}
        </div>

        {interp && <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid var(--border-teal)', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--teal-500)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Clinical Interpretation · Claude Sonnet</div>
          <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>{interp.summary}</p>
          {interp.referral && <div style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 8, fontSize: '0.8rem', color: '#FF4444' }}>⚠ Physiotherapy referral recommended.</div>}
        </div>}
        {interpErr && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: 14 }}>{interpErr}</div>}

        {/* Measurements table */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Syne',sans-serif" }}>Measurements</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {['Joint', 'Movement', 'Right', 'Left', 'Normal', 'Asymmetry'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace", letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {joints.flatMap(jnt => {
                const jr = results.filter(r => r.joint === jnt);
                const mvs = [...new Set(jr.map(r => r.movement))];
                return mvs.map(mv => {
                  const R = jr.find(r => r.movement === mv && r.side === 'right');
                  const L = jr.find(r => r.movement === mv && r.side === 'left');
                  const asym = R && L ? Math.abs(R.angle - L.angle) : null;
                  return <tr key={`${jnt}-${mv}`} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '11px 14px', fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 500 }}>{jnt}</td>
                    <td style={{ padding: '11px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{mv}</td>
                    <td style={{ padding: '11px 14px', fontFamily: "'Space Mono',monospace", fontWeight: 600, color: R ? statusClr(R.status) : 'var(--text-tertiary)' }}>
                      {R ? `${R.angle}°` : '—'}{R && R.status !== 'normal' && <span style={{ fontSize: '0.6rem', marginLeft: 3 }}>{R.status === 'mild' ? '⚠' : '✗'}</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: "'Space Mono',monospace", fontWeight: 600, color: L ? statusClr(L.status) : 'var(--text-tertiary)' }}>
                      {L ? `${L.angle}°` : '—'}{L && L.status !== 'normal' && <span style={{ fontSize: '0.6rem', marginLeft: 3 }}>{L.status === 'mild' ? '⚠' : '✗'}</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '0.76rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace" }}>{R?.clinicalLabel ?? L?.clinicalLabel}</td>
                    <td style={{ padding: '11px 14px', fontSize: '0.76rem', fontFamily: "'Space Mono',monospace", color: asym !== null && asym > 10 ? '#FFB830' : 'var(--text-tertiary)', fontWeight: asym !== null && asym > 10 ? 600 : 400 }}>
                      {asym !== null ? (asym > 10 ? `⚠ ${asym}°` : `${asym}°`) : '—'}
                    </td>
                  </tr>;
                });
              })}
            </tbody>
          </table>
        </div>

        {/* Asymmetry flags */}
        {asymmetries.length > 0 && <div style={{ background: 'rgba(255,184,48,0.06)', border: '1px solid rgba(255,184,48,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#FFB830', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Bilateral Asymmetries &gt;10°</div>
          {asymmetries.map((a, i) => <div key={i} style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{a.joint} {a.movement}:</strong> R {a.rightDeg}° vs L {a.leftDeg}° — Δ{a.diff}° asymmetry
          </div>)}
        </div>}

        {/* Joint findings */}
        {interp && interp.findings.length > 0 && <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Joint Findings</div>
          {interp.findings.map((f, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < interp.findings.length - 1 ? 10 : 0, paddingBottom: i < interp.findings.length - 1 ? 10 : 0, borderBottom: i < interp.findings.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: 'var(--teal-500)', background: 'var(--teal-dim)', border: '1px solid var(--border-teal)', borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>{f.joint}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', lineHeight: 1.5 }}>{f.finding}</span>
          </div>)}
        </div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => { void handleStart(); }} style={{ padding: '11px 22px', borderRadius: 50, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.84rem' }}>Repeat Assessment</button>
          <button onClick={() => { void handleExportPdf('patient'); }} disabled={!interp || exportingPdf !== null} style={{ padding: '11px 22px', borderRadius: 50, background: 'transparent', border: '1px solid var(--border-teal)', color: 'var(--teal-500)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}>
            {exportingPdf === 'patient' ? 'Generating…' : '↓ PDF — Patient'}
          </button>
          <button onClick={() => { void handleExportPdf('clinician'); }} disabled={!interp || exportingPdf !== null} style={{ padding: '11px 22px', borderRadius: 50, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}>
            {exportingPdf === 'clinician' ? 'Generating…' : '↓ PDF — Clinician'}
          </button>
          <button onClick={() => navigate('/assessment')} style={{ padding: '11px 24px', borderRadius: 50, background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', border: 'none', color: '#000', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}>Full Assessment →</button>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}

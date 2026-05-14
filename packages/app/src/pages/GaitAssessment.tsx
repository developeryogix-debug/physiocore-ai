// packages/app/src/pages/GaitAssessment.tsx
// Gait Assessment — 10-second walk, MediaPipe skeleton overlay, Claude Sonnet flags
//
// Supabase table (run once in SQL Editor):
//   CREATE TABLE IF NOT EXISTS gait_assessments (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id uuid REFERENCES auth.users(id),
//     date date, cadence numeric, step_symmetry numeric,
//     trunk_sway text, arm_swing text, trendelenburg text, heel_strike text,
//     antalgic boolean, antalgic_side text, data_quality text, frames_analysed integer,
//     flags jsonb, gait_deviations jsonb, clinical_summary text,
//     created_at timestamptz DEFAULT now()
//   );
//   ALTER TABLE gait_assessments ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "own" ON gait_assessments FOR ALL TO authenticated
//     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { supabase } from '@physiocore/supabase';
import { runGaitAnalysis } from '../lib/agents/assessmentClient.js';
import type { GaitMetricsSummary, GaitAnalysisOutput } from '../lib/agents/assessmentClient.js';

const db = supabase as any;
type Phase = 'intro' | 'walking' | 'analysing' | 'results';
type NLM = { x:number; y:number; z:number; visibility?:number };
interface Landmarker { detectForVideo(v:HTMLVideoElement,ts:number):{ landmarks:NLM[][] }; close():void; }
type Frame = { frameIndex:number; timestampMs:number; landmarks:NLM[] };

// ── MediaPipe CDN ─────────────────────────────────────────────────────────────
async function loadLandmarker(): Promise<Landmarker|null> {
  try {
    // @ts-expect-error CDN import
    const m = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs') as {
      FilesetResolver:{ forVisionTasks(p:string):Promise<unknown> };
      PoseLandmarker:{ createFromOptions(fs:unknown,o:unknown):Promise<Landmarker> };
    };
    const fs = await m.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
    return await m.PoseLandmarker.createFromOptions(fs, {
      baseOptions:{ modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate:'GPU' },
      runningMode:'VIDEO', numPoses:1,
    });
  } catch { return null; }
}
const BONES:[number,number][] = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const LM = { L_HIP:23, R_HIP:24, L_ANKLE:27, R_ANKLE:28, L_HEEL:29, R_HEEL:30, L_WRIST:15, R_WRIST:16 };

// ── Gait metric computation (browser-safe port of GaitAgent.ts) ───────────────
function vlm(f:Frame,idx:number):NLM|null { const p=f.landmarks[idx]; return p&&(p.visibility??1)>=0.35?p:null; }
function avg(a:number[]) { return a.length===0?0:a.reduce((x,y)=>x+y,0)/a.length; }
function rng(a:number[]) { return a.length===0?0:Math.max(...a)-Math.min(...a); }

function stepEvents(frames:Frame[], ankleIdx:number): number[] {
  const ev:number[]=[]; let lastMs=-Infinity;
  for (let i=1;i<frames.length-1;i++) {
    const pa=vlm(frames[i-1]!,ankleIdx), ca=vlm(frames[i]!,ankleIdx), na=vlm(frames[i+1]!,ankleIdx);
    if (!pa||!ca||!na) continue;
    if (ca.y>pa.y&&ca.y>na.y&&frames[i]!.timestampMs-lastMs>=250) { ev.push(i); lastMs=frames[i]!.timestampMs; }
  }
  return ev;
}

function computeMetrics(frames:Frame[]): GaitMetricsSummary {
  const u=frames.filter(f=>vlm(f,LM.L_ANKLE)||vlm(f,LM.R_ANKLE));
  if (u.length<15) return { cadence:0,stepSymmetry:0,trunkSway:'normal',armSwing:'symmetrical',trendelenburg:'absent',heelStrike:'normal',antalgic:false,antalgicSide:null,dataQuality:'insufficient',framesAnalysed:u.length };
  const ls=stepEvents(u,LM.L_ANKLE), rs=stepEvents(u,LM.R_ANKLE);
  const durMs=u[u.length-1]!.timestampMs-u[0]!.timestampMs;
  const cadence=Math.round((durMs>0?(ls.length+rs.length)/(durMs/60000):0)*10)/10;
  const lT=ls.slice(1).map((i,k)=>u[i]!.timestampMs-u[ls[k]!]!.timestampMs);
  const rT=rs.slice(1).map((i,k)=>u[i]!.timestampMs-u[rs[k]!]!.timestampMs);
  const mL=avg(lT),mR=avg(rT);
  const stepSymmetry=Math.round((mL>0&&mR>0?(Math.min(mL,mR)/Math.max(mL,mR))*100:0)*10)/10;
  const hx:number[]=[]; for (const f of u) { const lh=vlm(f,LM.L_HIP),rh=vlm(f,LM.R_HIP); if(lh&&rh) hx.push((lh.x+rh.x)/2); }
  const sw=rng(hx);
  const trunkSway=(sw<0.025?'normal':sw<0.05?'mild':sw<0.08?'moderate':'severe') as GaitMetricsSummary['trunkSway'];
  const lwx:number[]=[],rwx:number[]=[];
  for (const f of u) { const lw=vlm(f,LM.L_WRIST);if(lw)lwx.push(lw.x); const rw=vlm(f,LM.R_WRIST);if(rw)rwx.push(rw.x); }
  const lA=rng(lwx),rA=rng(rwx);
  const armSwing=(lA<0.012&&rA<0.012?'absent':lA<rA*0.5?'reduced_left':rA<lA*0.5?'reduced_right':'symmetrical') as GaitMetricsSummary['armSwing'];
  let lDrop=0,rDrop=0;
  for (const fi of rs) for (let s=Math.max(0,fi-5);s<fi;s++) { const f=u[s]!,lh=vlm(f,LM.L_HIP),rh=vlm(f,LM.R_HIP); if(lh&&rh){ const d=lh.y-rh.y; if(d>rDrop) rDrop=d; } }
  for (const fi of ls) for (let s=Math.max(0,fi-5);s<fi;s++) { const f=u[s]!,lh=vlm(f,LM.L_HIP),rh=vlm(f,LM.R_HIP); if(lh&&rh){ const d=rh.y-lh.y; if(d>lDrop) lDrop=d; } }
  const trendelenburg=(rDrop>0.04?'positive_right':lDrop>0.04?'positive_left':'absent') as GaitMetricsSummary['trendelenburg'];
  const hd:number[]=[]; for (const f of u) { const lh=vlm(f,LM.L_HEEL),la=vlm(f,LM.L_ANKLE);if(lh&&la)hd.push(lh.y-la.y); const rh=vlm(f,LM.R_HEEL),ra=vlm(f,LM.R_ANKLE);if(rh&&ra)hd.push(rh.y-ra.y); }
  const heelStrike=(avg(hd)<-0.015?'toe_strike':avg(hd)<0.005?'flat_foot':'normal') as GaitMetricsSummary['heelStrike'];
  const stAsy=mL>0&&mR>0?Math.abs(mL-mR)/Math.max(mL,mR):0; const antalgic=stAsy>0.2;
  const vis:number[]=[]; for (const f of u) for (const idx of Object.values(LM)) { const p=f.landmarks[idx];if(p) vis.push(p.visibility??1); }
  const mv=avg(vis);
  const dataQuality=(u.length<15?'insufficient':mv>0.7&&cadence>50?'good':mv>0.45?'acceptable':'poor') as GaitMetricsSummary['dataQuality'];
  return { cadence,stepSymmetry,trunkSway,armSwing,trendelenburg,heelStrike,antalgic,antalgicSide:antalgic?(mL<mR?'left':'right'):null,dataQuality,framesAnalysed:u.length };
}

// ── Status + display helpers ───────────────────────────────────────────────────
type Sev = 'normal'|'mild'|'significant';
function mStatus(k:string,m:GaitMetricsSummary): Sev {
  if(k==='cadence')       return m.cadence>=90&&m.cadence<=130?'normal':m.cadence>=70&&m.cadence<=150?'mild':'significant';
  if(k==='stepSymmetry')  return m.stepSymmetry>=90?'normal':m.stepSymmetry>=75?'mild':'significant';
  if(k==='trunkSway')     return m.trunkSway==='normal'?'normal':m.trunkSway==='mild'?'mild':'significant';
  if(k==='armSwing')      return m.armSwing==='symmetrical'?'normal':m.armSwing==='absent'?'significant':'mild';
  if(k==='trendelenburg') return m.trendelenburg==='absent'?'normal':'significant';
  if(k==='heelStrike')    return m.heelStrike==='normal'?'normal':m.heelStrike==='flat_foot'?'mild':'significant';
  if(k==='antalgic')      return m.antalgic?'significant':'normal';
  return 'normal';
}
function mVal(k:string,m:GaitMetricsSummary): string {
  if(k==='cadence')       return `${m.cadence} steps/min`;
  if(k==='stepSymmetry')  return `${m.stepSymmetry}%`;
  if(k==='trunkSway')     return m.trunkSway;
  if(k==='armSwing')      return m.armSwing.replace(/_/g,' ');
  if(k==='trendelenburg') return m.trendelenburg.replace(/_/g,' ');
  if(k==='heelStrike')    return m.heelStrike.replace(/_/g,' ');
  if(k==='antalgic')      return m.antalgic?`Yes — ${m.antalgicSide??''} side`:'No';
  return '—';
}
const SC=(s:Sev)=>s==='normal'?'#00D4AA':s==='mild'?'#FFB830':'#FF4444';
const METRICS=[
  {k:'cadence',       label:'Cadence',           normal:'90–130 steps/min'},
  {k:'stepSymmetry',  label:'Step Symmetry',      normal:'≥ 90%'},
  {k:'trunkSway',     label:'Trunk Sway',         normal:'Normal'},
  {k:'armSwing',      label:'Arm Swing',          normal:'Symmetrical'},
  {k:'trendelenburg', label:'Trendelenburg Sign',  normal:'Absent'},
  {k:'heelStrike',    label:'Heel Strike',        normal:'Normal'},
  {k:'antalgic',      label:'Antalgic Gait',      normal:'No'},
];
function speak(t:string){ if(!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t); u.rate=0.9; window.speechSynthesis.speak(u); }

// ── Component ──────────────────────────────────────────────────────────────────
export default function GaitAssessment() {
  const { user } = useAuth();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream|null>(null);
  const lmRef      = useRef<Landmarker|null>(null);
  const rafRef     = useRef<number>(0);
  const framesRef  = useRef<Frame[]>([]);
  const recRef     = useRef(false);
  const lastFTs    = useRef(0);
  const phaseTs    = useRef(0);
  const prevCnt    = useRef(12);

  const [phase, setPhase]     = useState<Phase>('intro');
  const [countdown, setCount] = useState(12);
  const [isRec, setIsRec]     = useState(false);
  const [camErr, setCamErr]   = useState<string|null>(null);
  const [metrics, setMetrics] = useState<GaitMetricsSummary|null>(null);
  const [analysis, setAnalysis] = useState<GaitAnalysisOutput|null>(null);
  const [saved, setSaved]     = useState(false);

  const stopCamera = useCallback(()=>{ cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; },[]);

  const analyseGait = useCallback(async (frames:Frame[])=>{
    setPhase('analysing');
    const m=computeMetrics(frames); setMetrics(m);
    const a=await runGaitAnalysis(m); setAnalysis(a);
    if (user) {
      try {
        await db.from('gait_assessments').insert({
          user_id:user.id, date:new Date().toISOString().split('T')[0],
          cadence:m.cadence, step_symmetry:m.stepSymmetry, trunk_sway:m.trunkSway,
          arm_swing:m.armSwing, trendelenburg:m.trendelenburg, heel_strike:m.heelStrike,
          antalgic:m.antalgic, antalgic_side:m.antalgicSide, data_quality:m.dataQuality,
          frames_analysed:m.framesAnalysed, flags:a.flags, gait_deviations:a.gaitDeviations, clinical_summary:a.clinicalSummary,
        });
        setSaved(true);
      } catch { /**/ }
    }
    setPhase('results');
  },[user]);

  const walkLoop = useCallback(()=>{
    const v=videoRef.current, c=overlayRef.current;
    if (!v||!c||v.readyState<2){ rafRef.current=requestAnimationFrame(walkLoop); return; }
    c.width=v.videoWidth||1280; c.height=v.videoHeight||720;
    const ctx=c.getContext('2d'); if(!ctx){ rafRef.current=requestAnimationFrame(walkLoop); return; }
    ctx.clearRect(0,0,c.width,c.height);
    const now=performance.now();
    if (lmRef.current) {
      try {
        const r=lmRef.current.detectForVideo(v,now); const lms=r.landmarks[0];
        if (lms) {
          ctx.strokeStyle='rgba(0,212,170,0.75)'; ctx.lineWidth=2;
          for (const [a,b] of BONES){ const la=lms[a],lb=lms[b]; if(!la||!lb) continue; ctx.beginPath(); ctx.moveTo(la.x*c.width,la.y*c.height); ctx.lineTo(lb.x*c.width,lb.y*c.height); ctx.stroke(); }
          ctx.fillStyle='#00D4AA';
          for (const p of lms){ if(!p||(p.visibility??1)<0.3) continue; ctx.beginPath(); ctx.arc(p.x*c.width,p.y*c.height,4,0,Math.PI*2); ctx.fill(); }
          if (recRef.current && now-lastFTs.current>100) {
            framesRef.current.push({ frameIndex:framesRef.current.length, timestampMs:now, landmarks:lms as NLM[] });
            lastFTs.current=now;
          }
        }
      } catch { /**/ }
    }
    const elapsed=now-phaseTs.current;
    if (elapsed>2000 && !recRef.current) { recRef.current=true; setIsRec(true); speak('Walk now. Keep walking for ten seconds.'); }
    if (elapsed>2000) {
      const recElapsed=elapsed-2000;
      const rem=Math.max(0,Math.ceil((10000-recElapsed)/1000));
      if (rem!==prevCnt.current){ prevCnt.current=rem; setCount(rem); }
      if (recElapsed>=10000){ cancelAnimationFrame(rafRef.current); recRef.current=false; stopCamera(); void analyseGait([...framesRef.current]); return; }
    }
    rafRef.current=requestAnimationFrame(walkLoop);
  },[analyseGait,stopCamera]);

  const handleStart = useCallback(async ()=>{
    framesRef.current=[]; recRef.current=false; prevCnt.current=12;
    setCamErr(null); setSaved(false); setMetrics(null); setAnalysis(null); setIsRec(false);
    try {
      const s=await navigator.mediaDevices.getUserMedia({ video:{width:{ideal:1280},height:{ideal:720}}, audio:false });
      streamRef.current=s;
      if (videoRef.current){ videoRef.current.srcObject=s; await videoRef.current.play(); }
    } catch { setCamErr('Camera access denied.'); return; }
    loadLandmarker().then(l=>{ lmRef.current=l; }).catch(()=>{});
    phaseTs.current=performance.now();
    setPhase('walking'); setCount(12);
    speak('Walk six metres in front of the camera. Get ready.');
    rafRef.current=requestAnimationFrame(walkLoop);
  },[walkLoop]);

  useEffect(()=>()=>{ cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach(t=>t.stop()); },[]);

  // ── Intro ────────────────────────────────────────────────────────────────────
  if (phase==='intro') return (
    <div style={{minHeight:'100vh',background:'var(--bg-void)',padding:'100px 24px 60px'}}>
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{fontSize:'0.72rem',fontFamily:"'Space Mono',monospace",color:'var(--teal-500)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>GAIT ANALYSIS</div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'2rem',color:'var(--text-primary)',marginBottom:16}}>Walking Assessment</h1>
        <p style={{color:'var(--text-secondary)',fontSize:'0.9rem',lineHeight:1.65,marginBottom:24}}>
          Walk 6 metres in front of your camera. MediaPipe tracks your gait for 10 seconds and measures cadence,
          step symmetry, trunk sway, arm swing, and Trendelenburg sign. Results compared to <em>Krebs DE et al. Phys Ther. 1985</em> normatives.
        </p>
        <div style={{background:'rgba(255,184,48,0.07)',border:'1px solid rgba(255,184,48,0.2)',borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:'0.8rem',color:'#FFB830',lineHeight:1.5}}>
          ⚠ Observational screening only (Grade B evidence). Not a substitute for clinical gait analysis. Stop if you feel pain.
        </div>
        <ul style={{color:'var(--text-secondary)',fontSize:'0.85rem',lineHeight:1.9,marginBottom:28,paddingLeft:20}}>
          <li>Clear 6+ metre path in front of the camera</li>
          <li>Camera at waist height, landscape orientation</li>
          <li>Walk at your normal everyday pace</li>
          <li>Wear your normal footwear</li>
        </ul>
        {camErr&&<p style={{color:'#FF4444',fontSize:'0.85rem',marginBottom:16}}>{camErr}</p>}
        <button onClick={()=>{ void handleStart(); }} style={{background:'linear-gradient(135deg,var(--teal-500),var(--blue-400))',border:'none',borderRadius:50,padding:'14px 40px',fontSize:'0.9rem',fontWeight:600,color:'#000',cursor:'pointer'}}>
          Begin Walk
        </button>
      </div>
    </div>
  );

  // ── Walking ──────────────────────────────────────────────────────────────────
  if (phase==='walking') return (
    <div style={{minHeight:'100vh',background:'#000',paddingTop:72,display:'flex',flexDirection:'column',alignItems:'center'}}>
      <div style={{position:'relative',width:'100%',maxWidth:860}}>
        <video ref={videoRef} muted playsInline style={{width:'100%',borderRadius:12,display:'block'}} />
        <canvas ref={overlayRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}} />
        <div style={{position:'absolute',top:12,left:12,background:'rgba(5,8,16,0.85)',borderRadius:8,padding:'6px 14px',fontSize:'0.78rem',fontFamily:"'Space Mono',monospace",color:isRec?'var(--teal-500)':'#FFB830'}}>
          {isRec?'● REC':'GET READY'}
        </div>
        {isRec&&<div style={{position:'absolute',top:12,right:12,background:'rgba(5,8,16,0.85)',borderRadius:10,padding:'8px 18px',textAlign:'center'}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:'2.5rem',fontWeight:700,color:'var(--teal-500)'}}>{countdown}</div>
          <div style={{fontSize:'0.62rem',color:'var(--text-tertiary)'}}>SEC LEFT</div>
        </div>}
      </div>
      <div style={{marginTop:16,maxWidth:860,width:'100%',padding:'0 16px'}}>
        <div style={{background:'rgba(0,212,170,0.06)',border:'1px solid rgba(0,212,170,0.2)',borderRadius:10,padding:'12px 16px',fontSize:'0.85rem',color:'var(--text-secondary)',fontStyle:'italic',textAlign:'center'}}>
          {isRec?'"Walk at your normal pace — keep going."':'"Stand behind the start line. Walk forward when ready."'}
        </div>
      </div>
    </div>
  );

  // ── Analysing ────────────────────────────────────────────────────────────────
  if (phase==='analysing') return (
    <div style={{minHeight:'100vh',background:'var(--bg-void)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
      <div style={{width:56,height:56,borderRadius:'50%',border:'3px solid #1a2535',borderTopColor:'var(--teal-500)',animation:'spin 1s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{color:'var(--teal-500)',fontWeight:600}}>Analysing gait pattern…</p>
      <p style={{color:'var(--text-secondary)',fontSize:'0.8rem'}}>{metrics?.framesAnalysed??0} frames · AI interpreting</p>
    </div>
  );

  // ── Results ──────────────────────────────────────────────────────────────────
  if (phase==='results'&&metrics&&analysis) {
    const dq=metrics.dataQuality;
    const dqClr=dq==='good'?'#00D4AA':dq==='acceptable'?'#FFB830':'#FF4444';
    return (
      <div style={{minHeight:'100vh',background:'var(--bg-void)',padding:'100px 24px 60px'}}>
        <div style={{maxWidth:760,margin:'0 auto'}}>
          <div style={{fontSize:'0.72rem',fontFamily:"'Space Mono',monospace",color:'var(--teal-500)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>GAIT ANALYSIS</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:8}}>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'1.75rem',color:'var(--text-primary)'}}>Results</h1>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{padding:'3px 10px',borderRadius:20,fontSize:'0.72rem',fontWeight:600,background:`${dqClr}20`,color:dqClr}}>{dq.toUpperCase()} DATA</span>
              {saved&&<span style={{fontSize:'0.72rem',color:'var(--teal-500)'}}>Saved ✓</span>}
            </div>
          </div>

          {/* Metrics table */}
          <div style={{background:'var(--bg-surface)',border:'1px solid #1a2535',borderRadius:12,overflow:'hidden',marginBottom:20}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1.5fr 1fr'}}>
              {['Metric','Value','Normal Range','Status'].map(h=>(
                <div key={h} style={{padding:'10px 16px',background:'#1a2535',fontSize:'0.72rem',fontWeight:600,color:'var(--text-secondary)',letterSpacing:'0.05em',textTransform:'uppercase',borderBottom:'1px solid #2a3448'}}>{h}</div>
              ))}
              {METRICS.map(({k,label,normal},i)=>{
                const st=mStatus(k,metrics);
                return [
                  <div key={`l${i}`} style={{padding:'12px 16px',fontSize:'0.85rem',fontWeight:500,borderBottom:'1px solid #1a2535',color:'var(--text-primary)'}}>{label}</div>,
                  <div key={`v${i}`} style={{padding:'12px 16px',fontSize:'0.85rem',fontFamily:"'Space Mono',monospace",borderBottom:'1px solid #1a2535',color:'var(--text-primary)'}}>{mVal(k,metrics)}</div>,
                  <div key={`n${i}`} style={{padding:'12px 16px',fontSize:'0.8rem',borderBottom:'1px solid #1a2535',color:'var(--text-secondary)'}}>{normal}</div>,
                  <div key={`s${i}`} style={{padding:'12px 16px',borderBottom:'1px solid #1a2535'}}>
                    <span style={{padding:'3px 8px',borderRadius:4,fontSize:'0.7rem',fontWeight:600,background:`${SC(st)}20`,color:SC(st)}}>{st}</span>
                  </div>,
                ];
              })}
            </div>
          </div>

          {/* Clinical flags */}
          {analysis.flags.length>0&&(
            <div style={{background:'rgba(255,184,48,0.07)',border:'1px solid rgba(255,184,48,0.2)',borderRadius:10,padding:'1rem',marginBottom:16}}>
              <p style={{fontWeight:600,fontSize:'0.85rem',color:'#FFB830',marginBottom:'0.5rem'}}>Clinical Flags</p>
              {analysis.flags.map((f,i)=><p key={i} style={{fontSize:'0.82rem',color:'var(--text-secondary)',marginBottom:'0.25rem'}}>• {f}</p>)}
            </div>
          )}

          {/* Referral flags */}
          {analysis.referralFlags.length>0&&(
            <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'1rem',marginBottom:16}}>
              <p style={{fontWeight:600,fontSize:'0.85rem',color:'#FF4444',marginBottom:'0.5rem'}}>⚠ Referral Flags</p>
              {analysis.referralFlags.map((f,i)=>(
                <div key={i} style={{marginBottom:'0.5rem'}}>
                  <p style={{fontSize:'0.82rem',color:'#FF4444',fontWeight:500}}>{f.type}</p>
                  <p style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>{f.description} — {f.immediateAction}</p>
                </div>
              ))}
            </div>
          )}

          {/* Clinical summary */}
          <div style={{background:'var(--bg-surface)',border:'1px solid #1a2535',borderRadius:10,padding:'1rem',marginBottom:24}}>
            <p style={{fontWeight:600,fontSize:'0.85rem',marginBottom:'0.5rem',color:'var(--text-primary)'}}>Clinical Summary</p>
            <p style={{fontSize:'0.88rem',lineHeight:1.7,color:'var(--text-secondary)'}}>{analysis.clinicalSummary}</p>
            <p style={{fontSize:'0.7rem',color:'var(--text-tertiary)',marginTop:'0.5rem',fontFamily:"'Space Mono',monospace"}}>
              Evidence: Krebs DE et al. Phys Ther. 1985;65(7):1027-1033 (Grade B) · {metrics.framesAnalysed} frames
            </p>
          </div>

          <button onClick={()=>{ setPhase('intro'); setMetrics(null); setAnalysis(null); setSaved(false); setIsRec(false); }} style={{background:'transparent',border:'1px solid #2a3448',borderRadius:8,color:'var(--text-secondary)',padding:'0.6rem 1.5rem',cursor:'pointer',fontSize:'0.85rem'}}>
            Retake
          </button>
        </div>
      </div>
    );
  }
  return null;
}

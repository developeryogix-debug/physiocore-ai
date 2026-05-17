import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { useAuth } from '../hooks/useAuth.js';
import { supabase } from '@physiocore/supabase';
import { ElevationCard } from '../components/ui/ElevationCard.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { SlidingTabs } from '../components/ui/SlidingTabs.js';
import { PageTransition } from '../components/ui/PageTransition.js';

interface StoredSession {
  id: string; exercise: string; date: string;
  reps: number; formScore: number; durationMin: number;
}
interface BioRow { metric_type: string; value: number; unit: string; recorded_at: string; }
interface DailyInsight { readiness: string; focus: string; action: string; }
interface QuoteInsight { quote: string; citation: string; }

import { scopedKey } from '../lib/storage.js';

function loadSessions(userId?: string): StoredSession[] {
  try { return JSON.parse(localStorage.getItem(scopedKey('physiocore_sessions', userId)) ?? '[]'); }
  catch { return []; }
}
function linReg(ys: number[]) {
  const n = ys.length; if (n < 2) return { slope: 0, current: ys[0] ?? 50, weeksToGoal: Infinity };
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = ys.reduce((s, v, i) => s + (i - mx) * (v - my), 0);
  const den = ys.reduce((s, _, i) => s + (i - mx) ** 2, 0);
  const slope = den ? num / den : 0;
  const current = ys[n - 1] ?? 50;
  const weeksToGoal = slope > 0 ? Math.ceil((85 - current) / slope) : Infinity;
  return { slope, current, weeksToGoal };
}

// ─── Health Gauge ─────────────────────────────────────────────────────────────
function HealthGauge({ score }: { score: number }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(score), 120); return () => clearTimeout(t); }, [score]);
  const r = 52; const circ = 2 * Math.PI * r; const arc = circ * 0.75;
  const c = anim > 75 ? '#22c55e' : anim > 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg viewBox="0 0 120 120" width={130} height={130}>
      <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10}
        strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round" transform="rotate(135 60 60)" />
      <circle cx={60} cy={60} r={r} fill="none" stroke={c} strokeWidth={10}
        strokeDasharray={`${arc * (anim / 100)} ${circ - arc * (anim / 100)}`} strokeLinecap="round"
        transform="rotate(135 60 60)" style={{ transition: 'stroke-dasharray 1.2s ease-out' }} />
      <text x={60} y={56} textAnchor="middle" fill={c} fontSize={24} fontWeight={600}
        fontFamily="Space Mono,monospace">{anim}</text>
      <text x={60} y={72} textAnchor="middle" fill="#8892A4" fontSize={9}
        fontFamily="Space Mono,monospace">HEALTH SCORE</text>
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#00D4AA', w = 72, h = 28 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return <svg width={w} height={h}><line x1={0} y1={h/2} x2={w} y2={h/2} stroke="rgba(255,255,255,0.1)" strokeWidth={1}/></svg>;
  const mn = Math.min(...data); const mx = Math.max(...data); const rng = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * (h - 4) - 2}`).join(' ');
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/></svg>;
}

// ─── Radar Chart (SVG hexagon) ────────────────────────────────────────────────
function RadarChart({ axes, vals }: { axes: string[]; vals: number[] }) {
  const cx = 75; const cy = 75; const r = 55;
  const n = axes.length;
  const ang = (i: number) => (i * 2 * Math.PI / n) - Math.PI / 2;
  const pt = (i: number, v: number) => ({ x: cx + r * v * Math.cos(ang(i)), y: cy + r * v * Math.sin(ang(i)) });
  return (
    <svg viewBox="0 0 150 150" width={150} height={150}>
      {[0.25, 0.5, 0.75, 1].map(rv => (
        <polygon key={rv} points={Array.from({length:n},(_,i)=>{const p=pt(i,rv);return`${p.x},${p.y}`;}).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1}/>
      ))}
      {Array.from({length:n},(_,i)=>{const p=pt(i,1);return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1}/>;}) }
      <polygon points={vals.map((v,i)=>{const p=pt(i,v);return`${p.x},${p.y}`;}).join(' ')}
        fill="rgba(0,212,170,0.15)" stroke="#00D4AA" strokeWidth={1.5}/>
      {vals.map((v,i)=>{const p=pt(i,v);return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#00D4AA"/>;}) }
      {axes.map((lbl,i)=>{const p=pt(i,1.24);return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
        fill="#8892A4" fontSize={7.5} fontFamily="Space Mono,monospace">{lbl}</text>;})}
    </svg>
  );
}

// ─── Mini Heatmap ─────────────────────────────────────────────────────────────
function MiniHeatmap({ sessions }: { sessions: StoredSession[] }) {
  const cells = useMemo(() => {
    const today = new Date(); const arr = [];
    for (let w = 51; w >= 0; w--) for (let d = 0; d < 7; d++) {
      const dt = new Date(today); dt.setDate(dt.getDate() - (w * 7 + (6 - d)));
      const iso = dt.toISOString().slice(0, 10);
      const day = sessions.filter(s => s.date.slice(0, 10) === iso);
      arr.push({ date: iso, score: day.length ? Math.round(day.reduce((s,x)=>s+x.formScore,0)/day.length) : null });
    }
    return arr;
  }, [sessions]);
  const cs = 10; const gap = 2; const W = 52*(cs+gap); const H = 7*(cs+gap);
  const hc = (s: number|null) => s===null?'rgba(255,255,255,0.04)':s>=85?'#00D4AA':s>=70?'#00A882':s>=55?'#006B53':'#003D30';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',maxWidth:W}}>
      {cells.map((cell,idx)=>(
        <rect key={idx} x={Math.floor(idx/7)*(cs+gap)} y={(idx%7)*(cs+gap)} width={cs} height={cs} rx={2} fill={hc(cell.score)}>
          <title>{cell.date}{cell.score!==null?` — ${cell.score}%`:' — no session'}</title>
        </rect>
      ))}
    </svg>
  );
}

const BIO_META: Record<string,{label:string;unit:string;low:number;high:number;color:string}> = {
  hr:     {label:'Heart Rate',  unit:'bpm', low:50,high:80, color:'#ef4444'},
  bp_sys: {label:'Systolic BP', unit:'mmHg',low:90,high:120,color:'#f97316'},
  bp_dia: {label:'Diastolic BP',unit:'mmHg',low:60,high:80, color:'#eab308'},
  glucose:{label:'Glucose',     unit:'mg/dL',low:70,high:99,color:'#a855f7'},
  hrv:    {label:'HRV',         unit:'ms',  low:20,high:100,color:'#22c55e'},
  sleep:  {label:'Sleep',       unit:'hrs', low:7, high:9,  color:'#3b82f6'},
};

const PAIN_ZONES = [
  {part:'neck',          s:{kind:'e' as const,cx:60, cy:20, rx:16,ry:18}},
  {part:'upper_back',    s:{kind:'r' as const,x:36, y:40, w:48,h:36,rx:5}},
  {part:'lower_back',    s:{kind:'r' as const,x:36, y:76, w:48,h:28,rx:4}},
  {part:'shoulder_right',s:{kind:'e' as const,cx:20, cy:58, rx:18,ry:13}},
  {part:'shoulder_left', s:{kind:'e' as const,cx:100,cy:58, rx:18,ry:13}},
  {part:'hip_right',     s:{kind:'e' as const,cx:40, cy:136,rx:16,ry:12}},
  {part:'hip_left',      s:{kind:'e' as const,cx:80, cy:136,rx:16,ry:12}},
  {part:'knee_right',    s:{kind:'e' as const,cx:40, cy:184,rx:14,ry:14}},
  {part:'knee_left',     s:{kind:'e' as const,cx:80, cy:184,rx:14,ry:14}},
];

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { userProfile } = useUserProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const sessions = useMemo(() => loadSessions(user?.id), [user?.id]);
  const [biometrics, setBiometrics] = useState<BioRow[]>([]);
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [quoteInsight, setQuoteInsight] = useState<QuoteInsight | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const filteredSessions = useMemo(() => {
    if (timeRange === 'all') return sessions;
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return sessions.filter(s => new Date(s.date).getTime() >= cutoff);
  }, [sessions, timeRange]);

  useEffect(() => {
    if (!user) return;
    const db = supabase as any;
    db.from('biometrics').select('metric_type,value,unit,recorded_at')
      .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(70)
      .then(({ data }: { data: BioRow[] | null }) => { if (data) setBiometrics(data); });
  }, [user]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = scopedKey(`physiocore_insight_${today}`, user?.id);
    const cached = localStorage.getItem(key);
    if (cached) { try { setInsight(JSON.parse(cached)); } catch {} return; }
    if (!userProfile || !import.meta.env.VITE_ANTHROPIC_KEY) return;
    setInsightLoading(true);
    const recent = [...sessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
    const latestBio = Object.fromEntries(Object.keys(BIO_META).map(k=>[k,biometrics.find(b=>b.metric_type===k)?.value]));
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 220,
        system: 'Return JSON only: {"readiness":"...","focus":"...","action":"..."}. Three sections: Today\'s Readiness (1 sentence), Focus Area (1 sentence), One Action with evidence grade in brackets e.g. [Grade A]. Total under 75 words.',
        messages: [{ role: 'user', content: `User: ${userProfile.name}, goal: ${userProfile.primaryGoal}, level: ${userProfile.fitnessLevel}. Recent: ${recent.map(s=>`${s.exercise} score ${s.formScore}`).join(', ')||'none'}. Bio: ${JSON.stringify(latestBio)}.` }],
      }),
    })
      .then(r => r.json())
      .then(data => {
        try {
          const parsed = JSON.parse(data.content?.[0]?.text ?? '{}') as DailyInsight;
          setInsight(parsed); localStorage.setItem(key, JSON.stringify(parsed));
        } catch { setInsight({readiness:'Ready to train today.',focus:'Focus on form consistency.',action:'Complete one full session. [Grade B]'}); }
      })
      .catch(() => setInsight({readiness:'Ready to train.',focus:'Maintain consistency.',action:'Log one session today. [Grade B]'}))
      .finally(() => setInsightLoading(false));
  }, [userProfile, sessions, biometrics]);

  // ── Daily evidence-based quote (once per day, cached) ───────────────────────
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = scopedKey(`physiocore_quote_${today}`, user?.id);
    const cached = localStorage.getItem(key);
    if (cached) { try { setQuoteInsight(JSON.parse(cached)); } catch {} return; }
    if (!userProfile || !import.meta.env['VITE_ANTHROPIC_KEY']) return;

    setQuoteLoading(true);
    const conditions = (userProfile.injuries ?? []).join(', ') || 'none';
    const goal = userProfile.primaryGoal ?? 'general fitness';
    const topics = ['pain science', 'movement', 'sleep', 'breathing', 'nutrition', 'mindset', 'posture'];
    const topic = topics[new Date().getDay() % topics.length];

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': import.meta.env['VITE_ANTHROPIC_KEY'] as string,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system: `Return JSON only: {"quote":"...","citation":"Author Lastname et al., Year, Journal"}.
Generate one evidence-based insight about physiotherapy, movement science, or recovery.
Under 30 words. Cite the source (author + year). Today's topic: ${topic}.
Make it practical and immediately actionable.
User context: goal=${goal}, conditions=${conditions}.`,
        messages: [{ role: 'user', content: 'Generate today\'s insight.' }],
      }),
    })
      .then(r => r.json())
      .then(data => {
        try {
          const text: string = (data as {content?:{text?:string}[]}).content?.[0]?.text ?? '{}';
          const parsed = JSON.parse(text) as QuoteInsight;
          setQuoteInsight(parsed);
          localStorage.setItem(key, JSON.stringify(parsed));
        } catch {
          const fallback: QuoteInsight = { quote: 'Movement is medicine — even 10 minutes of walking reduces pain sensitivity and improves mood.', citation: 'Burch et al., 2019, Br J Sports Med' };
          setQuoteInsight(fallback);
          localStorage.setItem(key, JSON.stringify(fallback));
        }
      })
      .catch(() => setQuoteInsight({ quote: 'Consistency beats intensity — three moderate sessions outperform one extreme workout for long-term health.', citation: 'Garber et al., 2011, Med Sci Sports Exerc' }))
      .finally(() => setQuoteLoading(false));
  }, [userProfile]);

  if (!userProfile) return null;
  const firstName = userProfile.name.split(' ')[0] ?? userProfile.name;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSess = sessions.filter(s => new Date(s.date) >= weekAgo);

  // Health score breakdown
  let healthScore = 0;
  const breakdown: {label:string;pts:number;met:boolean}[] = [];
  const bmiOk = (userProfile.bmi ?? 0) >= 18.5 && (userProfile.bmi ?? 0) <= 24.9;
  breakdown.push({label:`BMI ${(userProfile.bmi??0).toFixed(1)}`,pts:25,met:bmiOk}); if(bmiOk) healthScore+=25;
  const hrRow = biometrics.find(b=>b.metric_type==='hr');
  const hrOk = hrRow ? hrRow.value < 80 : false;
  breakdown.push({label:'Resting HR < 80',pts:20,met:hrOk}); if(hrOk) healthScore+=20;
  const sessOk = weekSess.length >= 3;
  breakdown.push({label:`${weekSess.length}/3 sessions/wk`,pts:20,met:sessOk}); if(sessOk) healthScore+=20;
  const avgFormWk = weekSess.length ? Math.round(weekSess.reduce((s,x)=>s+x.formScore,0)/weekSess.length) : 0;
  const formPts = weekSess.length ? Math.round((avgFormWk/100)*20) : 0;
  breakdown.push({label:`Form ${avgFormWk}%`,pts:formPts,met:avgFormWk>=75}); healthScore+=formPts;
  const sleepRow = biometrics.find(b=>b.metric_type==='sleep');
  const sleepOk = sleepRow ? sleepRow.value >= 7 : false;
  breakdown.push({label:'Sleep ≥ 7hrs',pts:15,met:sleepOk}); if(sleepOk) healthScore+=15;

  // Pain zones
  const injuryParts = new Set(userProfile.injuries.filter(i=>i.isActive).map(i=>i.bodyPart));
  const condParts = new Set<string>();
  userProfile.conditions.filter(c=>c.isActive).forEach(c=>{
    if(c.name.includes('Back')) condParts.add('lower_back');
    if(c.name.includes('Shoulder')){condParts.add('shoulder_right');condParts.add('shoulder_left');}
    if(c.name.includes('Knee')){condParts.add('knee_right');condParts.add('knee_left');}
  });
  const painParts = new Set([...injuryParts,...condParts]);

  // Radar values
  const gymEx = new Set(['squat','deadlift','bench_press','pull_up','push_up']);
  const yogaEx = new Set(['warrior_i','warrior_ii','tree_pose','downdog']);
  const avgS = (arr: StoredSession[]) => arr.length ? arr.reduce((s,x)=>s+x.formScore,0)/arr.length/100 : 0.3;
  const gymSess = sessions.filter(s=>gymEx.has(s.exercise));
  const yogaSess = sessions.filter(s=>yogaEx.has(s.exercise));
  const daySet = new Set(sessions.map(s=>s.date.slice(0,10)));
  const last28 = Array.from({length:28},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
  const activeDays = last28.filter(d=>daySet.has(d)).length;
  const radarVals = [
    Math.min(1, avgS(gymSess) + 0.1),
    Math.min(1, avgS(yogaSess) + 0.1),
    Math.min(1, avgS(sessions) * 0.8 + 0.2),
    Math.min(1, activeDays / 12),
    Math.min(1, sessions.length ? avgS(sessions) : 0.3),
    Math.min(1, sessions.length > 1 ? 0.7 : 0.3),
  ];

  // Regression — uses filteredSessions so time range affects trend card
  const recentScores = [...filteredSessions].sort((a,b)=>a.date.localeCompare(b.date)).slice(-5).map(s=>s.formScore);
  const reg = linReg(recentScores);

  // Biometrics per metric
  const bioCards = Object.entries(BIO_META).map(([k,meta])=>{
    const rows = biometrics.filter(b=>b.metric_type===k).slice(0,7);
    const latest = rows[0];
    const inRange = latest ? latest.value >= meta.low && latest.value <= meta.high : true;
    return {key:k,meta,latest,rows:rows.map(r=>r.value).reverse(),inRange};
  });

  // Last session
  const lastSession = sessions.length ? [...sessions].sort((a,b)=>b.date.localeCompare(a.date))[0] : null;
  const daysSinceLast = lastSession ? Math.floor((Date.now()-new Date(lastSession.date).getTime())/86400000) : Infinity;

  // Elevation-based card style — no border, shadow ring replaces it
  const card: React.CSSProperties = {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.04)',
    padding: 20,
    transition: 'box-shadow 220ms cubic-bezier(0.4,0,0.2,1)',
  };
  const pTitle: React.CSSProperties = {fontSize:'0.75rem',fontWeight:600,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'Space Mono', monospace",marginBottom:14};
  const sil = '#1a2438';
  const [bottomTab, setBottomTab] = useState<'progress' | 'prescription'>('progress');

  return (
    <PageTransition direction="none">
    <div style={{maxWidth:1100,margin:'0 auto',padding:'100px 24px 48px'}}>
      {/* Header */}
      <div style={{marginBottom:32,display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
        <div>
          <p style={{fontFamily:"'Space Mono', monospace",fontSize:'0.75rem',color:'var(--teal-500)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>
            {sessions.length===0?'Welcome':'Welcome back'}
          </p>
          <h1 style={{fontFamily:"'Syne', sans-serif",fontSize:'var(--text-3xl)',fontWeight:600,letterSpacing:'-0.02em',marginBottom:4}}>{firstName}</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'0.85rem'}}>
            {userProfile.primaryGoal.replace(/_/g,' ')} · {userProfile.fitnessLevel} ·{' '}
            <span style={{color:'var(--teal-500)',fontFamily:"'Space Mono', monospace",fontSize:'0.75rem'}}>{(userProfile.subscription??'free').toUpperCase()}</span>
          </p>
        </div>
        <SlidingTabs
          tabs={[
            { key: '7d',  label: '7 days'  },
            { key: '30d', label: '30 days' },
            { key: '90d', label: '90 days' },
            { key: 'all', label: 'All time' },
          ]}
          active={timeRange}
          onChange={(k) => setTimeRange(k as typeof timeRange)}
        />
      </div>

      {/* Daily Insight card */}
      {(quoteInsight || quoteLoading) && (
        <div style={{
          marginBottom: 20,
          padding: '14px 20px',
          borderRadius: 14,
          background: 'rgba(0,212,170,0.06)',
          border: '1px solid rgba(0,212,170,0.2)',
          display: 'flex', alignItems: 'flex-start', gap: 14,
        }}>
          <div style={{ color: 'var(--teal-500)', fontSize: '1.1rem', marginTop: 2, flexShrink: 0 }}>⬡</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 6 }}>
              Today's Insight
            </p>
            {quoteLoading ? (
              <div style={{ height: 16, width: '60%', borderRadius: 4, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ) : (
              <>
                <p style={{ fontStyle: 'italic', color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.55, marginBottom: 5 }}>
                  "{quoteInsight?.quote}"
                </p>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', fontFamily: "'Space Mono', monospace" }}>
                  — {quoteInsight?.citation}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Row 1: Health Score · Pain Map · AI Insight */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:16}}>

        {/* Panel 1: Health Score */}
        <ElevationCard level={1} padding={20}>
          <div style={pTitle}>Health Score</div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <HealthGauge score={healthScore}/>
            <div style={{width:'100%',display:'flex',flexDirection:'column',gap:7}}>
              {breakdown.map(b=>(
                <div key={b.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.72rem'}}>
                  <span style={{color:b.met?'var(--text-secondary)':'var(--text-tertiary)'}}>{b.label}</span>
                  <span style={{fontFamily:"'Space Mono', monospace",color:b.met?'var(--teal-500)':'var(--text-tertiary)'}}>{b.met?'+':''}{b.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </ElevationCard>

        {/* Panel 2: Pain Trend Map */}
        <ElevationCard level={1} padding={20}>
          <div style={pTitle}>Pain Trend Map</div>
          {painParts.size===0 ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,paddingTop:8}}>
              <div style={{fontSize:'1.4rem'}}>✓</div>
              <div style={{color:'var(--teal-500)',fontSize:'0.82rem',fontWeight:600}}>No pain logged</div>
              <svg viewBox="0 0 120 282" width={90} height={212} style={{opacity:0.2}}>
                <ellipse cx={60} cy={20} rx={17} ry={19} fill={sil}/>
                <rect x={53} y={37} width={14} height={12} rx={3} fill={sil}/>
                <rect x={34} y={48} width={52} height={78} rx={8} fill={sil}/>
                <rect x={7} y={50} width={24} height={80} rx={11} fill={sil}/>
                <rect x={89} y={50} width={24} height={80} rx={11} fill={sil}/>
                <rect x={34} y={126} width={22} height={80} rx={9} fill={sil}/>
                <rect x={64} y={126} width={22} height={80} rx={9} fill={sil}/>
                <rect x={34} y={206} width={20} height={62} rx={8} fill={sil}/>
                <rect x={66} y={206} width={20} height={62} rx={8} fill={sil}/>
              </svg>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
              <svg viewBox="0 0 120 282" width={90} height={212} style={{overflow:'visible'}}>
                <ellipse cx={60} cy={20} rx={17} ry={19} fill={sil}/>
                <rect x={53} y={37} width={14} height={12} rx={3} fill={sil}/>
                <rect x={34} y={48} width={52} height={78} rx={8} fill={sil}/>
                <rect x={7} y={50} width={24} height={80} rx={11} fill={sil}/>
                <rect x={89} y={50} width={24} height={80} rx={11} fill={sil}/>
                <rect x={34} y={126} width={22} height={80} rx={9} fill={sil}/>
                <rect x={64} y={126} width={22} height={80} rx={9} fill={sil}/>
                <rect x={34} y={206} width={20} height={62} rx={8} fill={sil}/>
                <rect x={66} y={206} width={20} height={62} rx={8} fill={sil}/>
                {PAIN_ZONES.map(z=>{
                  if(!painParts.has(z.part)) return null;
                  const f='rgba(239,68,68,0.65)'; const st='#dc2626';
                  if(z.s.kind==='e') return <ellipse key={z.part} cx={z.s.cx} cy={z.s.cy} rx={z.s.rx} ry={z.s.ry} fill={f} stroke={st} strokeWidth={1.5}/>;
                  return <rect key={z.part} x={z.s.x} y={z.s.y} width={z.s.w} height={z.s.h} rx={z.s.rx??0} fill={f} stroke={st} strokeWidth={1.5}/>;
                })}
              </svg>
              <div style={{fontSize:'0.72rem',color:'var(--warning)',fontWeight:600}}>{painParts.size} area{painParts.size!==1?'s':''} flagged</div>
            </div>
          )}
        </ElevationCard>

        {/* Panel 6: AI Daily Insight */}
        <ElevationCard level={1} padding={20}>
          <div style={pTitle}>AI Daily Insight</div>
          {insightLoading ? (
            <div style={{display:'flex',alignItems:'center',gap:10,color:'var(--text-tertiary)',fontSize:'0.8rem',padding:'8px 0'}}>
              <div style={{width:14,height:14,borderRadius:'50%',border:'2px solid var(--teal-500)',borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}}/>
              Generating…
            </div>
          ) : insight ? (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                {label:'Readiness',text:insight.readiness,color:'var(--teal-500)',bg:'rgba(0,212,170,0.07)'},
                {label:'Focus',text:insight.focus,color:'var(--blue-400)',bg:'rgba(77,184,255,0.07)'},
                {label:'Action',text:insight.action,color:'var(--warning)',bg:'rgba(255,184,48,0.07)'},
              ].map(s=>(
                <div key={s.label} style={{background:s.bg,borderRadius:10,padding:'10px 12px',borderLeft:`3px solid ${s.color}`}}>
                  <div style={{fontSize:'0.75rem',fontWeight:600,color:s.color,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4,fontFamily:"'Space Mono', monospace"}}>{s.label}</div>
                  <div style={{fontSize:'0.78rem',color:'var(--text-primary)',lineHeight:1.5}}>{s.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{color:'var(--text-tertiary)',fontSize:'0.8rem',lineHeight:1.6}}>Log biometrics or complete a session to unlock your daily AI insight.</div>
          )}
        </ElevationCard>
      </div>

      {/* Row 2: Next Workout + Progress Tracker */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

        {/* Panel: Next Session */}
        <ElevationCard level={1} padding={20}>
          <div style={pTitle}>Next Session</div>
          {lastSession ? (
            <div>
              <div style={{
                display:'flex', alignItems:'center', gap:12, marginBottom:16,
                padding:'12px 14px', borderRadius:10,
                background: daysSinceLast > 2 ? 'rgba(255,184,48,0.06)' : 'rgba(0,212,170,0.06)',
                border: `1px solid ${daysSinceLast > 2 ? 'rgba(255,184,48,0.2)' : 'rgba(0,212,170,0.2)'}`,
              }}>
                <span style={{fontSize:'1.2rem'}}>{daysSinceLast > 2 ? '⚠️' : '✓'}</span>
                <div>
                  <div style={{fontSize:'0.8rem',fontWeight:600,color: daysSinceLast > 2 ? 'var(--warning)' : 'var(--teal-500)'}}>
                    {daysSinceLast === 0 ? 'Trained today' : daysSinceLast === 1 ? 'Last session: yesterday' : `${daysSinceLast} days since last session`}
                  </div>
                  <div style={{fontSize:'0.72rem',color:'var(--text-tertiary)',fontFamily:"'Space Mono',monospace"}}>
                    {lastSession.exercise.replace(/_/g,' ')} · {lastSession.formScore}% form
                  </div>
                </div>
              </div>
              <div style={{fontSize:'0.8rem',fontWeight:600,color:'var(--text-secondary)',marginBottom:8}}>
                Recommended next:
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[
                  { ex: userProfile.primaryGoal === 'rehabilitation' || userProfile.primaryGoal === 'pain_management' ? 'Physiotherapy protocol' : userProfile.primaryGoal === 'flexibility' ? 'Yoga / mobility flow' : 'Strength session', icon: '⬡' },
                  { ex: daysSinceLast > 1 ? 'Active recovery walk (15 min)' : 'Mobility warm-up', icon: '◎' },
                ].map(r => (
                  <div key={r.ex} style={{
                    display:'flex', alignItems:'center', gap:10,
                    fontSize:'0.78rem', color:'var(--text-secondary)',
                  }}>
                    <span style={{color:'var(--teal-500)',fontSize:'0.65rem'}}>{r.icon}</span>
                    {r.ex}
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/session')}
                className="btn-primary"
                style={{width:'100%',marginTop:16,padding:'9px 0',fontSize:'0.82rem'}}
              >
                Start session →
              </button>
            </div>
          ) : (
            <EmptyState
              icon="◎"
              title="No sessions yet"
              description="Complete your first session to unlock progress tracking."
              action={{ label: 'Start first session', onClick: () => navigate('/session') }}
            />
          )}
        </ElevationCard>

        {/* Panel: Form Trend */}
        <ElevationCard level={1} padding={20}>
          <div style={pTitle}>Form Trend (last 5)</div>
          {recentScores.length >= 2 ? (
            <div>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:12}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:'2rem',fontWeight:700,color: reg.slope >= 0 ? 'var(--teal-400)' : 'var(--danger)', lineHeight:1}}>
                  {Math.round(reg.current ?? 0)}%
                </span>
                <span style={{fontSize:'0.78rem',color: reg.slope >= 0 ? 'var(--teal-500)' : 'var(--danger)', fontFamily:"'Space Mono',monospace"}}>
                  {reg.slope >= 0 ? '↗' : '↘'} {Math.abs(reg.slope * 100).toFixed(0)}/session
                </span>
              </div>
              <Sparkline data={recentScores} color={reg.slope >= 0 ? '#00D4AA' : '#ef4444'} w={200} h={50} />
              <div style={{marginTop:12,display:'flex',gap:12}}>
                <div style={{flex:1,padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border-subtle)'}}>
                  <div style={{fontSize:'0.65rem',color:'var(--text-tertiary)',fontFamily:"'Space Mono',monospace",marginBottom:3}}>BEST</div>
                  <div style={{fontSize:'0.9rem',fontWeight:600,color:'var(--teal-500)',fontFamily:"'Space Mono',monospace"}}>{Math.max(...recentScores)}%</div>
                </div>
                <div style={{flex:1,padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border-subtle)'}}>
                  <div style={{fontSize:'0.65rem',color:'var(--text-tertiary)',fontFamily:"'Space Mono',monospace",marginBottom:3}}>AVG</div>
                  <div style={{fontSize:'0.9rem',fontWeight:600,color:'var(--text-primary)',fontFamily:"'Space Mono',monospace"}}>{Math.round(recentScores.reduce((a,b)=>a+b,0)/recentScores.length)}%</div>
                </div>
                {reg.weeksToGoal !== Infinity && (
                  <div style={{flex:1,padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border-subtle)'}}>
                    <div style={{fontSize:'0.65rem',color:'var(--text-tertiary)',fontFamily:"'Space Mono',monospace",marginBottom:3}}>85% IN</div>
                    <div style={{fontSize:'0.9rem',fontWeight:600,color:'var(--blue-400)',fontFamily:"'Space Mono',monospace"}}>{reg.weeksToGoal}wk</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon="⬡"
              title="Need 2+ sessions"
              description="Complete more sessions to see your form trend."
            />
          )}
        </ElevationCard>
      </div>

      {/* Panel 3: Biometrics Tracker */}
      <ElevationCard level={1} padding={20} style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={pTitle}>Biometrics Tracker</div>
          <button onClick={()=>navigate('/settings')} style={{fontSize:'0.72rem',color:'var(--teal-500)',background:'none',border:'none',cursor:'pointer',fontFamily:"'Space Mono', monospace"}}>+ Log reading →</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12}}>
          {bioCards.map(({key,meta,latest,rows,inRange})=>(
            <div key={key} style={{background:'var(--bg-elevated)',borderRadius:12,padding:'12px 14px',border:`1px solid ${!inRange&&latest?'rgba(239,68,68,0.3)':'var(--border-subtle)'}`}}>
              <div style={{fontSize:'0.75rem',color:'var(--text-tertiary)',fontFamily:"'Space Mono', monospace",marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>{meta.label}</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <span style={{fontFamily:"'Space Mono', monospace",fontSize:'1.25rem',fontWeight:600,color:!inRange&&latest?'#ef4444':meta.color}}>{latest?latest.value:'—'}</span>
                  <span style={{fontSize:'0.75rem',color:'var(--text-tertiary)',marginLeft:4}}>{meta.unit}</span>
                </div>
                <Sparkline data={rows} color={!inRange&&latest?'#ef4444':meta.color}/>
              </div>
              <div style={{fontSize:'0.75rem',color:'var(--text-tertiary)',marginTop:4}}>
                {meta.low}–{meta.high} {meta.unit}
                {!inRange&&latest&&<span style={{color:'#ef4444',marginLeft:4}}>⚠ out of range</span>}
              </div>
            </div>
          ))}
        </div>
      </ElevationCard>

      {/* Weekly Streak Banner */}
      {sessions.length > 0 && (
        <div style={{
          marginBottom:16,
          padding:'16px 20px',
          borderRadius:14,
          background:'rgba(0,212,170,0.04)',
          border:'1px solid var(--border-teal)',
          display:'flex',
          alignItems:'center',
          justifyContent:'space-between',
          flexWrap:'wrap' as const,
          gap:12,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:'0.65rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--teal-500)',marginBottom:4}}>
                THIS WEEK
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:'1.8rem',fontWeight:700,color:'var(--teal-400)',lineHeight:1}}>
                  {weekSess.length}
                </span>
                <span style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>/ 3 sessions</span>
              </div>
            </div>
            <div style={{width:'1px',height:36,background:'var(--border-subtle)'}}/>
            <div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:'0.65rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text-tertiary)',marginBottom:4}}>
                TOTAL SESSIONS
              </div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:'1.8rem',fontWeight:700,color:'var(--text-primary)',lineHeight:1}}>
                {sessions.length}
              </div>
            </div>
            <div style={{width:'1px',height:36,background:'var(--border-subtle)'}}/>
            <div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:'0.65rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text-tertiary)',marginBottom:4}}>
                AVG FORM
              </div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:'1.8rem',fontWeight:700,color: (sessions.reduce((s,x)=>s+x.formScore,0)/sessions.length) >= 75 ? 'var(--success)' : 'var(--warning)',lineHeight:1}}>
                {Math.round(sessions.reduce((s,x)=>s+x.formScore,0)/sessions.length)}%
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {Array.from({length:7},(_,i)=>{
              const d=new Date(); d.setDate(d.getDate()-6+i);
              const iso=d.toISOString().slice(0,10);
              const hasSession=sessions.some(s=>s.date.slice(0,10)===iso);
              return (
                <div key={i} title={iso} style={{
                  width:28,height:28,borderRadius:6,
                  background:hasSession?'var(--teal-500)':'rgba(255,255,255,0.04)',
                  border:`1px solid ${hasSession?'var(--teal-500)':'var(--border-subtle)'}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:'0.6rem',color:hasSession?'#000':'var(--text-tertiary)',
                  fontFamily:"'Space Mono',monospace",fontWeight:hasSession?700:400,
                }}>
                  {['S','M','T','W','T','F','S'][d.getDay()]}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 3: Heatmap + Radar */}
      <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:16,marginBottom:16,alignItems:'start'}}>
        {/* Panel 4: Exercise Heatmap */}
        <ElevationCard level={1} padding={20}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={pTitle}>Exercise Heatmap · 52 weeks</div>
            <button onClick={()=>navigate('/history')} style={{fontSize:'0.72rem',color:'var(--teal-500)',background:'none',border:'none',cursor:'pointer',fontFamily:"'Space Mono', monospace"}}>View history →</button>
          </div>
          <MiniHeatmap sessions={sessions}/>
          <div style={{display:'flex',gap:16,marginTop:10,fontSize:'0.75rem',color:'var(--text-tertiary)'}}>
            {[['#003D30','<55'],['#006B53','55-70'],['#00A882','70-85'],['#00D4AA','≥85']].map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:10,height:10,background:c,borderRadius:2}}/>{l}%
              </div>
            ))}
          </div>
        </ElevationCard>

        {/* Panel 5: Performance Radar */}
        <ElevationCard level={1} padding={20} style={{width:218}}>
          <div style={pTitle}>Performance Radar</div>
          <RadarChart axes={['STR','FLEX','BAL','END','POST','REC']} vals={radarVals}/>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:6}}>
            {['Strength','Flexibility','Balance','Endurance','Posture','Recovery'].map((lbl,i)=>(
              <div key={lbl} style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}>
                <span style={{color:'var(--text-tertiary)'}}>{lbl}</span>
                <span style={{color:'var(--teal-500)',fontFamily:"'Space Mono', monospace"}}>{Math.round(radarVals[i]!*100)}%</span>
              </div>
            ))}
          </div>
        </ElevationCard>
      </div>

      {/* Row 4: Predictive Progress + Next Session — tabbed */}
      <ElevationCard level={1} padding={20}>
        <SlidingTabs
          tabs={[
            { key: 'progress',     label: 'Predictive Progress'    },
            { key: 'prescription', label: 'Next Session Prescription' },
          ]}
          active={bottomTab}
          onChange={(k) => setBottomTab(k as typeof bottomTab)}
          style={{ marginBottom: 20 }}
        />

        {bottomTab === 'progress' && (
          recentScores.length < 3 ? (
            <div style={{color:'var(--text-tertiary)',fontSize:'0.82rem',lineHeight:1.6}}>
              Need at least 3 sessions to predict your trajectory. ({recentScores.length}/3 recorded)
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{fontSize:'0.88rem',color:'var(--text-primary)',lineHeight:1.6}}>
                {reg.slope > 0 && isFinite(reg.weeksToGoal) && reg.current < 85
                  ? <>At your current rate, you'll reach <strong style={{color:'var(--teal-500)'}}>85% form score</strong> in <strong style={{color:'var(--teal-500)'}}>{reg.weeksToGoal} session{reg.weeksToGoal!==1?'s':''}</strong>.</>
                  : reg.current >= 85
                    ? <span style={{color:'var(--teal-500)'}}>85% form score milestone achieved. Keep it up.</span>
                    : <span style={{color:'var(--warning)'}}>Form score trending down — consider a recovery day.</span>
                }
              </div>
              <div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',color:'var(--text-tertiary)',marginBottom:6}}>
                  <span>Current: {reg.current}%</span><span>Goal: 85%</span>
                </div>
                <div style={{background:'rgba(255,255,255,0.06)',borderRadius:99,height:8,overflow:'hidden'}}>
                  <div style={{width:`${Math.min(100,(reg.current/85)*100)}%`,height:'100%',background:'linear-gradient(90deg,var(--teal-500),var(--blue-400))',borderRadius:99,transition:'width 1s ease'}}/>
                </div>
              </div>
              <div style={{fontSize:'0.7rem',color:'var(--text-tertiary)'}}>
                Trend: {reg.slope>0?'+':''}{reg.slope.toFixed(1)} pts/session · last {recentScores.length} sessions
              </div>
            </div>
          )
        )}

        {bottomTab === 'prescription' && (
          !lastSession ? (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{color:'var(--text-secondary)',fontSize:'0.82rem',lineHeight:1.6}}>No sessions recorded yet. Start your first session to get AI prescriptions.</div>
              <button className="btn-primary" onClick={()=>navigate('/session')}>Begin first session →</button>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {daysSinceLast >= 2 && (
                <div style={{background:'var(--teal-dim)',border:'1px solid var(--border-teal)',borderRadius:10,padding:'8px 12px',fontSize:'0.78rem',color:'var(--teal-500)'}}>
                  {daysSinceLast>=5?'It\'s been a while — great time to return.':'You\'re due for a session today.'}
                </div>
              )}
              <div>
                <div style={{fontSize:'0.75rem',color:'var(--text-tertiary)',marginBottom:3,fontFamily:"'Space Mono', monospace",textTransform:'uppercase',letterSpacing:'0.06em'}}>Recommended exercise</div>
                <div style={{fontWeight:600,fontSize:'0.95rem',textTransform:'capitalize'}}>{lastSession.exercise.replace(/_/g,' ')}</div>
              </div>
              <div>
                <div style={{fontSize:'0.75rem',color:'var(--text-tertiary)',marginBottom:3,fontFamily:"'Space Mono', monospace",textTransform:'uppercase',letterSpacing:'0.06em'}}>Target</div>
                <div style={{fontFamily:"'Space Mono', monospace",fontSize:'0.9rem',color:'var(--teal-500)'}}>3 × {Math.max(8,lastSession.reps)} reps</div>
              </div>
              <div>
                <div style={{fontSize:'0.75rem',color:'var(--text-tertiary)',marginBottom:3,fontFamily:"'Space Mono', monospace",textTransform:'uppercase',letterSpacing:'0.06em'}}>Focus cue</div>
                <div style={{fontSize:'0.8rem',color:'var(--text-secondary)',fontStyle:'italic',lineHeight:1.5}}>
                  {lastSession.formScore>=85?'Maintain excellent form — increase load slightly.':
                   lastSession.formScore>=70?'Keep hips aligned and core engaged throughout.':
                   'Slow down the eccentric phase — control over reps.'}
                </div>
              </div>
              <div style={{fontSize:'0.75rem',color:'var(--text-tertiary)'}}>Last: {new Date(lastSession.date).toLocaleDateString()} · score {lastSession.formScore}%</div>
              <button className="btn-primary" onClick={()=>navigate('/session')}>Start Session →</button>
            </div>
          )
        )}
      </ElevationCard>

      {/* Quick Links */}
      <div style={{marginTop:16,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
        {[
          {label:'Session',icon:'▶',path:'/session',desc:'Start exercise'},
          {label:'Assessment',icon:'⬡',path:'/assessment',desc:'Full body eval'},
          {label:'Nutrition',icon:'◉',path:'/nutrition',desc:'TDEE + meal plan'},
          {label:'Clinician',icon:'✦',path:'/clinician',desc:'SOAP notes + CPT'},
          {label:'History',icon:'◎',path:'/history',desc:'Session timeline'},
        ].map(q=>(
          <button
            key={q.label}
            onClick={()=>navigate(q.path)}
            style={{
              background:'var(--bg-surface)',
              border:'1px solid var(--border-subtle)',
              borderRadius:12,
              padding:'14px 16px',
              textAlign:'left' as const,
              cursor:'pointer',
              transition:'border-color 0.15s,transform 0.1s',
              color:'var(--text-primary)',
            }}
            onMouseEnter={e=>{
              (e.currentTarget as HTMLButtonElement).style.borderColor='var(--border-teal)';
              (e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)';
            }}
            onMouseLeave={e=>{
              (e.currentTarget as HTMLButtonElement).style.borderColor='var(--border-subtle)';
              (e.currentTarget as HTMLButtonElement).style.transform='translateY(0)';
            }}
          >
            <div style={{fontSize:'0.9rem',color:'var(--teal-500)',marginBottom:4}}>{q.icon}</div>
            <div style={{fontSize:'0.82rem',fontWeight:600,marginBottom:2}}>{q.label}</div>
            <div style={{fontSize:'0.7rem',color:'var(--text-tertiary)'}}>{q.desc}</div>
          </button>
        ))}
      </div>
    </div>
  </PageTransition>
  );
}

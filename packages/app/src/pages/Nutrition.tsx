import { useState, useMemo } from 'react';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { AiChatPanel } from '../components/AiChatPanel.js';
import { SlidingTabs } from '../components/ui/SlidingTabs.js';
import {
  GRADE_META, ACTIVITY_MULTIPLIERS, CONDITION_SUPPLEMENTS, LAB_TESTS,
  RECOVERY_PHASES, CONDITIONS, PHASE_NUTRIENTS,
  detectRecoveryPhase, filterNutrients,
  type EvidenceGrade, type SupplementRec, type LabTest,
  type RecoveryPhase, type ConditionKey, type NutrientRec,
} from '../lib/nutritionProtocol.js';

// ─── Local types ──────────────────────────────────────────────────────────────

interface DayMeals { day: string; breakfast: string; lunch: string; dinner: string; snack: string; avoidNote?: string; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function DonutChart({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9;
  const pPct = (protein * 4) / total, cPct = (carbs * 4) / total, fPct = (fat * 9) / total;
  const r = 54, cx = 70, cy = 70, circ = 2 * Math.PI * r;
  const arc = (pct: number, off: number) => ({ strokeDasharray: `${pct * circ} ${circ}`, strokeDashoffset: -off * circ });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--teal-500)" strokeWidth={16} strokeLinecap="butt" transform="rotate(-90 70 70)" {...arc(pPct, 0)} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--blue-400)" strokeWidth={16} strokeLinecap="butt" transform="rotate(-90 70 70)" {...arc(cPct, pPct)} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--amber-400)" strokeWidth={16} strokeLinecap="butt" transform="rotate(-90 70 70)" {...arc(fPct, pPct + cPct)} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)" fontFamily="Space Mono, monospace">KCAL</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={13} fontWeight="600" fill="var(--text-primary)" fontFamily="Space Mono, monospace">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([['var(--teal-500)', 'Protein', protein, pPct], ['var(--blue-400)', 'Carbs', carbs, cPct], ['var(--amber-400)', 'Fat', fat, fPct]] as [string, string, number, number][])
          .map(([color, label, g, pct]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', minWidth: 52 }}>{label}</span>
              <span style={{ fontWeight: 600, fontFamily: "'Space Mono', monospace", color: 'var(--text-primary)' }}>{g}g</span>
              <span style={{ color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace", fontSize: '0.72rem' }}>{Math.round(pct * 100)}%</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function GradeBadge({ grade }: { grade: EvidenceGrade }) {
  const m = GRADE_META[grade];
  return <span style={{ background: m.bg, color: m.color, borderRadius: 4, padding: '2px 7px', fontSize: '0.7rem', fontWeight: 600 }}>{m.label}</span>;
}

function NutrientCard({ n, insight, loadingInsight }: { n: NutrientRec; insight?: string; loadingInsight?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 18px', marginBottom: 10, background: 'var(--bg-elevated)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{n.name}</span>
        <GradeBadge grade={n.grade} />
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1rem', fontWeight: 600, color: 'var(--teal-500)', marginBottom: 4 }}>{n.dose}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{n.mechanism}</div>
      {loadingInsight && (
        <div style={{ height: 14, borderRadius: 4, background: 'linear-gradient(90deg, var(--bg-surface), var(--bg-elevated), var(--bg-surface))', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: 6 }} />
      )}
      {insight && !loadingInsight && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace", flexShrink: 0, paddingTop: 2 }}>HAIKU</span>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{insight}</span>
        </div>
      )}
      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
        {n.citation}{n.pmid ? ` · PMID: ${n.pmid}` : ''}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>Timing: {n.timing}</div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const page: React.CSSProperties   = { maxWidth: 1000, margin: '0 auto', padding: '100px 24px 48px' };
const h1: React.CSSProperties     = { fontFamily: "'Syne', sans-serif", fontSize: 'var(--text-3xl)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 };
const muted: React.CSSProperties  = { color: 'var(--text-secondary)', fontSize: '0.82rem' };
const card: React.CSSProperties   = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 };
const sH: React.CSSProperties     = { fontSize: '0.85rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: "'Space Mono', monospace" };
const btn: React.CSSProperties    = { padding: '8px 18px', borderRadius: 8, background: 'var(--teal-500)', color: '#000', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' };
const btnSm: React.CSSProperties  = { padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500, color: 'var(--text-secondary)' };
const statB: React.CSSProperties  = { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 18px', minWidth: 110, textAlign: 'center' as const };
const tag: React.CSSProperties    = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, fontFamily: "'Space Mono', monospace" };

const PHASE_TABS = Object.entries(RECOVERY_PHASES).map(([key, v]) => ({ key, label: v.label }));

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Nutrition() {
  const { userProfile } = useUserProfile();

  const lastSession = useMemo(() => {
    try {
      const raw = localStorage.getItem('physiocore_sessions');
      const sessions = raw ? (JSON.parse(raw) as { date: string }[]) : [];
      return sessions.length ? sessions[sessions.length - 1]!.date : null;
    } catch { return null; }
  }, []);

  const [activePhase, setActivePhase] = useState<RecoveryPhase>(detectRecoveryPhase(lastSession));
  const [activeCondition, setActiveCondition] = useState<ConditionKey | null>(null);
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [loadingInsight, setLoadingInsight] = useState<string | null>(null);
  const [suppRecs, setSuppRecs] = useState<SupplementRec[] | null>(null);
  const [loadingSupp, setLoadingSupp] = useState(false);
  const [suppError, setSuppError] = useState('');
  const [stack, setStack] = useState<SupplementRec[]>([]);

  if (!userProfile) return <div style={{ ...page, ...muted }}>Profile not loaded.</div>;

  const age = Math.floor((Date.now() - new Date(userProfile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000));
  const isStrength = ['strengthening', 'performance'].includes(userProfile.primaryGoal);
  const hasRenal   = userProfile.conditions.some(c => /renal|kidney/i.test(c.name));
  const proteinPerKg = isStrength ? (hasRenal ? 1.2 : 2.0) : 1.6;
  const proteinG = Math.round(userProfile.weightKg * proteinPerKg);
  const sexFactor = userProfile.gender === 'male' ? 5 : -161;
  const bmr = 10 * userProfile.weightKg + 6.25 * userProfile.heightCm - 5 * age + sexFactor;
  const tdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[userProfile.fitnessLevel] ?? 1.55));
  const goalAdj: Record<string, number> = { rehabilitation: 0, strengthening: 250, flexibility: 0, pain_management: 0, performance: 350 };
  const targetKcal = tdee + (goalAdj[userProfile.primaryGoal] ?? 0);
  const fatG = Math.round((targetKcal * 0.28) / 9);
  const carbG = Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4);
  const hydrationMl = Math.round(userProfile.weightKg * 35);
  const conditionNames = userProfile.conditions.filter(c => c.isActive).map(c => c.name.toLowerCase());
  const hasDiabetes = conditionNames.some(c => /diabet/i.test(c));
  const hasHTN      = conditionNames.some(c => /hypertens/i.test(c));
  const hasOA       = conditionNames.some(c => /osteoarthr/i.test(c));

  const phaseNutrients = useMemo(() => filterNutrients(activePhase, activeCondition), [activePhase, activeCondition]);

  const conditionSupplements = useMemo(() => {
    const seen = new Set<string>(); const out: SupplementRec[] = [];
    const add = (k: string) => (CONDITION_SUPPLEMENTS[k] ?? []).forEach(s => { if (!seen.has(s.name)) { seen.add(s.name); out.push(s); } });
    if (hasOA) add('osteoarthritis'); if (hasDiabetes) add('diabetes'); if (hasHTN) add('hypertension');
    if (userProfile.primaryGoal === 'flexibility') add('flexibility');
    if (['strengthening', 'performance'].includes(userProfile.primaryGoal)) add('general_athlete');
    if (userProfile.primaryGoal === 'rehabilitation') add('post_surgery');
    if (out.length === 0) add('general_athlete');
    return out;
  }, [userProfile, hasOA, hasDiabetes, hasHTN]);

  const stackInteractions = useMemo(() => {
    const w: string[] = []; const names = stack.map(s => s.name.toLowerCase());
    if (names.includes('berberine hcl') && userProfile.medications.some(m => /metformin/i.test(m.name))) w.push('Berberine + Metformin: additive hypoglycemic effect — monitor glucose closely');
    if (names.includes('coq10 (ubiquinol)') && userProfile.medications.some(m => /warfarin/i.test(m.name))) w.push('CoQ10 + Warfarin: may reduce warfarin efficacy — monitor INR');
    return w;
  }, [stack, userProfile.medications]);

  const stackCost = useMemo(() => stack.reduce((a, s) => a + (parseInt(s.cost.replace(/[^0-9]/g, ''), 10) || 0), 0), [stack]);
  const displaySupplements = suppRecs ?? conditionSupplements;
  const labTests = LAB_TESTS.filter(t => t.code !== 'Glycated haemoglobin' || hasDiabetes || hasHTN);

  async function fetchNutrientInsight(n: NutrientRec) {
    if (insights[n.name] || loadingInsight) return;
    setLoadingInsight(n.name);
    try {
      const resp = await fetch('/api/nutrition-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nutrient: n.name, phase: activePhase, condition: activeCondition }),
      });
      const data = await resp.json() as { insight: string };
      setInsights(prev => ({ ...prev, [n.name]: data.insight }));
    } catch { /* silent */ }
    setLoadingInsight(null);
  }

  async function fetchSupplements() {
    if (!userProfile) return;
    setLoadingSupp(true); setSuppError('');
    try {
      const apiKey = (import.meta.env as Record<string, string>)['VITE_ANTHROPIC_KEY'];
      if (!apiKey) throw new Error('VITE_ANTHROPIC_KEY not set');
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 4000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: `Clinical pharmacist + sports nutritionist. Patient: ${age}yo, ${userProfile.weightKg}kg. Conditions: ${conditionNames.join(', ') || 'none'}. Medications: ${userProfile.medications.map(m => m.name).join(', ') || 'none'}. Goal: ${userProfile.primaryGoal}. Search examine.com and Labdoor. Evidence grade A/B/C/D. Respond ONLY with valid JSON array with fields: { name, mechanism, grade, dose, timing, contraindications, interactions, product, productUrl, cost, citation, conditions }`,
          messages: [{ role: 'user', content: 'Find evidence-based supplement recommendations with citations.' }],
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content.find(b => b.type === 'text')?.text ?? '';
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
      setSuppRecs(JSON.parse((match ? (match[1] ?? match[0]) : text).trim()) as SupplementRec[]);
    } catch (e) { setSuppError(String(e)); }
    setLoadingSupp(false);
  }

  function toggleStack(s: SupplementRec) {
    setStack(prev => prev.some(x => x.name === s.name) ? prev.filter(x => x.name !== s.name) : [...prev, s]);
  }

  // TODO: DownloadReport component — not yet built (packages/app/src/components/DownloadReport.tsx)

  return (
    <div style={page}>
      <h1 style={h1}>Nutrition & Supplements</h1>
      <p style={{ ...muted, marginBottom: 28 }}>Evidence-based recommendations for {userProfile.name} · Every recommendation cites sources.</p>

      {/* ─── TDEE + Macros ─────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sH}><span style={{ fontSize: '1.2rem' }}>🔢</span> Macronutrient Calculator</div>
        <div style={{ background: 'var(--bg-void)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '14px 18px', fontFamily: "'Space Mono', monospace", fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.9 }}>
          <div>BMR = (10 × {userProfile.weightKg}kg) + (6.25 × {userProfile.heightCm}cm) − (5 × {age}y) {userProfile.gender === 'male' ? '+5' : '−161'} = {Math.round(bmr)} kcal</div>
          <div>TDEE = BMR × {ACTIVITY_MULTIPLIERS[userProfile.fitnessLevel] ?? 1.55} ({userProfile.fitnessLevel}) = <strong style={{ color: 'var(--teal-500)' }}>{tdee} kcal/day</strong></div>
          {(goalAdj[userProfile.primaryGoal] ?? 0) !== 0 && <div style={{ color: '#22c55e' }}>Goal adjustment: +{goalAdj[userProfile.primaryGoal]} kcal → Target: <strong>{targetKcal} kcal/day</strong></div>}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 14 }}>
          {[['Daily kcal', targetKcal, 'var(--teal-500)'], [`Protein (${proteinPerKg}g/kg)`, `${proteinG}g`, 'var(--teal-400)'], ['Carbs', `${carbG}g`, 'var(--blue-400)'], ['Fat', `${fatG}g`, 'var(--amber-400)'], ['Hydration', `${hydrationMl}ml`, 'var(--info)']].map(([label, val, color]) => (
            <div key={String(label)} style={statB}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.3rem', fontWeight: 600, color: String(color) }}>{val}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
        {hasRenal   && <div style={{ background: 'rgba(255,184,48,0.08)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: '0.8rem', color: 'var(--warning)' }}>⚠ Renal condition — protein limited to 1.2g/kg. Consult nephrologist.</div>}
        {hasDiabetes && <div style={{ background: 'rgba(255,184,48,0.08)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: '0.8rem', color: 'var(--warning)' }}>⚠ Diabetes — focus on low-GI sources (oats, legumes, vegetables). Monitor post-meal glucose.</div>}
        {hasHTN     && <div style={{ background: 'rgba(255,184,48,0.08)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: '0.8rem', color: 'var(--warning)' }}>⚠ Hypertension — target sodium &lt;2300mg/day. DASH diet pattern recommended.</div>}
        <DonutChart protein={proteinG} carbs={carbG} fat={fatG} />
        <p style={{ ...muted, marginTop: 10, fontSize: '0.75rem' }}>Mifflin-St Jeor, 1990, JADA · Stokes T et al., 2018, Nutrients (protein targets)</p>
      </div>

      {/* ─── Recovery Phase Nutrients ──────────────────────────────────────── */}
      <div style={card}>
        <div style={sH}><span style={{ fontSize: '1.2rem' }}>💊</span> Recovery Phase Nutrients</div>
        <SlidingTabs tabs={PHASE_TABS} active={activePhase} onChange={k => { setActivePhase(k as RecoveryPhase); setInsights({}); }} style={{ marginBottom: 16 }} />

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.8rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{RECOVERY_PHASES[activePhase].range}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{RECOVERY_PHASES[activePhase].focus}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {RECOVERY_PHASES[activePhase].foods.map(f => (
              <span key={f} style={{ ...tag, background: 'rgba(0,212,170,0.07)', color: 'var(--teal-500)', fontSize: '0.68rem' }}>{f}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
          <button
            style={{ ...btnSm, background: activeCondition === null ? 'var(--teal-500)' : 'var(--bg-elevated)', color: activeCondition === null ? '#000' : 'var(--text-secondary)', border: 'none' }}
            onClick={() => setActiveCondition(null)}
          >All conditions</button>
          {(Object.entries(CONDITIONS) as [ConditionKey, { label: string; emoji: string }][]).map(([k, c]) => (
            <button
              key={k}
              style={{ ...btnSm, background: activeCondition === k ? 'var(--teal-500)' : 'var(--bg-elevated)', color: activeCondition === k ? '#000' : 'var(--text-secondary)', border: activeCondition === k ? 'none' : '1px solid var(--border-default)' }}
              onClick={() => setActiveCondition(prev => prev === k ? null : k)}
            >{c.emoji} {c.label}</button>
          ))}
        </div>

        {phaseNutrients.length === 0 && <p style={muted}>No specific nutrients match this phase + condition combination.</p>}
        {phaseNutrients.map(n => (
          <div key={n.name} onClick={() => { void fetchNutrientInsight(n); }} style={{ cursor: 'pointer' }}>
            <NutrientCard n={n} insight={insights[n.name]} loadingInsight={loadingInsight === n.name} />
          </div>
        ))}
        <p style={{ ...muted, fontSize: '0.73rem', marginTop: 4 }}>Click a card to generate an AI insight. Decision support only — consult a registered dietitian.</p>
      </div>

      {/* ─── Supplement Protocol ───────────────────────────────────────────── */}
      <div style={card}>
        <div style={sH}>
          <span style={{ fontSize: '1.2rem' }}>🧪</span> Condition Supplement Protocol
          <button style={{ ...btn, marginLeft: 'auto', padding: '7px 16px', background: '#7c3aed', fontSize: '0.8rem' }} onClick={() => { void fetchSupplements(); }} disabled={loadingSupp}>
            {loadingSupp ? 'Searching...' : suppRecs ? 'Re-search' : 'Search with web_search'}
          </button>
        </div>
        <p style={{ ...muted, marginBottom: 14 }}>{suppRecs ? 'Results from live web search.' : 'Condition-based defaults. Click Search for live examine.com citations.'}</p>
        {suppError && <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: 10 }}>Error: {suppError}</div>}
        {loadingSupp && <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Searching examine.com, PubMed, Labdoor...</div>}
        {!loadingSupp && displaySupplements.map((s, i) => {
          const inStack = stack.some(x => x.name === s.name);
          return (
            <div key={i} style={{ border: `1px solid ${inStack ? 'var(--border-teal)' : 'var(--border-subtle)'}`, borderRadius: 12, padding: '14px 18px', marginBottom: 10, background: inStack ? 'var(--teal-dim)' : 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.name}</span>
                  <GradeBadge grade={s.grade as EvidenceGrade} />
                </div>
                <button style={{ ...btnSm, background: inStack ? 'var(--teal-500)' : 'var(--bg-overlay)', color: inStack ? '#000' : 'var(--text-secondary)', border: inStack ? 'none' : '1px solid var(--border-default)' }} onClick={() => { toggleStack(s); }}>
                  {inStack ? '✓ In stack' : '+ Add'}
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px 20px' }}>
                <div><span style={muted}>Dose: </span><strong style={{ fontFamily: "'Space Mono', monospace", color: 'var(--teal-500)' }}>{s.dose}</strong></div>
                <div><span style={muted}>Timing: </span>{s.timing}</div>
                {s.contraindications && <div style={{ gridColumn: '1 / -1' }}><span style={muted}>Contraindications: </span>{s.contraindications}</div>}
                {s.interactions && <div style={{ gridColumn: '1 / -1', color: s.interactions.includes('⚠') ? 'var(--warning)' : 'inherit' }}><span style={muted}>Interactions: </span>{s.interactions}</div>}
              </div>
              {s.citation && <div style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{s.citation}</div>}
            </div>
          );
        })}
        {stack.length > 0 && (
          <div style={{ marginTop: 12, background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{stack.length} supplements · ~${stackCost}/month</span>
              <button style={btnSm} onClick={() => { const b = new Blob([stack.map(s => `${s.name} — ${s.dose}\n${s.product}`).join('\n\n')], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'supplement-stack.txt'; a.click(); }}>Export list</button>
            </div>
            {stackInteractions.map((w, i) => <div key={i} style={{ fontSize: '0.78rem', color: 'var(--warning)', marginBottom: 4 }}>⚠ {w}</div>)}
            {stackInteractions.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--success)' }}>✓ No significant interactions detected</div>}
          </div>
        )}
      </div>

      {/* ─── Lab Tests ─────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sH}><span style={{ fontSize: '1.2rem' }}>🩸</span> Lab Test Recommendations</div>
        <div style={{ background: 'var(--blue-dim)', border: '1px solid rgba(77,184,255,0.2)', borderRadius: 8, padding: '10px 16px', fontSize: '0.78rem', color: 'var(--blue-400)', marginBottom: 16 }}>
          Ask your GP for these tests based on your conditions. Reference ranges for adults — your lab may differ.
        </div>
        {labTests.map((t, i) => (
          <div key={i} style={{ borderBottom: i < labTests.length - 1 ? '1px solid var(--border-subtle)' : 'none', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{t.name}</span>
              <span style={{ ...tag, background: 'var(--bg-overlay)', color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>{t.code}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>{t.reason}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={muted}>Range: </span><span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.72rem' }}>{t.refRange}</span>
              <span style={muted}> · If abnormal: </span><span style={{ color: 'var(--blue-400)' }}>{t.action}</span>
            </div>
          </div>
        ))}
        <p style={{ ...muted, marginTop: 12, fontSize: '0.73rem' }}>Not a substitute for clinical assessment. Consult your GP.</p>
      </div>

      <AiChatPanel
        pageContext={`Nutrition page. TDEE: ${targetKcal} kcal. Protein: ${proteinG}g, Carbs: ${carbG}g, Fat: ${fatG}g. Recovery phase: ${activePhase}. Active conditions: ${conditionNames.join(', ') || 'none'}. Supplement stack: ${stack.map(s => s.name).join(', ') || 'empty'}.`}
        quickPrompts={['How do I get enough protein on a vegetarian diet?', 'I have a gluten allergy — what should I avoid?', 'Are any of my supplements unsafe with my medications?', 'Suggest Indian food options that fit my macros']}
      />
    </div>
  );
}

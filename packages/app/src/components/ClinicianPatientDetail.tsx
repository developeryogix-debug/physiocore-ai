import { useState, useCallback } from 'react';
import type { MockPatient, MockSession, SoapNote, HepExercise } from '../lib/clinicianTypes.js';
import { CPT_DESCRIPTIONS } from '../lib/clinicianTypes.js';

// ── Helper: pain zone keywords → body region labels ───────────────────────────

const ZONE_MAP: Array<[string, string[]]> = [
  ['knee',       ['Left Knee', 'Right Knee']],
  ['acl',        ['Right Knee']],
  ['shoulder',   ['Left Shoulder', 'Right Shoulder']],
  ['rotator',    ['Right Shoulder']],
  ['disc',       ['Lower Back']],
  ['lower back', ['Lower Back']],
  ['hip',        ['Left Hip', 'Right Hip']],
  ['osteoporosis',['Left Hip', 'Right Hip', 'Spine']],
  ['fibromyalgia',['Neck', 'Upper Back', 'Lower Back', 'Left Hip', 'Right Hip', 'Left Knee', 'Right Knee']],
  ['elbow',      ['Left Elbow', 'Right Elbow']],
  ['wrist',      ['Left Wrist', 'Right Wrist']],
  ['ankle',      ['Left Ankle', 'Right Ankle']],
  ['neck',       ['Neck']],
];

function getActiveZones(conditions: string[]): Set<string> {
  const zones = new Set<string>();
  const text = conditions.join(' ').toLowerCase();
  for (const [kw, zs] of ZONE_MAP) {
    if (text.includes(kw)) zs.forEach(z => zones.add(z));
  }
  return zones;
}

// ── Risk factor computation ───────────────────────────────────────────────────

function computeRisk(p: MockPatient) {
  const scores = p.sessions.map(s => s.formScore);
  const oldest = scores[scores.length - 1] ?? 0;
  const newest = scores[0] ?? 0;
  const trend   = scores.length >= 2 ? (newest >= oldest ? 1 : 0.35) : 0.65;
  const daysSinceLast = p.sessions.length > 0
    ? (Date.now() - new Date(p.sessions[0]?.date ?? 0).getTime()) / 86400000
    : 30;
  const freq       = Math.max(0, 1 - daysSinceLast / 21);
  const conditions = Math.max(0, 1 - (p.conditions.length - 1) * 0.2);
  const adherence  = p.adherencePct / 100;
  return {
    factors: [
      { label: 'Adherence',         score: adherence,   weight: 0.35, evidence: 'A', reason: `${p.adherencePct}% sessions completed vs target` },
      { label: 'Form Trend',        score: trend,       weight: 0.25, evidence: 'B', reason: `Score ${oldest}→${newest} over ${scores.length} sessions` },
      { label: 'Session Frequency', score: freq,        weight: 0.25, evidence: 'A', reason: `Last session ${Math.round(daysSinceLast)} days ago` },
      { label: 'Condition Burden',  score: conditions,  weight: 0.15, evidence: 'B', reason: `${p.conditions.length} active condition${p.conditions.length !== 1 ? 's' : ''}` },
    ],
    overall: adherence * 0.35 + trend * 0.25 + freq * 0.25 + conditions * 0.15,
  };
}

// ── FHIR R4 bundle builder ────────────────────────────────────────────────────

function buildFhir(p: MockPatient, soap?: SoapNote | null) {
  const now = new Date().toISOString();
  const entries: object[] = [
    { resource: { resourceType: 'Patient', id: p.id,
        name: [{ use: 'official', given: [p.name.split(' ')[0] ?? ''], family: p.name.split(' ')[1] ?? '' }],
        birthDate: p.dob, gender: p.gender } },
    ...p.conditions.map((c, i) => ({ resource: { resourceType: 'Condition', id: `${p.id}-cond-${i}`,
        subject: { reference: `Patient/${p.id}` }, code: { text: c },
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        recordedDate: now } })),
    ...p.sessions.map((s, i) => ({ resource: { resourceType: 'Observation', id: `${p.id}-obs-${i}`,
        status: 'final', subject: { reference: `Patient/${p.id}` }, effectiveDateTime: s.date,
        code: { text: `PhysioCore AI Form Score — ${s.exercise}` },
        valueQuantity: { value: s.formScore, unit: 'score', system: 'http://unitsofmeasure.org', code: '{score}' },
        component: [
          { code: { text: 'Repetitions' },    valueQuantity: { value: s.reps } },
          { code: { text: 'Duration (min)' }, valueQuantity: { value: s.durationMin } },
          { code: { text: 'Peak Angle (°)' }, valueQuantity: { value: s.peakAngle ?? null } },
          { code: { text: 'View mode' },      valueString: s.viewMode },
        ] } })),
  ];
  if (soap) {
    entries.push({ resource: { resourceType: 'DiagnosticReport', id: `${p.id}-dr`,
      status: 'final', subject: { reference: `Patient/${p.id}` }, issued: now,
      code: { text: 'Physiotherapy Progress Note (SOAP)' },
      text: { status: 'generated',
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><p><b>S:</b> ${soap.subjective}</p><p><b>O:</b> ${soap.objective}</p><p><b>A:</b> ${soap.assessment}</p><p><b>P:</b> ${soap.plan}</p></div>` },
      conclusion: `CPT: ${soap.cptCodes.join(', ')}` } });
  }
  return { resourceType: 'Bundle', id: `physiocore-${p.id}-${Date.now()}`, type: 'collection', timestamp: now, entry: entries };
}

// ── Micro-components ──────────────────────────────────────────────────────────

function TrendChart({ sessions }: { sessions: MockSession[] }) {
  const ordered = [...sessions].reverse();
  if (ordered.length < 2) return <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Not enough data</span>;
  const scores = ordered.map(s => s.formScore);
  const W = 280, H = 60, pad = 8;
  const lo = Math.max(0, Math.min(...scores) - 5), hi = Math.min(100, Math.max(...scores) + 5);
  const tx = (i: number) => pad + (i / (scores.length - 1)) * (W - 2 * pad);
  const ty = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const pts = scores.map((s, i) => `${tx(i)},${ty(s)}`).join(' ');
  const fill = `${pts} ${W - pad},${H} ${pad},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', maxWidth: 280 }}>
      <polygon points={fill} fill="rgba(99,102,241,0.10)" />
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
      {scores.map((s, i) => <circle key={i} cx={tx(i)} cy={ty(s)} r="3" fill="#6366f1" />)}
    </svg>
  );
}

function BodyMap({ conditions }: { conditions: string[] }) {
  const active = getActiveZones(conditions);
  const zones = [
    [null, 'Neck', null],
    ['Left Shoulder', 'Upper Back', 'Right Shoulder'],
    ['Left Elbow', 'Spine', 'Right Elbow'],
    ['Left Wrist', 'Lower Back', 'Right Wrist'],
    ['Left Hip', null, 'Right Hip'],
    ['Left Knee', null, 'Right Knee'],
    ['Left Ankle', null, 'Right Ankle'],
  ];
  return (
    <div style={{ display: 'inline-grid', gridTemplateColumns: '1fr auto 1fr', gap: '3px 4px', alignItems: 'center' }}>
      {zones.flatMap((row, ri) => row.map((z, ci) =>
        z ? (
          <div key={`${ri}-${ci}`} title={z}
            style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: active.has(z) ? 700 : 400,
              background: active.has(z) ? '#fee2e2' : '#f1f5f9',
              color: active.has(z) ? '#b91c1c' : '#94a3b8',
              border: `1px solid ${active.has(z) ? '#fca5a5' : '#e2e8f0'}`,
              textAlign: ci === 1 ? 'center' : ci === 0 ? 'right' : 'left', whiteSpace: 'nowrap' }}>
            {z.replace('Left ', 'L ').replace('Right ', 'R ')}
          </div>
        ) : <div key={`${ri}-${ci}`} />
      ))}
    </div>
  );
}

function AdherenceCalendar({ sessions }: { sessions: MockSession[] }) {
  const dates = new Set(sessions.map(s => s.date));
  const today = new Date();
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today.getTime() - (27 - i) * 86400000);
    return d.toISOString().split('T')[0] ?? '';
  });
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
      {DAYS.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: '0.6rem', color: '#94a3b8' }}>{d}</div>)}
      {days.map(d => <div key={d} title={d} style={{ height: 16, borderRadius: 3, background: dates.has(d) ? '#6366f1' : '#f1f5f9' }} />)}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const muted: React.CSSProperties = { color: '#64748b', fontSize: '0.875rem' };
const labelStyle: React.CSSProperties = { fontWeight: 600, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 };
const sectionStyle: React.CSSProperties = { marginBottom: 20 };

interface Props { patient: MockPatient }

export default function ClinicianPatientDetail({ patient: p }: Props) {
  const [soap, setSoap]             = useState<SoapNote | null>(null);
  const [hep, setHep]               = useState<HepExercise[] | null>(null);
  const [loadingSoap, setLoadSoap]  = useState(false);
  const [loadingHep, setLoadHep]    = useState(false);
  const [soapErr, setSoapErr]       = useState('');
  const [hepErr, setHepErr]         = useState('');
  const [showAI, setShowAI]         = useState(false);
  const [riskOverride, setRiskOver] = useState<'low' | 'medium' | 'high' | null>(null);

  const risk    = computeRisk(p);
  const riskLvl = riskOverride ?? p.churnRisk;
  const avg     = p.sessions.length ? Math.round(p.sessions.reduce((s, x) => s + x.formScore, 0) / p.sessions.length) : 0;

  const apiKey = useCallback(() => (import.meta.env as Record<string, string | undefined>)['VITE_ANTHROPIC_API_KEY'], []);

  const generateSoap = useCallback(async () => {
    setLoadSoap(true); setSoapErr(''); setSoap(null);
    try {
      const key = apiKey();
      if (!key) throw new Error('VITE_ANTHROPIC_API_KEY not set');
      const last = p.sessions[0];
      const trend = p.sessions.length >= 2
        ? (p.sessions[0]!.formScore > p.sessions[p.sessions.length - 1]!.formScore ? 'improving' : 'declining')
        : 'insufficient data';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1800,
          system: `You are a physiotherapist writing a detailed clinical SOAP note. Patient: ${p.name}, ${p.age}yo ${p.gender}. Conditions: ${p.conditions.join(', ')}. Medications: ${p.medications.join(', ')}. Goal: ${p.goal}. Last session: ${last?.exercise ?? 'N/A'}, ${last?.reps ?? 0} reps, form score ${last?.formScore ?? 0}/100, peak angle ${last?.peakAngle ?? 'N/A'}°. Average form score: ${avg}/100. Score trend: ${trend}. Sessions: ${p.sessions.length}. Adherence: ${p.adherencePct}%. Respond ONLY with JSON: { subjective, objective, assessment, plan, cptCodes: string[], cptDescriptions: string[] }`,
          messages: [{ role: 'user', content: 'Write a full clinical SOAP note. Include next 4 sessions plan, home exercise recommendations, and flag any red flags. Choose CPT codes from 97110, 97530, 97150, 97140.' }],
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content.find(b => b.type === 'text')?.text ?? '';
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
      setSoap(JSON.parse((match?.[1] ?? match?.[0] ?? text).trim()) as SoapNote);
    } catch (e) { setSoapErr(String(e)); }
    setLoadSoap(false);
  }, [p, avg, apiKey]);

  const generateHep = useCallback(async () => {
    setLoadHep(true); setHepErr(''); setHep(null);
    try {
      const key = apiKey();
      if (!key) throw new Error('VITE_ANTHROPIC_API_KEY not set');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1200,
          system: `You are a physiotherapist creating a home exercise program. Patient: ${p.name}, ${p.age}yo. Conditions: ${p.conditions.join(', ')}. Goal: ${p.goal}. Fitness: ${p.fitnessLevel}. Average form score: ${avg}/100. Respond ONLY with a JSON array of exactly 5 exercises: [{ name, description, sets, reps, frequency, cue }]`,
          messages: [{ role: 'user', content: 'Generate 5 safe, evidence-based home exercises appropriate for the conditions and fitness level. Use body weight or minimal equipment.' }],
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content.find(b => b.type === 'text')?.text ?? '';
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
      setHep(JSON.parse((match?.[1] ?? match?.[0] ?? text).trim()) as HepExercise[]);
    } catch (e) { setHepErr(String(e)); }
    setLoadHep(false);
  }, [p, avg, apiKey]);

  function exportFhir() {
    const bundle = buildFhir(p, soap);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `patient-${p.id}-fhir-r4.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function printSoap() {
    if (!soap) return;
    const html = `<!DOCTYPE html><html><head><title>SOAP Note — ${p.name}</title><style>body{font-family:system-ui;padding:40px;max-width:720px;margin:0 auto;}h1{font-size:1.4rem;}h2{font-size:0.85rem;color:#0369a1;text-transform:uppercase;letter-spacing:.05em;margin-top:24px;}p{line-height:1.7;color:#334155;font-size:0.9rem;}code{background:#f1f5f9;padding:2px 8px;border-radius:4px;}</style></head><body><h1>Clinical Progress Note</h1><p><b>Patient:</b> ${p.name} &nbsp;|&nbsp; <b>Age:</b> ${p.age} &nbsp;|&nbsp; <b>Date:</b> ${new Date().toLocaleDateString()}</p><p><b>Conditions:</b> ${p.conditions.join(', ')}</p><h2>Subjective</h2><p>${soap.subjective}</p><h2>Objective</h2><p>${soap.objective}</p><h2>Assessment</h2><p>${soap.assessment}</p><h2>Plan</h2><p>${soap.plan}</p><h2>CPT Codes</h2><p>${soap.cptCodes.map((c, i) => `<code>${c}</code> ${soap.cptDescriptions[i] ?? ''}`).join(' &nbsp; ')}</p></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  function printHep() {
    if (!hep) return;
    const exHtml = hep.map((e, i) => `<div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0 0 4px;color:#0f172a">${i + 1}. ${e.name}</h3><p style="margin:4px 0;color:#475569;font-size:.9rem">${e.description}</p><p style="margin:4px 0;font-size:.85rem"><b>Sets/Reps:</b> ${e.sets} sets × ${e.reps} &nbsp;|&nbsp; <b>Frequency:</b> ${e.frequency}</p><p style="margin:4px 0;font-size:.82rem;color:#6366f1"><b>💡 Cue:</b> ${e.cue}</p></div>`).join('');
    const html = `<!DOCTYPE html><html><head><title>HEP — ${p.name}</title><style>body{font-family:system-ui;padding:40px;max-width:720px;margin:0 auto;}</style></head><body><h1 style="font-size:1.4rem">Home Exercise Program</h1><p><b>Patient:</b> ${p.name} &nbsp;|&nbsp; <b>Date:</b> ${new Date().toLocaleDateString()}</p><p><b>Goal:</b> ${p.goal} &nbsp;|&nbsp; <b>Conditions:</b> ${p.conditions.join(', ')}</p><p style="color:#64748b;font-size:.82rem">Perform exercises as directed. Stop if pain exceeds 3/10. Contact your physiotherapist with concerns.</p><hr style="margin:20px 0">${exHtml}</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  const riskColors: Record<string, { bg: string; color: string }> = {
    low: { bg: '#dcfce7', color: '#15803d' }, medium: { bg: '#fef9c3', color: '#92400e' }, high: { bg: '#fee2e2', color: '#b91c1c' },
  };
  const rc = riskColors[riskLvl] ?? riskColors['low']!;
  const btn: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginTop: 8, marginBottom: 8 }}>
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { l: 'Height', v: `${p.heightCm} cm` }, { l: 'Weight', v: `${p.weightKg} kg` },
          { l: 'BMI', v: `${(p.weightKg / (p.heightCm / 100) ** 2).toFixed(1)}` },
          { l: 'Goal', v: p.goal }, { l: 'Fitness', v: p.fitnessLevel },
          { l: 'Avg Form', v: `${avg}/100` }, { l: 'Adherence', v: `${p.adherencePct}%` },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155' }}>{s.v}</div>
            <div style={{ ...muted, fontSize: '0.68rem' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Medications */}
      {p.medications.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Medications</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {p.medications.map(m => <span key={m} style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '3px 10px', fontSize: '0.78rem', color: '#9a3412' }}>{m}</span>)}
          </div>
        </div>
      )}

      {/* Adherence calendar + trend chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div>
          <div style={labelStyle}>28-Day Adherence</div>
          <AdherenceCalendar sessions={p.sessions} />
        </div>
        <div>
          <div style={labelStyle}>Form Score Trend</div>
          <TrendChart sessions={p.sessions} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>
            <span>Oldest</span><span>Most recent</span>
          </div>
        </div>
      </div>

      {/* Body map */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Pain Zone Map</div>
        <BodyMap conditions={p.conditions} />
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 6 }}>Red = active condition zone · Gray = unaffected</div>
      </div>

      {/* Session timeline */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Session Timeline</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['Date', 'Exercise', 'Reps', 'Score', 'Peak°', 'Duration', 'Flags'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.sessions.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500 }}>{s.date}</td>
                  <td style={{ padding: '6px 10px' }}>{s.exercise}</td>
                  <td style={{ padding: '6px 10px' }}>{s.reps || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{ fontWeight: 700, color: s.formScore >= 80 ? '#15803d' : s.formScore >= 65 ? '#92400e' : '#b91c1c' }}>{s.formScore}</span>
                  </td>
                  <td style={{ padding: '6px 10px', color: '#64748b' }}>{s.peakAngle != null ? `${s.peakAngle}°` : '—'}</td>
                  <td style={{ padding: '6px 10px', color: '#64748b' }}>{s.durationMin} min</td>
                  <td style={{ padding: '6px 10px' }}>
                    {s.flags?.map(f => <span key={f} style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 4, padding: '1px 5px', fontSize: '0.68rem', marginRight: 3 }}>{f}</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Literacy / Risk Panel */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 16 }}>
        <button onClick={() => setShowAI(v => !v)}
          style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>🔍 Why is this patient rated <span style={{ ...rc, borderRadius: 99, padding: '1px 8px', fontSize: '0.72rem' }}>{riskLvl} risk</span>?</span>
          </div>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{showAI ? '▲' : '▼'}</span>
        </button>
        {showAI && (
          <div style={{ padding: '0 16px 14px', borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '10px 0 12px' }}>AI computed drop-off risk using 4 weighted factors. Overall score: <b>{Math.round(risk.overall * 100)}%</b> (higher = lower risk).</p>
            {risk.factors.map(f => (
              <div key={f.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>{f.label}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', background: '#f1f5f9', borderRadius: 4, padding: '1px 6px', color: '#64748b' }}>Evidence {f.evidence}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>×{f.weight}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.78rem', color: f.score >= 0.7 ? '#15803d' : f.score >= 0.4 ? '#92400e' : '#b91c1c' }}>{Math.round(f.score * 100)}%</span>
                  </div>
                </div>
                <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${f.score * 100}%`, background: f.score >= 0.7 ? '#22c55e' : f.score >= 0.4 ? '#f59e0b' : '#ef4444', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>{f.reason}</div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', gap: 6 }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', alignSelf: 'center' }}>Override risk level:</span>
              {(['low', 'medium', 'high'] as const).map(r => (
                <button key={r} onClick={() => setRiskOver(riskOverride === r ? null : r)}
                  style={{ padding: '3px 10px', borderRadius: 99, border: `1px solid ${riskColors[r]?.color ?? '#000'}`, background: riskOverride === r ? (riskColors[r]?.bg ?? '#fff') : 'transparent', color: riskColors[r]?.color ?? '#000', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                  {r}
                </button>
              ))}
              {riskOverride && <span style={{ fontSize: '0.68rem', color: '#94a3b8', alignSelf: 'center' }}>(overridden from AI)</span>}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button style={{ ...btn, background: '#6366f1', color: '#fff' }} onClick={() => void generateSoap()} disabled={loadingSoap}>
          {loadingSoap ? '⏳ Generating…' : '📝 Generate SOAP Note'}
        </button>
        <button style={{ ...btn, background: '#0369a1', color: '#fff' }} onClick={() => void generateHep()} disabled={loadingHep}>
          {loadingHep ? '⏳ Generating…' : '🏠 Generate HEP'}
        </button>
        <button style={{ ...btn, background: '#0f172a', color: '#fff' }} onClick={exportFhir}>
          📦 Export FHIR R4
        </button>
      </div>
      {soapErr && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginBottom: 8 }}>SOAP error: {soapErr}</div>}
      {hepErr  && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginBottom: 8 }}>HEP error: {hepErr}</div>}

      {/* SOAP note */}
      {soap && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0369a1', marginBottom: 12 }}>
            Clinical Progress Note — {p.name} · {new Date().toLocaleDateString()}
          </div>
          {(['S — Subjective', 'O — Objective', 'A — Assessment', 'P — Plan'] as const).map((label, i) => {
            const val = [soap.subjective, soap.objective, soap.assessment, soap.plan][i]!;
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: '0.83rem', color: '#334155', lineHeight: 1.6 }}>{val}</div>
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid #bae6fd', paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#0369a1', marginBottom: 6 }}>CPT CODES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {soap.cptCodes.map((code, i) => (
                <div key={code} style={{ background: '#fff', border: '1px solid #bae6fd', borderRadius: 7, padding: '5px 10px', fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: '#0369a1' }}>{code}</span>{' '}
                  <span style={{ color: '#64748b' }}>{soap.cptDescriptions[i] ?? CPT_DESCRIPTIONS[code] ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
          <button style={{ ...btn, background: '#0f172a', color: '#fff' }} onClick={printSoap}>🖨 Print / Save PDF</button>
        </div>
      )}

      {/* HEP */}
      {hep && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#15803d', marginBottom: 12 }}>
            🏠 Home Exercise Program — {p.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {hep.map((e, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: 2 }}>{i + 1}. {e.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 4 }}>{e.description}</div>
                <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap' }}>
                  <span>📊 {e.sets} sets × {e.reps}</span>
                  <span>📅 {e.frequency}</span>
                  <span style={{ color: '#15803d' }}>💡 {e.cue}</span>
                </div>
              </div>
            ))}
          </div>
          <button style={{ ...btn, background: '#15803d', color: '#fff' }} onClick={printHep}>🖨 Print HEP</button>
        </div>
      )}
    </div>
  );
}

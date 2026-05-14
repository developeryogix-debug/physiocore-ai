// packages/app/src/pages/PainMap.tsx
// Interactive body pain map — patient self-report UI
// Uses SVG body outline with clickable regions
// Max 500 lines per CLAUDE.md

import { useState } from 'react';
import { runPainMapAgent, PainRegion, PainQuality, PainBehaviour } from '@physiocore/assessment-agent/painMapAgent';

// ── Body regions (front + back view) ─────────────────────────
const BODY_REGIONS = [
  { id: 'cervical_central',    label: 'Neck',           bodyPart: 'cervical',  side: 'central', cx: 200, cy: 80,  view: 'front' },
  { id: 'shoulder_right',      label: 'R Shoulder',     bodyPart: 'shoulder',  side: 'right',   cx: 140, cy: 120, view: 'front' },
  { id: 'shoulder_left',       label: 'L Shoulder',     bodyPart: 'shoulder',  side: 'left',    cx: 260, cy: 120, view: 'front' },
  { id: 'thoracic_central',    label: 'Mid Back',       bodyPart: 'thoracic',  side: 'central', cx: 200, cy: 160, view: 'back'  },
  { id: 'lumbar_central',      label: 'Low Back',       bodyPart: 'lumbar',    side: 'central', cx: 200, cy: 220, view: 'back'  },
  { id: 'hip_right',           label: 'R Hip',          bodyPart: 'hip',       side: 'right',   cx: 155, cy: 250, view: 'front' },
  { id: 'hip_left',            label: 'L Hip',          bodyPart: 'hip',       side: 'left',    cx: 245, cy: 250, view: 'front' },
  { id: 'knee_right',          label: 'R Knee',         bodyPart: 'knee',      side: 'right',   cx: 155, cy: 340, view: 'front' },
  { id: 'knee_left',           label: 'L Knee',         bodyPart: 'knee',      side: 'left',    cx: 245, cy: 340, view: 'front' },
  { id: 'ankle_right',         label: 'R Ankle',        bodyPart: 'ankle',     side: 'right',   cx: 155, cy: 430, view: 'front' },
  { id: 'ankle_left',          label: 'L Ankle',        bodyPart: 'ankle',     side: 'left',    cx: 245, cy: 430, view: 'front' },
  { id: 'elbow_right',         label: 'R Elbow',        bodyPart: 'elbow',     side: 'right',   cx: 110, cy: 200, view: 'front' },
  { id: 'elbow_left',          label: 'L Elbow',        bodyPart: 'elbow',     side: 'left',    cx: 290, cy: 200, view: 'front' },
  { id: 'wrist_right',         label: 'R Wrist',        bodyPart: 'wrist',     side: 'right',   cx: 85,  cy: 265, view: 'front' },
  { id: 'wrist_left',          label: 'L Wrist',        bodyPart: 'wrist',     side: 'left',    cx: 315, cy: 265, view: 'front' },
] as const;

const PAIN_QUALITIES: PainQuality[] = ['sharp','dull','burning','aching','throbbing','stabbing','cramping','shooting','tingling','numbness'];
const PAIN_BEHAVIOURS: PainBehaviour[] = ['constant','intermittent','on_movement','at_rest','worse_morning','worse_evening','better_rest','better_heat','better_cold'];

export default function PainMap() {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [painRegions, setPainRegions] = useState<Record<string, PainRegion>>({});
  const [globalNprs, setGlobalNprs] = useState(0);
  const [functionalLimitation, setFunctionalLimitation] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runPainMapAgent>> | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');

  const selectedRegion = selectedRegionId ? painRegions[selectedRegionId] : null;
  const regionTemplate = BODY_REGIONS.find(r => r.id === selectedRegionId);

  function updateRegion(field: keyof PainRegion, value: unknown) {
    if (!selectedRegionId || !regionTemplate) return;
    setPainRegions(prev => ({
      ...prev,
      [selectedRegionId]: {
        id: selectedRegionId,
        label: regionTemplate.label,
        bodyPart: regionTemplate.bodyPart,
        side: regionTemplate.side as PainRegion['side'],
        nprs: 0,
        qualities: [],
        behaviours: [],
        onsetWeeks: 0,
        radiates: false,
        ...prev[selectedRegionId],
        [field]: value,
      },
    }));
  }

  function toggleQuality(q: PainQuality) {
    const current = painRegions[selectedRegionId!]?.qualities ?? [];
    const next = current.includes(q) ? current.filter(x => x !== q) : [...current, q];
    updateRegion('qualities', next);
  }

  function toggleBehaviour(b: PainBehaviour) {
    const current = painRegions[selectedRegionId!]?.behaviours ?? [];
    const next = current.includes(b) ? current.filter(x => x !== b) : [...current, b];
    updateRegion('behaviours', next);
  }

  async function runAnalysis() {
    const regions = Object.values(painRegions).filter(r => r.nprs > 0);
    if (regions.length === 0) return;
    setIsAnalysing(true);
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_KEY as string;
      const output = await runPainMapAgent({
        userId: 'current_user',
        sessionId: crypto.randomUUID(),
        regions,
        globalNprs,
        functionalLimitation,
      }, apiKey);
      setResult(output);
    } finally {
      setIsAnalysing(false);
    }
  }

  const nprsColor = (n: number) =>
    n === 0 ? 'var(--text-secondary)' :
    n <= 3  ? '#22c55e' :
    n <= 6  ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', color: 'var(--text-primary)', paddingTop: 100, paddingBottom: 60 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--teal-500)', marginBottom: '0.5rem' }}>
            Pain Map
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Tap each area of pain on your body to describe it. This helps your clinician understand your full pain picture.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

          {/* Body SVG + view toggle */}
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['front','back'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '0.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 500,
                  background: view === v ? 'var(--teal-500)' : 'var(--bg-surface)',
                  color: view === v ? '#000' : 'var(--text-secondary)',
                }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            <svg viewBox="0 0 400 500" style={{ width: '100%', maxWidth: 300 }}>
              {/* Body outline - simplified stick figure */}
              <g stroke="var(--text-secondary)" strokeWidth="2" fill="none" opacity="0.3">
                <circle cx="200" cy="45" r="28" />
                <line x1="200" y1="73" x2="200" y2="240" />
                <line x1="200" y1="100" x2="110" y2="200" />
                <line x1="200" y1="100" x2="290" y2="200" />
                <line x1="110" y1="200" x2="90" y2="270" />
                <line x1="290" y1="200" x2="310" y2="270" />
                <line x1="200" y1="240" x2="160" y2="350" />
                <line x1="200" y1="240" x2="240" y2="350" />
                <line x1="160" y1="350" x2="155" y2="440" />
                <line x1="240" y1="350" x2="245" y2="440" />
              </g>

              {/* Pain region dots */}
              {BODY_REGIONS.filter(r => r.view === view).map(region => {
                const pain = painRegions[region.id];
                const isActive = selectedRegionId === region.id;
                const nprs = pain?.nprs ?? 0;
                return (
                  <g key={region.id} onClick={() => setSelectedRegionId(region.id)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={region.cx} cy={region.cy} r={nprs > 0 ? 16 : 12}
                      fill={nprs > 0 ? nprsColor(nprs) : 'var(--bg-surface)'}
                      stroke={isActive ? 'var(--teal-500)' : 'var(--text-secondary)'}
                      strokeWidth={isActive ? 3 : 1}
                      opacity={0.85}
                    />
                    {nprs > 0 && (
                      <text x={region.cx} y={region.cy + 5} textAnchor="middle"
                        fill="#000" fontSize="11" fontWeight="600">{nprs}</text>
                    )}
                    <title>{region.label}</title>
                  </g>
                );
              })}
            </svg>

            {/* Global NPRS */}
            <div style={{ marginTop: '1.5rem', background: 'var(--bg-surface)', borderRadius: 12, padding: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Worst pain in last 24 hours: <span style={{ color: nprsColor(globalNprs), fontWeight: 600 }}>{globalNprs}/10</span>
              </label>
              <input type="range" min={0} max={10} value={globalNprs}
                onChange={e => setGlobalNprs(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--teal-500)' }} />
            </div>

            {/* Functional limitation */}
            <textarea
              placeholder="What can't you do because of the pain? (e.g. can't climb stairs, can't sleep on left side)"
              value={functionalLimitation}
              onChange={e => setFunctionalLimitation(e.target.value)}
              rows={3}
              style={{
                width: '100%', marginTop: '1rem', background: 'var(--bg-surface)',
                border: '1px solid #2a3448', borderRadius: 8, color: 'var(--text-primary)',
                padding: '0.75rem', fontSize: '0.875rem', resize: 'vertical',
              }}
            />
          </div>

          {/* Region detail panel */}
          <div>
            {selectedRegionId && regionTemplate ? (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '1.25rem' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--teal-500)' }}>
                  {regionTemplate.label}
                </h3>

                {/* NPRS slider */}
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  Pain intensity: <span style={{ color: nprsColor(selectedRegion?.nprs ?? 0), fontWeight: 600 }}>
                    {selectedRegion?.nprs ?? 0}/10
                  </span>
                </label>
                <input type="range" min={0} max={10} value={selectedRegion?.nprs ?? 0}
                  onChange={e => updateRegion('nprs', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--teal-500)', marginBottom: '1rem' }} />

                {/* Pain qualities */}
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Pain quality</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                  {PAIN_QUALITIES.map(q => {
                    const active = selectedRegion?.qualities.includes(q);
                    return (
                      <button key={q} onClick={() => toggleQuality(q)} style={{
                        padding: '0.25rem 0.6rem', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer', border: 'none',
                        background: active ? 'var(--teal-500)' : '#1a2535',
                        color: active ? '#000' : 'var(--text-secondary)',
                      }}>{q}</button>
                    );
                  })}
                </div>

                {/* Behaviours */}
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Behaviour</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                  {PAIN_BEHAVIOURS.map(b => {
                    const active = selectedRegion?.behaviours.includes(b);
                    return (
                      <button key={b} onClick={() => toggleBehaviour(b)} style={{
                        padding: '0.25rem 0.6rem', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer', border: 'none',
                        background: active ? '#4DB8FF33' : '#1a2535',
                        color: active ? 'var(--blue-400)' : 'var(--text-secondary)',
                      }}>{b.replace(/_/g, ' ')}</button>
                    );
                  })}
                </div>

                {/* Onset */}
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  How long (weeks)
                </label>
                <input type="number" min={0} max={520} value={selectedRegion?.onsetWeeks ?? 0}
                  onChange={e => updateRegion('onsetWeeks', Number(e.target.value))}
                  style={{ width: 80, background: '#1a2535', border: '1px solid #2a3448', borderRadius: 6, color: 'var(--text-primary)', padding: '0.4rem', marginBottom: '1rem' }} />

                {/* Radiates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input type="checkbox" id="radiates"
                    checked={selectedRegion?.radiates ?? false}
                    onChange={e => updateRegion('radiates', e.target.checked)} />
                  <label htmlFor="radiates" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Radiates / spreads
                  </label>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-surface)', borderRadius: 12, padding: '2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', minHeight: 200,
              }}>
                Tap a region on the body map to describe your pain there
              </div>
            )}

            {/* Analyse button */}
            <button
              onClick={runAnalysis}
              disabled={isAnalysing || Object.values(painRegions).filter(r => r.nprs > 0).length === 0}
              style={{
                width: '100%', marginTop: '1.5rem', padding: '0.875rem',
                background: 'var(--teal-500)', color: '#000', border: 'none',
                borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                opacity: isAnalysing ? 0.7 : 1,
              }}
            >
              {isAnalysing ? 'Analysing...' : `Analyse Pain Map (${Object.values(painRegions).filter(r => r.nprs > 0).length} region${Object.values(painRegions).filter(r => r.nprs > 0).length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </div>

        {/* Results panel */}
        {result && (
          <div style={{ marginTop: '2rem', background: 'var(--bg-surface)', borderRadius: 16, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <span style={{
                padding: '0.3rem 0.8rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600,
                background: result.riskLevel === 'red_flag' ? '#ef444433' :
                            result.riskLevel === 'high' ? '#f59e0b33' :
                            result.riskLevel === 'moderate' ? '#3b82f633' : '#22c55e33',
                color: result.riskLevel === 'red_flag' ? '#ef4444' :
                       result.riskLevel === 'high' ? '#f59e0b' :
                       result.riskLevel === 'moderate' ? '#60a5fa' : '#22c55e',
              }}>
                {result.riskLevel.replace('_', ' ').toUpperCase()}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Pain trend: <strong style={{ color: 'var(--text-primary)' }}>{result.painTrend.replace(/_/g, ' ')}</strong>
              </span>
            </div>

            {result.redFlags.length > 0 && (
              <div style={{ background: '#ef444415', border: '1px solid #ef444440', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem' }}>Red Flags</p>
                {result.redFlags.map((f, i) => <p key={i} style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{f}</p>)}
              </div>
            )}

            <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '1rem', fontSize: '0.9rem' }}>{result.clinicalSummary}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Differential hypotheses</p>
                {result.differentialHypotheses.map((h, i) => (
                  <p key={i} style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>{h}</p>
                ))}
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Safe to exercise: <span style={{ color: result.safeToExercise ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {result.safeToExercise ? 'Yes' : 'No — see clinician first'}
                  </span>
                </p>
                {result.exerciseModifications.map((m, i) => (
                  <p key={i} style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>{m}</p>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1rem', background: '#1a2535', borderRadius: 8, padding: '0.75rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Clinician note</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--blue-400)' }}>{result.clinicianNotes}</p>
            </div>

            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
              ICD-10: {result.icd10Codes.join(', ')} · {result.citation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

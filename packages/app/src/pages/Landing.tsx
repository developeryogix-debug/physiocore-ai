import { useNavigate } from 'react-router-dom';

const GAP_BADGES = [
  { icon: '🧠', label: 'Explainable AI', desc: 'Every recommendation cites its reasoning' },
  { icon: '📋', label: 'FHIR R4 Export', desc: 'Clinician-ready structured health records' },
  { icon: '🔄', label: 'Retention Engine', desc: 'Churn prediction + personalized re-engagement' },
  { icon: '👁', label: 'Multi-view Pose', desc: 'Front, side-left, side-right landmark detection' },
  { icon: '🩺', label: 'Clinician Mode', desc: 'SOAP notes, CPT codes, patient timeline' },
  { icon: '🥗', label: 'Evidence Nutrition', desc: 'Grade A–D supplement protocol with citations' },
  { icon: '🧘', label: 'Yoga + Rehab', desc: 'Hold timer, Sanskrit cues, pose-specific scoring' },
];

const COMPARISON = [
  { feature: 'AI Pose Detection', physio: true,  hinge: true,  kaia: false, physitrack: false },
  { feature: 'Explainable AI reasoning', physio: true,  hinge: false, kaia: false, physitrack: false },
  { feature: 'FHIR R4 EHR Export', physio: true,  hinge: false, kaia: false, physitrack: true  },
  { feature: 'Side-view rep counting', physio: true,  hinge: false, kaia: false, physitrack: false },
  { feature: 'Clinician SOAP notes + CPT', physio: true,  hinge: false, kaia: false, physitrack: true  },
  { feature: 'Retention / churn engine', physio: true,  hinge: false, kaia: true,  physitrack: false },
  { feature: 'Evidence supplement protocol', physio: true,  hinge: false, kaia: false, physitrack: false },
  { feature: 'Yoga mode with Sanskrit cues', physio: true,  hinge: false, kaia: true,  physitrack: false },
  { feature: 'Open source + self-hostable', physio: true,  hinge: false, kaia: false, physitrack: false },
];

const TECH_FACTS = [
  { stat: 'MediaPipe', label: 'Pose estimation framework (Google)', cite: 'Lugaresi et al., 2019' },
  { stat: 'Mifflin-St Jeor', label: 'TDEE equation used', cite: 'Mifflin MD et al., 1990, JADA' },
  { stat: 'FHIR R4', label: 'HL7 interoperability standard', cite: 'HL7 International, 2019' },
  { stat: '1.6–2.2g/kg', label: 'Evidence-based protein targets', cite: 'Stokes T et al., 2018, Nutrients' },
  { stat: 'Claude Sonnet', label: 'AI reasoning model with web search', cite: 'Anthropic, 2025' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b', overflowX: 'hidden' }}>

      {/* Nav bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: 60, background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 100 }}>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#6366f1', letterSpacing: '-0.02em' }}>PhysioCore AI</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Built for clinicians & patients</span>
          <button onClick={() => { navigate('/onboard'); }} style={{ padding: '8px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            Start Free
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', padding: '80px 32px 96px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', borderRadius: 99, padding: '5px 16px', fontSize: '0.75rem', fontWeight: 600, color: '#c7d2fe', marginBottom: 24, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
          AI-Powered Physiotherapy Platform
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.03em', maxWidth: 780, margin: '0 auto 20px' }}>
          AI Physiotherapy that{' '}
          <span style={{ background: 'linear-gradient(90deg, #a5b4fc, #f9a8d4)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            explains its reasoning
          </span>
        </h1>
        <p style={{ fontSize: '1.15rem', color: '#c7d2fe', maxWidth: 600, margin: '0 auto 36px', lineHeight: 1.7 }}>
          Real-time pose analysis, injury-aware AI feedback, FHIR R4 export, and a retention engine — all grounded in peer-reviewed research.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
          <button onClick={() => { navigate('/onboard'); }} style={{ padding: '14px 32px', borderRadius: 10, background: '#fff', color: '#4338ca', border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
            Start Free Assessment →
          </button>
          <button onClick={() => { navigate('/onboard'); }} style={{ padding: '14px 32px', borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
            View Demo
          </button>
        </div>
        <p style={{ color: '#6366f1', fontSize: '0.78rem', marginTop: 20 }}>No credit card · No account required · Runs in-browser</p>
      </div>

      {/* Gap badges */}
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '32px 32px' }}>
        <div style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 20 }}>
          7 capabilities missing from other physio apps
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
          {GAP_BADGES.map(b => (
            <div key={b.label} title={b.desc} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 99, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'default' }}>
              <span>{b.icon}</span> {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 10, letterSpacing: '-0.02em' }}>From camera to clinical record in minutes</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 560, margin: '0 auto' }}>No wearables. No subscriptions. Just open your browser.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          {[
            { step: '1', icon: '📋', title: '5-min onboarding', desc: 'Body map, conditions, goals, fitness level, biometrics' },
            { step: '2', icon: '📸', title: 'Camera-based tracking', desc: 'MediaPipe detects 33 landmarks — front and side view' },
            { step: '3', icon: '🤖', title: 'AI form scoring', desc: 'Injury-aware feedback, rep-by-rep breakdown, session report' },
            { step: '4', icon: '🩺', title: 'Clinician handoff', desc: 'SOAP note, CPT codes, FHIR R4 bundle — one click' },
          ].map(s => (
            <div key={s.step} style={{ background: '#f8fafc', borderRadius: 16, padding: '24px 20px', textAlign: 'center' as const }}>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ background: '#f8fafc', padding: '64px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 8, textAlign: 'center' as const, letterSpacing: '-0.02em' }}>How we compare</h2>
          <p style={{ color: '#64748b', textAlign: 'center' as const, marginBottom: 36, fontSize: '0.9rem' }}>vs. Hinge Health, Kaia Health, and Physitrack</p>
          <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid #e2e8f0', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 18px', textAlign: 'left' as const, fontWeight: 700, color: '#475569', width: '36%' }}>Capability</th>
                  {[
                    { name: 'PhysioCore AI', color: '#4338ca', bg: '#eef2ff' },
                    { name: 'Hinge Health', color: '#64748b', bg: '#f8fafc' },
                    { name: 'Kaia Health', color: '#64748b', bg: '#f8fafc' },
                    { name: 'Physitrack', color: '#64748b', bg: '#f8fafc' },
                  ].map(c => (
                    <th key={c.name} style={{ padding: '14px 12px', textAlign: 'center' as const, fontWeight: 700, color: c.color, background: c.bg }}>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} style={{ borderBottom: i < COMPARISON.length - 1 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '11px 18px', color: '#334155' }}>{row.feature}</td>
                    {[row.physio, row.hinge, row.kaia, row.physitrack].map((v, j) => (
                      <td key={j} style={{ padding: '11px 12px', textAlign: 'center' as const, fontSize: '1.1rem' }}>
                        <span style={{ color: v ? '#22c55e' : '#cbd5e1' }}>{v ? '✓' : '–'}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ textAlign: 'center' as const, color: '#94a3b8', fontSize: '0.72rem', marginTop: 12 }}>
            Competitor capabilities based on public documentation and app store descriptions as of 2025.
          </p>
        </div>
      </div>

      {/* Tech credibility */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 32px' }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>Built on peer-reviewed research</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Every algorithm and recommendation traces back to published evidence</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          {TECH_FACTS.map(f => (
            <div key={f.stat} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 16px', textAlign: 'center' as const }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4338ca', marginBottom: 4 }}>{f.stat}</div>
              <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 6, lineHeight: 1.4 }}>{f.label}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>{f.cite}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)', padding: '64px 32px', textAlign: 'center' as const }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: 16, letterSpacing: '-0.02em' }}>
          Start your assessment now — free, in 5 minutes
        </h2>
        <p style={{ color: '#c7d2fe', marginBottom: 32, fontSize: '1rem' }}>
          No wearable required. Works on any laptop or desktop with a webcam.
        </p>
        <button onClick={() => { navigate('/onboard'); }} style={{ padding: '16px 40px', borderRadius: 12, background: '#fff', color: '#4338ca', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
          Start Free Assessment →
        </button>
      </div>

      {/* Footer */}
      <div style={{ background: '#0f172a', padding: '24px 32px', textAlign: 'center' as const }}>
        <p style={{ color: '#475569', fontSize: '0.78rem' }}>
          PhysioCore AI · Built with MediaPipe, Claude API, and FHIR R4 · All data stays on your device
        </p>
      </div>
    </div>
  );
}

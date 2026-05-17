import { useNavigate } from 'react-router-dom';

const GAP_BADGES = [
  { icon: '⬡', label: 'Explainable AI',     desc: 'Every recommendation cites its clinical reasoning' },
  { icon: '⬡', label: 'FHIR R4 Export',     desc: 'Clinician-ready structured health records' },
  { icon: '⬡', label: 'Retention Engine',   desc: 'Churn prediction + personalized re-engagement' },
  { icon: '⬡', label: 'Multi-view Pose',    desc: 'Front, side-left, side-right landmark detection' },
  { icon: '⬡', label: 'Clinician Mode',     desc: 'SOAP notes, CPT codes, patient timeline' },
  { icon: '⬡', label: 'Evidence Nutrition', desc: 'Grade A–D supplement protocol with citations' },
  { icon: '⬡', label: 'Yoga + Rehab',       desc: 'Hold timer, Sanskrit cues, pose-specific scoring' },
];

const COMPARISON = [
  { feature: 'AI Pose Detection',            physio: true,  hinge: true,  kaia: false, physitrack: false },
  { feature: 'Explainable AI reasoning',     physio: true,  hinge: false, kaia: false, physitrack: false },
  { feature: 'FHIR R4 EHR Export',           physio: true,  hinge: false, kaia: false, physitrack: true  },
  { feature: 'Side-view rep counting',       physio: true,  hinge: false, kaia: false, physitrack: false },
  { feature: 'Clinician SOAP notes + CPT',   physio: true,  hinge: false, kaia: false, physitrack: true  },
  { feature: 'Retention / churn engine',     physio: true,  hinge: false, kaia: true,  physitrack: false },
  { feature: 'Evidence supplement protocol', physio: true,  hinge: false, kaia: false, physitrack: false },
  { feature: 'Yoga mode with Sanskrit cues', physio: true,  hinge: false, kaia: true,  physitrack: false },
  { feature: 'Open source + self-hostable',  physio: true,  hinge: false, kaia: false, physitrack: false },
];

const TECH_FACTS = [
  { stat: 'MediaPipe',       label: 'Pose estimation (33 landmarks)', cite: 'Lugaresi et al., 2019' },
  { stat: 'Mifflin-St Jeor', label: 'TDEE energy equation',           cite: 'Mifflin MD et al., 1990' },
  { stat: 'FHIR R4',         label: 'HL7 interoperability standard',  cite: 'HL7 International, 2019' },
  { stat: '1.6–2.2 g/kg',   label: 'Evidence protein targets',       cite: 'Stokes T et al., 2018' },
  { stat: 'Clinical AI',     label: 'Advanced reasoning + web search', cite: 'Anthropic, 2025' },
];

const STEPS = [
  { n: '01', title: '5-min onboarding',        desc: 'Body map, conditions, goals, fitness level, biometrics' },
  { n: '02', title: 'Camera-based tracking',   desc: 'MediaPipe detects 33 landmarks — front and side view' },
  { n: '03', title: 'AI form scoring',         desc: 'Injury-aware feedback, rep-by-rep breakdown, session report' },
  { n: '04', title: 'Clinician handoff',       desc: 'SOAP note, CPT codes, FHIR R4 bundle — one click' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{
      fontFamily: "'Figtree', system-ui, sans-serif",
      color: 'var(--text-primary)',
      background: 'var(--bg-void)',
      overflowX: 'hidden',
      paddingTop: '6rem',
    }}>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="hero-grid" style={{
        position: 'relative',
        padding: '100px 32px 120px',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,212,170,0.08) 0%, transparent 70%)',
        }} />

        {/* Badge */}
        <div className="animate-in" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--teal-dim)',
          border: '1px solid var(--border-teal)',
          borderRadius: 99,
          padding: '6px 18px',
          fontSize: '0.72rem',
          fontWeight: 600,
          color: 'var(--teal-500)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          marginBottom: 32,
        }}>
          <span className="live-dot" />
          AI-Powered Physiotherapy Platform
        </div>

        {/* Headline */}
        <h1 className="animate-in font-display" style={{
          fontSize: 'var(--text-hero)',
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          maxWidth: 840,
          margin: '0 auto 24px',
          color: 'var(--text-primary)',
        }}>
          AI Physio that{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--teal-400) 0%, var(--blue-400) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'inline',
            paddingBottom: '0.1em',
          }}>
            explains its reasoning
          </span>
        </h1>

        <p className="animate-in" style={{
          fontSize: '1.1rem',
          color: 'var(--text-secondary)',
          maxWidth: 560,
          margin: '0 auto 40px',
          lineHeight: 1.7,
        }}>
          Real-time pose analysis, injury-aware AI feedback, FHIR R4 export, and a retention engine — all grounded in peer-reviewed research.
        </p>

        <div className="animate-in" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
          <button
            className="btn-primary"
            onClick={() => { navigate('/onboard'); }}
            style={{ fontSize: '0.95rem', padding: '12px 28px' }}
          >
            Start Free Assessment →
          </button>
          <button
            className="btn-ghost"
            onClick={() => { navigate('/onboard'); }}
          >
            View Demo
          </button>
        </div>

        <p className="animate-in" style={{
          color: 'var(--text-tertiary)',
          fontSize: '0.75rem',
          marginTop: 18,
          fontFamily: "'Space Mono', monospace",
        }}>
          NO CREDIT CARD · NO ACCOUNT · RUNS IN-BROWSER
        </p>
      </div>

      {/* ── Live Stats ─────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '20px 32px',
        background: 'rgba(0,212,170,0.02)',
        display: 'flex',
        justifyContent: 'center',
        gap: 48,
        flexWrap: 'wrap' as const,
      }}>
        {[
          { val: '33', label: 'Pose landmarks tracked', unit: '' },
          { val: '298', label: 'Competitors analyzed', unit: '+' },
          { val: '0', label: 'Data leaves your device', unit: 'KB' },
          { val: 'FHIR R4', label: 'EHR standard compliant', unit: '' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' as const }}>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '1.4rem',
              fontWeight: 700,
              color: 'var(--teal-400)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              marginBottom: 4,
            }}>
              {s.val}{s.unit && <span style={{ fontSize: '0.9rem', color: 'var(--teal-600)' }}>{s.unit}</span>}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.05em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── 7 Gaps strip ──────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '28px 32px',
        background: 'var(--bg-surface)',
      }}>
        <p style={{
          textAlign: 'center',
          fontSize: '0.7rem',
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          marginBottom: 18,
          fontFamily: "'Space Mono', monospace",
        }}>
          7 capabilities missing from every competitor
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' as const }}>
          {GAP_BADGES.map(b => (
            <div
              key={b.label}
              title={b.desc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 99,
                padding: '7px 16px',
                fontSize: '0.78rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                cursor: 'default',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-teal)';
                (e.currentTarget as HTMLDivElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)';
                (e.currentTarget as HTMLDivElement).style.color = 'var(--text-secondary)';
              }}
            >
              <span style={{ color: 'var(--teal-500)', fontSize: '0.6rem' }}>✦</span>
              {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--teal-500)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            marginBottom: 12,
            fontFamily: "'Space Mono', monospace",
          }}>
            HOW IT WORKS
          </p>
          <h2 className="font-display" style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            marginBottom: 12,
          }}>
            From camera to clinical record in minutes
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 520, margin: '0 auto' }}>
            No wearables. No subscriptions. Just open your browser.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="card animate-in"
              style={{ animationDelay: `${0.05 + i * 0.08}s` }}
            >
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.68rem',
                color: 'var(--teal-500)',
                letterSpacing: '0.1em',
                marginBottom: 16,
              }}>
                {s.n}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>{s.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature Showcase ──────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-void)',
        padding: '80px 32px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' as const, marginBottom: 56 }}>
            <p style={{
              fontSize: '0.7rem', fontWeight: 600, color: 'var(--teal-500)',
              letterSpacing: '0.12em', textTransform: 'uppercase' as const,
              marginBottom: 12, fontFamily: "'Space Mono', monospace",
            }}>PLATFORM CAPABILITIES</p>
            <h2 className="font-display" style={{
              fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.02em',
              color: 'var(--text-primary)', marginBottom: 12,
            }}>Every feature a clinician needs</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 480, margin: '0 auto' }}>
              Designed to bridge AI-powered exercise guidance with clinical accountability standards.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              {
                icon: '⬡',
                title: 'Real-time pose analysis',
                desc: 'MediaPipe detects 33 anatomical landmarks at 30fps. Front and side views with automatic landmark fallback when one view fails.',
                tag: 'Lugaresi et al., 2019',
                color: 'var(--teal-500)',
              },
              {
                icon: '⬡',
                title: 'Explainable AI feedback',
                desc: 'Every form score comes with annotated reasoning — not a black box. Clinicians can audit AI decisions before acting on them.',
                tag: 'Grade A evidence',
                color: 'var(--blue-400)',
              },
              {
                icon: '⬡',
                title: 'FHIR R4 clinical export',
                desc: 'One-click export of SOAP notes, CPT codes, and a valid FHIR R4 Bundle ready for any EHR system.',
                tag: 'HL7 R4 compliant',
                color: 'var(--teal-500)',
              },
              {
                icon: '⬡',
                title: 'Injury-aware exercise gating',
                desc: 'Cross-references your active conditions against exercise contraindications. Dangerous combinations are blocked automatically.',
                tag: 'Safety-first design',
                color: 'var(--amber-400)',
              },
              {
                icon: '⬡',
                title: 'Evidence-based nutrition',
                desc: 'TDEE via Mifflin-St Jeor equation. Protein targets at 1.6–2.2 g/kg. Every supplement recommendation carries a Grade A–D badge.',
                tag: 'Stokes T et al., 2018',
                color: 'var(--blue-400)',
              },
              {
                icon: '⬡',
                title: 'Retention engine',
                desc: 'Churn prediction model tracks adherence. Personalized re-engagement nudges fire at optimal intervals using Tiny Habits principles.',
                tag: 'Fogg, 2019',
                color: 'var(--teal-500)',
              },
            ].map(f => (
              <div key={f.title} className="card" style={{
                border: '1px solid var(--border-subtle)',
                transition: 'border-color 0.15s, transform 0.15s',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-teal)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <span style={{ color: f.color, fontSize: '1.1rem' }}>{f.icon}</span>
                  <span style={{
                    fontSize: '0.6rem', color: f.color, fontFamily: "'Space Mono', monospace",
                    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                    background: f.color === 'var(--amber-400)' ? 'var(--amber-dim)' : f.color === 'var(--blue-400)' ? 'var(--blue-dim)' : 'var(--teal-dim)',
                    padding: '3px 8px', borderRadius: 99,
                  }}>{f.tag}</span>
                </div>
                <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 8, color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Comparison table ──────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', padding: '80px 32px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--teal-500)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              marginBottom: 12,
              fontFamily: "'Space Mono', monospace",
            }}>
              COMPETITIVE ANALYSIS
            </p>
            <h2 className="font-display" style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}>
              How we compare
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              vs. Hinge Health, Kaia Health, and Physitrack
            </p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--border-default)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left' as const, fontWeight: 600, color: 'var(--text-secondary)', width: '38%', fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                    CAPABILITY
                  </th>
                  {[
                    { name: 'PhysioCore AI', teal: true },
                    { name: 'Hinge Health', teal: false },
                    { name: 'Kaia Health',  teal: false },
                    { name: 'Physitrack',   teal: false },
                  ].map(c => (
                    <th
                      key={c.name}
                      style={{
                        padding: '14px 12px',
                        textAlign: 'center' as const,
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        color: c.teal ? 'var(--teal-500)' : 'var(--text-tertiary)',
                        fontFamily: c.teal ? "'Syne', sans-serif" : "'Figtree', sans-serif",
                        letterSpacing: c.teal ? '-0.01em' : 'normal',
                      }}
                    >
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{
                      borderBottom: i < COMPARISON.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--teal-dim)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '11px 20px', color: 'var(--text-secondary)' }}>{row.feature}</td>
                    {[row.physio, row.hinge, row.kaia, row.physitrack].map((v, j) => (
                      <td key={j} style={{ padding: '11px 12px', textAlign: 'center' as const }}>
                        <span style={{
                          fontFamily: "'Space Mono', monospace",
                          fontSize: '0.85rem',
                          color: v ? 'var(--success)' : 'var(--text-tertiary)',
                          fontWeight: v ? 600 : 400,
                        }}>
                          {v ? '✓' : '–'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{
            textAlign: 'center' as const,
            color: 'var(--text-tertiary)',
            fontSize: '0.68rem',
            marginTop: 12,
            fontFamily: "'Space Mono', monospace",
          }}>
            Competitor capabilities based on public documentation as of 2025
          </p>
        </div>
      </div>

      {/* ── Tech credibility ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 40 }}>
          <p style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--teal-500)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            marginBottom: 12,
            fontFamily: "'Space Mono', monospace",
          }}>
            RESEARCH FOUNDATION
          </p>
          <h2 className="font-display" style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: 8,
          }}>
            Built on peer-reviewed research
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Every algorithm traces back to published evidence
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          {TECH_FACTS.map(f => (
            <div key={f.stat} className="card" style={{ textAlign: 'center' as const }}>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--teal-500)',
                marginBottom: 6,
              }}>
                {f.stat}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.4 }}>
                {f.label}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontStyle: 'italic', fontFamily: "'Space Mono', monospace" }}>
                {f.cite}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '100px 32px',
        textAlign: 'center' as const,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(0,212,170,0.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 40% 30% at 30% 20%, rgba(77,184,255,0.04) 0%, transparent 60%)',
        }} />
        <p style={{
          fontSize: '0.7rem', fontWeight: 600, color: 'var(--teal-500)',
          letterSpacing: '0.12em', textTransform: 'uppercase' as const,
          marginBottom: 16, fontFamily: "'Space Mono', monospace",
        }}>
          GET STARTED FREE
        </p>
        <h2 className="font-display" style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          marginBottom: 16,
          color: 'var(--text-primary)',
          maxWidth: 640,
          margin: '0 auto 16px',
        }}>
          Your camera is all the equipment you need
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 440, margin: '0 auto 16px', lineHeight: 1.7 }}>
          No wearable. No subscription. No app download. Full clinical-grade AI physio in your browser in 5 minutes.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 36, flexWrap: 'wrap' as const }}>
          {['✓ Free forever', '✓ No account needed', '✓ Data never leaves device'].map(t => (
            <span key={t} style={{
              fontSize: '0.75rem', color: 'var(--text-tertiary)',
              fontFamily: "'Space Mono', monospace",
            }}>{t}</span>
          ))}
        </div>
        <button
          className="btn-primary"
          onClick={() => { navigate('/onboard'); }}
          style={{ fontSize: '1.05rem', padding: '15px 42px' }}
        >
          Start Free Assessment →
        </button>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '20px 32px',
        textAlign: 'center' as const,
        background: 'var(--bg-void)',
      }}>
        <p style={{
          color: 'var(--text-tertiary)',
          fontSize: '0.7rem',
          fontFamily: "'Space Mono', monospace",
          letterSpacing: '0.04em',
        }}>
          PhysioCore AI · Built with MediaPipe, Claude API, and FHIR R4 · All data stays on your device
        </p>
      </div>
    </div>
  );
}

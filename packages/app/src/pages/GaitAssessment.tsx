/**
 * GaitAssessment.tsx — stub page (GaitAgent built, UI coming in Phase 3)
 */
export default function GaitAssessment() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/><path d="m7 20 3-6 2 2 2-4 3 8"/><path d="m6 12 1-5 3 2 2-3"/>
          </svg>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Coming in Phase 3
        </div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Gait Assessment
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9rem' }}>
          Live gait analysis using MediaPipe — step symmetry, cadence, trunk sway, arm swing, and Trendelenburg pattern detection. Evidence grade B (Krebs et al. 1985).
        </p>
      </div>
    </div>
  );
}

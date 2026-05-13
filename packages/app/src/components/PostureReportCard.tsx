/**
 * PostureReportCard.tsx
 * Renders the AI posture report below the 4-view capture grid.
 * Clinical Noir theme — teal accent, dark surface cards.
 */
import type { PostureReport } from '../lib/agents/postureClient.js';

const SEVERITY_COLOR: Record<string, string> = {
  normal:   '#00E676',
  mild:     '#FFB830',
  moderate: '#FF8C00',
  severe:   '#FF4444',
};

const GRADE_COLOR: Record<string, string> = {
  A: '#00D4AA', B: '#4DB8FF', C: '#FFB830', D: '#888',
};

function ScoreArc({ score, label }: { score: number; label: string }) {
  const r = 26, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? '#00E676' : score >= 45 ? '#FFB830' : '#FF4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={64} height={64} viewBox="0 0 64 64">
        <circle cx={32} cy={32} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
        <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x={32} y={37} textAnchor="middle"
          style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 700, fill: color }}>
          {score}
        </text>
      </svg>
      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.65rem', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{label}</span>
    </div>
  );
}

interface Props {
  report: PostureReport;
  savedToDb: boolean;
}

export default function PostureReportCard({ report, savedToDb }: Props) {
  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>AI Posture Analysis</p>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Clinical Report</h2>
        </div>
        {savedToDb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: '20px', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)' }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: '#00D4AA' }}>Saved to health record</span>
          </div>
        )}
      </div>

      {/* Scores */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem 1.5rem', flexWrap: 'wrap' }}>
        <ScoreArc score={report.overallScore} label="Overall" />
        <ScoreArc score={report.frontalScore} label="Frontal" />
        <ScoreArc score={report.sagittalScore} label="Sagittal" />
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
            {report.clinicalSummary}
          </p>
        </div>
      </div>

      {/* Referral flags */}
      {report.referralFlags.length > 0 && (
        <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.72rem', color: '#FF4444', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Referral Flags</span>
          </div>
          {report.referralFlags.map((flag, i) => (
            <p key={i} style={{ color: '#FF6B6B', fontSize: '0.845rem', margin: '3px 0' }}>⚠  {flag}</p>
          ))}
        </div>
      )}

      {/* Findings */}
      {report.findings.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.75rem', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '0.75rem' }}>Clinical Findings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.findings.map((f, i) => {
              const col = SEVERITY_COLOR[f.severity] ?? '#888';
              const gc  = GRADE_COLOR[f.evidenceGrade] ?? '#888';
              return (
                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.875rem 1rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 72, textAlign: 'center' as const }}>
                    <div style={{ padding: '3px 8px', borderRadius: '4px', background: `${col}18`, border: `1px solid ${col}40`, color: col, fontSize: '0.65rem', fontFamily: "'Space Mono',monospace", fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                      {f.severity}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: gc, fontFamily: "'Space Mono',monospace" }}>Grade {f.evidenceGrade}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{f.name}</span>
                      <span style={{ color: col, fontSize: '0.78rem', fontFamily: "'Space Mono',monospace" }}>{f.measurement}</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', margin: 0, lineHeight: 1.5 }}>{f.clinicalSignificance}</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', margin: '4px 0 0', fontStyle: 'italic' }}>{f.citation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Muscle imbalance */}
      {report.muscleImbalancePattern && (
        <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.72rem', color: 'var(--teal-500)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Muscle Imbalance Pattern</p>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: 8 }}>{report.muscleImbalancePattern.name}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: "'Space Mono',monospace" }}>SHORTENED / OVERACTIVE</p>
              {report.muscleImbalancePattern.shortenedMuscles.map(m => (
                <div key={m} style={{ fontSize: '0.8rem', color: '#FF8C00', marginBottom: 2 }}>↑ {m}</div>
              ))}
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: "'Space Mono',monospace" }}>LENGTHENED / INHIBITED</p>
              {report.muscleImbalancePattern.lengthenedMuscles.map(m => (
                <div key={m} style={{ fontSize: '0.8rem', color: '#4DB8FF', marginBottom: 2 }}>↓ {m}</div>
              ))}
            </div>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', marginTop: 8, fontStyle: 'italic' }}>{report.muscleImbalancePattern.citation}</p>
        </div>
      )}

      {/* Correction exercises */}
      {report.correctionExercises.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.75rem', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '0.75rem' }}>Correction Programme</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.correctionExercises.map((ex, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.875rem 1rem' }}>
                <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal-500)', fontSize: '0.72rem', fontFamily: "'Space Mono',monospace", fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{ex.name}</span>
                    <span style={{ color: 'var(--teal-500)', fontFamily: "'Space Mono',monospace", fontSize: '0.72rem' }}>{ex.sets}</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{ex.focus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Home care */}
      {(report.homeCare.stretches.length > 0 || report.homeCare.strengthening.length > 0) && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <h3 style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.75rem', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '0.75rem' }}>Home Self-Care</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {report.homeCare.stretches.length > 0 && (
              <div>
                <p style={{ fontSize: '0.72rem', color: '#FFB830', fontFamily: "'Space Mono',monospace", marginBottom: 6 }}>STRETCHES</p>
                {report.homeCare.stretches.map((s, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.825rem', margin: '0 0 2px' }}>{s.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>{s.instructions}</p>
                  </div>
                ))}
              </div>
            )}
            {report.homeCare.strengthening.length > 0 && (
              <div>
                <p style={{ fontSize: '0.72rem', color: '#4DB8FF', fontFamily: "'Space Mono',monospace", marginBottom: 6 }}>STRENGTHENING</p>
                {report.homeCare.strengthening.map((s, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.825rem', margin: '0 0 2px' }}>{s.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>{s.instructions}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

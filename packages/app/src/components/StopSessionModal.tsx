// StopSessionModal.tsx — Stop + partial session save confirmation
// Phase 2.5 Feature 2. Constitutional: Clinical Noir, font-weight ≤600, no "use client".
// Three paths: Continue · Save Partial (keeps reps, skips AI) · Discard.

interface StopSessionModalProps {
  repCount: number;
  durationSec: number;
  exercise: string;
  timePreset: '15' | '30' | 'full';
  onContinue: () => void;
  onSavePartial: () => void;
  onDiscard: () => void;
}

export function StopSessionModal({
  repCount,
  durationSec,
  exercise,
  timePreset,
  onContinue,
  onSavePartial,
  onDiscard,
}: StopSessionModalProps) {
  const durMin = Math.floor(durationSec / 60);
  const durSec = Math.floor(durationSec % 60);
  const hasReps = repCount > 0;
  const exerciseLabel = exercise.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const isTimerExpired = timePreset !== 'full' && durationSec >= Number(timePreset) * 60;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(5,8,16,0.90)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 20,
        padding: '28px 24px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: '0.65rem',
          letterSpacing: '0.12em',
          color: isTimerExpired ? '#f97316' : 'var(--teal-500)',
          marginBottom: 8,
          textTransform: 'uppercase' as const,
        }}>
          {isTimerExpired ? '⏱ Time preset reached' : 'Stop Session'}
        </p>
        <h2 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: '1.3rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 6,
        }}>
          {isTimerExpired ? `${timePreset}-minute session complete` : `End ${exerciseLabel}?`}
        </h2>
        <p style={{
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          marginBottom: 20,
          lineHeight: 1.5,
        }}>
          {hasReps
            ? 'Save your reps now or keep going.'
            : 'No reps logged yet — continue or discard.'}
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          <div style={{
            flex: 1, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: '12px 8px',
          }}>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '1.8rem', fontWeight: 600,
              color: 'var(--teal-500)', lineHeight: 1,
            }}>
              {repCount}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 5 }}>
              reps logged
            </div>
          </div>
          <div style={{
            flex: 1, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: '12px 8px',
          }}>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '1.8rem', fontWeight: 600,
              color: 'var(--blue-400)', lineHeight: 1,
            }}>
              {durMin > 0 ? `${durMin}m` : `${durSec}s`}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 5 }}>
              elapsed
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Continue — only if timer not expired */}
          {!isTimerExpired && (
            <button
              onClick={onContinue}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              ▶ Continue session
            </button>
          )}

          {/* Save partial */}
          <button
            onClick={onSavePartial}
            disabled={!hasReps}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '10px',
              border: `1px solid ${hasReps ? 'var(--border-teal)' : 'var(--border-subtle)'}`,
              background: hasReps ? 'rgba(0,212,170,0.09)' : 'rgba(255,255,255,0.02)',
              color: hasReps ? 'var(--teal-500)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: hasReps ? 'pointer' : 'not-allowed',
              opacity: hasReps ? 1 : 0.45,
              transition: 'all 0.15s',
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            💾 Save {isTimerExpired ? 'session' : 'partial'} ({repCount} rep{repCount !== 1 ? 's' : ''})
          </button>

          {/* Discard */}
          <button
            onClick={onDiscard}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '10px',
              border: '1px solid rgba(255,68,68,0.2)',
              background: 'transparent',
              color: 'rgba(255,100,100,0.75)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            🗑 Discard session
          </button>
        </div>

        <p style={{
          marginTop: 14,
          fontSize: '0.62rem',
          color: 'rgba(255,255,255,0.2)',
          fontFamily: "'Space Mono', monospace",
          textAlign: 'center' as const,
          lineHeight: 1.6,
        }}>
          Partial saves skip AI feedback analysis. PDPA: data linked to your account only.
        </p>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { AiChatPanel } from '../components/AiChatPanel.js';

interface StoredSession {
  id: string;
  exercise: string;
  date: string;
  reps: number;
  formScore: number;
  durationMin: number;
}

function loadSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem('physiocore_sessions');
    return raw ? (JSON.parse(raw) as StoredSession[]) : [];
  } catch {
    return [];
  }
}

function calcStreak(sessions: StoredSession[]): number {
  if (sessions.length === 0) return 0;
  const daySet = new Set(sessions.map(s => s.date.slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (daySet.has(d.toISOString().slice(0, 10))) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function calcAdherence(sessions: StoredSession[]): number | null {
  if (sessions.length === 0) return null;
  const oldest = sessions.reduce((a, b) => a.date < b.date ? a : b);
  const daysSinceStart = Math.max(1, Math.floor((Date.now() - new Date(oldest.date).getTime()) / 86400000));
  const weeksActive = Math.ceil(daysSinceStart / 7);
  const expectedSessions = weeksActive * 3;
  return Math.min(100, Math.round((sessions.length / expectedSessions) * 100));
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 65) return 'var(--warning)';
  return 'var(--danger)';
}

export default function Dashboard() {
  const { userProfile, clearProfile } = useUserProfile();
  const navigate = useNavigate();

  const sessions = useMemo(() => loadSessions(), []);

  if (!userProfile) return null;

  const streak = calcStreak(sessions);
  const adherence = calcAdherence(sessions);
  const activeConditions = userProfile.conditions.filter(c => c.isActive).length;
  const activeInjuries = userProfile.injuries.filter(i => i.isActive).length;
  const activeProblems = activeConditions + activeInjuries;
  const recentSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const planLabel = userProfile.subscription ?? 'free';
  const firstName = userProfile.name.split(' ')[0] ?? userProfile.name;
  const isNewUser = sessions.length === 0;

  const avgFormScore = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + s.formScore, 0) / sessions.length)
    : null;

  const METRICS = [
    {
      value: streak.toString(),
      label: 'Day Streak',
      sub: streak === 0 ? 'Start today' : streak === 1 ? '1 day in' : `${streak} days`,
      color: streak > 0 ? 'var(--teal-500)' : 'var(--text-secondary)',
    },
    {
      value: sessions.length.toString(),
      label: 'Sessions',
      sub: isNewUser ? 'No sessions yet' : 'Completed',
      color: 'var(--text-primary)',
    },
    {
      value: adherence !== null ? `${adherence}%` : '—',
      label: 'Adherence',
      sub: adherence !== null ? (adherence >= 80 ? 'Excellent' : adherence >= 60 ? 'Good' : 'Needs work') : 'No data yet',
      color: adherence !== null ? (adherence >= 80 ? 'var(--success)' : adherence >= 60 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-secondary)',
    },
    {
      value: avgFormScore !== null ? `${avgFormScore}` : '—',
      label: 'Avg Form Score',
      sub: avgFormScore !== null ? (avgFormScore >= 80 ? 'Strong form' : avgFormScore >= 65 ? 'Good form' : 'Room to improve') : 'No data yet',
      color: avgFormScore !== null ? scoreColor(avgFormScore) : 'var(--text-secondary)',
    },
  ];

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
      padding: '100px 24px 48px',
    }}>

      {/* Header */}
      <div className="animate-in" style={{ marginBottom: 40 }}>
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: '0.68rem',
          color: 'var(--teal-500)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          marginBottom: 6,
        }}>
          {isNewUser ? 'Welcome' : 'Welcome back'}
        </p>
        <h1 className="font-display" style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginBottom: 6,
        }}>
          {firstName}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Goal: <span style={{ color: 'var(--text-primary)' }}>{userProfile.primaryGoal.replace(/_/g, ' ')}</span>
          {' '}·{' '}Level: <span style={{ color: 'var(--text-primary)' }}>{userProfile.fitnessLevel}</span>
          {' '}·{' '}Plan: <span style={{ color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace", fontSize: '0.78rem' }}>{planLabel.toUpperCase()}</span>
        </p>
      </div>

      {/* Metric cards */}
      <div className="animate-in" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {METRICS.map(m => (
          <div key={m.label} className="metric-card">
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 'var(--text-4xl)',
              fontWeight: 700,
              color: m.color,
              lineHeight: 1,
              marginBottom: 8,
            }}>
              {m.value}
            </div>
            <div style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
              marginBottom: 2,
            }}>
              {m.label}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Conditions pill */}
      {activeProblems > 0 && (
        <div className="animate-in" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,184,48,0.08)',
          border: '1px solid rgba(255,184,48,0.2)',
          borderRadius: 8,
          padding: '8px 16px',
          marginBottom: 24,
          fontSize: '0.8rem',
          color: 'var(--warning)',
        }}>
          <span>⚠</span>
          {activeProblems} active condition{activeProblems !== 1 ? 's' : ''} / injur{activeProblems !== 1 ? 'ies' : 'y'} — exercises adjusted
        </div>
      )}

      {/* New user nudge */}
      {isNewUser && (
        <div className="animate-in" style={{
          background: 'var(--teal-dim)',
          border: '1px solid var(--border-teal)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap' as const,
          gap: 16,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--teal-500)', marginBottom: 4 }}>
              Start your first session
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, lineHeight: 1.6, maxWidth: 480 }}>
              Your profile is ready. Open a session, allow camera access, and PhysioCore AI will guide you through your first exercise with real-time form scoring.
            </p>
          </div>
          <button className="btn-primary" onClick={() => { navigate('/session'); }} style={{ flexShrink: 0 }}>
            Begin first session →
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="animate-in" style={{ marginBottom: 32 }}>
        <p style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          marginBottom: 12,
          fontFamily: "'Space Mono', monospace",
        }}>
          Quick Actions
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
          <button className="btn-primary" onClick={() => { navigate('/session'); }}>
            {isNewUser ? 'Start First Session' : 'Start Session'}
          </button>
          <button className="btn-ghost" onClick={() => { navigate('/assessment'); }}>
            Full Assessment
          </button>
          <button className="btn-ghost" onClick={() => { navigate('/nutrition'); }}>
            Nutrition Plan
          </button>
          <button className="btn-ghost" onClick={() => { navigate('/gym'); }}>
            Workout Programs
          </button>
          <button
            onClick={() => { clearProfile(); navigate('/'); }}
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--text-tertiary)',
              fontSize: '0.75rem',
              padding: '6px 12px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Reset profile
          </button>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="animate-in card">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div>
            <h2 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>Recent Sessions</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
              {isNewUser ? 'No sessions yet' : `Last ${recentSessions.length} session${recentSessions.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {!isNewUser && (
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '0.68rem',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.06em',
            }}>
              FORM SCORE
            </span>
          )}
        </div>

        {isNewUser ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 16px',
              gap: 12,
              cursor: 'pointer',
              borderRadius: 12,
              border: '1px dashed var(--border-default)',
              transition: 'border-color 0.2s',
            }}
            onClick={() => { navigate('/session'); }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-teal)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)'; }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--teal-dim)',
              border: '1px solid var(--border-teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
            }}>
              +
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No sessions recorded yet</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' as const }}>
              Complete your first session — form scores and rep history will appear here.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentSessions.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: i < recentSessions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div>
                  <div style={{
                    fontWeight: 500,
                    fontSize: '0.88rem',
                    textTransform: 'capitalize' as const,
                    marginBottom: 2,
                  }}>
                    {s.exercise.replace(/_/g, ' ')}
                  </div>
                  <div style={{
                    color: 'var(--text-tertiary)',
                    fontSize: '0.72rem',
                    fontFamily: "'Space Mono', monospace",
                  }}>
                    {new Date(s.date).toLocaleDateString()} · {s.reps} reps · {s.durationMin} min
                  </div>
                </div>
                <div style={{
                  fontFamily: "'Space Mono', monospace",
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  color: scoreColor(s.formScore),
                }}>
                  {s.formScore}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AiChatPanel
        pageContext={`Current page: Dashboard. Total sessions: ${sessions.length}. Current streak: ${streak} days. Adherence: ${adherence !== null ? adherence + '%' : 'N/A'}. Active conditions/injuries: ${activeProblems}. Recent sessions: ${recentSessions.map(s => `${s.exercise.replace(/_/g, ' ')} (score: ${s.formScore}, ${new Date(s.date).toLocaleDateString()})`).join('; ') || 'none'}.`}
        quickPrompts={[
          'My adherence is low — what can I do to improve it?',
          'What should I focus on this week?',
          'When should I take a recovery day?',
        ]}
      />
    </div>
  );
}

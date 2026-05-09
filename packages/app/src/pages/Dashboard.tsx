import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { AiChatPanel } from '../components/AiChatPanel.js';

interface StoredSession {
  id: string;
  exercise: string;
  date: string; // ISO
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = { maxWidth: '900px', margin: '0 auto', padding: '32px 24px' };
const headingStyle: React.CSSProperties = { fontSize: '1.75rem', fontWeight: 700, marginBottom: '4px' };
const subheadStyle: React.CSSProperties = { color: 'var(--color-text-muted)', marginBottom: '32px' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' };
const cardStyle: React.CSSProperties = { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' };
const statValueStyle: React.CSSProperties = { fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1, marginBottom: '4px' };
const statLabelStyle: React.CSSProperties = { fontSize: '0.875rem', color: 'var(--color-text-muted)' };
const actionsStyle: React.CSSProperties = { display: 'flex', gap: '12px', flexWrap: 'wrap' as const, marginBottom: '32px' };
const primaryBtnStyle: React.CSSProperties = { padding: '10px 22px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.9rem', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' };
const secondaryBtnStyle: React.CSSProperties = { padding: '10px 22px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid #e2e8f0', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer' };
const sessionRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' };

// ─── Component ────────────────────────────────────────────────────────────────

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

  return (
    <div style={pageStyle}>
      <h1 style={headingStyle}>{isNewUser ? `Welcome, ${firstName}` : `Welcome back, ${firstName}`}</h1>
      <p style={subheadStyle}>
        Goal: {userProfile.primaryGoal.replace(/_/g, ' ')} · Level: {userProfile.fitnessLevel} · Plan: {planLabel}
      </p>

      {/* Stat cards */}
      <div style={gridStyle}>
        <div style={cardStyle}>
          <div style={statValueStyle}>{streak}</div>
          <div style={statLabelStyle}>Day streak</div>
        </div>
        <div style={cardStyle}>
          <div style={statValueStyle}>{sessions.length}</div>
          <div style={statLabelStyle}>Sessions completed</div>
        </div>
        <div style={cardStyle}>
          <div style={statValueStyle}>{adherence !== null ? `${adherence}%` : '—'}</div>
          <div style={statLabelStyle}>Adherence score</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...statValueStyle, color: activeProblems === 0 ? 'var(--color-secondary)' : 'var(--color-warning)' }}>
            {activeProblems === 0 ? 'None' : activeProblems}
          </div>
          <div style={statLabelStyle}>Active conditions / injuries</div>
        </div>
      </div>

      {/* New user onboarding nudge */}
      {isNewUser && (
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)', border: '1px solid #c7d2fe', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: '32px' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#4338ca', marginBottom: 6 }}>Start your first session</div>
          <p style={{ color: '#4338ca', fontSize: '0.875rem', margin: '0 0 14px', lineHeight: 1.6 }}>
            Your profile is ready. Open a session, allow camera access, and PhysioCore AI will guide you through your first exercise with real-time form scoring.
          </p>
          <button style={primaryBtnStyle} onClick={() => { navigate('/session'); }}>
            Begin first session →
          </button>
        </div>
      )}

      {/* Quick actions */}
      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Quick actions</h2>
      <div style={actionsStyle}>
        <button style={primaryBtnStyle} onClick={() => { navigate('/session'); }}>
          {isNewUser ? 'Start First Session' : 'Start Session'}
        </button>
        <button style={secondaryBtnStyle} onClick={() => { navigate('/assessment'); }}>
          Full Assessment
        </button>
        <button style={secondaryBtnStyle} onClick={() => { navigate('/nutrition'); }}>
          Nutrition Plan
        </button>
        <button
          style={{ ...secondaryBtnStyle, color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: '8px 16px' }}
          onClick={() => { clearProfile(); navigate('/'); }}
        >
          Reset profile
        </button>
      </div>

      {/* Recent sessions */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>Recent sessions</h2>
        <p style={{ ...statLabelStyle, marginBottom: '16px' }}>
          {isNewUser ? 'No sessions yet' : `Last ${recentSessions.length} exercise session${recentSessions.length !== 1 ? 's' : ''}`}
        </p>

        {isNewUser ? (
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', gap: 12, cursor: 'pointer' }}
            onClick={() => { navigate('/session'); }}
          >
            <div style={{ fontSize: '2.5rem' }}>🎯</div>
            <div style={{ fontWeight: 600, color: '#334155' }}>No sessions recorded yet</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center' as const }}>
              Complete your first session — form scores and rep history will appear here.
            </div>
            <button style={{ ...primaryBtnStyle, marginTop: 4 }}>Start your first session →</button>
          </div>
        ) : (
          recentSessions.map(s => (
            <div key={s.id} style={sessionRowStyle}>
              <div>
                <div style={{ fontWeight: 500, textTransform: 'capitalize' as const }}>{s.exercise.replace(/_/g, ' ')}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                  {new Date(s.date).toLocaleDateString()} · {s.reps} reps · {s.durationMin} min
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: s.formScore >= 80 ? 'var(--color-secondary)' : s.formScore >= 65 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                {s.formScore}
              </div>
            </div>
          ))
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

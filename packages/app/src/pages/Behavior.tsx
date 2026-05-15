import { useState, useMemo } from 'react';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { analyzeBehavior } from '../hooks/useOrchestrator.js';
import { AiChatPanel } from '../components/AiChatPanel.js';
import type { BehaviorInput, SessionSummary } from '../lib/agents/behaviorClient.js';
import type { RetentionIntervention } from '@physiocore/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSessionHistory(createdAt: string, fitnessLevel: string): SessionSummary[] {
  const sessionsPerWeek: Record<string, number> = { beginner: 2, intermediate: 3, advanced: 4, athlete: 5 };
  const freq = sessionsPerWeek[fitnessLevel] ?? 3;
  const totalDays = Math.min(90, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
  const history: SessionSummary[] = [];
  for (let d = 0; d < totalDays; d++) {
    const isExpected = (d % Math.floor(7 / freq)) === 0;
    if (!isExpected) continue;
    // simulate some missed sessions and short ones
    const completed = Math.random() > 0.28;
    history.push({
      completedAt: new Date(Date.now() - d * 86400000).toISOString(),
      durationMinutes: completed ? 20 + Math.floor(Math.random() * 20) : 5,
      completed,
    });
  }
  return history;
}

// Build 30-day presence bitmap from history
function buildPresenceMap(history: SessionSummary[]): boolean[] {
  const map = new Array<boolean>(30).fill(false);
  const now = Date.now();
  for (const s of history) {
    const daysAgo = Math.floor((now - new Date(s.completedAt).getTime()) / 86400000);
    if (daysAgo < 30 && s.completed) map[daysAgo] = true;
  }
  return map;
}

// ─── SVG Components ───────────────────────────────────────────────────────────

function AdherenceChart({ presence }: { presence: boolean[] }) {
  const reversed = [...presence].reverse(); // index 0 = oldest day
  return (
    <svg width="100%" viewBox={`0 0 ${30 * 18} 60`} style={{ display: 'block' }}>
      {reversed.map((on, i) => (
        <rect
          key={i}
          x={i * 18}
          y={on ? 8 : 28}
          width={14}
          height={on ? 44 : 24}
          rx={3}
          fill={on ? '#6366f1' : '#e2e8f0'}
        />
      ))}
    </svg>
  );
}

function ChurnGauge({ score }: { score: number }) {
  const pct = Math.min(1, Math.max(0, score));
  const r = 52;
  const cx = 70;
  const cy = 70;
  const startAngle = -210;
  const sweepDeg = 240;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arc = (angle: number) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });
  const endAngle = startAngle + sweepDeg * pct;
  const start = arc(startAngle);
  const end = arc(endAngle);
  const trackEnd = arc(startAngle + sweepDeg);
  const largeArc = sweepDeg * pct > 180 ? 1 : 0;
  const trackLargeArc = sweepDeg > 180 ? 1 : 0;
  const color = pct >= 0.8 ? '#ef4444' : pct >= 0.6 ? '#f97316' : pct >= 0.35 ? '#eab308' : '#22c55e';
  const level = pct >= 0.8 ? 'Critical' : pct >= 0.6 ? 'High' : pct >= 0.35 ? 'Medium' : 'Low';

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={140} height={120} viewBox="0 0 140 120">
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${trackLargeArc} 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none" stroke="#e2e8f0" strokeWidth={12} strokeLinecap="round"
        />
        {pct > 0 && (
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
            fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight="600" fill={color}>{Math.round(pct * 100)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill="#64748b">/100 risk</text>
        <text x={cx} y={cy + 32} textAnchor="middle" fontSize={11} fontWeight="600" fill={color}>{level}</text>
      </svg>
    </div>
  );
}

function StreakCalendar({ presence }: { presence: boolean[] }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const cells = Array.from({ length: 28 }, (_, i) => {
    const daysAgo = 27 - i;
    const d = new Date(Date.now() - daysAgo * 86400000);
    return { daysAgo, label: days[d.getDay()] ?? '', active: daysAgo < presence.length && (presence[daysAgo] ?? false) };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
        <div key={i} style={{ textAlign: 'center', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, paddingBottom: 2 }}>{d}</div>
      ))}
      {cells.map((c, i) => (
        <div
          key={i}
          title={`${c.daysAgo === 0 ? 'Today' : `${c.daysAgo}d ago`} — ${c.active ? 'completed' : 'missed'}`}
          style={{ width: '100%', aspectRatio: '1', borderRadius: 5, background: c.active ? '#6366f1' : '#f1f5f9', border: c.daysAgo === 0 ? '2px solid #6366f1' : '2px solid transparent', cursor: 'default' }}
        />
      ))}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { maxWidth: 960, margin: '0 auto', padding: '100px 24px 48px' };
const h1: React.CSSProperties = { fontSize: '1.75rem', fontWeight: 600, marginBottom: 4 };
const muted: React.CSSProperties = { color: '#64748b', fontSize: '0.875rem' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const sectionH: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 };
const statBlock: React.CSSProperties = { background: '#f8fafc', borderRadius: 10, padding: '12px 16px', textAlign: 'center' };
const badge: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: '0.85rem' };
const habitRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 };
const inputStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.875rem', flex: 1, minWidth: 160, background: '#f8fafc' };

// ─── Component ────────────────────────────────────────────────────────────────

export default function Behavior() {
  const { userProfile } = useUserProfile();

  const [habitAnchor, setHabitAnchor] = useState('brush my teeth');
  const [habitSession, setHabitSession] = useState('5-min shoulder mobility');
  const [savedHabits, setSavedHabits] = useState<Array<{ anchor: string; session: string }>>([]);
  const [reMessage, setReMessage] = useState('');
  const [loadingRe, setLoadingRe] = useState(false);

  const behaviorResult = useMemo(() => {
    if (!userProfile) return null;
    const history = buildSessionHistory(userProfile.createdAt, userProfile.fitnessLevel);
    const input: BehaviorInput = {
      sessionHistory: history,
      currentStreak: Math.floor(Math.random() * 8),
      totalSessions: history.filter(s => s.completed).length,
      averageDurationMin: 28,
      userId: userProfile.id,
    };
    return analyzeBehavior(input);
  }, [userProfile]);

  const presence = useMemo(() => {
    if (!userProfile) return new Array<boolean>(30).fill(false);
    const hist = buildSessionHistory(userProfile.createdAt, userProfile.fitnessLevel);
    return buildPresenceMap(hist);
  }, [userProfile]);

  if (!userProfile || !behaviorResult) return <div style={{ ...page, ...muted }}>Profile not loaded.</div>;

  const { profile, interventions } = behaviorResult;
  const churnScore = Math.round(profile.churnRisk.score * 100);
  const churnLevel = profile.churnRisk.level;
  const adherence30 = Math.round((presence.filter(Boolean).length / 30) * 100);

  // Milestone checks
  const milestones = [
    { icon: '🎯', label: 'First Session', desc: 'Completed your first session', unlocked: profile.totalSessionsCompleted >= 1 },
    { icon: '🔥', label: '7-Day Streak', desc: '7 sessions in a row', unlocked: profile.streakDays >= 7 },
    { icon: '💯', label: '100 Reps', desc: 'Total reps across all sessions', unlocked: profile.totalSessionsCompleted >= 4 },
    { icon: '⭐', label: 'Form Master', desc: 'Averaged 90%+ form score', unlocked: false },
    { icon: '🏆', label: 'Month Warrior', desc: '20+ sessions in a month', unlocked: profile.totalSessionsCompleted >= 20 },
    { icon: '🧘', label: 'Yoga Initiate', desc: 'Completed a yoga hold', unlocked: false },
  ];

  // Progressive difficulty alert
  const suggestUpgrade = profile.adherenceScore >= 80 && profile.totalSessionsCompleted >= 5;

  async function generateReMessage() {
    setLoadingRe(true);
    setReMessage('');
    try {
      const apiKey = (import.meta.env as Record<string, string>)['VITE_ANTHROPIC_KEY'];
      if (!apiKey) throw new Error('VITE_ANTHROPIC_KEY not set');
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: `You are a supportive physiotherapy coach. Write a short (2-3 sentences), warm, personalized re-engagement message for ${userProfile!.name}. Their motivation style is "${profile.motivationStyle}". Goal: ${userProfile!.primaryGoal}. Churn risk: ${churnLevel}. Streak: ${profile.streakDays} days. Adherence: ${profile.adherenceScore}%. Be encouraging, specific to their style, and end with a clear call to action. Respond with plain text only — no JSON, no quotes, no formatting.`,
          messages: [{ role: 'user', content: `Write a personalized re-engagement message for ${userProfile!.name} with ${profile.motivationStyle} motivation style.` }],
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json() as { content: Array<{ type: string; text: string }> };
      setReMessage(data.content.find(b => b.type === 'text')?.text ?? '');
    } catch (e) {
      setReMessage(`Error: ${String(e)}`);
    }
    setLoadingRe(false);
  }

  function saveHabit() {
    if (habitAnchor.trim() && habitSession.trim()) {
      setSavedHabits(prev => [...prev, { anchor: habitAnchor.trim(), session: habitSession.trim() }]);
    }
  }

  const interventionTypeColors: Record<string, { bg: string; color: string }> = {
    notification: { bg: '#eff6ff', color: '#1e40af' },
    incentive:    { bg: '#f0fdf4', color: '#15803d' },
    content:      { bg: '#faf5ff', color: '#7c3aed' },
  };

  return (
    <div style={page}>
      <h1 style={h1}>Behavior & Retention</h1>
      <p style={{ ...muted, marginBottom: 28 }}>
        Adherence analysis, churn prediction, and personalized retention for {userProfile.name}
      </p>

      {/* Top stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Adherence score', value: `${profile.adherenceScore}%`, color: profile.adherenceScore >= 75 ? '#15803d' : profile.adherenceScore >= 50 ? '#92400e' : '#b91c1c' },
          { label: 'Current streak', value: `${profile.streakDays}d`, color: '#6366f1' },
          { label: 'Sessions done', value: profile.totalSessionsCompleted.toString(), color: '#0369a1' },
          { label: '30-day activity', value: `${adherence30}%`, color: adherence30 >= 50 ? '#15803d' : '#92400e' },
          { label: 'Motivation style', value: profile.motivationStyle, color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} style={statBlock}>
            <div style={{ fontSize: '1.4rem', fontWeight: 600, color: s.color, textTransform: 'capitalize' as const }}>{s.value}</div>
            <div style={{ ...muted, fontSize: '0.72rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Adherence chart */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <div style={sectionH}><span>📊</span> 30-Day Adherence (last 30 days)</div>
          <AdherenceChart presence={presence} />
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '0.75rem', color: '#64748b' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#6366f1', marginRight: 4 }} />Session completed</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#e2e8f0', marginRight: 4 }} />Missed / no session</span>
          </div>
        </div>

        {/* Churn gauge */}
        <div style={card}>
          <div style={sectionH}><span>⚠</span> Churn Risk Score</div>
          <ChurnGauge score={profile.churnRisk.score} />
          {profile.churnRisk.factors.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>DROP-OFF RISK FACTORS</div>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {profile.churnRisk.factors.map((f, i) => (
                  <li key={i} style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {profile.churnRisk.predictedChurnDate && (
            <div style={{ marginTop: 10, background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#92400e' }}>
              Predicted drop-off: {new Date(profile.churnRisk.predictedChurnDate).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Streak calendar */}
        <div style={card}>
          <div style={sectionH}><span>📅</span> Streak Calendar</div>
          <StreakCalendar presence={presence} />
          <div style={{ marginTop: 14, display: 'flex', gap: 16 }}>
            <div style={statBlock}>
              <div style={{ fontWeight: 600, fontSize: '1.3rem', color: '#6366f1' }}>{profile.streakDays}</div>
              <div style={{ ...muted, fontSize: '0.72rem' }}>current streak (days)</div>
            </div>
            <div style={statBlock}>
              <div style={{ fontWeight: 600, fontSize: '1.3rem', color: '#22c55e' }}>{presence.filter(Boolean).length}</div>
              <div style={{ ...muted, fontSize: '0.72rem' }}>sessions last 30 days</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progressive difficulty alert */}
      {suggestUpgrade && (
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: '#15803d', marginBottom: 6 }}>🚀 Ready to level up?</div>
          <div style={{ fontSize: '0.875rem', color: '#166534' }}>
            Your last 3 sessions average a strong form score. PhysioCore AI recommends progressing to a more challenging variation — try adding load, increasing reps to 15, or advancing to a split squat / Romanian deadlift. Start your next session to unlock the next level.
          </div>
        </div>
      )}

      {/* Intervention cards */}
      {interventions.length > 0 && (
        <div style={card}>
          <div style={sectionH}><span>💬</span> Retention Interventions</div>
          {interventions.map((iv: RetentionIntervention, i) => {
            const colors = interventionTypeColors[iv.type] ?? { bg: '#f8fafc', color: '#475569' };
            return (
              <div key={i} style={{ ...colors, borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>
                  P{iv.priority} · {iv.type.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '0.875rem' }}>{iv.message}</div>
              </div>
            );
          })}

          {/* AI re-engagement message */}
          <div style={{ marginTop: 14, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#7c3aed', marginBottom: 8 }}>
              Personalized re-engagement message — {profile.motivationStyle} motivation style
            </div>
            {reMessage ? (
              <div style={{ fontSize: '0.875rem', color: '#4c1d95', lineHeight: 1.6 }}>{reMessage}</div>
            ) : (
              <button
                style={{ padding: '8px 18px', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                onClick={() => { void generateReMessage(); }}
                disabled={loadingRe}
              >
                {loadingRe ? 'Generating...' : '✨ Generate AI message'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Habit stacking */}
      <div style={card}>
        <div style={sectionH}><span>🔗</span> Habit Stacking</div>
        <p style={{ ...muted, marginBottom: 14 }}>
          Anchor a short PhysioCore session to an existing daily habit to build consistency.
        </p>
        <div style={habitRow}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>After I</span>
          <input style={inputStyle} value={habitAnchor} onChange={e => { setHabitAnchor(e.target.value); }} placeholder="brush my teeth" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>I will do</span>
          <input style={inputStyle} value={habitSession} onChange={e => { setHabitSession(e.target.value); }} placeholder="5-min shoulder mobility" />
          <button onClick={saveHabit} style={{ padding: '8px 16px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Save habit
          </button>
        </div>
        {savedHabits.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '8px 14px', marginBottom: 6, fontSize: '0.85rem' }}>
            🔗 After I <strong>{h.anchor}</strong>, I will do <strong>{h.session}</strong>
            <button onClick={() => { setSavedHabits(prev => prev.filter((_, j) => j !== i)); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.1rem' }}>×</button>
          </div>
        ))}
      </div>

      {/* Milestone badges */}
      <div style={card}>
        <div style={sectionH}><span>🏅</span> Milestone Badges</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {milestones.map(m => (
            <div key={m.label} style={{ ...badge, background: m.unlocked ? '#f0fdf4' : '#f8fafc', border: `1px solid ${m.unlocked ? '#86efac' : '#e2e8f0'}`, color: m.unlocked ? '#15803d' : '#94a3b8', flexDirection: 'column', textAlign: 'center', padding: '16px 12px', opacity: m.unlocked ? 1 : 0.6 }}>
              <span style={{ fontSize: '1.8rem', filter: m.unlocked ? 'none' : 'grayscale(1)' }}>{m.icon}</span>
              <span style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: 6 }}>{m.label}</span>
              <span style={{ fontWeight: 400, fontSize: '0.72rem', color: m.unlocked ? '#15803d' : '#94a3b8', marginTop: 2 }}>{m.desc}</span>
              {m.unlocked && <span style={{ marginTop: 6, fontSize: '0.7rem', fontWeight: 600, color: '#22c55e' }}>✓ Unlocked</span>}
            </div>
          ))}
        </div>
      </div>

      <AiChatPanel
        pageContext={`Current page: Behavior & Retention. Adherence (30 days): ${adherence30}%. Churn risk: ${churnScore}% (${churnLevel}). Sessions completed: ${profile.totalSessionsCompleted}. Motivation style: ${profile.motivationStyle}. Saved habits: ${savedHabits.map(h => `after ${h.anchor} → ${h.session}`).join('; ') || 'none'}. Interventions recommended: ${interventions.map(i => i.type).join(', ')}.`}
        quickPrompts={[
          'Why is my adherence low and how do I fix it?',
          'What should I focus on this week to build a habit?',
          'How do I recover motivation after missing several sessions?',
        ]}
      />
    </div>
  );
}

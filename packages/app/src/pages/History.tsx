import { useState, useEffect, useMemo } from 'react';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { supabase } from '@physiocore/supabase';
import { AiChatPanel } from '../components/AiChatPanel.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface SessionRecord {
  id?: string;
  exercise: string;
  date: string;
  reps: number;
  avg_score: number;
  ai_feedback_summary?: string;
  top_deviation?: string;
}

function scoreColor(s: number, alpha = 1): string {
  if (s === 0) return `rgba(26,32,48,${alpha})`;
  if (s >= 85) return `rgba(0,212,170,${alpha})`;
  if (s >= 75) return `rgba(0,212,170,${alpha * 0.7})`;
  if (s >= 60) return `rgba(0,212,170,${alpha * 0.4})`;
  return `rgba(0,212,170,${alpha * 0.15})`;
}

function Heatmap({ sessions }: { sessions: SessionRecord[] }) {
  const today = new Date();
  const dayMap = new Map<string, number>();
  for (const s of sessions) {
    const key = s.date.slice(0, 10);
    const prev = dayMap.get(key) ?? 0;
    dayMap.set(key, Math.max(prev, s.avg_score));
  }
  const WEEKS = 52; const CELL = 11; const GAP = 2; const STEP = CELL + GAP;
  const cells: { x: number; y: number; score: number; dateStr: string }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (WEEKS - 1 - w) * 7 - (6 - d));
      const dateStr = date.toISOString().slice(0, 10);
      cells.push({ x: w * STEP, y: d * STEP, score: dayMap.get(dateStr) ?? 0, dateStr });
    }
  }
  const W = WEEKS * STEP; const H = 7 * STEP;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const labels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const d = new Date(today); d.setDate(today.getDate() - (WEEKS - 1 - w) * 7);
    if (d.getMonth() !== lastMonth) { labels.push({ x: w * STEP, label: months[d.getMonth()] ?? '' }); lastMonth = d.getMonth(); }
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H + 18} style={{ display: 'block', fontFamily: "'Space Mono', monospace" }}>
        {labels.map(({ x, label }) => <text key={x} x={x} y={H + 14} fontSize={8} fill="var(--text-tertiary)">{label}</text>)}
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={CELL} height={CELL} rx={2}
            fill={scoreColor(c.score)}><title>{`${c.dateStr}: ${c.score > 0 ? c.score + '/100' : 'no session'}`}</title></rect>
        ))}
      </svg>
    </div>
  );
}

function TrendChart({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length < 2) return <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', textAlign: 'center' }}>Need 2+ sessions for trend</p>;
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
  const W = 500; const H = 120; const PAD = 20;
  const minS = Math.min(...sorted.map(s => s.avg_score));
  const maxS = Math.max(...sorted.map(s => s.avg_score));
  const range = maxS - minS || 10;
  const pts = sorted.map((s, i) => {
    const x = PAD + (i / (sorted.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((s.avg_score - minS) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--teal-500)" strokeWidth={2} strokeLinejoin="round" />
      {sorted.map((s, i) => {
        const [x, y] = (pts[i] ?? '0,0').split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--teal-500)" />;
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border-subtle)" strokeWidth={1} />
      <text x={PAD} y={H - PAD + 12} fontSize={9} fill="var(--text-tertiary)" fontFamily="'Space Mono',monospace">{sorted[0]?.date.slice(5, 10)}</text>
      <text x={W - PAD} y={H - PAD + 12} fontSize={9} fill="var(--text-tertiary)" fontFamily="'Space Mono',monospace" textAnchor="end">{sorted[sorted.length - 1]?.date.slice(5, 10)}</text>
    </svg>
  );
}

const EXERCISES = ['all', 'squat', 'push_up', 'deadlift', 'yoga', 'pilates', 'gym'];

export default function History() {
  const { userProfile } = useUserProfile();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const userId = authSession?.user?.id;
        if (userId) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          const { data } = await db.from('session_summaries').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(200);
          if (data && (data as unknown[]).length > 0) {
            setSessions(data as SessionRecord[]);
            setLoading(false);
            return;
          }
        }
      } catch { /* fall through to localStorage */ }
      // localStorage fallback
      try {
        interface LSSession { id?: string; exercise: string; date: string; reps: number; formScore?: number; avg_score?: number }
        const raw = localStorage.getItem('physiocore_sessions');
        const ls: LSSession[] = raw ? (JSON.parse(raw) as LSSession[]) : [];
        setSessions(ls.map(s => ({ ...s, avg_score: s.avg_score ?? s.formScore ?? 0 })));
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() =>
    filter === 'all' ? sessions : sessions.filter(s => s.exercise?.toLowerCase().includes(filter)),
    [sessions, filter]
  );

  const stats = useMemo(() => ({
    total: sessions.length,
    reps: sessions.reduce((sum, s) => sum + (s.reps || 0), 0),
    avg: sessions.length ? Math.round(sessions.reduce((sum, s) => sum + s.avg_score, 0) / sessions.length) : 0,
    best: sessions.length ? Math.max(...sessions.map(s => s.avg_score)) : 0,
  }), [sessions]);

  const personalBests = useMemo(() => {
    const map = new Map<string, SessionRecord>();
    for (const s of sessions) {
      const key = s.exercise;
      if (!map.has(key) || s.avg_score > (map.get(key)?.avg_score ?? 0)) map.set(key, s);
    }
    return Array.from(map.values()).sort((a, b) => b.avg_score - a.avg_score);
  }, [sessions]);

  if (!userProfile) return null;

  const card: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: 12, padding: 20, marginBottom: 12,
  };

  return (
    <div style={{ padding: '100px 24px 80px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: 'var(--teal-500)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Session History</p>
        <h1 className="font-display" style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, margin: 0 }}>Your Training Record</h1>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Sessions', value: stats.total.toString() },
          { label: 'Total Reps', value: stats.reps.toLocaleString() },
          { label: 'Avg Score', value: stats.avg ? `${stats.avg}/100` : '—' },
          { label: 'Best Score', value: stats.best ? `${stats.best}/100` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="metric-card" style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal-500)' }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div style={card}>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>52-Week Activity Map</h3>
        <Heatmap sessions={sessions} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Less</span>
          {[0, 50, 65, 75, 85].map(s => (
            <div key={s} style={{ width: 11, height: 11, borderRadius: 2, background: scoreColor(s, 1) }} />
          ))}
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>More</span>
        </div>
      </div>

      {/* Trend chart */}
      <div style={card}>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>Form Score Trend</h3>
        <TrendChart sessions={filtered} />
      </div>

      {/* Session list */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Session Timeline</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EXERCISES.map(ex => (
              <button key={ex} onClick={() => setFilter(ex)} style={{
                padding: '4px 10px', borderRadius: 50, border: '1px solid',
                borderColor: filter === ex ? 'var(--border-teal)' : 'var(--border-subtle)',
                background: filter === ex ? 'var(--teal-dim)' : 'transparent',
                color: filter === ex ? 'var(--teal-500)' : 'var(--text-tertiary)',
                fontSize: '0.72rem', cursor: 'pointer', textTransform: 'capitalize',
              }}>{ex === 'all' ? 'All' : ex.replace(/_/g, ' ')}</button>
            ))}
          </div>
        </div>

        {loading && <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>No sessions yet. Complete a session to see your history.</p>
        )}

        {filtered.map((s, i) => {
          const key = `${s.date}-${i}`;
          const isOpen = expanded.has(key);
          const score = s.avg_score;
          return (
            <div key={key} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', paddingBottom: 12, marginBottom: 12 }}>
              <button onClick={() => {
                const next = new Set(expanded);
                isOpen ? next.delete(key) : next.add(key);
                setExpanded(next);
              }} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontFamily: "'Space Mono',monospace", color: score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)', fontWeight: 700, flexShrink: 0 }}>{score}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{(s.exercise || '').replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace" }}>
                      {new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · {s.reps} reps
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>
              {isOpen && (
                <div style={{ marginTop: 10, paddingLeft: 48 }}>
                  {s.top_deviation && <p style={{ fontSize: '0.8rem', color: 'var(--warning)', margin: '0 0 6px' }}>⚠ {s.top_deviation}</p>}
                  {s.ai_feedback_summary && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{s.ai_feedback_summary}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Personal bests */}
      {personalBests.length > 0 && (
        <div style={card}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>Personal Bests</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Exercise', 'Best Score', 'Date', 'Reps'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-tertiary)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personalBests.map(s => (
                <tr key={s.exercise} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px', textTransform: 'capitalize' }}>{s.exercise.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '8px', fontFamily: "'Space Mono',monospace", color: 'var(--teal-500)', fontWeight: 700 }}>{s.avg_score}/100</td>
                  <td style={{ padding: '8px', color: 'var(--text-secondary)', fontFamily: "'Space Mono',monospace", fontSize: '0.75rem' }}>{new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                  <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{s.reps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AiChatPanel pageContext="Session history and performance analytics page" quickPrompts={['What is my progress trend?', 'Which exercise needs most work?', 'Am I ready to increase intensity?', 'How does my consistency compare?']} />
    </div>
  );
}

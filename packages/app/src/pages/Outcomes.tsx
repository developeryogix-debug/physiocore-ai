import { useState, useEffect } from 'react';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { supabase } from '@physiocore/supabase';
import { AiChatPanel } from '../components/AiChatPanel.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface OutcomeRow { id?: string; type: string; score: number; metadata?: Record<string, unknown>; recorded_at: string; }

function MiniChart({ data, color = 'var(--teal-500)', min = 0, max = 10 }: { data: number[]; color?: string; min?: number; max?: number }) {
  if (data.length < 2) return null;
  const W = 300; const H = 60; const PAD = 4;
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: 300 }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {data.map((_, i) => {
        const [x, y] = (pts[i] ?? '0,0').split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
      })}
    </svg>
  );
}

function Slider({ value, min, max, onChange, color = 'var(--teal-500)' }: {
  value: number; min: number; max: number; onChange: (v: number) => void; color?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: color }} />
      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.9rem', color, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const PHQ4_QUESTIONS = [
  'Feeling nervous, anxious or on edge',
  'Not being able to stop or control worrying',
  'Feeling down, depressed, or hopeless',
  'Little interest or pleasure in doing things',
];

export default function Outcomes() {
  const { userProfile } = useUserProfile();

  // PSFS state
  const [activities, setActivities] = useState(['', '', '']);
  const [psfsScores, setPsfsScores] = useState([5, 5, 5]);
  const [psfsHistory, setPsfsHistory] = useState<OutcomeRow[]>([]);

  // NPRS state
  const [painScore, setPainScore] = useState(3);
  const [nprsHistory, setNprsHistory] = useState<OutcomeRow[]>([]);

  // GROC state
  const [grocScore, setGrocScore] = useState(0);
  const [grocHistory, setGrocHistory] = useState<OutcomeRow[]>([]);

  // PHQ-4 state
  const [phq4Answers, setPhq4Answers] = useState([0, 0, 0, 0]);
  const [phq4History, setPhq4History] = useState<OutcomeRow[]>([]);

  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void loadHistory();
    // Load saved PSFS activity names
    const saved = localStorage.getItem('physiocore_psfs_activities');
    if (saved) try { setActivities(JSON.parse(saved) as string[]); } catch { /* ignore */ }
  }, []);

  async function loadHistory() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const uid = session.user.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { data } = await db.from('outcomes').select('*').eq('user_id', uid).order('recorded_at', { ascending: true });
    if (!data) return;
    const rows = data as OutcomeRow[];
    setPsfsHistory(rows.filter(r => r.type === 'psfs'));
    setNprsHistory(rows.filter(r => r.type === 'nprs'));
    setGrocHistory(rows.filter(r => r.type === 'groc'));
    setPhq4History(rows.filter(r => r.type === 'phq4'));
  }

  async function save(type: string, score: number, metadata?: Record<string, unknown>) {
    setSaving(type);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { setMsg('Not logged in'); return; }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await db.from('outcomes').insert({ user_id: session.user.id, type, score, metadata: metadata ?? null, recorded_at: new Date().toISOString() });
      setMsg(`${type.toUpperCase()} saved ✓`);
      await loadHistory();
      setTimeout(() => setMsg(''), 2500);
    } catch { setMsg('Save failed'); }
    setSaving(null);
  }

  function exportCSV() {
    const all = [...psfsHistory, ...nprsHistory, ...grocHistory, ...phq4History]
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    const rows = [['date', 'measure_type', 'score', 'notes'].join(','),
      ...all.map(r => [r.recorded_at.slice(0, 10), r.type, r.score, ''].join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'physiocore_outcomes.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (!userProfile) return null;

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24, marginBottom: 20 };
  const phq4Total = phq4Answers.reduce((a, b) => a + b, 0);
  const phq4Flag = phq4Total >= 6;

  return (
    <div style={{ padding: '100px 24px 80px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: 'var(--teal-500)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Clinical Outcomes</p>
        <h1 className="font-display" style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, margin: 0 }}>Outcome Measures</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: '0.85rem' }}>RCT-ready · CONSORT-compatible · REDCap / SPSS export</p>
      </div>

      {msg && <div style={{ background: 'var(--teal-dim)', border: '1px solid var(--border-teal)', color: 'var(--teal-500)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem' }}>{msg}</div>}

      {/* PSFS */}
      <div style={card}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>PSFS — Patient-Specific Functional Scale</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 16 }}>Rate 3 activities you find difficult (0 = unable, 10 = full ability)</p>
        {activities.map((act, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <input value={act} placeholder={`Activity ${i + 1} (e.g. Walking upstairs)`}
              onChange={e => { const n = [...activities]; n[i] = e.target.value; setActivities(n); localStorage.setItem('physiocore_psfs_activities', JSON.stringify(n)); }}
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: 8, boxSizing: 'border-box' }} />
            <Slider value={psfsScores[i]!} min={0} max={10} onChange={v => { const n = [...psfsScores]; n[i] = v; setPsfsScores(n); }} />
          </div>
        ))}
        <button onClick={() => void save('psfs', Math.round((psfsScores[0]! + psfsScores[1]! + psfsScores[2]!) / 3 * 10) / 10, { activities, scores: psfsScores })} disabled={saving === 'psfs'} className="btn-primary" style={{ marginTop: 8 }}>
          {saving === 'psfs' ? 'Saving…' : 'Record PSFS'}
        </button>
        {psfsHistory.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>Trend (avg score)</p>
            <MiniChart data={psfsHistory.map(r => r.score)} min={0} max={10} />
          </div>
        )}
      </div>

      {/* NPRS */}
      <div style={card}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>NPRS — Numeric Pain Rating Scale</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 16 }}>Current pain level (0 = no pain, 10 = worst imaginable)</p>
        <Slider value={painScore} min={0} max={10} onChange={setPainScore} color={painScore >= 7 ? 'var(--danger)' : painScore >= 4 ? 'var(--warning)' : 'var(--success)'} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span>0 — No pain</span><span>10 — Worst pain</span>
        </div>
        {painScore >= 7 && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>⚠ High pain — consider rest and consult your physiotherapist before continuing.</p>}
        <button onClick={() => void save('nprs', painScore)} disabled={saving === 'nprs'} className="btn-primary" style={{ marginTop: 12 }}>
          {saving === 'nprs' ? 'Saving…' : 'Record Pain Score'}
        </button>
        {nprsHistory.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>Pain trend (lower = better)</p>
            <MiniChart data={nprsHistory.map(r => r.score)} min={0} max={10} color="var(--danger)" />
          </div>
        )}
      </div>

      {/* GROC */}
      <div style={card}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>GROC — Global Rating of Change</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 16 }}>Compared to when you first came in, how would you describe your condition overall? (−7 = vastly worse, +7 = completely recovered)</p>
        <Slider value={grocScore} min={-7} max={7} onChange={setGrocScore} color={grocScore > 0 ? 'var(--success)' : grocScore < 0 ? 'var(--danger)' : 'var(--text-tertiary)'} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span>−7 Vastly worse</span><span>0 Unchanged</span><span>+7 Recovered</span>
        </div>
        <button onClick={() => void save('groc', grocScore)} disabled={saving === 'groc'} className="btn-primary" style={{ marginTop: 12 }}>
          {saving === 'groc' ? 'Saving…' : 'Record GROC (Weekly)'}
        </button>
        {grocHistory.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <MiniChart data={grocHistory.map(r => r.score)} min={-7} max={7} color="var(--blue-400)" />
          </div>
        )}
      </div>

      {/* PHQ-4 */}
      <div style={card}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>PHQ-4 — Mental Wellbeing Screen</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 16 }}>Over the last 2 weeks, how often have you been bothered by: (0=Not at all, 1=Several days, 2=More than half, 3=Nearly every day)</p>
        {PHQ4_QUESTIONS.map((q, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>{i + 1}. {q}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2, 3].map(v => (
                <button key={v} onClick={() => { const n = [...phq4Answers]; n[i] = v; setPhq4Answers(n); }}
                  style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: '0.78rem',
                    borderColor: phq4Answers[i] === v ? 'var(--border-teal)' : 'var(--border-subtle)',
                    background: phq4Answers[i] === v ? 'var(--teal-dim)' : 'var(--bg-elevated)',
                    color: phq4Answers[i] === v ? 'var(--teal-500)' : 'var(--text-secondary)' }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Total score: <strong style={{ fontFamily: "'Space Mono',monospace", color: phq4Flag ? 'var(--danger)' : 'var(--success)' }}>{phq4Total}/12</strong></span>
          {phq4Flag && <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>⚠ Consider professional support</span>}
        </div>
        {phq4Flag && (
          <div style={{ marginTop: 10, padding: '12px 16px', background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--danger)', margin: 0, lineHeight: 1.6 }}>Your score suggests you may benefit from mental health support. Please speak with your doctor or contact <strong>Samaritans of Singapore: 1800-221-4444</strong> (24/7, free).</p>
          </div>
        )}
        <button onClick={() => void save('phq4', phq4Total, { answers: phq4Answers })} disabled={saving === 'phq4'} className="btn-primary" style={{ marginTop: 12 }}>
          {saving === 'phq4' ? 'Saving…' : 'Record PHQ-4 (Monthly)'}
        </button>
      </div>

      {/* Export */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 80 }}>
        <button onClick={exportCSV} className="btn-ghost" style={{ fontSize: '0.82rem' }}>
          ↓ Export CSV — Compatible with REDCap and SPSS
        </button>
      </div>

      <AiChatPanel pageContext="Clinical outcomes tracking: PSFS, NPRS, GROC, PHQ-4 measures" quickPrompts={['What does my PSFS trend mean?', 'How is my pain changing over time?', 'When should I see a physiotherapist?', 'Explain GROC scale to me']} />
    </div>
  );
}

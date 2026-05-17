import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@physiocore/supabase';
import { useAuth } from '../hooks/useAuth.js';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, Legend,
} from 'recharts';
import type { ROMResult, ROMInterp } from '../lib/romData.js';
import { ALL_TESTS, statusClr } from '../lib/romData.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Props {
  results: ROMResult[];
  interp: ROMInterp | null;
  interpErr: string | null;
  saved: boolean;
  onRepeat: () => void;
}

interface HistoricEntry { date: string; measurements: Record<string, number> }

const JOINT_ORDER = ['Cervical','Shoulder','Elbow','Trunk','Hip','Knee','Ankle'];

function pct(r: ROMResult): number {
  const ref = r.higherIsBetter ? r.normalMin : r.normalMax;
  if (ref <= 0) return 100;
  return r.higherIsBetter
    ? Math.min(100, Math.round((r.angle / ref) * 100))
    : Math.min(100, Math.round((ref / Math.max(r.angle, 1)) * 100));
}

function radarColor(v: number) { return v >= 85 ? '#00D4AA' : v >= 70 ? '#FFB830' : '#FF4444'; }

export default function ROMResults({ results, interp, interpErr, saved, onRepeat }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoricEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    void db.from('rom_assessments')
      .select('date,measurements')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(3)
      .then(({ data }: { data: HistoricEntry[] | null }) => { if (data) setHistory(data); });
  }, [user]);

  // ── Radar data ────────────────────────────────────────────────────────────────
  const radarData = JOINT_ORDER
    .map(joint => {
      const jr = results.filter(r => r.joint === joint);
      if (!jr.length) return null;
      const avg = Math.round(jr.reduce((s, r) => s + pct(r), 0) / jr.length);
      return { joint: joint === 'Cervical' ? 'Neck' : joint, today: avg, norm: 100 };
    })
    .filter(Boolean) as { joint: string; today: number; norm: number }[];

  // ── Bilateral pairs ───────────────────────────────────────────────────────────
  const mvPairs = [...new Map(results.map(r => [`${r.joint}|${r.movement}`, r])).keys()];
  const pairs = mvPairs.map(k => {
    const parts = k.split('|');
    const joint = parts[0] ?? ''; const movement = parts[1] ?? '';
    const R = results.find(r => r.joint === joint && r.movement === movement && r.side === 'right');
    const L = results.find(r => r.joint === joint && r.movement === movement && r.side === 'left');
    const maxA = Math.max(R?.angle ?? 0, L?.angle ?? 0, 1);
    const asym = R && L ? Math.abs(pct(R) - pct(L)) : null;
    return { joint, movement, R, L, maxA, asym };
  });

  // ── Trend per joint (last 3 sessions vs today) ────────────────────────────────
  const trendRows = JOINT_ORDER.map(joint => {
    const jr = results.filter(r => r.joint === joint);
    if (!jr.length) return null;
    const todayAvg = Math.round(jr.reduce((s, r) => s + pct(r), 0) / jr.length);
    const historic = history.map(h => {
      const vals = jr.map(r => {
        const prev = h.measurements[r.key];
        if (prev === undefined) return null;
        const t = ALL_TESTS.find(x => x.key === r.key);
        if (!t) return null;
        return t.higherIsBetter
          ? Math.min(100, Math.round((prev / t.normalMin) * 100))
          : Math.min(100, Math.round((t.normalMax / Math.max(prev, 1)) * 100));
      }).filter((v): v is number => v !== null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    }).filter((v): v is number => v !== null);
    const delta = historic.length && historic[0] !== undefined ? todayAvg - historic[0] : null;
    return { joint, todayAvg, delta };
  }).filter(Boolean) as { joint: string; todayAvg: number; delta: number | null }[];

  const riskClr = interp?.overallRisk === 'low' ? '#00D4AA' : interp?.overallRisk === 'moderate' ? '#FFB830' : '#FF4444';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '100px 24px 80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ fontSize: '0.72rem', fontFamily: "'Space Mono',monospace", color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>ROM RESULTS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1.8rem', color: 'var(--text-primary)', margin: 0 }}>Active ROM Report</h1>
          {interp && <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: `${riskClr}20`, color: riskClr, border: `1px solid ${riskClr}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{interp.overallRisk} risk</span>}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace", marginBottom: 24 }}>
          {new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })} · Camera-based ±5–10° · Norkin &amp; White 2016
          {saved && <span style={{ marginLeft: 16, color: 'var(--teal-500)' }}>✓ Saved</span>}
        </div>

        {/* AI summary */}
        {interp && (
          <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid var(--border-teal)', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--teal-500)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Clinical Interpretation</div>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>{interp.summary}</p>
            {interp.referral && <div style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 8, fontSize: '0.8rem', color: '#FF4444' }}>⚠ Physiotherapy referral recommended.</div>}
          </div>
        )}
        {interpErr && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginBottom: 14 }}>{interpErr}</div>}

        {/* Radar chart */}
        {radarData.length >= 3 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>Range of Motion Overview</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace", marginBottom: 16 }}>% of Norkin 2016 normative value · green ≥85% / amber 70–84% / red &lt;70%</div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="joint" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: "'Space Mono',monospace" }} />
                <Radar name="Normative" dataKey="norm" stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.04)" strokeDasharray="4 4" strokeWidth={1} />
                <Radar name="Today" dataKey="today" stroke="#00D4AA" fill="rgba(0,212,170,0.15)" strokeWidth={2} dot={{ fill: '#00D4AA', r: 4 }} />
                <Tooltip contentStyle={{ background: '#0D1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-primary)' }} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bilateral comparison bars */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Syne',sans-serif", marginBottom: 16 }}>Bilateral Comparison</div>
          {pairs.map(({ joint, movement, R, L, asym }) => {
            const rPct = R ? pct(R) : null;
            const lPct = L ? pct(L) : null;
            return (
              <div key={`${joint}-${movement}`} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontFamily: "'Space Mono',monospace" }}>{joint} — {movement}</span>
                  {asym !== null && asym >= 8 && (
                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(255,184,48,0.12)', color: '#FFB830', border: '1px solid rgba(255,184,48,0.25)' }}>⚠ {asym}% asymmetry</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[{ side: 'R', val: rPct, angle: R?.angle, status: R?.status }, { side: 'L', val: lPct, angle: L?.angle, status: L?.status }].map(({ side, val, angle, status }) => (
                    <div key={side}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        <span style={{ color: side === 'R' ? 'var(--blue-400)' : '#a78bfa' }}>{side === 'R' ? 'Right' : 'Left'}</span>
                        <span style={{ fontFamily: "'Space Mono',monospace", color: status ? statusClr(status) : 'var(--text-tertiary)' }}>{angle !== undefined ? `${angle}°` : '—'}</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                        {val !== null && <div style={{ height: '100%', width: `${val}%`, background: val >= 85 ? '#00D4AA' : val >= 70 ? '#FFB830' : '#FF4444', borderRadius: 3, transition: 'width 0.6s ease' }} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trend summary */}
        {trendRows.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Syne',sans-serif", marginBottom: 14 }}>Trend vs Previous Session</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {trendRows.map(({ joint, todayAvg, delta }) => (
                <div key={joint} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', minWidth: 110, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>{joint === 'Cervical' ? 'Neck' : joint}</div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '1.4rem', fontWeight: 600, color: radarColor(todayAvg) }}>{todayAvg}%</div>
                  {delta !== null && (
                    <div style={{ fontSize: '0.68rem', marginTop: 4, color: delta > 2 ? '#00D4AA' : delta < -2 ? '#FF4444' : 'var(--text-tertiary)' }}>
                      {delta > 2 ? `↑ +${delta}%` : delta < -2 ? `↓ ${delta}%` : '→ stable'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Joint findings */}
        {interp && interp.findings.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Joint Findings</div>
            {interp.findings.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < interp.findings.length - 1 ? 10 : 0, paddingBottom: i < interp.findings.length - 1 ? 10 : 0, borderBottom: i < interp.findings.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: 'var(--teal-500)', background: 'var(--teal-dim)', border: '1px solid var(--border-teal)', borderRadius: 6, padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>{f.joint}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', lineHeight: 1.5 }}>{f.finding}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onRepeat} style={{ padding: '11px 22px', borderRadius: 50, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.84rem' }}>Repeat Assessment</button>
          <button onClick={() => navigate('/assessment')} style={{ padding: '11px 24px', borderRadius: 50, background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', border: 'none', color: '#000', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}>Full Assessment →</button>
        </div>
      </div>
    </div>
  );
}

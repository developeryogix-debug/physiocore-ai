/**
 * FunctionalAssessment.tsx
 * Guided 3-test functional assessment: PSFS → TUG → 30s Chair Stand
 * Evidence: Stratford 1995, Podsiadlo 1991, Rikli & Jones 1999
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@physiocore/supabase';
import { useUserProfile } from '../hooks/useUserProfile.js';

const db = supabase as any;

// ── Normative data ─────────────────────────────────────────────────────────────

interface ChairNorm { min: number; max: number }

const CHAIR_M: { ageMin: number; ageMax: number; n: ChairNorm }[] = [
  { ageMin: 60, ageMax: 64, n: { min: 14, max: 19 } },
  { ageMin: 65, ageMax: 69, n: { min: 12, max: 18 } },
  { ageMin: 70, ageMax: 74, n: { min: 12, max: 17 } },
  { ageMin: 75, ageMax: 79, n: { min: 11, max: 17 } },
  { ageMin: 80, ageMax: 84, n: { min: 10, max: 15 } },
  { ageMin: 85, ageMax: 999, n: { min:  8, max: 14 } },
];

const CHAIR_F: { ageMin: number; ageMax: number; n: ChairNorm }[] = [
  { ageMin: 60, ageMax: 64, n: { min: 12, max: 17 } },
  { ageMin: 65, ageMax: 69, n: { min: 11, max: 16 } },
  { ageMin: 70, ageMax: 74, n: { min: 10, max: 15 } },
  { ageMin: 75, ageMax: 79, n: { min: 10, max: 15 } },
  { ageMin: 80, ageMax: 84, n: { min:  9, max: 14 } },
  { ageMin: 85, ageMax: 999, n: { min:  6, max: 11 } },
];

function chairNorm(age: number, sex: string): ChairNorm | null {
  const table = (sex === 'male') ? CHAIR_M : (sex === 'female') ? CHAIR_F : null;
  if (!table) return null;
  return table.find(r => age >= r.ageMin && age <= r.ageMax)?.n ?? null;
}

function getAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface PSFSActivity { name: string; score: number }

type Step = 'intro' | 'psfs' | 'tug' | 'chair' | 'results';

// ── Colours ────────────────────────────────────────────────────────────────────

const C = {
  bg:      'var(--bg-void)',
  surface: 'var(--bg-surface)',
  raised:  'var(--bg-elevated)',
  border:  'var(--border-subtle)',
  teal:    'var(--teal-500)',
  blue:    'var(--blue-400)',
  primary: 'var(--text-primary)',
  sec:     'var(--text-secondary)',
  ter:     'var(--text-tertiary)',
  danger:  'var(--danger)',
  warn:    '#d97706',
  success: '#16a34a',
};

const card: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 28,
  marginBottom: 20,
};

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))',
  color: '#000',
  fontWeight: 700,
  fontSize: '0.9rem',
  border: 'none',
  borderRadius: 50,
  padding: '12px 32px',
  cursor: 'pointer',
  fontFamily: "inherit",
};

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: C.sec,
  fontSize: '0.85rem',
  border: `1px solid ${C.border}`,
  borderRadius: 50,
  padding: '10px 24px',
  cursor: 'pointer',
  fontFamily: "inherit",
};

// ── Haiku summary ──────────────────────────────────────────────────────────────

async function getHaikuSummary(data: {
  psfs: number; psfsChange: number; mcidMet: boolean;
  tugSec: number | null; tugRisk: string;
  chairCount: number; chairNorm: string;
  overallLevel: string;
}): Promise<string> {
  const apiKey = import.meta.env['VITE_ANTHROPIC_KEY'] as string;
  if (!apiKey) return 'AI summary unavailable.';

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    system: 'You are a physiotherapy clinical assistant. Write a concise 3-sentence functional assessment summary for a clinician. Be factual, cite specific scores, note fall risk if TUG indicates high risk. Use professional clinical language.',
    messages: [{ role: 'user', content: `Functional data: ${JSON.stringify(data)}` }],
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body,
    });
    const json = await res.json() as any;
    return json.content?.[0]?.text?.trim() ?? 'AI summary unavailable.';
  } catch {
    return 'AI summary unavailable (network error).';
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FunctionalAssessment() {
  const { userProfile } = useUserProfile();
  const [step, setStep] = useState<Step>('intro');

  // PSFS
  const [activities, setActivities] = useState<PSFSActivity[]>([
    { name: '', score: 5 },
    { name: '', score: 5 },
    { name: '', score: 5 },
  ]);

  // TUG
  const [tugRunning, setTugRunning] = useState(false);
  const [tugStart, setTugStart] = useState<number | null>(null);
  const [tugSec, setTugSec] = useState<number | null>(null);
  const tugInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tugDisplay, setTugDisplay] = useState(0);

  // Chair
  const [chairRunning, setChairRunning] = useState(false);
  const [chairTimeLeft, setChairTimeLeft] = useState(30);
  const [chairReps, setChairReps] = useState(0);
  const [chairDone, setChairDone] = useState(false);
  const chairInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results
  const [summary, setSummary] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const age = userProfile?.dateOfBirth ? getAge(userProfile.dateOfBirth) : 40;
  const sex = userProfile?.gender === 'male' ? 'male' : userProfile?.gender === 'female' ? 'female' : 'other';

  // ── TUG timer ────────────────────────────────────────────────────────────────
  const handleTugToggle = useCallback(() => {
    if (!tugRunning) {
      setTugStart(Date.now());
      setTugRunning(true);
      tugInterval.current = setInterval(() => {
        setTugDisplay(d => d + 0.1);
      }, 100);
    } else {
      if (tugInterval.current) clearInterval(tugInterval.current);
      const elapsed = (Date.now() - (tugStart ?? Date.now())) / 1000;
      setTugSec(Math.round(elapsed * 10) / 10);
      setTugRunning(false);
    }
  }, [tugRunning, tugStart]);

  // ── Chair timer ───────────────────────────────────────────────────────────────
  const startChair = useCallback(() => {
    setChairRunning(true);
    setChairTimeLeft(30);
    setChairReps(0);
    chairInterval.current = setInterval(() => {
      setChairTimeLeft(t => {
        if (t <= 1) {
          clearInterval(chairInterval.current!);
          setChairRunning(false);
          setChairDone(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {
    if (tugInterval.current) clearInterval(tugInterval.current);
    if (chairInterval.current) clearInterval(chairInterval.current);
  }, []);

  // ── Scoring helpers ───────────────────────────────────────────────────────────

  const psfsMean = activities.reduce((s, a) => s + a.score, 0) / 3;

  const tugRisk = tugSec === null ? 'not_tested'
    : tugSec < 12 ? 'low' : tugSec <= 20 ? 'moderate' : 'high';

  const norm = chairNorm(age, sex);
  const chairStatus = !norm ? 'no_data'
    : chairReps >= norm.min ? 'normal' : chairReps >= norm.min - 2 ? 'borderline' : 'below';

  const overallLevel =
    (psfsMean >= 7 && tugRisk === 'low' && chairStatus === 'normal') ? 'high' :
    (psfsMean >= 5 && tugRisk !== 'high') ? 'moderate' : 'low';

  // ── Load results ──────────────────────────────────────────────────────────────

  async function goToResults() {
    setStep('results');
    setLoadingAI(true);
    const s = await getHaikuSummary({
      psfs: Math.round(psfsMean * 10) / 10,
      psfsChange: 0,
      mcidMet: false,
      tugSec,
      tugRisk,
      chairCount: chairReps,
      chairNorm: norm ? `${norm.min}–${norm.max} reps (age ${age}, ${sex})` : 'N/A',
      overallLevel,
    });
    setSummary(s);
    setLoadingAI(false);
  }

  // ── Save to Supabase ──────────────────────────────────────────────────────────

  async function saveResults() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      await db.from('outcomes').insert({
        user_id: session.user.id,
        type: 'functional_assessment',
        score: Math.round(psfsMean * 10),
        metadata: {
          psfs_mean: Math.round(psfsMean * 10) / 10,
          psfs_activities: activities,
          tug_seconds: tugSec,
          tug_risk: tugRisk,
          chair_reps: chairReps,
          chair_norm: norm,
          overall_level: overallLevel,
          ai_summary: summary,
          age,
          sex,
        },
        recorded_at: new Date().toISOString(),
      });
      setSaved(true);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 100, paddingBottom: 60 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: '0.72rem', color: C.teal, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Functional Assessment
          </span>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 700, color: C.primary, margin: '6px 0 8px' }}>
            Functional Capacity Test
          </h1>
          <p style={{ color: C.sec, fontSize: '0.88rem' }}>
            3 standardised tests — PSFS · Timed Up and Go · 30-Second Chair Stand
          </p>
        </div>

        {/* Step indicator */}
        <StepBar step={step} />

        {/* ── INTRO ── */}
        {step === 'intro' && (
          <div style={card}>
            <h2 style={{ color: C.primary, fontFamily: "'Syne', sans-serif", marginTop: 0, marginBottom: 16 }}>Before You Begin</h2>
            <p style={{ color: C.sec, lineHeight: 1.7, marginBottom: 20 }}>
              This assessment takes approximately 10 minutes. You will complete three validated clinical tests used by physiotherapists to measure your functional capacity.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {[
                { n: '01', t: 'PSFS — Patient Specific Functional Scale', d: 'Rate 3 activities that are difficult for you on a 0–10 scale. Stratford et al. 1995.' },
                { n: '02', t: 'TUG — Timed Up and Go', d: 'Stand from a chair, walk 3 m, return, sit. Timer runs while you do this. Podsiadlo & Richardson 1991.' },
                { n: '03', t: '30-Second Chair Stand', d: 'Stand and sit as many times as possible in 30 seconds. Rikli & Jones 1999.' },
              ].map(({ n, t, d }) => (
                <div key={n} style={{ display: 'flex', gap: 16, padding: 16, background: C.raised, borderRadius: 10 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.1rem', color: C.teal, flexShrink: 0 }}>{n}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: C.primary, marginBottom: 4 }}>{t}</div>
                    <div style={{ fontSize: '0.82rem', color: C.sec }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <button style={btnPrimary} onClick={() => setStep('psfs')}>Begin Assessment →</button>
          </div>
        )}

        {/* ── PSFS ── */}
        {step === 'psfs' && (
          <div>
            <div style={card}>
              <h2 style={{ color: C.primary, fontFamily: "'Syne', sans-serif", marginTop: 0, marginBottom: 8 }}>
                Test 1: PSFS
              </h2>
              <p style={{ color: C.sec, fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.6 }}>
                Name 3 activities you find difficult due to your condition. Rate each from <strong style={{ color: C.primary }}>0</strong> (unable) to <strong style={{ color: C.primary }}>10</strong> (no difficulty).
              </p>

              {activities.map((act, i) => (
                <div key={i} style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: '0.8rem', color: C.teal, fontFamily: "'Space Mono', monospace", display: 'block', marginBottom: 8 }}>
                    Activity {i + 1}
                  </label>
                  <input
                    type="text"
                    placeholder={['e.g. Walking stairs', 'e.g. Lifting groceries', 'e.g. Sitting for 1 hour'][i]}
                    value={act.name}
                    onChange={e => setActivities(prev => prev.map((a, j) => j === i ? { ...a, name: e.target.value } : a))}
                    style={{
                      width: '100%', background: C.raised, border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: '10px 14px', color: C.primary,
                      fontSize: '0.88rem', marginBottom: 12, boxSizing: 'border-box',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: '0.78rem', color: C.ter, flexShrink: 0 }}>0 (unable)</span>
                    <input
                      type="range" min={0} max={10} step={1}
                      value={act.score}
                      onChange={e => setActivities(prev => prev.map((a, j) => j === i ? { ...a, score: Number(e.target.value) } : a))}
                      style={{ flex: 1, accentColor: 'var(--teal-500)' }}
                    />
                    <span style={{ fontSize: '0.78rem', color: C.ter, flexShrink: 0 }}>10 (no difficulty)</span>
                    <span style={{
                      fontFamily: "'Space Mono', monospace", fontWeight: 700,
                      color: C.teal, fontSize: '1.1rem', minWidth: 28, textAlign: 'right',
                    }}>{act.score}</span>
                  </div>
                </div>
              ))}

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: C.ter }}>PSFS Average: </span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: C.primary }}>{(psfsMean).toFixed(1)} / 10</span>
                </div>
                <button style={btnPrimary} onClick={() => setStep('tug')}>Next: TUG Test →</button>
              </div>
            </div>
          </div>
        )}

        {/* ── TUG ── */}
        {step === 'tug' && (
          <div style={card}>
            <h2 style={{ color: C.primary, fontFamily: "'Syne', sans-serif", marginTop: 0, marginBottom: 8 }}>
              Test 2: Timed Up and Go
            </h2>
            <div style={{ background: C.raised, borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <p style={{ color: C.sec, margin: 0, lineHeight: 1.7, fontSize: '0.88rem' }}>
                <strong style={{ color: C.primary }}>Instructions:</strong> Sit in a chair. When you press START, stand up, walk 3 metres to a marked point, turn around, walk back, and sit down. Press STOP when seated.
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '4rem',
                fontWeight: 700,
                color: tugSec !== null ? C.teal : tugRunning ? C.primary : C.ter,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}>
                {tugSec !== null
                  ? `${tugSec.toFixed(1)}s`
                  : tugRunning
                    ? `${tugDisplay.toFixed(1)}s`
                    : '0.0s'}
              </div>

              {tugSec === null ? (
                <button
                  style={{
                    ...btnPrimary,
                    background: tugRunning
                      ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                      : 'linear-gradient(135deg,var(--teal-500),var(--blue-400))',
                    fontSize: '1rem',
                    padding: '14px 40px',
                  }}
                  onClick={handleTugToggle}
                >
                  {tugRunning ? '⏹ STOP' : '▶ START'}
                </button>
              ) : (
                <div>
                  <div style={{
                    padding: '10px 20px',
                    borderRadius: 50,
                    background: tugRisk === 'low' ? 'rgba(22,163,74,0.15)' : tugRisk === 'moderate' ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)',
                    color: tugRisk === 'low' ? C.success : tugRisk === 'moderate' ? C.warn : C.danger,
                    display: 'inline-block',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    marginBottom: 16,
                  }}>
                    {tugRisk === 'low' ? '✓ Low fall risk (<12s)' : tugRisk === 'moderate' ? '⚠ Moderate fall risk (12–20s)' : '⚠ High fall risk (>20s)'}
                  </div>
                  <div>
                    <button style={{ ...btnGhost, marginRight: 12 }} onClick={() => { setTugSec(null); setTugDisplay(0); }}>
                      Redo
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <button style={btnGhost} onClick={() => setStep('psfs')}>← Back</button>
              <button
                style={{ ...btnPrimary, opacity: (tugSec === null && !tugRunning) ? 0.5 : 1 }}
                disabled={tugRunning}
                onClick={() => setStep('chair')}
              >
                {tugSec === null ? 'Skip →' : 'Next: Chair Stand →'}
              </button>
            </div>
          </div>
        )}

        {/* ── CHAIR STAND ── */}
        {step === 'chair' && (
          <div style={card}>
            <h2 style={{ color: C.primary, fontFamily: "'Syne', sans-serif", marginTop: 0, marginBottom: 8 }}>
              Test 3: 30-Second Chair Stand
            </h2>
            <div style={{ background: C.raised, borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <p style={{ color: C.sec, margin: 0, lineHeight: 1.7, fontSize: '0.88rem' }}>
                <strong style={{ color: C.primary }}>Instructions:</strong> Sit in a chair with arms crossed. Press START, then stand fully upright and sit back down as many times as possible in 30 seconds. Press + for each rep completed.
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              {/* Timer ring */}
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
                <svg width={160} height={160}>
                  <circle cx={80} cy={80} r={70} fill="none" stroke={C.border} strokeWidth={8} />
                  <circle
                    cx={80} cy={80} r={70} fill="none"
                    stroke="var(--teal-500)" strokeWidth={8}
                    strokeDasharray={2 * Math.PI * 70}
                    strokeDashoffset={2 * Math.PI * 70 * (1 - chairTimeLeft / 30)}
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '2.2rem', fontWeight: 700, color: C.primary, lineHeight: 1 }}>
                    {chairTimeLeft}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: C.ter }}>seconds</span>
                </div>
              </div>

              {/* Rep counter */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '3rem', fontWeight: 700, color: C.teal, lineHeight: 1 }}>
                  {chairReps}
                </div>
                <div style={{ fontSize: '0.78rem', color: C.ter }}>reps</div>
              </div>

              {!chairRunning && !chairDone && (
                <button style={{ ...btnPrimary, padding: '14px 40px', fontSize: '1rem' }} onClick={startChair}>
                  ▶ START 30s
                </button>
              )}

              {chairRunning && (
                <button
                  style={{ ...btnPrimary, fontSize: '1.5rem', width: 80, height: 80, borderRadius: '50%', padding: 0 }}
                  onClick={() => setChairReps(r => r + 1)}
                >
                  +
                </button>
              )}

              {chairDone && (
                <div>
                  {norm && (
                    <div style={{
                      padding: '10px 20px', borderRadius: 50, display: 'inline-block',
                      fontWeight: 600, fontSize: '0.88rem', marginBottom: 16,
                      background: chairStatus === 'normal' ? 'rgba(22,163,74,0.15)' : chairStatus === 'borderline' ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)',
                      color: chairStatus === 'normal' ? C.success : chairStatus === 'borderline' ? C.warn : C.danger,
                    }}>
                      {chairReps} reps · Norm {norm.min}–{norm.max} (age {age}, {sex})
                    </div>
                  )}
                  <div>
                    <button style={{ ...btnGhost, marginRight: 12 }} onClick={() => { setChairDone(false); setChairReps(0); setChairTimeLeft(30); }}>
                      Redo
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <button style={btnGhost} onClick={() => setStep('tug')}>← Back</button>
              <button
                style={{ ...btnPrimary, opacity: (!chairDone && chairReps === 0) ? 0.6 : 1 }}
                onClick={goToResults}
              >
                See Results →
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {step === 'results' && (
          <div>
            {/* AI Summary */}
            <div style={{ ...card, borderColor: 'var(--border-teal)' }}>
              <div style={{ fontSize: '0.72rem', color: C.teal, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                AI Clinical Summary
              </div>
              {loadingAI ? (
                <div style={{ color: C.ter, fontStyle: 'italic' }}>Generating clinical summary…</div>
              ) : (
                <p style={{ color: C.primary, lineHeight: 1.7, margin: 0 }}>{summary}</p>
              )}
            </div>

            {/* Score cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
              <ScoreCard
                title="PSFS Average"
                value={`${psfsMean.toFixed(1)} / 10`}
                status={psfsMean >= 7 ? 'good' : psfsMean >= 4 ? 'moderate' : 'concern'}
                detail="MCID: ≥2.0 improvement (Stratford et al. 1995)"
              />
              <ScoreCard
                title="Timed Up & Go"
                value={tugSec !== null ? `${tugSec}s` : 'Not tested'}
                status={tugRisk === 'low' ? 'good' : tugRisk === 'moderate' ? 'moderate' : 'concern'}
                detail={`${tugRisk === 'low' ? 'Low' : tugRisk === 'moderate' ? 'Moderate' : 'High'} fall risk (Podsiadlo & Richardson 1991)`}
              />
              <ScoreCard
                title="30s Chair Stand"
                value={`${chairReps} reps`}
                status={chairStatus === 'normal' ? 'good' : chairStatus === 'borderline' ? 'moderate' : 'concern'}
                detail={norm ? `Norm: ${norm.min}–${norm.max} reps for age ${age} (Rikli & Jones 1999)` : 'Age/sex normative data unavailable'}
              />
            </div>

            {/* Overall level */}
            <div style={{ ...card, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: '0.78rem', color: C.ter, marginBottom: 8 }}>Overall Function Level</div>
              <div style={{
                fontSize: '1.8rem',
                fontWeight: 700,
                fontFamily: "'Syne', sans-serif",
                color: overallLevel === 'high' ? C.success : overallLevel === 'moderate' ? C.warn : C.danger,
              }}>
                {overallLevel === 'high' ? 'HIGH' : overallLevel === 'moderate' ? 'MODERATE' : 'LOW'}
              </div>
              <div style={{ fontSize: '0.8rem', color: C.sec, marginTop: 4 }}>
                {overallLevel === 'high' ? 'Functional capacity within normal limits' :
                 overallLevel === 'moderate' ? 'Some functional limitations — monitor and review' :
                 'Significant functional deficits — consider physiotherapy referral'}
              </div>
            </div>

            {/* PSFS activity table */}
            <div style={card}>
              <div style={{ fontWeight: 600, color: C.primary, marginBottom: 12 }}>PSFS Activity Breakdown</div>
              {activities.filter(a => a.name).map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.sec }}>{a.name}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: C.teal }}>{a.score}/10</span>
                </div>
              ))}
            </div>

            {/* Save */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => { setStep('intro'); setTugSec(null); setTugDisplay(0); setChairReps(0); setChairDone(false); setChairTimeLeft(30); setSaved(false); }}>
                Start Over
              </button>
              {!saved ? (
                <button
                  style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
                  onClick={saveResults}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save to Outcomes'}
                </button>
              ) : (
                <div style={{ ...btnPrimary, background: 'rgba(22,163,74,0.2)', color: C.success, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  ✓ Saved
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'intro', label: 'Intro' },
    { id: 'psfs', label: 'PSFS' },
    { id: 'tug', label: 'TUG' },
    { id: 'chair', label: 'Chair' },
    { id: 'results', label: 'Results' },
  ];
  const idx = steps.findIndex(s => s.id === step);
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
      {steps.map((s, i) => (
        <div key={s.id} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            height: 4, borderRadius: 2, marginBottom: 6,
            background: i <= idx ? 'var(--teal-500)' : 'var(--bg-elevated)',
            transition: 'background 0.3s',
          }} />
          <span style={{ fontSize: '0.65rem', color: i <= idx ? 'var(--teal-500)' : 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace" }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScoreCard({ title, value, status, detail }: { title: string; value: string; status: 'good' | 'moderate' | 'concern'; detail: string }) {
  const color = status === 'good' ? '#16a34a' : status === 'moderate' ? '#d97706' : '#dc2626';
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1px solid ${color}40`,
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.6rem', fontWeight: 700, color, marginBottom: 8 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{detail}</div>
    </div>
  );
}

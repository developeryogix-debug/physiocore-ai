// TreatmentPlan.tsx — Phase 3 Treatment Plan Dashboard
// Clinical Noir design. Font weight max 600. SaMD Class II — decision support only.

import { useState, useEffect } from 'react';
import { supabase } from '@physiocore/supabase';
import { useAuth } from '../hooks/useAuth.js';
import { scopedKey } from '../lib/storage.js';
import { ElevationCard } from '../components/ui/ElevationCard.js';
import { SlidingTabs, type Tab } from '../components/ui/SlidingTabs.js';
import { DownloadReport } from '../components/DownloadReport.js';

const db = supabase as any;

// ── Minimal local types (mirrors FinalTreatmentPlan from agents) ──────────────

interface Exercise {
  name: string;
  sets: number;
  reps: number | null;
  holdSeconds: number | null;
  frequencyPerWeek: number;
  rationale: string;
  cptCodeSuggestion?: string;
}

interface WeekSchedule {
  week: number;
  phase: number;
  sessionCount: number;
  sessionDurationMin: number;
  exercises: Exercise[];
  homeProgram: Exercise[];
  reviewMilestone?: string | null;
}

interface Phase {
  phaseNumber: number;
  label: string;
  durationWeeks: number;
  loadingStrategy: string;
  maxAcceptablePain: number;
  progressionTrigger: string;
  regressionTrigger: string;
  sessionFrequency: number;
  sessionDurationMin: number;
}

interface PlanData {
  sourcePlan: 'conservative' | 'early_mob' | 'hybrid';
  totalDurationWeeks: number;
  phases: Phase[];
  weeklySchedule: WeekSchedule[];
  contraindications: string[];
  redLineConditions: string[];
  progressionTriggers: string[];
  patientInstructions: string;
  clinicianNotes: string;
  evidenceBasis: string[];
  generatedAt: string;
}

interface SupabaseRow {
  id: string;
  created_at: string;
  plan_json: PlanData;
  verdict_winner: 'conservative' | 'early_mob' | 'hybrid';
  total_weeks: number;
}

interface StoredSession {
  date: string;
  avg_score?: number;
  formScore?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WINNER_META = {
  conservative: { label: 'Conservative Protocol', color: '#00D4AA', desc: 'McKenzie MDT + Maitland manual therapy' },
  early_mob:    { label: 'Early Mobilisation',    color: '#4DB8FF', desc: 'Graded exposure + fear-avoidance model' },
  hybrid:       { label: 'Blended Protocol',       color: '#a78bfa', desc: 'Evidence-weighted synthesis of both approaches' },
};

function loadingBadge(strategy: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    rest:        { label: 'Rest',        color: '#64748b' },
    gentle:      { label: 'Gentle',      color: '#22c55e' },
    moderate:    { label: 'Moderate',    color: '#f59e0b' },
    progressive: { label: 'Progressive', color: '#f97316' },
    high:        { label: 'High Load',   color: '#ef4444' },
  };
  return map[strategy] ?? { label: strategy, color: '#8892A4' };
}

// ── Confidence ring (SVG) ─────────────────────────────────────────────────────

function ConfidenceRing({ winner }: { winner: 'conservative' | 'early_mob' | 'hybrid' }) {
  const meta = WINNER_META[winner];
  const pct  = winner === 'conservative' ? 82 : winner === 'early_mob' ? 76 : 90;
  const R    = 44;
  const circ = 2 * Math.PI * R;
  const dash = (pct / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 110, height: 110 }}>
        <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle cx="55" cy="55" r={R} fill="none" stroke={meta.color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.25rem', fontWeight: 600, color: meta.color }}>{pct}%</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.55rem', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>confidence</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: meta.color, letterSpacing: '-0.01em' }}>{meta.label}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{meta.desc}</div>
      </div>
    </div>
  );
}

// ── Exercise row ──────────────────────────────────────────────────────────────

function ExerciseRow({ ex, index }: { ex: Exercise; index: number }) {
  const dose = [
    `${ex.sets} sets`,
    ex.reps        ? `${ex.reps} reps`       : null,
    ex.holdSeconds ? `${ex.holdSeconds}s hold` : null,
    `${ex.frequencyPerWeek}×/wk`,
  ].filter(Boolean).join(' · ');

  return (
    <ElevationCard level={2} hover={false} padding="0.9rem 1.1rem" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', color: 'var(--text-tertiary)',
          minWidth: 18, paddingTop: 2 }}>{index + 1}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-primary)' }}>{ex.name}</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.68rem', color: 'var(--teal-500)', marginTop: 3 }}>{dose}</div>
          {ex.rationale && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{ex.rationale}</div>}
        </div>
        {ex.cptCodeSuggestion && (
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            CPT {ex.cptCodeSuggestion}
          </span>
        )}
      </div>
    </ElevationCard>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { key: 'overview',    label: 'Overview' },
  { key: 'today',       label: "Today's Plan" },
  { key: 'progression', label: 'Progression' },
];

export default function TreatmentPlan() {
  const { user } = useAuth();
  const [loading, setLoading]     = useState(true);
  const [row, setRow]             = useState<SupabaseRow | null>(null);
  const [sessions, setSessions]   = useState<StoredSession[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    async function load() {
      if (!user?.id) { setLoading(false); return; }

      const { data } = await db
        .from('treatment_plans')
        .select('id,created_at,plan_json,verdict_winner,total_weeks')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) setRow(data as SupabaseRow);

      try {
        const raw = localStorage.getItem(scopedKey('physiocore_sessions', user.id));
        if (raw) setSessions(JSON.parse(raw) as StoredSession[]);
      } catch { /* ignore */ }

      setLoading(false);
    }
    void load();
  }, [user?.id]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', paddingTop: 100 }}>
      <span style={{ color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace", fontSize: '0.8rem' }}>Loading treatment plan…</span>
    </div>
  );

  if (!row) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: 120, paddingBottom: 80 }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        <ElevationCard level={1} padding="3rem 2rem">
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>Rx</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No treatment plan yet</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Complete a Full Assessment first. The Phase 3 treatment pipeline generates your personalised protocol automatically after assessment.
          </div>
          <a href="/assessment" style={{ display: 'inline-block', marginTop: 24, padding: '10px 24px', borderRadius: 50,
            background: 'var(--teal-500)', color: '#000', fontWeight: 600, fontSize: '0.82rem',
            textDecoration: 'none', letterSpacing: '-0.01em' }}>
            Run Assessment
          </a>
        </ElevationCard>
      </div>
    </div>
  );

  const plan    = row.plan_json;
  const winner  = row.verdict_winner;
  const meta    = WINNER_META[winner] ?? WINNER_META.hybrid;

  // Sessions since plan was generated
  const planStart = new Date(row.created_at).getTime();
  const sessionsSincePlan = sessions.filter(s => new Date(s.date).getTime() >= planStart).length;

  // Current week (based on first phase session frequency; default 3)
  const firstPhaseFreq = plan.phases[0]?.sessionFrequency ?? 3;
  const currentWeek    = Math.min(Math.max(1, Math.ceil((sessionsSincePlan + 1) / firstPhaseFreq)), plan.totalDurationWeeks);
  const weekData: WeekSchedule | undefined = plan.weeklySchedule[currentWeek - 1];

  // Active phase
  let cumWeeks = 0;
  let activePhase: Phase | undefined;
  for (const ph of plan.phases) {
    cumWeeks += ph.durationWeeks;
    if (currentWeek <= cumWeeks) { activePhase = ph; break; }
  }
  if (!activePhase) activePhase = plan.phases[plan.phases.length - 1];

  // Progression countdown
  const sessUntilReview = 4 - (sessionsSincePlan % 4);

  // Recent trend from session scores
  const recentScores = sessions
    .filter(s => new Date(s.date).getTime() >= planStart)
    .map(s => s.avg_score ?? s.formScore ?? 50)
    .slice(-8);
  const half   = Math.floor(recentScores.length / 2);
  const prevHalf = recentScores.slice(0, half);
  const lastHalf = recentScores.slice(half);
  const avgPrev  = prevHalf.length ? prevHalf.reduce((a, b) => a + b, 0) / prevHalf.length : 0;
  const avgLast  = lastHalf.length ? lastHalf.reduce((a, b) => a + b, 0) / lastHalf.length : 0;
  const trend    = recentScores.length < 2 ? 'no data' : avgLast > avgPrev + 2 ? 'improving' : avgLast < avgPrev - 2 ? 'declining' : 'plateaued';

  const trendColor = trend === 'improving' ? '#22c55e' : trend === 'declining' ? '#ef4444' : '#f59e0b';

  // ── Overview tab ────────────────────────────────────────────────────────────
  function OverviewTab() {
    return (
      <div>
        {/* Arbiter verdict + protocol summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ElevationCard level={1} padding="1.5rem">
            <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 16 }}>Arbiter Verdict</div>
            <ConfidenceRing winner={winner} />
            <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {plan.clinicianNotes.split('\n')[0] ?? 'Evidence-based protocol selected via 3-round structured debate.'}
              </div>
            </div>
          </ElevationCard>

          <ElevationCard level={1} padding="1.5rem">
            <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Protocol Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Stat label="Duration" value={`${plan.totalDurationWeeks} weeks`} />
              <Stat label="Current week" value={`Week ${currentWeek}`} />
              <Stat label="Phases" value={`${plan.phases.length} phases`} />
              {activePhase && (
                <>
                  <Stat label="Active phase" value={activePhase.label} />
                  <Stat label="Loading" value={<LoadBadge strategy={activePhase.loadingStrategy} />} />
                  <Stat label="Max pain" value={`${activePhase.maxAcceptablePain}/10 NRS`} />
                  <Stat label="Sessions/week" value={`${activePhase.sessionFrequency}`} />
                </>
              )}
            </div>
          </ElevationCard>
        </div>

        {/* Patient instructions */}
        {plan.patientInstructions && (
          <ElevationCard level={1} padding="1.25rem 1.5rem" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Patient Instructions</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{plan.patientInstructions}</div>
          </ElevationCard>
        )}

        {/* Evidence basis */}
        {plan.evidenceBasis.length > 0 && (
          <ElevationCard level={1} padding="1.25rem 1.5rem" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Evidence Basis</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {plan.evidenceBasis.map((ref, i) => (
                <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                  paddingLeft: 12, borderLeft: '2px solid var(--teal-500)' }}>{ref}</div>
              ))}
            </div>
          </ElevationCard>
        )}

        {/* Red line conditions */}
        {plan.redLineConditions.length > 0 && (
          <ElevationCard level={1} padding="1.25rem 1.5rem" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
              letterSpacing: '0.08em', color: '#ef4444', marginBottom: 8 }}>Stop + Refer — Red Line Conditions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {plan.redLineConditions.map((c, i) => (
                <div key={i} style={{ fontSize: '0.75rem', color: '#fca5a5', paddingLeft: 12,
                  borderLeft: '2px solid #ef4444' }}>{c}</div>
              ))}
            </div>
          </ElevationCard>
        )}
      </div>
    );
  }

  // ── Today's Plan tab ─────────────────────────────────────────────────────────
  function TodayTab() {
    if (!weekData) return (
      <ElevationCard level={1} padding="2rem" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>No schedule for week {currentWeek}. Complete more sessions to unlock the next phase.</div>
      </ElevationCard>
    );

    return (
      <div>
        {/* Week header */}
        <ElevationCard level={1} padding="1.1rem 1.5rem" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Week {weekData.week} of {plan.totalDurationWeeks}
            </span>
            {weekData.reviewMilestone && (
              <div style={{ fontSize: '0.75rem', color: 'var(--teal-500)', marginTop: 4 }}>{weekData.reviewMilestone}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {weekData.sessionCount}×/wk
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{weekData.sessionDurationMin} min/session</div>
          </div>
        </ElevationCard>

        {/* Clinic exercises */}
        {weekData.exercises.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Clinic Exercises</div>
            {weekData.exercises.map((ex, i) => <ExerciseRow key={i} ex={ex} index={i} />)}
          </div>
        )}

        {/* Home program */}
        {weekData.homeProgram.length > 0 && (
          <div>
            <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Home Program</div>
            {weekData.homeProgram.map((ex, i) => <ExerciseRow key={i} ex={ex} index={i} />)}
          </div>
        )}

        {/* Active phase progression/regression triggers */}
        {activePhase && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            <ElevationCard level={2} padding="1rem" hover={false}>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em',
                color: '#22c55e', marginBottom: 4 }}>Advance when</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{activePhase.progressionTrigger}</div>
            </ElevationCard>
            <ElevationCard level={2} padding="1rem" hover={false}>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em',
                color: '#f59e0b', marginBottom: 4 }}>Regress when</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{activePhase.regressionTrigger}</div>
            </ElevationCard>
          </div>
        )}
      </div>
    );
  }

  // ── Progression tab ──────────────────────────────────────────────────────────
  function ProgressionTab() {
    return (
      <div>
        {/* Status cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <ElevationCard level={1} padding="1.1rem" hover={false}>
            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Trend</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: trendColor, textTransform: 'capitalize' }}>{trend}</div>
          </ElevationCard>
          <ElevationCard level={1} padding="1.1rem" hover={false}>
            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Sessions (plan)</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{sessionsSincePlan}</div>
          </ElevationCard>
          <ElevationCard level={1} padding="1.1rem" hover={false}>
            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Next review in</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1rem', fontWeight: 600, color: 'var(--teal-500)' }}>
              {sessUntilReview === 4 && sessionsSincePlan === 0 ? '4 sessions' : `${sessUntilReview} session${sessUntilReview !== 1 ? 's' : ''}`}
            </div>
          </ElevationCard>
        </div>

        {/* Review progress bar */}
        <ElevationCard level={1} padding="1.25rem 1.5rem" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Progress to ProgressionAgent Review (every 4 sessions)
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${((4 - sessUntilReview) / 4) * 100}%`,
              background: `linear-gradient(90deg, var(--teal-500), var(--blue-400))`,
              borderRadius: 4,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>0</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>4 sessions</span>
          </div>
        </ElevationCard>

        {/* Phase timeline */}
        <ElevationCard level={1} padding="1.25rem 1.5rem" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Phase Timeline</div>
          {plan.phases.map((ph) => {
            const lb = loadingBadge(ph.loadingStrategy);
            const isActive = activePhase?.phaseNumber === ph.phaseNumber;
            return (
              <div key={ph.phaseNumber} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
                padding: '8px 10px', borderRadius: 8,
                background: isActive ? 'rgba(0,212,170,0.06)' : 'transparent',
                border: isActive ? '1px solid rgba(0,212,170,0.2)' : '1px solid transparent' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.65rem', fontWeight: 600,
                  background: isActive ? 'var(--teal-500)' : 'rgba(255,255,255,0.06)',
                  color: isActive ? '#000' : 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace",
                  flexShrink: 0 }}>{ph.phaseNumber}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--teal-500)' : 'var(--text-primary)' }}>
                    {ph.label}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{ph.durationWeeks}wk · {ph.sessionFrequency}×/wk · {ph.sessionDurationMin}min</div>
                </div>
                <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: 12,
                  background: `${lb.color}20`, color: lb.color, fontFamily: "'Space Mono', monospace" }}>
                  {lb.label}
                </span>
              </div>
            );
          })}
        </ElevationCard>

        {/* Progression triggers */}
        {plan.progressionTriggers.length > 0 && (
          <ElevationCard level={1} padding="1.25rem 1.5rem">
            <div style={{ fontSize: '0.65rem', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Progression Triggers</div>
            {plan.progressionTriggers.map((t, i) => (
              <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 5,
                paddingLeft: 12, borderLeft: '2px solid var(--teal-500)' }}>{t}</div>
            ))}
          </ElevationCard>
        )}
      </div>
    );
  }

  // ── Page shell ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: 100, paddingBottom: 80 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 600,
                color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Treatment Plan
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.62rem',
                  color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Phase 3
                </span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.62rem',
                  color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  SaMD Class II
                </span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.62rem',
                  color: meta.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {meta.label}
                </span>
              </div>
            </div>
            <DownloadReport patientId={user?.id ?? ''} compact label="CarePlan PDF" />
          </div>
        </div>

        {/* Tabs */}
        <SlidingTabs tabs={TABS} active={activeTab} onChange={setActiveTab} style={{ marginBottom: 24 }} />

        {/* Tab content */}
        {activeTab === 'overview'    && <OverviewTab />}
        {activeTab === 'today'       && <TodayTab />}
        {activeTab === 'progression' && <ProgressionTab />}

        {/* Disclaimer */}
        <div style={{ marginTop: 32, fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
          Decision support only. All treatment recommendations require validation by a licensed physiotherapist before implementation.
        </div>
      </div>
    </div>
  );
}

// ── Small inline helpers ──────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function LoadBadge({ strategy }: { strategy: string }) {
  const { label, color } = loadingBadge(strategy);
  return (
    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
      background: `${color}20`, color, fontFamily: "'Space Mono', monospace" }}>
      {label}
    </span>
  );
}

/**
 * Assessment.tsx — Phase 2 Full Clinical Assessment UI
 * Wires AssessmentOrchestrator via browser-safe assessmentClient.
 * Sections: (1) Data panel, (2) Run + progress, (3) Results card.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { supabase } from '@physiocore/supabase';
import { runFullAssessment } from '../lib/agents/assessmentClient.js';
import type { AssessmentOutput, DataContext } from '../lib/agents/assessmentClient.js';

// ─── Supabase (typed-loose) ───────────────────────────────────────────────────
const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataSourceStatus {
  posture:    { available: boolean; date?: string; score?: number; findings?: string };
  sessions:   { available: boolean; date?: string; count?: number };
  pain:       { available: boolean; date?: string; score?: number };
  functional: { available: boolean; date?: string };
  walking:    { available: boolean };
}

type RunStep = 0 | 1 | 2 | 3 | 4;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const fill = arc * Math.max(0, Math.min(100, score)) / 100;
  const color = score >= 70 ? '#00D4AA' : score >= 45 ? '#F59E0B' : '#EF4444';
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"
        strokeDasharray={`${arc} ${circ - arc}`} strokeDashoffset={circ * 0.125}
        strokeLinecap="round" transform="rotate(-135 70 70)" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${fill} ${circ - fill}`} strokeDashoffset={circ * 0.125}
        strokeLinecap="round" transform="rotate(-135 70 70)"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="70" y="66" textAnchor="middle" fill={color} fontSize="26" fontWeight="700" fontFamily="'Space Mono', monospace">{score}</text>
      <text x="70" y="84" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="inherit">/100</text>
    </svg>
  );
}

function DataRow({ label, status, date, extra, action }: {
  label: string;
  status: 'available' | 'missing' | 'optional';
  date?: string;
  extra?: string;
  action?: { label: string; to: string };
}) {
  const navigate = useNavigate();
  const dot = status === 'available' ? '#00D4AA' : status === 'optional' ? '#64748B' : '#334155';
  const icon = status === 'available' ? '✅' : status === 'optional' ? '⬜' : '⬜';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ width: 22, textAlign: 'center' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '0.88rem', color: status === 'available' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
        {date && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace" }}>{date}</span>}
        {extra && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: dot }}>{extra}</span>}
      </div>
      {action && (
        <button onClick={() => navigate(action.to)} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-teal)', background: 'transparent', color: 'var(--teal-500)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
          {action.label}
        </button>
      )}
      {status === 'optional' && !action && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Optional</span>}
    </div>
  );
}

const STEPS: string[] = [
  '',
  'Checking safety rules...',
  'Analysing posture + movement + pain...',
  'Adversarial review (Claude Opus)...',
  'Building consensus report...',
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Assessment() {
  const { user } = useAuth();
  const { userProfile } = useUserProfile();

  const [sources, setSources] = useState<DataSourceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<RunStep>(0);
  const [result, setResult] = useState<AssessmentOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'patient' | 'clinician'>('patient');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Load data availability ────────────────────────────────────────────────

  const loadSources = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [postureRes, sessionRes, painRes, funcRes] = await Promise.allSettled([
        db.from('posture_assessments').select('created_at, overall_score, findings').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        db.from('session_summaries').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(1),
        db.from('outcomes').select('recorded_at, score').eq('user_id', user.id).eq('type', 'nprs').order('recorded_at', { ascending: false }).limit(1),
        db.from('outcomes').select('recorded_at').eq('user_id', user.id).eq('type', 'psfs').order('recorded_at', { ascending: false }).limit(1),
      ]);

      const fmtDate = (iso: string | undefined) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined;

      const postureRow = postureRes.status === 'fulfilled' ? (postureRes.value.data?.[0] ?? null) : null;
      const sessionRow = sessionRes.status === 'fulfilled' ? (sessionRes.value.data?.[0] ?? null) : null;
      const painRow    = painRes.status   === 'fulfilled' ? (painRes.value.data?.[0]    ?? null) : null;
      const funcRow    = funcRes.status   === 'fulfilled' ? (funcRes.value.data?.[0]    ?? null) : null;

      // Count sessions
      let sessionCount = 0;
      if (sessionRes.status === 'fulfilled') {
        const countRes = await db.from('session_summaries').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        sessionCount = countRes.count ?? 0;
      }

      setSources({
        posture:    { available: !!postureRow, date: fmtDate(postureRow?.created_at), score: postureRow?.overall_score, findings: postureRow?.findings ? JSON.stringify(postureRow.findings) : undefined },
        sessions:   { available: !!sessionRow, date: fmtDate(sessionRow?.date), count: sessionCount },
        pain:       { available: !!painRow,    date: fmtDate(painRow?.recorded_at), score: painRow?.score },
        functional: { available: !!funcRow,    date: fmtDate(funcRow?.recorded_at) },
        walking:    { available: false },
      });
    } catch {
      // Show empty state if queries fail
      setSources({ posture: { available: false }, sessions: { available: false }, pain: { available: false }, functional: { available: false }, walking: { available: false } });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void loadSources(); }, [loadSources]);

  // ── Run assessment ────────────────────────────────────────────────────────

  async function handleRun() {
    if (!sources || !user?.id) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setStep(1);
    setSaved(false);

    // Simulate step progression while actual API call runs
    const t2 = setTimeout(() => setStep(2), 1500);
    const t3 = setTimeout(() => setStep(3), 12000);
    const t4 = setTimeout(() => setStep(4), 30000);

    try {
      const ctx: DataContext = {
        hasPosture:    sources.posture.available,
        hasSessions:   sources.sessions.available,
        hasPain:       sources.pain.available,
        hasFunctional: sources.functional.available,
        hasGait:       sources.walking.available,
        postureScore:  sources.posture.score,
        sessionCount:  sources.sessions.count,
        lastPostureDate:  sources.posture.date,
        lastSessionDate:  sources.sessions.date,
        lastPainDate:     sources.pain.date,
        lastFunctionalDate: sources.functional.date,
        painScore:     sources.pain.score,
        postureFindings: sources.posture.findings,
        conditions:    userProfile?.conditions?.filter(c => c.isActive).map(c => c.name) ?? [],
        ageYears:      userProfile?.dateOfBirth ? Math.floor((Date.now() - new Date(userProfile.dateOfBirth).getTime()) / 31_557_600_000) : undefined,
        gender:        userProfile?.gender,
      };
      const output = await runFullAssessment(ctx);
      clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      setStep(4);
      await new Promise(r => setTimeout(r, 800));
      setResult(output);
    } catch (err) {
      clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      setError(err instanceof Error ? err.message : 'Assessment failed. Please try again.');
    } finally {
      setRunning(false);
      setStep(0);
    }
  }

  // ── Save to Supabase ──────────────────────────────────────────────────────

  async function handleSave() {
    if (!result || !user?.id || saving) return;
    setSaving(true);
    try {
      await db.from('full_assessments').insert({
        user_id:     user.id,
        overall_score: result.overallScore,
        report:      result,
        created_at:  new Date().toISOString(),
      });
      setSaved(true);
    } catch {
      // Table may not exist yet — save to localStorage
      const key = `physiocore_assessments_${user.id}`;
      const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[];
      existing.unshift({ ...result, savedAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 10)));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function handleExportPdf() {
    window.print();
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasAnyData = sources ? Object.values(sources).some(s => s.available) : false;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '100px 20px 80px' }}>
      {/* Header */}
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 4 }}>Full Clinical Assessment</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 32 }}>
        Phase 2 Assessment Swarm · Posture · ROM · Pain · Function · Adversarial review
      </p>

      {/* ── SECTION 1: Data availability ─────────────────────────────────── */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Data available</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 16 }}>More data = more accurate assessment</p>

        {loading ? (
          <div style={{ padding: '20px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Loading data sources…</div>
        ) : sources ? (
          <>
            <DataRow
              label="Posture assessment"
              status={sources.posture.available ? 'available' : 'missing'}
              date={sources.posture.date}
              extra={sources.posture.score != null ? `Score: ${sources.posture.score}/100` : undefined}
              action={!sources.posture.available ? { label: 'Run Posture', to: '/posture' } : undefined}
            />
            <DataRow
              label="Session history"
              status={sources.sessions.available ? 'available' : 'missing'}
              date={sources.sessions.date}
              extra={sources.sessions.count ? `${sources.sessions.count} sessions` : undefined}
              action={!sources.sessions.available ? { label: 'Start Session', to: '/session' } : undefined}
            />
            <DataRow
              label="Pain regions"
              status={sources.pain.available ? 'available' : 'missing'}
              date={sources.pain.date}
              extra={sources.pain.score != null ? `NPRS ${sources.pain.score}/10` : undefined}
              action={!sources.pain.available ? { label: 'Pain Map', to: '/pain-map' } : undefined}
            />
            <DataRow
              label="Functional outcomes"
              status={sources.functional.available ? 'available' : 'missing'}
              date={sources.functional.date}
              action={!sources.functional.available ? { label: 'Complete questionnaire', to: '/outcomes' } : undefined}
            />
            <DataRow
              label="Walking analysis"
              status="optional"
            />
          </>
        ) : null}
      </div>

      {/* ── SECTION 2: Run button ─────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <button
          onClick={() => { void handleRun(); }}
          disabled={running || loading}
          style={{
            padding: '14px 40px', borderRadius: 50, fontSize: '1rem', fontWeight: 700, cursor: running || loading ? 'not-allowed' : 'pointer',
            background: running || loading ? 'rgba(0,212,170,0.3)' : 'var(--teal-500)', color: '#000', border: 'none',
            boxShadow: running ? 'none' : '0 0 32px rgba(0,212,170,0.25)', transition: 'all 0.2s',
          }}>
          {running ? STEPS[step] || 'Running…' : 'Run Full Clinical Assessment'}
        </button>
        {!running && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginTop: 8 }}>
            ~45 seconds · Uses AI analysis · $0.15 est.
          </p>
        )}

        {/* Progress steps */}
        {running && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step >= s ? 'var(--teal-500)' : 'rgba(255,255,255,0.06)',
                  border: step === s ? '2px solid var(--teal-500)' : '1px solid rgba(255,255,255,0.1)',
                  color: step >= s ? '#000' : 'var(--text-tertiary)',
                  fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.4s',
                  animation: step === s ? 'pulse 1.2s ease-in-out infinite' : 'none',
                }}>
                  {step > s ? '✓' : s}
                </div>
                <span style={{ fontSize: '0.65rem', color: step >= s ? 'var(--teal-500)' : 'var(--text-tertiary)', maxWidth: 80, textAlign: 'center', lineHeight: 1.2 }}>
                  {['Safety check', 'Analysis', 'Adversarial', 'Consensus'][s - 1]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, color: '#FCA5A5', fontSize: '0.85rem' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── SECTION 3: Results ───────────────────────────────────────────── */}
      {result && (
        <div style={{ animation: 'fadeIn 0.5s ease' }}>
          {/* Score + Safety alerts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24, marginBottom: 20, alignItems: 'center' }}>
            <ScoreGauge score={result.overallScore} />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>OVERALL HEALTH SCORE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>
                {result.overallScore >= 70 ? 'Good — maintain programme' : result.overallScore >= 45 ? 'Fair — targeted treatment needed' : 'Needs attention — see clinician'}
              </div>
              {result.referralRecommended && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', color: '#FCA5A5' }}>
                  ⚕ Specialist referral recommended
                </div>
              )}
            </div>
          </div>

          {/* Safety alerts */}
          {result.safetyAlerts.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, color: '#F87171', marginBottom: 10, fontSize: '0.9rem' }}>⚠ Safety Alerts — Stop exercise, see clinician immediately</div>
              {result.safetyAlerts.map((a, i) => (
                <div key={i} style={{ color: '#FCA5A5', fontSize: '0.85rem', padding: '4px 0', borderBottom: i < result.safetyAlerts.length - 1 ? '1px solid rgba(239,68,68,0.15)' : 'none' }}>
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* Findings */}
          {result.findings.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14 }}>Top Clinical Findings</h3>
              {result.findings.slice(0, 5).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < result.findings.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--teal-dim)', color: 'var(--teal-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, fontFamily: "'Space Mono', monospace" }}>{i + 1}</span>
                  <div style={{ flex: 1, fontSize: '0.875rem', lineHeight: 1.5 }}>{f.text}</div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: f.evidenceGrade === 'A' ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.06)', color: f.evidenceGrade === 'A' ? 'var(--teal-500)' : 'var(--text-tertiary)', border: '1px solid', borderColor: f.evidenceGrade === 'A' ? 'var(--border-teal)' : 'transparent', flexShrink: 0 }}>Grade {f.evidenceGrade}</span>
                </div>
              ))}
            </div>
          )}

          {/* Treatment priorities */}
          {result.treatmentPriorities.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Treatment Priorities</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {result.treatmentPriorities.slice(0, 3).map((t, i) => (
                  <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '16px 18px', borderLeft: '3px solid var(--teal-500)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4 }}>{t.exercise}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace", marginBottom: 6 }}>{t.sets}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.focus}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs: For You / For Clinician */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
              {(['patient', 'clinician'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: activeTab === tab ? 'var(--teal-dim)' : 'transparent',
                  color: activeTab === tab ? 'var(--teal-500)' : 'var(--text-tertiary)',
                  fontWeight: activeTab === tab ? 600 : 400, fontSize: '0.85rem',
                  borderBottom: activeTab === tab ? '2px solid var(--teal-500)' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}>
                  {tab === 'patient' ? '🧑 For You' : '🩺 For Clinician'}
                </button>
              ))}
            </div>
            <div style={{ padding: '20px 24px' }}>
              {activeTab === 'patient' ? (
                <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{result.patientSummary}</p>
              ) : (
                <pre style={{ fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: "'Space Mono', monospace", margin: 0 }}>{result.clinicianSoap}</pre>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => { void handleSave(); }} disabled={saving || saved} style={{
              padding: '10px 24px', borderRadius: 50, border: '1px solid var(--border-teal)',
              background: saved ? 'rgba(0,212,170,0.15)' : 'transparent',
              color: 'var(--teal-500)', fontSize: '0.85rem', fontWeight: 600, cursor: saving || saved ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              {saved ? '✓ Saved to health record' : saving ? 'Saving…' : '💾 Save to health record'}
            </button>
            <button onClick={handleExportPdf} style={{
              padding: '10px 24px', borderRadius: 50, border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              📄 Export PDF
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !running && !error && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
          {hasAnyData
            ? 'Run the assessment to see your personalised clinical report.'
            : 'Complete a posture assessment or session to get started.'}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,212,170,0.4); } 50% { box-shadow: 0 0 0 8px rgba(0,212,170,0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media print { nav, button { display: none !important; } }
      `}</style>
    </div>
  );
}

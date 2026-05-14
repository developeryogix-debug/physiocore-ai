// packages/app/src/pages/Assessment.tsx
// Assessment Hub — wires to assessmentClient (browser-safe Claude call)
// Sections: (1) Data readiness, (2) Run + progress, (3) Results

import { useState, useEffect } from 'react';
import { supabase } from '@physiocore/supabase';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { runFullAssessment } from '../lib/agents/assessmentClient.js';
import type { DataContext } from '../lib/agents/assessmentClient.js';

const db = supabase as any;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataSource {
  key: string;
  label: string;
  description: string;
  available: boolean;
  lastDate?: string;
  route: string;
  context: Partial<DataContext>;
}

interface AssessmentResult {
  consensusScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'red_flag';
  safetyAlerts: string[];
  topFindings: Array<{ finding: string; evidenceGrade: string; severity: string }>;
  treatmentPriorities: Array<{ exercise: string; sets: string; focus: string }>;
  patientSummary: string;
  soapNote: string;
  safeToExercise: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_COLOR = {
  low:      { bg: '#22c55e20', text: '#22c55e', label: 'LOW RISK' },
  moderate: { bg: '#f59e0b20', text: '#f59e0b', label: 'MODERATE' },
  high:     { bg: '#ef444420', text: '#ef4444', label: 'HIGH RISK' },
  red_flag: { bg: '#ef444430', text: '#ef4444', label: '⚠ RED FLAG' },
};

const PROGRESS_STEPS = [
  '🔒 Checking safety rules...',
  '🧠 PostureAgent analysing alignment...',
  '🚶 GaitAgent reviewing movement...',
  '📐 ROMAgent measuring range...',
  '📍 PainMapAgent mapping symptoms...',
  '📊 FunctionalAgent scoring...',
  '⚖️ AdversarialAgent (Claude Opus) red-teaming...',
  '📋 ConsensusAgent building report...',
  '✅ Assessment complete',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveRiskLevel(score: number, alerts: string[]): AssessmentResult['riskLevel'] {
  if (alerts.length > 0) return 'red_flag';
  if (score >= 75) return 'low';
  if (score >= 50) return 'moderate';
  return 'high';
}

function fmt(iso?: string): string | undefined {
  return iso ? new Date(iso).toLocaleDateString('en-SG') : undefined;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Assessment() {
  const { userProfile } = useUserProfile();
  const [dataSources, setDataSources]   = useState<DataSource[]>([]);
  const [loadingData, setLoadingData]   = useState(true);
  const [running, setRunning]           = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult]             = useState<AssessmentResult | null>(null);
  const [activeTab, setActiveTab]       = useState<'patient' | 'clinician'>('patient');
  const [savedId, setSavedId]           = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  // ── Load data source availability ─────────────────────────────────────────
  useEffect(() => {
    async function checkSources() {
      setLoadingData(true);
      const userId = userProfile?.id;
      if (!userId) { setLoadingData(false); return; }

      const [posture, sessions, outcomes, gait] = await Promise.allSettled([
        db.from('posture_assessments').select('created_at,overall_score,findings_json')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(),
        db.from('physiocore_sessions').select('created_at').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(1).single(),
        db.from('outcomes').select('recorded_at,pain_score').eq('user_id', userId)
          .order('recorded_at', { ascending: false }).limit(1).single(),
        db.from('physiocore_sessions').select('created_at').eq('user_id', userId)
          .eq('exercise_type', 'gait').order('created_at', { ascending: false }).limit(1).single(),
      ]);

      const postureRow  = posture.status  === 'fulfilled' ? posture.value.data  : null;
      const sessionRow  = sessions.status === 'fulfilled' ? sessions.value.data : null;
      const outcomeRow  = outcomes.status === 'fulfilled' ? outcomes.value.data : null;
      const gaitRow     = gait.status     === 'fulfilled' ? gait.value.data     : null;

      // Count sessions
      let sessionCount = 0;
      if (sessionRow) {
        const { count } = await db.from('physiocore_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        sessionCount = count ?? 0;
      }

      setDataSources([
        {
          key: 'posture',
          label: 'Posture Assessment',
          description: '4-view postural capture with grid analysis',
          available: !!postureRow,
          lastDate: fmt(postureRow?.created_at),
          route: '/posture',
          context: {
            hasPosture: !!postureRow,
            lastPostureDate: fmt(postureRow?.created_at),
            postureScore: postureRow?.overall_score,
            postureFindings: postureRow?.findings_json
              ? JSON.stringify(postureRow.findings_json) : undefined,
          },
        },
        {
          key: 'sessions',
          label: 'Exercise Sessions',
          description: 'ROM + movement data from tracked sessions',
          available: !!sessionRow,
          lastDate: fmt(sessionRow?.created_at),
          route: '/session',
          context: {
            hasSessions: !!sessionRow,
            lastSessionDate: fmt(sessionRow?.created_at),
            sessionCount,
          },
        },
        {
          key: 'pain',
          label: 'Pain Map',
          description: 'Self-reported pain regions and qualities',
          available: !!outcomeRow,
          lastDate: fmt(outcomeRow?.recorded_at),
          route: '/pain-map',
          context: {
            hasPain: !!outcomeRow,
            lastPainDate: fmt(outcomeRow?.recorded_at),
            painScore: outcomeRow?.pain_score,
          },
        },
        {
          key: 'gait',
          label: 'Gait Analysis',
          description: 'Walking pattern and symmetry data',
          available: !!gaitRow,
          lastDate: fmt(gaitRow?.created_at),
          route: '/session',
          context: { hasGait: !!gaitRow },
        },
      ]);
      setLoadingData(false);
    }
    checkSources();
  }, [userProfile]);

  const availableCount = dataSources.filter(d => d.available).length;

  // ── Run Assessment ─────────────────────────────────────────────────────────
  async function runAssessment() {
    if (availableCount === 0 || !userProfile) return;
    setRunning(true);
    setProgressStep(0);
    setResult(null);
    setError(null);

    for (let i = 0; i < PROGRESS_STEPS.length - 1; i++) {
      await new Promise(r => setTimeout(r, i === 6 ? 4000 : 1800));
      setProgressStep(i + 1);
    }

    try {
      const ctx: DataContext = Object.assign(
        {
          hasPosture: false, hasSessions: false, hasPain: false,
          hasFunctional: false, hasGait: false,
          conditions: userProfile.conditions?.map(c => c.name) ?? [],
          ageYears: userProfile.dateOfBirth
            ? Math.floor((Date.now() - new Date(userProfile.dateOfBirth).getTime()) / 31557600000)
            : undefined,
          gender: userProfile.gender,
        },
        ...dataSources.map(s => s.context),
      );

      const output = await runFullAssessment(ctx);

      const mapped: AssessmentResult = {
        consensusScore:     output.overallScore,
        riskLevel:          deriveRiskLevel(output.overallScore, output.safetyAlerts),
        safetyAlerts:       output.safetyAlerts,
        topFindings:        output.findings.map(f => ({
          finding:       f.text,
          evidenceGrade: f.evidenceGrade,
          severity:      output.overallScore >= 75 ? 'normal' : output.overallScore >= 50 ? 'mild' : 'moderate',
        })),
        treatmentPriorities: output.treatmentPriorities,
        patientSummary:      output.patientSummary,
        soapNote:            output.clinicianSoap,
        safeToExercise:      !output.referralRecommended && output.safetyAlerts.length === 0,
      };

      const { data: saved } = await db.from('full_assessments').insert({
        user_id:              userProfile.id,
        session_id:           crypto.randomUUID(),
        result_json:          output,
        safety_alerts_count:  output.safetyAlerts.length,
        approved:             mapped.safeToExercise,
      }).select('id').single();

      if (saved) setSavedId(saved.id);
      setResult(mapped);
      setProgressStep(PROGRESS_STEPS.length - 1);
    } catch (err) {
      console.error('Assessment error:', err);
      setError('Assessment failed. Please try again.');
    } finally {
      setRunning(false);
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    padding: '1.25rem',
    border: '1px solid #1a2535',
  } as const;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', color: 'var(--text-primary)', paddingTop: 100, paddingBottom: 60 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--teal-500)' }}>
            Full Clinical Assessment
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
            AI assessment swarm · 6 agents · Evidence-based · SaMD Class II
          </p>
        </div>

        {/* SECTION 1 — Data Sources */}
        <div style={{ ...card, marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Data Sources</h2>
          {loadingData ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Checking your health data...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {dataSources.map(src => (
                <div key={src.key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  background: src.available ? '#00D4AA08' : '#1a2535',
                  border: `1px solid ${src.available ? '#00D4AA30' : '#2a3448'}`,
                  borderRadius: 10, padding: '0.875rem',
                }}>
                  <span style={{ fontSize: '1.2rem', marginTop: 2 }}>{src.available ? '✅' : '⬜'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem' }}>{src.label}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>{src.description}</p>
                    {src.available && src.lastDate
                      ? <p style={{ color: 'var(--teal-500)', fontSize: '0.72rem' }}>Last: {src.lastDate}</p>
                      : <a href={src.route} style={{ color: 'var(--blue-400)', fontSize: '0.72rem', textDecoration: 'none' }}>Complete now →</a>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 2 — Run */}
        {!result && (
          <div style={{ ...card, marginBottom: '1.5rem', textAlign: 'center' }}>
            {running ? (
              <div>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1rem',
                  border: '3px solid #1a2535', borderTopColor: 'var(--teal-500)',
                  animation: 'spin 1s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ color: 'var(--teal-500)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {PROGRESS_STEPS[progressStep]}
                </p>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: '0.75rem' }}>
                  {PROGRESS_STEPS.map((_, i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: i <= progressStep ? 'var(--teal-500)' : '#2a3448',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={runAssessment}
                  disabled={availableCount === 0 || loadingData}
                  style={{
                    padding: '1rem 2.5rem', background: 'var(--teal-500)', color: '#000',
                    border: 'none', borderRadius: 12, fontWeight: 600, fontSize: '1rem',
                    cursor: availableCount === 0 ? 'not-allowed' : 'pointer',
                    opacity: availableCount === 0 ? 0.5 : 1,
                  }}
                >
                  Run Full Clinical Assessment
                </button>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                  ~45 seconds · {availableCount} of {dataSources.length} data sources ready · AI-powered
                </p>
                {availableCount === 0 && (
                  <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Complete at least one data source above to run the assessment
                  </p>
                )}
                {error && (
                  <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* SECTION 3 — Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Score + risk */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ ...card, textAlign: 'center' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', margin: '0 auto 0.75rem',
                  border: '4px solid var(--teal-500)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--teal-500)' }}>
                    {result.consensusScore}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Consensus Score</p>
              </div>
              <div style={card}>
                <div style={{
                  display: 'inline-block', padding: '0.3rem 0.8rem', borderRadius: 20,
                  background: RISK_COLOR[result.riskLevel].bg,
                  color: RISK_COLOR[result.riskLevel].text,
                  fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.5rem',
                }}>
                  {RISK_COLOR[result.riskLevel].label}
                </div>
                <p style={{ fontSize: '0.85rem', color: result.safeToExercise ? '#22c55e' : '#ef4444' }}>
                  {result.safeToExercise ? '✅ Safe to exercise' : '⚠ See clinician before exercising'}
                </p>
                {savedId && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--teal-500)', marginTop: '0.5rem' }}>
                    Saved to health record ✓
                  </p>
                )}
              </div>
            </div>

            {/* Safety alerts */}
            {result.safetyAlerts.length > 0 && (
              <div style={{ background: '#ef444415', border: '1px solid #ef444440', borderRadius: 10, padding: '1rem' }}>
                <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  ⚠ Safety Alerts
                </p>
                {result.safetyAlerts.map((a, i) => (
                  <p key={i} style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.25rem' }}>• {a}</p>
                ))}
              </div>
            )}

            {/* Top findings */}
            <div style={card}>
              <h3 style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '0.95rem' }}>Top Findings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {result.topFindings.slice(0, 5).map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                      background: f.severity === 'normal' ? '#22c55e20' : f.severity === 'mild' ? '#f59e0b20' : '#ef444420',
                      color:      f.severity === 'normal' ? '#22c55e'   : f.severity === 'mild' ? '#f59e0b'   : '#ef4444',
                    }}>{f.severity}</span>
                    <span style={{ flex: 1, fontSize: '0.85rem' }}>{f.finding}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Grade {f.evidenceGrade}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Treatment priorities */}
            <div style={card}>
              <h3 style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '0.95rem' }}>Treatment Priorities</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {result.treatmentPriorities.map((t, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 2fr',
                    gap: '0.75rem', padding: '0.75rem', background: '#1a2535', borderRadius: 8,
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.exercise}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--teal-500)' }}>{t.sets}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t.focus}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Patient / Clinician tabs */}
            <div style={card}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {(['patient', 'clinician'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: '0.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontWeight: 500, fontSize: '0.85rem',
                    background: activeTab === tab ? 'var(--teal-500)' : '#1a2535',
                    color:      activeTab === tab ? '#000' : 'var(--text-secondary)',
                  }}>
                    {tab === 'patient' ? 'For You' : 'For Clinician'}
                  </button>
                ))}
              </div>
              {activeTab === 'patient' ? (
                <p style={{ lineHeight: 1.7, fontSize: '0.9rem' }}>{result.patientSummary}</p>
              ) : (
                <pre style={{
                  fontFamily: 'Space Mono, monospace', fontSize: '0.75rem',
                  color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6,
                }}>
                  {result.soapNote}
                </pre>
              )}
            </div>

            {/* Run again */}
            <button onClick={() => { setResult(null); setProgressStep(0); setSavedId(null); }} style={{
              background: 'transparent', border: '1px solid #2a3448', borderRadius: 8,
              color: 'var(--text-secondary)', padding: '0.6rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem',
            }}>
              Run New Assessment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

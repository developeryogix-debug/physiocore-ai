import { useState } from 'react';
import type { AgentResult, ClinicalAssessment, NutritionPlan, BehaviorProfile, RetentionIntervention } from '@physiocore/types';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { assessPatient, generateNutritionPlan, analyzeBehavior } from '../hooks/useOrchestrator.js';
import type { BehaviorInput, SessionSummary } from '../lib/agents/behaviorClient.js';
import { AgentStatusCard } from '../components/AgentStatusCard.js';
import { MOCK_PROFILE } from '../lib/mockProfile.js';

const pageStyle: React.CSSProperties = { maxWidth: '960px', margin: '0 auto', padding: '100px 24px 48px' };
const headingStyle: React.CSSProperties = { fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' };
const subheadStyle: React.CSSProperties = { color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: '0.9rem' };
const primaryBtnStyle: React.CSSProperties = { padding: '10px 28px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.9rem', marginBottom: '28px', cursor: 'pointer' };
const disabledBtnStyle: React.CSSProperties = { ...primaryBtnStyle, background: '#94a3b8', cursor: 'not-allowed' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' };
const listItemStyle: React.CSSProperties = { padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' };
const interventionStyle: React.CSSProperties = { background: '#eff6ff', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '8px', fontSize: '0.875rem' };

const CHURN_COLORS: Record<string, string> = {
  low: 'var(--color-secondary)', medium: 'var(--color-warning)', high: '#f97316', critical: 'var(--color-danger)',
};

function buildMockHistory(): SessionSummary[] {
  return Array.from({ length: 20 }, (_, i) => ({
    completedAt: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 25 + Math.floor(Math.random() * 15),
    completed: i % 5 !== 4,
  }));
}

const MOCK_BEHAVIOR_INPUT: BehaviorInput = {
  sessionHistory: buildMockHistory(),
  currentStreak: 5,
  totalSessions: 42,
  averageDurationMin: 30,
  userId: MOCK_PROFILE.id,
};

interface AssessmentResult {
  clinical?: AgentResult<ClinicalAssessment>;
  nutrition?: AgentResult<NutritionPlan>;
  behavior?: AgentResult<{ profile: BehaviorProfile; interventions: RetentionIntervention[] }>;
}

export default function Assessment() {
  const { userProfile } = useUserProfile();
  const profile = userProfile ?? MOCK_PROFILE;

  const [isRunning, setIsRunning] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);

  async function handleRunAssessment() {
    setIsRunning(true);
    setAssessment(null);
    const start = Date.now();

    const [clinicalSettled, nutritionSettled, behaviorSettled] = await Promise.allSettled([
      assessPatient(profile),
      generateNutritionPlan({ goal: 'recovery', dietaryRestrictions: [] }, profile),
      Promise.resolve(analyzeBehavior({ ...MOCK_BEHAVIOR_INPUT, userId: profile.id })),
    ]);

    const ms = Date.now() - start;
    const meta = (id: string) => ({ agentId: id, agentVersion: '1.0.0', processingMs: ms });

    setAssessment({
      clinical: clinicalSettled.status === 'fulfilled'
        ? { success: true, data: clinicalSettled.value, metadata: meta('clinical-client') }
        : { success: false, error: { code: 'CLINICAL_FAILED', message: String((clinicalSettled as PromiseRejectedResult).reason), retryable: true }, metadata: meta('clinical-client') },

      nutrition: nutritionSettled.status === 'fulfilled'
        ? { success: true, data: nutritionSettled.value, metadata: meta('nutrition-client') }
        : { success: false, error: { code: 'NUTRITION_FAILED', message: String((nutritionSettled as PromiseRejectedResult).reason), retryable: true }, metadata: meta('nutrition-client') },

      behavior: behaviorSettled.status === 'fulfilled'
        ? { success: true, data: behaviorSettled.value, metadata: meta('behavior-client') }
        : { success: false, error: { code: 'BEHAVIOR_FAILED', message: String((behaviorSettled as PromiseRejectedResult).reason), retryable: true }, metadata: meta('behavior-client') },
    });

    setIsRunning(false);
  }

  const clinicalResult = assessment?.clinical;
  const nutritionResult = assessment?.nutrition;
  const behaviorProfileResult: AgentResult<BehaviorProfile> | undefined = assessment?.behavior?.success
    ? { success: true, data: assessment.behavior.data?.profile, metadata: assessment.behavior.metadata }
    : assessment?.behavior
      ? { success: false, error: assessment.behavior.error, metadata: assessment.behavior.metadata }
      : undefined;
  const interventions: RetentionIntervention[] = assessment?.behavior?.data?.interventions ?? [];

  return (
    <div style={pageStyle}>
      <h1 style={headingStyle}>Full Assessment</h1>
      <p style={subheadStyle}>
        Clinical, nutrition, and behaviour agents run in parallel for {profile.name}.
      </p>

      <button style={isRunning ? disabledBtnStyle : primaryBtnStyle} onClick={() => { void handleRunAssessment(); }} disabled={isRunning}>
        {isRunning ? 'Running agents...' : 'Run Full Assessment'}
      </button>

      {interventions.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px' }}>Retention interventions</h2>
          {interventions.map((iv, i) => (
            <div key={i} style={interventionStyle}>
              <span style={{ fontWeight: 700, marginRight: '6px', textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                P{iv.priority} · {iv.type.replace(/_/g, ' ')}
              </span>
              {iv.message}
            </div>
          ))}
        </div>
      )}

      <div style={gridStyle}>
        <AgentStatusCard<ClinicalAssessment>
          title="Clinical Assessment"
          result={clinicalResult}
          isLoading={isRunning}
          renderData={(data) => (
            <div>
              <p style={{ fontSize: '0.875rem', marginBottom: '10px' }}>
                Patient: <strong>{data.patient.name[0]?.given?.join(' ')}</strong>
                {data.referralNeeded && <span style={{ marginLeft: '8px', color: 'var(--color-danger)', fontWeight: 600 }}>· Referral recommended</span>}
              </p>
              {data.riskFactors.length > 0 && (
                <>
                  <p style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Risk factors</p>
                  {data.riskFactors.map((r, i) => (
                    <div key={i} style={listItemStyle}><strong>{r.name}</strong> — {r.description}</div>
                  ))}
                </>
              )}
              {data.clinicalRecommendations.map((r, i) => (
                <div key={i} style={listItemStyle}>
                  <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{r.category}</span>{': '}{r.recommendation}
                </div>
              ))}
            </div>
          )}
        />

        <AgentStatusCard<NutritionPlan>
          title="Nutrition Plan"
          result={nutritionResult}
          isLoading={isRunning}
          renderData={(data) => (
            <div>
              <p style={{ fontSize: '0.875rem', marginBottom: '8px' }}>
                Daily target: <strong>{data.dailyCalorieTarget} kcal</strong> · Hydration: <strong>{data.hydrationGoalMl} ml</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                Protein {data.macros.proteinG}g · Carbs {data.macros.carbsG}g · Fat {data.macros.fatG}g
              </p>
              {data.mealPlan.map((m, i) => (
                <div key={i} style={listItemStyle}>
                  <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{m.meal}</span>{': '}{m.name} — {m.calories} kcal
                </div>
              ))}
              {data.supplements.length > 0 && (
                <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Supplements: {data.supplements.map((s) => s.name).join(', ')}
                </p>
              )}
              {data.notes && <p style={{ marginTop: '8px', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>{data.notes}</p>}
            </div>
          )}
        />

        <AgentStatusCard<BehaviorProfile>
          title="Behaviour Profile"
          result={behaviorProfileResult}
          isLoading={isRunning}
          renderData={(data) => (
            <div>
              <p style={{ fontSize: '0.875rem', marginBottom: '10px' }}>
                Adherence: <strong>{data.adherenceScore}%</strong> · Streak: <strong>{data.streakDays} days</strong> · Sessions: <strong>{data.totalSessionsCompleted}</strong>
              </p>
              <p style={{ marginBottom: '10px', fontSize: '0.875rem' }}>
                Motivation style: <strong style={{ textTransform: 'capitalize' }}>{data.motivationStyle}</strong>
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Churn risk</span>
                <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.8rem', color: CHURN_COLORS[data.churnRisk.level] ?? 'var(--color-text)' }}>
                  {data.churnRisk.level}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>({Math.round(data.churnRisk.score * 100)}%)</span>
              </div>
              {data.churnRisk.factors.length > 0 && (
                <ul style={{ paddingLeft: '16px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {data.churnRisk.factors.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}

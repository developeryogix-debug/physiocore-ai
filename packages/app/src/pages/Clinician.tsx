import { useState, useEffect, type FormEvent } from 'react';
import type { MockPatient, MockSession } from '../lib/clinicianTypes.js';
import ClinicianPatientDetail from '../components/ClinicianPatientDetail.js';
import { AiChatPanel } from '../components/AiChatPanel.js';
import { useAuth } from '../hooks/useAuth.js';
import {
  getClinicianPatients,
  getProfilesByUserIds,
  getSessionsBatchForPatients,
  type ClinicianPatient,
  type PatientSessionSummary,
} from '../lib/orgApi.js';

// ─── Demo data ────────────────────────────────────────────────────────────────

function makeDate(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0] as string;
}

const DEMO_PATIENTS: MockPatient[] = [
  {
    id: 'demo-p1', name: 'Sarah Chen', age: 52, gender: 'female', dob: '1972-03-14',
    conditions: ['Knee Osteoarthritis', 'Hypertension'], medications: ['Lisinopril 10mg', 'Ibuprofen PRN'],
    goal: 'Rehabilitation', fitnessLevel: 'beginner', heightCm: 162, weightKg: 71,
    churnRisk: 'low', adherencePct: 82,
    sessions: [
      { date: makeDate(2),  exercise: 'Squat', reps: 10, formScore: 82, durationMin: 24, viewMode: 'front',      peakAngle: 115 },
      { date: makeDate(5),  exercise: 'Lunge', reps: 12, formScore: 78, durationMin: 22, viewMode: 'right side', peakAngle: 127 },
      { date: makeDate(9),  exercise: 'Squat', reps: 8,  formScore: 74, durationMin: 20, viewMode: 'front',      peakAngle: 112, flags: ['knee valgus'] },
      { date: makeDate(12), exercise: 'Lunge', reps: 10, formScore: 71, durationMin: 18, viewMode: 'front',      peakAngle: 130, flags: ['knee valgus'] },
      { date: makeDate(16), exercise: 'Squat', reps: 8,  formScore: 68, durationMin: 19, viewMode: 'front',      peakAngle: 108, flags: ['knee valgus', 'hip drop'] },
    ],
  },
  {
    id: 'demo-p2', name: 'Marcus Williams', age: 38, gender: 'male', dob: '1986-07-22',
    conditions: ['Post-ACL Reconstruction (6 months)'], medications: ['Naproxen 500mg'],
    goal: 'Strengthening', fitnessLevel: 'advanced', heightCm: 183, weightKg: 88,
    churnRisk: 'medium', adherencePct: 64,
    sessions: [
      { date: makeDate(10), exercise: 'Squat',    reps: 14, formScore: 88, durationMin: 32, viewMode: 'front',      peakAngle: 108 },
      { date: makeDate(14), exercise: 'Lunge',    reps: 12, formScore: 85, durationMin: 28, viewMode: 'right side', peakAngle: 122 },
      { date: makeDate(18), exercise: 'Squat',    reps: 10, formScore: 81, durationMin: 26, viewMode: 'front',      peakAngle: 110 },
      { date: makeDate(22), exercise: 'Deadlift', reps: 8,  formScore: 76, durationMin: 30, viewMode: 'front',      peakAngle: 95,  flags: ['back rounding'] },
    ],
  },
  {
    id: 'demo-p3', name: 'Elena Rodriguez', age: 67, gender: 'female', dob: '1957-11-05',
    conditions: ['Osteoporosis', 'Fibromyalgia', 'Type 2 Diabetes'], medications: ['Alendronate 70mg weekly', 'Metformin 500mg', 'Pregabalin 75mg'],
    goal: 'Pain management', fitnessLevel: 'beginner', heightCm: 155, weightKg: 62,
    churnRisk: 'high', adherencePct: 43,
    sessions: [
      { date: makeDate(9),  exercise: 'Tree Pose (Yoga)', reps: 0, formScore: 72, durationMin: 18, viewMode: 'front', peakAngle: 142 },
      { date: makeDate(16), exercise: 'Cat-Cow (Yoga)',   reps: 0, formScore: 68, durationMin: 15, viewMode: 'front', peakAngle: 138, flags: ['limited range'] },
      { date: makeDate(24), exercise: 'Squat',            reps: 6, formScore: 65, durationMin: 16, viewMode: 'front', peakAngle: 130, flags: ['hip drop'] },
    ],
  },
  {
    id: 'demo-p4', name: 'James Kim', age: 45, gender: 'male', dob: '1979-05-30',
    conditions: ['Herniated Disc L4-L5'], medications: ['Diclofenac gel topical'],
    goal: 'Strengthening', fitnessLevel: 'intermediate', heightCm: 175, weightKg: 82,
    churnRisk: 'low', adherencePct: 91,
    sessions: [
      { date: makeDate(1),  exercise: 'Deadlift', reps: 12, formScore: 91, durationMin: 35, viewMode: 'right side', peakAngle: 92 },
      { date: makeDate(4),  exercise: 'Deadlift', reps: 10, formScore: 89, durationMin: 33, viewMode: 'right side', peakAngle: 93 },
      { date: makeDate(7),  exercise: 'Deadlift', reps: 10, formScore: 88, durationMin: 31, viewMode: 'front',      peakAngle: 94 },
      { date: makeDate(10), exercise: 'Squat',    reps: 12, formScore: 86, durationMin: 28, viewMode: 'front',      peakAngle: 112 },
      { date: makeDate(13), exercise: 'Deadlift', reps: 8,  formScore: 84, durationMin: 30, viewMode: 'right side', peakAngle: 96 },
      { date: makeDate(17), exercise: 'Squat',    reps: 10, formScore: 82, durationMin: 27, viewMode: 'front',      peakAngle: 114 },
    ],
  },
  {
    id: 'demo-p5', name: 'Amara Osei', age: 29, gender: 'female', dob: '1995-09-18',
    conditions: ['Post-Rotator Cuff Repair (8 weeks)'], medications: ['Paracetamol 500mg PRN'],
    goal: 'Rehabilitation', fitnessLevel: 'intermediate', heightCm: 168, weightKg: 64,
    churnRisk: 'medium', adherencePct: 58,
    sessions: [
      { date: makeDate(4),  exercise: 'Shoulder Press', reps: 8, formScore: 79, durationMin: 20, viewMode: 'front',      peakAngle: 158 },
      { date: makeDate(9),  exercise: 'Shoulder Press', reps: 6, formScore: 72, durationMin: 18, viewMode: 'front',      peakAngle: 151, flags: ['elbow drift'] },
      { date: makeDate(14), exercise: 'Shoulder Press', reps: 6, formScore: 66, durationMin: 16, viewMode: 'right side', peakAngle: 143, flags: ['elbow drift', 'trunk lean'] },
    ],
  },
];

const DEMO_IDS = new Set(DEMO_PATIENTS.map(p => p.id));

const CHURN_COLORS: Record<string, { bg: string; color: string }> = {
  low:    { bg: '#dcfce7', color: '#15803d' },
  medium: { bg: '#fef9c3', color: '#92400e' },
  high:   { bg: '#fee2e2', color: '#b91c1c' },
};

// ─── Real patient builder ─────────────────────────────────────────────────────

function buildRealPatient(
  cp: ClinicianPatient,
  profile: { user_id: string; full_name: string } | undefined,
  allSessions: PatientSessionSummary[],
): MockPatient {
  const patientSessions = allSessions
    .filter(s => s.user_id === cp.patient_id)
    .slice(0, 5);

  const mockSessions: MockSession[] = patientSessions.map(s => {
    const durationMin = s.ended_at
      ? Math.round(
          (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
        )
      : 0;
    return {
      date: s.started_at.split('T')[0] ?? s.started_at,
      exercise: s.exercise_name ?? 'Session',
      reps: s.rep_count ?? 0,
      formScore: s.form_score ?? 0,
      durationMin,
      viewMode: 'front',
    };
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonthCount = patientSessions.filter(
    s => new Date(s.started_at).getTime() >= monthStart,
  ).length;
  const adherencePct = Math.min(100, Math.round((thisMonthCount / 4) * 100));
  const churnRisk: 'low' | 'medium' | 'high' =
    adherencePct >= 75 ? 'low' : adherencePct >= 40 ? 'medium' : 'high';

  const conditions = cp.profile?.conditions
    ? cp.profile.conditions.split(',').map(c => c.trim()).filter(Boolean)
    : [];

  return {
    id: cp.patient_id,
    name: profile?.full_name ?? cp.profile?.full_name ?? `Patient ${cp.patient_id.slice(0, 8)}`,
    age: 0,
    gender: 'male',
    dob: '',
    conditions,
    medications: [],
    goal: cp.profile?.goals ?? 'Rehabilitation',
    fitnessLevel: 'intermediate',
    heightCm: 170,
    weightKg: 70,
    churnRisk,
    adherencePct,
    sessions: mockSessions,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const muted: React.CSSProperties = { color: '#64748b', fontSize: '0.875rem' };

export default function Clinician() {
  const { user, orgId } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const [dbPatients, setDbPatients] = useState<ClinicianPatient[]>([]);
  const [realPatients, setRealPatients] = useState<MockPatient[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    void getClinicianPatients(user.id).then(async cp => {
      setDbPatients(cp);
      if (cp.length === 0) { setLoadingDb(false); return; }
      const ids = cp.map(p => p.patient_id);
      const [profiles, sessions] = await Promise.all([
        getProfilesByUserIds(ids),
        getSessionsBatchForPatients(ids),
      ]);
      setRealPatients(cp.map(p =>
        buildRealPatient(p, profiles.find(pr => pr.user_id === p.patient_id), sessions),
      ));
      setLoadingDb(false);
    });
  }, [user]);

  async function handleInvitePatient(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setInviteSending(true);
    setInviteMsg('');
    try {
      const res = await fetch('/api/invite-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          orgId: orgId ?? '',
          clinicianId: user.id,
          patientName: inviteName || undefined,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setInviteMsg(json.error ?? 'Failed to send invite. Try again.');
      } else {
        setInviteMsg('Invite sent! Patient will receive an email with their login link.');
        setInviteEmail('');
        setInviteName('');
      }
    } catch {
      setInviteMsg('Network error. Check your connection and try again.');
    }
    setInviteSending(false);
  }

  const inputSt: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' as const };

  function avgScore(p: MockPatient) {
    return p.sessions.length ? Math.round(p.sessions.reduce((s, x) => s + x.formScore, 0) / p.sessions.length) : 0;
  }

  function scoreTrend(p: MockPatient) {
    if (p.sessions.length < 2) return '→';
    const first = p.sessions[p.sessions.length - 1]?.formScore ?? 0;
    const last  = p.sessions[0]?.formScore ?? 0;
    return last > first ? '↑' : last < first ? '↓' : '→';
  }

  // Combined list: real patients first, then demo
  const allPatients = [...realPatients, ...DEMO_PATIENTS];

  const totalSessions  = allPatients.reduce((s, p) => s + p.sessions.length, 0);
  const avgAdherence   = allPatients.length
    ? Math.round(allPatients.reduce((s, p) => s + p.adherencePct, 0) / allPatients.length) : 0;
  const highRiskCount  = allPatients.filter(p => p.churnRisk === 'high').length;
  const avgFormScore   = allPatients.length
    ? Math.round(allPatients.reduce((s, p) => s + avgScore(p), 0) / allPatients.length) : 0;

  const selPatient = selected ? (allPatients.find(p => p.id === selected) ?? null) : null;

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '100px 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: 4 }}>Clinician Mode</h1>
          <p style={{ ...muted, marginTop: 2 }}>Patient deep dives · SOAP notes · HEP generator · FHIR R4 · AI transparency</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 99, padding: '5px 14px', fontSize: '0.78rem', fontWeight: 600, color: '#1e40af' }}>
            👨‍⚕️ Clinician Mode Active
          </div>
          <button onClick={() => setShowInvite(true)} className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
            + Invite Patient
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Patients',         value: loadingDb ? '…' : allPatients.length.toString(), sub: 'total' },
          { label: 'Sessions',         value: totalSessions.toString(),      sub: 'logged' },
          { label: 'Avg Adherence',    value: `${avgAdherence}%`,           sub: 'this cohort' },
          { label: 'High-Risk',        value: highRiskCount.toString(),      sub: 'need attention', warn: highRiskCount > 0 },
          { label: 'Avg Form Score',   value: `${avgFormScore}/100`,         sub: 'across sessions' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${s.warn ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '1.25rem', color: s.warn ? '#b91c1c' : '#0f172a' }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      {loadingDb && (
        <div style={{ ...muted, fontSize: '0.8rem', marginBottom: 16 }}>Loading patients…</div>
      )}

      {/* Real patients count */}
      {!loadingDb && realPatients.length > 0 && (
        <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0369a1', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
          {realPatients.length} real patient{realPatients.length !== 1 ? 's' : ''} · {DEMO_PATIENTS.length} demo
        </p>
      )}

      {/* Patient list — real first, then demo */}
      <div>
        {allPatients.map(p => {
          const isOpen  = selected === p.id;
          const isDemo  = DEMO_IDS.has(p.id);
          const cr      = CHURN_COLORS[p.churnRisk] ?? CHURN_COLORS['low']!;
          const avg     = avgScore(p);
          const trend   = scoreTrend(p);
          return (
            <div key={p.id} style={{ marginBottom: 4 }}>
              <div
                onClick={() => setSelected(isOpen ? null : p.id)}
                style={{
                  background: isOpen ? '#fafafe' : '#fff',
                  border: `1px solid ${isOpen ? '#6366f1' : '#e2e8f0'}`,
                  borderRadius: isOpen ? '12px 12px 0 0' : 12,
                  padding: '14px 20px', cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: isOpen ? '#6366f1' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1rem', color: isOpen ? '#fff' : '#475569', flexShrink: 0 }}>
                      {p.name[0]}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.name}</span>
                        {isDemo && (
                          <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#9333ea', background: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>DEMO</span>
                        )}
                      </div>
                      <div style={{ ...muted, fontSize: '0.78rem' }}>
                        {p.age > 0 ? `${p.age}y ${p.gender} · ` : ''}{p.conditions.length > 0 ? p.conditions.join(', ') : '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, color: '#0369a1' }}>{p.sessions.length}</div>
                      <div style={{ ...muted, fontSize: '0.7rem' }}>sessions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, color: p.adherencePct >= 80 ? '#15803d' : p.adherencePct >= 60 ? '#92400e' : '#b91c1c' }}>{p.adherencePct}%</div>
                      <div style={{ ...muted, fontSize: '0.7rem' }}>adherence</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, color: avg >= 80 ? '#15803d' : avg >= 65 ? '#92400e' : '#b91c1c' }}>
                        {avg} <span style={{ color: trend === '↑' ? '#22c55e' : trend === '↓' ? '#ef4444' : '#94a3b8', fontSize: '1rem' }}>{trend}</span>
                      </div>
                      <div style={{ ...muted, fontSize: '0.7rem' }}>avg score</div>
                    </div>
                    <span style={{ ...cr, borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' as const }}>
                      {p.churnRisk} risk
                    </span>
                    <span style={{ ...muted, fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
              </div>

              {isOpen && <ClinicianPatientDetail patient={p} />}
            </div>
          );
        })}
      </div>

      {!loadingDb && realPatients.length === 0 && (
        <p style={{ ...muted, fontSize: '0.73rem', marginTop: 12 }}>
          Demo data shown. Use &ldquo;Invite Patient&rdquo; to add real patients — they will appear above the demo rows.
        </p>
      )}

      {/* Invite patient modal */}
      {showInvite && (
        <div onClick={() => { setShowInvite(false); setInviteMsg(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 6px', fontWeight: 600, color: '#0f172a' }}>Invite Patient</h3>
            <p style={{ ...muted, fontSize: '0.8rem', marginBottom: 20 }}>They will receive an email with a signup link tied to your account.</p>
            <form onSubmit={e => { void handleInvitePatient(e); }} style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
              {[
                { label: 'Patient Email', key: 'email', type: 'email', placeholder: 'patient@example.com', required: true },
                { label: 'Patient Name (optional)', key: 'name', type: 'text', placeholder: 'Alex Johnson', required: false },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={f.key === 'email' ? inviteEmail : inviteName}
                    onChange={e => f.key === 'email' ? setInviteEmail(e.target.value) : setInviteName(e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    style={inputSt}
                  />
                </div>
              ))}
              {inviteMsg && (
                <div style={{ padding: '10px 14px', background: inviteMsg.startsWith('Failed') ? '#fee2e2' : '#dcfce7', border: `1px solid ${inviteMsg.startsWith('Failed') ? '#fca5a5' : '#86efac'}`, borderRadius: 8, fontSize: '0.8rem', color: inviteMsg.startsWith('Failed') ? '#b91c1c' : '#15803d' }}>
                  {inviteMsg}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => { setShowInvite(false); setInviteMsg(''); }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500 }}>Cancel</button>
                <button type="submit" disabled={inviteSending} className="btn-primary" style={{ flex: 1 }}>{inviteSending ? 'Sending…' : 'Send Invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AiChatPanel
        pageContext={`Clinician Mode. ${selPatient ? `Selected: ${selPatient.name}${selPatient.age > 0 ? `, ${selPatient.age}yo` : ''}. Conditions: ${selPatient.conditions.join(', ')}. Medications: ${selPatient.medications.join(', ')}. Sessions: ${selPatient.sessions.length}. Adherence: ${selPatient.adherencePct}%.` : 'No patient selected.'}`}
        quickPrompts={[
          'Write a brief progress summary for this patient',
          'What red flags should I watch for with these conditions?',
          'Suggest a home exercise program for this patient',
          'What CPT codes are appropriate for this presentation?',
        ]}
      />
    </div>
  );
}

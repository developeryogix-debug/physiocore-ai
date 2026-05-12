import { useState, useEffect, type FormEvent } from 'react';
import type { MockPatient } from '../lib/clinicianTypes.js';
import ClinicianPatientDetail from '../components/ClinicianPatientDetail.js';
import { AiChatPanel } from '../components/AiChatPanel.js';
import { useAuth } from '../hooks/useAuth.js';
import { getClinicianPatients, createInvite, type ClinicianPatient } from '../lib/orgApi.js';
import { sendPatientInvite, getInviteLink } from '../lib/emailApi.js';

// ─── Mock data ────────────────────────────────────────────────────────────────

function makeDate(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0] as string;
}

const PATIENTS: MockPatient[] = [
  {
    id: 'p1', name: 'Sarah Chen', age: 52, gender: 'female', dob: '1972-03-14',
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
    id: 'p2', name: 'Marcus Williams', age: 38, gender: 'male', dob: '1986-07-22',
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
    id: 'p3', name: 'Elena Rodriguez', age: 67, gender: 'female', dob: '1957-11-05',
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
    id: 'p4', name: 'James Kim', age: 45, gender: 'male', dob: '1979-05-30',
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
    id: 'p5', name: 'Amara Osei', age: 29, gender: 'female', dob: '1995-09-18',
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

const CHURN_COLORS: Record<string, { bg: string; color: string }> = {
  low:    { bg: '#dcfce7', color: '#15803d' },
  medium: { bg: '#fef9c3', color: '#92400e' },
  high:   { bg: '#fee2e2', color: '#b91c1c' },
};

// ─── Component ────────────────────────────────────────────────────────────────

const muted: React.CSSProperties = { color: '#64748b', fontSize: '0.875rem' };

export default function Clinician() {
  const { user, orgId } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  // ─── Real patients from DB ─────────────────────────────────────────────────
  const [dbPatients, setDbPatients] = useState<ClinicianPatient[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // ─── Invite patient modal ──────────────────────────────────────────────────
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    void getClinicianPatients(user.id).then(data => { setDbPatients(data); setLoadingDb(false); });
  }, [user]);

  async function handleInvitePatient(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setInviteSending(true);
    setInviteMsg('');
    const invite = await createInvite({ org_id: orgId ?? '', invited_by: user.id, email: inviteEmail, role: 'patient' });
    if (!invite) { setInviteSending(false); setInviteMsg('Failed to create invite. Try again.'); return; }
    const link = getInviteLink(invite.token);
    await navigator.clipboard.writeText(link).catch(() => undefined);
    void sendPatientInvite({ toEmail: inviteEmail, toName: inviteName || 'there', clinicianName: user.email ?? 'Your clinician', orgName: '', inviteToken: invite.token });
    setInviteMsg(`Invite link copied! ${import.meta.env.VITE_RESEND_API_KEY ? 'Email sent.' : '(Add VITE_RESEND_API_KEY to send emails.)'}`);
    setInviteEmail('');
    setInviteName('');
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

  // Summary stats for the page header
  const totalSessions  = PATIENTS.reduce((s, p) => s + p.sessions.length, 0);
  const avgAdherence   = Math.round(PATIENTS.reduce((s, p) => s + p.adherencePct, 0) / PATIENTS.length);
  const highRiskCount  = PATIENTS.filter(p => p.churnRisk === 'high').length;
  const avgFormScore   = Math.round(PATIENTS.reduce((s, p) => s + avgScore(p), 0) / PATIENTS.length);

  const selPatient = selected ? (PATIENTS.find(p => p.id === selected) ?? null) : null;

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '100px 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 4 }}>Clinician Mode</h1>
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
          { label: 'Patients',         value: PATIENTS.length.toString(),   sub: 'total' },
          { label: 'Sessions',         value: totalSessions.toString(),      sub: 'logged' },
          { label: 'Avg Adherence',    value: `${avgAdherence}%`,           sub: 'this cohort' },
          { label: 'High-Risk',        value: highRiskCount.toString(),      sub: 'need attention', warn: highRiskCount > 0 },
          { label: 'Avg Form Score',   value: `${avgFormScore}/100`,         sub: 'across sessions' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${s.warn ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: s.warn ? '#b91c1c' : '#0f172a' }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Real patients from DB ── */}
      {!loadingDb && dbPatients.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ ...muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
            Your Patients ({dbPatients.length})
          </p>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Patient', 'Status', 'Assigned'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {dbPatients.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                      {p.profile?.full_name ?? `Patient ${p.patient_id.slice(0, 8)}…`}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 99, background: p.status === 'active' ? '#dcfce7' : '#fee2e2', color: p.status === 'active' ? '#15803d' : '#b91c1c', fontSize: '0.7rem', fontWeight: 700 }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.78rem' }}>
                      {new Date(p.assigned_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Demo patient list ── */}
      <div>
        {dbPatients.length === 0 && !loadingDb && (
          <p style={{ ...muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
            Demo Patients — invite real patients above to replace this
          </p>
        )}
        {PATIENTS.map(p => {
          const isOpen = selected === p.id;
          const cr     = CHURN_COLORS[p.churnRisk] ?? CHURN_COLORS['low']!;
          const avg    = avgScore(p);
          const trend  = scoreTrend(p);
          return (
            <div key={p.id} style={{ marginBottom: 4 }}>
              {/* Patient row */}
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
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: isOpen ? '#6366f1' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', color: isOpen ? '#fff' : '#475569', flexShrink: 0 }}>
                      {p.name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.name}</div>
                      <div style={{ ...muted, fontSize: '0.78rem' }}>{p.age}y {p.gender} · {p.conditions.join(', ')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#0369a1' }}>{p.sessions.length}</div>
                      <div style={{ ...muted, fontSize: '0.7rem' }}>sessions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: p.adherencePct >= 80 ? '#15803d' : p.adherencePct >= 60 ? '#92400e' : '#b91c1c' }}>{p.adherencePct}%</div>
                      <div style={{ ...muted, fontSize: '0.7rem' }}>adherence</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: avg >= 80 ? '#15803d' : avg >= 65 ? '#92400e' : '#b91c1c' }}>
                        {avg} <span style={{ color: trend === '↑' ? '#22c55e' : trend === '↓' ? '#ef4444' : '#94a3b8', fontSize: '1rem' }}>{trend}</span>
                      </div>
                      <div style={{ ...muted, fontSize: '0.7rem' }}>avg score</div>
                    </div>
                    <span style={{ ...cr, borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' as const }}>
                      {p.churnRisk} risk
                    </span>
                    <span style={{ ...muted, fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
              </div>

              {/* Deep dive panel */}
              {isOpen && <ClinicianPatientDetail patient={p} />}
            </div>
          );
        })}
      </div>

      {dbPatients.length === 0 && !loadingDb && (
        <p style={{ ...muted, fontSize: '0.73rem', marginTop: 12 }}>
          Demo data shown. Use &ldquo;Invite Patient&rdquo; to add real patients — they will appear above.
        </p>
      )}

      {/* ── Invite patient modal ── */}
      {showInvite && (
        <div onClick={() => { setShowInvite(false); setInviteMsg(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 6px', fontWeight: 700, color: '#0f172a' }}>Invite Patient</h3>
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
        pageContext={`Clinician Mode. ${selPatient ? `Selected: ${selPatient.name}, ${selPatient.age}yo. Conditions: ${selPatient.conditions.join(', ')}. Medications: ${selPatient.medications.join(', ')}. Sessions: ${selPatient.sessions.length}. Adherence: ${selPatient.adherencePct}%.` : 'No patient selected.'}`}
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

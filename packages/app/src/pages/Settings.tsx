import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { supabase } from '@physiocore/supabase';
import { AiChatPanel } from '../components/AiChatPanel.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface BiometricEntry { metric_type: string; value: number; unit: string; recorded_at: string; }

const METRICS = [
  { key: 'hr',      label: 'Heart Rate',       unit: 'bpm',   min: 40,  max: 200, refMin: 60,  refMax: 100,  refLabel: '60–100 bpm' },
  { key: 'bp_sys',  label: 'BP Systolic',       unit: 'mmHg',  min: 80,  max: 200, refMin: 90,  refMax: 120,  refLabel: '90–120 mmHg' },
  { key: 'bp_dia',  label: 'BP Diastolic',      unit: 'mmHg',  min: 40,  max: 130, refMin: 60,  refMax: 80,   refLabel: '60–80 mmHg' },
  { key: 'glucose', label: 'Blood Glucose',     unit: 'mmol/L',min: 2,   max: 20,  refMin: 4,   refMax: 7.8,  refLabel: '4.0–7.8 mmol/L' },
  { key: 'hrv',     label: 'HRV (RMSSD)',       unit: 'ms',    min: 10,  max: 150, refMin: 20,  refMax: 80,   refLabel: '20–80 ms' },
  { key: 'sleep',   label: 'Sleep Duration',    unit: 'hrs',   min: 3,   max: 12,  refMin: 7,   refMax: 9,    refLabel: '7–9 hrs' },
  { key: 'weight',  label: 'Body Weight',       unit: 'kg',    min: 30,  max: 200, refMin: null, refMax: null, refLabel: 'BMI 18.5–24.9' },
];

function Sparkline({ values, refMin, refMax }: { values: number[]; refMin: number | null; refMax: number | null }) {
  if (values.length < 2) return <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Need 2+ readings</span>;
  const W = 120; const H = 32; const PAD = 3;
  const min = Math.min(...values); const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  const last = values[values.length - 1]!;
  const isHigh = refMax !== null && last > refMax;
  const isLow = refMin !== null && last < refMin;
  const color = (isHigh || isLow) ? 'var(--warning)' : 'var(--teal-500)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { userProfile, clearProfile } = useUserProfile();
  const navigate = useNavigate();

  // Profile form
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Biometrics
  const [biometrics, setBiometrics] = useState<Record<string, BiometricEntry[]>>({});
  const [biometricValues, setBiometricValues] = useState<Record<string, string>>({});
  const [bioSaving, setBioSaving] = useState<string | null>(null);

  // Notifications
  const [weeklyEmail, setWeeklyEmail] = useState(false);
  const [sessionReminder, setSessionReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [changePasswordMsg, setChangePasswordMsg] = useState('');

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name ?? '');
      setFitnessLevel(userProfile.fitnessLevel ?? '');
    }
    const notifRaw = localStorage.getItem('physiocore_notifications');
    if (notifRaw) try {
      const n = JSON.parse(notifRaw) as { weeklyEmail?: boolean; sessionReminder?: boolean; reminderTime?: string };
      setWeeklyEmail(n.weeklyEmail ?? false);
      setSessionReminder(n.sessionReminder ?? false);
      setReminderTime(n.reminderTime ?? '08:00');
    } catch { /* ignore */ }
    void loadBiometrics();
  }, [userProfile]);

  async function loadBiometrics() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { data } = await db.from('biometrics').select('*').eq('user_id', session.user.id).order('recorded_at', { ascending: true });
    if (!data) return;
    const grouped: Record<string, BiometricEntry[]> = {};
    for (const row of data as BiometricEntry[]) {
      if (!grouped[row.metric_type]) grouped[row.metric_type] = [];
      grouped[row.metric_type]!.push(row);
    }
    setBiometrics(grouped);
  }

  async function saveProfile() {
    setProfileSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await db.from('user_profiles').update({ name, fitness_level: fitnessLevel, date_of_birth: dob || null, sex: sex || null }).eq('user_id', session.user.id);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await db.from('profiles').update({ full_name: name }).eq('user_id', session.user.id);
      setProfileMsg('Profile updated ✓'); setTimeout(() => setProfileMsg(''), 2500);
    } catch { setProfileMsg('Update failed'); }
    setProfileSaving(false);
  }

  async function saveBiometric(metricKey: string, unit: string) {
    const valStr = biometricValues[metricKey] ?? '';
    const value = parseFloat(valStr);
    if (isNaN(value)) return;
    setBioSaving(metricKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await db.from('biometrics').insert({ user_id: session.user.id, metric_type: metricKey, value, unit, recorded_at: new Date().toISOString() });
      setBiometricValues(prev => ({ ...prev, [metricKey]: '' }));
      await loadBiometrics();
    } catch { /* non-fatal */ }
    setBioSaving(null);
  }

  function saveNotifications() {
    localStorage.setItem('physiocore_notifications', JSON.stringify({ weeklyEmail, sessionReminder, reminderTime }));
    setProfileMsg('Notifications saved ✓'); setTimeout(() => setProfileMsg(''), 2000);
  }

  async function exportAllData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const uid = session.user.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const [{ data: sessions }, { data: outcomes }, { data: bio }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      db.from('session_summaries').select('*').eq('user_id', uid),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      db.from('outcomes').select('*').eq('user_id', uid),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      db.from('biometrics').select('*').eq('user_id', uid),
    ]);
    const payload = { exported_at: new Date().toISOString(), sessions, outcomes, biometrics: bio };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'physiocore_my_data.json'; a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAllData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const uid = session.user.id;
    for (const table of ['session_summaries', 'chat_messages', 'outcomes', 'biometrics', 'trainer_messages', 'trainer_sessions']) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.from(table).delete().eq('user_id', uid);
      } catch { /* non-fatal */ }
    }
    localStorage.clear();
    setDeleteConfirm(false);
    setProfileMsg('All data deleted');
  }

  async function sendPasswordReset() {
    if (!user?.email) return;
    await supabase.auth.resetPasswordForEmail(user.email);
    setChangePasswordMsg('Reset email sent to ' + user.email);
  }

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24, marginBottom: 20 };
  const input: React.CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' };
  const label: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' };

  if (!userProfile) return null;

  return (
    <div style={{ padding: '100px 24px 80px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.68rem', color: 'var(--teal-500)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Settings</p>
        <h1 className="font-display" style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, margin: 0 }}>Profile & Preferences</h1>
      </div>

      {profileMsg && <div style={{ background: 'var(--teal-dim)', border: '1px solid var(--border-teal)', color: 'var(--teal-500)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem' }}>{profileMsg}</div>}

      {/* ── Profile ── */}
      <div style={card}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>Edit Profile</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <span style={label}>Full Name</span>
            <input style={input} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <span style={label}>Fitness Level</span>
            <select style={{ ...input }} value={fitnessLevel} onChange={e => setFitnessLevel(e.target.value)}>
              <option value="">Select</option>
              {['beginner', 'intermediate', 'advanced', 'athlete'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Date of Birth</span>
            <input style={input} type="date" value={dob} onChange={e => setDob(e.target.value)} />
          </div>
          <div>
            <span style={label}>Sex</span>
            <select style={{ ...input }} value={sex} onChange={e => setSex(e.target.value)}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <button onClick={() => void saveProfile()} disabled={profileSaving} className="btn-primary" style={{ marginTop: 16 }}>
          {profileSaving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      {/* ── Biometrics ── */}
      <div style={card}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Biometrics Tracker</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 16 }}>Log manual readings — stored securely in Supabase Singapore region</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {METRICS.map(m => {
            const entries = biometrics[m.key] ?? [];
            const last = entries[entries.length - 1];
            const isHigh = m.refMax !== null && (last?.value ?? 0) > m.refMax;
            const isLow = m.refMin !== null && (last?.value ?? 0) < m.refMin && entries.length > 0;
            return (
              <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 120px auto', gap: 10, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: '0.68rem', color: (isHigh || isLow) ? 'var(--warning)' : 'var(--text-tertiary)' }}>ref: {m.refLabel}</div>
                </div>
                <Sparkline values={entries.map(e => e.value)} refMin={m.refMin} refMax={m.refMax} />
                <input type="number" placeholder={m.unit} min={m.min} max={m.max} step="0.1"
                  value={biometricValues[m.key] ?? ''}
                  onChange={e => setBiometricValues(prev => ({ ...prev, [m.key]: e.target.value }))}
                  style={{ ...input, width: '100%' }} />
                <button onClick={() => void saveBiometric(m.key, m.unit)} disabled={bioSaving === m.key} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  {bioSaving === m.key ? '…' : 'Log'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Notifications ── */}
      <div style={card}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>Notifications</h2>
        {[
          { label: 'Weekly email report', checked: weeklyEmail, onChange: setWeeklyEmail },
          { label: 'Session reminder', checked: sessionReminder, onChange: setSessionReminder },
        ].map(({ label: l, checked, onChange }) => (
          <label key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--teal-500)', width: 16, height: 16 }} />
            <span style={{ fontSize: '0.85rem' }}>{l}</span>
          </label>
        ))}
        {sessionReminder && (
          <div style={{ marginTop: 8 }}>
            <span style={label}>Reminder time</span>
            <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} style={{ ...input, width: 'auto' }} />
          </div>
        )}
        <button onClick={saveNotifications} className="btn-primary" style={{ marginTop: 14 }}>Save Notifications</button>
      </div>

      {/* ── Data & Privacy ── */}
      <div style={card}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Data & Privacy (PDPA)</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginBottom: 16 }}>Your data is stored in Supabase Singapore region and never shared with third parties.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => void exportAllData()} className="btn-ghost" style={{ fontSize: '0.82rem' }}>↓ Export All My Data (JSON)</button>
          <button onClick={() => setDeleteConfirm(true)} style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', color: 'var(--danger)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.82rem' }}>
            Delete All My Data
          </button>
        </div>
        {deleteConfirm && (
          <div style={{ marginTop: 14, padding: 16, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', borderRadius: 10 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginBottom: 12 }}>This will permanently delete all your sessions, outcomes, biometrics, and chat history. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => void deleteAllData()} style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.82rem' }}>Yes, Delete Everything</button>
              <button onClick={() => setDeleteConfirm(false)} className="btn-ghost" style={{ fontSize: '0.82rem' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Account ── */}
      <div style={{ ...card, marginBottom: 80 }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>Account</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>Signed in as <strong>{user?.email}</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <button onClick={() => void sendPasswordReset()} className="btn-ghost" style={{ fontSize: '0.82rem' }}>Send Password Reset Email</button>
          {changePasswordMsg && <p style={{ fontSize: '0.78rem', color: 'var(--teal-500)' }}>{changePasswordMsg}</p>}
          <button onClick={async () => { clearProfile(); await signOut(); navigate('/'); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.82rem' }}>
            Sign Out
          </button>
        </div>
      </div>

      <AiChatPanel pageContext="Settings, profile, biometrics and account management" quickPrompts={['How do I track my blood pressure?', 'What biometrics matter most for rehab?', 'Explain HRV tracking']} />
    </div>
  );
}

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import {
  getMyOrg, getOrgMembers, getOrgPatients, createInvite, updateOrg,
  type Organisation, type OrgMember, type ClinicianPatient,
} from '../lib/orgApi.js';
import { sendClinicianInvite, getInviteLink } from '../lib/emailApi.js';

const MONO: React.CSSProperties = { fontFamily: "'Space Mono', monospace" };
const SECTION: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, marginBottom: 24, overflow: 'hidden' };
const SEC_HEAD: React.CSSProperties = { padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, ...MONO, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em' };
const INPUT: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' as const };

const ROLE_COLOR: Record<string, { bg: string; c: string }> = {
  clinician: { bg: 'rgba(77,184,255,0.12)',  c: 'var(--blue-400)' },
  trainer:   { bg: 'rgba(0,212,170,0.12)',   c: 'var(--teal-500)' },
  patient:   { bg: 'rgba(139,92,246,0.12)',  c: '#a78bfa' },
  org_admin: { bg: 'rgba(255,184,48,0.15)',  c: '#f59e0b' },
};

export default function OrgDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'team' | 'patients' | 'settings'>('team');
  const [org, setOrg] = useState<Organisation | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [patients, setPatients] = useState<ClinicianPatient[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite clinician modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', specialty: '' });
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({ name: '', contact_email: '' });
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const myOrg = await getMyOrg(user.id);
      setOrg(myOrg);
      if (myOrg) {
        const [m, p] = await Promise.all([getOrgMembers(myOrg.id), getOrgPatients(myOrg.id)]);
        setMembers(m); setPatients(p);
        setSettingsForm({ name: myOrg.name, contact_email: myOrg.contact_email ?? '' });
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!org || !user) return;
    setInviteSaving(true); setInviteStatus(null); setInviteLink(null);
    const invite = await createInvite({ org_id: org.id, invited_by: user.id, email: inviteForm.email, role: 'clinician' });
    if (!invite) { setInviteStatus('Failed to create invite.'); setInviteSaving(false); return; }
    const link = getInviteLink(invite.token);
    setInviteLink(link);
    const sent = await sendClinicianInvite({
      toEmail: inviteForm.email, toName: inviteForm.name,
      orgAdminName: user.email ?? 'Admin', orgName: org.name, inviteToken: invite.token,
    });
    setInviteStatus(sent ? `✓ Invite email sent to ${inviteForm.email}` : '⚠ Email not sent (no API key). Copy link below.');
    setInviteForm({ email: '', name: '', specialty: '' });
    setInviteSaving(false);
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    await updateOrg(org.id, { name: settingsForm.name, contact_email: settingsForm.contact_email });
    setOrg(prev => prev ? { ...prev, ...settingsForm } : prev);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  const clinicians = members.filter(m => m.role === 'clinician');
  const highRiskPct = patients.length > 0 ? Math.round((patients.filter(p => p.status === 'inactive').length / patients.length) * 100) : 0;

  if (loading) return <div style={{ padding: '100px 24px', color: 'var(--text-tertiary)', ...MONO, fontSize: '0.82rem' }}>Loading…</div>;

  if (!org) return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '100px 24px', textAlign: 'center' as const }}>
      <div style={{ fontSize: '2rem', marginBottom: 16 }}>🏥</div>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Organisation Found</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>You are not assigned to an organisation yet. Ask your platform admin to create one and invite you.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px 48px' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ ...MONO, fontSize: '0.68rem', color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>{org.type.replace('_',' ')}</p>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 0 }}>{org.name}</h1>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Clinicians',   value: clinicians.length.toString() },
          { label: 'Patients',     value: patients.length.toString() },
          { label: 'High-Risk %',  value: `${highRiskPct}%` },
        ].map(s => (
          <div key={s.label} className="metric-card" style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--teal-500)', ...MONO }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {(['team', 'patients', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: tab === t ? 600 : 400, background: tab === t ? 'var(--bg-overlay)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', transition: 'all 0.15s', textTransform: 'capitalize' as const }}>
            {t === 'team' ? 'Team' : t === 'patients' ? 'Patients' : 'Settings'}
          </button>
        ))}
      </div>

      {/* ── Team ── */}
      {tab === 'team' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{clinicians.length} clinician{clinicians.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setShowInvite(true)} className="btn-primary" style={{ fontSize: '0.82rem' }}>+ Invite Clinician</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {members.length === 0 && <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No team members yet. Send an invite above.</p>}
            {members.map(m => {
              const rc = ROLE_COLOR[m.role] ?? ROLE_COLOR['clinician']!;
              return (
                <div key={m.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--teal-500),var(--blue-400))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#000', ...MONO }}>
                      {(m.profile?.full_name ?? m.user_id.slice(0,2)).toUpperCase().slice(0,2)}
                    </div>
                    <span style={{ padding: '2px 10px', borderRadius: 99, background: rc.bg, color: rc.c, fontSize: '0.7rem', fontWeight: 600, ...MONO }}>{m.role}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{m.profile?.full_name || 'Unnamed'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>Joined {new Date(m.joined_at).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Patients ── */}
      {tab === 'patients' && (
        <div style={SECTION}>
          <div style={{ ...SEC_HEAD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>All Patients ({patients.length})</span>
          </div>
          {patients.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' as const, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No patients in your organisation yet. Clinicians can invite patients from the Clinician page.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead><tr style={{ background: 'var(--bg-elevated)' }}>
                {['Patient ID', 'Clinician', 'Assigned', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, ...MONO, fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '11px 16px', ...MONO, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.patient_id.slice(0,8)}…</td>
                    <td style={{ padding: '11px 16px', ...MONO, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.clinician_id.slice(0,8)}…</td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{new Date(p.assigned_at).toLocaleDateString()}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 99, background: p.status === 'active' ? 'rgba(0,212,170,0.12)' : 'rgba(255,68,68,0.12)', color: p.status === 'active' ? 'var(--teal-500)' : 'var(--danger)', fontSize: '0.7rem', fontWeight: 600, ...MONO }}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && (
        <div style={{ maxWidth: 480 }}>
          <form onSubmit={e => { void handleSaveSettings(e); }} style={SECTION}>
            <div style={SEC_HEAD}>Organisation Settings</div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
              {[{ label: 'Organisation Name', key: 'name', type: 'text' }, { label: 'Contact Email', key: 'contact_email', type: 'email' }].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, ...MONO }}>{f.label.toUpperCase()}</label>
                  <input type={f.type} value={(settingsForm as Record<string,string>)[f.key]} onChange={e => setSettingsForm(p => ({ ...p, [f.key]: e.target.value }))} required style={INPUT} />
                </div>
              ))}
              <div style={{ paddingTop: 4 }}>
                <button type="submit" className="btn-primary">{settingsSaved ? '✓ Saved!' : 'Save Changes'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Invite clinician modal ── */}
      {showInvite && (
        <div onClick={() => { setShowInvite(false); setInviteStatus(null); setInviteLink(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 600 }}>Invite Clinician</h3>
            <form onSubmit={e => { void handleInvite(e); }} style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
              {[
                { label: 'Full Name', key: 'name', placeholder: 'Dr. Jane Smith', type: 'text' },
                { label: 'Email', key: 'email', placeholder: 'jane@clinic.com', type: 'email' },
                { label: 'Specialty (optional)', key: 'specialty', placeholder: 'Sports Physio', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, ...MONO }}>{f.label.toUpperCase()}</label>
                  <input type={f.type} value={(inviteForm as Record<string,string>)[f.key]} onChange={e => setInviteForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} required={f.key !== 'specialty'} style={INPUT} />
                </div>
              ))}
              {inviteStatus && <p style={{ fontSize: '0.82rem', color: inviteStatus.startsWith('✓') ? 'var(--teal-500)' : 'var(--warning)', margin: 0 }}>{inviteStatus}</p>}
              {inviteLink && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 12px' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0 0 4px', ...MONO }}>INVITE LINK</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--teal-500)', margin: 0, wordBreak: 'break-all' as const }}>{inviteLink}</p>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(inviteLink ?? '')} className="btn-ghost" style={{ fontSize: '0.72rem', marginTop: 6, padding: '3px 10px' }}>Copy Link</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setShowInvite(false); setInviteStatus(null); setInviteLink(null); }} className="btn-ghost" style={{ flex: 1 }}>Close</button>
                {!inviteLink && <button type="submit" disabled={inviteSaving} className="btn-primary" style={{ flex: 1 }}>{inviteSaving ? 'Sending…' : 'Send Invite'}</button>}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

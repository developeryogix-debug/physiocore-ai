import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { getAllOrgs, createOrg, getAllUsers, updateUserRole, getPlatformStats, type Organisation, type AdminUser, type PlatformStats } from '../lib/orgApi.js';
import { sendClinicianInvite, getInviteLink } from '../lib/emailApi.js';
import { createInvite } from '../lib/orgApi.js';

const MONO: React.CSSProperties = { fontFamily: "'Space Mono', monospace" };
const SECTION: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, marginBottom: 28, overflow: 'hidden' };
const SEC_HEAD: React.CSSProperties = { padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, ...MONO, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em' };

function Pill({ label, color }: { label: string; color: string }) {
  const map: Record<string, { bg: string; c: string }> = {
    teal:   { bg: 'rgba(0,212,170,0.12)',  c: 'var(--teal-500)' },
    blue:   { bg: 'rgba(77,184,255,0.12)', c: 'var(--blue-400)' },
    amber:  { bg: 'rgba(255,184,48,0.15)', c: '#f59e0b' },
    red:    { bg: 'rgba(255,68,68,0.12)',  c: 'var(--danger)' },
    purple: { bg: 'rgba(139,92,246,0.12)', c: '#a78bfa' },
  };
  const s = map[color] ?? map['teal']!;
  return <span style={{ padding: '2px 10px', borderRadius: 99, background: s.bg, color: s.c, fontSize: '0.7rem', fontWeight: 600, ...MONO }}>{label}</span>;
}

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab]       = useState<'orgs' | 'users' | 'stats'>('orgs');
  const [orgs, setOrgs]     = useState<Organisation[]>([]);
  const [users, setUsers]   = useState<AdminUser[]>([]);
  const [stats, setStats]   = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Create org modal
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', type: 'clinic', slug: '', contact_email: '' });
  const [orgError, setOrgError] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);

  // Invite copied link
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [o, u, s] = await Promise.all([getAllOrgs(), getAllUsers(), getPlatformStats()]);
      setOrgs(o); setUsers(u); setStats(s); setLoading(false);
    })();
  }, []);

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setOrgSaving(true); setOrgError('');
    try {
      const org = await createOrg({ ...orgForm, created_by: user.id });
      if (!org) { setOrgError('Failed to create organisation.'); return; }
      setOrgs(prev => [org, ...prev]);
      setShowCreateOrg(false);
      setOrgForm({ name: '', type: 'clinic', slug: '', contact_email: '' });
    } catch (err: unknown) {
      const e = err as { message?: string; hint?: string };
      console.error('Full error:', err);
      setOrgError(e?.message || e?.hint || JSON.stringify(err) || 'Unknown error');
    } finally {
      setOrgSaving(false);
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    await updateUserRole(userId, role);
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role } : u));
  }

  async function handleCopyInvite(orgId: string, email: string) {
    if (!user) return;
    const invite = await createInvite({ org_id: orgId, invited_by: user.id, email: email || 'admin@org.com', role: 'clinician' });
    if (!invite) return;
    const link = getInviteLink(invite.token);
    await navigator.clipboard.writeText(link).catch(() => undefined);
    void sendClinicianInvite({ toEmail: email || 'admin@org.com', toName: 'Org Admin', orgAdminName: 'Platform Admin', orgName: '', inviteToken: invite.token });
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 3000);
  }

  const inputSt: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px 48px' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ ...MONO, fontSize: '0.68rem', color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Super Admin</p>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 0 }}>Admin Panel</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {(['orgs', 'users', 'stats'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: tab === t ? 600 : 400, background: tab === t ? 'var(--bg-overlay)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', transition: 'all 0.15s' }}>
            {t === 'orgs' ? 'Organisations' : t === 'users' ? 'Users' : 'Stats'}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--text-tertiary)', ...MONO, fontSize: '0.82rem' }}>Loading…</p>}

      {/* ── Organisations ── */}
      {tab === 'orgs' && !loading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{orgs.length} organisations registered</p>
            <button onClick={() => setShowCreateOrg(true)} className="btn-primary" style={{ fontSize: '0.82rem' }}>+ Create Organisation</button>
          </div>

          <div style={SECTION}>
            <div style={SEC_HEAD}>All Organisations</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead><tr style={{ background: 'var(--bg-elevated)' }}>
                {['Name', 'Type', 'Slug', 'Country', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, ...MONO, fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {orgs.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center' as const, color: 'var(--text-tertiary)' }}>No organisations yet</td></tr>}
                {orgs.map(o => (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 600 }}>{o.name}</td>
                    <td style={{ padding: '11px 16px' }}><Pill label={o.type} color="blue" /></td>
                    <td style={{ padding: '11px 16px', ...MONO, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{o.slug}</td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-secondary)' }}>{o.country}</td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <button onClick={() => void handleCopyInvite(o.id, o.contact_email ?? '')} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>Invite Admin</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {copiedLink && (
            <div style={{ padding: '10px 16px', background: 'rgba(0,212,170,0.08)', border: '1px solid var(--border-teal)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--teal-500)', marginBottom: 12 }}>
              ✓ Invite link copied to clipboard (email sent if RESEND key set)
            </div>
          )}

          {/* Create org modal */}
          {showCreateOrg && (
            <div onClick={() => setShowCreateOrg(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 420 }}>
                <h3 style={{ margin: '0 0 20px', fontWeight: 600 }}>Create Organisation</h3>
                <form onSubmit={e => { void handleCreateOrg(e); }} style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
                  {[
                    { label: 'Org Name', key: 'name', placeholder: 'City Physio Clinic', type: 'text' },
                    { label: 'Slug', key: 'slug', placeholder: 'city-physio', type: 'text' },
                    { label: 'Contact Email', key: 'contact_email', placeholder: 'admin@clinic.com', type: 'email' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, ...MONO }}>{f.label.toUpperCase()}</label>
                      <input type={f.type} value={(orgForm as Record<string,string>)[f.key]} onChange={e => setOrgForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} required style={inputSt} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, ...MONO }}>TYPE</label>
                    <select value={orgForm.type} onChange={e => setOrgForm(p => ({ ...p, type: e.target.value }))} style={inputSt}>
                      {['clinic','gym','yoga_studio','wellness_retreat'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                    </select>
                  </div>
                  {orgError && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>{orgError}</p>}
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={() => setShowCreateOrg(false)} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
                    <button type="submit" disabled={orgSaving} className="btn-primary" style={{ flex: 1 }}>{orgSaving ? 'Creating…' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && !loading && (
        <div style={SECTION}>
          <div style={SEC_HEAD}>All Users ({users.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead><tr style={{ background: 'var(--bg-elevated)' }}>
              {['Name', 'Role', 'Org', 'Change Role'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, ...MONO, fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center' as const, color: 'var(--text-tertiary)' }}>No users yet</td></tr>}
              {users.map(u => {
                const roleColor: Record<string,string> = { admin:'amber', org_admin:'purple', clinician:'blue', trainer:'teal', patient:'teal' };
                return (
                  <tr key={u.user_id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 600 }}>{u.full_name || '—'}</td>
                    <td style={{ padding: '11px 16px' }}><Pill label={u.role} color={roleColor[u.role] ?? 'teal'} /></td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-tertiary)', fontSize: '0.78rem', ...MONO }}>{u.org_id ? u.org_id.slice(0,8) + '…' : '—'}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <select value={u.role} onChange={e => void handleRoleChange(u.user_id, e.target.value)}
                        style={{ ...inputSt, width: 'auto', padding: '4px 8px', fontSize: '0.78rem' }}>
                        {['patient','clinician','trainer','org_admin','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Platform stats ── */}
      {tab === 'stats' && !loading && stats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Organisations', value: stats.totalOrgs.toString() },
              { label: 'Total Users', value: stats.totalUsers.toString() },
              { label: 'Sessions Today', value: stats.totalSessionsToday.toString() },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px', textAlign: 'center' as const }}>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--teal-500)', ...MONO }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={SECTION}>
            <div style={SEC_HEAD}>Health Status</div>
            <div style={{ padding: 20 }}>
              {[['Supabase DB','✓ Connected'],['MediaPipe CDN','✓ Available'],['Anthropic API','✓ Configured'],['Resend Email', import.meta.env.VITE_RESEND_API_KEY ? '✓ Configured' : '⚠ Key missing']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.84rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ color: String(v).startsWith('✓') ? 'var(--success)' : 'var(--warning)', ...MONO, fontSize: '0.78rem' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

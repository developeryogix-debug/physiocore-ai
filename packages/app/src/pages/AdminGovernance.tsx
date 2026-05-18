/**
 * AdminGovernance.tsx — Phase 4 Admin Governance Dashboard
 * Route: /admin/governance
 * Access: admin + org_admin roles only
 *
 * Sections:
 *   1. Agent Health     — health_checks table (last 7 days)
 *   2. Research Digest  — research_log table (last 4 weeks)
 *   3. Security & Compliance — security_logs + compliance_log
 *   4. Cost Tracker     — cost_log (last 30 days) + recharts bar
 *
 * SaMD Class II — administrative view only, no clinical actions.
 */

import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@physiocore/supabase';
import { useAuth } from '../hooks/useAuth.js';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthCheck {
  id: string;
  created_at: string;
  status: 'ok' | 'warn' | 'critical';
  failures: number;
  details: Record<string, unknown>;
}

interface ResearchLog {
  id: string;
  week_of: string;
  papers: Array<{ pmid: string; title: string; authors: string; journal: string; pubdate: string }>;
  digest: {
    weeklyTheme: string;
    clinicalInsight: string;
    topPaper: { title: string; authors: string; journal: string; pmid: string; relevance: string };
  };
  email_sent: boolean;
}

interface SecurityLog {
  id: string;
  created_at: string;
  vulnerability_count: number;
  rls_enabled: boolean;
  critical_issues: string[];
  scan_status: 'clean' | 'issues' | 'critical';
}

interface ComplianceLog {
  id: string;
  created_at: string;
  flags: string[];
  pdpa_status: 'compliant' | 'review' | 'violation';
  samd_status: 'compliant' | 'review' | 'violation';
}

interface CostLogRow {
  id: string;
  created_at: string;
  model: string;
  tokens_used: number;
  cost_usd: number;
  agent: string;
}

interface DailyCost {
  date: string;
  haiku: number;
  sonnet: number;
  opus: number;
  total: number;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "'Space Mono', monospace" };
const CARD: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  marginBottom: 24,
  overflow: 'hidden',
};
const CARD_HEAD: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border-subtle)',
  fontWeight: 600,
  ...MONO,
  color: 'var(--text-secondary)',
  fontSize: '0.7rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
const CARD_BODY: React.CSSProperties = { padding: '16px 20px' };

function StatusDot({ status }: { status: 'ok' | 'warn' | 'critical' | 'clean' | 'issues' }) {
  const c = status === 'ok' || status === 'clean' ? '#22c55e'
    : status === 'warn' || status === 'issues' ? '#f59e0b'
    : '#ef4444';
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />;
}

function Badge({ label, color }: { label: string; color: 'green' | 'amber' | 'red' | 'blue' | 'muted' }) {
  const map = {
    green:  { bg: 'rgba(34,197,94,0.12)',  c: '#22c55e' },
    amber:  { bg: 'rgba(245,158,11,0.12)', c: '#f59e0b' },
    red:    { bg: 'rgba(239,68,68,0.12)',  c: '#ef4444' },
    blue:   { bg: 'rgba(77,184,255,0.12)', c: 'var(--blue-400)' },
    muted:  { bg: 'rgba(136,146,164,0.1)', c: 'var(--text-secondary)' },
  };
  const s = map[color];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.c, fontSize: '0.68rem', fontWeight: 600, ...MONO }}>
      {label}
    </span>
  );
}

function Row({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.78rem', color: muted ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{label}</span>
      <span style={{ fontSize: '0.78rem', ...MONO }}>{value}</span>
    </div>
  );
}

// ── Section 1: Agent Health ───────────────────────────────────────────────────

function AgentHealthSection() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data } = await db
        .from('health_checks')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50) as { data: HealthCheck[] | null };
      setChecks(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Loading…</p>;

  const latest  = checks[0] ?? null;
  const failures = checks.filter(c => c.status !== 'ok').length;
  const overallStatus = latest?.status ?? 'ok';

  return (
    <div style={CARD}>
      <div style={CARD_HEAD}>
        <StatusDot status={overallStatus} />
        Agent Health — last 7 days
        <span style={{ marginLeft: 'auto' }}>
          <Badge label={overallStatus.toUpperCase()} color={overallStatus === 'ok' ? 'green' : overallStatus === 'warn' ? 'amber' : 'red'} />
        </span>
      </div>
      <div style={CARD_BODY}>
        <Row label="Last check" value={latest ? new Date(latest.created_at).toLocaleString() : 'No data'} />
        <Row label="Total checks (7d)" value={checks.length} />
        <Row label="Non-OK results" value={<Badge label={String(failures)} color={failures === 0 ? 'green' : failures < 3 ? 'amber' : 'red'} />} />
        {latest?.details && Object.keys(latest.details).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', ...MONO, marginBottom: 6 }}>LAST CHECK DETAILS</p>
            {Object.entries(latest.details).map(([k, v]) => (
              <Row key={k} label={k} value={String(v)} muted />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section 2: Research Digest ────────────────────────────────────────────────

function ResearchDigestSection() {
  const [logs, setLogs] = useState<ResearchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const since = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
      const { data } = await db
        .from('research_log')
        .select('*')
        .gte('week_of', since)
        .order('week_of', { ascending: false })
        .limit(4) as { data: ResearchLog[] | null };
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Loading…</p>;

  if (logs.length === 0) {
    return (
      <div style={CARD}>
        <div style={CARD_HEAD}>Research Digest — last 4 weeks</div>
        <div style={CARD_BODY}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No digests yet. Cron fires Monday 09:00 SGT.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={CARD}>
      <div style={CARD_HEAD}>Research Digest — last 4 weeks</div>
      <div style={CARD_BODY}>
        {logs.map(log => (
          <div key={log.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', ...MONO, marginBottom: 4 }}>WEEK OF {log.week_of}</p>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--teal-500)', marginBottom: 4 }}>{log.digest.weeklyTheme}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Top: </span>
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${log.digest.topPaper.pmid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--blue-400)', textDecoration: 'none' }}
                  >
                    {log.digest.topPaper.title}
                  </a>
                  {' '}<span style={{ color: 'var(--text-secondary)', ...MONO }}>PMID:{log.digest.topPaper.pmid}</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Badge label={log.email_sent ? 'EMAILED' : 'PENDING'} color={log.email_sent ? 'green' : 'amber'} />
                <Badge label={`${log.papers.length} papers`} color="blue" />
              </div>
            </div>
            <button
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              style={{ background: 'none', border: 'none', color: 'var(--teal-500)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, ...MONO }}
            >
              {expanded === log.id ? '▲ Hide papers' : '▼ View full digest'}
            </button>
            {expanded === log.id && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.5 }}>{log.digest.clinicalInsight}</p>
                {log.papers.map(p => (
                  <div key={p.pmid} style={{ padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize: '0.73rem', color: 'var(--text-primary)', marginBottom: 2 }}>{p.title}</p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {p.authors} — <em>{p.journal}</em> ({p.pubdate}){' '}
                      <a href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal-500)' }}>
                        PMID:{p.pmid}
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section 3: Security & Compliance ─────────────────────────────────────────

function SecurityComplianceSection() {
  const [security, setSecurity] = useState<SecurityLog | null>(null);
  const [compliance, setCompliance] = useState<ComplianceLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [secRes, compRes] = await Promise.all([
        db.from('security_logs').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle() as Promise<{ data: SecurityLog | null }>,
        db.from('compliance_log').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle() as Promise<{ data: ComplianceLog | null }>,
      ]);
      setSecurity(secRes.data);
      setCompliance(compRes.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Loading…</p>;

  const hasCritical = (security?.scan_status === 'critical')
    || (compliance?.pdpa_status === 'violation')
    || (compliance?.samd_status === 'violation');

  return (
    <div style={{ ...CARD, border: hasCritical ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border-subtle)' }}>
      {hasCritical && (
        <div style={{ background: 'rgba(239,68,68,0.1)', padding: '10px 20px', borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>⚠ Critical issues detected — review required</span>
        </div>
      )}
      <div style={CARD_HEAD}>Security &amp; Compliance</div>
      <div style={CARD_BODY}>
        {security ? (
          <>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', ...MONO, marginBottom: 8 }}>LAST SECURITY SCAN</p>
            <Row label="Scan status" value={<Badge label={security.scan_status.toUpperCase()} color={security.scan_status === 'clean' ? 'green' : security.scan_status === 'issues' ? 'amber' : 'red'} />} />
            <Row label="Vulnerabilities" value={<Badge label={String(security.vulnerability_count)} color={security.vulnerability_count === 0 ? 'green' : security.vulnerability_count < 3 ? 'amber' : 'red'} />} />
            <Row label="RLS enabled" value={<Badge label={security.rls_enabled ? 'YES' : 'NO'} color={security.rls_enabled ? 'green' : 'red'} />} />
            <Row label="Scan date" value={new Date(security.created_at).toLocaleDateString()} muted />
            {security.critical_issues.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {security.critical_issues.map((issue, i) => (
                  <p key={i} style={{ color: '#ef4444', fontSize: '0.73rem', padding: '4px 0' }}>• {issue}</p>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: 12 }}>No security scan data. Run <code style={MONO}>npx @claude-flow/cli@latest security scan</code></p>
        )}

        {compliance ? (
          <>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', ...MONO, marginTop: 16, marginBottom: 8 }}>COMPLIANCE STATUS</p>
            <Row label="PDPA (Singapore)" value={<Badge label={compliance.pdpa_status.toUpperCase()} color={compliance.pdpa_status === 'compliant' ? 'green' : compliance.pdpa_status === 'review' ? 'amber' : 'red'} />} />
            <Row label="SaMD Class II" value={<Badge label={compliance.samd_status.toUpperCase()} color={compliance.samd_status === 'compliant' ? 'green' : compliance.samd_status === 'review' ? 'amber' : 'red'} />} />
            <Row label="Last checked" value={new Date(compliance.created_at).toLocaleDateString()} muted />
            {compliance.flags.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {compliance.flags.map((flag, i) => (
                  <p key={i} style={{ color: '#f59e0b', fontSize: '0.73rem', padding: '4px 0' }}>• {flag}</p>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 12 }}>No compliance log data.</p>
        )}
      </div>
    </div>
  );
}

// ── Section 4: Cost Tracker ───────────────────────────────────────────────────

const DAILY_THRESHOLD = 5.0;

function CostTrackerSection() {
  const [rows, setRows] = useState<CostLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data } = await db
        .from('cost_log')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: true }) as { data: CostLogRow[] | null };
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  // Aggregate by day + model tier
  const dailyMap = new Map<string, DailyCost>();
  for (const row of rows) {
    const date = row.created_at.slice(0, 10);
    if (!dailyMap.has(date)) dailyMap.set(date, { date, haiku: 0, sonnet: 0, opus: 0, total: 0 });
    const d = dailyMap.get(date)!;
    const cost = row.cost_usd ?? 0;
    if (row.model?.includes('haiku'))  d.haiku  += cost;
    else if (row.model?.includes('opus')) d.opus += cost;
    else                               d.sonnet += cost;
    d.total += cost;
  }
  const chartData = [...dailyMap.values()].slice(-14);
  const totalSpend = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const todayStr   = new Date().toISOString().slice(0, 10);
  const todaySpend = (dailyMap.get(todayStr)?.total ?? 0);
  const nearLimit  = todaySpend >= DAILY_THRESHOLD * 0.8;
  const overLimit  = todaySpend >= DAILY_THRESHOLD;

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Loading…</p>;

  return (
    <div style={{ ...CARD, border: overLimit ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border-subtle)' }}>
      {overLimit && (
        <div style={{ background: 'rgba(239,68,68,0.1)', padding: '10px 20px', borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>⚠ Daily spend approaching $5 threshold (${todaySpend.toFixed(3)})</span>
        </div>
      )}
      {nearLimit && !overLimit && (
        <div style={{ background: 'rgba(245,158,11,0.1)', padding: '10px 20px', borderBottom: '1px solid rgba(245,158,11,0.25)' }}>
          <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.8rem' }}>Today's spend: ${todaySpend.toFixed(3)} (80%+ of $5 threshold)</span>
        </div>
      )}
      <div style={CARD_HEAD}>Cost Tracker — last 30 days</div>
      <div style={CARD_BODY}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', ...MONO }}>30-DAY TOTAL</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--teal-500)', ...MONO }}>${totalSpend.toFixed(2)}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', ...MONO }}>TODAY</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 600, color: overLimit ? '#ef4444' : nearLimit ? '#f59e0b' : 'var(--text-primary)', ...MONO }}>${todaySpend.toFixed(3)}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', ...MONO }}>DAILY THRESHOLD</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-secondary)', ...MONO }}>${DAILY_THRESHOLD.toFixed(2)}</p>
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={48} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [`$${(v as number).toFixed(4)}`, undefined]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="haiku"  name="Haiku"  stackId="a" fill="#22c55e" />
              <Bar dataKey="sonnet" name="Sonnet" stackId="a" fill="#4DB8FF" />
              <Bar dataKey="opus"   name="Opus"   stackId="a" fill="#a78bfa" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>No cost data yet. Cost logs populated by agent runs.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = ['health', 'research', 'security', 'cost'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  health:   'Agent Health',
  research: 'Research',
  security: 'Security',
  cost:     'Cost',
};

export default function AdminGovernance() {
  const { userRole, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('health');

  if (isLoading) return null;
  if (userRole !== 'admin' && userRole !== 'org_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', padding: '100px 20px 40px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', ...MONO, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          PhysioCore AI · Phase 4
        </p>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Governance Dashboard</h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6 }}>
          Agent health · Research monitoring · Security & compliance · Cost tracking
        </p>
      </div>

      {/* Sliding tabs */}
      <div style={{
        display: 'flex', gap: 4, background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)', borderRadius: 10,
        padding: 4, marginBottom: 24, width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: activeTab === tab ? 600 : 400,
              background: activeTab === tab ? 'rgba(0,212,170,0.12)' : 'transparent',
              color: activeTab === tab ? 'var(--teal-500)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
              ...MONO,
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeTab === 'health'   && <AgentHealthSection />}
      {activeTab === 'research' && <ResearchDigestSection />}
      {activeTab === 'security' && <SecurityComplianceSection />}
      {activeTab === 'cost'     && <CostTrackerSection />}

      <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', ...MONO, marginTop: 16 }}>
        SaMD Class II — administrative view only · No clinical actions from this panel
      </p>
    </div>
  );
}

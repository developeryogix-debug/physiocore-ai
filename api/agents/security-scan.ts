// api/agents/security-scan.ts
// Weekly Security Scan Agent
// Cron: "0 18 * * 0" — 6pm UTC Sunday = 2am SGT Monday (per spec)
//
// Checks:
//   1. npm advisory bulk API — high/critical vulns in production packages
//   2. Supabase RLS audit — tables accessible via anon key without auth
//   3. Env vars presence — 6 required vars
//   4. API surface count — TypeScript files in api/
//
// If overallStatus !== 'clean' → email devkapiltech@gmail.com via Resend
// Results persisted to security_logs Supabase table.
//
// SaMD Class II context: security findings are informational only.
// safetyRules.ts is IMMUTABLE — this agent does not touch it.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ── Env ───────────────────────────────────────────────────────────────────────

const CRON_SECRET      = process.env['CRON_SECRET'];
const SUPABASE_URL     = process.env['VITE_SUPABASE_URL'] ?? '';
const SERVICE_KEY      = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const ANON_KEY         = process.env['VITE_SUPABASE_ANON_KEY'] ?? '';
const RESEND_KEY       = process.env['RESEND_API_KEY'];
const ADMIN_EMAIL      = 'devkapiltech@gmail.com';
const FROM_EMAIL       = 'noreply@doctoronclick.io';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SecurityReport {
  scannedAt:      string;
  vulnerabilities: { high: number; critical: number; packages: string[] };
  tablesWithoutRLS: string[];
  missingEnvVars:  string[];
  apiFunctionCount: number;
  overallStatus:   'clean' | 'warning' | 'critical';
  notes:           string[];
}

interface NpmAdvisory {
  severity: string;
  title:    string;
  url:      string;
  vulnerable_versions: string;
}

// ── 1. Vulnerability scan (npm advisory bulk API) ─────────────────────────────

// Pinned to installed version floor from pnpm-lock; update each release.
const SCAN_PACKAGES: Record<string, string[]> = {
  '@anthropic-ai/sdk':    ['0.36.3'],
  '@supabase/supabase-js': ['2.47.10'],
  'stripe':               ['22.1.1'],
  'resend':               ['6.12.3'],
  '@vercel/node':         ['5.7.16'],
  'react':                ['18.3.1'],
  'react-dom':            ['18.3.1'],
  'react-router-dom':     ['6.28.1'],
  'vite':                 ['6.0.7'],
  'replicate':            ['1.0.1'],
  '@react-pdf/renderer':  ['4.5.1'],
  'turbo':                ['2.3.3'],
};

async function checkVulnerabilities(): Promise<SecurityReport['vulnerabilities'] & { note?: string }> {
  try {
    const res = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(SCAN_PACKAGES),
      signal:  AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return { high: 0, critical: 0, packages: [], note: `npm advisory API ${res.status}` };
    }

    const data = (await res.json()) as Record<string, NpmAdvisory[]>;

    let high = 0, critical = 0;
    const packages: string[] = [];

    for (const [pkg, advisories] of Object.entries(data)) {
      if (!Array.isArray(advisories) || advisories.length === 0) continue;
      for (const adv of advisories) {
        if (adv.severity === 'critical') { critical++; packages.push(`${pkg} (CRITICAL: ${adv.title})`); }
        else if (adv.severity === 'high') { high++; packages.push(`${pkg} (HIGH: ${adv.title})`); }
      }
    }

    return { high, critical, packages };
  } catch (e) {
    return { high: 0, critical: 0, packages: [], note: `audit unavailable: ${String(e).slice(0, 80)}` };
  }
}

// ── 2. RLS audit (anon key probe — no auth = RLS missing or disabled) ─────────

const KNOWN_TABLES = [
  'user_profiles', 'sessions', 'pose_recordings', 'nutrition_plans',
  'clinical_records', 'behavior_profiles', 'interventions', 'profiles',
  'outcomes', 'consents', 'monitoring_alerts', 'health_checks', 'alert_log',
  'cost_log', 'treatment_plans', 'care_plans', 'security_logs',
];

async function checkRLS(): Promise<string[]> {
  if (!SUPABASE_URL || !ANON_KEY) return [];

  const sbAnon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tablesWithoutRLS: string[] = [];

  await Promise.all(KNOWN_TABLES.map(async table => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const { data, error } = await (sbAnon as any).from(table).select('*').limit(1);
      // Rows returned to unauthenticated anon client = RLS disabled or overly permissive
      if (!error && Array.isArray(data) && data.length > 0) {
        tablesWithoutRLS.push(table);
      }
    } catch { /* table doesn't exist or inaccessible — ok */ }
  }));

  return tablesWithoutRLS;
}

// ── 3. Required env vars presence check ───────────────────────────────────────

const REQUIRED_VARS = [
  'VITE_ANTHROPIC_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function checkEnvVars(): string[] {
  return REQUIRED_VARS.filter(v => !process.env[v]);
}

// ── 4. API surface count ───────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walkDir(full) : [full];
    });
  } catch {
    return [];
  }
}

function countApiFiles(): number {
  const apiDir = path.join(process.cwd(), 'api');
  const files = walkDir(apiDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  return files.length > 0 ? files.length : -1;
}

// ── Overall status ─────────────────────────────────────────────────────────────

function computeStatus(report: Omit<SecurityReport, 'overallStatus'>): SecurityReport['overallStatus'] {
  if (report.vulnerabilities.critical > 0) return 'critical';
  if (report.vulnerabilities.high > 0)     return 'warning';
  if (report.tablesWithoutRLS.length > 0)  return 'warning';
  if (report.missingEnvVars.length > 0)    return 'warning';
  return 'clean';
}

// ── Supabase persistence ───────────────────────────────────────────────────────

async function persistSecurityLog(report: SecurityReport): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('security_logs').insert({
      scanned_at:         report.scannedAt,
      overall_status:     report.overallStatus,
      vuln_high:          report.vulnerabilities.high,
      vuln_critical:      report.vulnerabilities.critical,
      vuln_packages:      report.vulnerabilities.packages,
      tables_without_rls: report.tablesWithoutRLS,
      missing_env_vars:   report.missingEnvVars,
      api_function_count: report.apiFunctionCount,
      notes:              report.notes,
    });
  } catch (e) {
    console.error('[SecurityScan] Supabase persist error:', String(e));
  }
}

// ── Alert email ────────────────────────────────────────────────────────────────

async function sendSecurityAlert(report: SecurityReport): Promise<void> {
  if (!RESEND_KEY) return;

  const date    = report.scannedAt.split('T')[0] ?? report.scannedAt;
  const subject = `PhysioCore Security Alert — ${date}`;
  const statusColor = report.overallStatus === 'critical' ? '#ef4444' : '#f59e0b';
  const statusIcon  = report.overallStatus === 'critical' ? '🔴' : '🟡';

  const vulnRows = report.vulnerabilities.packages.length > 0
    ? report.vulnerabilities.packages.map(p => `<li style="font-family:monospace;font-size:0.82em;color:#fca5a5">${p}</li>`).join('')
    : '<li style="color:#8892a4">None detected</li>';

  const rlsRows = report.tablesWithoutRLS.length > 0
    ? report.tablesWithoutRLS.map(t => `<li style="color:#fbbf24">${t}</li>`).join('')
    : '<li style="color:#8892a4">All tables protected</li>';

  const envRows = report.missingEnvVars.length > 0
    ? report.missingEnvVars.map(v => `<li style="font-family:monospace;color:#fca5a5">${v}</li>`).join('')
    : '<li style="color:#8892a4">All required vars present</li>';

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0d1420;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#121b2e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
  <div style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.08);background:#0d1420;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:1.4em">${statusIcon}</span>
      <div>
        <div style="color:#00d4aa;font-weight:600;font-size:0.95rem">PhysioCore AI</div>
        <div style="color:${statusColor};font-size:0.82rem;margin-top:2px">Security Scan — ${report.overallStatus.toUpperCase()}</div>
      </div>
    </div>
  </div>
  <div style="padding:24px 28px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:0.82rem;">
      <tr>
        <td style="color:#8892a4;padding:6px 0;width:160px">Scan time (UTC)</td>
        <td style="color:#f0f4ff;font-family:monospace">${report.scannedAt}</td>
      </tr>
      <tr>
        <td style="color:#8892a4;padding:6px 0">Critical vulns</td>
        <td style="color:${report.vulnerabilities.critical > 0 ? '#ef4444' : '#4ade80'};font-family:monospace">${report.vulnerabilities.critical}</td>
      </tr>
      <tr>
        <td style="color:#8892a4;padding:6px 0">High vulns</td>
        <td style="color:${report.vulnerabilities.high > 0 ? '#f59e0b' : '#4ade80'};font-family:monospace">${report.vulnerabilities.high}</td>
      </tr>
      <tr>
        <td style="color:#8892a4;padding:6px 0">Tables without RLS</td>
        <td style="color:${report.tablesWithoutRLS.length > 0 ? '#f59e0b' : '#4ade80'};font-family:monospace">${report.tablesWithoutRLS.length}</td>
      </tr>
      <tr>
        <td style="color:#8892a4;padding:6px 0">Missing env vars</td>
        <td style="color:${report.missingEnvVars.length > 0 ? '#ef4444' : '#4ade80'};font-family:monospace">${report.missingEnvVars.length}</td>
      </tr>
      <tr>
        <td style="color:#8892a4;padding:6px 0">API functions</td>
        <td style="color:#f0f4ff;font-family:monospace">${report.apiFunctionCount < 0 ? 'N/A' : report.apiFunctionCount}</td>
      </tr>
    </table>
    <div style="margin-bottom:16px">
      <p style="color:#8892a4;margin:0 0 6px;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em">Vulnerabilities</p>
      <ul style="margin:0;padding-left:18px;line-height:1.9">${vulnRows}</ul>
    </div>
    <div style="margin-bottom:16px">
      <p style="color:#8892a4;margin:0 0 6px;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em">Tables Without RLS</p>
      <ul style="margin:0;padding-left:18px;line-height:1.9">${rlsRows}</ul>
    </div>
    <div style="margin-bottom:16px">
      <p style="color:#8892a4;margin:0 0 6px;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em">Missing Env Vars</p>
      <ul style="margin:0;padding-left:18px;line-height:1.9">${envRows}</ul>
    </div>
    ${report.notes.length > 0 ? `
    <div style="padding:12px 14px;background:rgba(255,255,255,0.03);border-radius:6px;margin-top:8px">
      <p style="color:#8892a4;margin:0 0 4px;font-size:0.75rem">Notes</p>
      <p style="color:#f0f4ff;font-size:0.8rem;margin:0;line-height:1.6">${report.notes.join(' | ')}</p>
    </div>` : ''}
    <div style="margin-top:20px">
      <a href="https://app-dteam1-mmcv.vercel.app" style="display:inline-block;background:#00d4aa;color:#000;font-weight:600;font-size:0.82rem;padding:9px 18px;border-radius:8px;text-decoration:none;margin-right:10px">Open App →</a>
      <a href="https://supabase.com/dashboard" style="display:inline-block;color:#4db8ff;font-size:0.82rem;padding:9px 0;text-decoration:none">Supabase RLS →</a>
    </div>
  </div>
  <div style="padding:12px 28px;border-top:1px solid rgba(255,255,255,0.06);background:#0d1420;">
    <p style="color:#4a5568;font-size:0.68rem;margin:0">PhysioCore AI Security Scanner · SaMD Class II · PDPA Compliant · Singapore Region</p>
  </div>
</div>
</body></html>`;

  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject, html }),
  }).catch(e => console.error('[SecurityScan] email send failed:', String(e)));
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth — Vercel Cron sends Authorization: Bearer {CRON_SECRET}
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${CRON_SECRET}` && process.env['NODE_ENV'] !== 'development') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const scannedAt = new Date().toISOString();
  const notes: string[] = [];

  try {
    // Run all checks concurrently
    const [vulnResult, tablesWithoutRLS, missingEnvVars] = await Promise.all([
      checkVulnerabilities(),
      checkRLS(),
      Promise.resolve(checkEnvVars()),
    ]);

    if (vulnResult.note) notes.push(vulnResult.note);

    const apiFunctionCount = countApiFiles();
    if (apiFunctionCount === -1) notes.push('api/ directory not accessible in this runtime');

    const partial: Omit<SecurityReport, 'overallStatus'> = {
      scannedAt,
      vulnerabilities: { high: vulnResult.high, critical: vulnResult.critical, packages: vulnResult.packages },
      tablesWithoutRLS,
      missingEnvVars,
      apiFunctionCount,
      notes,
    };

    const overallStatus = computeStatus(partial);
    const report: SecurityReport = { ...partial, overallStatus };

    // Persist (non-fatal)
    await persistSecurityLog(report);

    // Alert if not clean
    if (overallStatus !== 'clean') {
      await sendSecurityAlert(report);
    }

    return res.status(200).json({ ok: true, report });

  } catch (e) {
    const errorReport: SecurityReport = {
      scannedAt,
      vulnerabilities: { high: 0, critical: 0, packages: [] },
      tablesWithoutRLS: [],
      missingEnvVars:   checkEnvVars(),
      apiFunctionCount: -1,
      overallStatus:    'warning',
      notes:            [`Scan error: ${String(e).slice(0, 120)}`],
    };
    await persistSecurityLog(errorReport).catch(() => undefined);
    await sendSecurityAlert(errorReport).catch(() => undefined);
    return res.status(200).json({ ok: false, error: String(e), report: errorReport });
  }
}

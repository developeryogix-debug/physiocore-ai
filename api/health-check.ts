// api/health-check.ts
// PhysioCore AI — System Health Monitor v2
// Cron: 0 0 * * * (daily 8am SGT)
// Checks all Phase 1 + Phase 2 components

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env['CRON_SECRET'];
const ANTHROPIC_KEY = process.env['VITE_ANTHROPIC_KEY'];
const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const RESEND_KEY = process.env['RESEND_API_KEY'];
const APP_URL = 'https://app-dteam1-mmcv.vercel.app';
const ALERT_EMAIL = 'devkapilicloud@gmail.com';

// Haiku:  $0.25/M input, $1.25/M output
// Sonnet: $3/M input,   $15/M output
// Opus:   $15/M input,  $75/M output  ← AdversarialAgent
const COST_WARNING  = 2.00;
const COST_CRITICAL = 5.00;

// ── Types ────────────────────────────────────────────────────

type CheckStatus = 'ok' | 'warn' | 'critical';

interface Check {
  name: string;
  status: CheckStatus;
  latencyMs?: number;
  detail?: string;
}

// ── Individual checks ─────────────────────────────────────────

async function checkAppHomepage(): Promise<Check> {
  const t = Date.now();
  try {
    const r = await fetch(APP_URL, { signal: AbortSignal.timeout(8000) });
    const latencyMs = Date.now() - t;
    const html = await r.text();
    if (!r.ok) return { name: 'app_homepage', status: 'critical', latencyMs, detail: `HTTP ${r.status}` };
    if (!html.includes('PhysioCore')) return { name: 'app_homepage', status: 'warn', latencyMs, detail: 'Title not found' };
    if (latencyMs > 5000) return { name: 'app_homepage', status: 'warn', latencyMs, detail: 'Slow response' };
    return { name: 'app_homepage', status: 'ok', latencyMs };
  } catch (e) {
    return { name: 'app_homepage', status: 'critical', latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function checkAnthropicAPI(): Promise<Check> {
  const t = Date.now();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - t;
    if (r.status === 529) return { name: 'anthropic_api', status: 'warn', latencyMs, detail: 'Overloaded' };
    if (!r.ok) return { name: 'anthropic_api', status: 'critical', latencyMs, detail: `HTTP ${r.status}` };
    return { name: 'anthropic_api', status: 'ok', latencyMs };
  } catch (e) {
    return { name: 'anthropic_api', status: 'critical', latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function checkMediaPipeCDN(): Promise<Check> {
  const t = Date.now();
  const url = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.wasm';
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    const latencyMs = Date.now() - t;
    if (!r.ok) return { name: 'mediapipe_cdn', status: 'warn', latencyMs, detail: `HTTP ${r.status}` };
    return { name: 'mediapipe_cdn', status: 'ok', latencyMs };
  } catch (e) {
    return { name: 'mediapipe_cdn', status: 'warn', latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function checkSupabaseCore(): Promise<Check> {
  const t = Date.now();
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { error } = await sb.from('profiles').select('count').limit(1).single();
    const latencyMs = Date.now() - t;
    // PGRST116 = no rows — table is accessible, that's fine
    if (error && error.code !== 'PGRST116') {
      return { name: 'supabase_core', status: 'critical', latencyMs, detail: error.message };
    }
    return { name: 'supabase_core', status: 'ok', latencyMs };
  } catch (e) {
    return { name: 'supabase_core', status: 'critical', latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function checkSupabaseTables(): Promise<Check[]> {
  const tables = [
    'posture_assessments',
    'biometrics',
    'trainer_sessions',
    'trainer_messages',
    'session_summaries',
    'outcomes',
    'sessions',
    'organisations',   // British spelling — matches actual table name
  ];
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results: Check[] = [];

  for (const table of tables) {
    const t = Date.now();
    try {
      const { error } = await sb.from(table).select('count').limit(1).single();
      const latencyMs = Date.now() - t;
      if (error && error.code !== 'PGRST116') {
        results.push({ name: `table_${table}`, status: 'critical', latencyMs, detail: error.message });
      } else {
        results.push({ name: `table_${table}`, status: 'ok', latencyMs });
      }
    } catch (e) {
      results.push({ name: `table_${table}`, status: 'critical', latencyMs: Date.now() - t, detail: String(e) });
    }
  }
  return results;
}

async function checkAssessmentAgents(): Promise<Check[]> {
  const t = Date.now();
  try {
    const r = await fetch(`${APP_URL}/assessment`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'text/html' },
    });
    const latencyMs = Date.now() - t;
    if (!r.ok) return [{ name: 'assessment_page', status: 'critical', latencyMs, detail: `HTTP ${r.status}` }];
    return [{ name: 'assessment_page', status: 'ok', latencyMs }];
  } catch (e) {
    return [{ name: 'assessment_page', status: 'critical', latencyMs: Date.now() - t, detail: String(e) }];
  }
}

async function checkRoutes(): Promise<Check[]> {
  const routes = ['/login', '/dashboard', '/session', '/clinician', '/pricing'];
  const results: Check[] = [];
  for (const route of routes) {
    const t = Date.now();
    try {
      const r = await fetch(`${APP_URL}${route}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'Accept': 'text/html' },
      });
      const latencyMs = Date.now() - t;
      // SPA returns 200 for all routes (client-side routing)
      results.push({
        name: `route_${route.slice(1)}`,
        status: r.ok ? 'ok' : 'warn',
        latencyMs,
        detail: r.ok ? undefined : `HTTP ${r.status}`,
      });
    } catch (e) {
      results.push({ name: `route_${route.slice(1)}`, status: 'warn', latencyMs: Date.now() - t, detail: String(e) });
    }
  }
  return results;
}

async function checkCostBudget(): Promise<Check> {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await sb
      .from('cost_log')
      .select('daily_spend_usd')
      .eq('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const cost = (data as { daily_spend_usd?: number } | null)?.daily_spend_usd ?? 0;
    if (cost >= COST_CRITICAL) return { name: 'cost_budget', status: 'critical', detail: `$${cost.toFixed(2)} today (limit $${COST_CRITICAL})` };
    if (cost >= COST_WARNING)  return { name: 'cost_budget', status: 'warn',     detail: `$${cost.toFixed(2)} today (warning $${COST_WARNING})` };
    return { name: 'cost_budget', status: 'ok', detail: `$${cost.toFixed(2)} today` };
  } catch {
    return { name: 'cost_budget', status: 'ok', detail: 'No cost data yet' };
  }
}

// ── DiagnoseAgent — Haiku root-cause ──────────────────────────

async function diagnose(failures: Check[]): Promise<string> {
  const prompt = `You are DiagnoseAgent for PhysioCore AI (SaMD Class II clinical platform, React+Vite, Supabase, Anthropic API, Vercel).
Failed health checks:
${failures.map(f => `- ${f.name}: ${f.detail ?? 'unknown error'} (${f.status})`).join('\n')}

For each failure:
1. Most likely root cause (one sentence)
2. Severity: P1/P2/P3
3. Immediate fix step

Be terse. No markdown headers. Plain text.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json() as { content?: Array<{ type: string; text: string }> };
    return d.content?.[0]?.text ?? 'DiagnoseAgent unavailable';
  } catch {
    return 'DiagnoseAgent unavailable';
  }
}

// ── AlertAgent — Resend email ─────────────────────────────────

async function sendAlert(checks: Check[], diagnosis: string): Promise<void> {
  if (!RESEND_KEY) return;

  const criticals = checks.filter(c => c.status === 'critical');
  const warns     = checks.filter(c => c.status === 'warn');
  const now       = new Date().toISOString();

  // 4-hour global dedup via alert_log
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from('alert_log')
    .select('id')
    .gte('sent_at', cutoff)   // alert_log uses sent_at column
    .limit(1);
  if (recent && recent.length > 0) return;

  const subject = criticals.length > 0
    ? `🚨 PhysioCore AI — ${criticals.length} CRITICAL issue(s)`
    : `⚠️ PhysioCore AI — ${warns.length} warning(s)`;

  const body = `PhysioCore AI Health Alert
Time: ${now}

CRITICAL (${criticals.length}):
${criticals.map(c => `  • ${c.name}: ${c.detail}`).join('\n') || '  none'}

WARNINGS (${warns.length}):
${warns.map(c => `  • ${c.name}: ${c.detail}`).join('\n') || '  none'}

DIAGNOSIS:
${diagnosis}

View live: ${APP_URL}
Health check: ${APP_URL}/api/health-check`.trim();

  await Promise.all([
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ALERT_EMAIL,
        subject,
        text: body,
      }),
    }),
    sb.from('alert_log').insert({ service: 'health_check', severity: criticals.length > 0 ? 'CRITICAL' : 'WARNING', email_subject: subject, sent_at: now }),
  ]);
}

// ── Main handler ──────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${CRON_SECRET}` && process.env['NODE_ENV'] !== 'development') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [
      homepage,
      anthropic,
      mediapipe,
      supabaseCore,
      costCheck,
      tableChecks,
      agentChecks,
      routeChecks,
    ] = await Promise.all([
      checkAppHomepage(),
      checkAnthropicAPI(),
      checkMediaPipeCDN(),
      checkSupabaseCore(),
      checkCostBudget(),
      checkSupabaseTables(),
      checkAssessmentAgents(),
      checkRoutes(),
    ]);

    const all: Check[] = [
      homepage, anthropic, mediapipe, supabaseCore, costCheck,
      ...tableChecks, ...agentChecks, ...routeChecks,
    ];

    const failures = all.filter(c => c.status !== 'ok');
    const overallStatus: CheckStatus = all.some(c => c.status === 'critical') ? 'critical'
      : all.some(c => c.status === 'warn') ? 'warn' : 'ok';

    let diagnosis = '';
    if (failures.length > 0) {
      diagnosis = await diagnose(failures);
      await sendAlert(all, diagnosis).catch(() => { /* non-fatal */ });
    }

    // Persist summary row (non-blocking)
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await sb.from('health_checks').insert({
        checked_at: new Date().toISOString(),
        status: overallStatus,
        checks_json: all,
        failures_count: failures.length,
        diagnosis: diagnosis || null,
      });
    } catch { /* non-blocking */ }

    return res.status(200).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: all,
      failures: failures.length,
      diagnosis: diagnosis || null,
    });
  } catch (e) {
    return res.status(200).json({
      status: 'error',
      message: String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
  }
}

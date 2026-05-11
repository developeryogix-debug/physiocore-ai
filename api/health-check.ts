import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, insertHealthCheck, insertAlertLog, getRecentAlerts, insertCostLog, type HealthCheckRow } from './_lib/db.js';
import { callClaude, extractJson } from './_lib/claude.js';
import { sendAlert } from './_lib/email.js';

const APP_URL = 'https://app-dteam1-mmcv.vercel.app';
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm/vision_wasm_internal.js';

interface DiagnosisResult {
  rootCause: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  fixSteps: string[];
  eta: string;
}

async function checkAnthropicApi(): Promise<HealthCheckRow> {
  const start = Date.now();
  const apiKey = process.env['VITE_ANTHROPIC_KEY'] ?? process.env['ANTHROPIC_API_KEY'] ?? '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    const latency_ms = Date.now() - start;
    if (res.ok) return { service: 'anthropic_api', status: 'ok', latency_ms, error_msg: null, diagnosis_json: null };
    const err = await res.text();
    return { service: 'anthropic_api', status: 'fail', latency_ms, error_msg: `HTTP ${res.status}: ${err.slice(0, 200)}`, diagnosis_json: null };
  } catch (e) {
    return { service: 'anthropic_api', status: 'fail', latency_ms: Date.now() - start, error_msg: String(e), diagnosis_json: null };
  }
}

async function checkSupabase(): Promise<HealthCheckRow> {
  const start = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { count, error } = await db.from('profiles').select('*', { count: 'exact', head: true });
    const latency_ms = Date.now() - start;
    if (error) return { service: 'supabase', status: 'fail', latency_ms, error_msg: String(error.message), diagnosis_json: null };
    return { service: 'supabase', status: 'ok', latency_ms, error_msg: null, diagnosis_json: { profileCount: count } };
  } catch (e) {
    return { service: 'supabase', status: 'fail', latency_ms: Date.now() - start, error_msg: String(e), diagnosis_json: null };
  }
}

async function checkMediaPipeCDN(): Promise<HealthCheckRow> {
  const start = Date.now();
  try {
    const res = await fetch(MEDIAPIPE_CDN, { method: 'HEAD' });
    const latency_ms = Date.now() - start;
    return { service: 'mediapipe_cdn', status: res.ok ? 'ok' : 'fail', latency_ms, error_msg: res.ok ? null : `HTTP ${res.status}`, diagnosis_json: null };
  } catch (e) {
    return { service: 'mediapipe_cdn', status: 'fail', latency_ms: Date.now() - start, error_msg: String(e), diagnosis_json: null };
  }
}

async function checkAppHomepage(): Promise<HealthCheckRow> {
  const start = Date.now();
  try {
    const res = await fetch(APP_URL);
    const latency_ms = Date.now() - start;
    const html = await res.text();
    const hasTitle = html.includes('PhysioCore');
    if (res.ok && hasTitle) return { service: 'app_homepage', status: 'ok', latency_ms, error_msg: null, diagnosis_json: null };
    return { service: 'app_homepage', status: 'fail', latency_ms, error_msg: res.ok ? 'Title not found in response' : `HTTP ${res.status}`, diagnosis_json: null };
  } catch (e) {
    return { service: 'app_homepage', status: 'fail', latency_ms: Date.now() - start, error_msg: String(e), diagnosis_json: null };
  }
}

async function diagnose(check: HealthCheckRow): Promise<DiagnosisResult> {
  // Fetch last 3 errors for this service
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data: recent } = await db
    .from('health_checks')
    .select('checked_at,error_msg')
    .eq('service', check.service)
    .eq('status', 'fail')
    .order('checked_at', { ascending: false })
    .limit(3);

  const history = ((recent as Array<{ checked_at: string; error_msg: string }>) ?? [])
    .map(r => `${r.checked_at}: ${r.error_msg}`)
    .join('\n');

  const text = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 300,
    system: 'You are a DevOps AI for PhysioCore AI (React+Vite, Supabase, Anthropic API, Vercel). Diagnose the error and respond ONLY in JSON: {"rootCause":string,"severity":"CRITICAL"|"WARNING"|"INFO","fixSteps":[string,string,string],"eta":string}',
    userMessage: `Service: ${check.service}\nError: ${check.error_msg}\nLatency: ${check.latency_ms}ms\nRecent failures:\n${history || 'none'}`,
  });

  try {
    return extractJson<DiagnosisResult>(text);
  } catch {
    return {
      rootCause: check.error_msg ?? 'Unknown error',
      severity: 'WARNING',
      fixSteps: ['Check service status', 'Review Vercel logs', 'Verify environment variables'],
      eta: 'Unknown',
    };
  }
}

async function estimateDailyCost(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { count } = await db
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .gte('date', today);

  const sessionCount = (count as number) ?? 0;
  // Estimate: each session uses ~900 tokens (Haiku) + ~500 chat tokens (Sonnet)
  // Haiku: $0.00025/1K input + $0.00125/1K output ≈ $0.001/session
  // Sonnet: $0.003/1K input + $0.015/1K output ≈ $0.01/session
  const estimatedCost = sessionCount * 0.011;
  return estimatedCost;
}

export async function GET(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env['CRON_SECRET'] ?? ''}` && process.env['NODE_ENV'] !== 'development') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: HealthCheckRow[] = await Promise.all([
    checkAnthropicApi(),
    checkSupabase(),
    checkMediaPipeCDN(),
    checkAppHomepage(),
  ]);

  const failures = results.filter(r => r.status === 'fail');

  // Diagnose failures and send alerts (with deduplication)
  await Promise.all(
    failures.map(async (check) => {
      const diagnosis = await diagnose(check);
      check.diagnosis_json = diagnosis as unknown as Record<string, unknown>;

      // Deduplicate: skip if alert sent for this service in last 4h
      const recent = await getRecentAlerts(check.service, 4);
      if (recent.length === 0) {
        const subject = `[${diagnosis.severity}] PhysioCore AI — ${check.service} issue detected`;
        try {
          await sendAlert({
            service: check.service,
            error: check.error_msg ?? 'Unknown error',
            severity: diagnosis.severity,
            rootCause: diagnosis.rootCause,
            fixSteps: diagnosis.fixSteps,
            eta: diagnosis.eta,
          });
          await insertAlertLog({ service: check.service, severity: diagnosis.severity, email_subject: subject });
        } catch {
          // Email failure is non-fatal
        }
      }
    })
  );

  // Persist all results
  await Promise.all(results.map(r => insertHealthCheck(r)));

  // Cost watch
  try {
    const dailyCost = await estimateDailyCost();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { count: sessionCount } = await db
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('date', new Date().toISOString().slice(0, 10));
    await insertCostLog(dailyCost, (sessionCount as number) ?? 0);

    const { sendCostAlert } = await import('./_lib/email.js');
    if (dailyCost > 3.0) {
      await sendCostAlert('CRITICAL', dailyCost, 3.0);
    } else if (dailyCost > 1.5) {
      await sendCostAlert('WARNING', dailyCost, 1.5);
    }
  } catch {
    // Cost estimation is non-fatal
  }

  return res.status(200).json({
    checked_at: new Date().toISOString(),
    results: results.map(r => ({ service: r.service, status: r.status, latency_ms: r.latency_ms })),
    failures: failures.length,
  });
}

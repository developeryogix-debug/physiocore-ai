import { createClient } from '@supabase/supabase-js';

const url = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'] ?? '';
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = (url && key) ? createClient(url, key) as any : null;

export interface HealthCheckRow {
  service: string;
  status: 'ok' | 'fail';
  latency_ms: number;
  error_msg: string | null;
  diagnosis_json: Record<string, unknown> | null;
}

export interface AlertLogRow {
  sent_at: string;
  service: string;
  severity: string;
  email_subject: string;
}

export async function getRecentAlerts(service: string, windowHours = 4): Promise<AlertLogRow[]> {
  if (!db) return [];
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db.from('alert_log').select('*').eq('service', service).gte('sent_at', since);
  return (data ?? []) as AlertLogRow[];
}

export async function insertHealthCheck(row: HealthCheckRow): Promise<void> {
  if (!db) return;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  await db.from('health_checks').insert({ ...row, checked_at: new Date().toISOString() });
}

export async function insertAlertLog(row: Omit<AlertLogRow, 'sent_at'>): Promise<void> {
  if (!db) return;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  await db.from('alert_log').insert({ ...row, sent_at: new Date().toISOString() });
}

export async function insertCostLog(daily_spend_usd: number, session_count: number): Promise<void> {
  if (!db) return;
  const date = new Date().toISOString().slice(0, 10);
  const avg = session_count > 0 ? daily_spend_usd / session_count : 0;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  await db.from('cost_log').upsert({ date, daily_spend_usd, session_count, avg_cost_per_session: avg });
}

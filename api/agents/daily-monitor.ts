// api/agents/daily-monitor.ts
// Autonomous Daily Monitoring Agent
// Cron: "0 0 * * *" = midnight UTC = 08:00 SGT
//
// For each active patient:
//   1. Batch-load last 7 days: sessions + pain scores
//   2. Compute adherence, painTrend, formTrend (pure TS — NO LLM)
//   3. Decision table → determine action(s)
//   4. Call Haiku only for message text generation
//   5. Send email via Resend, write to monitoring_alerts
//
// Decision table:
//   missedSessions >= 2        → reminder email to patient
//   painTrend > 1.5            → alert clinician ONLY (not patient)
//   formTrend > 2.0            → congratulations email to patient
//   formTrend < -2.0           → flag for clinician review

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { callClaude } from '../_lib/claude.js';

// ── Env ────────────────────────────────────────────────────────────────────────

const CRON_SECRET        = process.env['CRON_SECRET'];
const SUPABASE_URL       = process.env['VITE_SUPABASE_URL'] ?? '';
const SUPABASE_SVC_KEY   = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const RESEND_KEY         = process.env['RESEND_API_KEY'];
const APP_URL            = 'https://app-dteam1-mmcv.vercel.app';
const FROM_EMAIL         = 'noreply@doctoronclick.io';
const ADMIN_EMAIL        = 'devkapiltech@gmail.com';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PatientRow {
  user_id: string;
  org_id:  string | null;
}

interface SessionRow {
  created_at: string;
  avg_score:  number | null;
}

interface OutcomeRow {
  recorded_at: string;
  score:        number;
  type:         string;
}

interface UserProfileRow {
  user_id:    string;
  name?:      string;
  first_name?: string;
  conditions?: unknown[];
  primary_goal?: string;
}

type AlertType = 'missed_sessions' | 'pain_worsening' | 'form_improving' | 'form_declining';
type SentTo    = 'patient' | 'clinician' | 'none';

interface PatientDecision {
  userId:         string;
  email:          string;
  name:           string;
  alertType:      AlertType | null;
  sentTo:         SentTo;
  missedSessions: number;
  painTrend:      number;
  formTrend:      number;
  targetPerWeek:  number;
  actualSessions: number;
  conditionText:  string;
  clinicianEmail: string | null;
  orgId:          string | null;
  orgAdminEmail:  string | null;
}

interface RunSummary {
  processed: number;
  acted:     number;
  skipped:   number;
  errors:    string[];
  actions:   Array<{ userId: string; alertType: string; sentTo: string }>;
}

// ── Pure-TS computation helpers ────────────────────────────────────────────────

/** Linear slope via least-squares regression over y values indexed 0..n-1 */
function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xBar = (n - 1) / 2;
  const yBar = values.reduce((a, b) => a + b, 0) / n;
  let ssXY = 0, ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (i - xBar) * ((values[i] ?? yBar) - yBar);
    ssXX += (i - xBar) ** 2;
  }
  return ssXX === 0 ? 0 : ssXY / ssXX;
}

/** avg(array), returns 0 if empty */
function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Compute pain trend: avg(last 3) - avg(first 3 of last 6 scores) */
function computePainTrend(scores: number[]): number {
  if (scores.length < 4) return 0;
  const recent   = scores.slice(-3);
  const previous = scores.slice(-6, -3);
  return avg(recent) - avg(previous);
}

// ── Decision logic (pure TS, no LLM) ──────────────────────────────────────────

function decide(
  sessions:      SessionRow[],
  outcomes:      OutcomeRow[],
  targetPerWeek: number,
): { alertType: AlertType | null; missedSessions: number; painTrend: number; formTrend: number } {

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentSessions = sessions.filter(s => new Date(s.created_at) >= sevenDaysAgo);
  const actualSessions = recentSessions.length;
  const missedSessions = Math.max(0, targetPerWeek - actualSessions);

  // Pain trend from NPRS outcomes (sorted oldest → newest already by query)
  const painScores = outcomes
    .filter(o => o.type === 'nprs_post' || o.type === 'pain' || o.type === 'nprs')
    .map(o => o.score);
  const painTrend = computePainTrend(painScores);

  // Form trend: slope over last 5 sessions (oldest → newest)
  const formScores = sessions
    .slice(-5)
    .map(s => s.avg_score ?? 50)
    .filter(v => v > 0);
  const formTrend = linearSlope(formScores);

  // Priority: pain alert > missed sessions > form changes
  let alertType: AlertType | null = null;
  if (painTrend > 1.5)       alertType = 'pain_worsening';
  else if (missedSessions >= 2) alertType = 'missed_sessions';
  else if (formTrend > 2.0)   alertType = 'form_improving';
  else if (formTrend < -2.0)  alertType = 'form_declining';

  return { alertType, missedSessions, painTrend, formTrend };
}

// ── Haiku message generation (only called when action needed) ──────────────────

async function generateMessage(alertType: AlertType, ctx: {
  name: string;
  missedSessions?: number;
  conditionText: string;
}): Promise<string> {
  const prompts: Record<AlertType, string> = {
    missed_sessions:
      `Generate a warm, encouraging reminder for ${ctx.name} who has missed ` +
      `${ctx.missedSessions ?? 0} sessions this week. Their condition: ${ctx.conditionText}. ` +
      `Under 40 words. No clinical advice. Motivational only. Plain text, no formatting.`,

    form_improving:
      `Generate a brief congratulations message for ${ctx.name} whose exercise form ` +
      `has been improving this week. Their condition: ${ctx.conditionText}. ` +
      `Under 35 words. Warm and encouraging. Plain text.`,

    form_declining:
      `Generate a gentle check-in message for ${ctx.name} whose form trend needs attention. ` +
      `Their condition: ${ctx.conditionText}. ` +
      `Under 40 words. Do NOT diagnose. Suggest they check in with their physio. Plain text.`,

    pain_worsening:
      // Pain alerts go to clinician — generate clinical note, not patient message
      `Summarise a clinical alert: patient's pain scores have increased. ` +
      `Patient: ${ctx.name}. Condition: ${ctx.conditionText}. ` +
      `Under 30 words. Clinical language. Plain text.`,
  };

  return callClaude({
    system: 'You are PhysioCore AI generating patient communications. PDPA compliant. No diagnosis. Under word limit.',
    userMessage: prompts[alertType],
    maxTokens: 120,
    model: 'claude-haiku-4-5-20251001',
  }).catch(() => '');
}

// ── Email senders ──────────────────────────────────────────────────────────────

async function sendPatientEmail(
  toEmail: string,
  toName:  string,
  alertType: AlertType,
  message: string,
): Promise<void> {
  if (!RESEND_KEY) return;

  const subjects: Record<AlertType, string> = {
    missed_sessions: 'A quick check-in from PhysioCore AI',
    form_improving:  '🎉 Your form is improving — PhysioCore AI',
    form_declining:  'A note from your PhysioCore AI programme',
    pain_worsening:  '',  // not sent to patient
  };

  const subject = subjects[alertType];
  if (!subject) return;

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
  <div style="background:#00D4AA;padding:24px 32px;">
    <div style="font-size:1.1rem;font-weight:800;color:#000;letter-spacing:-0.02em;">PhysioCore AI</div>
    <div style="color:rgba(0,0,0,0.6);font-size:0.78rem;margin-top:2px;">Clinical intelligence for movement health</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#0f172a;font-size:1rem;font-weight:600;margin:0 0 12px;">Hi ${toName},</p>
    <p style="color:#475569;line-height:1.75;margin:0 0 24px;font-size:0.9rem;">${message}</p>
    <a href="${APP_URL}/session"
       style="display:inline-block;background:linear-gradient(135deg,#00D4AA,#4DB8FF);
              color:#000;font-weight:700;font-size:0.9rem;padding:12px 24px;
              border-radius:10px;text-decoration:none;">
      Open My Programme →
    </a>
    <p style="color:#94a3b8;font-size:0.72rem;margin:20px 0 0;line-height:1.6;">
      This is an automated message from your PhysioCore AI programme.
      If you have concerns about pain or symptoms, contact your clinician directly.
    </p>
  </div>
  <div style="padding:14px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
    <p style="color:#94a3b8;font-size:0.68rem;margin:0;">PhysioCore AI · PDPA Compliant · Singapore Region</p>
  </div>
</div>
</body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: toEmail, subject, html }),
  }).catch(() => undefined);
}

async function sendClinicianAlert(
  clinicianEmail: string,
  patientName:    string,
  alertType:      AlertType,
  message:        string,
  metrics: { painTrend: number; formTrend: number; missedSessions: number },
  orgAdminEmail?: string | null,
): Promise<void> {
  if (!RESEND_KEY || !clinicianEmail) return;

  const typeLabel: Record<AlertType, string> = {
    pain_worsening:  '⚠ Pain Worsening',
    form_declining:  '📉 Form Declining',
    missed_sessions: '📅 Missed Sessions',
    form_improving:  '✅ Form Improving',
  };

  const ccList = orgAdminEmail ? [orgAdminEmail] : undefined;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: clinicianEmail,
      ...(ccList ? { cc: ccList } : {}),
      subject: `[PhysioCore AI] ${typeLabel[alertType]} — ${patientName}`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;background:#0d1420;color:#f0f4ff;padding:28px;border-radius:12px;">
  <div style="border-left:4px solid ${alertType === 'pain_worsening' ? '#FF4444' : '#FFB830'};padding-left:14px;margin-bottom:20px;">
    <h2 style="margin:0;color:${alertType === 'pain_worsening' ? '#FF4444' : '#FFB830'};font-size:1rem;">${typeLabel[alertType]}</h2>
    <p style="color:#8892a4;margin:4px 0 0;font-size:0.82rem;">Patient: ${patientName}</p>
  </div>
  <p style="color:#f0f4ff;line-height:1.7;font-size:0.88rem;">${message}</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:0.82rem;">
    <tr><td style="color:#8892a4;padding:6px 0;">Pain trend (last 6 scores)</td><td style="color:#f0f4ff;font-family:monospace;">${metrics.painTrend > 0 ? '+' : ''}${metrics.painTrend.toFixed(1)}/10</td></tr>
    <tr><td style="color:#8892a4;padding:6px 0;">Form trend (slope/session)</td><td style="color:#f0f4ff;font-family:monospace;">${metrics.formTrend > 0 ? '+' : ''}${metrics.formTrend.toFixed(1)}</td></tr>
    <tr><td style="color:#8892a4;padding:6px 0;">Missed sessions this week</td><td style="color:#f0f4ff;font-family:monospace;">${metrics.missedSessions}</td></tr>
  </table>
  <a href="${APP_URL}/clinician" style="display:inline-block;background:#00D4AA;color:#000;font-weight:700;font-size:0.85rem;padding:10px 20px;border-radius:8px;text-decoration:none;">Review in Clinician Dashboard →</a>
  <p style="color:#4a5568;font-size:0.7rem;margin-top:20px;">PhysioCore AI Autonomous Monitor · ${new Date().toISOString()} · PDPA Compliant</p>
</div>`,
    }),
  }).catch(() => undefined);
}

// ── Admin summary email (aggregate only — PDPA compliant) ─────────────────────

async function sendAdminSummary(opts: {
  date:           string;
  processed:      number;
  acted:          number;
  missedSessions: number;
  painAlerts:     number;
  orgNames:       string[];
  errors:         number;
}): Promise<void> {
  if (!RESEND_KEY) return;
  const subject = `PhysioCore Daily Monitor — ${opts.date}`;
  const body = [
    'Platform Summary:',
    `Processed: ${opts.processed} patients`,
    `Acted: ${opts.acted} (missed sessions: ${opts.missedSessions}, pain alerts: ${opts.painAlerts})`,
    `Orgs affected: ${opts.orgNames.length > 0 ? opts.orgNames.join(', ') : 'none'}`,
    `Errors: ${opts.errors}`,
    '',
    `Pain alerts sent to clinicians: ${opts.painAlerts}`,
    '— No patient names or health data in this summary —',
  ].join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject, text: body }),
  }).catch(() => undefined);
}

// ── Supabase helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertAlert(sb: any, decision: PatientDecision, message: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await sb.from('monitoring_alerts').insert({
      user_id:    decision.userId,
      alert_type: decision.alertType,
      message,
      sent_to:    decision.sentTo,
      severity:   decision.alertType === 'pain_worsening' ? 'urgent'
                : decision.alertType === 'missed_sessions' ? 'warning' : 'info',
      metadata: {
        missedSessions: decision.missedSessions,
        painTrend:      decision.painTrend,
        formTrend:      decision.formTrend,
        actualSessions: decision.actualSessions,
        targetPerWeek:  decision.targetPerWeek,
      },
    });
  } catch { /* non-fatal — table may not exist yet */ }
}

// ── Per-patient processing ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPatient(sb: any, patient: PatientRow, emailMap: Map<string, string>): Promise<{
  decision: PatientDecision | null;
  error: string | null;
}> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Batch: sessions (last 14 days for slope) + outcomes (last 6 pain scores) + user_profile
    const [sessionsRes, outcomesRes, profileRes, clinicianRes, orgAdminRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      sb.from('sessions')
        .select('created_at, avg_score')
        .eq('user_id', patient.user_id)
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })
        .limit(20) as Promise<{ data: SessionRow[] | null }>,

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      sb.from('outcomes')
        .select('recorded_at, score, type')
        .eq('user_id', patient.user_id)
        .in('type', ['nprs_post', 'pain', 'nprs'])
        .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: true })
        .limit(12) as Promise<{ data: OutcomeRow[] | null }>,

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      sb.from('user_profiles')
        .select('name, first_name, conditions, primary_goal')
        .eq('user_id', patient.user_id)
        .single() as Promise<{ data: UserProfileRow | null }>,

      // Find clinician in same org (if org exists)
      patient.org_id
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        ? sb.from('profiles')
            .select('user_id')
            .eq('org_id', patient.org_id)
            .in('role', ['clinician', 'admin'])
            .limit(1) as Promise<{ data: Array<{ user_id: string }> | null }>
        : Promise.resolve({ data: null }),

      // Find org admin to CC on clinician alerts
      patient.org_id
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        ? sb.from('profiles')
            .select('user_id')
            .eq('org_id', patient.org_id)
            .eq('role', 'admin')
            .limit(1) as Promise<{ data: Array<{ user_id: string }> | null }>
        : Promise.resolve({ data: null }),
    ]);

    const sessions   = (sessionsRes.data  ?? []) as SessionRow[];
    const outcomes   = (outcomesRes.data  ?? []) as OutcomeRow[];
    const profile    = profileRes.data as UserProfileRow | null;
    const clinicians = clinicianRes.data as Array<{ user_id: string }> | null;
    const orgAdmins  = (orgAdminRes as { data: Array<{ user_id: string }> | null }).data;

    const name = profile?.name ?? profile?.first_name ?? 'there';

    // Skip test / dev profiles by display name
    if (name.includes('Doc contact') || name.includes('DevDoctor')) return { decision: null, error: null };

    // Require at least 1 real session before monitoring starts
    if (sessions.length === 0) return { decision: null, error: null };

    // Conditions for Haiku context (first condition name or generic)
    const conditionText = Array.isArray(profile?.conditions) && profile.conditions.length > 0
      ? String((profile.conditions[0] as Record<string, unknown>)?.name ?? 'general rehabilitation')
      : 'general rehabilitation';

    // Target sessions/week — query treatment_plans if available, else default 3
    let targetPerWeek = 3;
    try {
      const { data: plan } = (await sb.from('treatment_plans')
        .select('session_frequency')
        .eq('patient_id', patient.user_id)
        .eq('status', 'active')
        .single()) as unknown as { data: { session_frequency: number } | null };
      if (plan?.session_frequency) targetPerWeek = plan.session_frequency;
    } catch { /* no treatment plan — use default */ }

    const { alertType, missedSessions, painTrend, formTrend } = decide(sessions, outcomes, targetPerWeek);

    // Nothing to do for this patient
    if (!alertType) return { decision: null, error: null };

    // Skip if we already sent this patient an alert today (dedup)
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data: recentAlert } = (await sb.from('monitoring_alerts')
        .select('id')
        .eq('user_id', patient.user_id)
        .gte('created_at', todayStart.toISOString())
        .limit(1)) as unknown as { data: unknown[] | null };
      if (recentAlert && recentAlert.length > 0) return { decision: null, error: null };
    } catch { /* table may not exist yet — continue */ }

    const recentSessions = sessions.filter(
      s => new Date(s.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );

    const clinicianUserId = clinicians?.[0]?.user_id ?? null;
    const clinicianEmail  = clinicianUserId ? (emailMap.get(clinicianUserId) ?? null) : null;
    const orgAdminUserId  = orgAdmins?.[0]?.user_id ?? null;
    const orgAdminEmail   = orgAdminUserId && orgAdminUserId !== clinicianUserId
      ? (emailMap.get(orgAdminUserId) ?? null)
      : null;
    const patientEmail    = emailMap.get(patient.user_id) ?? null;

    if (!patientEmail) return { decision: null, error: `No email for ${patient.user_id}` };

    const sentTo: SentTo = alertType === 'pain_worsening' ? 'clinician'
      : alertType === 'form_declining' && clinicianEmail ? 'clinician'
      : 'patient';

    return {
      decision: {
        userId: patient.user_id,
        email: patientEmail,
        name,
        alertType,
        sentTo,
        missedSessions,
        painTrend: Math.round(painTrend * 100) / 100,
        formTrend: Math.round(formTrend * 100) / 100,
        targetPerWeek,
        actualSessions: recentSessions.length,
        conditionText,
        clinicianEmail,
        orgId:         patient.org_id,
        orgAdminEmail,
      },
      error: null,
    };
  } catch (e) {
    return { decision: null, error: String(e) };
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth — Vercel Cron sends Authorization: Bearer {CRON_SECRET} automatically
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${CRON_SECRET}` && process.env['NODE_ENV'] !== 'development') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const summary: RunSummary = { processed: 0, acted: 0, skipped: 0, errors: [], actions: [] };
  const actedDecisions: PatientDecision[] = [];

  try {
    // 1. Fetch all active patients
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { data: patients, error: pErr } = await (sb as any)
      .from('profiles')
      .select('user_id, org_id')
      .eq('role', 'patient') as Promise<{ data: PatientRow[] | null; error: unknown }>;

    if (pErr || !patients?.length) {
      return res.status(200).json({ ...summary, note: 'No active patients or DB error', error: String(pErr) });
    }

    // 2. Build email lookup map from auth.users (single admin API call)
    const emailMap = new Map<string, string>();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const { data: { users } } = await (sb as any).auth.admin.listUsers({ perPage: 1000 }) as {
        data: { users: Array<{ id: string; email?: string; created_at?: string }> };
      };
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      for (const u of users) {
        if (!u.email) continue;
        const email = u.email.toLowerCase();
        // Skip test / dev accounts
        if (email.includes('test') || email.includes('dev@live')) continue;
        // Skip accounts created in the last 24 hours
        if (u.created_at && new Date(u.created_at).getTime() > oneDayAgo) continue;
        emailMap.set(u.id, u.email);
      }
    } catch (e) {
      summary.errors.push(`emailMap: ${String(e)}`);
    }

    // 3. Process each patient sequentially (rate-limit friendly)
    for (const patient of patients) {
      summary.processed++;
      const { decision, error } = await processPatient(sb, patient, emailMap);

      if (error) { summary.errors.push(error); summary.skipped++; continue; }
      if (!decision?.alertType) { summary.skipped++; continue; }

      // 4. Generate message text via Haiku (only for actionable alerts)
      const message = await generateMessage(decision.alertType, {
        name:           decision.name,
        missedSessions: decision.missedSessions,
        conditionText:  decision.conditionText,
      });

      // 5. Send to correct recipient
      if (decision.sentTo === 'patient') {
        await sendPatientEmail(decision.email, decision.name, decision.alertType, message);
      } else if (decision.sentTo === 'clinician' && decision.clinicianEmail) {
        await sendClinicianAlert(
          decision.clinicianEmail,
          decision.name,
          decision.alertType,
          message,
          { painTrend: decision.painTrend, formTrend: decision.formTrend, missedSessions: decision.missedSessions },
          decision.orgAdminEmail,
        );
      }

      // 6. Audit log to Supabase
      await insertAlert(sb, decision, message);

      summary.acted++;
      actedDecisions.push(decision);
      summary.actions.push({
        userId:    decision.userId,
        alertType: decision.alertType,
        sentTo:    decision.sentTo,
      });
    }

    // Send PDPA-compliant aggregate summary to platform admin
    const actedOrgIds = [...new Set(actedDecisions.map(d => d.orgId).filter(Boolean))] as string[];
    let orgNames: string[] = actedOrgIds;
    if (actedOrgIds.length > 0) {
      try {
        const { data: orgs } = await (sb as any)
          .from('organisations')
          .select('id, name')
          .in('id', actedOrgIds) as Promise<{ data: Array<{ id: string; name: string }> | null }>;
        if (orgs?.length) orgNames = orgs.map(o => o.name);
      } catch { /* fallback: use org_ids */ }
    }
    const painAlerts = actedDecisions.filter(d => d.alertType === 'pain_worsening').length;
    const missedCount = actedDecisions.filter(d => d.alertType === 'missed_sessions').length;
    await sendAdminSummary({
      date:           new Date().toISOString().split('T')[0]!,
      processed:      summary.processed,
      acted:          summary.acted,
      missedSessions: missedCount,
      painAlerts,
      orgNames,
      errors:         summary.errors.length,
    }).catch(() => undefined);

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });

  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: String(e),
      ...summary,
    });
  }
}

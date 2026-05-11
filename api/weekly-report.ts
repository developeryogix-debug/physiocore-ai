import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { callClaude } from './_lib/claude.js';
import { sendWeeklyReport } from './_lib/email.js';

function weekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString().slice(0, 10);
}

export async function GET(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env['CRON_SECRET'] ?? ''}` && process.env['NODE_ENV'] !== 'development') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const since = weekStart();

  // Collect metrics in parallel
  const [sessionsResult, usersResult, healthResult, errorsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('sessions').select('form_score').gte('date', since),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', since),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('health_checks').select('service,error_msg').eq('status', 'fail').gte('checked_at', since),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('health_checks').select('error_msg').eq('status', 'fail').gte('checked_at', since).limit(5),
  ]);

  const sessions = (sessionsResult.data as Array<{ form_score: number }>) ?? [];
  const sessionCount = sessions.length;
  const avgFormScore = sessionCount > 0
    ? Math.round(sessions.reduce((s, r) => s + (r.form_score ?? 0), 0) / sessionCount)
    : 0;
  const newUsers = (usersResult.count as number) ?? 0;
  const healthFailures = ((healthResult.data as unknown[]) ?? []).length;
  const topErrors = [...new Set(
    ((errorsResult.data as Array<{ error_msg: string }>) ?? []).map(r => r.error_msg).filter(Boolean)
  )].slice(0, 3);

  const userMsg = `Week starting ${since}:
Sessions: ${sessionCount}
Avg form score: ${avgFormScore}/100
New signups: ${newUsers}
Health check failures: ${healthFailures}
Top errors: ${topErrors.join(', ') || 'none'}

Give a 5-line executive summary and 3 specific priorities for this week. JSON: {"summary":string,"priorities":[string,string,string]}`;

  let summary = 'Strong week overall. Keep monitoring session quality and user onboarding.';
  let priorities = ['Review session feedback quality', 'Monitor API costs', 'Ship next feature'];

  try {
    const text = await callClaude({
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 400,
      system: 'You are the CTO of PhysioCore AI reviewing weekly metrics. Be direct, no fluff. Respond ONLY in JSON: {"summary":string,"priorities":[string,string,string]}',
      userMessage: userMsg,
    });
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { summary?: string; priorities?: string[] };
    if (parsed.summary) summary = parsed.summary;
    if (parsed.priorities?.length) priorities = parsed.priorities;
  } catch {
    // Use defaults if Claude fails
  }

  try {
    await sendWeeklyReport({
      weekOf: since,
      sessions: sessionCount,
      avgFormScore,
      newUsers,
      healthFailures,
      topErrors,
      summary,
      priorities,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to send weekly report email' });
  }

  return res.status(200).json({ sent: true, weekOf: since, sessions: sessionCount, newUsers, healthFailures });
}

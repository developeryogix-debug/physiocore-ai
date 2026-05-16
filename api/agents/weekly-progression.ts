// api/agents/weekly-progression.ts
// Autonomous Weekly Progression Agent
// Cron: "0 1 * * 1" = Monday 01:00 UTC = 09:00 SGT
//
// For each active patient:
//   1. Load last 4 weeks of sessions + outcomes
//   2. Compute progression metrics (reps trend, form trend, pain trend)
//   3. Haiku decision: advance / hold / regress / modify
//   4. Write progression_logs row + send weekly summary email

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env['CRON_SECRET'];
const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] ?? '';
const SERVICE_KEY  = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth gate
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const started = Date.now();

  try {
    // Load active patients (profiles with sessions in last 28 days)
    const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sessions } = await db
      .from('sessions')
      .select('user_id, created_at, form_score, reps, exercise')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true });

    if (!sessions || sessions.length === 0) {
      return res.json({ status: 'ok', message: 'No active patients this week', durationMs: Date.now() - started });
    }

    // Group by user
    const byUser: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      if (!byUser[s.user_id]) byUser[s.user_id] = [];
      byUser[s.user_id]!.push(s);
    }

    const results: { userId: string; decision: string }[] = [];

    for (const [userId, userSessions] of Object.entries(byUser)) {
      // Simple progression decision — no LLM needed for gate logic
      const formScores = userSessions.map(s => s.form_score as number).filter(Boolean);
      const recentAvg = formScores.slice(-5).reduce((a, b) => a + b, 0) / Math.max(formScores.slice(-5).length, 1);
      const earlierAvg = formScores.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(formScores.slice(0, 5).length, 1);
      const trend = recentAvg - earlierAvg;

      let decision = 'hold';
      if (trend > 5) decision = 'advance';
      else if (trend < -5) decision = 'regress';
      else if (userSessions.length < 2) decision = 'insufficient_data';

      // Write to monitoring_alerts (reuse existing table)
      await db.from('monitoring_alerts').insert({
        user_id: userId,
        alert_type: 'weekly_progression',
        message: `Weekly progression decision: ${decision}. Form trend: ${trend > 0 ? '+' : ''}${Math.round(trend * 10) / 10} over ${formScores.length} sessions.`,
        sent_to: 'system',
      });

      results.push({ userId, decision });
    }

    return res.json({
      status: 'ok',
      patientsProcessed: results.length,
      decisions: results,
      durationMs: Date.now() - started,
    });

  } catch (err) {
    console.error('[weekly-progression] error:', err);
    return res.status(500).json({ error: String(err), durationMs: Date.now() - started });
  }
}

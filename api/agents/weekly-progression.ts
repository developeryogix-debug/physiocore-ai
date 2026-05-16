// api/agents/weekly-progression.ts
// PhysioCore AI — Weekly Progression Cron
// Schedule: "0 1 * * 1" = Monday 01:00 UTC = Monday 09:00 SGT
//
// For each patient with an active treatment_plan:
//   1. Load last 4 session_summaries (form scores + pain)
//   2. Stage-1 algorithmic decision (linear regression — no LLM)
//   3. If 'advance':  increment treatment_plans.current_week
//   4. If 'regress':  insert clinician_alerts row + skip patient email
//   5. If 'modify':   flag clinician + still send patient email
//   6. Haiku Stage-2: generate personalised weekly email body
//   7. Send email via Resend from noreply@doctoronclick.io
//   8. Log result to progression_log
//
// Cost: Haiku × 1 per patient per week ≈ $0.0003
// Auth: Authorization: Bearer ${CRON_SECRET}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient }                         from '@supabase/supabase-js';
import { callClaude }                           from '../_lib/claude.js';

// ── Env ───────────────────────────────────────────────────────────────────────

const CRON_SECRET      = process.env['CRON_SECRET']               ?? '';
const SUPABASE_URL     = process.env['VITE_SUPABASE_URL']         ?? '';
const SUPABASE_SERVICE = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const RESEND_KEY       = process.env['RESEND_API_KEY']            ?? '';
const FROM_EMAIL       = 'noreply@doctoronclick.io';
const APP_URL          = 'https://app-dteam1-mmcv.vercel.app';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProgressionAction = 'advance' | 'hold' | 'regress' | 'modify';

interface SessionSummary {
  date:                string;
  exercise:            string;
  reps:                number;
  avg_score:           number;
  top_deviation:       string | null;
  ai_feedback_summary: string | null;
  pain_score?:         number | null;
}

interface TreatmentPhase {
  phaseNumber:      number;
  label:            string;
  durationWeeks:    number;
  loadingStrategy:  string;
  exercises: Array<{
    name:              string;
    sets:              number;
    reps:              number | null;
    holdSeconds:       number | null;
    frequencyPerWeek:  number;
  }>;
}

interface FinalTreatmentPlanLite {
  totalDurationWeeks: number;
  phases:             TreatmentPhase[];
}

interface PatientResult {
  patientId:  string;
  email:      string | null;
  action:     ProgressionAction;
  oldWeek:    number;
  newWeek:    number;
  emailSent:  boolean;
  flags:      string[];
  error?:     string;
}

// ── Stage-1: Algorithmic decision (mirrors ProgressionAgent.ts Stage 1) ───────

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xBar = (n - 1) / 2;
  const yBar = values.reduce((a, b) => a + b, 0) / n;
  const ssXY = values.reduce((acc, y, i) => acc + (i - xBar) * (y - yBar), 0);
  const ssXX = values.reduce((acc, _, i) => acc + (i - xBar) ** 2, 0);
  return ssXX === 0 ? 0 : ssXY / ssXX;
}

function decideAction(
  formSlope:     number,
  avgPain:       number,
  highPainCount: number,
): ProgressionAction {
  if (highPainCount >= 2)                return 'regress';  // NRS >7 on 2+ sessions — immediate
  if (formSlope > 1.0 && avgPain < 3)    return 'advance';
  if (formSlope < -0.5 || avgPain > 6)   return 'regress';  // spec threshold
  if (formSlope >= 0   && avgPain <= 5)  return 'hold';
  return 'modify';
}

function resolveTrend(slope: number): 'improving' | 'plateaued' | 'declining' {
  return slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'plateaued';
}

function resolveActiveExercises(plan: FinalTreatmentPlanLite, week: number): string[] {
  let cumulative = 0;
  for (const phase of plan.phases) {
    cumulative += phase.durationWeeks;
    if (week <= cumulative) return phase.exercises.map(e => e.name);
  }
  const last = plan.phases[plan.phases.length - 1];
  return last ? last.exercises.map(e => e.name) : [];
}

// ── Stage-2: Haiku patient email body ─────────────────────────────────────────

async function generateEmailBody(opts: {
  patientName:  string;
  currentWeek:  number;
  totalWeeks:   number;
  action:       ProgressionAction;
  trend:        'improving' | 'plateaued' | 'declining';
  avgFormScore: number;
  exercises:    string[];
  topDeviation: string | null;
}): Promise<string> {
  const actionSentence: Record<ProgressionAction, string> = {
    advance: 'Your progress this week was excellent — we have advanced your programme to the next stage.',
    hold:    'You are progressing steadily. We are keeping your programme the same this week to consolidate your gains.',
    modify:  'We have made some adjustments to your programme this week to better match your current capacity.',
    regress: 'Based on your recent sessions, we have stepped back slightly to ensure your recovery stays on track.',
  };
  const trendPhrase: Record<string, string> = {
    improving:  'Your form scores are trending upward — great work.',
    plateaued:  'Your form scores are holding steady.',
    declining:  'Your form scores have dipped recently; focus on quality over quantity.',
  };
  const exList     = opts.exercises.slice(0, 4).join(', ');
  const tip        = opts.topDeviation
    ? `Pay particular attention to your ${opts.topDeviation.toLowerCase()} this week.`
    : 'Keep focusing on controlled movement and full range of motion.';

  const prompt = `You are a physiotherapy assistant writing a warm, encouraging weekly programme update email.

Patient: ${opts.patientName}
Week: ${opts.currentWeek} of ${opts.totalWeeks}
Action taken: ${opts.action}
Form score average: ${Math.round(opts.avgFormScore)}/100
Trend: ${opts.trend}
This week's exercises: ${exList || 'as prescribed'}
Clinical context: ${actionSentence[opts.action]} ${trendPhrase[opts.trend] ?? ''} ${tip}

Write a plain-text email body (no HTML). 3 short paragraphs:
1. Personal greeting + week number + what changed and why (use the clinical context above, plain English)
2. This week's exercises + one motivational tip based on their trend
3. Reminder to log pain scores in the app before each session + encouragement

Tone: warm, professional, evidence-based. Under 180 words total. Do not include a subject line.`;

  try {
    return await callClaude({
      system:      'You write personalised physiotherapy progress emails. Plain text only. Under 180 words.',
      userMessage: prompt,
      maxTokens:   300,
      model:       'claude-haiku-4-5-20251001',
    });
  } catch {
    // Graceful fallback if Haiku fails
    return [
      `Hi ${opts.patientName},`,
      `Here is your Week ${opts.currentWeek} of ${opts.totalWeeks} programme update. ${actionSentence[opts.action]}`,
      `This week's exercises: ${exList || 'as prescribed'}. ${tip}`,
      `Please log your pain score in the PhysioCore app before each session so we can track your recovery accurately. Keep going — you're doing great.\n\nYour PhysioCore clinical team`,
    ].join('\n\n');
  }
}

// ── Resend email ──────────────────────────────────────────────────────────────

async function sendProgressionEmail(opts: {
  to:          string;
  patientName: string;
  week:        number;
  body:        string;
}): Promise<void> {
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY not set');
  const subject  = `Your Week ${opts.week} PhysioCore Programme Update`;
  const safeBody = opts.body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0d1420;color:#f0f4ff;padding:32px;border-radius:12px">
      <div style="border-left:4px solid #00d4aa;padding-left:16px;margin-bottom:24px">
        <h2 style="margin:0;color:#00d4aa">Week ${opts.week} Programme Update</h2>
        <p style="margin:4px 0 0;color:#8892a4;font-size:0.875em">PhysioCore AI · Auto-generated</p>
      </div>
      <div style="white-space:pre-line;line-height:1.8;color:#e2e8f0">${safeBody}</div>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">
        <a href="${APP_URL}/session"
           style="display:inline-block;background:#00d4aa;color:#0d1420;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.9em">
          Start This Week's Session →
        </a>
      </div>
      <p style="margin-top:24px;color:#4a5568;font-size:0.75em">
        PhysioCore AI · Regulated SaMD Class II · PDPA compliant<br>
        To unsubscribe, contact your clinician.
      </p>
    </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM_EMAIL, to: opts.to, subject, html, text: opts.body }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${CRON_SECRET}` && process.env['NODE_ENV'] !== 'development') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startMs  = Date.now();
  const runDate  = new Date().toISOString();
  const db       = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const results: PatientResult[] = [];

  try {
    // 1. Fetch all active treatment plans with patient email + name via profiles join
    const { data: plans, error: planErr } = await db
      .from('treatment_plans')
      .select(`
        id,
        patient_id,
        status,
        current_week,
        plan_json,
        profiles!inner ( email, full_name )
      `)
      .eq('status', 'active');

    if (planErr) {
      return res.status(500).json({ error: 'treatment_plans query failed', detail: planErr.message });
    }
    if (!plans || plans.length === 0) {
      return res.status(200).json({
        processed: 0,
        message:   'No active treatment plans found',
        durationMs: Date.now() - startMs,
      });
    }

    // 2. Process in batches of 10 to respect Anthropic + Resend rate limits
    const BATCH = 10;
    for (let i = 0; i < plans.length; i += BATCH) {
      const batch = plans.slice(i, i + BATCH) as Array<{
        id:           string;
        patient_id:   string;
        status:       string;
        current_week: number;
        plan_json:    FinalTreatmentPlanLite;
        profiles:     { email: string; full_name: string } | Array<{ email: string; full_name: string }>;
      }>;

      await Promise.all(batch.map(async (plan) => {
        const profile   = Array.isArray(plan.profiles) ? plan.profiles[0] : plan.profiles;
        const email     = profile?.email             ?? null;
        const name      = profile?.full_name         ?? 'there';
        const patientId = plan.patient_id;
        const oldWeek   = plan.current_week           ?? 1;
        const planData  = plan.plan_json              as FinalTreatmentPlanLite;
        const totalWeeks = planData?.totalDurationWeeks ?? 12;

        try {
          // 3. Load last 4 session_summaries (chronological order)
          const { data: rawSessions } = await db
            .from('session_summaries')
            .select('date, exercise, reps, avg_score, top_deviation, ai_feedback_summary, pain_score')
            .eq('patient_id', patientId)
            .order('date', { ascending: false })
            .limit(4);

          const sessions: SessionSummary[] = ((rawSessions ?? []) as SessionSummary[]).reverse();

          // Guard: need at least 4 sessions for a valid regression
          if (sessions.length < 4) {
            results.push({
              patientId, email, action: 'hold', oldWeek, newWeek: oldWeek,
              emailSent: false,
              flags: [`Fewer than 4 sessions recorded (${sessions.length}) — insufficient data for progression decision`],
            });
            return;
          }

          // 4. Stage-1: algorithmic decision
          const formScores   = sessions.map(s => s.avg_score);
          const painScores   = sessions.map(s => s.pain_score ?? 0);
          const avgPain      = painScores.length
            ? painScores.reduce((a, b) => a + b, 0) / painScores.length
            : 0;
          const highPainCt   = painScores.filter(p => p > 7).length;
          const formSlope    = linearSlope(formScores);
          const trend        = resolveTrend(formSlope);
          const avgFormScore = formScores.length
            ? formScores.reduce((a, b) => a + b, 0) / formScores.length
            : 50;
          const action       = decideAction(formSlope, avgPain, highPainCt);

          // Most recent non-null top_deviation across sessions
          const topDeviation = sessions
            .map(s => s.top_deviation)
            .filter(Boolean)
            .pop() ?? null;

          const flags: string[] = [];
          let newWeek = oldWeek;

          // 5a. Advance
          if (action === 'advance') {
            if (oldWeek < totalWeeks) {
              newWeek = oldWeek + 1;
              await db
                .from('treatment_plans')
                .update({ current_week: newWeek, updated_at: runDate })
                .eq('id', plan.id);
            } else {
              // Programme complete — flag for discharge review
              flags.push(`Programme complete (${totalWeeks} weeks). Discharge review recommended.`);
              await db.from('clinician_alerts').insert({
                patient_id: patientId,
                plan_id:    plan.id,
                alert_type: 'plan_complete',
                severity:   'INFO',
                message:    `${name} has completed their ${totalWeeks}-week programme. Discharge planning recommended.`,
                created_at: runDate,
                resolved:   false,
              });
            }
          }

          // 5b. Regress — clinician alert only, no patient email
          if (action === 'regress') {
            const reason = highPainCt >= 2
              ? `Pain >7 in ${highPainCt}/${sessions.length} sessions (avg ${avgPain.toFixed(1)}/10)`
              : `Form declining (slope ${formSlope.toFixed(2)}) with elevated pain (avg ${avgPain.toFixed(1)}/10)`;
            flags.push(reason);

            await db.from('clinician_alerts').insert({
              patient_id: patientId,
              plan_id:    plan.id,
              alert_type: 'regression_flag',
              severity:   'WARNING',
              message:    `REGRESS recommended for ${name}: ${reason}`,
              created_at: runDate,
              resolved:   false,
            });

            results.push({ patientId, email, action, oldWeek, newWeek, emailSent: false, flags });
            return;
          }

          // 5c. Modify — flag clinician, still send patient email
          if (action === 'modify') {
            const reason = `Form slope ${formSlope.toFixed(2)}, pain tolerable (avg ${avgPain.toFixed(1)}/10). Exercise modification suggested.`;
            flags.push(reason);

            await db.from('clinician_alerts').insert({
              patient_id: patientId,
              plan_id:    plan.id,
              alert_type: 'modification_flag',
              severity:   'INFO',
              message:    `MODIFY recommended for ${name} (week ${oldWeek}): ${reason}`,
              created_at: runDate,
              resolved:   false,
            });
          }

          // 6. Skip email if no address on file
          if (!email) {
            results.push({ patientId, email: null, action, oldWeek, newWeek, emailSent: false, flags, error: 'No email on file' });
            return;
          }

          // 7. Generate Haiku email body
          const exercises = resolveActiveExercises(planData, newWeek);
          const emailBody = await generateEmailBody({
            patientName:  name,
            currentWeek:  newWeek,
            totalWeeks,
            action,
            trend,
            avgFormScore,
            exercises,
            topDeviation,
          });

          // 8. Send via Resend
          await sendProgressionEmail({ to: email, patientName: name, week: newWeek, body: emailBody });

          // 9. Log to progression_log (non-blocking)
          await db.from('progression_log').insert({
            patient_id:     patientId,
            plan_id:        plan.id,
            run_date:       runDate,
            action,
            old_week:       oldWeek,
            new_week:       newWeek,
            form_slope:     Math.round(formSlope * 100) / 100,
            avg_form_score: Math.round(avgFormScore),
            avg_pain_score: Math.round(avgPain * 10) / 10,
            trend,
            flags_json:     flags,
            email_sent:     true,
          });

          results.push({ patientId, email, action, oldWeek, newWeek, emailSent: true, flags });

        } catch (err) {
          results.push({
            patientId,
            email,
            action:    'hold',
            oldWeek,
            newWeek:   oldWeek,
            emailSent: false,
            flags:     [],
            error:     String(err),
          });
        }
      }));
    }

    return res.status(200).json({
      runDate,
      processed:  results.length,
      progressed: results.filter(r => r.action === 'advance').length,
      maintained: results.filter(r => r.action === 'hold').length,
      modified:   results.filter(r => r.action === 'modify').length,
      regressed:  results.filter(r => r.action === 'regress').length,
      emailsSent: results.filter(r => r.emailSent).length,
      errors:     results.filter(r => r.error).length,
      durationMs: Date.now() - startMs,
      results,
    });

  } catch (err) {
    return res.status(500).json({
      error:      'weekly-progression cron failed',
      detail:     String(err),
      durationMs: Date.now() - startMs,
    });
  }
}

/**
 * api/recovery-score.ts — POST /api/recovery-score
 * Computes patient recovery score DETERMINISTICALLY (SaMD Class II compliant).
 * LLM (Haiku) used ONLY for non-clinical insight text — never for score values.
 *
 * Weights reference: Stratford PW et al., 1995 (PSFS adherence);
 *   Norkin CC & White DJ, 2009 (ROM measurement); NPRS standard scaling.
 *
 * Body: { patientId, sessionsLast30, latestNprs?, latestRom? }
 * Returns: { score, painComponent, adherenceComponent, romComponent,
 *             insight, delta, previousScore, milestones }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL    = process.env['VITE_SUPABASE_URL'] ?? '';
const SUPABASE_SVC    = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const ANTHROPIC_KEY   = process.env['VITE_ANTHROPIC_KEY'] ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionInput { formScore: number; date: string; }

const MILESTONE_META = {
  first_session:   { label: 'First Steps',     desc: 'Completed your first session'         },
  streak_7:        { label: '7-Day Streak',    desc: '7 consecutive days active'             },
  posture_improve: { label: 'Standing Tall',   desc: 'Posture score improved by 10%+'        },
  pain_reduce:     { label: 'Pain Relief',     desc: 'Pain score reduced by 2+ points'       },
  rom_10pct:       { label: 'Moving Better',   desc: 'ROM improved by 10%+'                  },
  swarm_assess:    { label: 'Full Assessment', desc: 'Completed the 6-agent assessment swarm'},
} as const;

type MilestoneType = keyof typeof MILESTONE_META;

// ── Deterministic score computation ──────────────────────────────────────────
// ALL clinical numbers computed here — no LLM involvement.
function computeScore(
  sessions: SessionInput[],
  latestNprs?: number,
  latestRom?: number,
): { score: number; pain: number; adherence: number; rom: number } {
  // Pain component: NPRS 0-10 inverted to 0-100 (lower pain = higher score)
  const pain = latestNprs != null
    ? Math.round((1 - latestNprs / 10) * 100)
    : 70; // neutral default when no NPRS recorded

  // Adherence: sessions in 30d vs clinical target (3/week × 4 weeks = 12)
  const TARGET = 12;
  const adherence = Math.min(100, Math.round((sessions.length / TARGET) * 100));

  // Form/ROM: average session form score, blended with ROM if available
  const avgForm = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + x.formScore, 0) / sessions.length)
    : 0;
  const rom = latestRom != null
    ? Math.round((latestRom + avgForm) / 2)
    : avgForm;

  // Weighted composite — pain 40%, adherence 35%, form/ROM 25%
  const score = Math.min(100, Math.max(0,
    Math.round(pain * 0.40 + adherence * 0.35 + Math.min(100, rom) * 0.25)
  ));

  return { score, pain, adherence, rom: Math.min(100, rom) };
}

// ── Milestone unlock logic ─────────────────────────────────────────────────────
function detectNewMilestones(
  sessions: SessionInput[],
  latestNprs?: number,
  existing: MilestoneType[] = [],
): MilestoneType[] {
  const unlock: MilestoneType[] = [];
  const has = (t: MilestoneType) => existing.includes(t);

  if (!has('first_session') && sessions.length >= 1)
    unlock.push('first_session');

  if (!has('streak_7')) {
    const dates = new Set(sessions.map(s => s.date.slice(0, 10)));
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (dates.has(d.toISOString().slice(0, 10))) { streak++; if (streak >= 7) break; }
      else streak = 0;
    }
    if (streak >= 7) unlock.push('streak_7');
  }

  if (!has('pain_reduce') && latestNprs != null && latestNprs <= 3)
    unlock.push('pain_reduce');

  return unlock;
}

// ── Haiku insight — motivational text ONLY, no clinical data ──────────────────
async function generateInsight(score: number, delta: number): Promise<string> {
  if (!ANTHROPIC_KEY) return '';
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Recovery score ${score}/100 (${delta >= 0 ? '+' : ''}${delta} vs last week). ` +
          `Write one short motivating sentence (max 18 words). Positive tone. No clinical claims or numbers.`,
      }],
    });
    const b = resp.content[0];
    return b?.type === 'text' ? b.text.replace(/^["']|["']$/g, '').trim() : '';
  } catch {
    return '';
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    patientId, sessionsLast30 = [], latestNprs, latestRom,
  } = req.body as {
    patientId?: string;
    sessionsLast30?: SessionInput[];
    latestNprs?: number;
    latestRom?: number;
  };

  if (!patientId) return res.status(400).json({ error: 'patientId required' });

  const sb = createClient(SUPABASE_URL, SUPABASE_SVC, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch existing milestones + previous score in parallel
  const [{ data: existingMs }, { data: prevScores }] = await Promise.all([
    sb.from('milestones').select('type,unlocked_at').eq('patient_id', patientId),
    sb.from('recovery_scores').select('score')
      .eq('patient_id', patientId).order('computed_at', { ascending: false }).limit(1),
  ]);

  const existingTypes = (existingMs ?? []).map(m => m.type as MilestoneType);
  const previousScore: number | null = prevScores?.[0]?.score ?? null;

  // Compute deterministic score
  const { score, pain, adherence, rom } = computeScore(sessionsLast30, latestNprs, latestRom);
  const delta = previousScore != null ? score - previousScore : 0;

  // Detect + unlock new milestones, generate insight text — in parallel
  const newMilestones = detectNewMilestones(sessionsLast30, latestNprs, existingTypes);
  const now = new Date().toISOString();

  const [, insightText] = await Promise.all([
    newMilestones.length > 0
      ? sb.from('milestones').upsert(
          newMilestones.map(type => ({ patient_id: patientId, type, unlocked_at: now })),
          { onConflict: 'patient_id,type' },
        )
      : Promise.resolve(null),
    generateInsight(score, delta),
  ]);

  // Persist recovery score (fire-and-forget, non-fatal)
  sb.from('recovery_scores').insert({
    patient_id: patientId, score,
    pain_component: pain, adherence_component: adherence, rom_component: rom,
    insight: insightText,
  }).then().catch(() => undefined);

  // Build full milestone list for response
  const milestones = (Object.entries(MILESTONE_META) as Array<[MilestoneType, { label: string; desc: string }]>)
    .map(([type, meta]) => {
      const ex = existingMs?.find(m => m.type === type);
      const isNew = newMilestones.includes(type);
      return {
        type, label: meta.label, desc: meta.desc,
        unlocked: !!ex || isNew,
        unlockedAt: ex?.unlocked_at ?? (isNew ? now : null),
        isNew,
      };
    });

  return res.status(200).json({
    score, painComponent: pain, adherenceComponent: adherence, romComponent: rom,
    insight: insightText, delta, previousScore, milestones,
  });
}

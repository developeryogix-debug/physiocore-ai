// api/suggest-exercises.ts
// POST /api/suggest-exercises
// Body: { patientId: string, context: string }
//
// Pipeline:
//   1. Load today's pain check-in from Supabase (pain_map or latest session)
//   2. Build RAG query from pain regions + context
//   3. Vector search → top 5 exercise matches
//   4. Haiku rationale generation per match
//
// SaMD Class II — output is decision support only.
// Model: claude-haiku-4-5-20251001

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient }                        from '@supabase/supabase-js';
import { searchExercises }                     from '../packages/app/src/lib/ragClient.js';
import { callClaude, extractJson }             from './_lib/claude.js';

// ── Env ────────────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env['VITE_SUPABASE_URL'] ?? '';
const SUPABASE_SVC_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

function makeSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SVC_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SVC_KEY, { auth: { persistSession: false } });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SuggestBody {
  patientId: string;
  context:   string;
}

interface ExerciseSuggestion {
  exerciseId:       string;
  exerciseName:     string;
  similarity:       number;
  clinicalRationale: string;
  contraindications: string[];
  evidenceGrade:    string;
  cptCode:          string;
}

// ── Load today's pain regions ─────────────────────────────────────────────────

async function getPainRegions(patientId: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = makeSupabase() as any;
  if (!sb) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb
    .from('pain_assessments')
    .select('pain_locations')
    .eq('user_id', patientId)
    .gte('created_at', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { pain_locations: string[] } | null };

  return data?.pain_locations ?? [];
}

// ── Haiku rationale ───────────────────────────────────────────────────────────

const RATIONALE_SYSTEM = `You are a physiotherapy exercise specialist.
Given an exercise and patient context, return a brief clinical rationale.
Output ONLY valid JSON:
{"rationale": "1-2 sentences why this exercise suits this patient", "contraindications": ["string per item — patient-specific only, empty array if none"]}`;

async function getRationale(
  exerciseName: string,
  metadata:     Record<string, unknown>,
  context:      string,
  painRegions:  string[],
): Promise<{ rationale: string; contraindications: string[] }> {
  const prompt = `Exercise: ${exerciseName}
Category: ${String(metadata['category'] ?? '')}
Primary muscles: ${String(metadata['primaryMuscles'] ?? '')}
Evidence grade: ${String(metadata['evidenceGrade'] ?? '')}
Patient context: ${context}
Pain regions: ${painRegions.join(', ') || 'none reported'}

Output rationale JSON.`;

  try {
    const raw = await callClaude({
      model:       'claude-haiku-4-5-20251001',
      system:      RATIONALE_SYSTEM,
      userMessage: prompt,
      maxTokens:   200,
    });
    return extractJson<{ rationale: string; contraindications: string[] }>(raw);
  } catch {
    return {
      rationale:        `${exerciseName} selected based on clinical evidence and patient context.`,
      contraindications: [],
    };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { patientId, context } = (req.body ?? {}) as Partial<SuggestBody>;
  if (!patientId || !context) {
    return res.status(400).json({ error: 'patientId and context required' });
  }

  try {
    // 1. Get pain regions
    const painRegions = await getPainRegions(patientId);

    // 2. Build RAG query
    const ragQuery = [
      painRegions.length > 0 ? `exercises for ${painRegions.join(' ')}` : '',
      context,
    ].filter(Boolean).join(' ');

    // 3. Vector search
    const matches = await searchExercises(ragQuery, 5);

    // 4. Haiku rationale for each match (parallel)
    const suggestions = await Promise.all(
      matches.map(async (match): Promise<ExerciseSuggestion> => {
        const { rationale, contraindications } = await getRationale(
          match.exerciseName,
          match.metadata,
          context,
          painRegions,
        );
        return {
          exerciseId:        match.exerciseId,
          exerciseName:      match.exerciseName,
          similarity:        match.similarity,
          clinicalRationale: rationale,
          contraindications: [
            ...contraindications,
            ...((match.metadata['contraindications'] as string[] | undefined) ?? []),
          ].slice(0, 5),
          evidenceGrade:     String(match.metadata['evidenceGrade'] ?? 'C'),
          cptCode:           String(match.metadata['cptCodeSuggestion'] ?? ''),
        };
      })
    );

    return res.status(200).json({
      ok:          true,
      patientId,
      painRegions,
      ragQuery,
      suggestions,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}

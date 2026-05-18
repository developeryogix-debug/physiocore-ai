/**
 * ragClient.ts — Phase 5 RAG Layer: pgvector exercise search
 *
 * Provides vector similarity search over exercise_embeddings table.
 * Embeddings: OpenAI text-embedding-3-small (1536 dims).
 * Fallback: deterministic keyword hash when OPENAI_API_KEY absent.
 *
 * Supabase setup (run once in SQL editor):
 * ─────────────────────────────────────────────────────────────────
 * CREATE EXTENSION IF NOT EXISTS vector;
 *
 * CREATE TABLE IF NOT EXISTS exercise_embeddings (
 *   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   exercise_id  text NOT NULL,
 *   exercise_name text NOT NULL,
 *   embedding    vector(1536),
 *   metadata     jsonb,
 *   created_at   timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX ON exercise_embeddings
 *   USING ivfflat (embedding vector_cosine_ops);
 * ─────────────────────────────────────────────────────────────────
 *
 * SaMD Class II — exercise suggestions are decision support only.
 * DO NOT modify safetyRules.ts or Phase 2/3 agents.
 */

import { supabase } from '@physiocore/supabase';
import { EXERCISE_LIBRARY } from './exerciseLibrary.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExerciseMatch {
  exerciseId:   string;
  exerciseName: string;
  similarity:   number;        // 0–1 cosine similarity
  metadata:     Record<string, unknown>;
}

// ── Embedding ─────────────────────────────────────────────────────────────────

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
const EMBED_MODEL      = 'text-embedding-3-small';
const EMBED_DIMS       = 1536;

/**
 * Embed text using OpenAI text-embedding-3-small.
 * Falls back to deterministic keyword hash (1536 floats) if no API key.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey =
    (typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string> }).env?.['VITE_OPENAI_KEY']
      : undefined)
    ?? process.env['OPENAI_API_KEY']
    ?? process.env['VITE_OPENAI_KEY']
    ?? '';

  if (apiKey) {
    const res = await fetch(OPENAI_EMBED_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: text, dimensions: EMBED_DIMS }),
    });
    if (res.ok) {
      const data = await res.json() as { data: Array<{ embedding: number[] }> };
      return data.data[0]?.embedding ?? keywordHash(text);
    }
  }

  return keywordHash(text);
}

/** Deterministic fallback: keyword presence → float hash (1536 dims). */
function keywordHash(text: string): number[] {
  const lower = text.toLowerCase();
  const vec   = new Float32Array(EMBED_DIMS).fill(0);
  for (let i = 0; i < lower.length; i++) {
    const idx = lower.charCodeAt(i) % EMBED_DIMS;
    vec[idx] = (vec[idx] ?? 0) + 1 / (i + 1);
  }
  // L2 normalise
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec).map(v => v / norm);
}

// ── Vector search ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Embeds query text → cosine similarity search on exercise_embeddings.
 * Returns up to `limit` matches sorted by similarity descending.
 */
export async function searchExercises(
  query: string,
  limit = 5,
): Promise<ExerciseMatch[]> {
  const embedding = await embedText(query);

  // pgvector cosine distance via Supabase RPC
  const { data, error } = await db.rpc('match_exercises', {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count:     limit,
  }) as { data: Array<{ exercise_id: string; exercise_name: string; similarity: number; metadata: Record<string, unknown> }> | null; error: unknown };

  if (error || !data) {
    // Fallback: return first `limit` exercises by keyword match
    const lower = query.toLowerCase();
    return Object.entries(EXERCISE_LIBRARY)
      .filter(([id, meta]) =>
        id.includes(lower) ||
        meta.displayName.toLowerCase().includes(lower) ||
        meta.primaryMuscles.some(m => lower.includes(m.split(' ')[0]!)) ||
        meta.jointActions.some(j => lower.includes(j.split(' ')[0]!))
      )
      .slice(0, limit)
      .map(([id, meta]) => ({
        exerciseId:   id,
        exerciseName: meta.displayName,
        similarity:   0.5,
        metadata:     {
          category:          meta.category,
          evidenceGrade:     meta.evidenceGrade,
          contraindications: meta.contraindications,
          icdCodes:          meta.icdCodes,
          cptCodeSuggestion: meta.cptCodeSuggestion,
        },
      }));
  }

  return data.map(row => ({
    exerciseId:   row.exercise_id,
    exerciseName: row.exercise_name,
    similarity:   row.similarity,
    metadata:     row.metadata,
  }));
}

// ── Seeder ────────────────────────────────────────────────────────────────────

/**
 * Seeds all exercises from EXERCISE_LIBRARY into exercise_embeddings.
 * Called once from api/seed-embeddings.ts.
 * Safe to re-run — upserts on exercise_id.
 */
export async function seedExerciseEmbeddings(): Promise<{ seeded: number; errors: string[] }> {
  const entries = Object.entries(EXERCISE_LIBRARY);
  const errors: string[] = [];
  let seeded = 0;

  for (const [id, meta] of entries) {
    const text = [
      meta.displayName,
      meta.category,
      ...meta.primaryMuscles,
      ...meta.secondaryMuscles,
      ...meta.jointActions,
      ...meta.icdCodes,
      meta.primaryReference,
    ].join(' ');

    try {
      const embedding = await embedText(text);
      const { error } = await db
        .from('exercise_embeddings')
        .upsert({
          exercise_id:   id,
          exercise_name: meta.displayName,
          embedding,
          metadata: {
            category:          meta.category,
            evidenceGrade:     meta.evidenceGrade,
            contraindications: meta.contraindications,
            icdCodes:          meta.icdCodes,
            cptCodeSuggestion: meta.cptCodeSuggestion,
            primaryMuscles:    meta.primaryMuscles,
          },
        }, { onConflict: 'exercise_id' });

      if (error) errors.push(`${id}: ${String(error.message ?? error)}`);
      else seeded++;
    } catch (err) {
      errors.push(`${id}: ${String(err)}`);
    }
  }

  return { seeded, errors };
}

// api/seed-embeddings.ts
// One-time seeder: POST /api/seed-embeddings
// Requires: Authorization: Bearer CRON_SECRET  (admin only)
//
// Creates exercise_embeddings rows for all 27 exercises in EXERCISE_LIBRARY.
// Safe to re-run — upserts on exercise_id.
//
// NOTE: Before calling, create the pgvector match function in Supabase:
// ─────────────────────────────────────────────────────────────────────────────
// CREATE OR REPLACE FUNCTION match_exercises(
//   query_embedding vector(1536),
//   match_threshold float,
//   match_count     int
// )
// RETURNS TABLE (
//   exercise_id   text,
//   exercise_name text,
//   similarity    float,
//   metadata      jsonb
// )
// LANGUAGE sql STABLE
// AS $$
//   SELECT
//     exercise_id,
//     exercise_name,
//     1 - (embedding <=> query_embedding) AS similarity,
//     metadata
//   FROM exercise_embeddings
//   WHERE 1 - (embedding <=> query_embedding) > match_threshold
//   ORDER BY similarity DESC
//   LIMIT match_count;
// $$;
// ─────────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { seedExerciseEmbeddings }              from '../packages/app/src/lib/ragClient.js';

const CRON_SECRET = process.env['CRON_SECRET'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const auth = req.headers['authorization'];
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await seedExerciseEmbeddings();
    return res.status(200).json({
      ok:     true,
      seeded: result.seeded,
      errors: result.errors,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}

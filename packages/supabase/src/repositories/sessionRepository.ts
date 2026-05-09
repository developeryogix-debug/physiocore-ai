import { supabase } from '../client.js';
import type { Database, SessionRow, SessionInsert, SessionUpdate } from '../schema.js';

type SessionTable = Database['public']['Tables']['sessions'];

/**
 * Create a new session record and return the inserted row.
 */
export async function createSession(
  session: SessionInsert,
): Promise<SessionRow> {
  const { data, error } = await supabase
    .from('sessions')
    .insert(session satisfies SessionTable['Insert'])
    .select()
    .single();

  if (error !== null) {
    throw new Error(`createSession failed: ${error.message}`);
  }

  return data satisfies SessionTable['Row'];
}

/**
 * Mark a session as complete by stamping ended_at and persisting final metrics.
 * Returns the updated row.
 */
export async function completeSession(
  id: string,
  updates: SessionUpdate,
): Promise<SessionRow> {
  const { data, error } = await supabase
    .from('sessions')
    .update({
      ...updates satisfies SessionTable['Update'],
      ended_at: updates.ended_at ?? new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error !== null) {
    throw new Error(`completeSession failed: ${error.message}`);
  }

  return data satisfies SessionTable['Row'];
}

/**
 * Retrieve all sessions for a given user, ordered by most recent first.
 */
export async function getSessionsByUserId(
  userId: string,
  limit = 50,
): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error !== null) {
    throw new Error(`getSessionsByUserId failed: ${error.message}`);
  }

  return (data ?? []) satisfies SessionTable['Row'][];
}

/**
 * Fetch a single session by its primary key.
 * Returns null when no row is found.
 */
export async function getSessionById(id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`getSessionById failed: ${error.message}`);
  }

  return data satisfies SessionTable['Row'] | null;
}

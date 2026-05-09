import { supabase } from '../client.js';
import type { Database, UserProfileRow, UserProfileInsert, UserProfileUpdate } from '../schema.js';

type UserProfileTable = Database['public']['Tables']['user_profiles'];

/**
 * Fetch a single user profile by its primary key.
 * Returns null when no row is found.
 */
export async function getUserById(id: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`getUserById failed: ${error.message}`);
  }

  return data satisfies UserProfileTable['Row'] | null;
}

/**
 * Insert or update a user profile.
 * Uses upsert so callers can provide the id on first creation.
 * Returns the persisted row.
 */
export async function upsertUser(
  profile: UserProfileInsert,
): Promise<UserProfileRow> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(profile satisfies UserProfileTable['Insert'], {
      onConflict: 'id',
    })
    .select()
    .single();

  if (error !== null) {
    throw new Error(`upsertUser failed: ${error.message}`);
  }

  return data satisfies UserProfileTable['Row'];
}

/**
 * Partially update a user profile by id.
 * Returns the updated row.
 */
export async function updateUserProfile(
  id: string,
  updates: UserProfileUpdate,
): Promise<UserProfileRow> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      ...updates satisfies UserProfileTable['Update'],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error !== null) {
    throw new Error(`updateUserProfile failed: ${error.message}`);
  }

  return data satisfies UserProfileTable['Row'];
}

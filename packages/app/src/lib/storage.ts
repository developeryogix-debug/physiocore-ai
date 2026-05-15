/**
 * storage.ts
 * PDPA-compliant localStorage helpers (Singapore PDPA s24 — protection obligation).
 *
 * All user-specific keys MUST be scoped by userId to prevent cross-user data
 * leakage on shared devices (common in clinical settings).
 *
 * Pattern: `${rawKey}_${userId}` or `${rawKey}_anonymous` for unauthenticated access.
 */

export const ALL_SCOPED_KEYS = [
  'physiocore_profile',
  'physiocore_migrated_v2',
  'physiocore_sessions',
  'physiocore_outcomes',
  'physiocore_biometrics',
  'physiocore_notifications',
  'physiocore_gym',
  'physiocore_psfs_activities',
  'physiocore_insight',
  'physiocore_quote',
] as const;

export type ScopedKey = typeof ALL_SCOPED_KEYS[number];

/** Build a userId-scoped localStorage key. Falls back to 'anonymous'. */
export function scopedKey(rawKey: string, userId: string | null | undefined): string {
  return `${rawKey}_${userId ?? 'anonymous'}`;
}

/**
 * Migrate old unscoped keys to scoped keys (one-time per user on first login).
 * Skips migration for any key where the scoped version already exists.
 */
export function adoptUnscopedKeys(userId: string, rawKeys: readonly string[]): void {
  for (const key of rawKeys) {
    const scoped = scopedKey(key, userId);
    if (localStorage.getItem(scoped) !== null) {
      localStorage.removeItem(key); // scoped already exists — clean up legacy
      continue;
    }
    const legacy = localStorage.getItem(key);
    if (legacy !== null) {
      localStorage.setItem(scoped, legacy);
      localStorage.removeItem(key);
    }
  }
}

/**
 * Migrate anonymous-scoped keys to a real userId on login.
 * Called whenever a previously-anonymous session transitions to authenticated.
 * Skips if user-scoped key already exists (prevents overwrite).
 */
export function adoptAnonymousKeys(userId: string, rawKeys: readonly string[]): void {
  for (const key of rawKeys) {
    const userKey = scopedKey(key, userId);
    const anonKey = scopedKey(key, 'anonymous');
    if (localStorage.getItem(userKey) !== null) {
      localStorage.removeItem(anonKey); // user key wins — drop anon copy
      continue;
    }
    const anonData = localStorage.getItem(anonKey);
    if (anonData !== null) {
      localStorage.setItem(userKey, anonData);
      localStorage.removeItem(anonKey);
    }
  }
}

/** Remove all scoped localStorage keys for a given userId (logout / data deletion). */
export function clearUserKeys(userId: string | null | undefined, rawKeys: readonly string[]): void {
  const uid = userId ?? 'anonymous';
  for (const key of rawKeys) {
    localStorage.removeItem(scopedKey(key, uid));
  }
}

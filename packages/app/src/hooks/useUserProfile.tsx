import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { UserProfile } from '@physiocore/types';
import { supabase } from '@physiocore/supabase';
import { scopedKey, adoptUnscopedKeys, adoptAnonymousKeys, clearUserKeys, ALL_SCOPED_KEYS } from '../lib/storage.js';

const STORAGE_KEY = 'physiocore_profile';
const MIGRATED_KEY = 'physiocore_migrated_v2';

interface UserProfileContextValue {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
  onboardingDone: boolean;
  isLoading: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

// Bypass strict Database generic for tables that may not be in compiled types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function syncProfileToSupabase(profile: UserProfile, userId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.from('user_profiles').upsert({
      id: userId,
      email: profile.email,
      name: profile.name,
      date_of_birth: profile.dateOfBirth,
      gender: profile.gender,
      height_cm: profile.heightCm,
      weight_kg: profile.weightKg,
      bmi: profile.bmi,
      fitness_level: profile.fitnessLevel,
      primary_goal: profile.primaryGoal,
      injuries: profile.injuries,
      conditions: profile.conditions,
      medications: profile.medications,
      preferences: profile.preferences,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Background sync failure is non-fatal — localStorage remains authoritative
  }
}

async function migrateLocalStorageToSupabase(userId: string): Promise<void> {
  if (localStorage.getItem(scopedKey(MIGRATED_KEY, userId))) return;
  try {
    const rawSessions = localStorage.getItem(scopedKey('physiocore_sessions', userId));
    if (rawSessions) {
      const sessions = JSON.parse(rawSessions) as Array<Record<string, unknown>>;
      for (const s of sessions) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.from('sessions').insert({
          user_id: userId,
          exercise: s['exercise'],
          date: s['date'],
          reps: s['reps'],
          form_score: s['formScore'],
          duration_min: s['durationMinutes'],
          fhir_json: s['fhirJson'],
        });
      }
    }
    const rawOutcomes = localStorage.getItem(scopedKey('physiocore_outcomes', userId));
    if (rawOutcomes) {
      const outcomes = JSON.parse(rawOutcomes) as Array<Record<string, unknown>>;
      for (const o of outcomes) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.from('outcomes').insert({
          user_id: userId,
          type: o['type'],
          score: o['score'],
          recorded_at: o['recordedAt'],
        });
      }
    }
    localStorage.setItem(scopedKey(MIGRATED_KEY, userId), '1');
  } catch {
    // Migration failure is non-fatal
  }
}

function rowToProfile(row: Record<string, unknown>, userId: string): UserProfile {
  return {
    id: userId,
    email: (row['email'] as string) ?? '',
    name: (row['name'] as string) ?? '',
    dateOfBirth: (row['date_of_birth'] as string) ?? '',
    gender: (row['gender'] as UserProfile['gender']) ?? 'prefer_not_to_say',
    heightCm: (row['height_cm'] as number) ?? 0,
    weightKg: (row['weight_kg'] as number) ?? 0,
    bmi: (row['bmi'] as number) ?? 0,
    fitnessLevel: (row['fitness_level'] as UserProfile['fitnessLevel']) ?? 'beginner',
    primaryGoal: (row['primary_goal'] as UserProfile['primaryGoal']) ?? 'strengthening',
    injuries: (row['injuries'] as UserProfile['injuries']) ?? [],
    conditions: (row['conditions'] as UserProfile['conditions']) ?? [],
    medications: (row['medications'] as UserProfile['medications']) ?? [],
    preferences: (row['preferences'] as UserProfile['preferences']) ?? {
      sessionDurationMinutes: 30,
      preferredIntensity: 'moderate',
      equipmentAvailable: [],
      notificationsEnabled: true,
      language: 'en',
      timezone: 'UTC',
    },
    subscription: (row['subscription'] as UserProfile['subscription']) ?? 'free',
    createdAt: (row['created_at'] as string) ?? new Date().toISOString(),
    updatedAt: (row['updated_at'] as string) ?? new Date().toISOString(),
  };
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Track current userId so clearProfile() can remove scoped keys without async
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // Resolve auth first — userId required for scoped key reads
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id ?? null;
        userIdRef.current = userId;

        if (userId) {
          // One-time migrations: unscoped legacy → scoped, anonymous → userId
          adoptUnscopedKeys(userId, ALL_SCOPED_KEYS);
          adoptAnonymousKeys(userId, ALL_SCOPED_KEYS);

          // Try Supabase (authoritative)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
          const remoteResult = await db.from('user_profiles').select('*').eq('id', userId).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const remoteProfile = remoteResult.data as Record<string, unknown> | null;

          if (remoteProfile) {
            const mapped = rowToProfile(remoteProfile, userId);
            localStorage.setItem(scopedKey(STORAGE_KEY, userId), JSON.stringify(mapped));
            setUserProfileState(mapped);
            setOnboardingDone(true);
          } else {
            // Fall back to scoped localStorage
            const raw = localStorage.getItem(scopedKey(STORAGE_KEY, userId));
            if (raw) {
              const parsed = JSON.parse(raw) as UserProfile;
              setUserProfileState(parsed);
              setOnboardingDone(true);
            }
          }

          void migrateLocalStorageToSupabase(userId);
        } else {
          // Unauthenticated — read from anonymous-scoped key
          const raw = localStorage.getItem(scopedKey(STORAGE_KEY, null));
          if (raw) {
            const parsed = JSON.parse(raw) as UserProfile;
            setUserProfileState(parsed);
            setOnboardingDone(true);
          }
        }
      } catch {
        // Corrupt storage or network error — start fresh
      }
      setIsLoading(false);
    }
    void init();
  }, []);

  function setUserProfile(profile: UserProfile) {
    const userId = userIdRef.current;
    localStorage.setItem(scopedKey(STORAGE_KEY, userId), JSON.stringify(profile));
    setUserProfileState(profile);
    setOnboardingDone(true);

    if (userId) void syncProfileToSupabase(profile, userId);
  }

  function clearProfile() {
    const userId = userIdRef.current;
    clearUserKeys(userId, ALL_SCOPED_KEYS);
    setUserProfileState(null);
    setOnboardingDone(false);
  }

  return (
    <UserProfileContext.Provider value={{ userProfile, setUserProfile, clearProfile, onboardingDone, isLoading }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider');
  return ctx;
}

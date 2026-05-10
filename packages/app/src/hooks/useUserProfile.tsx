import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { UserProfile } from '@physiocore/types';
import { supabase } from '@physiocore/supabase';

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
  if (localStorage.getItem(MIGRATED_KEY)) return;
  try {
    const rawSessions = localStorage.getItem('physiocore_sessions');
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
    const rawOutcomes = localStorage.getItem('physiocore_outcomes');
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
    localStorage.setItem(MIGRATED_KEY, '1');
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

  useEffect(() => {
    async function init() {
      try {
        // Load from localStorage first (instant)
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as UserProfile;
          setUserProfileState(parsed);
          setOnboardingDone(true);
        }

        // Try to sync from Supabase if user is authenticated
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (userId) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
          const remoteResult = await db.from('user_profiles').select('*').eq('id', userId).maybeSingle();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const remoteProfile = remoteResult.data as Record<string, unknown> | null;

          if (remoteProfile && !raw) {
            const mapped = rowToProfile(remoteProfile, userId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
            setUserProfileState(mapped);
            setOnboardingDone(true);
          }

          void migrateLocalStorageToSupabase(userId);
        }
      } catch {
        // Corrupt storage or network error — start fresh
      }
      setIsLoading(false);
    }
    void init();
  }, []);

  function setUserProfile(profile: UserProfile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setUserProfileState(profile);
    setOnboardingDone(true);

    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (userId) void syncProfileToSupabase(profile, userId);
    });
  }

  function clearProfile() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('physiocore_biometrics');
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

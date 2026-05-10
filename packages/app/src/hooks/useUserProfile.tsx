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

async function syncProfileToSupabase(profile: UserProfile, userId: string): Promise<void> {
  try {
    await supabase.from('user_profiles').upsert({
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
    // Migrate sessions
    const rawSessions = localStorage.getItem('physiocore_sessions');
    if (rawSessions) {
      const sessions = JSON.parse(rawSessions) as Array<Record<string, unknown>>;
      for (const s of sessions) {
        await supabase.from('sessions').insert({
          user_id: userId,
          exercise: s['exercise'] as string | undefined,
          date: s['date'] as string | undefined,
          reps: s['reps'] as number | undefined,
          form_score: s['formScore'] as number | undefined,
          duration_min: s['durationMinutes'] as number | undefined,
          fhir_json: s['fhirJson'] as Record<string, unknown> | undefined,
        });
      }
    }

    // Migrate outcomes
    const rawOutcomes = localStorage.getItem('physiocore_outcomes');
    if (rawOutcomes) {
      const outcomes = JSON.parse(rawOutcomes) as Array<Record<string, unknown>>;
      for (const o of outcomes) {
        await supabase.from('outcomes').insert({
          user_id: userId,
          type: o['type'] as 'psfs' | 'nprs' | 'groc' | 'phq4',
          score: o['score'] as number,
          recorded_at: o['recordedAt'] as string | undefined,
        });
      }
    }

    localStorage.setItem(MIGRATED_KEY, '1');
  } catch {
    // Migration failure is non-fatal
  }
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
          // Attempt to pull profile from Supabase (non-fatal if table missing)
          const { data: remoteProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (remoteProfile && !raw) {
            // Remote exists but no local — hydrate localStorage
            const mapped: UserProfile = {
              id: remoteProfile.id,
              email: remoteProfile.email,
              name: remoteProfile.name,
              dateOfBirth: remoteProfile.date_of_birth,
              gender: remoteProfile.gender,
              heightCm: remoteProfile.height_cm,
              weightKg: remoteProfile.weight_kg,
              bmi: remoteProfile.bmi,
              fitnessLevel: remoteProfile.fitness_level,
              primaryGoal: remoteProfile.primary_goal,
              injuries: remoteProfile.injuries ?? [],
              conditions: remoteProfile.conditions ?? [],
              medications: remoteProfile.medications ?? [],
              preferences: remoteProfile.preferences,
              subscription: remoteProfile.subscription ?? 'free',
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
            setUserProfileState(mapped);
            setOnboardingDone(true);
          }

          // Migrate old localStorage data to Supabase (runs once)
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

    // Background sync to Supabase
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

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { UserProfile } from '@physiocore/types';

const STORAGE_KEY = 'physiocore_profile';

interface UserProfileContextValue {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
  onboardingDone: boolean;
  isLoading: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserProfile;
        setUserProfileState(parsed);
        setOnboardingDone(true);
      }
    } catch {
      // corrupt storage — start fresh
    }
    setIsLoading(false);
  }, []);

  function setUserProfile(profile: UserProfile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setUserProfileState(profile);
    setOnboardingDone(true);
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

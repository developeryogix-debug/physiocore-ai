import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@physiocore/supabase';

export type UserRole = 'patient' | 'clinician' | 'trainer' | 'org_admin' | 'admin';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  orgId: string | null;
  hasConsented: boolean;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string, fullName: string, inviteToken?: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  recordConsent: (fullName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Bypass strict Database generic for tables added after initial schema generation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function fetchUserMeta(userId: string): Promise<{ role: UserRole; orgId: string | null; hasConsented: boolean }> {
  const [profileResult, consentResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('profiles').select('role, org_id').eq('user_id', userId).maybeSingle() as Promise<{ data: { role: UserRole; org_id: string | null } | null }>,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('consents').select('id').eq('user_id', userId).maybeSingle() as Promise<{ data: { id: string } | null }>,
  ]);
  return {
    role: profileResult.data?.role ?? 'patient',
    orgId: profileResult.data?.org_id ?? null,
    hasConsented: !!consentResult.data,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('patient');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function applyUser(u: User | null) {
    setUser(u);
    if (u) {
      const meta = await fetchUserMeta(u.id);
      setUserRole(meta.role);
      setOrgId(meta.orgId);
      setHasConsented(meta.hasConsented);
    } else {
      setUserRole('patient');
      setOrgId(null);
      setHasConsented(false);
    }
  }

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await applyUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      void applyUser(session?.user ?? null);
    });

    return () => { listener.subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithEmail(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signUpWithEmail(email: string, password: string, fullName: string, inviteToken?: string): Promise<string | null> {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return error.message;
    if (data.user) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await db.from('profiles').upsert({ user_id: data.user.id, full_name: fullName, role: 'patient' });
      if (inviteToken) {
        const { acceptInvite } = await import('../lib/orgApi.js');
        const result = await acceptInvite(inviteToken, data.user.id);
        if (result) {
          setUserRole(result.role as UserRole);
          setOrgId(result.orgId);
        }
      }
    }
    return null;
  }

  async function signInWithGoogle(): Promise<void> {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  async function sendMagicLink(email: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    return error?.message ?? null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async function recordConsent(fullName: string): Promise<void> {
    if (!user) return;
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      db.from('consents').upsert({ user_id: user.id, version: '1.0', full_name: fullName, signed_at: new Date().toISOString() }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      db.from('profiles').upsert({ user_id: user.id, full_name: fullName, role: 'patient' }),
    ]);
    setHasConsented(true);
  }

  return (
    <AuthContext.Provider value={{
      user, session, userRole, orgId, hasConsented, isLoading,
      signInWithEmail, signUpWithEmail, signInWithGoogle,
      sendMagicLink, signOut, recordConsent,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

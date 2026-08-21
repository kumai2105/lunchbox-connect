import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppRole, AppUser } from './types';

interface AuthState {
  session: Session | null;
  profile: AppUser | null;
  /** The auth SESSION is still being restored. Says nothing about the profile. */
  loading: boolean;
  /**
   * The app_users PROFILE is still being fetched.
   *
   * This is separate from `loading` on purpose, and the distinction is load
   * bearing. `loading` only ever covered getSession(); it is already false the
   * moment a sign-in returns, while `profile` — and therefore the role — is
   * still null for at least one render. Anything that routes on the role in
   * that window is routing on a value that has not arrived yet.
   */
  profileLoading: boolean;
  /** Set when the auth service itself was unreachable, so the UI can say so. */
  authError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // A rejection here (offline, DNS failure, blocked host, Supabase down) must
    // still clear `loading`. Without the catch the promise rejected unhandled
    // and `loading` stayed true forever, which the UI rendered as a permanently
    // blank screen with no error.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setSession(null);
        setAuthError(e instanceof Error ? e.message : 'Could not reach the authentication service.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!session?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    // Mark the profile in flight BEFORE awaiting. A consumer that renders
    // between the session arriving and this fetch settling would otherwise see
    // profileLoading === false with profile === null, which reads as "this user
    // has no role" rather than "the role is not known yet".
    setProfileLoading(true);

    void (async () => {
      const { data } = await supabase
        .from('app_users')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (active) setProfile((data as AppUser | null) ?? null);
    })()
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, profileLoading, authError, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useRole(): AppRole | null {
  return useAuth().profile?.role ?? null;
}

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
   * The app_users PROFILE for the CURRENT session has not arrived yet.
   *
   * Separate from `loading` on purpose, and the distinction is load bearing.
   * `loading` only ever covered getSession(); it is already false the moment a
   * sign-in returns, while `profile` — and therefore the role — is still null.
   * Anything that routes on the role in that window routes on a value that has
   * not arrived.
   *
   * It is DERIVED during render rather than set by the fetching effect,
   * because an effect runs only after the render that first observes the new
   * session — and that render is precisely the one that decides where to send
   * the user. A flag set inside the effect is still false when it matters.
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
  // Which user the value in `profile` describes. Comparing it to the live
  // session id is what makes "profile known" answerable synchronously.
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  const profileLoading = userId !== null && profileFor !== userId;

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

    if (!userId) {
      setProfile(null);
      setProfileFor(null);
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from('app_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active) return;
      // Both together: the profile and the identity it belongs to. Setting
      // `profileFor` is what flips profileLoading false, so it must never
      // happen before the value it vouches for is in place.
      setProfile((data as AppUser | null) ?? null);
      setProfileFor(userId);
    })().catch(() => {
      if (!active) return;
      // A failed lookup has still SETTLED. Record it against this user so the
      // app stops waiting; it now means "no profile", not "not known yet".
      setProfile(null);
      setProfileFor(userId);
    });

    return () => {
      active = false;
    };
  }, [userId]);

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

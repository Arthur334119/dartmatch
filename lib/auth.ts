import { useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, TABLES } from './supabase';
import { profileFromRow } from './types';

export type AuthState = {
  session: Session | null;
  user: User | null;
  fullyVerified: boolean;
  loading: boolean;
};

/**
 * Stellt sicher, dass für `userId` ein Profil-Datensatz existiert.
 * Wird vor jedem `upsert(avatar_url)` aufgerufen, damit der `username NOT NULL`-
 * Constraint nicht zuschlägt.
 */
export async function ensureProfile(
  userId: string,
  fallbackUsername: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from(TABLES.profiles)
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return;

  await supabase.from(TABLES.profiles).insert({
    id: userId,
    username: fallbackUsername,
    favorite_games: [],
    created_at: new Date().toISOString(),
  });
}

export async function ensureCurrentUserProfile(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const fromMeta = (user.user_metadata?.username as string | undefined)?.trim();
  const fromEmail = user.email?.split('@')[0];
  const fallback = fromMeta && fromMeta.length > 0
    ? fromMeta
    : fromEmail ?? `user_${user.id.slice(0, 8)}`;
  await ensureProfile(user.id, fallback);
}

/**
 * Verifizierungs-Status: E-Mail bestätigt UND Profilbild gesetzt.
 * Spiegelt die `is_user_verified()`-Funktion in der DB.
 */
export async function isFullyVerified(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  if (!user.email_confirmed_at) return false;
  const { data: profile } = await supabase
    .from(TABLES.profiles)
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  const avatar = (profile as { avatar_url?: string | null } | null)?.avatar_url;
  return !!avatar && avatar.length > 0;
}

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signup(
  email: string,
  password: string,
  username: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  if (data.user) {
    await ensureProfile(data.user.id, username || email.split('@')[0]);
  }
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

/**
 * Reactives Auth-State-Hook, der auf onAuthStateChange hört und periodisch
 * `isFullyVerified()` neu prüft (z. B. nach Avatar-Upload).
 */
export function useAuth(): AuthState & { refreshVerification: () => Promise<void> } {
  const [session, setSession] = useState<Session | null>(null);
  const [fullyVerified, setFullyVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkVerification = useCallback(async (s: Session | null) => {
    if (!s) {
      setFullyVerified(false);
      return;
    }
    try {
      const ok = await isFullyVerified();
      setFullyVerified(ok);
    } catch {
      setFullyVerified(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await checkVerification(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        await checkVerification(newSession);
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [checkVerification]);

  const refreshVerification = useCallback(async () => {
    try {
      await supabase.auth.refreshSession();
    } catch {}
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await checkVerification(data.session);
  }, [checkVerification]);

  return {
    session,
    user: session?.user ?? null,
    fullyVerified,
    loading,
    refreshVerification,
  };
}

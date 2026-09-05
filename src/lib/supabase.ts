import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Friendly in-app banner instead of a hard crash: the app renders, login is
  // simply impossible until .env is filled (runbook step 3).
  console.warn('[lunchbox] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in .env');
}

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
);

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && url !== 'https://placeholder.supabase.co');
}

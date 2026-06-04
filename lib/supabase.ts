import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  if (!isSupabaseConfigured) {
    if (typeof window !== 'undefined') {
      console.warn('Supabase credentials missing.');
    }
    // Return a dummy client to prevent crashes, but it will fail on calls
    return createClient('https://placeholder-project.supabase.co', 'placeholder-key', {
      auth: { persistSession: false }
    });
  }

  supabaseInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'bolaodacopa-auth-token'
    }
  });
  return supabaseInstance;
};

export const supabase = getSupabase();

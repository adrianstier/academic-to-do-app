import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Create a dummy client for build time, real client for runtime
const createSupabaseClient = (): SupabaseClient => {
  if (isSupabaseConfigured()) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  // Return a dummy client that will fail gracefully at runtime
  // This allows the build to succeed without credentials
  return createClient('https://placeholder.supabase.co', 'placeholder-key');
};

export const supabase = createSupabaseClient();

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Service-role client. SERVER ONLY. Bypasses row-level security, so every
 * caller must check authorization first (see lib/auth.ts).
 */
export function db(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are missing.');
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Always read live data. Never let the hosting platform serve a saved copy.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return cached;
}

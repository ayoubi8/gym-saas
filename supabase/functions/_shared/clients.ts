// Supabase clients for Edge Functions.
// - adminClient(): service role — bypasses RLS; NEVER leaked to the browser.
// - userClient(req): anon key + the caller's Authorization header, so auth.jwt()
//   inside the DB resolves to the caller (used for JWT validation only).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Edge Function misconfigured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization') ?? '';
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

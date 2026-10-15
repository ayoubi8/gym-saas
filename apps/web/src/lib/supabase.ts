import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Single Supabase client for the whole app (FRONTEND-BACKEND.md §3).
// This is the ONLY module that imports @supabase/supabase-js directly.
const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!url || !anonKey) {
  // Local dev fallback: `supabase start` exposes these defaults. Never commit real keys.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy apps/web/.env.example to .env.local and fill them in.',
  );
}

export const supabase = createClient<Database>(
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key',
);

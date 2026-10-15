import { supabase } from '../../lib/supabase';
import { toAppError } from '../../lib/pg-errors';
import type { GymSettings, Plan } from '../../lib/database.types';
import type { AppLang } from '../../i18n';

// Onboarding reads (DATA-CONTRACT.md row 03). Writes go through runMutation
// (FRONTEND-BACKEND.md §6) except the owner's own language preference, which has
// no RPC and is allowed by the profiles_self_update policy.

export async function fetchGymSettings(gymId: string): Promise<GymSettings | null> {
  const { data, error } = await supabase
    .from('gym_settings')
    .select('*')
    .eq('gym_id', gymId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data;
}

export async function fetchGymPlans(gymId: string): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('gym_id', gymId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return data;
}

/** Persist the owner's preferred portal language (own profile row). */
export async function updateProfileLanguage(userId: string, language: AppLang): Promise<void> {
  const { error } = await supabase.from('profiles').update({ language }).eq('id', userId);
  if (error) throw toAppError(error);
}

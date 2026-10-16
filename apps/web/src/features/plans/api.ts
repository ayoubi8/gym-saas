import { supabase } from '../../lib/supabase';
import { toAppError } from '../../lib/pg-errors';
import type { Plan } from '../../lib/database.types';

// Plans reads (DATA-CONTRACT.md row 04). RLS scopes rows to the owner's gym.
// Writes go through runMutation (upsert_plan / set_plan_active).

export async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return data;
}

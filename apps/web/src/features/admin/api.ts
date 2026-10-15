import { supabase } from '../../lib/supabase';
import { AppError, mapEdgeErrorCode, toAppError, type AppErrorCode } from '../../lib/pg-errors';
import type { Enums } from '../../lib/database.types';
import type { CreateGymInput, ResetPasswordInput } from './schemas';

// All admin writes go through service-role Edge Functions (DATA-CONTRACT.md row 02).
// The browser never sees the service-role key (FRONTEND-BACKEND.md §7).

export type GymStatus = Enums<'gym_status'>;

export interface AdminGymOwner {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

export interface AdminGymRow {
  id: string;
  name: string;
  city: string | null;
  default_language: Enums<'lang'>;
  status: GymStatus;
  suspended_at: string | null;
  created_at: string;
  owner: AdminGymOwner | null;
}

export interface CreateGymResult {
  gym_id: string;
  owner_user_id: string;
  gym_name: string;
  login: string;
  synthetic_email: string;
  password: string;
}

async function edgeErrorCode(error: unknown): Promise<AppErrorCode> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const payload = (await context.json()) as { error?: string };
      const mapped = mapEdgeErrorCode(payload.error);
      if (mapped !== 'UNKNOWN') return mapped;
    } catch {
      // non-JSON body — fall through to message heuristics
    }
  }
  const message = (error instanceof Error ? error.message : '').toUpperCase();
  if (message.includes('FAILED TO FETCH') || message.includes('NETWORK')) return 'NETWORK_OFFLINE';
  return 'UNKNOWN';
}

async function invokeEdge<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw new AppError(await edgeErrorCode(error), error.message);
  }
  return data as T;
}

/** Admin reads (bypass RLS via is_admin() policies): all gyms + their owners. */
export async function fetchAdminGyms(): Promise<AdminGymRow[]> {
  const [gymsResult, ownersResult] = await Promise.all([
    supabase
      .from('gyms')
      .select('id, name, city, default_language, status, suspended_at, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, gym_id, full_name, phone, email').eq('role', 'owner'),
  ]);

  if (gymsResult.error) throw toAppError(gymsResult.error);
  if (ownersResult.error) throw toAppError(ownersResult.error);

  const ownersByGym = new Map<string, AdminGymOwner>();
  for (const owner of ownersResult.data) {
    if (!owner.gym_id) continue;
    ownersByGym.set(owner.gym_id, {
      id: owner.id,
      full_name: owner.full_name,
      phone: owner.phone,
      email: owner.email,
    });
  }

  return gymsResult.data.map((gym) => ({
    ...gym,
    owner: ownersByGym.get(gym.id) ?? null,
  }));
}

export function createGym(input: CreateGymInput): Promise<CreateGymResult> {
  return invokeEdge<CreateGymResult>('admin_create_gym_with_owner', {
    name: input.name,
    city: input.city.trim() || null,
    default_language: input.default_language,
    owner_full_name: input.owner_full_name,
    owner_phone_or_email: input.owner_phone_or_email,
    password: input.password,
  });
}

export async function setGymStatus(gymId: string, status: GymStatus): Promise<void> {
  await invokeEdge('admin_set_gym_status', { gym_id: gymId, status });
}

export async function resetOwnerPassword(input: ResetPasswordInput): Promise<void> {
  await invokeEdge('admin_reset_owner_password', {
    user_id: input.user_id,
    new_password: input.new_password,
  });
}

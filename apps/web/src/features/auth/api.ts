import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { AppError } from '../../lib/pg-errors';
import type { Gym, Profile } from '../../lib/database.types';
import { mapIdentifierToEmail } from './identifier';

export interface SessionContext {
  userId: string;
  profile: Profile;
  gym: Gym | null;
}

function mapAuthError(error: AuthError): AppError {
  const message = error.message.toUpperCase();
  if (message.includes('INVALID LOGIN CREDENTIALS') || message.includes('INVALID_CREDENTIALS')) {
    return new AppError('INVALID_CREDENTIALS', error.message);
  }
  if (message.includes('NETWORK')) {
    return new AppError('NETWORK_OFFLINE', error.message);
  }
  return new AppError('INVALID_CREDENTIALS', error.message);
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error || !data) {
    throw new AppError('UNKNOWN', error?.message ?? 'profile not found');
  }
  return data;
}

export async function fetchGym(gymId: string): Promise<Gym> {
  const { data, error } = await supabase.from('gyms').select('*').eq('id', gymId).single();
  if (error || !data) {
    throw new AppError('UNKNOWN', error?.message ?? 'gym not found');
  }
  return data;
}

async function loadSessionContext(userId: string): Promise<SessionContext> {
  const profile = await fetchProfile(userId);

  let gym: Gym | null = null;
  if (profile.gym_id) {
    gym = await fetchGym(profile.gym_id);
    if (gym.status === 'suspended') {
      await supabase.auth.signOut();
      throw new AppError('SUSPENDED_GYM');
    }
  }

  return { userId, profile, gym };
}

/** Resolve the current session -> profile (+ gym). Returns null when signed out. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  try {
    return await loadSessionContext(session.user.id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'SUSPENDED_GYM') {
      return null;
    }
    throw error;
  }
}

export async function signIn(identifier: string, password: string): Promise<SessionContext> {
  const email = mapIdentifierToEmail(identifier);
  if (!email) {
    throw new AppError('INVALID_IDENTIFIER');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw mapAuthError(error);
  }
  if (!data.user) {
    throw new AppError('INVALID_CREDENTIALS');
  }

  return loadSessionContext(data.user.id);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { changeLanguage, getStoredLang, isAppLang, type AppLang } from '../../i18n';
import { getSessionContext, signIn, signOut, updateProfileLanguage, type SessionContext } from './api';
import type { LoginInput } from './schemas';

export interface UseSessionResult {
  status: 'loading' | 'ready';
  session: SessionContext | null;
}

export function useSession(): UseSessionResult {
  const query = useQuery({
    queryKey: qk.session,
    queryFn: getSessionContext,
    staleTime: Infinity,
    retry: false,
  });

  return {
    status: query.isPending ? 'loading' : 'ready',
    session: query.data ?? null,
  };
}

export function useSignIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => signIn(input.identifier, input.password),
    onSuccess: (session) => {
      client.setQueryData(qk.session, session);
      // First login on this device: honour the language saved on the profile
      // (FR-L3). An explicit local choice always wins.
      const profileLang = session.profile.language;
      if (getStoredLang() === null && isAppLang(profileLang)) {
        void changeLanguage(profileLang);
      }
    },
  });
}

/** Persist the user's language choice to their profile (FR-L3, per-user). */
export function useUpdateProfileLanguage() {
  return useMutation({
    mutationFn: ({ userId, language }: { userId: string; language: AppLang }) =>
      updateProfileLanguage(userId, language),
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      client.setQueryData(qk.session, null);
      client.clear();
    },
  });
}

export function homePathForRole(role: SessionContext['profile']['role']): string {
  return role === 'admin' ? '/admin/gyms' : '/';
}

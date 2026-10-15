import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { getSessionContext, signIn, signOut, type SessionContext } from './api';
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
    },
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

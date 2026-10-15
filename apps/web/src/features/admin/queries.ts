import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import {
  createGym,
  fetchAdminGyms,
  resetOwnerPassword,
  setGymStatus,
  type GymStatus,
} from './api';
import type { CreateGymInput, ResetPasswordInput } from './schemas';

// Writes invalidate ['admin','gyms'] (DATA-CONTRACT.md row 02).
export function useAdminGyms() {
  return useQuery({
    queryKey: qk.adminGyms,
    queryFn: fetchAdminGyms,
  });
}

export function useCreateGym() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGymInput) => createGym(input),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.adminGyms }),
  });
}

export function useSetGymStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: { gymId: string; status: GymStatus }) =>
      setGymStatus(variables.gymId, variables.status),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.adminGyms }),
  });
}

export function useResetOwnerPassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => resetOwnerPassword(input),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.adminGyms }),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { runMutation } from '../../lib/run-mutation';
import type { Member } from '../../lib/database.types';
import { fetchMember, fetchMembers } from './api';
import type { MemberInput } from './schemas';

export function useMembers() {
  return useQuery({ queryKey: qk.members(), queryFn: fetchMembers });
}

export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: qk.member(id ?? ''),
    queryFn: () => fetchMember(id as string),
    enabled: Boolean(id),
  });
}

export interface CreateMemberVars {
  id?: string;
  input: MemberInput;
}

export function useCreateMember(gymId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: CreateMemberVars) =>
      runMutation<Member>({
        key: qk.members(),
        rpc: 'create_member',
        id: crypto.randomUUID(),
        args: {
          p_id: vars.id ?? crypto.randomUUID(),
          p_gym_id: gymId,
          p_full_name: vars.input.full_name,
          p_phone: vars.input.phone,
          p_language: vars.input.language ?? null,
        },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.dashboard }),
  });
}

export function useUpdateMember(memberId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: MemberInput) =>
      runMutation<Member>({
        key: qk.members(),
        rpc: 'update_member',
        id: crypto.randomUUID(),
        args: {
          p_id: memberId,
          p_full_name: input.full_name,
          p_phone: input.phone,
          p_language: input.language ?? null,
        },
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.member(memberId) });
      client.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

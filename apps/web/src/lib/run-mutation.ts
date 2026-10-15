import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { queryClient } from './query-client';
import { toAppError } from './pg-errors';

// ONE mutation abstraction (FRONTEND-BACKEND.md §6). Screens call runMutation,
// never supabase.rpc directly. Phase 1B–6: online direct RPC + invalidate.
// Phase 7 swaps ONLY this file's internals (Dexie outbox + replay); no screen changes.

export interface MutationOp<Args extends object = Record<string, unknown>> {
  /** TanStack Query keys to invalidate on success (from the qk factory). */
  key: readonly unknown[];
  /** RPC name as exposed by the generated Database type. */
  rpc: string;
  args: Args;
  /** Client-generated UUID; idempotent replay id in Phase 7. */
  id: string;
}

type RpcResult = { data: unknown; error: PostgrestError | null };
type RpcCaller = (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;

export async function runMutation<T = unknown, Args extends object = Record<string, unknown>>(
  op: MutationOp<Args>,
): Promise<T> {
  const call = supabase.rpc.bind(supabase) as unknown as RpcCaller;
  const { data, error } = await call(op.rpc, op.args as Record<string, unknown>);

  if (error) {
    throw toAppError(error);
  }

  await queryClient.invalidateQueries({ queryKey: op.key });
  return data as T;
}

import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { queryClient } from './query-client';
import { AppError, toAppError } from './pg-errors';
import { isOnlineOnlyRpc } from './offline-policy';
import { enqueueOutbox } from './outbox';
import { flushOutbox } from './sync';

// ONE mutation abstraction (FRONTEND-BACKEND.md §6). Screens call runMutation,
// never supabase.rpc directly.
//   online  -> direct RPC + invalidate (fast path)
//   offline -> persist in the Dexie outbox; sync.ts replays FIFO on reconnect
//   online-only RPCs (edit/delete_payment) never queue -> OFFLINE_EDIT_BLOCKED.
// Phase 7 swapped ONLY this file's internals; screen code is unchanged.

export interface MutationOp<Args extends object = Record<string, unknown>> {
  /** TanStack Query keys to invalidate on success (from the qk factory). */
  key: readonly unknown[];
  /** RPC name as exposed by the generated Database type. */
  rpc: string;
  args: Args;
  /** Client-generated UUID; idempotent replay id. */
  id: string;
}

type RpcResult = { data: unknown; error: PostgrestError | null };
type RpcCaller = (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;

export async function runMutation<T = unknown, Args extends object = Record<string, unknown>>(
  op: MutationOp<Args>,
): Promise<T> {
  const call = supabase.rpc.bind(supabase) as unknown as RpcCaller;
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const onlineOnly = isOnlineOnlyRpc(op.rpc);

  if (online) {
    try {
      const { data, error } = await call(op.rpc, op.args as Record<string, unknown>);
      if (!error) {
        await queryClient.invalidateQueries({ queryKey: op.key });
        return data as T;
      }
      const appError = toAppError(error);
      // Queue only on a connectivity failure; real errors (duplicate, RLS…) surface.
      if (onlineOnly || appError.code !== 'NETWORK_OFFLINE') throw appError;
    } catch (error) {
      const appError = toAppError(error);
      if (onlineOnly || appError.code !== 'NETWORK_OFFLINE') throw appError;
    }
  }

  if (onlineOnly) {
    throw new AppError('OFFLINE_EDIT_BLOCKED');
  }

  await enqueueOutbox({
    id: op.id,
    rpc: op.rpc,
    args: op.args as Record<string, unknown>,
    key: [...op.key],
    attempts: 0,
    failed: false,
    lastError: null,
    createdAt: Date.now(),
  });
  void flushOutbox();

  return { id: op.id } as T;
}

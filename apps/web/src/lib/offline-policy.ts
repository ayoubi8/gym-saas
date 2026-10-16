// Pure offline/sync policy — no Supabase, no IndexedDB (unit-testable).
// Phase 7 (FRONTEND-BACKEND.md §6): which RPCs may be queued offline, and how
// the outbox is replayed (FIFO, failed ops skipped so they never block the line).

export interface PendingOp {
  id: string;
  createdAt: number;
  failed: boolean;
}

/** Writes that must run ONLINE only (never queued): audited payment edits/deletes. */
export const ONLINE_ONLY_RPCS = ['edit_payment', 'delete_payment'] as const;

export function isOnlineOnlyRpc(rpc: string): boolean {
  return (ONLINE_ONLY_RPCS as readonly string[]).includes(rpc);
}

/** Failed ops are kept for review but skipped so they don't block the FIFO queue. */
export function orderPending<T extends PendingOp>(ops: T[]): T[] {
  return ops.filter((op) => !op.failed).sort((a, b) => a.createdAt - b.createdAt);
}

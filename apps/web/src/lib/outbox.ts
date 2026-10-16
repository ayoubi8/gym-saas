import Dexie, { type Table } from 'dexie';

// IndexedDB outbox (AGENTS.md §3/§7, docs/plans/07-offline.md). One row per
// queued mutation; replayed FIFO by lib/sync.ts. `id` is the client uuid, so a
// replayed op is idempotent server-side (`on conflict (id) do nothing`).

export interface OutboxOp {
  /** Client-generated uuid == the RPC's p_id (idempotent replay key). */
  id: string;
  rpc: string;
  args: Record<string, unknown>;
  /** TanStack Query key to invalidate once the op lands. */
  key: unknown[];
  attempts: number;
  /** Permanently failed (app error) — kept for review, skipped on replay. */
  failed: boolean;
  lastError: string | null;
  /** Enqueue time (ms epoch) — FIFO ordering. */
  createdAt: number;
}

class OutboxDatabase extends Dexie {
  ops!: Table<OutboxOp, string>;

  constructor() {
    super('gymdz');
    this.version(1).stores({ ops: 'id, createdAt, failed' });
  }
}

export const outboxDb = new OutboxDatabase();

export async function enqueueOutbox(op: OutboxOp): Promise<void> {
  await outboxDb.ops.put(op);
}

/** All ops, FIFO by enqueue time (callers filter with orderPending). */
export async function readOutbox(): Promise<OutboxOp[]> {
  return outboxDb.ops.orderBy('createdAt').toArray();
}

export async function deleteOutboxOp(id: string): Promise<void> {
  await outboxDb.ops.delete(id);
}

export async function markOutboxError(id: string, code: string): Promise<void> {
  const op = await outboxDb.ops.get(id);
  if (!op) return;
  await outboxDb.ops.put({ ...op, attempts: op.attempts + 1, failed: true, lastError: code });
}

export async function countOutbox(): Promise<{ pending: number; failed: number }> {
  const all = await outboxDb.ops.toArray();
  let failed = 0;
  for (const op of all) if (op.failed) failed += 1;
  return { pending: all.length - failed, failed };
}

export async function retryFailedOutbox(): Promise<void> {
  const failed = await outboxDb.ops.filter((op) => op.failed).toArray();
  await Promise.all(
    failed.map((op) => outboxDb.ops.put({ ...op, failed: false, lastError: null })),
  );
}

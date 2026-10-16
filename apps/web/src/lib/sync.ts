import { supabase } from './supabase';
import { queryClient } from './query-client';
import { qk } from './query-keys';
import { toAppError } from './pg-errors';
import { orderPending } from './offline-policy';
import {
  countOutbox,
  deleteOutboxOp,
  markOutboxError,
  readOutbox,
  retryFailedOutbox,
} from './outbox';

// Offline sync engine (docs/plans/07-offline.md). Persists queued mutations in
// the Dexie outbox and replays them FIFO on reconnect, writing one `sync_log`
// row per flush (PRD §9 metric). Screen code never calls this directly — it
// goes through runMutation; screens only read the status via useSyncStatus().

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

const DEVICE_KEY = 'gymdz.device';
const listeners = new Set<() => void>();

let state: SyncState = {
  status: typeof navigator === 'undefined' || navigator.onLine ? 'online' : 'offline',
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  lastError: null,
};

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  emit();
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncState(): SyncState {
  return state;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'unknown';
  }
}

interface CachedSession {
  userId: string;
  gym: { id: string } | null;
}

async function refreshCounts(): Promise<void> {
  try {
    const counts = await countOutbox();
    setState({ pending: counts.pending, failed: counts.failed });
  } catch {
    /* IndexedDB unavailable — nothing queued */
  }
}

/** Best-effort `sync_log` row (RLS: user_id = auth.uid()). Never blocks a flush. */
async function writeSyncLog(opsCount: number, outcome: 'success' | 'error', error: string | null): Promise<void> {
  try {
    const session = queryClient.getQueryData<CachedSession>(qk.session);
    if (!session) return;
    await supabase.from('sync_log').insert({
      gym_id: session.gym?.id ?? null,
      user_id: session.userId,
      device_id: deviceId(),
      outcome,
      ops_count: opsCount,
      error,
    });
  } catch {
    /* sync_log is telemetry — never surface its failure */
  }
}

let flushing = false;

/** Replay the outbox FIFO. Safe to call often; concurrent calls are coalesced. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  if (!isOnline()) {
    setState({ status: 'offline' });
    await refreshCounts();
    return;
  }

  await refreshCounts();
  if (state.pending === 0) {
    setState({ status: 'online' });
    return;
  }

  flushing = true;
  setState({ status: 'syncing' });

  const call = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;

  const ops = orderPending(await readOutbox());
  const invalidated: unknown[][] = [];
  let success = 0;
  let errorCode: string | null = null;
  let networkStop = false;

  for (const op of ops) {
    try {
      const { error } = await call(op.rpc, op.args);
      if (error) throw toAppError(error);
      await deleteOutboxOp(op.id);
      success += 1;
      invalidated.push(op.key);
    } catch (error) {
      const appError = toAppError(error);
      if (appError.code === 'NETWORK_OFFLINE') {
        networkStop = true;
        break;
      }
      // Permanent (validation/RLS) error: keep for review, skip on replay.
      await markOutboxError(op.id, appError.code);
      errorCode = appError.code;
    }
  }

  for (const key of invalidated) await queryClient.invalidateQueries({ queryKey: key });
  if (success > 0) {
    await queryClient.invalidateQueries({ queryKey: qk.dashboard });
    await queryClient.invalidateQueries({ queryKey: qk.members() });
  }

  await refreshCounts();
  await writeSyncLog(success, errorCode || networkStop ? 'error' : 'success', errorCode);

  if (networkStop) setState({ status: 'offline' });
  else if (errorCode) setState({ status: 'error', lastError: errorCode });
  else setState({ status: 'online', lastSyncedAt: Date.now(), lastError: null });

  flushing = false;
}

/** Retry ops that permanently failed (owner asks to try again). */
export async function retryFailed(): Promise<void> {
  await retryFailedOutbox();
  await flushOutbox();
}

let initialized = false;

/** Wire connectivity listeners + initial flush. Call once from App. */
export function initSync(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('online', () => {
    void flushOutbox();
  });
  window.addEventListener('offline', () => setState({ status: 'offline' }));
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushOutbox();
  });

  void refreshCounts().then(() => flushOutbox());
}

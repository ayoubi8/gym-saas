import { describe, expect, it } from 'vitest';
import { isOnlineOnlyRpc, orderPending, ONLINE_ONLY_RPCS } from '../lib/offline-policy';
import { mapError, AppError } from '../lib/pg-errors';

// Phase 7 (PRD §5.8). Pure offline-policy + network mapping checks. The Dexie
// outbox + replay engine need IndexedDB/a browser (see deviations: e2e not run).

describe('online-only RPC policy (Phase 7)', () => {
  it('never queues audited payment edit/delete', () => {
    expect(ONLINE_ONLY_RPCS).toEqual(['edit_payment', 'delete_payment']);
    expect(isOnlineOnlyRpc('edit_payment')).toBe(true);
    expect(isOnlineOnlyRpc('delete_payment')).toBe(true);
  });

  it('allows offline-queueable writes', () => {
    for (const rpc of ['create_member', 'update_member', 'record_payment', 'assign_subscription', 'renew_subscription', 'pause_subscription', 'resume_subscription', 'extend_subscription']) {
      expect(isOnlineOnlyRpc(rpc)).toBe(false);
    }
  });
});

describe('outbox FIFO replay (Phase 7)', () => {
  it('replays in enqueue order', () => {
    const ops = [
      { id: 'c', createdAt: 300, failed: false },
      { id: 'a', createdAt: 100, failed: false },
      { id: 'b', createdAt: 200, failed: false },
    ];
    expect(orderPending(ops).map((op) => op.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips permanently failed ops so they never block the queue', () => {
    const ops = [
      { id: 'a', createdAt: 100, failed: true },
      { id: 'b', createdAt: 200, failed: false },
      { id: 'c', createdAt: 300, failed: true },
    ];
    expect(orderPending(ops).map((op) => op.id)).toEqual(['b']);
  });

  it('is stable/empty-safe', () => {
    expect(orderPending([])).toEqual([]);
  });
});

describe('connectivity errors map to a queued (not failed) state (Phase 7)', () => {
  it('maps fetch failures to NETWORK_OFFLINE', () => {
    expect(mapError(new TypeError('Failed to fetch'))).toBe('errors.offlineQueued');
    expect(mapError({ message: 'NetworkError when attempting to fetch resource.' })).toBe('errors.offlineQueued');
    expect(mapError({ code: 'NETWORK_OFFLINE' })).toBe('errors.offlineQueued');
  });

  it('does NOT mask real domain errors as offline', () => {
    expect(mapError(new AppError('DUPLICATE_PHONE'))).toBe('members.duplicatePhone');
    expect(mapError({ code: '42501', message: 'row-level security' })).toBe('errors.rlsDenied');
  });
});

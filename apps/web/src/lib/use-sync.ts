import { useSyncExternalStore } from 'react';
import { getSyncState, subscribeSync, type SyncState } from './sync';

/** Subscribe a component to the outbox/sync status (sync bar, badges). */
export function useSyncStatus(): SyncState {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}

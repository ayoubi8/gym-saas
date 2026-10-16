import { QueryClient } from '@tanstack/react-query';

// Shared client so non-React modules (run-mutation, sync worker) can invalidate
// keys without needing a hook. Provided to the tree via QueryClientProvider.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Offline: cache-first — mutations/refetches are paused, last data stays.
      networkMode: 'online',
    },
    mutations: {
      retry: 0,
      // Phase 7: runMutation handles connectivity itself (Dexie outbox). 'always'
      // lets the mutationFn run while offline so the op can be queued.
      networkMode: 'always',
    },
  },
});

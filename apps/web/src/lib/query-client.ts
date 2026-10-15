import { QueryClient } from '@tanstack/react-query';

// Shared client so non-React modules (run-mutation, sync worker) can invalidate
// keys without needing a hook. Provided to the tree via QueryClientProvider.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

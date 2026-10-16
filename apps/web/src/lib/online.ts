import { useEffect, useState } from 'react';

// Connectivity signal for the online-only actions (payment edit/delete, AGENTS.md §7).
// Phase 7 replaces this with the outbox/sync engine; screens just read this boolean.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    function update() {
      setOnline(navigator.onLine);
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

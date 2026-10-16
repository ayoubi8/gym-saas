import { useTranslation } from 'react-i18next';
import { useSyncStatus } from '../lib/use-sync';
import { retryFailed, flushOutbox } from '../lib/sync';
import { formatDateTime } from '../lib/format';
import { useFormatLang } from '../lib/use-format';

// Sync bar (DESIGN-SYSTEM.md §6): Online / Offline / Syncing / Error, always
// visible, with the pending count and a retry action. Shown on every screen.
export function SyncBar() {
  const { t } = useTranslation();
  const lang = useFormatLang();
  const sync = useSyncStatus();

  const tone =
    sync.status === 'syncing'
      ? 'bg-info-600'
      : sync.status === 'offline'
        ? 'bg-warn-600'
        : sync.status === 'error'
          ? 'bg-danger-600'
          : 'bg-brand-700';

  function handleRetry() {
    if (sync.failed > 0) {
      void retryFailed();
    } else {
      void flushOutbox();
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-2 px-4 py-1.5 text-xs font-semibold text-white ${tone}`}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-white/90" />
        {t(`sync.${sync.status}`)}
        {sync.pending > 0 ? <span className="font-normal text-white/90">· {t('sync.pending', { count: sync.pending })}</span> : null}
        {sync.failed > 0 ? <span className="font-normal text-white/90">· {t('sync.failed', { count: sync.failed })}</span> : null}
      </span>
      <span className="flex items-center gap-2">
        {sync.status === 'offline' && sync.lastSyncedAt ? (
          <span className="font-normal text-white/90">
            {t('sync.lastSyncedAt', { time: formatDateTime(new Date(sync.lastSyncedAt), lang) })}
          </span>
        ) : null}
        {sync.status === 'error' || sync.failed > 0 ? (
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-md border border-white/40 px-2 py-0.5 font-semibold text-white transition hover:bg-white/10"
          >
            {t('sync.retry')}
          </button>
        ) : null}
      </span>
    </div>
  );
}

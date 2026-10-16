import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../../../lib/pg-errors';
import { useOnlineStatus } from '../../../lib/online';
import { useSession } from '../../auth/queries';
import type { ImportRow } from '../../../lib/database.types';
import {
  buildRowsBlob,
  downloadBlob,
  downloadTemplate,
  parseWorkbook,
  type ParsedWorkbook,
} from '../xlsx';
import {
  TARGET_FIELDS,
  autoMapHeaders,
  validateMapping,
  type ColumnMapping,
  type TargetField,
} from '../schemas';
import {
  useCommitImport,
  useImportBatch,
  useImportRows,
  useStageAndValidate,
  useStartImport,
  useUploadFailedRows,
} from '../queries';
import { newBatchId, type StagedRow } from '../api';
import { MappingTable } from './mapping-table';
import { RowsTable } from './rows-table';

type Step = 'upload' | 'mapping' | 'preview' | 'report';

const STEP_KEYS: Step[] = ['upload', 'mapping', 'preview', 'report'];

function failedRows(rows: ImportRow[]): ImportRow[] {
  return rows.filter((row) => row.status === 'error' || row.status === 'failed');
}

export function ImportWizard() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const { session } = useSession();
  const gymId = session?.gym?.id;

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [batchId, setBatchId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<'skip' | 'update'>('skip');
  const [error, setError] = useState<string | null>(null);

  const start = useStartImport();
  const stage = useStageAndValidate();
  const commit = useCommitImport();
  const uploadFailed = useUploadFailedRows();

  const batch = useImportBatch(batchId ?? undefined);
  const rows = useImportRows(batchId ?? undefined);

  const busy = start.isPending || stage.isPending || commit.isPending;
  const missing = useMemo(() => validateMapping(mapping).missing, [mapping]);

  const templateHeaders = useMemo(
    () => TARGET_FIELDS.map((field) => t(`import.fields.${field}`)),
    [t],
  );

  function currentError(): string | null {
    if (error) return error;
    const thrown = [start.error, stage.error, commit.error, uploadFailed.error].find(Boolean);
    return thrown ? mapError(thrown) : null;
  }

  async function onPickFile(selected: File | null) {
    setError(null);
    if (!selected) return;
    try {
      const parsed = await parseWorkbook(selected);
      setFile(selected);
      setWorkbook(parsed);
      setMapping(autoMapHeaders(parsed.headers));
      setBatchId(null);
      setStep('mapping');
    } catch (thrown) {
      setError(mapError(thrown));
    }
  }

  function setField(field: TargetField, header: string) {
    setMapping((prev) => ({ ...prev, [field]: header || undefined }));
  }

  async function onValidate() {
    setError(null);
    if (!gymId || !file || !workbook) return;
    try {
      let id = batchId;
      if (!id) {
        const created = await start.mutateAsync({
          gymId,
          batchId: newBatchId(),
          filename: file.name,
          file,
        });
        id = created.id;
        setBatchId(id);
      }
      const staged: StagedRow[] = workbook.rows.map((raw, index) => ({ row_no: index + 1, raw }));
      await stage.mutateAsync({ batchId: id, gymId, mapping, rows: staged });
      setStep('preview');
    } catch {
      /* surfaced via currentError() */
    }
  }

  async function onCommit() {
    setError(null);
    if (!batchId) return;
    try {
      await commit.mutateAsync({ batchId, policy });
      setStep('report');
    } catch {
      /* surfaced via currentError() */
    }
  }

  async function onExportFailed() {
    if (!gymId || !batchId || !workbook) return;
    const failed = failedRows(rows.data ?? []);
    if (failed.length === 0) return;
    setError(null);
    try {
      const raw = failed.map((row) => row.raw as Record<string, string>);
      const blob = await buildRowsBlob(workbook.headers, raw);
      const filename = `${batchId}-failed.xlsx`;
      try {
        await uploadFailed.mutateAsync({ batchId, gymId, blob });
      } catch {
        /* storage upload is best-effort; the local download still works */
      }
      downloadBlob(blob, filename);
    } catch (thrown) {
      setError(mapError(thrown));
    }
  }

  function reset() {
    setStep('upload');
    setFile(null);
    setWorkbook(null);
    setMapping({});
    setBatchId(null);
    setPolicy('skip');
    setError(null);
  }

  const message = currentError();
  const counts = batch.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{t('import.title')}</h1>
          <p className="text-sm text-ink-600">{t('import.subtitle')}</p>
        </div>
        {step === 'upload' ? (
          <button
            type="button"
            onClick={() => void downloadTemplate(templateHeaders, 'members-template.xlsx')}
            className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
          >
            {t('import.downloadTemplate')}
          </button>
        ) : null}
      </div>

      <ol className="flex flex-wrap gap-2 text-xs font-semibold">
        {STEP_KEYS.map((key, index) => {
          const active = key === step;
          return (
            <li
              key={key}
              className={`rounded-full px-3 py-1 ${
                active ? 'bg-brand-700 text-white' : 'bg-surface-2 text-ink-600'
              }`}
            >
              {`${index + 1}. `}
              {t(`import.steps.${key}`)}
            </li>
          );
        })}
      </ol>

      {!online ? (
        <p role="alert" className="rounded-xl border border-warn-100 bg-warn-100/60 p-4 text-sm text-warn-600">
          {t('import.offlineBlocked')}
        </p>
      ) : null}

      {message ? (
        <p role="alert" className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600">
          {t(message)}
        </p>
      ) : null}

      {step === 'upload' ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <label htmlFor="import-file" className="text-sm font-semibold text-ink-900">
            {t('import.chooseFile')}
          </label>
          <p className="text-xs text-ink-600">{t('import.chooseFileHint')}</p>
          <input
            id="import-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label={t('import.chooseFile')}
            onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-900"
          />
        </section>
      ) : null}

      {step === 'mapping' ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-ink-600">{t('import.mappingHint')}</p>
          <MappingTable headers={workbook?.headers ?? []} mapping={mapping} onChange={setField} />
          {missing.length > 0 ? (
            <p className="text-sm text-danger-600">
              {t('import.missingRequired', { count: missing.length })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!online || busy || missing.length > 0}
              onClick={() => void onValidate()}
              className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
            >
              {t('import.validate')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={reset}
              className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink-900 transition hover:bg-surface-2 disabled:opacity-60"
            >
              {t('common.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'preview' ? (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['total_rows', 'valid_rows', 'duplicate_rows', 'error_rows'] as const).map((key) => (
              <div key={key} className="rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-xs font-semibold text-ink-600">
                  {t(`import.counts.${key}`)}
                </span>
                <span className="mt-1 block text-xl font-extrabold text-ink-900">
                  {counts ? String(counts[key] ?? 0) : '—'}
                </span>
              </div>
            ))}
          </div>

          <fieldset className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
            <legend className="px-1 text-sm font-semibold text-ink-900">{t('import.policyTitle')}</legend>
            {(['skip', 'update'] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm text-ink-900">
                <input
                  type="radio"
                  name="import-policy"
                  value={value}
                  checked={policy === value}
                  onChange={() => setPolicy(value)}
                  className="h-4 w-4"
                />
                {t(`import.policy.${value}`)}
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            disabled={!online || busy}
            onClick={() => void onCommit()}
            className="h-11 w-full rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
          >
            {t('import.commit')}
          </button>

          <RowsTable rows={rows.data ?? []} />
        </section>
      ) : null}

      {step === 'report' ? (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {(['imported_count', 'skipped_count', 'failed_count'] as const).map((key) => (
              <div key={key} className="rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-xs font-semibold text-ink-600">
                  {t(`import.report.${key}`)}
                </span>
                <span className="mt-1 block text-xl font-extrabold text-ink-900">
                  {counts ? String(counts[key] ?? 0) : '—'}
                </span>
              </div>
            ))}
          </div>

          <h2 className="text-sm font-bold text-ink-900">{t('import.failedTitle')}</h2>
          <RowsTable rows={failedRows(rows.data ?? [])} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={failedRows(rows.data ?? []).length === 0 || !online}
              onClick={() => void onExportFailed()}
              className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
            >
              {t('import.downloadFailed')}
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
            >
              {t('import.startOver')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

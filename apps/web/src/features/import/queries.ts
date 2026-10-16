import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import type { ImportBatch } from '../../lib/database.types';
import {
  createImportBatch,
  fetchImportBatch,
  fetchImportBatches,
  fetchImportRows,
  runCommit,
  runValidate,
  saveImportMapping,
  setFailedRowsPath,
  stageRows,
  uploadFailedRows,
  uploadImportFile,
  type StagedRow,
} from './api';
import type { ColumnMapping } from './schemas';

// Import is online-only: these hooks call Supabase directly (no outbox).
// Reads are scoped by RLS to the owner's gym.

export function useImportBatches(enabled = true) {
  return useQuery({ queryKey: qk.importBatches, queryFn: () => fetchImportBatches(), enabled });
}

export function useImportBatch(batchId?: string) {
  return useQuery({
    queryKey: qk.importBatch(batchId ?? 'none'),
    queryFn: () => fetchImportBatch(batchId as string),
    enabled: Boolean(batchId),
  });
}

export function useImportRows(batchId?: string) {
  return useQuery({
    queryKey: [...qk.importBatch(batchId ?? 'none'), 'rows'] as const,
    queryFn: () => fetchImportRows(batchId as string),
    enabled: Boolean(batchId),
  });
}

export interface StartImportVars {
  gymId: string;
  batchId: string;
  filename: string;
  file: File;
}

/** Upload the workbook + create the batch row. */
export function useStartImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: StartImportVars): Promise<ImportBatch> => {
      const path = await uploadImportFile(vars.gymId, vars.batchId, vars.file);
      return createImportBatch(vars.batchId, vars.gymId, vars.filename, path);
    },
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: qk.importBatches });
      queryClient.invalidateQueries({ queryKey: qk.importBatch(batch.id) });
    },
  });
}

export interface StageVars {
  batchId: string;
  gymId: string;
  mapping: ColumnMapping;
  rows: StagedRow[];
}

/** Save the mapping, stage the rows, then run server-side validation. */
export function useStageAndValidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: StageVars): Promise<void> => {
      await saveImportMapping(vars.batchId, vars.mapping);
      await stageRows(vars.batchId, vars.gymId, vars.rows);
      await runValidate(vars.batchId);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.importBatch(vars.batchId) });
    },
  });
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { batchId: string; policy: 'skip' | 'update' }) =>
      runCommit(vars.batchId, vars.policy),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.importBatch(vars.batchId) });
      queryClient.invalidateQueries({ queryKey: qk.members() });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** Store the failed-rows workbook in Storage + record its path on the batch. */
export function useUploadFailedRows() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { batchId: string; gymId: string; blob: Blob }): Promise<string> => {
      const path = await uploadFailedRows(vars.gymId, vars.batchId, vars.blob);
      await setFailedRowsPath(vars.batchId, path);
      return path;
    },
    onSuccess: (_path, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.importBatch(vars.batchId) });
    },
  });
}

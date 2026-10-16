import { supabase } from '../../lib/supabase';
import { toAppError } from '../../lib/pg-errors';
import type { ImportBatch, ImportRow } from '../../lib/database.types';
import type { ColumnMapping } from './schemas';

// Import reads/writes (DATA-CONTRACT.md row 14). Import is ONLINE-ONLY (the file
// must be uploaded; §7 offline list does not include import), so these writes go
// through Supabase directly instead of the outbox-capable runMutation(). The
// client only parses the workbook to assist mapping; the server validates and
// commits (migration 0007). RLS scopes every call to the owner's gym.

export interface StagedRow {
  row_no: number;
  raw: Record<string, string>;
}

export function newBatchId(): string {
  return crypto.randomUUID();
}

/** Object path inside the private `imports` bucket: {gym_id}/{batch_id}.xlsx */
export function excelPath(gymId: string, batchId: string): string {
  return `${gymId}/${batchId}.xlsx`;
}

export function failedRowsPath(gymId: string, batchId: string): string {
  return `${gymId}/${batchId}-failed.xlsx`;
}

export async function uploadImportFile(gymId: string, batchId: string, file: File): Promise<string> {
  const path = excelPath(gymId, batchId);
  const { error } = await supabase.storage
    .from('imports')
    .upload(path, file, { upsert: true, contentType: file.type || 'application/vnd.ms-excel' });
  if (error) throw toAppError(error);
  return path;
}

export async function createImportBatch(
  batchId: string,
  gymId: string,
  filename: string,
  path: string | null,
): Promise<ImportBatch> {
  const { data, error } = await supabase.rpc('create_import_batch', {
    p_id: batchId,
    p_gym_id: gymId,
    p_filename: filename,
    p_storage_path: path ?? undefined,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function saveImportMapping(batchId: string, mapping: ColumnMapping): Promise<void> {
  const { error } = await supabase.rpc('save_import_mapping', {
    p_batch_id: batchId,
    p_mapping: mapping,
  });
  if (error) throw toAppError(error);
}

/** Replace any previously staged rows for the batch, then insert in chunks. */
export async function stageRows(
  batchId: string,
  gymId: string,
  rows: StagedRow[],
  chunkSize = 500,
): Promise<void> {
  const cleared = await supabase.from('import_rows').delete().eq('batch_id', batchId);
  if (cleared.error) throw toAppError(cleared.error);

  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize).map((row) => ({
      batch_id: batchId,
      gym_id: gymId,
      row_no: row.row_no,
      raw: row.raw,
    }));
    const { error } = await supabase.from('import_rows').insert(slice);
    if (error) throw toAppError(error);
  }
}

export async function runValidate(batchId: string): Promise<void> {
  const { error } = await supabase.rpc('import_validate', { p_batch_id: batchId });
  if (error) throw toAppError(error);
}

export async function runCommit(batchId: string, policy: 'skip' | 'update'): Promise<void> {
  const { error } = await supabase.rpc('import_commit', { p_batch_id: batchId, p_policy: policy });
  if (error) throw toAppError(error);
}

export async function fetchImportBatch(batchId: string): Promise<ImportBatch> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('id', batchId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw toAppError({ code: 'P0002' });
  return data;
}

export async function fetchImportBatches(limit = 10): Promise<ImportBatch[]> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return data;
}

export async function fetchImportRows(batchId: string): Promise<ImportRow[]> {
  const { data, error } = await supabase
    .from('import_rows')
    .select('*')
    .eq('batch_id', batchId)
    .order('row_no', { ascending: true });
  if (error) throw toAppError(error);
  return data;
}

export async function setFailedRowsPath(batchId: string, path: string): Promise<void> {
  const { error } = await supabase
    .from('import_batches')
    .update({ failed_rows_path: path })
    .eq('id', batchId);
  if (error) throw toAppError(error);
}

export async function uploadFailedRows(gymId: string, batchId: string, blob: Blob): Promise<string> {
  const path = failedRowsPath(gymId, batchId);
  const { error } = await supabase.storage.from('imports').upload(path, blob, { upsert: true });
  if (error) throw toAppError(error);
  return path;
}

export async function downloadFailedRows(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from('imports').download(path);
  if (error) throw toAppError(error);
  return data;
}

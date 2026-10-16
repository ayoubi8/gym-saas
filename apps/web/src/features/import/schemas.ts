// Phase 8 — Excel import: pure helpers (no SheetJS, no DOM). The client parses
// the workbook with SheetJS purely to assist mapping; the SERVER validates and
// commits (see supabase/migrations/0007_phase8_import.sql). These mirrors exist
// so the wizard can show instant previews and gate the mapping step.

export const TARGET_FIELDS = [
  'full_name',
  'phone',
  'plan',
  'start_date',
  'end_date',
  'amount_paid',
  'amount_remaining',
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

export type ColumnMapping = Partial<Record<TargetField, string>>;

export const REQUIRED_FIELDS: readonly TargetField[] = ['full_name', 'phone'];

// Header aliases (fr + ar) used by the best-effort auto-mapping. Kept in
// normal form (lowercase, no spaces/punctuation) — see normalizeHeader().
export const HEADER_ALIASES: Record<TargetField, readonly string[]> = {
  full_name: ['fullname', 'name', 'nom', 'nomcomplet', 'الاسم', 'الاسمالكامل', 'الإسم', 'الإسمالكامل'],
  phone: ['phone', 'telephone', 'tel', 'numero', 'num', 'الهاتف', 'رقمالهاتف', 'الهاتفالمحمول', 'رقم'],
  plan: ['plan', 'formule', 'abonnement', 'offre', 'الاشتراك', 'العرض', 'الصيغة'],
  start_date: ['startdate', 'start', 'datedebut', 'debut', 'بداية', 'تاريخالبداية', 'البداية'],
  end_date: ['enddate', 'end', 'datefin', 'fin', 'تاريخالنهاية', 'النهاية', 'نهاية'],
  amount_paid: ['amountpaid', 'paid', 'paye', 'montantpaye', 'المدفوع', 'المبلغم'],
  amount_remaining: ['amountremaining', 'remaining', 'reste', 'montantrestant', 'المتبقي', 'الباقي'],
};

const ARABIC_INDIC = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
const EASTERN_ARABIC = '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9';

/** Arabic-Indic / Eastern-Arabic digits -> ASCII. */
export function toAsciiDigits(value: string): string {
  let out = '';
  for (const char of value) {
    const ar = ARABIC_INDIC.indexOf(char);
    if (ar >= 0) {
      out += String(ar);
      continue;
    }
    const ea = EASTERN_ARABIC.indexOf(char);
    out += ea >= 0 ? String(ea) : char;
  }
  return out;
}

/** lower-case, accent-stripped, digits -> ASCII, drop spaces/punctuation. */
export function normalizeHeader(value: string): string {
  return toAsciiDigits(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s._\-/\\()]+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

/** Best-effort header -> target-field mapping (owner can always override). */
export function autoMapHeaders(headers: readonly string[]): ColumnMapping {
  const normalized = headers.map((header) => ({ header, key: normalizeHeader(header) }));
  const mapping: ColumnMapping = {};

  for (const field of TARGET_FIELDS) {
    const aliases = HEADER_ALIASES[field].map(normalizeHeader);
    const exact = normalized.find((entry) => aliases.includes(entry.key));
    const partial =
      exact ?? normalized.find((entry) => entry.key !== '' && aliases.some((a) => entry.key.includes(a)));
    if (partial) {
      mapping[field] = partial.header;
    }
  }
  return mapping;
}

/** Mapping is runnable when both required targets point at a real column. */
export function validateMapping(mapping: ColumnMapping): { missing: TargetField[] } {
  const missing = REQUIRED_FIELDS.filter((field) => !mapping[field]);
  return { missing };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isoFromParts(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Mirror of public.parse_import_date(): ISO date string or null (empty/invalid). */
export function parseCellDate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const value = toAsciiDigits(String(raw)).replace(/\s+/g, '').trim();
  if (value === '') return null;

  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(value);
  if (match) return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(value);
  if (match) return isoFromParts(Number(match[3]), Number(match[2]), Number(match[1]));

  return null;
}

/** Mirror of public.parse_import_int(): whole number or null (empty/invalid). */
export function parseCellInt(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const value = toAsciiDigits(String(raw)).replace(/[^0-9-]/g, '');
  if (value === '' || value === '-' || !/^-?\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

// Row/batch status + error codes -> i18n keys (never render raw codes).
export const ROW_STATUS_KEY: Record<string, string> = {
  valid: 'import.statusValid',
  error: 'import.statusError',
  duplicate: 'import.statusDuplicate',
  imported: 'import.statusImported',
  skipped: 'import.statusSkipped',
  failed: 'import.statusFailed',
};

export const REASON_KEY: Record<string, string> = {
  MISSING_NAME: 'import.reasonMissingName',
  MISSING_PHONE: 'import.reasonMissingPhone',
  INVALID_PHONE: 'import.reasonInvalidPhone',
  INVALID_DATE: 'import.reasonInvalidDate',
  INVALID_AMOUNT: 'import.reasonInvalidAmount',
  UNKNOWN_PLAN: 'import.reasonUnknownPlan',
  DUPLICATE_PHONE: 'import.reasonDuplicatePhone',
};

export function rowStatusKey(status: string): string {
  return ROW_STATUS_KEY[status] ?? 'import.statusError';
}

export function reasonKey(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_KEY[reason] ?? null;
}

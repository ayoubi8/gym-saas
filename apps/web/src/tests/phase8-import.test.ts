import { describe, expect, it } from 'vitest';
import ar from '../i18n/ar.json';
import fr from '../i18n/fr.json';
import {
  REASON_KEY,
  ROW_STATUS_KEY,
  autoMapHeaders,
  normalizeHeader,
  parseCellDate,
  parseCellInt,
  reasonKey,
  rowStatusKey,
  toAsciiDigits,
  validateMapping,
} from '../features/import/schemas';

// Phase 8 (PRD §5.10). Pure import helpers: the client parses with SheetJS only
// to assist mapping; the SERVER is the validation truth (migration 0007). The
// SQL/psql path and the SheetJS browser path are recorded as deviations.

type Json = { [key: string]: unknown };

function flatten(obj: Json, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v as Json, key));
    else out.push(key);
  }
  return out;
}

const arKeys = new Set(flatten(ar as Json));
const frKeys = new Set(flatten(fr as Json));

describe('Arabic-Indic digit handling (FR-I7)', () => {
  it('translates Arabic-Indic and Eastern-Arabic digits', () => {
    expect(toAsciiDigits('٠٥٥٥١٢٣٤٥٦')).toBe('0555123456');
    expect(toAsciiDigits('۱۲۳')).toBe('123');
    expect(toAsciiDigits('abc')).toBe('abc');
  });
});

describe('column auto-mapping (FR-I3)', () => {
  it('maps French headers (accents folded)', () => {
    const mapping = autoMapHeaders([
      'Nom complet',
      'Téléphone',
      'Formule',
      'Date de début',
      'Date de fin',
      'Montant payé',
      'Montant restant',
    ]);
    expect(mapping).toEqual({
      full_name: 'Nom complet',
      phone: 'Téléphone',
      plan: 'Formule',
      start_date: 'Date de début',
      end_date: 'Date de fin',
      amount_paid: 'Montant payé',
      amount_remaining: 'Montant restant',
    });
  });

  it('maps Arabic headers', () => {
    const mapping = autoMapHeaders(['الاسم الكامل', 'رقم الهاتف', 'المبلغ المتبقي']);
    expect(mapping.full_name).toBe('الاسم الكامل');
    expect(mapping.phone).toBe('رقم الهاتف');
    expect(mapping.amount_remaining).toBe('المبلغ المتبقي');
  });

  it('folds accents and strips punctuation in normalizeHeader', () => {
    expect(normalizeHeader(' Téléphone ')).toBe('telephone');
    expect(normalizeHeader('Date_ début.')).toBe('datedebut');
  });

  it('flags missing required columns', () => {
    expect(validateMapping({ full_name: 'Nom' }).missing).toEqual(['phone']);
    expect(validateMapping({ full_name: 'Nom', phone: 'Tel' }).missing).toEqual([]);
  });
});

describe('cell parsers mirror the SQL helpers', () => {
  it('parses ISO / slash / dotted dates and Arabic-Indic digits', () => {
    expect(parseCellDate('2024-01-15')).toBe('2024-01-15');
    expect(parseCellDate('15/01/2024')).toBe('2024-01-15');
    expect(parseCellDate('15-01-2024')).toBe('2024-01-15');
    expect(parseCellDate('2024.1.5')).toBe('2024-01-05');
    expect(parseCellDate('١٥/٠١/٢٠٢٤')).toBe('2024-01-15');
  });

  it('rejects empty and impossible dates', () => {
    expect(parseCellDate('')).toBeNull();
    expect(parseCellDate('   ')).toBeNull();
    expect(parseCellDate('2024-02-30')).toBeNull();
    expect(parseCellDate('not a date')).toBeNull();
  });

  it('parses whole DZD amounts, tolerating separators/currency', () => {
    expect(parseCellInt('1500')).toBe(1500);
    expect(parseCellInt('1 500 DA')).toBe(1500);
    expect(parseCellInt('٠٥٠٠')).toBe(500);
    expect(parseCellInt('1,500')).toBe(1500);
  });

  it('rejects blank/garbage amounts', () => {
    expect(parseCellInt('')).toBeNull();
    expect(parseCellInt('abc')).toBeNull();
    expect(parseCellInt('-')).toBeNull();
  });
});

describe('status/reason i18n keys resolve in BOTH locales', () => {
  it('every row status and reason maps to an existing key', () => {
    const missing: string[] = [];
    for (const key of [...Object.values(ROW_STATUS_KEY), ...Object.values(REASON_KEY)]) {
      if (!arKeys.has(key)) missing.push(`ar:${key}`);
      if (!frKeys.has(key)) missing.push(`fr:${key}`);
    }
    expect(missing).toEqual([]);
  });

  it('unknown codes fall back safely', () => {
    expect(rowStatusKey('valid')).toBe('import.statusValid');
    expect(rowStatusKey('nonsense')).toBe('import.statusError');
    expect(reasonKey('MISSING_PHONE')).toBe('import.reasonMissingPhone');
    expect(reasonKey(null)).toBeNull();
    expect(reasonKey('mystery')).toBeNull();
  });
});

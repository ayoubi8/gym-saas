import { describe, it, expect } from 'vitest';
import { ERROR_KEY_BY_CODE, mapEdgeErrorCode } from '../lib/pg-errors';

// Edge Functions return `{ error: <CODE> }` (supabase/functions/_shared/http.ts).
describe('mapEdgeErrorCode', () => {
  it('maps Edge Function codes to AppErrorCode', () => {
    expect(mapEdgeErrorCode('WEAK_PASSWORD')).toBe('WEAK_PASSWORD');
    expect(mapEdgeErrorCode('PHONE_TAKEN')).toBe('PHONE_TAKEN');
    expect(mapEdgeErrorCode('EMAIL_TAKEN')).toBe('EMAIL_TAKEN');
    expect(mapEdgeErrorCode('NOT_FOUND')).toBe('NOT_FOUND');
    expect(mapEdgeErrorCode('INVALID_INPUT')).toBe('INVALID_INPUT');
    expect(mapEdgeErrorCode('FORBIDDEN')).toBe('RLS_DENIED');
  });

  it('is case-insensitive and falls back to UNKNOWN', () => {
    expect(mapEdgeErrorCode('weak_password')).toBe('WEAK_PASSWORD');
    expect(mapEdgeErrorCode('SOMETHING_ELSE')).toBe('UNKNOWN');
    expect(mapEdgeErrorCode(undefined)).toBe('UNKNOWN');
    expect(mapEdgeErrorCode(null)).toBe('UNKNOWN');
  });

  it('exposes i18n keys for the new admin codes', () => {
    expect(ERROR_KEY_BY_CODE.WEAK_PASSWORD).toBe('errors.weakPassword');
    expect(ERROR_KEY_BY_CODE.PHONE_TAKEN).toBe('errors.duplicatePhone');
    expect(ERROR_KEY_BY_CODE.EMAIL_TAKEN).toBe('errors.duplicateEmail');
    expect(ERROR_KEY_BY_CODE.NOT_FOUND).toBe('errors.notFound');
    expect(ERROR_KEY_BY_CODE.INVALID_INPUT).toBe('errors.invalidInput');
  });
});

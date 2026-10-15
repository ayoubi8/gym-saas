import { describe, it, expect } from 'vitest';
import { normalizeDzPhone, toAsciiDigits, isValidDzPhone } from '../lib/phone';

describe('normalizeDzPhone', () => {
  it('normalizes local mobile formats to +213XXXXXXXXX', () => {
    expect(normalizeDzPhone('0555 12 34 56')).toBe('+213555123456');
    expect(normalizeDzPhone('0555123456')).toBe('+213555123456');
    expect(normalizeDzPhone('0555-12-34-56')).toBe('+213555123456');
    expect(normalizeDzPhone('(0555) 12 34 56')).toBe('+213555123456');
  });

  it('normalizes international +213 / 213 / 00213 forms', () => {
    expect(normalizeDzPhone('+213 555 12 34 56')).toBe('+213555123456');
    expect(normalizeDzPhone('+213555123456')).toBe('+213555123456');
    expect(normalizeDzPhone('213555123456')).toBe('+213555123456');
    expect(normalizeDzPhone('00213555123456')).toBe('+213555123456');
  });

  it('accepts the full Algerian mobile prefix range 5/6/7', () => {
    expect(normalizeDzPhone('0655123456')).toBe('+213655123456');
    expect(normalizeDzPhone('0755123456')).toBe('+213755123456');
  });

  it('normalizes Arabic-Indic and Eastern-Arabic digits', () => {
    // ٠٥٥٥١٢٣٤٥٦ (U+0660 range)
    expect(normalizeDzPhone('٠٥٥٥١٢٣٤٥٦')).toBe('+213555123456');
    // ۰۵۵۵۱۲۳۴۵۶ (U+06F0 range)
    expect(normalizeDzPhone('۰۵۵۵۱۲۳۴۵۶')).toBe('+213555123456');
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('supports landline numbers (8 national digits starting 2/3/4)', () => {
    expect(normalizeDzPhone('021 23 45 67')).toBe('+21321234567');
    expect(normalizeDzPhone('+213 21 23 45 67')).toBe('+21321234567');
  });

  it('returns null for invalid input', () => {
    expect(normalizeDzPhone('')).toBeNull();
    expect(normalizeDzPhone('   ')).toBeNull();
    expect(normalizeDzPhone('12345')).toBeNull();
    expect(normalizeDzPhone('+33 6 12 34 56 78')).toBeNull();
    expect(normalizeDzPhone('not-a-phone')).toBeNull();
    // @ts-expect-error runtime guard for non-string input
    expect(normalizeDzPhone(null)).toBeNull();
  });

  it('isValidDzPhone mirrors normalizeDzPhone', () => {
    expect(isValidDzPhone('0555123456')).toBe(true);
    expect(isValidDzPhone('123')).toBe(false);
  });
});

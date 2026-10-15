// Algerian phone normalization (AGENTS.md §5.3, DATA-MODEL.md).
// Accepts local (`0555 12 34 56`), international (`+213 555 12 34 56`, `00213...`)
// and Arabic-Indic / Eastern-Arabic digits. Output is ALWAYS `+213XXXXXXXXX`
// (or null when the input is not a valid Algerian number).

export const DZ_COUNTRY_CODE = '213';

/** Convert Arabic-Indic (U+0660..) and Eastern-Arabic (U+06F0..) digits to ASCII. */
export function toAsciiDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) {
      out += String(code - 0x0660);
    } else if (code >= 0x06f0 && code <= 0x06f9) {
      out += String(code - 0x06f0);
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Normalize an Algerian phone number to `+213XXXXXXXXX`.
 * Mobile: 9 national digits starting 5/6/7. Landline: 8 national digits starting 2/3/4.
 * Returns null when the value cannot be interpreted as a valid DZ number.
 */
export function normalizeDzPhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  let s = toAsciiDigits(raw).trim();
  if (!s) return null;

  s = s.replace(/[\s\u00a0\-().]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('00')) s = s.slice(2);

  const digits = s.replace(/\D/g, '');
  if (!digits) return null;

  let national = digits;
  if (national.startsWith(DZ_COUNTRY_CODE)) {
    national = national.slice(DZ_COUNTRY_CODE.length);
  } else if (national.startsWith('0')) {
    national = national.replace(/^0+/, '');
  }

  if (national.length === 9 && '567'.includes(national[0])) {
    return `+${DZ_COUNTRY_CODE}${national}`;
  }
  if (national.length === 8 && '234'.includes(national[0])) {
    return `+${DZ_COUNTRY_CODE}${national}`;
  }
  return null;
}

export function isValidDzPhone(raw: string): boolean {
  return normalizeDzPhone(raw) !== null;
}

/** Display helper: `+213555123456` -> `0555 12 34 56`. */
export function formatDzPhoneForDisplay(normalized: string): string {
  if (!normalized.startsWith('+213')) return normalized;
  const national = normalized.slice(4);
  const local = `0${national}`;
  if (national.length === 9) {
    return `${local.slice(0, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`;
  }
  return local;
}

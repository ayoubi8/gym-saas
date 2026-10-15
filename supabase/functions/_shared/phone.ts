// Algerian phone normalization for Edge Functions.
// MIRROR of apps/web/src/lib/phone.ts — keep the two in sync (AGENTS.md §5.3).
// Output is ALWAYS `+213XXXXXXXXX` (or null when not a valid Algerian number).

export const DZ_COUNTRY_CODE = '213';
export const SYNTHETIC_PHONE_DOMAIN = 'phone.gymdz.app';

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

/** Normalize an Algerian phone number to `+213XXXXXXXXX`; null when invalid. */
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

/** `+213555123456` -> `213555123456@phone.gymdz.app`; null when invalid phone. */
export function phoneToSyntheticEmail(phone: string): string | null {
  const normalized = normalizeDzPhone(phone);
  if (!normalized) return null;
  return `${normalized.slice(1)}@${SYNTHETIC_PHONE_DOMAIN}`;
}

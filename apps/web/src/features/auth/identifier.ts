import { normalizeDzPhone } from '../../lib/phone';

// Auth mapping (DATA-MODEL.md "Auth mapping"): Supabase Auth is email+password.
// A phone login is mapped to a synthetic email `<digits>@phone.gymdz.app`.
// This module is pure (no Supabase import) so it is unit-testable.

export const SYNTHETIC_PHONE_DOMAIN = 'phone.gymdz.app';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailLike(value: string): boolean {
  return value.includes('@');
}

/** `+213555123456` -> `213555123456@phone.gymdz.app`; null when not a valid DZ phone. */
export function phoneToSyntheticEmail(phone: string): string | null {
  const normalized = normalizeDzPhone(phone);
  if (!normalized) return null;
  return `${normalized.slice(1)}@${SYNTHETIC_PHONE_DOMAIN}`;
}

/** Accepts an email (as-is, lowercased) or an Algerian phone (synthetic email). */
export function mapIdentifierToEmail(identifier: string): string | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (isEmailLike(trimmed)) {
    return EMAIL_RE.test(trimmed) ? trimmed.toLowerCase() : null;
  }

  return phoneToSyntheticEmail(trimmed);
}

// Intl formatters (DESIGN-SYSTEM.md §3). Currency DZD, locales ar-DZ / fr-DZ.

export type FormatLang = 'ar' | 'fr';

const LOCALES: Record<FormatLang, string> = {
  ar: 'ar-DZ',
  fr: 'fr-DZ',
};

export function formatCurrency(amountDzd: number, lang: FormatLang): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 0,
  }).format(amountDzd);
}

export function formatNumber(value: number, lang: FormatLang): string {
  return new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | Date, lang: FormatLang): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date, lang: FormatLang): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

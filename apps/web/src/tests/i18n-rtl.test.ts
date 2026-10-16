import { describe, expect, it } from 'vitest';
import ar from '../i18n/ar.json';
import fr from '../i18n/fr.json';
import { ERROR_KEY_BY_CODE } from '../lib/pg-errors';
import { formatCurrency, formatDate, formatNumber } from '../lib/format';

// Phase 6 (PRD §5.7 FR-L1/L2/L4). Static gates that run without a browser:
//  - AR and FR catalogs hold exactly the same keys (no half-translated screen);
//  - every Postgres/Edge error code maps to a key present in BOTH locales;
//  - every t('…') / labelKey key used in src exists in BOTH locales;
//  - no physical (non-mirroring) Tailwind utilities in components;
//  - ar-DZ / fr-DZ Intl formatters produce localized money/date output.
// Rendering each route per locale is out of reach here (no browser / no env) —
// the t()-key scan is the substitute; recorded as a Phase 6 deviation.

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

// Every non-test source file, loaded as raw text via Vite's glob (no Node APIs).
const srcFiles = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const arKeys = new Set(flatten(ar as Json));
const frKeys = new Set(flatten(fr as Json));

describe('i18n catalog parity (Phase 6)', () => {
  it('ar and fr expose the same key set', () => {
    const missingInFr = [...arKeys].filter((k) => !frKeys.has(k)).sort();
    const missingInAr = [...frKeys].filter((k) => !arKeys.has(k)).sort();
    expect({ missingInFr, missingInAr }).toEqual({ missingInFr: [], missingInAr: [] });
  });

  it('every mapped error code resolves in BOTH locales', () => {
    const missing: string[] = [];
    for (const [code, key] of Object.entries(ERROR_KEY_BY_CODE)) {
      if (!arKeys.has(key)) missing.push(`${code} -> ar:${key}`);
      if (!frKeys.has(key)) missing.push(`${code} -> fr:${key}`);
    }
    expect(missing).toEqual([]);
  });
});

describe('zero missing UI keys (Phase 6)', () => {
  it('every t("…") / labelKey key used in src exists in both locales', () => {
    const used = new Set<string>();
    const literal = /\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g;
    const labelKey = /\blabelKey:\s*['"]([A-Za-z0-9_.]+)['"]/g;
    for (const content of Object.values(srcFiles)) {
      for (const re of [literal, labelKey]) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) used.add(match[1]);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter((k) => !arKeys.has(k) || !frKeys.has(k)).sort();
    expect(missing).toEqual([]);
  });
});

describe('RTL mirror checklist (Phase 6, FR-L2)', () => {
  // Directional utilities that do not mirror; use logical (ms/me/ps/pe,
  // text-start/end, rounded-s/e, start-/end-) or rtl:rotate-180 instead.
  const PHYSICAL =
    /(?:^|[\s"'`])(?:-?(?:ml|mr|pl|pr)-\d|text-(?:left|right)\b|rounded-[lr]-|border-[lr]\b|space-x-\d|(?:left|right)-\d)/;

  it('no physical Tailwind utilities in components', () => {
    const hits: string[] = [];
    for (const [path, content] of Object.entries(srcFiles)) {
      content.split('\n').forEach((line, i) => {
        if (PHYSICAL.test(line)) hits.push(`${path}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('ar-DZ / fr-DZ Intl formatters (Phase 6, FR-L4)', () => {
  it('formats money in DZD for both locales', () => {
    for (const lang of ['ar', 'fr'] as const) {
      const formatted = formatCurrency(12500, lang);
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).toMatch(/12|١٢/);
    }
  });

  it('formats numbers for both locales', () => {
    expect(formatNumber(1234, 'fr').length).toBeGreaterThan(0);
    expect(formatNumber(1234, 'ar').length).toBeGreaterThan(0);
  });

  it('localizes dates differently per locale (mirror RTL/LTR)', () => {
    const arDate = formatDate('2026-10-16', 'ar');
    const frDate = formatDate('2026-10-16', 'fr');
    expect(arDate.length).toBeGreaterThan(0);
    expect(frDate.length).toBeGreaterThan(0);
    expect(arDate).not.toBe(frDate);
  });
});

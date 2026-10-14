# DESIGN-SYSTEM.md — Gym SaaS (Algeria MVP)

Source of truth for UI tokens. Stitch prompts must reference these tokens.
`design/<screen>/code.html` must be rebuilt with these tokens (no inline hex outside tokens).

## 1. Principles

- Mobile-first (base = 360px phone, one-hand use). Scale up with `md:` / `lg:`.
- High contrast — must stay readable in bright gym lighting (contrast ≥ 4.5:1 for body text).
- Big tap targets: min 44×44px. Key actions ≤ 3 taps from home (FAB + bottom nav).
- Tables → cards on small screens.
- All strings via i18next (`ar` + `fr`). No hard-coded UI text.

## 2. Colors (Tailwind extended theme)

| Token | Value | Usage |
|---|---|---|
| `brand-900` | `#0B1F14` | App bar / sidebar bg (dark gym green) |
| `brand-700` | `#14532D` | Primary buttons, active nav |
| `brand-500` | `#22C55E` | Primary accent, progress |
| `brand-100` | `#DCFCE7` | Active-status chip bg |
| `ink-900` | `#111827` | Headings |
| `ink-600` | `#4B5563` | Secondary text |
| `ink-400` | `#9CA3AF` | Placeholders, hints |
| `surface` | `#FFFFFF` | Cards |
| `surface-2` | `#F3F4F6` | Page bg |
| `line` | `#E5E7EB` | Borders, dividers |
| `danger-600` | `#DC2626` | Expired / owing / destructive |
| `danger-100` | `#FEE2E2` | Expired chip bg |
| `warn-600` | `#D97706` | Frozen |
| `warn-100` | `#FEF3C7` | Frozen chip bg |
| `info-600` | `#2563EB` | Links, sync info |
| `success-600` | `#16A34A` | Active, paid, sync OK |

Dark surfaces (`brand-900`) use white text; light surfaces use `ink-900`.

## 3. Typography

- Font stack: `"Inter", "Noto Kufi Arabic", "Cairo", system-ui, sans-serif`.
  - Latin: Inter. Arabic: Noto Kufi Arabic (headings) / Cairo (body).
- Scale (mobile base): display 24/700, title 18/700, body 15/400 (min 14px), caption 13/400, numeric/tabular for money.
- Numbers/money: `font-variant-numeric: tabular-nums`, formatted with `Intl.NumberFormat(ar-DZ|fr-DZ, { style:'currency', currency:'DZD', maximumFractionDigits: 0 })`.
- Dates: `Intl.DateTimeFormat(ar-DZ|fr-DZ, { day:'numeric', month:'short', year:'numeric' })`.

## 4. Status colors (mandatory — matches AGENTS.md §8)

| Status | Chip bg | Chip text | Dot |
|---|---|---|---|
| Active | `brand-100` `#DCFCE7` | `#166534` | `success-600` |
| Expired | `danger-100` `#FEE2E2` | `#991B1B` | `danger-600` |
| Frozen | `warn-100` `#FEF3C7` | `#92400E` | `warn-600` |
| Owing (badge) | `danger-600` `#DC2626` | `#FFFFFF` | — |
| Paid | `brand-100` | `#166534` | `success-600` |

Never use other colors for these states.

## 5. Radius / spacing / elevation

- Radius: `rounded-xl` (12px) cards, `rounded-lg` (8px) inputs/buttons, `rounded-full` chips/FAB.
- Spacing scale: Tailwind default (4px base). Card padding `p-4` mobile, `p-6` desktop.
- Shadows: `shadow-sm` cards, `shadow-lg` FAB/modals. Borders `1px line` on cards.

## 6. Components

- **Bottom nav (mobile) / sidebar (desktop):** Home, Members, Payments, More. Active = `brand-700` + label.
- **FAB:** `56px`, `brand-700` bg, white `+` icon → Add member / Record payment / Renew.
- **Cards:** `bg-surface rounded-xl border border-line shadow-sm p-4`.
- **Inputs:** height 48px, `rounded-lg border-line`, focus ring `brand-500`. Label above, inline error below in user's language.
- **Buttons:** primary `bg-brand-700 text-white rounded-lg h-12`; secondary `border`; danger `bg-danger-600`.
- **Sync bar:** fixed top, `Online (green) / Offline (amber) / Syncing (blue pulse) / Sync error (red)`, always visible + `last_synced_at` text when offline.
- **Widgets (dashboard):** 4 tappable cards (Active members, Revenue today+month, Expiring week, Unpaid). Each opens filtered list.
- Mixed Arabic + phone: wrap name in `<bdi>`, phone in `<bdi dir="ltr">` or isolate.

## 7. RTL / LTR

- `ar` → `<html dir="rtl" lang="ar">`, `fr` → `dir="ltr"`.
- Use logical utilities only: `ms-*, me-*, ps-*, pe-*, text-start/end, rounded-s/e, start-/end-`. Never `ml-/mr-/left/right`.
- Icons that imply direction (back, chevrons) must flip in RTL (`rtl:rotate-180`).

## 8. Stitch prompt footer (append to every screen prompt)

> "Mobile-first PWA, Tailwind. Colors: brand-900 #0B1F14, brand-700 #14532D, surface #FFFFFF, page #F3F4F6, line #E5E7EB, success #16A34A, danger #DC2626, warn #D97706. Font Inter + Noto Kufi Arabic. Rounded-xl cards, 48px inputs, 44px tap targets. Status chips: active green #DCFCE7/#166534, expired red #FEE2E2/#991B1B, frozen amber #FEF3C7/#92400E. Support ar (RTL) + fr (LTR) with logical properties. Export mobile + desktop screenshots and full code.html."

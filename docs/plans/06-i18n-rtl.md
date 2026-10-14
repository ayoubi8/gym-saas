# Phase 6 — i18n + RTL pass (PRD §5.7)

## Goal
Full Arabic + French from day one, correct mirroring, no hard-coded strings
anywhere. Scope-neutral pass over all shipped screens (no feature changes).

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@apps/web/src/i18n/ (existing dictionaries)

## DB
- None (reminder templates content pass happens in Phase 9).

## Build
1. Extract every remaining hard-coded UI string into `ar.json` / `fr.json`;
   fail the build on detectable hard-coded strings (lint rule if feasible).
2. `ar` → `dir="rtl"`, `fr` → `dir="ltr"` on `<html>`; audit all components for
   physical properties — replace with logical (`ms-/me-/ps-/pe-/start-/end-`);
   direction icons flip (`rtl:rotate-180`).
3. `Intl.DateTimeFormat` + `Intl.NumberFormat` (`ar-DZ`/`fr-DZ`, `DZD`, 0 decimals)
   via shared formatters; `<bdi>`/isolate for mixed Arabic + phone content.
4. Always-visible language switcher; choice persisted (`localStorage` + profile);
   per-member language field ready (used in Phase 9).

## Tests
- Snapshot/key-coverage: every rendered screen has zero missing keys in both
  locales; RTL screenshot review checklist per screen (mirror menus/tables/forms).

## Done when
AGENTS.md §11 ticks (§6 items specifically); build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 7.

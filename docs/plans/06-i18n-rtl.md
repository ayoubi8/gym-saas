# Phase 6 — i18n + RTL pass (PRD §5.7)

## Goal
Full Arabic + French, correct mirroring, zero hard-coded strings. Scope-neutral pass
over shipped screens — no feature or contract changes.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md (§7) @docs/SCREENS.md
@apps/web/src/i18n/ @docs/DATA-CONTRACT.md (error-code → i18n column)

## Data contract
No changes (reads/writes untouched). Verifies every mapped error code has BOTH
`ar` and `fr` strings (mapper key-coverage).

## Backend tasks
None.

## Frontend wiring
1. Extract all remaining hard-coded strings to `ar.json`/`fr.json`; lint rule failing
   the build on detectable literals (heuristic, documented limits).
2. `dir` switch on `<html>`; physical→logical CSS audit; direction-icon flips.
3. Shared `Intl` formatters (`ar-DZ`/`fr-DZ`, DZD 0-decimals); `<bdi>`/isolate for
   names + phones; persisted switcher (`localStorage` + `profiles.language`).

## Tests
- Key-coverage test: render every route in both locales, zero missing keys (incl. all
  DATA-CONTRACT error codes).
- RTL mirror checklist per screen (menus/tables/forms/chevrons); `ar-DZ`/`fr-DZ`
  money/date snapshots.

## Done when
AGENTS.md §11 ticks (§6 items); build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 7.

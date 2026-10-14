# Phase 8 — Excel import (PRD §5.10)

## Goal
Painless migration from paper/Excel: guided import that never destroys existing
data and handles Arabic content.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
(xlsx/SheetJS per stack; template columns FR-I2)

> `design/14-import-excel/` has NO Stitch export — build `/import` from FR-I1…I9
> + DESIGN-SYSTEM.md.

## DB
- Import writes through the same validated path as manual entry (normalization,
  per-gym duplicate check, audit rows). Re-runnable by construction.

## Build
1. `/import`: upload `.xlsx`/`.csv` (Storage-backed) → downloadable template
   (`full_name, phone, plan, start_date, end_date, amount_paid, amount_remaining`).
2. Column-mapping step for foreign headers → validation preview (valid / error /
   duplicate counts + row-level reasons: missing name/phone, bad phone, duplicate).
3. Duplicate policy selector (skip | update) → import run → report
   (imported/skipped/failed + failed-rows file download).
4. Arabic text + Arabic-Indic digits normalization; imported members get correct
   status from `end_date` (Active/Expired); plan/dates optional per FR-I2.

## Tests
- Fixture workbook (AR names, Arabic-Indic digits, mixed valid/error/duplicate
  rows): preview counts exact; skip vs update policies; re-run changes nothing;
  failed-rows download matches failures.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 9.

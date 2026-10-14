# Phase 8 — Excel import, server-side (PRD §5.10)

## Goal
Guided import that never destroys data: upload → map → server-side validate →
preview → commit (chunked to 5,000 rows) → report. Staging in `import_rows`.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@docs/DATA-CONTRACT.md (14 row) (xlsx/SheetJS for client parse)

> `design/14-import-excel/` has NO Stitch export — build from FR-I1…I9.

## Data contract
Row 14: Storage upload → `create_import_batch` → `save_import_mapping` →
`import_validate` → `import_commit(batch, skip|update)`; error codes; invalidates
`['members'], ['dashboard'], ['import', batch]`.

## Backend tasks
- `import_validate(batch_id)`: chunked (500 rows/txn) parsing of staged file: per-row
  normalization via THE SAME functions as `create_member` (one code path), statuses
  into `import_rows` (`valid|error|duplicate` + reason), batch counters updated,
  status → `previewed`.
- `import_commit(batch_id, policy)`: chunked + idempotent (re-run safe, status
  `committed` guard → `BATCH_ALREADY_COMMITTED`); `valid` → member + subscription
  (+ payment if amount_paid > 0); `update` policy modifies matched members.
- Storage policies: private `imports` bucket, `imports/{gym_id}/…` owner-scoped;
  failed-rows file written back to `failed_rows_path` for download.

## Frontend wiring
- `features/import/`: `/import` wizard (upload → template download → mapping →
  preview counts + row reasons → policy selector → report + failed-rows download).
  Client parses with SheetJS only to assist mapping; VALIDATION TRUTH IS SERVER.

## Tests
- SQL: 5,000-row fixture commits within timeout (chunked); re-run no-op; skip vs
  update verified; AR names + Arabic-Indic digits normalize.
- vitest/e2e: preview counts exact; failed-rows download matches failures.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 9.

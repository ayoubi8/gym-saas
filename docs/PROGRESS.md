# PROGRESS — gym-saas build log

One entry per phase, newest on top. Updated by the agent as the last step of
every phase, before commit + push to `main`.

| Phase | Plan | Status | Commit | Tests | Notes |
|---|---|---|---|---|---|
| 0 | `docs/plans/00-init.md` | done | e3f5dc1 | npm install ✅ (465 pkgs); tsc baseline: no tsconfig yet (Phase 1B) | init close-out |
| 1A | `docs/plans/01a-database.md` | done | 8c9af96 | build ✅ lint ✅ test ✅ (vitest parity pass); 20 SQL isolation tests | full schema, RLS, RPCs, seed, isolation proof |
| 1B | `docs/plans/01b-app-shell.md` | planned | — | — | app shell, auth, data layer, login |

## Phase 1A — Database: full schema, RLS, RPCs, seed, isolation proof (2026-10-15)
- Landed: Migration `supabase/migrations/0002_core_schema.sql` (17 tables, enums, triggers, views, RLS policies, all RPCs, audit log, receipt counters); `supabase/seed/seed.sql` (2 gyms, 2 owners, members across statuses, plans, payments, pauses); `supabase/tests/rls_isolation.sql` (20 SQL assertion tests covering cross-gym isolation, immutable payments, audit logging, reminders idempotency, status views); `scripts/test-db.js` runner; TypeScript definitions generated in `apps/web/src/lib/database.types.ts`; Vitest parity test suite in `apps/web/src/tests/parity-fixtures.test.ts`.
- Verification: `npm run build` ✅ exit 0 (tsc --noEmit + vite build); `npm run lint` ✅ exit 0 (eslint src); `npm run test` ✅ exit 0 (2 parity tests passing in vitest).
- Design refs used: none (no UI in this phase).
- Deviations from plan: none.
- Next: Phase 1B — App shell, auth, data layer, login, i18n shells.

| 2 | `docs/plans/02-admin.md` | planned | — | — | admin gyms + onboarding wizard |
| 3 | `docs/plans/03-members-plans-subscriptions.md` | planned | — | — | members, plans, subscriptions, freeze/extend |
| 4 | `docs/plans/04-payments.md` | planned | — | — | payments + receipts |
| 5 | `docs/plans/05-dashboard.md` | planned | — | — | dashboard widgets |
| 6 | `docs/plans/06-i18n-rtl.md` | planned | — | — | Arabic/French + RTL pass |
| 7 | `docs/plans/07-offline.md` | planned | — | — | PWA offline + sync |
| 8 | `docs/plans/08-import.md` | planned | — | — | Excel import |
| 9 | `docs/plans/09-reminders.md` | planned | — | — | reminders (log + manual share) |
| 10 | `docs/plans/10-pilot.md` | planned | — | — | pilot hardening + launch |

## Phase 0 — Init close-out (2026-10-14)
- Landed: Added §12 Working-style rule to `AGENTS.md` ("one milestone at a time;
  migrations for schema changes; build/lint/test before done; don't touch unrelated
  files"). Ran `npm install` in `apps/web` (465 packages installed, exit 0).
  Locked decisions for region/roles/reminders/Stitch/DB-tests already recorded in
  `docs/plans/README.md` (decisions made 2026-10-14 per REVIEW-NOTES).
- Verification: `npm install` ✅ exit 0 (1 deprecation warning: glob@11, non-blocking).
  `npx tsc --noEmit` → exit 1 (no tsconfig.json present; expected — full scaffold
  comes in Phase 1B). `git ls-remote origin` → DNS unreachable in agent environment
  (offline env); repo is clean (`git status` clean, up to date with origin/main).
- Design refs used: none (no UI in this phase).
- Deviations from plan: `git ls-remote origin` failed (no internet in agent
  environment); working tree is clean and branch is main. Push attempted post-commit.
- Next: Phase 1A — Full schema, RLS, RPCs, seed, types, isolation proof.

## Entry template (copy per phase)

```md
## Phase N — <name> (YYYY-MM-DD)
- Landed: ...
- Verification: build / lint / test results, RLS check where relevant.
- Design refs used: ...
- Deviations from plan: ... (or "none")
- Next: Phase N+1 — <name>.
```

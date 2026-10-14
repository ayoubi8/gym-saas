# FRONTEND-BACKEND.md — linking architecture

How `apps/web` talks to Supabase. Read with DATA-CONTRACT.md (what each screen
calls) and DATA-MODEL.md (schema). Locked: Supabase only, no custom API in MVP.

## 1. Local dev loop

```powershell
supabase start                # local Postgres + Auth + Storage + Edge runtime
supabase db reset             # apply migrations/ + seed/seed.sql from scratch
supabase functions serve reminders-sender
Set-Location apps/web; npm run dev
```

- Every schema change = a new file in `supabase/migrations/` (never edit landed
  migrations). Seed data lives in `supabase/seed/seed.sql` (2 gyms + owners +
  members + plans; demo gym added Phase 10).
- After ANY migration: regenerate types (next section) in the same commit.

## 2. Generated types (single source: the DB)

```powershell
supabase gen types typescript --local > apps/web/src/lib/database.types.ts
```

- `database.types.ts` is GENERATED — never hand-edit. All `api.ts` files import
  row/RPC types from it. Type drift = build failure: CI runs `tsc --noEmit`.
- SQL owns business rules (status, end-date, balance — DATA-MODEL.md views/functions).
  TypeScript has thin mirrors (`getMemberStatus`, `calcEndDate`, formatters) used
  ONLY for instant UI (optimistic rows, previews). Every mirror has a **parity test**
  (same fixture → SQL result = TS result); parity failure blocks the phase.

## 3. Feature folder layout

```text
apps/web/src/
├── lib/
│   ├── supabase.ts        # single client; ONLY place importing @supabase/supabase-js
│   ├── database.types.ts  # GENERATED (see §2)
│   ├── query-keys.ts      # ONE key factory (see §4)
│   ├── run-mutation.ts    # ONE mutation abstraction (see §6)
│   ├── pg-errors.ts       # Postgres-error → i18n mapper (see §5)
│   ├── phone.ts           # normalizeDzPhone (+ mirror parity test)
│   ├── status.ts          # getMemberStatus (+ mirror parity test)
│   └── format.ts          # Intl date/number/DZD formatters
├── features/<feature>/
│   ├── api.ts             # supabase rpc/from calls ONLY (no UI imports)
│   ├── queries.ts         # TanStack Query hooks (keys from factory)
│   ├── schemas.ts         # zod schemas (colocated with forms)
│   └── components/        # feature UI (pages stay thin)
├── i18n/{ar.json,fr.json}
└── routes.tsx             # must match docs/SCREENS.md
```

Features: `auth`, `admin`, `members`, `plans`, `subscriptions`, `payments`,
`dashboard`, `reminders`, `settings`, `import`, `sync`. No raw `fetch`/supabase
imports outside `lib/` + `features/*/api.ts`.

## 4. Query-key factory (one place)

```ts
// lib/query-keys.ts
export const qk = {
  session: ['session'] as const,
  adminGyms: ['admin','gyms'] as const,
  plans: ['plans'] as const,
  members: (f?: MemberFilter) => ['members', f ?? 'all'] as const,
  member: (id: string) => ['member', id] as const,
  payments: (f?: PaymentFilter) => ['payments', f ?? 'all'] as const,
  dashboard: ['dashboard'] as const,
  reminders: ['reminders'] as const,
  settings: ['settings'] as const,
  importBatch: (id: string) => ['import', id] as const,
};
```

DATA-CONTRACT.md "invalidates" columns reference these keys. Hooks invalidate
exactly those keys — no broad `invalidateQueries()` without a key.

## 5. Error mapper (Postgres → i18n, no raw errors in UI)

```ts
// lib/pg-errors.ts — maps code → i18n key; unknown → errors.unknown (logs detail)
'P0001:DUPLICATE_PHONE' → 'members.duplicatePhone'   // RAISE ... USING ERRCODE
'23505'                 → unique-violation fallback map by constraint name
'42501' / RLS fail      → 'errors.rlsDenied'
```

- RPCs raise app errors with `RAISE EXCEPTION ... USING ERRCODE='P0001', HINT='<CODE>'`;
  the mapper reads `HINT`/message prefix. Constraint violations map by constraint
  name (`members_gym_phone_unique → members.duplicatePhone`).
- Components render `t(mappedKey)` only — never `error.message`.

## 6. runMutation(op) — the one mutation path (Phase 7 seam)

```ts
// lib/run-mutation.ts
type Op = { key: string[] /* invalidate on success */; rpc: string; args: object; id: string /* client uuid */ };
export async function runMutation(op: Op) { /* online: supabase.rpc(op.rpc, op.args) */ }
```

- Phases 1B–6: online implementation = direct RPC call + invalidate `op.key`.
  Screens call `runMutation`, never `supabase.rpc` directly.
- Phase 7 swaps ONLY this file's internals: offline → persist op in Dexie outbox
  (id = client uuid, idempotent replay via `ON CONFLICT DO NOTHING`); online →
  replay FIFO, write `sync_log` row per flush. Screen code unchanged.
- Forbidden offline: `edit_payment`, `delete_payment` (must be online; UI disables
  with `payments.offlineEditBlocked`).

## 7. Env handling

- `apps/web/.env.example` lists `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only.
  Real values in `.env.local` (gitignored). The **service-role key NEVER enters the
  browser** — it exists only as an Edge Function secret (`supabase secrets set`).
- Admin actions (create gym/user, reset password, set status) are Edge Functions
  called with the user's JWT + server-side `is_admin()` re-check (defense in depth).

## 8. Storage

- Bucket `imports` (private): paths `imports/{gym_id}/{batch_id}.xlsx`; path-scoped
  policies (`storage.foldername(name)[1] = current_gym_id()::text`). Failed-rows
  downloads served the same way. No public buckets in MVP.

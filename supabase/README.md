# supabase — Postgres + Auth + RLS + Edge Functions (MVP backend)

No custom API server in MVP — all server logic here.

## Layout

```text
supabase/
├── migrations/    ← schema + RLS policies (tenant isolation via gym_id)
└── functions/     ← Edge Functions (e.g. reminders-sender)
```

## Rules (AGENTS.md §5)

- Every gym-scoped table has `gym_id`; RLS enforces owner-can-only-see-own-gym.
- Phones stored normalized `+213XXXXXXXXX`, unique per gym (partial index, `deleted_at IS NULL`).
- Member status derived (view/selector), never stored as input.
- Payments append-only; edits/deletes → audit log row.
- Amounts whole DZD integers.

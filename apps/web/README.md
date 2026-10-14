# apps/web — PWA frontend (Vite + React + TS + Tailwind)

Mobile-first PWA, Arabic (RTL) + French (LTR), offline-first. See `AGENTS.md` §§6–8.

```powershell
npm install
Copy-Item .env.example .env.local   # Supabase URL + anon key
npm run dev      # dev server
npm run build    # typecheck + build (run before every done)
npm run lint     # eslint
npm run test     # vitest
```

## Conventions

- Code in `src/` only: `pages/`, `components/`, `hooks/` (TanStack Query),
  `lib/` (supabase client, phone, status), `i18n/` (`ar.json` + `fr.json`).
- No hard-coded UI strings — everything via i18next.
- Logical CSS only (`ms-/me-/ps-/pe-/start-/end-`), never `ml-/mr-/left/right`.
- Routes in `src/routes.tsx` must match `docs/SCREENS.md`.
- Status via single `getMemberStatus` util + SQL view (see `AGENTS.md` §5.2).

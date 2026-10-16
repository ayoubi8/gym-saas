# SCREENS.md — Screen map (Stitch → design → route → file)

Every row must have a folder in `design/`. Stitch export goes to `design/<folder>/code.html`
(reference only) + `mobile.png` + `desktop.png`. Real code goes to `apps/web/src/...`.

| # | Screen | Route | App file | Design folder | Stitch prompt (summary) |
|---|---|---|---|---|---|
| 01 | Login (phone/email + password, AR/FR switch) | `/login` | `apps/web/src/pages/login-page.tsx` | `design/01-login/` | Mobile-first login card, gym logo, phone-or-email + password, language switcher AR/FR, error states. |
| 02 | Admin — Gyms list (create/suspend/reactivate, reset password) | `/admin/gyms` | `apps/web/src/pages/admin-gyms-page.tsx` | `design/02-admin-gyms/` | Admin table→cards, gym status chips, create-gym modal, suspend/reactivate actions. |
| 03 | First setup (language, plans shortcut, import shortcut) | `/onboarding` | `apps/web/src/pages/onboarding-page.tsx` | `design/03-first-setup/` | 3-step wizard: language → create plans → import Excel. Progress bar, skip allowed. |
| 04 | Plans (list + create/edit/deactivate) | `/plans` | `apps/web/src/pages/plans-page.tsx` | `design/04-plans/` | Plan cards with type, duration/sessions, price DZD, active toggle, edit modal. |
| 05 | Dashboard (4 widgets + expiring + owing) | `/` | `apps/web/src/pages/dashboard-page.tsx` | `design/05-dashboard/` | 4 tappable widgets (active, revenue today/month, expiring week, unpaid), sync bar, lists preview. |
| 06 | Members list (search + status filter) | `/members` | `apps/web/src/pages/members-list-page.tsx` | `design/06-members-list/` | Search by name/phone, filter chips Active/Expired/Frozen/Owing, member cards, FAB add. |
| 07 | Member profile (subscription, payments, balance, actions) | `/members/:id` | `apps/web/src/pages/member-profile-page.tsx` | `design/07-member-profile/` | Header with status chip, current plan + end date, balance banner, payment history, actions (renew/freeze/pay). |
| 08 | Add / Edit member | `/members/new`, `/members/:id/edit` | `apps/web/src/pages/member-form-page.tsx` | `design/08-add-member/` | Form: full name, phone (DZ formats), plan select, start date, first payment. Inline zod errors. |
| 09 | Renew subscription | (modal from profile) | `apps/web/src/features/subscriptions/components/dialogs.tsx` (RenewDialog) | `design/09-renew-subscription/` | One-action renew dialog: plan, start (day-after or today), price, record payment toggle. |
| 10 | Payments list (filter by date) | `/payments` | `apps/web/src/pages/payments-list-page.tsx` | `design/10-payments-list/` | Payment rows (member, amount DZD, method, date), date filter, daily/monthly totals. |
| 11 | Record payment + receipt | (modal + `/payments/:id/receipt`) | `apps/web/src/features/payments/components/dialogs.tsx` | `design/11-receipt/` | Amount/method/date/note form + printable receipt (member, amount, date, remaining). |
| 12 | Freeze / Resume + Extend | (modal from profile) | `apps/web/src/features/subscriptions/components/dialogs.tsx` (Freeze/Resume/ExtendDialog) | `design/12-freeze-resume/` | Pause with reason (travel/injury/ramadan/other), resume preview (+days), extend-by-days with reason. |
| 13 | Reminders / Expiring soon (send, log) | `/reminders` | `apps/web/src/pages/reminders-page.tsx` | `design/13-reminders-expiring/` | Expiring list with one-tap send (WhatsApp/SMS/Viber), template preview AR/FR, message log. |
| 14 | Excel import (upload → map → preview → report) | `/import` | `apps/web/src/pages/import-page.tsx` | `design/14-import-excel/` | Upload, template download, column mapping, validation preview (valid/error/duplicate), skip-or-update, report + failed-rows download. |
| 15 | Settings (language, templates, reminders toggle) | `/settings` | `apps/web/src/pages/settings-page.tsx` | `design/15-settings/` | Gym default language, reminder days-before + on/off, AR/FR template editors with variables. |

## Design folder contract

Each `design/<NN>-<name>/` contains (filed from `stitch_algerian_gym_management_system/`):
- `code.html` — Stitch code export (visual reference, never imported)
- `screen*.png` — Stitch presentation board(s) (mobile+desktop composites until
  split `mobile.png` / `desktop.png` exports are added)
- Extra variants use suffixes (`code-desktop.html`, `code-create.html`, `code-receipt.html`).

Already filed: 01, 02 (+create-gym), 04, 05, 07, 08, 09, 10, 11 (+receipt),
12, 13. Stitch theme tokens archived at `design/stitch-theme-reference.md`.
Still missing Stitch exports (`.gitkeep` placeholder): `03-first-setup`,
`06-members-list`, `14-import-excel`, `15-settings` — generate these next.

If route/file changes, update this table in the same commit.

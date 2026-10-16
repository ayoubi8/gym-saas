-- demo-gym.sql — Phase 10 pilot demo seed (additive; run AFTER seed.sql).
--
-- One self-contained demo gym for pilot demos / training / screenshots:
--   1 active gym + owner, 3 plans, 30 members across every derived status
--   (active, expiring, expired, frozen, owing, no-subscription, soft-deleted),
--   payments (full, partial/owing, 2 installments) and 1 committed import batch.
--
-- Idempotent: every insert is `on conflict do nothing` on a deterministic id, so
-- re-running never duplicates and never touches data outside this demo gym.
-- It is NEVER part of `supabase db reset` (seed.sql stays the canonical seed);
-- run it explicitly:  psql $DATABASE_URL -f supabase/seed/demo-gym.sql

do $demo$ declare
  v_gym     uuid := '33333333-3333-3333-3333-333333333333';
  v_owner   uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  v_plan_monthly   uuid := '3333aa01-0000-0000-0000-000000000001';
  v_plan_quarterly uuid := '3333aa01-0000-0000-0000-000000000002';
  v_plan_pack      uuid := '3333aa01-0000-0000-0000-000000000003';

  v_names text[] := array[
    'Yacine Belkacem','أمينة شريف','Karim Meziane','ليلى بوعلام','Samir Hadjadj',
    'هدى العربي','Yassine Tayeb','سارة بلقاسم','Mehdi Amari','نادية بوجلال',
    'Rachid Zeroual','إيناس قاسي','Bilal Hamdi','مريم سعدي','Anis Brahimi',
    'يوسف بن علي','سعاد كريمي','عمر بلعيد','نوال مسعودي','حمزة زروق',
    'فاطمة حمداني','رياض بوقرة','سفيان مزيان','أمينة بلقاسم','كريم بوعلام',
    'سمير حجاج','هدى لعربي','ياسين طيب','سارة بلقاسم','مهدي عماري'
  ];

  i          int;
  v_member   uuid;
  v_sub      uuid;
  v_pause    uuid;
  v_pay1     uuid;
  v_pay2     uuid;
  v_name     text;
  v_phone    text;
  v_lang     public.lang;
  v_no_sub   bool;
  v_deleted  bool;
  v_owing    bool;

  v_plan_id   uuid;
  v_plan_name text;
  v_plan_type public.plan_type;
  v_price     int;
  v_sessions  int;
  v_validity  int;
  v_start     date;
  v_end       date;

  v_receipt int := 0;
  v_batch   uuid := '33330400-0000-0000-0000-000000000001';
begin
  -- ---- Demo owner auth user (profile has an FK to auth.users) ----
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, created_at, updated_at, aud, role
  ) values (
    v_owner, '00000000-0000-0000-0000-000000000000',
    '213555000003@phone.gymdz.app', crypt('Owner1234!', gen_salt('bf')),
    now(), jsonb_build_object('role','owner','gym_id', v_gym::text),
    now(), now(), 'authenticated', 'authenticated'
  ) on conflict (id) do nothing;

  -- ---- Gym + profile + settings + receipt counter ----
  insert into public.gyms (id, name, city, default_language, timezone, status, created_by)
  values (v_gym, 'نادي النخبة — Elite Gym', 'Constantine', 'fr', 'Africa/Algiers', 'active', v_owner)
  on conflict (id) do nothing;

  insert into public.profiles (id, gym_id, role, full_name, phone, email, language)
  values (v_owner, v_gym, 'owner', 'Sofiane Meziane', '+213555000003', null, 'fr')
  on conflict (id) do nothing;

  insert into public.gym_settings (
    gym_id, reminders_enabled, reminder_days_before, reminder_on_expiry_day,
    enabled_channels, onboarding_completed
  ) values (v_gym, true, 3, true, '{whatsapp,sms}', true)
  on conflict (gym_id) do nothing;

  insert into public.receipt_counters (gym_id, last_no) values (v_gym, 0)
  on conflict (gym_id) do nothing;

  -- ---- Plans ----
  insert into public.plans (id, gym_id, name, type, duration_months, price_dzd, active, created_by)
  values
    (v_plan_monthly,   v_gym, 'Mensuel',      'monthly',   1, 3500, true, v_owner),
    (v_plan_quarterly, v_gym, 'Trimestriel',  'quarterly', 3, 9000, true, v_owner)
  on conflict (id) do nothing;

  insert into public.plans (id, gym_id, name, type, session_count, validity_days, price_dzd, active, created_by)
  values (v_plan_pack, v_gym, 'Pack 10 séances', 'class_pack', 10, 60, 5000, true, v_owner)
  on conflict (id) do nothing;

  -- ---- Reminder templates (AR + FR, both kinds) ----
  insert into public.reminder_templates (id, gym_id, language, kind, body)
  values
    (gen_random_uuid(), v_gym, 'ar', 'before_expiry',
     'عزيزي {memberName}، اشتراكك في {gymName} ينتهي في {endDate}. يرجى التجديد.'),
    (gen_random_uuid(), v_gym, 'fr', 'before_expiry',
     'Cher {memberName}, votre abonnement à {gymName} expire le {endDate}. Veuillez renouveler.'),
    (gen_random_uuid(), v_gym, 'ar', 'expiry_day',
     'عزيزي {memberName}، ينتهي اشتراكك في {gymName} اليوم ({endDate}). جدّد الآن.'),
    (gen_random_uuid(), v_gym, 'fr', 'expiry_day',
     'Cher {memberName}, votre abonnement à {gymName} expire aujourd''hui ({endDate}). Renouvelez dès maintenant.')
  on conflict (gym_id, language, kind) do nothing;

  -- ---- Members + subscriptions + payments ----
  for i in 1..30 loop
    v_member  := ('33330100-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_sub     := ('33330200-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_pause   := ('33330500-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_pay1    := ('33330300-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_pay2    := ('33330301-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_name    := v_names[i];
    v_phone   := '+2135' || lpad((50000000 + i)::text, 8, '0');
    v_lang    := (case when i % 2 = 1 then 'ar' else 'fr' end)::public.lang;
    v_no_sub  := i between 26 and 28;   -- members only, no subscription
    v_deleted := i >= 29;               -- soft-deleted
    v_owing   := i between 23 and 25;   -- active but partially paid

    insert into public.members (id, gym_id, full_name, phone, language, created_by, deleted_at)
    values (v_member, v_gym, v_name, v_phone, v_lang, v_owner,
            case when v_deleted then now() else null end)
    on conflict (id) do nothing;

    if not v_no_sub then
      -- plan choice: every 7th = pack, every 5th = quarterly, else monthly
      if i % 7 = 0 then
        v_plan_id := v_plan_pack; v_plan_name := 'Pack 10 séances';
        v_plan_type := 'class_pack'; v_price := 5000; v_sessions := 10; v_validity := 60;
      elsif i % 5 = 0 then
        v_plan_id := v_plan_quarterly; v_plan_name := 'Trimestriel';
        v_plan_type := 'quarterly'; v_price := 9000; v_sessions := null; v_validity := null;
      else
        v_plan_id := v_plan_monthly; v_plan_name := 'Mensuel';
        v_plan_type := 'monthly'; v_price := 3500; v_sessions := null; v_validity := null;
      end if;

      -- end_date by status group (keeps every derived status represented)
      if i between 13 and 15 then
        v_end := current_date + 3;                 -- expiring (reminder window)
      elsif i between 16 and 19 then
        v_end := current_date - (i - 10);          -- expired
      elsif i between 20 and 22 then
        v_end := current_date + 15;                -- frozen
      elsif i between 23 and 25 then
        v_end := current_date + 20;                -- owing (active)
      else
        v_end := current_date + 15 + i;            -- active
      end if;

      v_start := case
        when v_plan_type = 'class_pack' then v_end - v_validity
        else current_date - 30
      end;

      insert into public.subscriptions (
        id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
        price_dzd, start_date, end_date, sessions_total, sessions_remaining, created_by
      ) values (
        v_sub, v_gym, v_member, v_plan_id, v_plan_name, v_plan_type,
        v_price, v_start, v_end, v_sessions,
        case when v_sessions is not null then v_sessions else null end, v_owner
      ) on conflict (id) do nothing;

      -- frozen: one open pause
      if i between 20 and 22 then
        insert into public.pauses (id, gym_id, subscription_id, start_date, reason, created_by)
        values (v_pause, v_gym, v_sub, current_date - 2, 'travel', v_owner)
        on conflict (id) do nothing;
      end if;

      -- payments: owing = half, two members split into 2 installments, else full
      if v_owing then
        v_receipt := v_receipt + 1;
        insert into public.payments (id, gym_id, subscription_id, member_id, amount_dzd, paid_on, method, receipt_no, created_by)
        values (v_pay1, v_gym, v_sub, v_member, v_price / 2, v_start, 'cash', v_receipt, v_owner)
        on conflict (id) do nothing;
      elsif i in (4, 8) then
        v_receipt := v_receipt + 1;
        insert into public.payments (id, gym_id, subscription_id, member_id, amount_dzd, paid_on, method, receipt_no, created_by)
        values (v_pay1, v_gym, v_sub, v_member, v_price / 2, v_start, 'cash', v_receipt, v_owner)
        on conflict (id) do nothing;
        v_receipt := v_receipt + 1;
        insert into public.payments (id, gym_id, subscription_id, member_id, amount_dzd, paid_on, method, receipt_no, created_by)
        values (v_pay2, v_gym, v_sub, v_member, v_price / 2, v_start + 10, 'cash', v_receipt, v_owner)
        on conflict (id) do nothing;
      else
        v_receipt := v_receipt + 1;
        insert into public.payments (id, gym_id, subscription_id, member_id, amount_dzd, paid_on, method, receipt_no, created_by)
        values (v_pay1, v_gym, v_sub, v_member, v_price, v_start, 'cash', v_receipt, v_owner)
        on conflict (id) do nothing;
      end if;
    end if;
  end loop;

  -- keep the per-gym receipt sequence in sync with what we issued
  update public.receipt_counters set last_no = greatest(last_no, v_receipt) where gym_id = v_gym;

  -- ---- 1 committed import batch (history demo) ----
  insert into public.import_batches (
    id, gym_id, filename, storage_path, status, mapping, duplicate_policy,
    total_rows, valid_rows, error_rows, duplicate_rows,
    imported_count, skipped_count, failed_count, created_by
  ) values (
    v_batch, v_gym, 'membres-demo.xlsx',
    'imports/' || v_gym || '/membres-demo.xlsx', 'committed',
    '{"full_name":"Nom","phone":"Téléphone","plan":"Formule","start_date":"Début","end_date":"Fin","amount_paid":"Payé","amount_remaining":"Reste"}'::jsonb,
    'skip', 3, 3, 0, 0, 3, 0, 0, v_owner
  ) on conflict (id) do nothing;

  insert into public.import_rows (id, batch_id, gym_id, row_no, raw, normalized, status)
  values
    ('33330401-0000-0000-0000-000000000001', v_batch, v_gym, 1,
     '{"Nom":"Ahmed Bensalem","Téléphone":"0555123456","Formule":"Mensuel"}'::jsonb,
     '{"full_name":"Ahmed Bensalem","phone":"+213555123456","plan":"Mensuel"}'::jsonb, 'imported'),
    ('33330401-0000-0000-0000-000000000002', v_batch, v_gym, 2,
     '{"Nom":"سعيد ولد علي","Téléphone":"0555987654","Formule":"Trimestriel"}'::jsonb,
     '{"full_name":"سعيد ولد علي","phone":"+213555987654","plan":"Trimestriel"}'::jsonb, 'imported'),
    ('33330401-0000-0000-0000-000000000003', v_batch, v_gym, 3,
     '{"Nom":"Nadia Boudjelal","Téléphone":"0555111222","Formule":"Mensuel"}'::jsonb,
     '{"full_name":"Nadia Boudjelal","phone":"+213555111222","plan":"Mensuel"}'::jsonb, 'imported')
  on conflict (id) do nothing;
end;
$demo$;

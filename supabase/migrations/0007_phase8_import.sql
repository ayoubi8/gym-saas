-- ============================================================
-- 0007_phase8_import.sql
-- Phase 8 — Excel import, server-side (PRD §5.10, DATA-CONTRACT row 14).
--
-- No table/column changes. Fills in the two Phase-1A stubs:
--   * import_validate(batch_id) — normalizes the staged rows (the client
--     parses the workbook with SheetJS and stages `import_rows.raw`; the
--     server owns the truth: normalization reuses the SAME
--     normalize_dz_phone() as create_member) and writes
--     valid|error|duplicate + reason, then batch counters -> 'previewed'.
--   * import_commit(batch_id, policy) — idempotent (status guard +
--     deterministic ids), chunked inserts of members (+subscription
--     +payment), reports imported|skipped|failed.
-- Plus the private `imports` Storage bucket + owner-scoped policies.
--
-- Postgres cannot parse .xlsx, so parsing lives in the Edge/client layer;
-- validation and commit stay 100% server-side (one code path with
-- create_member). Mapping shape: { target_field: source_header }.
-- ============================================================

-- ------------------------------------------------------------
-- parse_import_date(text) -> date | null
-- Accepts yyyy-mm-dd, yyyy/mm/dd[/.], dd/mm/yyyy (Arabic-Indic digits
-- translated first). Returns null for empty or invalid input; callers
-- distinguish "absent" (empty) from "invalid" (non-empty -> null).
-- ------------------------------------------------------------
create or replace function public.parse_import_date(p_raw text)
returns date language plpgsql immutable set search_path = public as $$
declare
  s text;
begin
  if p_raw is null then
    return null;
  end if;
  s := btrim(p_raw);
  if s = '' then
    return null;
  end if;
  -- Arabic-Indic (U+0660..) and Eastern-Arabic/Persian (U+06F0..) digits -> ASCII
  s := translate(s, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  s := regexp_replace(s, '[[:space:]]', '', 'g');

  begin
    if s ~ '^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$' then
      return to_date(s, 'YYYY-MM-DD');
    elsif s ~ '^[0-9]{4}[/.][0-9]{1,2}[/.][0-9]{1,2}$' then
      return to_date(s, 'YYYY/MM/DD');
    elsif s ~ '^[0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{4}$' then
      return to_date(s, 'DD/MM/YYYY');
    end if;
  exception when others then
    return null;
  end;
  return null;
end;
$$;

-- ------------------------------------------------------------
-- parse_import_int(text) -> int | null
-- Whole DZD integers; strips spaces/commas/dots/thousand separators and
-- currency noise; Arabic-Indic digits translated. Null for empty/invalid.
-- ------------------------------------------------------------
create or replace function public.parse_import_int(p_raw text)
returns int language plpgsql immutable set search_path = public as $$
declare
  s text;
begin
  if p_raw is null then
    return null;
  end if;
  s := translate(p_raw, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  s := regexp_replace(s, '[^0-9-]', '', 'g');
  if s = '' or s = '-' then
    return null;
  end if;
  if s !~ '^-?[0-9]+$' then
    return null;
  end if;
  return s::int;
exception when others then
  return null;
end;
$$;

-- ------------------------------------------------------------
-- import_validate(batch_id)
-- Pass 1: normalize each staged row (name/phone/plan/dates/amounts) and
--         classify valid | error (+reason). Unknown plan -> UNKNOWN_PLAN.
-- Pass 2: mark duplicates (phone already in the gym, or earlier row in
--         this batch) -> 'duplicate'. A second run re-normalizes and
--         overwrites the previous verdicts (never touches members).
-- ------------------------------------------------------------
create or replace function public.import_validate(
  p_batch_id uuid
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_batch      public.import_batches;
  v_map        jsonb;
  v_row        public.import_rows;
  v_name       text;
  v_phone_raw  text;
  v_phone      text;
  v_plan_txt   text;
  v_plan       public.plans;
  v_start      date;
  v_end        date;
  v_paid       int;
  v_rem        int;
  v_status     public.import_row_status;
  v_reason     text;
  v_norm       jsonb;
  k            text;
begin
  select * into v_batch
  from public.import_batches
  where id = p_batch_id and gym_id = public.current_gym_id();

  if not found then
    raise exception 'BAD_FILE' using
      hint = 'Import batch not found for your gym.', errcode = 'P0001';
  end if;
  if v_batch.status = 'committed' then
    raise exception 'BATCH_ALREADY_COMMITTED' using
      hint = 'This batch has already been committed.', errcode = 'P0001';
  end if;

  v_map := v_batch.mapping;
  if v_map is null or v_map = '{}'::jsonb then
    raise exception 'BAD_FILE' using
      hint = 'No column mapping saved for this batch.', errcode = 'P0001';
  end if;
  if not (v_map ? 'full_name') or not (v_map ? 'phone') then
    raise exception 'UNKNOWN_COLUMNS' using
      hint = 'The full_name and phone columns must be mapped.', errcode = 'P0001';
  end if;
  for k in select jsonb_object_keys(v_map) loop
    if k not in ('full_name', 'phone', 'plan', 'start_date', 'end_date', 'amount_paid', 'amount_remaining') then
      raise exception 'UNKNOWN_COLUMNS' using
        hint = 'Mapping contains an unknown target column: ' || k, errcode = 'P0001';
    end if;
  end loop;
  if not exists (select 1 from public.import_rows where batch_id = p_batch_id) then
    raise exception 'BAD_FILE' using
      hint = 'No rows were staged for this batch.', errcode = 'P0001';
  end if;

  -- Pass 1 — per-row normalization + base verdict
  for v_row in
    select * from public.import_rows where batch_id = p_batch_id order by row_no
  loop
    v_status := 'valid';
    v_reason := null;
    v_plan   := null;
    v_phone  := null;
    v_start  := null;
    v_end    := null;
    v_paid   := null;
    v_rem    := null;

    v_name      := btrim(coalesce(v_row.raw ->> (v_map ->> 'full_name'), ''));
    v_phone_raw := btrim(coalesce(v_row.raw ->> (v_map ->> 'phone'), ''));
    v_plan_txt  := btrim(coalesce(v_row.raw ->> (v_map ->> 'plan'), ''));

    if v_name = '' then
      v_status := 'error'; v_reason := 'MISSING_NAME';
    elsif v_phone_raw = '' then
      v_status := 'error'; v_reason := 'MISSING_PHONE';
    else
      v_phone := public.normalize_dz_phone(v_phone_raw);
      if v_phone is null then
        v_status := 'error'; v_reason := 'INVALID_PHONE';
      end if;
    end if;

    if v_status = 'valid' and v_plan_txt <> '' then
      select * into v_plan
      from public.plans
      where gym_id = v_batch.gym_id and lower(btrim(name)) = lower(v_plan_txt)
      order by active desc, created_at desc
      limit 1;
      if not found then
        v_status := 'error'; v_reason := 'UNKNOWN_PLAN';
      end if;
    end if;

    if v_status = 'valid' then
      if btrim(coalesce(v_row.raw ->> (v_map ->> 'start_date'), '')) <> '' then
        v_start := public.parse_import_date(v_row.raw ->> (v_map ->> 'start_date'));
        if v_start is null then v_status := 'error'; v_reason := 'INVALID_DATE'; end if;
      end if;
      if v_status = 'valid' and btrim(coalesce(v_row.raw ->> (v_map ->> 'end_date'), '')) <> '' then
        v_end := public.parse_import_date(v_row.raw ->> (v_map ->> 'end_date'));
        if v_end is null then v_status := 'error'; v_reason := 'INVALID_DATE'; end if;
      end if;
      if v_status = 'valid' and v_start is not null and v_end is not null and v_end < v_start then
        v_status := 'error'; v_reason := 'INVALID_DATE';
      end if;
    end if;

    if v_status = 'valid' then
      if btrim(coalesce(v_row.raw ->> (v_map ->> 'amount_paid'), '')) <> '' then
        v_paid := public.parse_import_int(v_row.raw ->> (v_map ->> 'amount_paid'));
        if v_paid is null or v_paid < 0 then v_status := 'error'; v_reason := 'INVALID_AMOUNT'; end if;
      end if;
      if v_status = 'valid' and btrim(coalesce(v_row.raw ->> (v_map ->> 'amount_remaining'), '')) <> '' then
        v_rem := public.parse_import_int(v_row.raw ->> (v_map ->> 'amount_remaining'));
        if v_rem is null or v_rem < 0 then v_status := 'error'; v_reason := 'INVALID_AMOUNT'; end if;
      end if;
    end if;

    v_norm := jsonb_build_object(
      'full_name',         nullif(v_name, ''),
      'phone',             v_phone,
      'plan_id',           v_plan.id,
      'plan_name',         v_plan.name,
      'plan_type',         v_plan.type,
      'price_dzd',         v_plan.price_dzd,
      'start_date',        v_start,
      'end_date',          v_end,
      'amount_paid',       coalesce(v_paid, 0),
      'amount_remaining',  coalesce(v_rem, 0)
    );

    update public.import_rows
    set normalized = v_norm, status = v_status, reason = v_reason
    where id = v_row.id;
  end loop;

  -- Pass 2 — duplicates: phone exists in the gym, or an earlier row in the batch
  update public.import_rows r
  set status = 'duplicate', reason = 'DUPLICATE_PHONE'
  where r.batch_id = p_batch_id
    and r.status = 'valid'
    and (
      exists (
        select 1 from public.members m
        where m.gym_id = r.gym_id
          and m.phone = r.normalized ->> 'phone'
          and m.deleted_at is null
      )
      or exists (
        select 1 from public.import_rows r2
        where r2.batch_id = r.batch_id
          and r2.row_no < r.row_no
          and r2.status in ('valid', 'duplicate')
          and r2.normalized ->> 'phone' = r.normalized ->> 'phone'
      )
    );

  update public.import_batches b
  set total_rows     = (select count(*) from public.import_rows where batch_id = b.id),
      valid_rows     = (select count(*) from public.import_rows where batch_id = b.id and status = 'valid'),
      error_rows     = (select count(*) from public.import_rows where batch_id = b.id and status = 'error'),
      duplicate_rows = (select count(*) from public.import_rows where batch_id = b.id and status = 'duplicate'),
      status         = 'previewed'
  where b.id = p_batch_id;
end;
$$;

-- ------------------------------------------------------------
-- import_commit(batch_id, policy)
-- skip   -> duplicate rows are left untouched ('skipped')
-- update -> matched member is updated (name); plan/date/amount in the row
--           still create a subscription + payment for that member.
-- Idempotent: committed guard raises BATCH_ALREADY_COMMITTED, and row ids
-- are deterministic (member id = import_rows.id, sub/payment ids = md5()).
-- Per-row failures are isolated (savepoint) and reported as 'failed'.
-- ------------------------------------------------------------
create or replace function public.import_commit(
  p_batch_id uuid,
  p_policy   public.duplicate_policy
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_batch   public.import_batches;
  v_row     public.import_rows;
  v_norm    jsonb;
  v_tz      text;
  v_member  uuid;
  v_sub     uuid;
  v_plan_id uuid;
  v_ptype   public.plan_type;
  v_price   int;
  v_sessions int;
  v_start   date;
  v_end     date;
  v_paid    int;
  v_rem     int;
begin
  select * into v_batch
  from public.import_batches
  where id = p_batch_id and gym_id = public.current_gym_id();

  if not found then
    raise exception 'BAD_FILE' using
      hint = 'Import batch not found for your gym.', errcode = 'P0001';
  end if;
  if v_batch.status = 'committed' then
    raise exception 'BATCH_ALREADY_COMMITTED' using
      hint = 'This batch has already been committed.', errcode = 'P0001';
  end if;
  if v_batch.status <> 'previewed' then
    raise exception 'BAD_FILE' using
      hint = 'Run validation before committing this batch.', errcode = 'P0001';
  end if;

  select coalesce(timezone, 'Africa/Algiers') into v_tz
  from public.gyms where id = v_batch.gym_id;

  for v_row in
    select * from public.import_rows
    where batch_id = p_batch_id and status in ('valid', 'duplicate')
    order by row_no
  loop
    v_norm := v_row.normalized;

    begin
      if v_row.status = 'duplicate' and p_policy = 'skip' then
        update public.import_rows
        set status = 'skipped', reason = 'DUPLICATE_PHONE'
        where id = v_row.id;
        continue;
      end if;

      v_paid := coalesce((v_norm ->> 'amount_paid')::int, 0);
      v_rem  := coalesce((v_norm ->> 'amount_remaining')::int, 0);
      v_start := (v_norm ->> 'start_date')::date;
      v_end   := (v_norm ->> 'end_date')::date;
      v_plan_id := (v_norm ->> 'plan_id')::uuid;
      v_ptype := (v_norm ->> 'plan_type')::public.plan_type;
      v_price := coalesce((v_norm ->> 'price_dzd')::int, 0);
      v_sessions := null;

      if v_row.status = 'duplicate' then
        -- update policy: modify the matched member (matched by phone)
        select id into v_member
        from public.members
        where gym_id = v_batch.gym_id
          and phone = v_norm ->> 'phone'
          and deleted_at is null
        limit 1;

        if v_member is null then
          insert into public.members (id, gym_id, full_name, phone, created_by)
          values (v_row.id, v_batch.gym_id, v_norm ->> 'full_name', v_norm ->> 'phone', auth.uid())
          on conflict (id) do nothing;
          v_member := v_row.id;
        else
          update public.members
          set full_name = coalesce(v_norm ->> 'full_name', full_name),
              updated_at = now()
          where id = v_member;
        end if;
      else
        insert into public.members (id, gym_id, full_name, phone, created_by)
        values (v_row.id, v_batch.gym_id, v_norm ->> 'full_name', v_norm ->> 'phone', auth.uid())
        on conflict (id) do nothing;
        v_member := v_row.id;
      end if;

      -- Subscription: when a plan matched or an end date was supplied.
      v_sub := null;
      if v_plan_id is not null or v_end is not null then
        if v_start is null then
          v_start := coalesce(v_end, (now() at time zone v_tz)::date);
        end if;
        if v_end is null and v_plan_id is not null then
          v_end := public.derive_end_date(
            v_ptype, v_start,
            (select duration_months from public.plans where id = v_plan_id),
            (select validity_days   from public.plans where id = v_plan_id)
          );
        end if;
        if v_ptype in ('per_session', 'class_pack') then
          v_sessions := (select session_count from public.plans where id = v_plan_id);
        end if;

        insert into public.subscriptions (
          id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
          price_dzd, start_date, end_date, sessions_total, sessions_remaining, created_by
        )
        values (
          md5('sub:' || v_row.id::text)::uuid, v_batch.gym_id, v_member, v_plan_id,
          coalesce(nullif(v_norm ->> 'plan_name', ''), 'Import'),
          coalesce(v_ptype, 'monthly'),
          greatest(case when v_plan_id is null then v_paid + v_rem else v_price end, 0),
          v_start, v_end, v_sessions, v_sessions, auth.uid()
        )
        on conflict (id) do nothing
        returning id into v_sub;

        if v_sub is null then
          v_sub := md5('sub:' || v_row.id::text)::uuid;
        end if;
      end if;

      -- Payment: amount_paid is a whole DZD integer > 0.
      if v_paid > 0 and v_sub is not null then
        perform public.record_payment(
          md5('pay:' || v_row.id::text)::uuid, v_sub, v_paid,
          coalesce(v_start, (now() at time zone v_tz)::date), 'cash', 'Imported'
        );
      end if;

      update public.import_rows set status = 'imported', reason = null where id = v_row.id;
    exception when others then
      -- Isolate the row (savepoint rollback) and report it as failed.
      update public.import_rows
      set status = 'failed', reason = sqlerrm
      where id = v_row.id;
    end;
  end loop;

  update public.import_batches b
  set imported_count = (select count(*) from public.import_rows where batch_id = b.id and status = 'imported'),
      skipped_count  = (select count(*) from public.import_rows where batch_id = b.id and status = 'skipped'),
      failed_count   = (select count(*) from public.import_rows where batch_id = b.id and status = 'failed'),
      status         = 'committed',
      duplicate_policy = p_policy
  where b.id = p_batch_id;

  insert into public.audit_log (gym_id, actor_id, action, entity_type, entity_id, new_value)
  values (
    v_batch.gym_id, auth.uid(), 'import_commit', 'import_batch', p_batch_id,
    jsonb_build_object(
      'policy', p_policy,
      'imported', (select count(*) from public.import_rows where batch_id = p_batch_id and status = 'imported'),
      'skipped',  (select count(*) from public.import_rows where batch_id = p_batch_id and status = 'skipped'),
      'failed',   (select count(*) from public.import_rows where batch_id = p_batch_id and status = 'failed')
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- Storage: private `imports` bucket, owner-scoped by first path segment
-- (FRONTEND-BACKEND.md §8): imports/{gym_id}/{batch_id}.xlsx
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

drop policy if exists "imports_owner_select" on storage.objects;
drop policy if exists "imports_owner_insert" on storage.objects;
drop policy if exists "imports_owner_update" on storage.objects;
drop policy if exists "imports_owner_delete" on storage.objects;

create policy "imports_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

create policy "imports_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

create policy "imports_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  )
  with check (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

create policy "imports_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

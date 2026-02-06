-- 1. Rename Tables
-- Use IF EXISTS to be safe
alter table if exists public.clinics rename to apt_clinics;
alter table if exists public.staff rename to apt_staff;
alter table if exists public.patients rename to apt_patients;
alter table if exists public.rooms rename to apt_rooms;
alter table if exists public.treatments rename to apt_treatments;
alter table if exists public.settings rename to apt_settings;
alter table if exists public.holidays rename to apt_holidays;
alter table if exists public.activity_log rename to apt_activity_log;
alter table if exists public.booking_otps rename to apt_booking_otps;
alter table if exists public.booking_verifications rename to apt_booking_verifications;
alter table if exists public.clinic_members rename to apt_clinic_members;

-- 2. Update Helper Functions (Dependencies on Table Names)

-- current_clinic_id() refs apt_profiles
create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select clinic_id from public.profiles where user_id = auth.uid();
$$;

-- handle_new_user() refs apt_profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (user_id, email, name, account_type)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'individual')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- 3. Update OTP Functions (From your rcp_func.sql, modified for apt_ prefix)

-- booking_request_otp refs apt_booking_otps
create or replace function public.booking_request_otp(
  p_clinic_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_key text;
  v_code text;
  v_hash text;
  v_now timestamptz := now();
  v_expires timestamptz := v_now + interval '10 minutes';
  v_last public.apt_booking_otps%rowtype; -- UPDATED TABLE REF
  v_resp jsonb;
begin
  if p_clinic_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_clinic');
  end if;

  if v_email is null or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  select *
  into v_last
  from public.apt_booking_otps -- UPDATED TABLE REF
  where clinic_id = p_clinic_id
    and email = v_email
  order by created_at desc
  limit 1;

  if v_last.id is not null
     and v_last.last_sent_at is not null
     and v_last.last_sent_at > (v_now - interval '60 seconds') then
    return jsonb_build_object('ok', false, 'error', 'cooldown', 'retry_after_seconds', 60);
  end if;

  v_code := lpad(((floor(random() * 900000) + 100000)::int)::text, 6, '0');

  v_hash := encode(
    extensions.digest(
      convert_to(p_clinic_id::text || ':' || v_email || ':' || v_code, 'utf8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.apt_booking_otps ( -- UPDATED TABLE REF
    clinic_id, email, otp_hash, expires_at, attempts, max_attempts, resend_count, last_sent_at
  ) values (
    p_clinic_id, v_email, v_hash, v_expires, 0, 5,
    coalesce(v_last.resend_count, 0) + 1,
    v_now
  );

  v_key := private.get_secret('RESEND_API_KEY');
  if v_key is null or length(v_key) < 10 then
    return jsonb_build_object('ok', false, 'error', 'missing_resend_key');
  end if;

  v_resp := net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Resend <onboarding@resend.dev>',
      'to', jsonb_build_array(v_email),
      'subject', 'Your booking verification code',
      'html', format(
        '<p>Your verification code is <b>%s</b>.</p><p>This code expires in 10 minutes.</p>',
        v_code
      )
    )
  );

  return jsonb_build_object('ok', true, 'expires_at', v_expires, 'provider', v_resp);
end;
$$;

-- booking_verify_otp refs apt_booking_otps and apt_booking_verifications
create or replace function public.booking_verify_otp(
  p_clinic_id uuid,
  p_email text,
  p_otp text
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_code text := regexp_replace(coalesce(p_otp,''), '\D', '', 'g');
  v_now timestamptz := now();
  v_row public.apt_booking_otps%rowtype; -- UPDATED TABLE REF
  v_hash text;

  v_token text;
  v_token_hash text;
  v_token_expires timestamptz := v_now + interval '30 minutes';
begin
  if p_clinic_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_clinic');
  end if;

  if v_email is null or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  if length(v_code) <> 6 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code_format');
  end if;

  select *
  into v_row
  from public.apt_booking_otps -- UPDATED TABLE REF
  where clinic_id = p_clinic_id
    and email = v_email
    and verified_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_pending_otp');
  end if;

  if v_row.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_row.attempts >= v_row.max_attempts then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  v_hash := encode(
    extensions.digest(
      convert_to(p_clinic_id::text || ':' || v_email || ':' || v_code, 'utf8'),
      'sha256'
    ),
    'hex'
  );

  if v_hash <> v_row.otp_hash then
    update public.apt_booking_otps -- UPDATED TABLE REF
    set attempts = attempts + 1
    where id = v_row.id;

    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  update public.apt_booking_otps -- UPDATED TABLE REF
  set verified_at = v_now
  where id = v_row.id;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  v_token_hash := encode(
    extensions.digest(
      convert_to(p_clinic_id::text || ':' || v_email || ':' || v_token, 'utf8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.apt_booking_verifications ( -- UPDATED TABLE REF
    clinic_id, email, verified_at, expires_at, token_hash
  ) values (
    p_clinic_id, v_email, v_now, v_token_expires, v_token_hash
  );

  return jsonb_build_object('ok', true, 'token', v_token, 'token_expires_at', v_token_expires);
end;
$$;

-- 4. Reload Schema Cache to be safe
notify pgrst, 'reload schema';

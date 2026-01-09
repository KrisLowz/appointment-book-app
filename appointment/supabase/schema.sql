-- Supabase schema for Appointment Book App

create extension if not exists "pgcrypto";

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  city text,
  plan text,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists clinics_slug_idx on public.clinics (slug);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'dentist',
  status text default 'active',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  role text not null,
  name text not null,
  phone text,
  color text,
  specialty text,
  working_days int[] default '{}',
  start_time text,
  end_time text,
  assigned_to uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  id_number text,
  address text,
  created_by uuid references public.profiles(id) on delete set null,
  legacy_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  color text
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  duration int,
  color text,
  supplies_needed text[] default '{}'
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  dentist_id uuid references public.staff(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  treatment_id uuid references public.treatments(id) on delete set null,
  date date not null,
  start_time text not null,
  end_time text,
  duration int,
  status text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_name text not null,
  phone text,
  email text,
  preferred_dates date[] default '{}',
  preferred_times text[] default '{}',
  notes text,
  patient_id_number text,
  patient_dob date,
  patient_gender text,
  patient_tax_number text,
  patient_address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  allergies text,
  medical_conditions text,
  medications text,
  source text,
  preferred_dentist_id uuid references public.staff(id) on delete set null,
  insurance text,
  patient_notes text,
  appointment_date date,
  appointment_start_time text,
  appointment_duration int,
  appointment_treatment_id uuid references public.treatments(id) on delete set null,
  appointment_notes text,
  is_new_patient boolean default true,
  lookup_email text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.appointment_requests
  add column if not exists patient_id_number text,
  add column if not exists patient_dob date,
  add column if not exists patient_gender text,
  add column if not exists patient_tax_number text,
  add column if not exists patient_address text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists allergies text,
  add column if not exists medical_conditions text,
  add column if not exists medications text,
  add column if not exists source text,
  add column if not exists preferred_dentist_id uuid references public.staff(id) on delete set null,
  add column if not exists insurance text,
  add column if not exists patient_notes text,
  add column if not exists appointment_date date,
  add column if not exists appointment_start_time text,
  add column if not exists appointment_duration int,
  add column if not exists appointment_treatment_id uuid references public.treatments(id) on delete set null,
  add column if not exists appointment_notes text,
  add column if not exists is_new_patient boolean default true,
  add column if not exists lookup_email text;

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  clinic_name text,
  working_hours_start text,
  working_hours_end text,
  slot_duration int,
  rest_days int[] default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date,
  type text,
  is_public boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  type text,
  description text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select clinic_id from public.profiles where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.patients enable row level security;
alter table public.rooms enable row level security;
alter table public.treatments enable row level security;
alter table public.appointments enable row level security;
alter table public.settings enable row level security;
alter table public.holidays enable row level security;
alter table public.activity_log enable row level security;
alter table public.appointment_requests enable row level security;

create policy "clinics_admin_all"
  on public.clinics
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "clinics_member_select"
  on public.clinics
  for select
  using (id = public.current_clinic_id());

create policy "clinics_public_select_by_slug"
  on public.clinics
  for select
  using (slug is not null);

create policy "profiles_admin_all"
  on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_self_select"
  on public.profiles
  for select
  using (id = auth.uid());

create policy "profiles_self_update"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_self_insert"
  on public.profiles
  for insert
  with check (id = auth.uid());

create policy "staff_member_all"
  on public.staff
  for all
  using (clinic_id = public.current_clinic_id() or public.is_admin())
  with check (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "staff_public_select_dentists"
  on public.staff
  for select
  using (role = 'dentist');

create policy "patients_member_all"
  on public.patients
  for all
  using (clinic_id = public.current_clinic_id() or public.is_admin())
  with check (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "rooms_member_all"
  on public.rooms
  for all
  using (clinic_id = public.current_clinic_id() or public.is_admin())
  with check (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "treatments_member_all"
  on public.treatments
  for all
  using (clinic_id = public.current_clinic_id() or public.is_admin())
  with check (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "treatments_public_select"
  on public.treatments
  for select
  using (true);

create policy "appointments_member_all"
  on public.appointments
  for all
  using (clinic_id = public.current_clinic_id() or public.is_admin())
  with check (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "appointment_requests_public_insert"
  on public.appointment_requests
  for insert
  with check (true);

create policy "appointment_requests_member_select"
  on public.appointment_requests
  for select
  using (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "appointment_requests_member_update"
  on public.appointment_requests
  for update
  using (clinic_id = public.current_clinic_id() or public.is_admin())
  with check (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "settings_member_all"
  on public.settings
  for all
  using (clinic_id = public.current_clinic_id() or public.is_admin())
  with check (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "holidays_member_all"
  on public.holidays
  for all
  using (clinic_id = public.current_clinic_id() or public.is_admin())
  with check (clinic_id = public.current_clinic_id() or public.is_admin());

create policy "activity_admin_all"
  on public.activity_log
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "activity_member_all"
  on public.activity_log
  for all
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

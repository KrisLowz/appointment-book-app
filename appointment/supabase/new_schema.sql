-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid,
  type text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_log_pkey PRIMARY KEY (id),
  CONSTRAINT activity_log_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);
CREATE TABLE public.appointment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  patient_name text NOT NULL,
  phone text,
  email text,
  preferred_dates ARRAY NOT NULL DEFAULT '{}'::date[],
  preferred_times ARRAY NOT NULL DEFAULT '{}'::text[],
  notes text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
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
  preferred_dentist_id uuid,
  insurance text,
  patient_notes text,
  appointment_date date,
  appointment_start_time text,
  appointment_duration integer,
  appointment_treatment_id uuid,
  appointment_notes text,
  is_new_patient boolean DEFAULT true,
  lookup_email text,
  is_existing_verified boolean NOT NULL DEFAULT false,
  verification_id uuid,
  verification_email text,
  CONSTRAINT appointment_requests_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_requests_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT appointment_requests_preferred_dentist_id_fkey FOREIGN KEY (preferred_dentist_id) REFERENCES public.staff(id),
  CONSTRAINT appointment_requests_appointment_treatment_id_fkey FOREIGN KEY (appointment_treatment_id) REFERENCES public.treatments(id),
  CONSTRAINT appointment_requests_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES public.booking_verifications(id)
);
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  patient_id uuid,
  dentist_id uuid,
  room_id uuid,
  treatment_id uuid,
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text,
  duration integer,
  status text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT appointments_dentist_id_fkey FOREIGN KEY (dentist_id) REFERENCES public.staff(id),
  CONSTRAINT appointments_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT appointments_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatments(id)
);
CREATE TABLE public.booking_otps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  email text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  resend_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamp with time zone,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT booking_otps_pkey PRIMARY KEY (id),
  CONSTRAINT booking_otps_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);
CREATE TABLE public.booking_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  email text NOT NULL,
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  token_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT booking_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT booking_verifications_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);
CREATE TABLE public.clinic_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'dentist'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clinic_members_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_members_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT clinic_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.clinics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  name text NOT NULL,
  city text,
  plan text,
  status text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  slug text UNIQUE,
  CONSTRAINT clinics_pkey PRIMARY KEY (id)
);
CREATE TABLE public.holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  type text,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT holidays_pkey PRIMARY KEY (id),
  CONSTRAINT holidays_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);
CREATE TABLE public.patients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  id_number text,
  address text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  dob date,
  gender text,
  tax_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  allergies text,
  medical_conditions text,
  medications text,
  source text,
  preferred_dentist_id uuid,
  insurance text,
  notes text,
  CONSTRAINT patients_pkey PRIMARY KEY (id),
  CONSTRAINT patients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT patients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT patients_preferred_dentist_id_fkey FOREIGN KEY (preferred_dentist_id) REFERENCES public.staff(id)
);
CREATE TABLE public.profiles (
  user_id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text,
  account_type text CHECK (account_type = ANY (ARRAY['individual'::text, 'company'::text, 'admin'::text])),
  phone text,
  position text,
  company_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  avatar_url text,
  background_url text,
  clinic_id uuid,
  status text DEFAULT 'active'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  color text,
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE,
  clinic_name text,
  working_hours_start text,
  working_hours_end text,
  slot_duration integer,
  rest_days ARRAY NOT NULL DEFAULT '{}'::integer[],
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (id),
  CONSTRAINT settings_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);
CREATE TABLE public.staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  role text NOT NULL,
  name text NOT NULL,
  phone text,
  color text,
  specialty text,
  working_days ARRAY NOT NULL DEFAULT '{}'::integer[],
  start_time text,
  end_time text,
  assigned_to uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_pkey PRIMARY KEY (id),
  CONSTRAINT staff_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT staff_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.staff(id)
);
CREATE TABLE public.treatments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  duration integer,
  color text,
  supplies_needed ARRAY NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT treatments_pkey PRIMARY KEY (id),
  CONSTRAINT treatments_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);
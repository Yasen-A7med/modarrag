-- 202611250002_core_tenants_and_profiles.sql
-- Multi-tenant school registry and authenticated user profiles with privilege protection.

CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  governorate text NOT NULL,
  directorate text NOT NULL,
  logo_url text,
  brand_color_hex text NOT NULL DEFAULT '#1E3A8A',
  default_buffer_minutes integer NOT NULL DEFAULT 15,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_slug_format_chk'
      AND conrelid = 'public.schools'::regclass
  ) THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_slug_format_chk
      CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_brand_color_hex_chk'
      AND conrelid = 'public.schools'::regclass
  ) THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_brand_color_hex_chk
      CHECK (brand_color_hex ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_buffer_minutes_chk'
      AND conrelid = 'public.schools'::regclass
  ) THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_buffer_minutes_chk
      CHECK (default_buffer_minutes BETWEEN 0 AND 60);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schools_active_slug
  ON public.schools (slug)
  WHERE is_active = true;

CREATE OR REPLACE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE RESTRICT,
  role public.user_role_enum NOT NULL DEFAULT 'student',
  full_name text NOT NULL,
  phone text,
  student_national_code text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_school_role
  ON public.profiles (school_id, role)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_school_student_code_uq
  ON public.profiles (school_id, student_national_code)
  WHERE student_national_code IS NOT NULL;

CREATE OR REPLACE FUNCTION private.protect_profile_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role_enum;
  v_caller_school_id uuid;
BEGIN
  -- Allow privileged administrative SQL / service_role sessions
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated profile modification is not permitted'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.role, p.school_id
  INTO v_caller_role, v_caller_school_id
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  IF v_caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF v_caller_role = 'school_admin' AND OLD.school_id = v_caller_school_id AND OLD.id <> v_caller_id THEN
    IF NEW.role = 'super_admin' OR NEW.school_id IS DISTINCT FROM OLD.school_id THEN
      RAISE EXCEPTION 'School administrators cannot reassign school or elevate to super_admin'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Role escalation is not permitted'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Account status cannot be self-modified'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.school_id IS NOT NULL AND NEW.school_id IS DISTINCT FROM OLD.school_id THEN
    RAISE EXCEPTION 'Assigned school cannot be changed after onboarding'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_profile_privilege_columns() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_profiles_protect_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_profile_privilege_columns();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

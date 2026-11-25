-- 202611250001_extensions_and_enums.sql
-- Enables required PostgreSQL extensions inside the non-exposed `extensions` schema,
-- provisions the `private` helper schema, defines domain enums idempotently,
-- and adds the shared `updated_at` trigger helper.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS private;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    CREATE EXTENSION btree_gist WITH SCHEMA extensions;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
  END IF;
END $$;

-- Lock down `private` schema from PUBLIC and anon; authenticated needs USAGE only
-- for RLS evaluation of private helper functions granted explicitly in later migrations.
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role_enum'
  ) THEN
    CREATE TYPE public.user_role_enum AS ENUM (
      'super_admin',
      'school_admin',
      'teacher',
      'student',
      'gate_scanner'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'subject_type_enum'
  ) THEN
    CREATE TYPE public.subject_type_enum AS ENUM (
      'common',
      'track_core',
      'track_elective'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'hall_status_enum'
  ) THEN
    CREATE TYPE public.hall_status_enum AS ENUM (
      'active',
      'maintenance',
      'archived'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'session_status_enum'
  ) THEN
    CREATE TYPE public.session_status_enum AS ENUM (
      'scheduled',
      'full',
      'ongoing',
      'completed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'booking_status_enum'
  ) THEN
    CREATE TYPE public.booking_status_enum AS ENUM (
      'confirmed',
      'waitlisted',
      'cancelled_by_student',
      'cancelled_by_system',
      'checked_in',
      'no_show'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC, anon, authenticated;

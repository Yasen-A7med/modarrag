-- 202611250004_halls_and_atomic_sessions.sql
-- School lecture halls, recurring session series, and sessions enforced by
-- PostgreSQL btree_gist exclusion constraints for zero hall/teacher overlaps.

CREATE TABLE IF NOT EXISTS public.halls (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  building_ar text,
  floor_label_ar text,
  max_capacity integer NOT NULL,
  status public.hall_status_enum NOT NULL DEFAULT 'active',
  amenities jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (school_id, code)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'halls_max_capacity_chk'
      AND conrelid = 'public.halls'::regclass
  ) THEN
    ALTER TABLE public.halls
      ADD CONSTRAINT halls_max_capacity_chk
      CHECK (max_capacity BETWEEN 10 AND 120);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_halls_school_status
  ON public.halls (school_id, status);

CREATE OR REPLACE TRIGGER trg_halls_updated_at
  BEFORE UPDATE ON public.halls
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.session_series (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  hall_id uuid NOT NULL REFERENCES public.halls(id) ON DELETE RESTRICT,
  title_ar text NOT NULL,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  duration_minutes integer NOT NULL,
  recurrence_weeks integer NOT NULL DEFAULT 4,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_series_day_of_week_chk'
      AND conrelid = 'public.session_series'::regclass
  ) THEN
    ALTER TABLE public.session_series
      ADD CONSTRAINT session_series_day_of_week_chk
      CHECK (day_of_week BETWEEN 0 AND 6);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_series_duration_chk'
      AND conrelid = 'public.session_series'::regclass
  ) THEN
    ALTER TABLE public.session_series
      ADD CONSTRAINT session_series_duration_chk
      CHECK (duration_minutes BETWEEN 30 AND 240);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_series_weeks_chk'
      AND conrelid = 'public.session_series'::regclass
  ) THEN
    ALTER TABLE public.session_series
      ADD CONSTRAINT session_series_weeks_chk
      CHECK (recurrence_weeks BETWEEN 1 AND 24);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_series_dates_chk'
      AND conrelid = 'public.session_series'::regclass
  ) THEN
    ALTER TABLE public.session_series
      ADD CONSTRAINT session_series_dates_chk
      CHECK (ends_on >= starts_on);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_series_school_id
  ON public.session_series (school_id);

CREATE INDEX IF NOT EXISTS idx_session_series_teacher_id
  ON public.session_series (teacher_id);

CREATE INDEX IF NOT EXISTS idx_session_series_subject_id
  ON public.session_series (subject_id);

CREATE INDEX IF NOT EXISTS idx_session_series_hall_id
  ON public.session_series (hall_id);

CREATE OR REPLACE TRIGGER trg_session_series_updated_at
  BEFORE UPDATE ON public.session_series
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.session_series(id) ON DELETE SET NULL,
  hall_id uuid NOT NULL REFERENCES public.halls(id) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  title_ar text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  buffer_minutes integer NOT NULL DEFAULT 15,
  -- UTC conversion makes the interval addition strictly IMMUTABLE for GENERATED STORED
  occupied_range tstzrange GENERATED ALWAYS AS (
    tstzrange(
      starts_at,
      ((ends_at AT TIME ZONE 'UTC') + make_interval(mins => buffer_minutes)) AT TIME ZONE 'UTC',
      '[)'
    )
  ) STORED,
  max_capacity integer NOT NULL,
  booked_seats_count integer NOT NULL DEFAULT 0,
  status public.session_status_enum NOT NULL DEFAULT 'scheduled',
  cancellation_reason text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_time_order_chk'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_time_order_chk
      CHECK (ends_at > starts_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_buffer_minutes_chk'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_buffer_minutes_chk
      CHECK (buffer_minutes BETWEEN 0 AND 60);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_capacity_bounds_chk'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_capacity_bounds_chk
      CHECK (max_capacity BETWEEN 10 AND 120);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_booked_bounds_chk'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_booked_bounds_chk
      CHECK (booked_seats_count >= 0 AND booked_seats_count <= max_capacity);
  END IF;
END $$;

-- Atomic GiST Exclusion Constraints (including extensions schema in local search_path)
DO $$
BEGIN
  SET LOCAL search_path = public, extensions;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'no_overlapping_hall_sessions'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.sessions
      ADD CONSTRAINT no_overlapping_hall_sessions
      EXCLUDE USING gist (hall_id WITH =, occupied_range WITH &&)
      WHERE (status IN ('scheduled', 'full', 'ongoing'))
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'no_overlapping_teacher_sessions'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.sessions
      ADD CONSTRAINT no_overlapping_teacher_sessions
      EXCLUDE USING gist (teacher_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
      WHERE (status IN ('scheduled', 'full', 'ongoing'))
    $sql$;
  END IF;
END $$;

-- Performance and Foreign-Key Indexes on public.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_school_active_time
  ON public.sessions (school_id, starts_at)
  WHERE status IN ('scheduled', 'full', 'ongoing');

CREATE INDEX IF NOT EXISTS idx_sessions_subject_time
  ON public.sessions (subject_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_sessions_hall_time
  ON public.sessions (hall_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_sessions_teacher_time
  ON public.sessions (teacher_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_sessions_series_id
  ON public.sessions (series_id)
  WHERE series_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_created_by
  ON public.sessions (created_by)
  WHERE created_by IS NOT NULL;

CREATE OR REPLACE FUNCTION private.validate_session_tenant_and_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hall record;
  v_teacher record;
  v_subject record;
BEGIN
  SELECT id, school_id, max_capacity, status
  INTO v_hall
  FROM public.halls
  WHERE id = NEW.hall_id;

  IF NOT FOUND OR v_hall.school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'Session hall does not belong to the specified school'
      USING ERRCODE = '23514';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.hall_id IS DISTINCT FROM OLD.hall_id)
     AND v_hall.status <> 'active' THEN
    RAISE EXCEPTION 'Cannot schedule session in an inactive or maintenance hall'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.max_capacity > v_hall.max_capacity THEN
    RAISE EXCEPTION 'Session max_capacity (%) exceeds hall max_capacity (%)', NEW.max_capacity, v_hall.max_capacity
      USING ERRCODE = '23514';
  END IF;

  SELECT id, school_id, is_approved
  INTO v_teacher
  FROM public.teacher_profiles
  WHERE id = NEW.teacher_id;

  IF NOT FOUND OR v_teacher.school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'Teacher does not belong to the specified school'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' AND NOT v_teacher.is_approved THEN
    RAISE EXCEPTION 'Unapproved teachers cannot schedule sessions'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, school_id, is_active
  INTO v_subject
  FROM public.subjects
  WHERE id = NEW.subject_id;

  IF NOT FOUND OR v_subject.school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'Subject does not belong to the specified school'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' AND NOT v_subject.is_active THEN
    RAISE EXCEPTION 'Inactive subjects cannot be scheduled'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_session_tenant_and_capacity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_sessions_validate_tenant_and_capacity
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_session_tenant_and_capacity();

CREATE OR REPLACE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

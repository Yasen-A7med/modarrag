-- 202611250003_dynamic_academic_cms.sql
-- Zero-hardcoded academic CMS tables: grades, tracks, subjects, track-subject mappings,
-- student enrollments, teacher profiles, and teacher subject authorizations.

CREATE TABLE IF NOT EXISTS public.academic_grades (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  sort_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_academic_grades_school_active
  ON public.academic_grades (school_id, sort_order)
  WHERE is_active = true;

CREATE OR REPLACE TRIGGER trg_academic_grades_updated_at
  BEFORE UPDATE ON public.academic_grades
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.academic_tracks (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade_id uuid NOT NULL REFERENCES public.academic_grades(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  color_hex text NOT NULL DEFAULT '#2563EB',
  icon_key text NOT NULL DEFAULT 'layers',
  sort_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (school_id, grade_id, code)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'academic_tracks_color_hex_chk'
      AND conrelid = 'public.academic_tracks'::regclass
  ) THEN
    ALTER TABLE public.academic_tracks
      ADD CONSTRAINT academic_tracks_color_hex_chk
      CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_academic_tracks_grade_id
  ON public.academic_tracks (grade_id, sort_order)
  WHERE is_active = true;

CREATE OR REPLACE TRIGGER trg_academic_tracks_updated_at
  BEFORE UPDATE ON public.academic_tracks
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade_id uuid NOT NULL REFERENCES public.academic_grades(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  subject_type public.subject_type_enum NOT NULL,
  elective_group_code text,
  color_hex text NOT NULL DEFAULT '#1E3A8A',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (school_id, grade_id, code)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subjects_elective_group_chk'
      AND conrelid = 'public.subjects'::regclass
  ) THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_elective_group_chk
      CHECK (
        (subject_type = 'track_elective' AND elective_group_code IS NOT NULL)
        OR (subject_type <> 'track_elective')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subjects_color_hex_chk'
      AND conrelid = 'public.subjects'::regclass
  ) THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_color_hex_chk
      CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subjects_grade_type
  ON public.subjects (grade_id, subject_type)
  WHERE is_active = true;

CREATE OR REPLACE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.track_subjects (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.academic_tracks(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  is_mandatory boolean NOT NULL DEFAULT true,
  elective_group_code text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (track_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_track_subjects_school_id
  ON public.track_subjects (school_id);

CREATE INDEX IF NOT EXISTS idx_track_subjects_subject_id
  ON public.track_subjects (subject_id);

CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grade_id uuid NOT NULL REFERENCES public.academic_grades(id) ON DELETE RESTRICT,
  track_id uuid NOT NULL REFERENCES public.academic_tracks(id) ON DELETE RESTRICT,
  selected_elective_subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  academic_year text NOT NULL DEFAULT '2026-2027',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_enrollments_active_uq
  ON public.student_enrollments (student_id, academic_year)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_student_enrollments_school_track
  ON public.student_enrollments (school_id, track_id);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_grade_id
  ON public.student_enrollments (grade_id);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_track_id
  ON public.student_enrollments (track_id);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_elective_id
  ON public.student_enrollments (selected_elective_subject_id)
  WHERE selected_elective_subject_id IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_student_enrollments_updated_at
  BEFORE UPDATE ON public.student_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_code text NOT NULL,
  specialty_ar text NOT NULL,
  bio_ar text,
  is_approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (school_id, teacher_code)
);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_approved_by
  ON public.teacher_profiles (approved_by)
  WHERE approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_school_approved
  ON public.teacher_profiles (school_id, is_approved);

CREATE OR REPLACE FUNCTION private.protect_teacher_approval()
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
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  v_caller_id := auth.uid();
  SELECT p.role, p.school_id
  INTO v_caller_role, v_caller_school_id
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  IF v_caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF v_caller_role = 'school_admin' AND v_caller_school_id = OLD.school_id THEN
    RETURN NEW;
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Only school or system administrators can modify teacher approval state'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_teacher_approval() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_teacher_profiles_protect_approval
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_teacher_approval();

CREATE OR REPLACE TRIGGER trg_teacher_profiles_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.teacher_subjects (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (teacher_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_subjects_school_id
  ON public.teacher_subjects (school_id);

CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject_id
  ON public.teacher_subjects (subject_id);

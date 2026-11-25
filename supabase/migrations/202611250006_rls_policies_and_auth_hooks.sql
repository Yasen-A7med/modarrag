-- 202611250006_rls_policies_and_auth_hooks.sql
-- Private-schema security helpers, Supabase Auth Access Token Hook (app_metadata only),
-- forced Row-Level Security across all 15 tables, scoped read-only TO anon catalog policies,
-- and idempotent policy creation (without DROP statements).

-- 1. Private RLS Helpers (NEVER consult user_metadata; always use (select auth.uid()))
CREATE OR REPLACE FUNCTION private.current_app_role()
RETURNS public.user_role_enum
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.is_active = true
    ),
    (
      NULLIF(
        NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb
          -> 'app_metadata' ->> 'app_role',
        ''
      )::public.user_role_enum
    )
  );
$$;

CREATE OR REPLACE FUNCTION private.current_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT p.school_id
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.is_active = true
    ),
    (
      NULLIF(
        NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb
          -> 'app_metadata' ->> 'school_id',
        ''
      )::uuid
    )
  );
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT (p.role = 'super_admin' AND p.is_active = true)
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
    ),
    false
  );
$$;

-- Revoke public/anon execution; grant authenticated execution solely to evaluate RLS quals
REVOKE ALL ON FUNCTION private.current_app_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_school_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_super_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated;

-- 2. Custom Access Token Hook (writes server-verified role/school_id into app_metadata claims)
CREATE OR REPLACE FUNCTION private.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims jsonb;
  v_app_meta jsonb;
  v_user_id uuid;
  v_profile record;
BEGIN
  v_claims := COALESCE(event -> 'claims', '{}'::jsonb);
  v_user_id := NULLIF(event ->> 'user_id', '')::uuid;

  IF v_user_id IS NOT NULL THEN
    SELECT p.role, p.school_id, p.is_active
    INTO v_profile
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF FOUND AND v_profile.is_active THEN
      v_app_meta := COALESCE(v_claims -> 'app_metadata', '{}'::jsonb);
      v_app_meta := pg_catalog.jsonb_set(v_app_meta, '{app_role}', pg_catalog.to_jsonb(v_profile.role::text), true);
      IF v_profile.school_id IS NOT NULL THEN
        v_app_meta := pg_catalog.jsonb_set(v_app_meta, '{school_id}', pg_catalog.to_jsonb(v_profile.school_id::text), true);
      END IF;
      v_claims := pg_catalog.jsonb_set(v_claims, '{app_metadata}', v_app_meta, true);
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_set(event, '{claims}', v_claims, true);
END;
$$;

REVOKE ALL ON FUNCTION private.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION private.custom_access_token_hook(jsonb) TO supabase_auth_admin;
  END IF;
END $$;

-- 3. Enable & FORCE Row-Level Security across all 15 tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.academic_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_grades FORCE ROW LEVEL SECURITY;

ALTER TABLE public.academic_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_tracks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.track_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_subjects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halls FORCE ROW LEVEL SECURITY;

ALTER TABLE public.session_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_series FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- 4. Idempotent RLS Policy Provisioning (no DROP statements; pg_policies existence checks)
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT *
    FROM (
      VALUES
        -- [1] schools (scoped TO anon read-only on active catalog + TO authenticated)
        (
          'schools',
          'schools_select_anon',
          $pol$
            CREATE POLICY schools_select_anon ON public.schools
              FOR SELECT TO anon
              USING (is_active = true)
          $pol$
        ),
        (
          'schools',
          'schools_select_authenticated',
          $pol$
            CREATE POLICY schools_select_authenticated ON public.schools
              FOR SELECT TO authenticated
              USING (
                is_active = true
                OR id = (select private.current_school_id())
                OR (select private.is_super_admin())
              )
          $pol$
        ),
        (
          'schools',
          'schools_insert_authenticated',
          $pol$
            CREATE POLICY schools_insert_authenticated ON public.schools
              FOR INSERT TO authenticated
              WITH CHECK ((select private.is_super_admin()))
          $pol$
        ),
        (
          'schools',
          'schools_update_authenticated',
          $pol$
            CREATE POLICY schools_update_authenticated ON public.schools
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'schools',
          'schools_delete_authenticated',
          $pol$
            CREATE POLICY schools_delete_authenticated ON public.schools
              FOR DELETE TO authenticated
              USING ((select private.is_super_admin()))
          $pol$
        ),

        -- [2] profiles (strictly TO authenticated)
        (
          'profiles',
          'profiles_select_authenticated',
          $pol$
            CREATE POLICY profiles_select_authenticated ON public.profiles
              FOR SELECT TO authenticated
              USING (
                id = (select auth.uid())
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) IN ('school_admin', 'gate_scanner', 'teacher')
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'profiles',
          'profiles_insert_authenticated',
          $pol$
            CREATE POLICY profiles_insert_authenticated ON public.profiles
              FOR INSERT TO authenticated
              WITH CHECK (
                (
                  id = (select auth.uid())
                  AND role IN ('student', 'teacher')
                  AND is_active = true
                )
                OR (select private.is_super_admin())
              )
          $pol$
        ),
        (
          'profiles',
          'profiles_update_authenticated',
          $pol$
            CREATE POLICY profiles_update_authenticated ON public.profiles
              FOR UPDATE TO authenticated
              USING (
                id = (select auth.uid())
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                id = (select auth.uid())
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'profiles',
          'profiles_delete_authenticated',
          $pol$
            CREATE POLICY profiles_delete_authenticated ON public.profiles
              FOR DELETE TO authenticated
              USING ((select private.is_super_admin()))
          $pol$
        ),

        -- [3] academic_grades (scoped TO anon read-only on active catalog + TO authenticated)
        (
          'academic_grades',
          'academic_grades_select_anon',
          $pol$
            CREATE POLICY academic_grades_select_anon ON public.academic_grades
              FOR SELECT TO anon
              USING (
                is_active = true
                AND EXISTS (
                  SELECT 1 FROM public.schools s
                  WHERE s.id = academic_grades.school_id
                    AND s.is_active = true
                )
              )
          $pol$
        ),
        (
          'academic_grades',
          'academic_grades_select_authenticated',
          $pol$
            CREATE POLICY academic_grades_select_authenticated ON public.academic_grades
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
                OR ((select private.current_school_id()) IS NULL AND is_active = true)
              )
          $pol$
        ),
        (
          'academic_grades',
          'academic_grades_insert_authenticated',
          $pol$
            CREATE POLICY academic_grades_insert_authenticated ON public.academic_grades
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'academic_grades',
          'academic_grades_update_authenticated',
          $pol$
            CREATE POLICY academic_grades_update_authenticated ON public.academic_grades
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'academic_grades',
          'academic_grades_delete_authenticated',
          $pol$
            CREATE POLICY academic_grades_delete_authenticated ON public.academic_grades
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),

        -- [4] academic_tracks (scoped TO anon read-only on active catalog + TO authenticated)
        (
          'academic_tracks',
          'academic_tracks_select_anon',
          $pol$
            CREATE POLICY academic_tracks_select_anon ON public.academic_tracks
              FOR SELECT TO anon
              USING (
                is_active = true
                AND EXISTS (
                  SELECT 1 FROM public.schools s
                  WHERE s.id = academic_tracks.school_id
                    AND s.is_active = true
                )
                AND EXISTS (
                  SELECT 1 FROM public.academic_grades g
                  WHERE g.id = academic_tracks.grade_id
                    AND g.is_active = true
                )
              )
          $pol$
        ),
        (
          'academic_tracks',
          'academic_tracks_select_authenticated',
          $pol$
            CREATE POLICY academic_tracks_select_authenticated ON public.academic_tracks
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
                OR ((select private.current_school_id()) IS NULL AND is_active = true)
              )
          $pol$
        ),
        (
          'academic_tracks',
          'academic_tracks_insert_authenticated',
          $pol$
            CREATE POLICY academic_tracks_insert_authenticated ON public.academic_tracks
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'academic_tracks',
          'academic_tracks_update_authenticated',
          $pol$
            CREATE POLICY academic_tracks_update_authenticated ON public.academic_tracks
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'academic_tracks',
          'academic_tracks_delete_authenticated',
          $pol$
            CREATE POLICY academic_tracks_delete_authenticated ON public.academic_tracks
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),

        -- [5] subjects (scoped TO anon read-only on active catalog + TO authenticated)
        (
          'subjects',
          'subjects_select_anon',
          $pol$
            CREATE POLICY subjects_select_anon ON public.subjects
              FOR SELECT TO anon
              USING (
                is_active = true
                AND EXISTS (
                  SELECT 1 FROM public.schools s
                  WHERE s.id = subjects.school_id
                    AND s.is_active = true
                )
                AND EXISTS (
                  SELECT 1 FROM public.academic_grades g
                  WHERE g.id = subjects.grade_id
                    AND g.is_active = true
                )
              )
          $pol$
        ),
        (
          'subjects',
          'subjects_select_authenticated',
          $pol$
            CREATE POLICY subjects_select_authenticated ON public.subjects
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
                OR ((select private.current_school_id()) IS NULL AND is_active = true)
              )
          $pol$
        ),
        (
          'subjects',
          'subjects_insert_authenticated',
          $pol$
            CREATE POLICY subjects_insert_authenticated ON public.subjects
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'subjects',
          'subjects_update_authenticated',
          $pol$
            CREATE POLICY subjects_update_authenticated ON public.subjects
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'subjects',
          'subjects_delete_authenticated',
          $pol$
            CREATE POLICY subjects_delete_authenticated ON public.subjects
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),

        -- [6] track_subjects (scoped TO anon read-only on active catalog + TO authenticated)
        (
          'track_subjects',
          'track_subjects_select_anon',
          $pol$
            CREATE POLICY track_subjects_select_anon ON public.track_subjects
              FOR SELECT TO anon
              USING (
                EXISTS (
                  SELECT 1 FROM public.schools s
                  WHERE s.id = track_subjects.school_id
                    AND s.is_active = true
                )
                AND EXISTS (
                  SELECT 1 FROM public.academic_tracks t
                  WHERE t.id = track_subjects.track_id
                    AND t.is_active = true
                )
                AND EXISTS (
                  SELECT 1 FROM public.subjects sub
                  WHERE sub.id = track_subjects.subject_id
                    AND sub.is_active = true
                )
              )
          $pol$
        ),
        (
          'track_subjects',
          'track_subjects_select_authenticated',
          $pol$
            CREATE POLICY track_subjects_select_authenticated ON public.track_subjects
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
                OR (select private.current_school_id()) IS NULL
              )
          $pol$
        ),
        (
          'track_subjects',
          'track_subjects_insert_authenticated',
          $pol$
            CREATE POLICY track_subjects_insert_authenticated ON public.track_subjects
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'track_subjects',
          'track_subjects_update_authenticated',
          $pol$
            CREATE POLICY track_subjects_update_authenticated ON public.track_subjects
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'track_subjects',
          'track_subjects_delete_authenticated',
          $pol$
            CREATE POLICY track_subjects_delete_authenticated ON public.track_subjects
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),

        -- [7] student_enrollments (strictly TO authenticated)
        (
          'student_enrollments',
          'student_enrollments_select_authenticated',
          $pol$
            CREATE POLICY student_enrollments_select_authenticated ON public.student_enrollments
              FOR SELECT TO authenticated
              USING (
                student_id = (select auth.uid())
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) IN ('school_admin', 'teacher')
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'student_enrollments',
          'student_enrollments_insert_authenticated',
          $pol$
            CREATE POLICY student_enrollments_insert_authenticated ON public.student_enrollments
              FOR INSERT TO authenticated
              WITH CHECK (
                (
                  student_id = (select auth.uid())
                  AND school_id = (select private.current_school_id())
                )
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'student_enrollments',
          'student_enrollments_update_authenticated',
          $pol$
            CREATE POLICY student_enrollments_update_authenticated ON public.student_enrollments
              FOR UPDATE TO authenticated
              USING (
                (
                  student_id = (select auth.uid())
                  AND school_id = (select private.current_school_id())
                )
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (
                  student_id = (select auth.uid())
                  AND school_id = (select private.current_school_id())
                )
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'student_enrollments',
          'student_enrollments_delete_authenticated',
          $pol$
            CREATE POLICY student_enrollments_delete_authenticated ON public.student_enrollments
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),

        -- [8] teacher_profiles (strictly TO authenticated)
        (
          'teacher_profiles',
          'teacher_profiles_select_authenticated',
          $pol$
            CREATE POLICY teacher_profiles_select_authenticated ON public.teacher_profiles
              FOR SELECT TO authenticated
              USING (
                id = (select auth.uid())
                OR (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
              )
          $pol$
        ),
        (
          'teacher_profiles',
          'teacher_profiles_insert_authenticated',
          $pol$
            CREATE POLICY teacher_profiles_insert_authenticated ON public.teacher_profiles
              FOR INSERT TO authenticated
              WITH CHECK (
                (
                  id = (select auth.uid())
                  AND school_id = (select private.current_school_id())
                  AND is_approved = false
                )
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'teacher_profiles',
          'teacher_profiles_update_authenticated',
          $pol$
            CREATE POLICY teacher_profiles_update_authenticated ON public.teacher_profiles
              FOR UPDATE TO authenticated
              USING (
                (
                  id = (select auth.uid())
                  AND school_id = (select private.current_school_id())
                )
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (
                  id = (select auth.uid())
                  AND school_id = (select private.current_school_id())
                )
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'teacher_profiles',
          'teacher_profiles_delete_authenticated',
          $pol$
            CREATE POLICY teacher_profiles_delete_authenticated ON public.teacher_profiles
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),

        -- [9] teacher_subjects (strictly TO authenticated)
        (
          'teacher_subjects',
          'teacher_subjects_select_authenticated',
          $pol$
            CREATE POLICY teacher_subjects_select_authenticated ON public.teacher_subjects
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
              )
          $pol$
        ),
        (
          'teacher_subjects',
          'teacher_subjects_insert_authenticated',
          $pol$
            CREATE POLICY teacher_subjects_insert_authenticated ON public.teacher_subjects
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'teacher_subjects',
          'teacher_subjects_update_authenticated',
          $pol$
            CREATE POLICY teacher_subjects_update_authenticated ON public.teacher_subjects
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'teacher_subjects',
          'teacher_subjects_delete_authenticated',
          $pol$
            CREATE POLICY teacher_subjects_delete_authenticated ON public.teacher_subjects
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),

        -- [10] halls (strictly TO authenticated)
        (
          'halls',
          'halls_select_authenticated',
          $pol$
            CREATE POLICY halls_select_authenticated ON public.halls
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
              )
          $pol$
        ),
        (
          'halls',
          'halls_insert_authenticated',
          $pol$
            CREATE POLICY halls_insert_authenticated ON public.halls
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'halls',
          'halls_update_authenticated',
          $pol$
            CREATE POLICY halls_update_authenticated ON public.halls
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),
        (
          'halls',
          'halls_delete_authenticated',
          $pol$
            CREATE POLICY halls_delete_authenticated ON public.halls
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        ),

        -- [11] session_series (strictly TO authenticated)
        (
          'session_series',
          'session_series_select_authenticated',
          $pol$
            CREATE POLICY session_series_select_authenticated ON public.session_series
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
              )
          $pol$
        ),
        (
          'session_series',
          'session_series_insert_authenticated',
          $pol$
            CREATE POLICY session_series_insert_authenticated ON public.session_series
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  school_id = (select private.current_school_id())
                  AND (
                    (select private.current_app_role()) = 'school_admin'
                    OR (
                      (select private.current_app_role()) = 'teacher'
                      AND teacher_id = (select auth.uid())
                    )
                  )
                )
              )
          $pol$
        ),
        (
          'session_series',
          'session_series_update_authenticated',
          $pol$
            CREATE POLICY session_series_update_authenticated ON public.session_series
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  school_id = (select private.current_school_id())
                  AND (
                    (select private.current_app_role()) = 'school_admin'
                    OR (
                      (select private.current_app_role()) = 'teacher'
                      AND teacher_id = (select auth.uid())
                    )
                  )
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  school_id = (select private.current_school_id())
                  AND (
                    (select private.current_app_role()) = 'school_admin'
                    OR (
                      (select private.current_app_role()) = 'teacher'
                      AND teacher_id = (select auth.uid())
                    )
                  )
                )
              )
          $pol$
        ),
        (
          'session_series',
          'session_series_delete_authenticated',
          $pol$
            CREATE POLICY session_series_delete_authenticated ON public.session_series
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  school_id = (select private.current_school_id())
                  AND (
                    (select private.current_app_role()) = 'school_admin'
                    OR (
                      (select private.current_app_role()) = 'teacher'
                      AND teacher_id = (select auth.uid())
                    )
                  )
                )
              )
          $pol$
        ),

        -- [12] sessions (strictly TO authenticated)
        (
          'sessions',
          'sessions_select_authenticated',
          $pol$
            CREATE POLICY sessions_select_authenticated ON public.sessions
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR school_id = (select private.current_school_id())
              )
          $pol$
        ),
        (
          'sessions',
          'sessions_insert_authenticated',
          $pol$
            CREATE POLICY sessions_insert_authenticated ON public.sessions
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  school_id = (select private.current_school_id())
                  AND (
                    (select private.current_app_role()) = 'school_admin'
                    OR (
                      (select private.current_app_role()) = 'teacher'
                      AND teacher_id = (select auth.uid())
                    )
                  )
                )
              )
          $pol$
        ),
        (
          'sessions',
          'sessions_update_authenticated',
          $pol$
            CREATE POLICY sessions_update_authenticated ON public.sessions
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  school_id = (select private.current_school_id())
                  AND (
                    (select private.current_app_role()) = 'school_admin'
                    OR (
                      (select private.current_app_role()) = 'teacher'
                      AND teacher_id = (select auth.uid())
                    )
                  )
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  school_id = (select private.current_school_id())
                  AND (
                    (select private.current_app_role()) = 'school_admin'
                    OR (
                      (select private.current_app_role()) = 'teacher'
                      AND teacher_id = (select auth.uid())
                    )
                  )
                )
              )
          $pol$
        ),
        (
          'sessions',
          'sessions_delete_authenticated',
          $pol$
            CREATE POLICY sessions_delete_authenticated ON public.sessions
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  school_id = (select private.current_school_id())
                  AND (
                    (select private.current_app_role()) = 'school_admin'
                    OR (
                      (select private.current_app_role()) = 'teacher'
                      AND teacher_id = (select auth.uid())
                    )
                  )
                )
              )
          $pol$
        ),

        -- [13] bookings (strictly TO authenticated, read-only; mutations via atomic RPCs)
        (
          'bookings',
          'bookings_select_authenticated',
          $pol$
            CREATE POLICY bookings_select_authenticated ON public.bookings
              FOR SELECT TO authenticated
              USING (
                student_id = (select auth.uid())
                OR (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) IN ('school_admin', 'gate_scanner')
                  AND school_id = (select private.current_school_id())
                )
                OR (
                  (select private.current_app_role()) = 'teacher'
                  AND school_id = (select private.current_school_id())
                  AND EXISTS (
                    SELECT 1
                    FROM public.sessions s
                    WHERE s.id = bookings.session_id
                      AND s.teacher_id = (select auth.uid())
                  )
                )
              )
          $pol$
        ),

        -- [14] notifications (strictly TO authenticated)
        (
          'notifications',
          'notifications_select_authenticated',
          $pol$
            CREATE POLICY notifications_select_authenticated ON public.notifications
              FOR SELECT TO authenticated
              USING (
                recipient_id = (select auth.uid())
                OR (select private.is_super_admin())
              )
          $pol$
        ),
        (
          'notifications',
          'notifications_update_authenticated',
          $pol$
            CREATE POLICY notifications_update_authenticated ON public.notifications
              FOR UPDATE TO authenticated
              USING (recipient_id = (select auth.uid()))
              WITH CHECK (recipient_id = (select auth.uid()))
          $pol$
        ),

        -- [15] audit_logs (strictly TO authenticated, read-only; append-only via RPCs)
        (
          'audit_logs',
          'audit_logs_select_authenticated',
          $pol$
            CREATE POLICY audit_logs_select_authenticated ON public.audit_logs
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
              )
          $pol$
        )
    ) AS defs(table_name, policy_name, create_sql)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_policy.table_name
        AND policyname = v_policy.policy_name
    ) THEN
      EXECUTE v_policy.create_sql;
    END IF;
  END LOOP;
END $$;

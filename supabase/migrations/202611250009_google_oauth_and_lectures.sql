-- 202611250009_google_oauth_and_lectures.sql
-- Adds automatic Google OAuth profile provisioning trigger, private video storage bucket
-- ('lectures'), recorded lecture catalog & separated asset/secret tables with strict RLS,
-- and SECURITY DEFINER password-verification RPCs using pgcrypto.

-- 1. Automatic Profile Provisioning for New OAuth / Email Auth Users
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_name text;
  v_full_name text;
  v_avatar_url text;
BEGIN
  v_raw_name := COALESCE(
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'name'), ''),
    NULLIF(pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'طالب جديد'
  );
  v_full_name := pg_catalog.left(v_raw_name, 120);

  v_avatar_url := COALESCE(
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'picture'), '')
  );

  INSERT INTO public.profiles (
    id,
    school_id,
    role,
    full_name,
    avatar_url,
    is_active
  ) VALUES (
    NEW.id,
    NULL,
    'student'::public.user_role_enum,
    v_full_name,
    v_avatar_url,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'auth'
      AND c.relname = 'users'
      AND t.tgname = 'trg_auth_users_create_profile'
  ) THEN
    CREATE TRIGGER trg_auth_users_create_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION private.handle_new_auth_user();
  END IF;
END $$;

-- 2. Recorded Lectures Visibility Enum & Tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'lecture_visibility_enum'
  ) THEN
    CREATE TYPE public.lecture_visibility_enum AS ENUM (
      'public',
      'attendees_only',
      'secret'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.lectures (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  description_ar text,
  visibility public.lecture_visibility_enum NOT NULL DEFAULT 'public',
  file_size_bytes bigint,
  mime_type text,
  duration_minutes integer,
  share_token text NOT NULL UNIQUE,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT lectures_title_length_chk CHECK (pg_catalog.char_length(pg_catalog.btrim(title_ar)) >= 3),
  CONSTRAINT lectures_attendees_requires_session_chk CHECK (visibility <> 'attendees_only' OR session_id IS NOT NULL),
  CONSTRAINT lectures_file_size_chk CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  CONSTRAINT lectures_duration_chk CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600)
);

CREATE INDEX IF NOT EXISTS idx_lectures_school_visibility
  ON public.lectures (school_id, visibility, is_published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lectures_teacher
  ON public.lectures (teacher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lectures_session
  ON public.lectures (session_id)
  WHERE session_id IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_lectures_updated_at
  BEFORE UPDATE ON public.lectures
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- Validate tenant alignment on lecture insert/update
CREATE OR REPLACE FUNCTION private.validate_lecture_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subject_school uuid;
  v_teacher_school uuid;
  v_session_school uuid;
BEGIN
  SELECT school_id INTO v_subject_school FROM public.subjects WHERE id = NEW.subject_id;
  IF v_subject_school IS DISTINCT FROM NEW.school_id THEN
    RAISE EXCEPTION 'Lecture subject does not belong to the target school'
      USING ERRCODE = '23514';
  END IF;

  SELECT school_id INTO v_teacher_school FROM public.profiles WHERE id = NEW.teacher_id;
  IF v_teacher_school IS DISTINCT FROM NEW.school_id THEN
    RAISE EXCEPTION 'Lecture teacher does not belong to the target school'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.session_id IS NOT NULL THEN
    SELECT school_id INTO v_session_school FROM public.sessions WHERE id = NEW.session_id;
    IF v_session_school IS DISTINCT FROM NEW.school_id THEN
      RAISE EXCEPTION 'Linked session does not belong to the target school'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_lecture_tenant_integrity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_lectures_validate_tenant
  BEFORE INSERT OR UPDATE ON public.lectures
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_lecture_tenant_integrity();

-- Isolated table for protected video sources (never exposed cleanly in catalog SELECTs without access)
CREATE TABLE IF NOT EXISTS public.lecture_media (
  lecture_id uuid PRIMARY KEY REFERENCES public.lectures(id) ON DELETE CASCADE,
  storage_path text,
  external_video_url text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT lecture_media_source_chk CHECK (storage_path IS NOT NULL OR external_video_url IS NOT NULL),
  CONSTRAINT lecture_media_external_https_chk CHECK (
    external_video_url IS NULL OR external_video_url ~* '^https://'
  )
);

CREATE OR REPLACE TRIGGER trg_lecture_media_updated_at
  BEFORE UPDATE ON public.lecture_media
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- Isolated table for secret lecture password hashes (strictly owner/admin write, SECURITY DEFINER verify)
CREATE TABLE IF NOT EXISTS public.lecture_secrets (
  lecture_id uuid PRIMARY KEY REFERENCES public.lectures(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE OR REPLACE TRIGGER trg_lecture_secrets_updated_at
  BEFORE UPDATE ON public.lecture_secrets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- Time-bounded unlock leases granted to authenticated viewers after entering valid secret password
CREATE TABLE IF NOT EXISTS public.lecture_access_grants (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  lecture_id uuid NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (pg_catalog.now() + interval '4 hours'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT lecture_access_grants_unique_viewer UNIQUE (lecture_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lecture_access_grants_user
  ON public.lecture_access_grants (user_id, expires_at);

-- 3. Enable & FORCE Row-Level Security
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures FORCE ROW LEVEL SECURITY;

ALTER TABLE public.lecture_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_media FORCE ROW LEVEL SECURITY;

ALTER TABLE public.lecture_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_secrets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.lecture_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_access_grants FORCE ROW LEVEL SECURITY;

-- 4. RLS Policies for Lectures Tables
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT *
    FROM (
      VALUES
        -- public.lectures
        (
          'lectures',
          'lectures_select_anon',
          $pol$
            CREATE POLICY lectures_select_anon ON public.lectures
              FOR SELECT TO anon
              USING (
                is_published = true
                AND visibility = 'public'
                AND EXISTS (
                  SELECT 1 FROM public.schools s
                  WHERE s.id = lectures.school_id AND s.is_active = true
                )
              )
          $pol$
        ),
        (
          'lectures',
          'lectures_select_authenticated',
          $pol$
            CREATE POLICY lectures_select_authenticated ON public.lectures
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
                OR teacher_id = (select auth.uid())
                OR (
                  is_published = true
                  AND visibility IN ('public', 'attendees_only')
                  AND EXISTS (
                    SELECT 1 FROM public.schools s
                    WHERE s.id = lectures.school_id AND s.is_active = true
                  )
                  AND (
                    visibility = 'public'
                    OR school_id = (select private.current_school_id())
                  )
                )
              )
          $pol$
        ),
        (
          'lectures',
          'lectures_insert_authenticated',
          $pol$
            CREATE POLICY lectures_insert_authenticated ON public.lectures
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
                OR (
                  (select private.current_app_role()) = 'teacher'
                  AND school_id = (select private.current_school_id())
                  AND teacher_id = (select auth.uid())
                  AND EXISTS (
                    SELECT 1 FROM public.teacher_profiles tp
                    WHERE tp.id = (select auth.uid())
                      AND tp.school_id = lectures.school_id
                      AND tp.is_approved = true
                  )
                )
              )
          $pol$
        ),
        (
          'lectures',
          'lectures_update_authenticated',
          $pol$
            CREATE POLICY lectures_update_authenticated ON public.lectures
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
                OR teacher_id = (select auth.uid())
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
                OR teacher_id = (select auth.uid())
              )
          $pol$
        ),
        (
          'lectures',
          'lectures_delete_authenticated',
          $pol$
            CREATE POLICY lectures_delete_authenticated ON public.lectures
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR (
                  (select private.current_app_role()) = 'school_admin'
                  AND school_id = (select private.current_school_id())
                )
                OR teacher_id = (select auth.uid())
              )
          $pol$
        ),

        -- public.lecture_media (strict playback gating!)
        (
          'lecture_media',
          'lecture_media_select_anon',
          $pol$
            CREATE POLICY lecture_media_select_anon ON public.lecture_media
              FOR SELECT TO anon
              USING (
                EXISTS (
                  SELECT 1 FROM public.lectures l
                  JOIN public.schools s ON s.id = l.school_id
                  WHERE l.id = lecture_media.lecture_id
                    AND l.is_published = true
                    AND l.visibility = 'public'
                    AND s.is_active = true
                )
              )
          $pol$
        ),
        (
          'lecture_media',
          'lecture_media_select_authenticated',
          $pol$
            CREATE POLICY lecture_media_select_authenticated ON public.lecture_media
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR EXISTS (
                  SELECT 1 FROM public.lectures l
                  WHERE l.id = lecture_media.lecture_id
                    AND (
                      l.teacher_id = (select auth.uid())
                      OR (
                        (select private.current_app_role()) = 'school_admin'
                        AND l.school_id = (select private.current_school_id())
                      )
                      OR (
                        l.is_published = true
                        AND (
                          l.visibility = 'public'
                          OR (
                            l.visibility = 'attendees_only'
                            AND l.session_id IS NOT NULL
                            AND EXISTS (
                              SELECT 1 FROM public.bookings b
                              WHERE b.session_id = l.session_id
                                AND b.student_id = (select auth.uid())
                                AND b.status = 'checked_in'
                            )
                          )
                          OR (
                            l.visibility = 'secret'
                            AND EXISTS (
                              SELECT 1 FROM public.lecture_access_grants g
                              WHERE g.lecture_id = l.id
                                AND g.user_id = (select auth.uid())
                                AND g.expires_at > pg_catalog.now()
                            )
                          )
                        )
                      )
                    )
                )
              )
          $pol$
        ),
        (
          'lecture_media',
          'lecture_media_insert_authenticated',
          $pol$
            CREATE POLICY lecture_media_insert_authenticated ON public.lecture_media
              FOR INSERT TO authenticated
              WITH CHECK (
                (select private.is_super_admin())
                OR EXISTS (
                  SELECT 1 FROM public.lectures l
                  WHERE l.id = lecture_media.lecture_id
                    AND (
                      l.teacher_id = (select auth.uid())
                      OR (
                        (select private.current_app_role()) = 'school_admin'
                        AND l.school_id = (select private.current_school_id())
                      )
                    )
                )
              )
          $pol$
        ),
        (
          'lecture_media',
          'lecture_media_update_authenticated',
          $pol$
            CREATE POLICY lecture_media_update_authenticated ON public.lecture_media
              FOR UPDATE TO authenticated
              USING (
                (select private.is_super_admin())
                OR EXISTS (
                  SELECT 1 FROM public.lectures l
                  WHERE l.id = lecture_media.lecture_id
                    AND (
                      l.teacher_id = (select auth.uid())
                      OR (
                        (select private.current_app_role()) = 'school_admin'
                        AND l.school_id = (select private.current_school_id())
                      )
                    )
                )
              )
          $pol$
        ),
        (
          'lecture_media',
          'lecture_media_delete_authenticated',
          $pol$
            CREATE POLICY lecture_media_delete_authenticated ON public.lecture_media
              FOR DELETE TO authenticated
              USING (
                (select private.is_super_admin())
                OR EXISTS (
                  SELECT 1 FROM public.lectures l
                  WHERE l.id = lecture_media.lecture_id
                    AND (
                      l.teacher_id = (select auth.uid())
                      OR (
                        (select private.current_app_role()) = 'school_admin'
                        AND l.school_id = (select private.current_school_id())
                      )
                    )
                )
              )
          $pol$
        ),

        -- public.lecture_secrets (strictly owner/admin ONLY)
        (
          'lecture_secrets',
          'lecture_secrets_owner_select',
          $pol$
            CREATE POLICY lecture_secrets_owner_select ON public.lecture_secrets
              FOR SELECT TO authenticated
              USING (
                (select private.is_super_admin())
                OR EXISTS (
                  SELECT 1 FROM public.lectures l
                  WHERE l.id = lecture_secrets.lecture_id
                    AND (
                      l.teacher_id = (select auth.uid())
                      OR (
                        (select private.current_app_role()) = 'school_admin'
                        AND l.school_id = (select private.current_school_id())
                      )
                    )
                )
              )
          $pol$
        ),
        (
          'lecture_secrets',
          'lecture_secrets_owner_mutate',
          $pol$
            CREATE POLICY lecture_secrets_owner_mutate ON public.lecture_secrets
              FOR ALL TO authenticated
              USING (
                (select private.is_super_admin())
                OR EXISTS (
                  SELECT 1 FROM public.lectures l
                  WHERE l.id = lecture_secrets.lecture_id
                    AND (
                      l.teacher_id = (select auth.uid())
                      OR (
                        (select private.current_app_role()) = 'school_admin'
                        AND l.school_id = (select private.current_school_id())
                      )
                    )
                )
              )
              WITH CHECK (
                (select private.is_super_admin())
                OR EXISTS (
                  SELECT 1 FROM public.lectures l
                  WHERE l.id = lecture_secrets.lecture_id
                    AND (
                      l.teacher_id = (select auth.uid())
                      OR (
                        (select private.current_app_role()) = 'school_admin'
                        AND l.school_id = (select private.current_school_id())
                      )
                    )
                )
              )
          $pol$
        ),

        -- public.lecture_access_grants (viewer reads own leases only)
        (
          'lecture_access_grants',
          'lecture_access_grants_select_own',
          $pol$
            CREATE POLICY lecture_access_grants_select_own ON public.lecture_access_grants
              FOR SELECT TO authenticated
              USING (user_id = (select auth.uid()) OR (select private.is_super_admin()))
          $pol$
        )
    ) AS p(tbl_name, pol_name, pol_sql)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_policy.tbl_name
        AND policyname = v_policy.pol_name
    ) THEN
      EXECUTE v_policy.pol_sql;
    END IF;
  END LOOP;
END $$;

-- 5. SECURITY DEFINER RPCs for Secret Lectures & Media Resolution
CREATE OR REPLACE FUNCTION public.set_lecture_secret_password(
  p_lecture_id uuid,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_caller_role public.user_role_enum;
  v_caller_school uuid;
  v_lecture RECORD;
  v_hash text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message_ar', 'يجب تسجيل الدخول أولاً.');
  END IF;

  IF pg_catalog.char_length(COALESCE(p_password, '')) < 4 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'weak_password', 'message_ar', 'يجب أن تكون كلمة المرور ٤ أحرف على الأقل.');
  END IF;

  SELECT role, school_id INTO v_caller_role, v_caller_school
  FROM public.profiles
  WHERE id = v_user_id AND is_active = true;

  SELECT id, school_id, teacher_id INTO v_lecture
  FROM public.lectures
  WHERE id = p_lecture_id;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found', 'message_ar', 'المحاضرة غير موجودة.');
  END IF;

  IF NOT (
    v_caller_role = 'super_admin'
    OR (v_caller_role = 'school_admin' AND v_caller_school = v_lecture.school_id)
    OR v_lecture.teacher_id = v_user_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden', 'message_ar', 'لا تملك صلاحية تعديل كلمة مرور هذه المحاضرة.');
  END IF;

  v_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  INSERT INTO public.lecture_secrets (lecture_id, password_hash)
  VALUES (p_lecture_id, v_hash)
  ON CONFLICT (lecture_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash;

  -- Revoke prior leases whenever the teacher rotates the password
  DELETE FROM public.lecture_access_grants WHERE lecture_id = p_lecture_id;

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_secret_lecture_preview(
  p_school_slug text,
  p_share_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_row RECORD;
  v_has_grant boolean := false;
BEGIN
  v_user_id := auth.uid();

  SELECT
    l.id,
    l.title_ar,
    l.description_ar,
    l.visibility,
    l.teacher_id,
    l.duration_minutes,
    l.file_size_bytes,
    l.mime_type,
    l.is_published,
    l.created_at,
    s.name_ar AS school_name_ar,
    s.slug AS school_slug,
    subj.name_ar AS subject_name_ar,
    tp.teacher_code,
    tp.specialty_ar
  INTO v_row
  FROM public.lectures l
  JOIN public.schools s ON s.id = l.school_id
  JOIN public.subjects subj ON subj.id = l.subject_id
  LEFT JOIN public.teacher_profiles tp ON tp.id = l.teacher_id
  WHERE s.slug = p_school_slug
    AND s.is_active = true
    AND l.share_token = p_share_token;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('found', false);
  END IF;

  IF NOT v_row.is_published AND v_user_id IS DISTINCT FROM v_row.teacher_id THEN
    RETURN pg_catalog.jsonb_build_object('found', false);
  END IF;

  IF v_user_id IS NOT NULL THEN
    IF v_user_id = v_row.teacher_id THEN
      v_has_grant := true;
    ELSIF v_row.visibility = 'secret' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.lecture_access_grants g
        WHERE g.lecture_id = v_row.id
          AND g.user_id = v_user_id
          AND g.expires_at > pg_catalog.now()
      ) INTO v_has_grant;
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'found', true,
    'lecture_id', v_row.id,
    'title_ar', v_row.title_ar,
    'description_ar', v_row.description_ar,
    'visibility', v_row.visibility::text,
    'duration_minutes', v_row.duration_minutes,
    'file_size_bytes', v_row.file_size_bytes,
    'mime_type', v_row.mime_type,
    'created_at', v_row.created_at,
    'school_name_ar', v_row.school_name_ar,
    'school_slug', v_row.school_slug,
    'subject_name_ar', v_row.subject_name_ar,
    'teacher_code', COALESCE(v_row.teacher_code, 'معلم المدرسة'),
    'specialty_ar', COALESCE(v_row.specialty_ar, v_row.subject_name_ar),
    'already_unlocked', v_has_grant
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_secret_lecture(
  p_school_slug text,
  p_share_token text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_lecture RECORD;
  v_stored_hash text;
  v_media RECORD;
BEGIN
  v_user_id := auth.uid();

  SELECT l.id, l.visibility, l.is_published, l.teacher_id
  INTO v_lecture
  FROM public.lectures l
  JOIN public.schools s ON s.id = l.school_id
  WHERE s.slug = p_school_slug
    AND s.is_active = true
    AND l.share_token = p_share_token;

  IF NOT FOUND OR (NOT v_lecture.is_published AND v_user_id IS DISTINCT FROM v_lecture.teacher_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found', 'message_ar', 'الرابط غير صحيح أو لم تعد المحاضرة متاحة.');
  END IF;

  SELECT ls.password_hash INTO v_stored_hash
  FROM public.lecture_secrets ls
  WHERE ls.lecture_id = v_lecture.id;

  IF v_lecture.visibility = 'secret' AND v_user_id IS DISTINCT FROM v_lecture.teacher_id THEN
    IF v_stored_hash IS NULL OR extensions.crypt(COALESCE(p_password, ''), v_stored_hash) <> v_stored_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_password', 'message_ar', 'كلمة المرور غير صحيحة. تأكد من الحروف وأعد المحاولة.');
    END IF;
  END IF;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.lecture_access_grants (lecture_id, user_id, expires_at)
    VALUES (v_lecture.id, v_user_id, pg_catalog.now() + interval '4 hours')
    ON CONFLICT (lecture_id, user_id) DO UPDATE
    SET expires_at = pg_catalog.now() + interval '4 hours';
  END IF;

  SELECT lm.storage_path, lm.external_video_url
  INTO v_media
  FROM public.lecture_media lm
  WHERE lm.lecture_id = v_lecture.id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'lecture_id', v_lecture.id,
    'storage_path', v_media.storage_path,
    'external_video_url', v_media.external_video_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_lecture_secret_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_lecture_secret_password(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_secret_lecture_preview(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_secret_lecture_preview(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.unlock_secret_lecture(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_secret_lecture(text, text, text) TO anon, authenticated;

-- 6. Private Storage Bucket 'lectures' & Granular storage.objects Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lectures',
  'lectures',
  false,
  52428800,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE
  v_pol record;
BEGIN
  FOR v_pol IN
    SELECT *
    FROM (
      VALUES
        (
          'lectures_storage_insert_teacher',
          $pol$
            CREATE POLICY lectures_storage_insert_teacher ON storage.objects
              FOR INSERT TO authenticated
              WITH CHECK (
                bucket_id = 'lectures'
                AND (
                  (select private.is_super_admin())
                  OR (
                    (select private.current_app_role()) = 'school_admin'
                    AND (storage.foldername(name))[1] = (select private.current_school_id())::text
                  )
                  OR (
                    (select private.current_app_role()) = 'teacher'
                    AND (storage.foldername(name))[1] = (select private.current_school_id())::text
                    AND (storage.foldername(name))[2] = (select auth.uid())::text
                    AND EXISTS (
                      SELECT 1 FROM public.teacher_profiles tp
                      WHERE tp.id = (select auth.uid())
                        AND tp.school_id = (select private.current_school_id())
                        AND tp.is_approved = true
                    )
                  )
                )
              )
          $pol$
        ),
        (
          'lectures_storage_update_owner',
          $pol$
            CREATE POLICY lectures_storage_update_owner ON storage.objects
              FOR UPDATE TO authenticated
              USING (
                bucket_id = 'lectures'
                AND (
                  (select private.is_super_admin())
                  OR (
                    (select private.current_app_role()) = 'school_admin'
                    AND (storage.foldername(name))[1] = (select private.current_school_id())::text
                  )
                  OR (
                    (select private.current_app_role()) = 'teacher'
                    AND (storage.foldername(name))[2] = (select auth.uid())::text
                  )
                )
              )
          $pol$
        ),
        (
          'lectures_storage_delete_owner',
          $pol$
            CREATE POLICY lectures_storage_delete_owner ON storage.objects
              FOR DELETE TO authenticated
              USING (
                bucket_id = 'lectures'
                AND (
                  (select private.is_super_admin())
                  OR (
                    (select private.current_app_role()) = 'school_admin'
                    AND (storage.foldername(name))[1] = (select private.current_school_id())::text
                  )
                  OR (
                    (select private.current_app_role()) = 'teacher'
                    AND (storage.foldername(name))[2] = (select auth.uid())::text
                  )
                )
              )
          $pol$
        ),
        (
          'lectures_storage_select_anon',
          $pol$
            CREATE POLICY lectures_storage_select_anon ON storage.objects
              FOR SELECT TO anon
              USING (
                bucket_id = 'lectures'
                AND EXISTS (
                  SELECT 1 FROM public.lecture_media lm
                  JOIN public.lectures l ON l.id = lm.lecture_id
                  JOIN public.schools s ON s.id = l.school_id
                  WHERE lm.storage_path = storage.objects.name
                    AND l.is_published = true
                    AND l.visibility = 'public'
                    AND s.is_active = true
                )
              )
          $pol$
        ),
        (
          'lectures_storage_select_authenticated',
          $pol$
            CREATE POLICY lectures_storage_select_authenticated ON storage.objects
              FOR SELECT TO authenticated
              USING (
                bucket_id = 'lectures'
                AND (
                  (select private.is_super_admin())
                  OR (
                    (select private.current_app_role()) = 'school_admin'
                    AND (storage.foldername(name))[1] = (select private.current_school_id())::text
                  )
                  OR (
                    (select private.current_app_role()) = 'teacher'
                    AND (storage.foldername(name))[2] = (select auth.uid())::text
                  )
                  OR EXISTS (
                    SELECT 1 FROM public.lecture_media lm
                    JOIN public.lectures l ON l.id = lm.lecture_id
                    WHERE lm.storage_path = storage.objects.name
                      AND l.is_published = true
                      AND (
                        l.visibility = 'public'
                        OR (
                          l.visibility = 'attendees_only'
                          AND l.session_id IS NOT NULL
                          AND EXISTS (
                            SELECT 1 FROM public.bookings b
                            WHERE b.session_id = l.session_id
                              AND b.student_id = (select auth.uid())
                              AND b.status = 'checked_in'
                          )
                        )
                        OR (
                          l.visibility = 'secret'
                          AND EXISTS (
                            SELECT 1 FROM public.lecture_access_grants g
                            WHERE g.lecture_id = l.id
                              AND g.user_id = (select auth.uid())
                              AND g.expires_at > pg_catalog.now()
                          )
                        )
                      )
                  )
                )
              )
          $pol$
        )
    ) AS p(pol_name, pol_sql)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = v_pol.pol_name
    ) THEN
      EXECUTE v_pol.pol_sql;
    END IF;
  END LOOP;
END $$;

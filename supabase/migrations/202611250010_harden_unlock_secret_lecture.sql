-- 202611250010_harden_unlock_secret_lecture.sql
-- Ensures unlock_secret_lecture strictly enforces attendees_only attendance and
-- existing time-bounded secret access grants inside the database RPC.

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
  v_caller_role public.user_role_enum;
  v_caller_school uuid;
  v_lecture RECORD;
  v_stored_hash text;
  v_has_active_grant boolean := false;
  v_has_attendance boolean := false;
  v_is_admin boolean := false;
  v_media RECORD;
BEGIN
  v_user_id := auth.uid();

  SELECT l.id, l.school_id, l.session_id, l.visibility, l.is_published, l.teacher_id
  INTO v_lecture
  FROM public.lectures l
  JOIN public.schools s ON s.id = l.school_id
  WHERE s.slug = p_school_slug
    AND s.is_active = true
    AND l.share_token = p_share_token;

  IF NOT FOUND OR (NOT v_lecture.is_published AND v_user_id IS DISTINCT FROM v_lecture.teacher_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found', 'message_ar', 'الرابط غير صحيح أو لم تعد المحاضرة متاحة.');
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT role, school_id INTO v_caller_role, v_caller_school
    FROM public.profiles
    WHERE id = v_user_id AND is_active = true;

    v_is_admin := (
      v_caller_role = 'super_admin'
      OR (v_caller_role = 'school_admin' AND v_caller_school = v_lecture.school_id)
    );
  END IF;

  IF v_lecture.visibility = 'attendees_only' AND v_user_id IS DISTINCT FROM v_lecture.teacher_id AND NOT v_is_admin THEN
    IF v_user_id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message_ar', 'سجّل دخولك أولاً للتحقق من حضورك في الحصة.');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.session_id = v_lecture.session_id
        AND b.student_id = v_user_id
        AND b.status = 'checked_in'
    ) INTO v_has_attendance;

    IF NOT v_has_attendance THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'attendance_required', 'message_ar', 'هذه المحاضرة متاحة فقط للطلاب الذين سجل المعلم حضورهم في الحصة.');
    END IF;
  END IF;

  IF v_lecture.visibility = 'secret' AND v_user_id IS DISTINCT FROM v_lecture.teacher_id AND NOT v_is_admin THEN
    IF v_user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.lecture_access_grants g
        WHERE g.lecture_id = v_lecture.id
          AND g.user_id = v_user_id
          AND g.expires_at > pg_catalog.now()
      ) INTO v_has_active_grant;
    END IF;

    IF NOT v_has_active_grant THEN
      SELECT ls.password_hash INTO v_stored_hash
      FROM public.lecture_secrets ls
      WHERE ls.lecture_id = v_lecture.id;

      IF v_stored_hash IS NULL OR extensions.crypt(COALESCE(p_password, ''), v_stored_hash) <> v_stored_hash THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_password', 'message_ar', 'كلمة المرور غير صحيحة. تأكد من الحروف وأعد المحاولة.');
      END IF;
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

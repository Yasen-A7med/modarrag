-- 202611250008_name_attendance_simplification.sql
-- Adds frictionless seat reservation (reserve_student_seat, no QR tokens) and
-- 1-tap teacher/admin name-based attendance check-off (mark_student_attendance).

CREATE OR REPLACE FUNCTION public.reserve_student_seat(
  p_session_id uuid,
  p_booking_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_profile record;
  v_session record;
  v_enrollment record;
  v_is_eligible boolean := false;
  v_overlap_booking_id uuid;
  v_existing_booking_id uuid;
  v_new_count integer;
  v_seat_seq integer;
  v_seat_number text;
  v_waitlist_pos integer;
  v_booking_id uuid;
BEGIN
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthenticated',
      'message_ar', 'يجب تسجيل الدخول أولاً لحجز مكانك.'
    );
  END IF;

  SELECT id, school_id, role, is_active
  INTO v_profile
  FROM public.profiles
  WHERE id = v_student_id;

  IF NOT FOUND OR NOT v_profile.is_active THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'profile_inactive',
      'message_ar', 'الحساب غير مفعل.'
    );
  END IF;

  IF v_profile.role <> 'student' THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'student_role_required',
      'message_ar', 'حجز الحصص متاح لحسابات الطلاب فقط.'
    );
  END IF;

  IF v_profile.school_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'onboarding_incomplete',
      'message_ar', 'يرجى اختيار مدرستك ومسارك الدراسي أولاً.'
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('student_booking:' || v_student_id::text)
  );

  SELECT
    s.id,
    s.school_id,
    s.subject_id,
    s.title_ar,
    s.starts_at,
    s.ends_at,
    s.max_capacity,
    s.booked_seats_count,
    s.status,
    subj.subject_type,
    subj.grade_id,
    subj.name_ar AS subject_name_ar
  INTO v_session
  FROM public.sessions s
  JOIN public.subjects subj ON subj.id = s.subject_id
  WHERE s.id = p_session_id
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'session_not_found',
      'message_ar', 'الحصة المطلوبة غير موجودة.'
    );
  END IF;

  IF v_session.school_id <> v_profile.school_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'cross_tenant_forbidden',
      'message_ar', 'لا يمكن حجز حصة في مدرسة أخرى.'
    );
  END IF;

  IF v_session.status NOT IN ('scheduled', 'full') OR v_session.starts_at <= pg_catalog.now() THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'session_not_bookable',
      'message_ar', 'الحجز غير متاح لهذه الحصة حالياً.'
    );
  END IF;

  SELECT
    e.id,
    e.grade_id,
    e.track_id,
    e.selected_elective_subject_id
  INTO v_enrollment
  FROM public.student_enrollments e
  WHERE e.student_id = v_student_id
    AND e.school_id = v_session.school_id
    AND e.grade_id = v_session.grade_id
    AND e.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'enrollment_missing',
      'message_ar', 'لا يوجد تسجيل مفعل لهذا الصف.'
    );
  END IF;

  IF v_session.subject_type = 'common' THEN
    v_is_eligible := true;
  ELSIF v_session.subject_type = 'track_core' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.track_subjects ts
      WHERE ts.track_id = v_enrollment.track_id
        AND ts.subject_id = v_session.subject_id
    ) INTO v_is_eligible;
  ELSIF v_session.subject_type = 'track_elective' THEN
    SELECT (
      v_enrollment.selected_elective_subject_id = v_session.subject_id
      AND EXISTS (
        SELECT 1
        FROM public.track_subjects ts
        WHERE ts.track_id = v_enrollment.track_id
          AND ts.subject_id = v_session.subject_id
      )
    ) INTO v_is_eligible;
  END IF;

  IF NOT v_is_eligible THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'ineligible_subject',
      'message_ar', 'هذه المادة غير مدرجة ضمن مسارك الدراسي.'
    );
  END IF;

  SELECT b.id
  INTO v_existing_booking_id
  FROM public.bookings b
  WHERE b.session_id = p_session_id
    AND b.student_id = v_student_id
    AND b.status IN ('confirmed', 'waitlisted', 'checked_in')
  LIMIT 1;

  IF v_existing_booking_id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'already_booked',
      'message_ar', 'اسمك مسجل بالفعل في هذه الحصة.'
    );
  END IF;

  SELECT ob.id
  INTO v_overlap_booking_id
  FROM public.bookings ob
  JOIN public.sessions os ON os.id = ob.session_id
  WHERE ob.student_id = v_student_id
    AND ob.status IN ('confirmed', 'checked_in')
    AND os.status IN ('scheduled', 'full', 'ongoing')
    AND pg_catalog.tstzrange(os.starts_at, os.ends_at, '[)')
        && pg_catalog.tstzrange(v_session.starts_at, v_session.ends_at, '[)')
  LIMIT 1;

  IF v_overlap_booking_id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'student_time_overlap',
      'message_ar', 'لديك حصة أخرى في نفس التوقيت.'
    );
  END IF;

  v_booking_id := COALESCE(p_booking_id, pg_catalog.gen_random_uuid());

  IF v_session.booked_seats_count < v_session.max_capacity AND v_session.status = 'scheduled' THEN
    v_new_count := v_session.booked_seats_count + 1;

    SELECT COALESCE(COUNT(*), 0) + 1
    INTO v_seat_seq
    FROM public.bookings b
    WHERE b.session_id = p_session_id
      AND b.seat_number IS NOT NULL;

    v_seat_number := 'S-' || pg_catalog.lpad(v_seat_seq::text, 3, '0');

    UPDATE public.sessions
    SET booked_seats_count = v_new_count,
        status = CASE
          WHEN v_new_count >= max_capacity THEN 'full'::public.session_status_enum
          ELSE status
        END
    WHERE id = p_session_id;

    INSERT INTO public.bookings (
      id,
      school_id,
      session_id,
      student_id,
      status,
      seat_number,
      qr_token_hash,
      qr_nonce
    ) VALUES (
      v_booking_id,
      v_session.school_id,
      p_session_id,
      v_student_id,
      'confirmed',
      v_seat_number,
      NULL,
      NULL
    );

    INSERT INTO public.notifications (
      school_id,
      recipient_id,
      type,
      title_ar,
      body_ar,
      metadata
    ) VALUES (
      v_session.school_id,
      v_student_id,
      'booking_confirmed',
      'تم تسجيل اسمك في الحصة',
      'تم تأكيد مكانك في حصة ' || v_session.subject_name_ar || ' (مقعد ' || v_seat_number || ').',
      pg_catalog.jsonb_build_object(
        'booking_id', v_booking_id,
        'session_id', p_session_id,
        'seat_number', v_seat_number
      )
    );

    INSERT INTO public.audit_logs (
      school_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      v_session.school_id,
      v_student_id,
      'booking_confirmed',
      'booking',
      v_booking_id,
      pg_catalog.jsonb_build_object(
        'session_id', p_session_id,
        'seat_number', v_seat_number
      )
    );

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'status', 'confirmed',
      'booking_id', v_booking_id,
      'seat_number', v_seat_number,
      'waitlist_position', null,
      'booked_seats_count', v_new_count,
      'max_capacity', v_session.max_capacity
    );
  ELSE
    SELECT COALESCE(MAX(b.waitlist_position), 0) + 1
    INTO v_waitlist_pos
    FROM public.bookings b
    WHERE b.session_id = p_session_id
      AND b.status = 'waitlisted';

    INSERT INTO public.bookings (
      id,
      school_id,
      session_id,
      student_id,
      status,
      waitlist_position,
      qr_token_hash,
      qr_nonce
    ) VALUES (
      v_booking_id,
      v_session.school_id,
      p_session_id,
      v_student_id,
      'waitlisted',
      v_waitlist_pos,
      NULL,
      NULL
    );

    INSERT INTO public.notifications (
      school_id,
      recipient_id,
      type,
      title_ar,
      body_ar,
      metadata
    ) VALUES (
      v_session.school_id,
      v_student_id,
      'waitlist_joined',
      'إضافة إلى قائمة الانتظار',
      'ترتيبك رقم ' || v_waitlist_pos || ' في قائمة انتظار حصة ' || v_session.subject_name_ar || '.',
      pg_catalog.jsonb_build_object(
        'booking_id', v_booking_id,
        'session_id', p_session_id,
        'waitlist_position', v_waitlist_pos
      )
    );

    INSERT INTO public.audit_logs (
      school_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      v_session.school_id,
      v_student_id,
      'waitlist_joined',
      'booking',
      v_booking_id,
      pg_catalog.jsonb_build_object(
        'session_id', p_session_id,
        'waitlist_position', v_waitlist_pos
      )
    );

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'status', 'waitlisted',
      'booking_id', v_booking_id,
      'seat_number', null,
      'waitlist_position', v_waitlist_pos,
      'booked_seats_count', v_session.booked_seats_count,
      'max_capacity', v_session.max_capacity
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_student_attendance(
  p_booking_id uuid,
  p_present boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor record;
  v_booking record;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthenticated',
      'message_ar', 'يجب تسجيل الدخول أولاً.'
    );
  END IF;

  SELECT id, school_id, role, is_active
  INTO v_actor
  FROM public.profiles
  WHERE id = v_actor_id;

  IF NOT FOUND OR NOT v_actor.is_active
     OR v_actor.role NOT IN ('teacher', 'school_admin', 'super_admin') THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'message_ar', 'تحضير الطلاب متاح للمعلم أو إدارة المدرسة فقط.'
    );
  END IF;

  SELECT
    b.id,
    b.school_id,
    b.session_id,
    b.student_id,
    b.status,
    b.checked_in_at,
    s.teacher_id,
    s.status AS session_status,
    subj.name_ar AS subject_name_ar
  INTO v_booking
  FROM public.bookings b
  JOIN public.sessions s ON s.id = b.session_id
  JOIN public.subjects subj ON subj.id = s.subject_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'booking_not_found',
      'message_ar', 'سجل الطالب غير موجود.'
    );
  END IF;

  IF v_actor.role <> 'super_admin' AND v_booking.school_id <> v_actor.school_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'message_ar', 'لا تملك صلاحية التحضير في هذه المدرسة.'
    );
  END IF;

  IF v_actor.role = 'teacher' AND v_booking.teacher_id <> v_actor_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'message_ar', 'يمكنك تحضير طلاب حصصك فقط.'
    );
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'checked_in') THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_status',
      'message_ar', 'هذا الطالب ملغى أو مازال في قائمة الانتظار.'
    );
  END IF;

  IF p_present THEN
    IF v_booking.status = 'checked_in' THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true,
        'status', 'checked_in',
        'booking_id', v_booking.id,
        'session_id', v_booking.session_id,
        'student_id', v_booking.student_id,
        'checked_in_at', v_booking.checked_in_at
      );
    END IF;

    UPDATE public.bookings
    SET status = 'checked_in',
        checked_in_at = pg_catalog.now(),
        checked_in_by = v_actor_id
    WHERE id = v_booking.id
    RETURNING checked_in_at INTO v_booking.checked_in_at;

    INSERT INTO public.notifications (
      school_id,
      recipient_id,
      type,
      title_ar,
      body_ar,
      metadata
    ) VALUES (
      v_booking.school_id,
      v_booking.student_id,
      'checkin_confirmed',
      'تم تسجيل حضورك',
      'تم تسجيل حضورك في حصة ' || v_booking.subject_name_ar || '.',
      pg_catalog.jsonb_build_object(
        'booking_id', v_booking.id,
        'session_id', v_booking.session_id
      )
    );

    INSERT INTO public.audit_logs (
      school_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      v_booking.school_id,
      v_actor_id,
      'attendance_marked_present',
      'booking',
      v_booking.id,
      pg_catalog.jsonb_build_object(
        'session_id', v_booking.session_id,
        'student_id', v_booking.student_id
      )
    );

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'status', 'checked_in',
      'booking_id', v_booking.id,
      'session_id', v_booking.session_id,
      'student_id', v_booking.student_id,
      'checked_in_at', v_booking.checked_in_at
    );
  ELSE
    UPDATE public.bookings
    SET status = 'confirmed',
        checked_in_at = NULL,
        checked_in_by = NULL
    WHERE id = v_booking.id;

    INSERT INTO public.audit_logs (
      school_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      v_booking.school_id,
      v_actor_id,
      'attendance_unmarked',
      'booking',
      v_booking.id,
      pg_catalog.jsonb_build_object(
        'session_id', v_booking.session_id,
        'student_id', v_booking.student_id
      )
    );

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'status', 'confirmed',
      'booking_id', v_booking.id,
      'session_id', v_booking.session_id,
      'student_id', v_booking.student_id,
      'checked_in_at', null
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_student_seat(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_student_attendance(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_student_seat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_student_attendance(uuid, boolean) TO authenticated;

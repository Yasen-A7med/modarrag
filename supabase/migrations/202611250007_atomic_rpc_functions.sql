-- 202611250007_atomic_rpc_functions.sql
-- Concurrency-safe RPCs for seat booking, cancellation + SKIP LOCKED waitlist promotion,
-- atomic QR check-in verification, and student onboarding completion.

CREATE OR REPLACE FUNCTION public.book_student_seat(
  p_session_id uuid,
  p_qr_token_hash text,
  p_qr_nonce text,
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
      'message_ar', 'يجب تسجيل الدخول أولاً لحجز مقعد.'
    );
  END IF;

  IF p_qr_token_hash IS NULL OR pg_catalog.length(pg_catalog.btrim(p_qr_token_hash)) = 0
     OR p_qr_nonce IS NULL OR pg_catalog.length(pg_catalog.btrim(p_qr_nonce)) = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_qr_payload',
      'message_ar', 'بيانات التذكرة غير صالحة.'
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
      'message_ar', 'حجز المقاعد متاح لحسابات الطلاب فقط.'
    );
  END IF;

  IF v_profile.school_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'onboarding_incomplete',
      'message_ar', 'يرجى استكمال اختيار المدرسة والمسار الدراسي أولاً.'
    );
  END IF;

  -- Serialize concurrent booking attempts by the same student before locking session
  -- to guarantee consistent lock order and zero deadlocks.
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
      'message_ar', 'لا يمكن حجز حصة خارج مدرستك.'
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
      'message_ar', 'لا يوجد قيد دراسي مفعل لهذا الصف.'
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
      'message_ar', 'لديك حجز مسبق في هذه الحصة.'
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
      'message_ar', 'لديك حصة أخرى مؤكدة تتعارض مع هذا الموعد.'
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
      p_qr_token_hash,
      p_qr_nonce
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
      'تم تأكيد حجز المقعد',
      'تم حجز مقعدك (' || v_seat_number || ') في حصة ' || v_session.subject_name_ar || '.',
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
      p_qr_token_hash,
      p_qr_nonce
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

CREATE OR REPLACE FUNCTION public.cancel_student_booking(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id uuid;
  v_booking record;
  v_session record;
  v_waitlisted record;
BEGIN
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthenticated',
      'message_ar', 'يجب تسجيل الدخول أولاً.'
    );
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'booking_not_found',
      'message_ar', 'الحجز غير موجود.'
    );
  END IF;

  IF v_booking.student_id <> v_student_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'message_ar', 'غير مصرح لك بإلغاء هذا الحجز.'
    );
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'waitlisted') THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'cannot_cancel_status',
      'message_ar', 'لا يمكن إلغاء هذا الحجز في حالته الحالية.'
    );
  END IF;

  SELECT s.*, subj.name_ar AS subject_name_ar
  INTO v_session
  FROM public.sessions s
  JOIN public.subjects subj ON subj.id = s.subject_id
  WHERE s.id = v_booking.session_id
  FOR UPDATE OF s;

  UPDATE public.bookings
  SET status = 'cancelled_by_student',
      waitlist_position = NULL,
      cancelled_at = pg_catalog.now()
  WHERE id = p_booking_id;

  IF v_booking.status = 'waitlisted' THEN
    UPDATE public.bookings
    SET waitlist_position = waitlist_position - 1
    WHERE session_id = v_booking.session_id
      AND status = 'waitlisted'
      AND waitlist_position > COALESCE(v_booking.waitlist_position, 0);

    INSERT INTO public.audit_logs (
      school_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      v_booking.school_id,
      v_student_id,
      'waitlist_booking_cancelled',
      'booking',
      p_booking_id,
      pg_catalog.jsonb_build_object('session_id', v_booking.session_id)
    );

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'cancelled_booking_id', p_booking_id,
      'promoted_booking_id', null
    );
  END IF;

  -- Confirmed booking cancelled: attempt FIFO promotion with FOR UPDATE SKIP LOCKED
  IF v_session.status IN ('scheduled', 'full') THEN
    SELECT w.*
    INTO v_waitlisted
    FROM public.bookings w
    WHERE w.session_id = v_session.id
      AND w.status = 'waitlisted'
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings ob
        JOIN public.sessions os ON os.id = ob.session_id
        WHERE ob.student_id = w.student_id
          AND ob.status IN ('confirmed', 'checked_in')
          AND os.status IN ('scheduled', 'full', 'ongoing')
          AND pg_catalog.tstzrange(os.starts_at, os.ends_at, '[)')
              && pg_catalog.tstzrange(v_session.starts_at, v_session.ends_at, '[)')
      )
    ORDER BY w.waitlist_position ASC NULLS LAST, w.booked_at ASC
    LIMIT 1
    FOR UPDATE OF w SKIP LOCKED;

    IF FOUND THEN
      UPDATE public.bookings
      SET status = 'confirmed',
          waitlist_position = NULL,
          seat_number = COALESCE(seat_number, v_booking.seat_number),
          promoted_at = pg_catalog.now()
      WHERE id = v_waitlisted.id;

      UPDATE public.bookings
      SET waitlist_position = waitlist_position - 1
      WHERE session_id = v_session.id
        AND status = 'waitlisted'
        AND waitlist_position > COALESCE(v_waitlisted.waitlist_position, 0);

      INSERT INTO public.notifications (
        school_id,
        recipient_id,
        type,
        title_ar,
        body_ar,
        metadata
      ) VALUES (
        v_session.school_id,
        v_waitlisted.student_id,
        'waitlist_promoted',
        'تمت ترقيتك لمقعد مؤكد',
        'أصبح مقعدك مؤكداً الآن في حصة ' || v_session.subject_name_ar || ' بدلاً من قائمة الانتظار.',
        pg_catalog.jsonb_build_object(
          'booking_id', v_waitlisted.id,
          'session_id', v_session.id,
          'seat_number', COALESCE(v_waitlisted.seat_number, v_booking.seat_number)
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
        'booking_cancelled_and_waitlist_promoted',
        'booking',
        p_booking_id,
        pg_catalog.jsonb_build_object(
          'session_id', v_session.id,
          'promoted_booking_id', v_waitlisted.id,
          'promoted_student_id', v_waitlisted.student_id
        )
      );

      RETURN pg_catalog.jsonb_build_object(
        'ok', true,
        'cancelled_booking_id', p_booking_id,
        'promoted_booking_id', v_waitlisted.id,
        'promoted_student_id', v_waitlisted.student_id
      );
    END IF;
  END IF;

  -- No eligible waitlisted booking found; release seat count
  UPDATE public.sessions
  SET booked_seats_count = GREATEST(booked_seats_count - 1, 0),
      status = CASE
        WHEN status = 'full' AND (booked_seats_count - 1) < max_capacity
          THEN 'scheduled'::public.session_status_enum
        ELSE status
      END
  WHERE id = v_session.id;

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
    'booking_cancelled',
    'booking',
    p_booking_id,
    pg_catalog.jsonb_build_object('session_id', v_session.id)
  );

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cancelled_booking_id', p_booking_id,
    'promoted_booking_id', null
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_and_checkin_qr(
  p_booking_id uuid,
  p_session_id uuid,
  p_qr_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scanner_id uuid;
  v_scanner record;
  v_updated record;
  v_existing record;
BEGIN
  v_scanner_id := auth.uid();
  IF v_scanner_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'unauthenticated',
      'code', 'unauthenticated',
      'message_ar', 'يجب تسجيل الدخول لتشغيل الماسح الضوئي.'
    );
  END IF;

  SELECT id, school_id, role, is_active
  INTO v_scanner
  FROM public.profiles
  WHERE id = v_scanner_id;

  IF NOT FOUND OR NOT v_scanner.is_active
     OR v_scanner.role NOT IN ('gate_scanner', 'school_admin', 'teacher', 'super_admin') THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'forbidden',
      'code', 'forbidden',
      'message_ar', 'غير مصرح لهذا الحساب بالتحقق من تذاكر الدخول.'
    );
  END IF;

  IF p_qr_token_hash IS NULL OR pg_catalog.length(pg_catalog.btrim(p_qr_token_hash)) = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'invalid_token',
      'code', 'invalid_token',
      'message_ar', 'رمز التحقق غير صالح.'
    );
  END IF;

  -- Single atomic UPDATE ensuring exact confirmed -> checked_in transition
  UPDATE public.bookings b
  SET status = 'checked_in',
      checked_in_at = pg_catalog.now(),
      checked_in_by = v_scanner_id
  FROM public.sessions s
  WHERE b.id = p_booking_id
    AND b.session_id = p_session_id
    AND s.id = b.session_id
    AND b.qr_token_hash = p_qr_token_hash
    AND b.status = 'confirmed'
    AND s.status IN ('scheduled', 'full', 'ongoing')
    AND (
      v_scanner.role = 'super_admin'
      OR b.school_id = v_scanner.school_id
    )
    AND (
      v_scanner.role <> 'teacher'
      OR s.teacher_id = v_scanner_id
    )
  RETURNING b.id, b.school_id, b.session_id, b.student_id, b.seat_number, b.checked_in_at
  INTO v_updated;

  IF FOUND THEN
    INSERT INTO public.notifications (
      school_id,
      recipient_id,
      type,
      title_ar,
      body_ar,
      metadata
    ) VALUES (
      v_updated.school_id,
      v_updated.student_id,
      'checkin_confirmed',
      'تم تسجيل الحضور',
      'تم مسح تذكرتك وتسجيل حضورك في المقعد ' || COALESCE(v_updated.seat_number, '-') || '.',
      pg_catalog.jsonb_build_object(
        'booking_id', v_updated.id,
        'session_id', v_updated.session_id,
        'checked_in_at', v_updated.checked_in_at
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
      v_updated.school_id,
      v_scanner_id,
      'qr_checked_in',
      'booking',
      v_updated.id,
      pg_catalog.jsonb_build_object(
        'session_id', v_updated.session_id,
        'student_id', v_updated.student_id
      )
    );

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'result', 'checked_in',
      'booking_id', v_updated.id,
      'session_id', v_updated.session_id,
      'student_id', v_updated.student_id,
      'seat_number', v_updated.seat_number,
      'checked_in_at', v_updated.checked_in_at
    );
  END IF;

  -- Distinguish exact failure mode when atomic UPDATE matched 0 rows
  SELECT b.id, b.school_id, b.session_id, b.status, b.qr_token_hash, b.checked_in_at
  INTO v_existing
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND (v_scanner.role = 'super_admin' OR b.school_id = v_scanner.school_id);

  IF NOT FOUND OR v_existing.qr_token_hash IS DISTINCT FROM p_qr_token_hash THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'invalid_token',
      'code', 'invalid_token',
      'message_ar', 'تذكرة غير صالحة أو مزورة.'
    );
  END IF;

  IF v_existing.session_id <> p_session_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'wrong_session',
      'code', 'wrong_session',
      'actual_session_id', v_existing.session_id,
      'message_ar', 'هذه التذكرة تخص قاعة أو حصة أخرى.'
    );
  END IF;

  IF v_existing.status = 'checked_in' THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'already_checked_in',
      'code', 'already_checked_in',
      'checked_in_at', v_existing.checked_in_at,
      'message_ar', 'تم استخدام هذه التذكرة مسبقاً.'
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', false,
    'result', 'cancelled',
    'code', 'booking_not_confirmed',
    'status', v_existing.status,
    'message_ar', 'التذكرة ملغاة أو في قائمة الانتظار.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_student_onboarding(
  p_school_id uuid,
  p_full_name text,
  p_phone text,
  p_grade_id uuid,
  p_track_id uuid,
  p_selected_elective_subject_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_school_active boolean;
  v_grade_valid boolean;
  v_track_valid boolean;
  v_requires_elective boolean;
  v_elective_valid boolean;
  v_enrollment_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'unauthenticated',
      'message_ar', 'يجب تسجيل الدخول أولاً.'
    );
  END IF;

  SELECT is_active INTO v_school_active
  FROM public.schools
  WHERE id = p_school_id;

  IF NOT COALESCE(v_school_active, false) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_school',
      'message_ar', 'المدرسة المختارة غير متاحة.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.academic_grades g
    WHERE g.id = p_grade_id AND g.school_id = p_school_id AND g.is_active = true
  ) INTO v_grade_valid;

  IF NOT v_grade_valid THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_grade',
      'message_ar', 'الصف الدراسي غير متاح في هذه المدرسة.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.academic_tracks t
    WHERE t.id = p_track_id
      AND t.school_id = p_school_id
      AND t.grade_id = p_grade_id
      AND t.is_active = true
  ) INTO v_track_valid;

  IF NOT v_track_valid THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'invalid_track',
      'message_ar', 'المسار الدراسي غير متاح لهذا الصف.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.track_subjects ts
    JOIN public.subjects s ON s.id = ts.subject_id
    WHERE ts.track_id = p_track_id
      AND s.subject_type = 'track_elective'
      AND s.is_active = true
  ) INTO v_requires_elective;

  IF v_requires_elective THEN
    IF p_selected_elective_subject_id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false,
        'code', 'elective_required',
        'message_ar', 'يرجى اختيار اللغة الثانية الخاصة بهذا المسار.'
      );
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.track_subjects ts
      JOIN public.subjects s ON s.id = ts.subject_id
      WHERE ts.track_id = p_track_id
        AND ts.subject_id = p_selected_elective_subject_id
        AND s.subject_type = 'track_elective'
        AND s.is_active = true
    ) INTO v_elective_valid;

    IF NOT v_elective_valid THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false,
        'code', 'invalid_elective',
        'message_ar', 'المادة الاختيارية غير مطابقة للمسار المختار.'
      );
    END IF;
  END IF;

  INSERT INTO public.profiles (id, school_id, role, full_name, phone)
  VALUES (v_user_id, p_school_id, 'student', pg_catalog.btrim(p_full_name), p_phone)
  ON CONFLICT (id) DO UPDATE
  SET school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id),
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone;

  UPDATE public.student_enrollments
  SET is_active = false
  WHERE student_id = v_user_id
    AND is_active = true;

  INSERT INTO public.student_enrollments (
    school_id,
    student_id,
    grade_id,
    track_id,
    selected_elective_subject_id,
    academic_year,
    is_active
  ) VALUES (
    p_school_id,
    v_user_id,
    p_grade_id,
    p_track_id,
    CASE WHEN v_requires_elective THEN p_selected_elective_subject_id ELSE NULL END,
    '2026-2027',
    true
  )
  RETURNING id INTO v_enrollment_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'enrollment_id', v_enrollment_id,
    'school_id', p_school_id,
    'grade_id', p_grade_id,
    'track_id', p_track_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.book_student_seat(uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_student_booking(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_and_checkin_qr(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_student_onboarding(uuid, text, text, uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.book_student_seat(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_student_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_checkin_qr(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_onboarding(uuid, text, text, uuid, uuid, uuid) TO authenticated;

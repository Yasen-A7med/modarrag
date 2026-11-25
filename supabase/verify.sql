-- verify.sql
-- Empirical database verification suite for Modarrag.
-- Runs schema, RLS, FK index, GiST overlap rejection, track/elective eligibility,
-- waitlist auto-promotion (SKIP LOCKED), and atomic QR check-in verification inside a
-- rolled-back transaction so seed state remains clean.

-- 1. Static schema, RLS, and FK index checks
DO $$
DECLARE
  v_table_count integer;
  v_unforced_rls_count integer;
  v_unindexed_fk_count integer;
  v_insecure_policy_count integer;
BEGIN
  SELECT count(*) INTO v_table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'schools', 'profiles', 'academic_grades', 'academic_tracks', 'subjects',
      'track_subjects', 'student_enrollments', 'teacher_profiles', 'teacher_subjects',
      'halls', 'session_series', 'sessions', 'bookings', 'notifications', 'audit_logs'
    );

  IF v_table_count <> 15 THEN
    RAISE EXCEPTION 'Expected 15 public tables, found %', v_table_count;
  END IF;

  SELECT count(*) INTO v_unforced_rls_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);

  IF v_unforced_rls_count <> 0 THEN
    RAISE EXCEPTION 'Found % public tables without ENABLE + FORCE RLS', v_unforced_rls_count;
  END IF;

  SELECT count(*) INTO v_unindexed_fk_count
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE n.nspname = 'public'
    AND c.contype = 'f'
    AND NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = c.conrelid
        AND i.indkey[0] = a.attnum
    );

  IF v_unindexed_fk_count <> 0 THEN
    RAISE EXCEPTION 'Found % unindexed foreign keys in public schema', v_unindexed_fk_count;
  END IF;

  SELECT count(*) INTO v_insecure_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual ILIKE '%user_metadata%'
      OR with_check ILIKE '%user_metadata%'
      OR 'public' = ANY (roles)
      OR (
        'anon' = ANY (roles)
        AND NOT (
          cmd = 'SELECT'
          AND tablename IN ('schools', 'academic_grades', 'academic_tracks', 'subjects', 'track_subjects')
        )
      )
    );

  IF v_insecure_policy_count <> 0 THEN
    RAISE EXCEPTION 'Found % RLS policies violating auth role or user_metadata rules', v_insecure_policy_count;
  END IF;

  RAISE NOTICE 'PASS [1/4]: 15 tables, forced RLS, all FKs indexed, zero insecure policies.';
END $$;

-- 2. Functional atomic verification inside a rolled-back transaction
BEGIN;

DO $$
DECLARE
  v_school_id uuid;
  v_hall_cs uuid;
  v_hall_1 uuid;
  v_teacher_101 uuid := '66666666-6666-4666-8666-666666666611';
  v_teacher_102 uuid := '66666666-6666-4666-8666-666666666612';
  v_scanner_id uuid := '66666666-6666-4666-8666-666666666602';
  v_student_eng uuid := '66666666-6666-4666-8666-666666666621';
  v_student_art uuid := '66666666-6666-4666-8666-666666666622';
  v_subj_prog uuid;
  v_subj_phys uuid;
  v_subj_arabic uuid;
  v_subj_ital uuid;
  v_subj_fren uuid;
  v_sess_prog uuid := '77777777-7777-4777-8777-777777777701';
  v_sess_arabic uuid := '77777777-7777-4777-8777-777777777702';
  v_sess_phys uuid := '77777777-7777-4777-8777-777777777703';
  v_sess_ital uuid := '88888888-8888-4888-8888-888888888801';
  v_sess_fren uuid := '88888888-8888-4888-8888-888888888802';
  v_sess_cap10 uuid := '88888888-8888-4888-8888-888888888803';
  v_base_day timestamptz;
  v_res jsonb;
  v_b1 uuid := '99999999-9999-4999-8999-999999999901';
  v_b2 uuid;
  v_b3 uuid;
  v_promoted_id uuid;
  v_notif_exists boolean;
  v_hash1 text := repeat('a', 64);
  v_hash2 text := repeat('b', 64);
  v_conflict_caught boolean := false;
BEGIN
  SELECT id INTO v_school_id FROM public.schools WHERE slug = 'ali-bin-abi-talib';
  SELECT id INTO v_hall_cs FROM public.halls WHERE school_id = v_school_id AND code = 'CS-LAB';
  SELECT id INTO v_hall_1 FROM public.halls WHERE school_id = v_school_id AND code = 'HALL-1';
  SELECT id INTO v_subj_prog FROM public.subjects WHERE school_id = v_school_id AND code = 'PROGRAMMING';
  SELECT id INTO v_subj_phys FROM public.subjects WHERE school_id = v_school_id AND code = 'PHYSICS';
  SELECT id INTO v_subj_arabic FROM public.subjects WHERE school_id = v_school_id AND code = 'ARABIC_LANG';
  SELECT id INTO v_subj_ital FROM public.subjects WHERE school_id = v_school_id AND code = 'ITALIAN_LANG';
  SELECT id INTO v_subj_fren FROM public.subjects WHERE school_id = v_school_id AND code = 'FRENCH_LANG';

  SELECT starts_at INTO v_base_day FROM public.sessions WHERE id = v_sess_prog;

  -- Test 2a: Hall overlap within 15-minute buffer must fail with SQLSTATE 23P01
  BEGIN
    INSERT INTO public.sessions (
      school_id, hall_id, teacher_id, subject_id, title_ar,
      starts_at, ends_at, buffer_minutes, max_capacity
    ) VALUES (
      v_school_id, v_hall_cs, v_teacher_102, v_subj_phys, 'تعارض قاعة ضمن فترة التعقيم',
      v_base_day + interval '1 hour 35 minutes', v_base_day + interval '2 hours 35 minutes', 15, 25
    );
  EXCEPTION WHEN exclusion_violation THEN
    v_conflict_caught := true;
  END;

  IF NOT v_conflict_caught THEN
    RAISE EXCEPTION 'FAIL: Hall buffer overlap was not rejected by no_overlapping_hall_sessions';
  END IF;

  -- Test 2b: Teacher overlap in different hall at same time must fail with SQLSTATE 23P01
  v_conflict_caught := false;
  BEGIN
    INSERT INTO public.sessions (
      school_id, hall_id, teacher_id, subject_id, title_ar,
      starts_at, ends_at, buffer_minutes, max_capacity
    ) VALUES (
      v_school_id, v_hall_1, v_teacher_101, v_subj_prog, 'تعارض معلم في قاعة أخرى',
      v_base_day + interval '30 minutes', v_base_day + interval '1 hour 15 minutes', 15, 25
    );
  EXCEPTION WHEN exclusion_violation THEN
    v_conflict_caught := true;
  END;

  IF NOT v_conflict_caught THEN
    RAISE EXCEPTION 'FAIL: Teacher overlap was not rejected by no_overlapping_teacher_sessions';
  END IF;

  -- Create future elective sessions for eligibility verification (non-overlapping)
  INSERT INTO public.sessions (
    id, school_id, hall_id, teacher_id, subject_id, title_ar,
    starts_at, ends_at, buffer_minutes, max_capacity
  ) VALUES
    (v_sess_ital, v_school_id, v_hall_1, v_teacher_102, v_subj_ital, 'اللغة الإيطالية',
     v_base_day + interval '1 day', v_base_day + interval '1 day 1 hour', 15, 30),
    (v_sess_fren, v_school_id, v_hall_1, v_teacher_102, v_subj_fren, 'اللغة الفرنسية',
     v_base_day + interval '1 day 2 hours', v_base_day + interval '1 day 3 hours', 15, 30),
    (v_sess_cap10, v_school_id, v_hall_cs, v_teacher_101, v_subj_arabic, 'حصة كاملة السعة لاختبار الانتظار',
     v_base_day + interval '2 days', v_base_day + interval '2 days 1 hour', 15, 10);

  -- Artificially mark v_sess_cap10 as full (10/10) to test waitlist + promotion
  UPDATE public.sessions SET booked_seats_count = 10, status = 'full' WHERE id = v_sess_cap10;

  RAISE NOTICE 'PASS [2/4]: GiST hall buffer & teacher exclusion constraints rejected overlaps (23P01).';

  -- Test 3: Switch session context to Engineering student (S-201)
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_student_eng::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_student_eng::text, 'role', 'authenticated')::text,
    true
  );

  -- Allowed: ENG_TRACK core subject (PROGRAMMING)
  v_res := public.book_student_seat(v_sess_prog, v_hash1, 'nonce-1', v_b1);
  IF NOT (v_res ->> 'ok')::boolean OR (v_res ->> 'status') <> 'confirmed' THEN
    RAISE EXCEPTION 'FAIL: ENG_TRACK student could not book PROGRAMMING: %', v_res;
  END IF;

  -- Rejected: student time overlap with simultaneous ARABIC_LANG session
  v_res := public.book_student_seat(v_sess_arabic, v_hash2, 'nonce-2');
  IF (v_res ->> 'ok')::boolean OR (v_res ->> 'code') <> 'student_time_overlap' THEN
    RAISE EXCEPTION 'FAIL: Student time overlap was not rejected: %', v_res;
  END IF;

  -- Rejected: MED_TRACK subject (PHYSICS) for ENG_TRACK student
  v_res := public.book_student_seat(v_sess_phys, v_hash2, 'nonce-3');
  IF (v_res ->> 'ok')::boolean OR (v_res ->> 'code') <> 'ineligible_subject' THEN
    RAISE EXCEPTION 'FAIL: Ineligible track subject PHYSICS was allowed: %', v_res;
  END IF;

  -- Join waitlist on full common session
  v_res := public.book_student_seat(v_sess_cap10, v_hash2, 'nonce-4');
  IF NOT (v_res ->> 'ok')::boolean OR (v_res ->> 'status') <> 'waitlisted' THEN
    RAISE EXCEPTION 'FAIL: Expected waitlisted status on full session: %', v_res;
  END IF;
  v_b2 := (v_res ->> 'booking_id')::uuid;

  -- Switch to Arts student (S-202, elective ITALIAN_LANG)
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_student_art::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_student_art::text, 'role', 'authenticated')::text,
    true
  );

  v_res := public.book_student_seat(v_sess_ital, repeat('c', 64), 'nonce-5');
  IF NOT (v_res ->> 'ok')::boolean THEN
    RAISE EXCEPTION 'FAIL: Arts student could not book selected elective ITALIAN_LANG: %', v_res;
  END IF;

  v_res := public.book_student_seat(v_sess_fren, repeat('d', 64), 'nonce-6');
  IF (v_res ->> 'ok')::boolean OR (v_res ->> 'code') <> 'ineligible_subject' THEN
    RAISE EXCEPTION 'FAIL: Arts student was allowed non-selected elective FRENCH_LANG: %', v_res;
  END IF;

  RAISE NOTICE 'PASS [3/4]: Eligibility (common/track/elective), student overlap, and waitlist verified.';

  -- Test 4: Atomic QR Check-In + Duplicate Screenshot Rejection
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_scanner_id::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_scanner_id::text, 'role', 'authenticated')::text,
    true
  );

  v_res := public.verify_and_checkin_qr(v_b1, v_sess_prog, v_hash1);
  IF NOT (v_res ->> 'ok')::boolean OR (v_res ->> 'result') <> 'checked_in' THEN
    RAISE EXCEPTION 'FAIL: Valid QR check-in failed: %', v_res;
  END IF;

  v_res := public.verify_and_checkin_qr(v_b1, v_sess_prog, v_hash1);
  IF (v_res ->> 'ok')::boolean OR (v_res ->> 'result') <> 'already_checked_in' THEN
    RAISE EXCEPTION 'FAIL: Duplicate QR scan was not rejected: %', v_res;
  END IF;

  -- Verify confirmed booking cancellation auto-promotes #1 waitlisted via SKIP LOCKED + notification
  -- Set session v_sess_ital capacity to 10 with 9 pre-booked, let student_eng book #10 (confirmed),
  -- then make session full? Wait: student_eng is ENG_TRACK (ineligible for ITALIAN_LANG).
  -- Instead test on v_sess_cap10 (common ARABIC_LANG): set booked_seats_count = 9, status = 'scheduled'
  UPDATE public.sessions SET booked_seats_count = 9, status = 'scheduled' WHERE id = v_sess_cap10;

  -- Cancel earlier waitlist booking first so both students can test fresh confirmed + waitlisted promotion
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_student_eng::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_student_eng::text, 'role', 'authenticated')::text,
    true
  );
  v_res := public.cancel_student_booking(v_b2);
  IF NOT (v_res ->> 'ok')::boolean THEN
    RAISE EXCEPTION 'FAIL: Waitlist cancellation failed: %', v_res;
  END IF;

  -- Student ENG takes the last confirmed seat (10/10 -> status becomes 'full')
  v_res := public.book_student_seat(v_sess_cap10, repeat('e', 64), 'nonce-7');
  IF NOT (v_res ->> 'ok')::boolean OR (v_res ->> 'status') <> 'confirmed' THEN
    RAISE EXCEPTION 'FAIL: Expected confirmed last seat on v_sess_cap10: %', v_res;
  END IF;
  v_b2 := (v_res ->> 'booking_id')::uuid;

  -- Student ART joins waitlist #1 on now-full v_sess_cap10
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_student_art::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_student_art::text, 'role', 'authenticated')::text,
    true
  );
  v_res := public.book_student_seat(v_sess_cap10, repeat('f', 64), 'nonce-8');
  IF NOT (v_res ->> 'ok')::boolean OR (v_res ->> 'status') <> 'waitlisted' THEN
    RAISE EXCEPTION 'FAIL: Expected waitlisted #1 on full v_sess_cap10: %', v_res;
  END IF;
  v_b3 := (v_res ->> 'booking_id')::uuid;

  -- Student ENG cancels confirmed booking -> Student ART must be auto-promoted + notified
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_student_eng::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_student_eng::text, 'role', 'authenticated')::text,
    true
  );
  v_res := public.cancel_student_booking(v_b2);
  v_promoted_id := (v_res ->> 'promoted_booking_id')::uuid;
  IF NOT (v_res ->> 'ok')::boolean OR v_promoted_id IS DISTINCT FROM v_b3 THEN
    RAISE EXCEPTION 'FAIL: Expected auto-promotion of waitlist booking %, got %', v_b3, v_res;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE recipient_id = v_student_art
      AND type = 'waitlist_promoted'
  ) INTO v_notif_exists;
  IF NOT v_notif_exists THEN
    RAISE EXCEPTION 'FAIL: Waitlist promotion notification was not created';
  END IF;

  RAISE NOTICE 'PASS [4/4]: Atomic QR check-in, duplicate rejection, and confirmed->waitlist auto-promotion verified.';
END $$;

ROLLBACK;

-- seed.sql
-- Idempotent Tenant #1 seed data for Modarrag.
-- Privacy compliance: strictly ZERO personal people names anywhere in data or comments.
-- Uses anonymous role/code labels only.

DO $$
DECLARE
  v_school_id uuid := '11111111-1111-4111-8111-111111111101';
  v_grade_id uuid := '22222222-2222-4222-8222-222222222201';

  v_track_eng uuid := '33333333-3333-4333-8333-333333333301';
  v_track_med uuid := '33333333-3333-4333-8333-333333333302';
  v_track_bus uuid := '33333333-3333-4333-8333-333333333303';
  v_track_art uuid := '33333333-3333-4333-8333-333333333304';

  v_subj_arabic uuid := '44444444-4444-4444-8444-444444444401';
  v_subj_english uuid := '44444444-4444-4444-8444-444444444402';
  v_subj_history uuid := '44444444-4444-4444-8444-444444444403';
  v_subj_finance uuid := '44444444-4444-4444-8444-444444444404';
  v_subj_prog uuid := '44444444-4444-4444-8444-444444444405';
  v_subj_chem uuid := '44444444-4444-4444-8444-444444444406';
  v_subj_math uuid := '44444444-4444-4444-8444-444444444407';
  v_subj_phys uuid := '44444444-4444-4444-8444-444444444408';
  v_subj_biz uuid := '44444444-4444-4444-8444-444444444409';
  v_subj_acct uuid := '44444444-4444-4444-8444-444444444410';
  v_subj_psych uuid := '44444444-4444-4444-8444-444444444411';
  v_subj_ital uuid := '44444444-4444-4444-8444-444444444412';
  v_subj_fren uuid := '44444444-4444-4444-8444-444444444413';
  v_subj_germ uuid := '44444444-4444-4444-8444-444444444414';

  v_hall_1 uuid := '55555555-5555-4555-8555-555555555501';
  v_hall_2 uuid := '55555555-5555-4555-8555-555555555502';
  v_hall_3 uuid := '55555555-5555-4555-8555-555555555503';
  v_hall_4 uuid := '55555555-5555-4555-8555-555555555504';

  v_uid_super_admin uuid := '66666666-6666-4666-8666-666666666600';
  v_uid_school_admin uuid := '66666666-6666-4666-8666-666666666601';
  v_uid_teacher_101 uuid := '66666666-6666-4666-8666-666666666611';
  v_uid_teacher_102 uuid := '66666666-6666-4666-8666-666666666612';
  v_uid_teacher_103 uuid := '66666666-6666-4666-8666-666666666613';
  v_uid_teacher_104 uuid := '66666666-6666-4666-8666-666666666614';
  v_uid_student_201 uuid := '66666666-6666-4666-8666-666666666621';
  v_uid_student_202 uuid := '66666666-6666-4666-8666-666666666622';

  v_sess_1 uuid := '77777777-7777-4777-8777-777777777701';
  v_sess_2 uuid := '77777777-7777-4777-8777-777777777702';
  v_sess_3 uuid := '77777777-7777-4777-8777-777777777703';
  v_sess_4 uuid := '77777777-7777-4777-8777-777777777704';

  v_base_day timestamptz := pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE 'Africa/Cairo') AT TIME ZONE 'Africa/Cairo' + interval '2 days';
  v_demo_password_hash text;
  v_demo_user record;
BEGIN
  SET LOCAL search_path = public, extensions;
  v_demo_password_hash := crypt('Modarrag@2026!', gen_salt('bf'));

  -- 1. Tenant #1 School
  INSERT INTO public.schools (
    id, slug, name_ar, name_en, governorate, directorate,
    logo_url, brand_color_hex, default_buffer_minutes, is_active
  ) VALUES (
    v_school_id,
    'ali-bin-abi-talib',
    'مدرسة علي بن أبي طالب الثانوية بنين',
    'Ali Ibn Abi Talib Boys Secondary School',
    'القاهرة',
    'إدارة المرج التعليمية',
    '/tenants/ali-bin-abi-talib/logo.svg',
    '#1E3A8A',
    15,
    true
  )
  ON CONFLICT (slug) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    default_buffer_minutes = EXCLUDED.default_buffer_minutes,
    logo_url = EXCLUDED.logo_url;

  SELECT id INTO v_school_id FROM public.schools WHERE slug = 'ali-bin-abi-talib';

  -- 2. Grade SEC_2_BACC
  INSERT INTO public.academic_grades (
    id, school_id, code, name_ar, name_en, sort_order, is_active
  ) VALUES (
    v_grade_id,
    v_school_id,
    'SEC_2_BACC',
    'الصف الثاني الثانوي — نظام البكالوريا',
    'Grade 11 — 2nd Secondary Baccalaureate',
    1,
    true
  )
  ON CONFLICT (school_id, code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en;

  SELECT id INTO v_grade_id FROM public.academic_grades WHERE school_id = v_school_id AND code = 'SEC_2_BACC';

  -- 3. Four Specialized Tracks
  INSERT INTO public.academic_tracks (
    id, school_id, grade_id, code, name_ar, name_en, color_hex, icon_key, sort_order, is_active
  ) VALUES
    (v_track_eng, v_school_id, v_grade_id, 'ENG_TRACK', 'مسار الهندسة', 'Engineering Track', '#2563EB', 'cpu', 1, true),
    (v_track_med, v_school_id, v_grade_id, 'MED_TRACK', 'مسار طب وعلوم الحياة', 'Medicine & Life Sciences Track', '#059669', 'microscope', 2, true),
    (v_track_bus, v_school_id, v_grade_id, 'BUS_TRACK', 'مسار الأعمال', 'Business Track', '#D97706', 'briefcase', 3, true),
    (v_track_art, v_school_id, v_grade_id, 'ART_TRACK', 'مسار الآداب والفنون', 'Arts & Humanities Track', '#7C3AED', 'book-open', 4, true)
  ON CONFLICT (school_id, grade_id, code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    color_hex = EXCLUDED.color_hex;

  SELECT id INTO v_track_eng FROM public.academic_tracks WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'ENG_TRACK';
  SELECT id INTO v_track_med FROM public.academic_tracks WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'MED_TRACK';
  SELECT id INTO v_track_bus FROM public.academic_tracks WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'BUS_TRACK';
  SELECT id INTO v_track_art FROM public.academic_tracks WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'ART_TRACK';

  -- 4. Subjects (4 Common + 7 Track Core + 3 Second-Language Electives)
  INSERT INTO public.subjects (
    id, school_id, grade_id, code, name_ar, name_en, subject_type, elective_group_code, color_hex, is_active
  ) VALUES
    (v_subj_arabic,  v_school_id, v_grade_id, 'ARABIC_LANG',        'اللغة العربية',     'Arabic Language',      'common',         NULL,          '#1E3A8A', true),
    (v_subj_english, v_school_id, v_grade_id, 'ENGLISH_LANG',       'اللغة الإنجليزية',  'English Language',     'common',         NULL,          '#0F766E', true),
    (v_subj_history, v_school_id, v_grade_id, 'HISTORY',            'التاريخ',           'History',              'common',         NULL,          '#4338CA', true),
    (v_subj_finance, v_school_id, v_grade_id, 'FINANCIAL_LITERACY', 'الثقافة المالية',   'Financial Literacy',   'common',         NULL,          '#0369A1', true),
    (v_subj_prog,    v_school_id, v_grade_id, 'PROGRAMMING',        'برمجة',             'Programming',          'track_core',     NULL,          '#2563EB', true),
    (v_subj_chem,    v_school_id, v_grade_id, 'CHEMISTRY',          'كيمياء',            'Chemistry',            'track_core',     NULL,          '#1D4ED8', true),
    (v_subj_math,    v_school_id, v_grade_id, 'MATHEMATICS',        'رياضيات',           'Mathematics',          'track_core',     NULL,          '#059669', true),
    (v_subj_phys,    v_school_id, v_grade_id, 'PHYSICS',            'فيزياء',            'Physics',              'track_core',     NULL,          '#047857', true),
    (v_subj_biz,     v_school_id, v_grade_id, 'BUSINESS_ADMIN',     'إدارة أعمال',       'Business Admin',       'track_core',     NULL,          '#D97706', true),
    (v_subj_acct,    v_school_id, v_grade_id, 'ACCOUNTING',         'محاسبة',            'Accounting',           'track_core',     NULL,          '#B45309', true),
    (v_subj_psych,   v_school_id, v_grade_id, 'PSYCHOLOGY',         'علم نفس',           'Psychology',           'track_core',     NULL,          '#7C3AED', true),
    (v_subj_ital,    v_school_id, v_grade_id, 'ITALIAN_LANG',       'اللغة الإيطالية',   'Italian Language',     'track_elective', 'SECOND_LANG', '#6D28D9', true),
    (v_subj_fren,    v_school_id, v_grade_id, 'FRENCH_LANG',        'اللغة الفرنسية',    'French Language',      'track_elective', 'SECOND_LANG', '#6D28D9', true),
    (v_subj_germ,    v_school_id, v_grade_id, 'GERMAN_LANG',        'اللغة الألمانية',   'German Language',      'track_elective', 'SECOND_LANG', '#6D28D9', true)
  ON CONFLICT (school_id, grade_id, code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    subject_type = EXCLUDED.subject_type,
    elective_group_code = EXCLUDED.elective_group_code;

  SELECT id INTO v_subj_arabic  FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'ARABIC_LANG';
  SELECT id INTO v_subj_english FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'ENGLISH_LANG';
  SELECT id INTO v_subj_history FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'HISTORY';
  SELECT id INTO v_subj_finance FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'FINANCIAL_LITERACY';
  SELECT id INTO v_subj_prog    FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'PROGRAMMING';
  SELECT id INTO v_subj_chem    FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'CHEMISTRY';
  SELECT id INTO v_subj_math    FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'MATHEMATICS';
  SELECT id INTO v_subj_phys    FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'PHYSICS';
  SELECT id INTO v_subj_biz     FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'BUSINESS_ADMIN';
  SELECT id INTO v_subj_acct    FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'ACCOUNTING';
  SELECT id INTO v_subj_psych   FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'PSYCHOLOGY';
  SELECT id INTO v_subj_ital    FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'ITALIAN_LANG';
  SELECT id INTO v_subj_fren    FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'FRENCH_LANG';
  SELECT id INTO v_subj_germ    FROM public.subjects WHERE school_id = v_school_id AND grade_id = v_grade_id AND code = 'GERMAN_LANG';

  -- 5. Track-to-Subject Mappings
  INSERT INTO public.track_subjects (school_id, track_id, subject_id, is_mandatory, elective_group_code) VALUES
    (v_school_id, v_track_eng, v_subj_prog,  true,  NULL),
    (v_school_id, v_track_eng, v_subj_chem,  true,  NULL),
    (v_school_id, v_track_med, v_subj_math,  true,  NULL),
    (v_school_id, v_track_med, v_subj_phys,  true,  NULL),
    (v_school_id, v_track_bus, v_subj_biz,   true,  NULL),
    (v_school_id, v_track_bus, v_subj_acct,  true,  NULL),
    (v_school_id, v_track_art, v_subj_psych, true,  NULL),
    (v_school_id, v_track_art, v_subj_ital,  false, 'SECOND_LANG'),
    (v_school_id, v_track_art, v_subj_fren,  false, 'SECOND_LANG'),
    (v_school_id, v_track_art, v_subj_germ,  false, 'SECOND_LANG')
  ON CONFLICT (track_id, subject_id) DO NOTHING;

  -- 6. Four School Lecture Halls
  INSERT INTO public.halls (
    id, school_id, code, name_ar, building_ar, floor_label_ar, max_capacity, status, amenities
  ) VALUES
    (v_hall_1, v_school_id, 'HALL-1',   'مدرج ١',        'المبنى الرئيسي', 'الدور الأول',  60, 'active', '{"projector": true, "sound_system": true, "ac": true}'::jsonb),
    (v_hall_2, v_school_id, 'HALL-2',   'مدرج ٢',        'المبنى الرئيسي', 'الدور الثاني', 50, 'active', '{"projector": true, "sound_system": true, "ac": true}'::jsonb),
    (v_hall_3, v_school_id, 'ROOM-104', 'قاعة ١٠٤',      'جناح العلوم',    'الدور الأول',  35, 'active', '{"smart_board": true, "ac": true}'::jsonb),
    (v_hall_4, v_school_id, 'CS-LAB',   'معمل الحاسب',   'جناح المعامل',   'الدور الأرضي', 30, 'active', '{"workstations": 30, "projector": true}'::jsonb)
  ON CONFLICT (school_id, code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    max_capacity = EXCLUDED.max_capacity;

  SELECT id INTO v_hall_1 FROM public.halls WHERE school_id = v_school_id AND code = 'HALL-1';
  SELECT id INTO v_hall_2 FROM public.halls WHERE school_id = v_school_id AND code = 'HALL-2';
  SELECT id INTO v_hall_3 FROM public.halls WHERE school_id = v_school_id AND code = 'ROOM-104';
  SELECT id INTO v_hall_4 FROM public.halls WHERE school_id = v_school_id AND code = 'CS-LAB';

  -- 7. Anonymous Role/Code Demo Users (auth.users + auth.identities + profiles)
  -- Demo password for all seeded demo role accounts: Modarrag@2026!
  FOR v_demo_user IN
    SELECT *
    FROM (
      VALUES
        (v_uid_super_admin,  'super-admin-sa001@modarrag.app',                  pg_catalog.jsonb_build_object('app_role', 'super_admin')),
        (v_uid_school_admin, 'admin-ad101@ali-bin-abi-talib.modarrag.app',      pg_catalog.jsonb_build_object('app_role', 'school_admin', 'school_id', v_school_id::text)),
        (v_uid_teacher_101,  'teacher-t101@ali-bin-abi-talib.modarrag.app',     pg_catalog.jsonb_build_object('app_role', 'teacher',      'school_id', v_school_id::text)),
        (v_uid_teacher_102,  'teacher-t102@ali-bin-abi-talib.modarrag.app',     pg_catalog.jsonb_build_object('app_role', 'teacher',      'school_id', v_school_id::text)),
        (v_uid_teacher_103,  'teacher-t103@ali-bin-abi-talib.modarrag.app',     pg_catalog.jsonb_build_object('app_role', 'teacher',      'school_id', v_school_id::text)),
        (v_uid_teacher_104,  'teacher-t104@ali-bin-abi-talib.modarrag.app',     pg_catalog.jsonb_build_object('app_role', 'teacher',      'school_id', v_school_id::text)),
        (v_uid_student_201,  'student-s201@ali-bin-abi-talib.modarrag.app',     pg_catalog.jsonb_build_object('app_role', 'student',      'school_id', v_school_id::text)),
        (v_uid_student_202,  'student-s202@ali-bin-abi-talib.modarrag.app',     pg_catalog.jsonb_build_object('app_role', 'student',      'school_id', v_school_id::text))
    ) AS u(uid, email, app_meta)
  LOOP
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_demo_user.uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_demo_user.email,
      v_demo_password_hash,
      pg_catalog.now(),
      v_demo_user.app_meta,
      '{}'::jsonb,
      pg_catalog.now(),
      pg_catalog.now(),
      '', '', '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      encrypted_password = CASE
        WHEN auth.users.encrypted_password IS NULL OR auth.users.encrypted_password = ''
          THEN EXCLUDED.encrypted_password
        ELSE auth.users.encrypted_password
      END,
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at);

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      pg_catalog.gen_random_uuid(),
      v_demo_user.uid,
      pg_catalog.jsonb_build_object(
        'sub', v_demo_user.uid::text,
        'email', v_demo_user.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_demo_user.uid::text,
      pg_catalog.now(),
      pg_catalog.now(),
      pg_catalog.now()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data;
  END LOOP;

  INSERT INTO public.profiles (id, school_id, role, full_name, phone, student_national_code, is_active) VALUES
    (v_uid_super_admin,  NULL,        'super_admin',  'مشرف المنصة العام',                     '01000000100', NULL,    true),
    (v_uid_school_admin, v_school_id, 'school_admin', 'إدارة المدرسة التجريبية',               '01000000101', NULL,    true),
    (v_uid_teacher_101,  v_school_id, 'teacher',      'معلم البرمجة التجريبي',                 '01000000111', NULL,    true),
    (v_uid_teacher_102,  v_school_id, 'teacher',      'معلم الفيزياء والرياضيات التجريبي',     '01000000112', NULL,    true),
    (v_uid_teacher_103,  v_school_id, 'teacher',      'معلم اللغة العربية التجريبي',           '01000000113', NULL,    true),
    (v_uid_teacher_104,  v_school_id, 'teacher',      'معلم الكيمياء التجريبي',                '01000000114', NULL,    true),
    (v_uid_student_201,  v_school_id, 'student',      'طالب الهندسة التجريبي',                 '01000000201', 'S-201', true),
    (v_uid_student_202,  v_school_id, 'student',      'طالب الآداب التجريبي',                  '01000000202', 'S-202', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role;

  -- 8. Teacher Profiles & Subject Authorizations
  INSERT INTO public.teacher_profiles (
    id, school_id, teacher_code, specialty_ar, bio_ar, is_approved, approved_by, approved_at
  ) VALUES
    (v_uid_teacher_101, v_school_id, 'T-101', 'معلم البرمجة',             'حساب هيئة تدريس معتمد لمادة البرمجة.',                true, v_uid_school_admin, pg_catalog.now()),
    (v_uid_teacher_102, v_school_id, 'T-102', 'معلم الفيزياء والرياضيات', 'حساب هيئة تدريس معتمد لمادتي الفيزياء والرياضيات.',     true, v_uid_school_admin, pg_catalog.now()),
    (v_uid_teacher_103, v_school_id, 'T-103', 'معلم اللغة العربية',       'حساب هيئة تدريس معتمد لمادة اللغة العربية.',          true, v_uid_school_admin, pg_catalog.now()),
    (v_uid_teacher_104, v_school_id, 'T-104', 'معلم الكيمياء',            'حساب هيئة تدريس معتمد لمادة الكيمياء.',               true, v_uid_school_admin, pg_catalog.now())
  ON CONFLICT (id) DO UPDATE SET
    specialty_ar = EXCLUDED.specialty_ar,
    is_approved = true;

  INSERT INTO public.teacher_subjects (school_id, teacher_id, subject_id) VALUES
    (v_school_id, v_uid_teacher_101, v_subj_prog),
    (v_school_id, v_uid_teacher_102, v_subj_phys),
    (v_school_id, v_uid_teacher_102, v_subj_math),
    (v_school_id, v_uid_teacher_103, v_subj_arabic),
    (v_school_id, v_uid_teacher_104, v_subj_chem)
  ON CONFLICT (teacher_id, subject_id) DO NOTHING;

  -- 9. Sample Student Enrollments
  INSERT INTO public.student_enrollments (
    school_id, student_id, grade_id, track_id, selected_elective_subject_id, academic_year, is_active
  ) VALUES
    (v_school_id, v_uid_student_201, v_grade_id, v_track_eng, NULL,        '2026-2027', true),
    (v_school_id, v_uid_student_202, v_grade_id, v_track_art, v_subj_ital, '2026-2027', true)
  ON CONFLICT (student_id, academic_year) WHERE is_active = true DO UPDATE SET
    track_id = EXCLUDED.track_id,
    selected_elective_subject_id = EXCLUDED.selected_elective_subject_id;

  -- 10. Sample Non-Overlapping Upcoming Sessions (with 15-min buffer compliance)
  INSERT INTO public.sessions (
    id, school_id, hall_id, teacher_id, subject_id, title_ar,
    starts_at, ends_at, buffer_minutes, max_capacity, status, created_by
  ) VALUES
    (
      v_sess_1, v_school_id, v_hall_4, v_uid_teacher_101, v_subj_prog,
      'مراجعة الخوارزميات والبرمجة',
      v_base_day + interval '16 hours', v_base_day + interval '17 hours 30 minutes',
      15, 30, 'scheduled', v_uid_school_admin
    ),
    (
      v_sess_2, v_school_id, v_hall_1, v_uid_teacher_103, v_subj_arabic,
      'تطبيقات النحو والبلاغة',
      v_base_day + interval '16 hours', v_base_day + interval '17 hours 30 minutes',
      15, 60, 'scheduled', v_uid_school_admin
    ),
    (
      v_sess_3, v_school_id, v_hall_2, v_uid_teacher_102, v_subj_phys,
      'ميكانيكا الحركة والموجات',
      v_base_day + interval '18 hours', v_base_day + interval '19 hours 30 minutes',
      15, 50, 'scheduled', v_uid_school_admin
    ),
    (
      v_sess_4, v_school_id, v_hall_3, v_uid_teacher_104, v_subj_chem,
      'الروابط الكيميائية والتفاعلات',
      v_base_day + interval '18 hours', v_base_day + interval '19 hours 30 minutes',
      15, 35, 'scheduled', v_uid_school_admin
    )
  ON CONFLICT (id) DO NOTHING;
END $$;

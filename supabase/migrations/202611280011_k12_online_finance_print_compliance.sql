-- 202611280011_k12_online_finance_print_compliance.sql
-- Completes Phase 1 requirements:
-- 1) K-12 full Egyptian stage grades/tracks/subjects (Primary 1 to Secondary 3 + Baccalaureate)
-- 2) Dual delivery mode on sessions & session_series ('in_person' hall OR 'online' remote class)
-- 3) Commercial split & VAT fields (70% teacher / 30% platform / 14% VAT + session/lecture price)
-- 4) Teacher vetting (qualifications, experience, rejection reasons) & punctuality deduction tracking
-- 5) Online Print Center (print_partners, print_orders) + private 'handouts' Storage bucket & RLS

-- ---------------------------------------------------------------------------
-- 1. Schools: tenant_type ('school'|'center') + financial percentages
-- ---------------------------------------------------------------------------
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS tenant_type text NOT NULL DEFAULT 'school',
  ADD COLUMN IF NOT EXISTS teacher_share_pct smallint NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS platform_fee_pct smallint NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS school_share_pct smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate_pct smallint NOT NULL DEFAULT 14;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_tenant_type_chk' AND conrelid = 'public.schools'::regclass
  ) THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_tenant_type_chk CHECK (tenant_type IN ('school', 'center'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_revenue_split_chk' AND conrelid = 'public.schools'::regclass
  ) THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_revenue_split_chk
      CHECK (
        teacher_share_pct BETWEEN 0 AND 100
        AND platform_fee_pct BETWEEN 0 AND 100
        AND teacher_share_pct + platform_fee_pct = 100
        AND school_share_pct BETWEEN 0 AND 100
        AND vat_rate_pct BETWEEN 0 AND 30
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Halls & Sessions: widen capacity to 500 + support online delivery & price
-- ---------------------------------------------------------------------------
ALTER TABLE public.halls DROP CONSTRAINT IF EXISTS halls_max_capacity_chk;
ALTER TABLE public.halls
  ADD CONSTRAINT halls_max_capacity_chk CHECK (max_capacity BETWEEN 10 AND 500);

ALTER TABLE public.session_series
  ALTER COLUMN hall_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS price_egp integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_series_delivery_mode_chk' AND conrelid = 'public.session_series'::regclass
  ) THEN
    ALTER TABLE public.session_series
      ADD CONSTRAINT session_series_delivery_mode_chk CHECK (delivery_mode IN ('in_person', 'online'));
  END IF;
END $$;

ALTER TABLE public.sessions
  ALTER COLUMN hall_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS price_egp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS teacher_compliance_status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS teacher_deduction_egp integer NOT NULL DEFAULT 0;

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_capacity_bounds_chk;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_capacity_bounds_chk CHECK (max_capacity BETWEEN 10 AND 500);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_delivery_mode_chk' AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_delivery_mode_chk CHECK (delivery_mode IN ('in_person', 'online'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_price_egp_chk' AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_price_egp_chk CHECK (price_egp BETWEEN 0 AND 10000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_teacher_compliance_chk' AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_teacher_compliance_chk
      CHECK (teacher_compliance_status IN ('scheduled', 'on_time', 'late', 'no_show'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_teacher_deduction_chk' AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_teacher_deduction_chk CHECK (teacher_deduction_egp >= 0);
  END IF;
END $$;

-- Update hall overlap constraint so pure online sessions (hall_id IS NULL) do not collide
-- on NULL hall_id while teacher overlap constraint continues enforcing zero teacher overlaps.
DO $$
BEGIN
  SET LOCAL search_path = public, extensions;

  ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS no_overlapping_hall_sessions;
  EXECUTE $sql$
    ALTER TABLE public.sessions
    ADD CONSTRAINT no_overlapping_hall_sessions
    EXCLUDE USING gist (hall_id WITH =, occupied_range WITH &&)
    WHERE (hall_id IS NOT NULL AND status IN ('scheduled', 'full', 'ongoing'))
  $sql$;
END $$;

-- Update tenant/capacity validation trigger for dual in-person / online mode
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
  IF NEW.delivery_mode = 'in_person' THEN
    IF NEW.hall_id IS NULL THEN
      RAISE EXCEPTION 'In-person sessions must specify an active school hall'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.hall_id IS NOT NULL THEN
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

    IF NEW.delivery_mode = 'in_person' AND NEW.max_capacity > v_hall.max_capacity THEN
      RAISE EXCEPTION 'Session max_capacity (%) exceeds hall max_capacity (%)', NEW.max_capacity, v_hall.max_capacity
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.delivery_mode = 'online' AND NEW.meeting_url IS NOT NULL AND NEW.meeting_url <> '' THEN
    IF NEW.meeting_url !~ '^https://' THEN
      RAISE EXCEPTION 'Online session link must use HTTPS'
        USING ERRCODE = '23514';
    END IF;
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

-- ---------------------------------------------------------------------------
-- 3. Lectures pricing + Bookings compliance + Teacher Vetting & Compliance
-- ---------------------------------------------------------------------------
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS price_egp integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lectures_price_egp_chk' AND conrelid = 'public.lectures'::regclass
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_price_egp_chk CHECK (price_egp BETWEEN 0 AND 10000);
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS attendance_flag text NOT NULL DEFAULT 'on_time',
  ADD COLUMN IF NOT EXISTS late_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_egp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_amount_egp integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_attendance_flag_chk' AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_attendance_flag_chk
      CHECK (attendance_flag IN ('on_time', 'late', 'absent_deducted'));
  END IF;
END $$;

ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS qualifications_ar text,
  ADD COLUMN IF NOT EXISTS experience_years smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason_ar text,
  ADD COLUMN IF NOT EXISTS compliance_score smallint NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS total_deductions_egp integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teacher_profiles_approval_status_chk' AND conrelid = 'public.teacher_profiles'::regclass
  ) THEN
    ALTER TABLE public.teacher_profiles
      ADD CONSTRAINT teacher_profiles_approval_status_chk
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teacher_profiles_compliance_chk' AND conrelid = 'public.teacher_profiles'::regclass
  ) THEN
    ALTER TABLE public.teacher_profiles
      ADD CONSTRAINT teacher_profiles_compliance_chk
      CHECK (compliance_score BETWEEN 0 AND 100 AND total_deductions_egp >= 0);
  END IF;
END $$;

UPDATE public.teacher_profiles
SET
  approval_status = CASE WHEN is_approved THEN 'approved' ELSE 'pending' END,
  experience_years = CASE WHEN experience_years = 0 THEN 6 ELSE experience_years END,
  qualifications_ar = COALESCE(qualifications_ar, 'بكالوريوس تربية وتأهيل تخصصي معتمد');

-- Allow additional operational notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_chk;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_chk
  CHECK (type IN (
    'booking_confirmed',
    'waitlist_joined',
    'waitlist_promoted',
    'session_cancelled',
    'session_reminder',
    'checkin_confirmed',
    'teacher_approved',
    'hall_reallocated',
    'print_order_updated',
    'compliance_notice',
    'system'
  ));

-- ---------------------------------------------------------------------------
-- 4. Compliance RPCs for Attendance Punctuality & Teacher Punctuality
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_booking_compliance(
  p_booking_id uuid,
  p_attendance_flag text,
  p_late_minutes integer DEFAULT 0,
  p_deduction_egp integer DEFAULT 0
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
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message_ar', 'يجب تسجيل الدخول أولاً.');
  END IF;

  IF p_attendance_flag NOT IN ('on_time', 'late', 'absent_deducted') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'validation_error', 'message_ar', 'حالة الالتزام غير صالحة.');
  END IF;

  SELECT id, school_id, role, is_active INTO v_actor FROM public.profiles WHERE id = v_actor_id;
  IF NOT FOUND OR NOT v_actor.is_active OR v_actor.role NOT IN ('teacher', 'school_admin', 'super_admin') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden', 'message_ar', 'الصلاحية متاحة للمعلم أو إدارة المدرسة فقط.');
  END IF;

  SELECT b.id, b.school_id, b.session_id, b.student_id, b.status, s.teacher_id, subj.name_ar AS subject_name_ar
  INTO v_booking
  FROM public.bookings b
  JOIN public.sessions s ON s.id = b.session_id
  JOIN public.subjects subj ON subj.id = s.subject_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found', 'message_ar', 'سجل الطالب غير موجود.');
  END IF;

  IF v_actor.role <> 'super_admin' AND v_booking.school_id <> v_actor.school_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden', 'message_ar', 'لا تملك صلاحية التعديل في هذه المدرسة.');
  END IF;

  IF v_actor.role = 'teacher' AND v_booking.teacher_id <> v_actor_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden', 'message_ar', 'يمكنك تسجيل الالتزام لطلاب حصصك فقط.');
  END IF;

  UPDATE public.bookings
  SET
    attendance_flag = p_attendance_flag,
    late_minutes = GREATEST(0, COALESCE(p_late_minutes, 0)),
    deduction_egp = GREATEST(0, COALESCE(p_deduction_egp, 0)),
    status = CASE
      WHEN p_attendance_flag = 'absent_deducted' THEN 'no_show'::public.booking_status_enum
      WHEN p_attendance_flag IN ('on_time', 'late') THEN 'checked_in'::public.booking_status_enum
      ELSE status
    END,
    checked_in_at = CASE
      WHEN p_attendance_flag IN ('on_time', 'late') THEN COALESCE(checked_in_at, pg_catalog.now())
      ELSE NULL
    END,
    checked_in_by = CASE
      WHEN p_attendance_flag IN ('on_time', 'late') THEN v_actor_id
      ELSE NULL
    END
  WHERE id = v_booking.id;

  IF COALESCE(p_deduction_egp, 0) > 0 THEN
    INSERT INTO public.notifications (school_id, recipient_id, type, title_ar, body_ar, metadata)
    VALUES (
      v_booking.school_id,
      v_booking.student_id,
      'compliance_notice',
      'إشعار الالتزام بالموعد',
      'تم تسجيل ' ||
        CASE WHEN p_attendance_flag = 'absent_deducted' THEN 'تغيب' ELSE 'تأخير' END ||
        ' في حصة ' || v_booking.subject_name_ar || ' (خصم ' || p_deduction_egp || ' ج.م).',
      pg_catalog.jsonb_build_object('booking_id', v_booking.id, 'deduction_egp', p_deduction_egp)
    );
  END IF;

  INSERT INTO public.audit_logs (school_id, actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_booking.school_id,
    v_actor_id,
    'attendance_compliance_recorded',
    'booking',
    v_booking.id,
    pg_catalog.jsonb_build_object('flag', p_attendance_flag, 'late_minutes', p_late_minutes, 'deduction_egp', p_deduction_egp)
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'flag', p_attendance_flag, 'deduction_egp', GREATEST(0, COALESCE(p_deduction_egp, 0)));
END;
$$;

REVOKE ALL ON FUNCTION public.record_booking_compliance(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_booking_compliance(uuid, text, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Online Print Partners & Print Orders Tables + Explicit Grants + RLS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.print_partners (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  phone text NOT NULL,
  whatsapp_number text,
  address_ar text,
  commission_pct smallint NOT NULL DEFAULT 15 CHECK (commission_pct BETWEEN 0 AND 50),
  base_page_piasters integer NOT NULL DEFAULT 50 CHECK (base_page_piasters BETWEEN 10 AND 1000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_print_partners_school_active
  ON public.print_partners (school_id, is_active);

CREATE OR REPLACE TRIGGER trg_print_partners_updated_at
  BEFORE UPDATE ON public.print_partners
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.print_orders (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.print_partners(id) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  title_ar text NOT NULL,
  file_storage_path text,
  external_file_url text,
  copies_count integer NOT NULL CHECK (copies_count BETWEEN 1 AND 5000),
  pages_count integer NOT NULL CHECK (pages_count BETWEEN 1 AND 1000),
  print_specs text NOT NULL DEFAULT 'bw_double' CHECK (print_specs IN ('bw_single', 'bw_double', 'color')),
  binding_type text NOT NULL DEFAULT 'staple' CHECK (binding_type IN ('none', 'staple', 'spiral')),
  subtotal_egp integer NOT NULL DEFAULT 0 CHECK (subtotal_egp >= 0),
  vat_egp integer NOT NULL DEFAULT 0 CHECK (vat_egp >= 0),
  total_egp integer NOT NULL DEFAULT 0 CHECK (total_egp >= 0),
  platform_commission_egp integer NOT NULL DEFAULT 0 CHECK (platform_commission_egp >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printing', 'ready', 'delivered', 'cancelled')),
  notes_ar text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_print_orders_school_teacher
  ON public.print_orders (school_id, teacher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_print_orders_partner_status
  ON public.print_orders (partner_id, status);

CREATE OR REPLACE TRIGGER trg_print_orders_updated_at
  BEFORE UPDATE ON public.print_orders
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- Enable + FORCE RLS and explicit privileges (Oct 2026 Postgres privilege rules)
ALTER TABLE public.print_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_partners FORCE ROW LEVEL SECURITY;
ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_orders FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.print_partners FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.print_partners TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.print_partners TO authenticated;

REVOKE ALL ON TABLE public.print_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.print_orders TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'print_partners' AND policyname = 'print_partners_select_auth') THEN
    CREATE POLICY print_partners_select_auth ON public.print_partners
      FOR SELECT TO authenticated
      USING (
        (select private.is_super_admin())
        OR school_id IS NULL
        OR school_id = (select private.current_school_id())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'print_partners' AND policyname = 'print_partners_manage_admin') THEN
    CREATE POLICY print_partners_manage_admin ON public.print_partners
      FOR ALL TO authenticated
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
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'print_orders' AND policyname = 'print_orders_select_auth') THEN
    CREATE POLICY print_orders_select_auth ON public.print_orders
      FOR SELECT TO authenticated
      USING (
        (select private.is_super_admin())
        OR (
          school_id = (select private.current_school_id())
          AND (
            (select private.current_app_role()) = 'school_admin'
            OR teacher_id = (select auth.uid())
          )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'print_orders' AND policyname = 'print_orders_insert_teacher') THEN
    CREATE POLICY print_orders_insert_teacher ON public.print_orders
      FOR INSERT TO authenticated
      WITH CHECK (
        school_id = (select private.current_school_id())
        AND teacher_id = (select auth.uid())
        AND (select private.current_app_role()) IN ('teacher', 'school_admin', 'super_admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'print_orders' AND policyname = 'print_orders_update_auth') THEN
    CREATE POLICY print_orders_update_auth ON public.print_orders
      FOR UPDATE TO authenticated
      USING (
        (select private.is_super_admin())
        OR (
          school_id = (select private.current_school_id())
          AND (
            (select private.current_app_role()) = 'school_admin'
            OR (teacher_id = (select auth.uid()) AND status IN ('pending', 'cancelled'))
          )
        )
      )
      WITH CHECK (
        (select private.is_super_admin())
        OR (
          school_id = (select private.current_school_id())
          AND (
            (select private.current_app_role()) = 'school_admin'
            OR teacher_id = (select auth.uid())
          )
        )
      );
  END IF;
END $$;

-- Seed default contracted school print partner for ali-bin-abi-talib
INSERT INTO public.print_partners (
  id, school_id, name_ar, phone, whatsapp_number, address_ar, commission_pct, base_page_piasters, is_active
) VALUES (
  '77777777-7777-4777-8777-777777777701',
  '11111111-1111-4111-8111-111111111101',
  'المطبعة الأكاديمية المعتمدة — مدينة نصر',
  '01090001900',
  '201090001900',
  'بجوار بوابة المدرسة الرئيسية — توصيل فوري لقاعات المراجعة',
  15,
  50,
  true
) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Private Storage Bucket 'handouts' (Teacher printable PDFs & sheets)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'handouts',
      'handouts',
      false,
      26214400,
      ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg'
      ]
    )
    ON CONFLICT (id) DO UPDATE SET
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'handouts_storage_teacher_all') THEN
      CREATE POLICY handouts_storage_teacher_all ON storage.objects
        FOR ALL TO authenticated
        USING (
          bucket_id = 'handouts'
          AND (
            (select private.is_super_admin())
            OR (storage.foldername(name))[1] = (select private.current_school_id())::text
          )
        )
        WITH CHECK (
          bucket_id = 'handouts'
          AND (storage.foldername(name))[1] = (select private.current_school_id())::text
          AND (storage.foldername(name))[2] = (select auth.uid())::text
          AND (select private.current_app_role()) IN ('teacher', 'school_admin', 'super_admin')
        );
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Seed K-12 Egyptian Grades (Primary 1 to Secondary 3) on ali-bin-abi-talib
--    preserving SEC_2_BACC UUID 22222222-2222-4222-8222-222222222201 seamlessly
-- ---------------------------------------------------------------------------
UPDATE public.academic_grades
SET sort_order = 11
WHERE id = '22222222-2222-4222-8222-222222222201'
  AND code = 'SEC_2_BACC';

DO $$
DECLARE
  v_school_id uuid := '11111111-1111-4111-8111-111111111101';
  v_rec record;
  v_grade_id uuid;
  v_track_id uuid;
  v_subj_id uuid;
  v_subj_code text;
  v_subj_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = v_school_id) THEN
    RETURN;
  END IF;

  FOR v_rec IN
    SELECT * FROM (
      VALUES
        ('PRIM_1', 'الصف الأول الابتدائي', 'Primary 1', 1, 'عام', 'PRIMARY_GENERAL'),
        ('PRIM_2', 'الصف الثاني الابتدائي', 'Primary 2', 2, 'عام', 'PRIMARY_GENERAL'),
        ('PRIM_3', 'الصف الثالث الابتدائي', 'Primary 3', 3, 'عام', 'PRIMARY_GENERAL'),
        ('PRIM_4', 'الصف الرابع الابتدائي', 'Primary 4', 4, 'عام', 'PRIMARY_GENERAL'),
        ('PRIM_5', 'الصف الخامس الابتدائي', 'Primary 5', 5, 'عام', 'PRIMARY_GENERAL'),
        ('PRIM_6', 'الصف السادس الابتدائي', 'Primary 6', 6, 'عام', 'PRIMARY_GENERAL'),
        ('PREP_1', 'الصف الأول الإعدادي', 'Preparatory 1', 7, 'عام', 'PREP_GENERAL'),
        ('PREP_2', 'الصف الثاني الإعدادي', 'Preparatory 2', 8, 'عام', 'PREP_GENERAL'),
        ('PREP_3', 'الصف الثالث الإعدادي (الشهادة الإعدادية)', 'Preparatory 3', 9, 'الشهادة الإعدادية', 'PREP_GENERAL'),
        ('SEC_1',  'الصف الأول الثانوي', 'Secondary 1', 10, 'الشعبة العامة', 'SEC1_GENERAL'),
        ('SEC_3_GEN', 'الصف الثالث الثانوي (الثانوية العامة)', 'Secondary 3', 12, 'الشعبة العلمية (علوم)', 'SCI_SCIENCE')
    ) AS t(code, name_ar, name_en, sort_order, track_name_ar, track_code)
  LOOP
    INSERT INTO public.academic_grades (school_id, code, name_ar, name_en, sort_order, is_active)
    VALUES (v_school_id, v_rec.code, v_rec.name_ar, v_rec.name_en, v_rec.sort_order, true)
    ON CONFLICT (school_id, code) DO UPDATE SET sort_order = EXCLUDED.sort_order
    RETURNING id INTO v_grade_id;

    INSERT INTO public.academic_tracks (school_id, grade_id, code, name_ar, name_en, color_hex, icon_key, sort_order, is_active)
    VALUES (v_school_id, v_grade_id, v_rec.track_code, v_rec.track_name_ar, v_rec.track_code, '#2563EB', 'book-open', 1, true)
    ON CONFLICT (school_id, grade_id, code) DO UPDATE SET name_ar = EXCLUDED.name_ar
    RETURNING id INTO v_track_id;

    -- Core subjects shared across every stage (Arabic, Math, English)
    FOREACH v_subj_code IN ARRAY ARRAY['ARABIC', 'MATH', 'ENGLISH']
    LOOP
      v_subj_name := CASE v_subj_code
        WHEN 'ARABIC' THEN 'اللغة العربية'
        WHEN 'MATH' THEN 'الرياضيات'
        ELSE 'اللغة الإنجليزية'
      END;

      INSERT INTO public.subjects (school_id, grade_id, code, name_ar, name_en, subject_type, color_hex, is_active)
      VALUES (v_school_id, v_grade_id, v_subj_code, v_subj_name, v_subj_code, 'common', '#1E3A8A', true)
      ON CONFLICT (school_id, grade_id, code) DO UPDATE SET name_ar = EXCLUDED.name_ar
      RETURNING id INTO v_subj_id;

      INSERT INTO public.track_subjects (school_id, track_id, subject_id, is_mandatory)
      VALUES (v_school_id, v_track_id, v_subj_id, true)
      ON CONFLICT (track_id, subject_id) DO NOTHING;
    END LOOP;

    -- Extra tracks for Secondary 3
    IF v_rec.code = 'SEC_3_GEN' THEN
      INSERT INTO public.academic_tracks (school_id, grade_id, code, name_ar, name_en, color_hex, icon_key, sort_order, is_active)
      VALUES
        (v_school_id, v_grade_id, 'SCI_MATH', 'الشعبة العلمية (رياضة)', 'Scientific Math', '#1D4ED8', 'cpu', 2, true),
        (v_school_id, v_grade_id, 'LIT_TRACK', 'الشعبة الأدبية', 'Literary Track', '#D97706', 'book-open', 3, true)
      ON CONFLICT (school_id, grade_id, code) DO NOTHING;

      INSERT INTO public.subjects (school_id, grade_id, code, name_ar, name_en, subject_type, color_hex, is_active)
      VALUES
        (v_school_id, v_grade_id, 'PHYSICS', 'الفيزياء', 'Physics', 'track_core', '#0F766E', true),
        (v_school_id, v_grade_id, 'CHEMISTRY', 'الكيمياء', 'Chemistry', 'track_core', '#059669', true)
      ON CONFLICT (school_id, grade_id, code) DO NOTHING;
    END IF;
  END LOOP;
END $$;

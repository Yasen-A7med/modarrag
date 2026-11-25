-- 202611250005_bookings_waitlist_and_audit.sql
-- Seat bookings, FIFO waitlist ordering, QR token verification hashes,
-- student/teacher notifications, and append-only audit logs.

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.booking_status_enum NOT NULL DEFAULT 'confirmed',
  waitlist_position integer,
  seat_number text,
  qr_token_hash text,
  qr_nonce text,
  booked_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  promoted_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_waitlist_position_chk'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_waitlist_position_chk
      CHECK (waitlist_position IS NULL OR waitlist_position > 0);
  END IF;
END $$;

-- A student may hold at most one active booking (confirmed, waitlisted, or checked_in) per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_active_student_session
  ON public.bookings (session_id, student_id)
  WHERE status IN ('confirmed', 'waitlisted', 'checked_in');

-- Composite and FK Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_school_status_time
  ON public.bookings (school_id, status, booked_at);

CREATE INDEX IF NOT EXISTS idx_bookings_student_active
  ON public.bookings (student_id, status, booked_at);

CREATE INDEX IF NOT EXISTS idx_bookings_session_waitlist
  ON public.bookings (session_id, waitlist_position, booked_at)
  WHERE status = 'waitlisted';

CREATE INDEX IF NOT EXISTS idx_bookings_qr_hash
  ON public.bookings (qr_token_hash)
  WHERE qr_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_checked_in_by
  ON public.bookings (checked_in_by)
  WHERE checked_in_by IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title_ar text NOT NULL,
  body_ar text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_chk'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
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
        'system'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_school_created
  ON public.notifications (school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created
  ON public.audit_logs (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON public.audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);

CREATE OR REPLACE FUNCTION private.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table is strictly append-only'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_audit_log_mutation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_audit_log_mutation();

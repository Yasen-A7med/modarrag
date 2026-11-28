export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | "super_admin"
  | "school_admin"
  | "teacher"
  | "student"
  | "gate_scanner";

export type SubjectType = "common" | "track_core" | "track_elective";

export type HallStatus = "active" | "maintenance" | "archived";

export type SessionStatus =
  | "scheduled"
  | "full"
  | "ongoing"
  | "completed"
  | "cancelled";

export type BookingStatus =
  | "confirmed"
  | "waitlisted"
  | "cancelled_by_student"
  | "cancelled_by_system"
  | "checked_in"
  | "no_show";

export type NotificationType =
  | "booking_confirmed"
  | "waitlist_joined"
  | "waitlist_promoted"
  | "session_cancelled"
  | "session_reminder"
  | "checkin_confirmed"
  | "teacher_approved"
  | "hall_reallocated"
  | "print_order_updated"
  | "compliance_notice"
  | "system";

export type DeliveryMode = "in_person" | "online";
export type TenantType = "school" | "center";
export type TeacherApprovalStatus = "pending" | "approved" | "rejected";
export type BookingAttendanceFlag = "on_time" | "late" | "absent_deducted";
export type PrintSpec = "bw_single" | "bw_double" | "color";
export type PrintBindingType = "none" | "staple" | "spiral";
export type PrintOrderStatus = "pending" | "printing" | "ready" | "delivered" | "cancelled";

export type LectureVisibility = "public" | "attendees_only" | "secret";

export type RecordBookingComplianceRpcResult =
  | { readonly ok: true; readonly flag: BookingAttendanceFlag; readonly deduction_egp: number }
  | {
      readonly ok: false;
      readonly code: "unauthenticated" | "validation_error" | "forbidden" | "not_found";
      readonly message_ar: string;
    };

export interface SetLectureSecretPasswordRpcResult {
  readonly ok: boolean;
  readonly code?: "unauthenticated" | "weak_password" | "not_found" | "forbidden";
  readonly message_ar?: string;
}

export type SecretLecturePreviewRpcResult =
  | { readonly found: false }
  | {
      readonly found: true;
      readonly lecture_id: string;
      readonly title_ar: string;
      readonly description_ar: string | null;
      readonly visibility: LectureVisibility;
      readonly duration_minutes: number | null;
      readonly file_size_bytes: number | null;
      readonly mime_type: string | null;
      readonly created_at: string;
      readonly school_name_ar: string;
      readonly school_slug: string;
      readonly subject_name_ar: string;
      readonly teacher_code: string;
      readonly specialty_ar: string;
      readonly already_unlocked: boolean;
    };

export type UnlockSecretLectureRpcResult =
  | {
      readonly ok: true;
      readonly lecture_id: string;
      readonly storage_path: string | null;
      readonly external_video_url: string | null;
    }
  | {
      readonly ok: false;
      readonly code: "not_found" | "invalid_password";
      readonly message_ar: string;
    };

export type BookStudentSeatRpcResult =
  | {
      readonly ok: true;
      readonly status: "confirmed";
      readonly booking_id: string;
      readonly seat_number: string;
      readonly waitlist_position: null;
      readonly booked_seats_count: number;
      readonly max_capacity: number;
    }
  | {
      readonly ok: true;
      readonly status: "waitlisted";
      readonly booking_id: string;
      readonly seat_number: null;
      readonly waitlist_position: number;
      readonly booked_seats_count: number;
      readonly max_capacity: number;
    }
  | {
      readonly ok: false;
      readonly code:
        | "unauthenticated"
        | "profile_inactive"
        | "student_role_required"
        | "onboarding_incomplete"
        | "session_not_found"
        | "cross_tenant_forbidden"
        | "session_not_bookable"
        | "enrollment_missing"
        | "ineligible_subject"
        | "already_booked"
        | "student_time_overlap";
      readonly message_ar: string;
    };

export type CancelStudentBookingRpcResult =
  | {
      readonly ok: true;
      readonly cancelled_booking_id: string;
      readonly promoted_booking_id: string | null;
      readonly promoted_student_id?: string;
    }
  | {
      readonly ok: false;
      readonly code:
        | "unauthenticated"
        | "booking_not_found"
        | "forbidden"
        | "cannot_cancel_status";
      readonly message_ar: string;
    };

export type MarkStudentAttendanceRpcResult =
  | {
      readonly ok: true;
      readonly status: "confirmed" | "checked_in";
      readonly booking_id: string;
      readonly session_id: string;
      readonly student_id: string;
      readonly checked_in_at: string | null;
    }
  | {
      readonly ok: false;
      readonly code:
        | "unauthenticated"
        | "forbidden"
        | "booking_not_found"
        | "invalid_status";
      readonly message_ar: string;
    };

export type CompleteStudentOnboardingRpcResult =
  | {
      readonly ok: true;
      readonly enrollment_id: string;
      readonly school_id: string;
      readonly grade_id: string;
      readonly track_id: string;
    }
  | {
      readonly ok: false;
      readonly code:
        | "unauthenticated"
        | "invalid_school"
        | "invalid_grade"
        | "invalid_track"
        | "elective_required"
        | "invalid_elective";
      readonly message_ar: string;
    };

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string;
          slug: string;
          name_ar: string;
          name_en: string;
          governorate: string;
          directorate: string;
          logo_url: string | null;
          brand_color_hex: string;
          default_buffer_minutes: number;
          tenant_type: TenantType;
          teacher_share_pct: number;
          platform_fee_pct: number;
          school_share_pct: number;
          vat_rate_pct: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name_ar: string;
          name_en: string;
          governorate: string;
          directorate: string;
          logo_url?: string | null;
          brand_color_hex?: string;
          default_buffer_minutes?: number;
          tenant_type?: TenantType;
          teacher_share_pct?: number;
          platform_fee_pct?: number;
          school_share_pct?: number;
          vat_rate_pct?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name_ar?: string;
          name_en?: string;
          governorate?: string;
          directorate?: string;
          logo_url?: string | null;
          brand_color_hex?: string;
          default_buffer_minutes?: number;
          tenant_type?: TenantType;
          teacher_share_pct?: number;
          platform_fee_pct?: number;
          school_share_pct?: number;
          vat_rate_pct?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          school_id: string | null;
          role: UserRole;
          full_name: string;
          phone: string | null;
          student_national_code: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          school_id?: string | null;
          role?: UserRole;
          full_name: string;
          phone?: string | null;
          student_national_code?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string | null;
          role?: UserRole;
          full_name?: string;
          phone?: string | null;
          student_national_code?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      academic_grades: {
        Row: {
          id: string;
          school_id: string;
          code: string;
          name_ar: string;
          name_en: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          code: string;
          name_ar: string;
          name_en?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          code?: string;
          name_ar?: string;
          name_en?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_grades_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      academic_tracks: {
        Row: {
          id: string;
          school_id: string;
          grade_id: string;
          code: string;
          name_ar: string;
          name_en: string | null;
          color_hex: string;
          icon_key: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          grade_id: string;
          code: string;
          name_ar: string;
          name_en?: string | null;
          color_hex?: string;
          icon_key?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          grade_id?: string;
          code?: string;
          name_ar?: string;
          name_en?: string | null;
          color_hex?: string;
          icon_key?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_tracks_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_tracks_grade_id_fkey";
            columns: ["grade_id"];
            isOneToOne: false;
            referencedRelation: "academic_grades";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: {
          id: string;
          school_id: string;
          grade_id: string;
          code: string;
          name_ar: string;
          name_en: string | null;
          subject_type: SubjectType;
          elective_group_code: string | null;
          color_hex: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          grade_id: string;
          code: string;
          name_ar: string;
          name_en?: string | null;
          subject_type: SubjectType;
          elective_group_code?: string | null;
          color_hex?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          grade_id?: string;
          code?: string;
          name_ar?: string;
          name_en?: string | null;
          subject_type?: SubjectType;
          elective_group_code?: string | null;
          color_hex?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subjects_grade_id_fkey";
            columns: ["grade_id"];
            isOneToOne: false;
            referencedRelation: "academic_grades";
            referencedColumns: ["id"];
          },
        ];
      };
      track_subjects: {
        Row: {
          id: string;
          school_id: string;
          track_id: string;
          subject_id: string;
          is_mandatory: boolean;
          elective_group_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          track_id: string;
          subject_id: string;
          is_mandatory?: boolean;
          elective_group_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          track_id?: string;
          subject_id?: string;
          is_mandatory?: boolean;
          elective_group_code?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "track_subjects_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "track_subjects_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "academic_tracks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "track_subjects_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      student_enrollments: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          grade_id: string;
          track_id: string;
          selected_elective_subject_id: string | null;
          academic_year: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          grade_id: string;
          track_id: string;
          selected_elective_subject_id?: string | null;
          academic_year?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          grade_id?: string;
          track_id?: string;
          selected_elective_subject_id?: string | null;
          academic_year?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_enrollments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_grade_id_fkey";
            columns: ["grade_id"];
            isOneToOne: false;
            referencedRelation: "academic_grades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "academic_tracks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_selected_elective_subject_id_fkey";
            columns: ["selected_elective_subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_profiles: {
        Row: {
          id: string;
          school_id: string;
          teacher_code: string;
          specialty_ar: string;
          bio_ar: string | null;
          qualifications_ar: string | null;
          experience_years: number;
          approval_status: TeacherApprovalStatus;
          rejection_reason_ar: string | null;
          compliance_score: number;
          total_deductions_egp: number;
          is_approved: boolean;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          school_id: string;
          teacher_code: string;
          specialty_ar: string;
          bio_ar?: string | null;
          qualifications_ar?: string | null;
          experience_years?: number;
          approval_status?: TeacherApprovalStatus;
          rejection_reason_ar?: string | null;
          compliance_score?: number;
          total_deductions_egp?: number;
          is_approved?: boolean;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          teacher_code?: string;
          specialty_ar?: string;
          bio_ar?: string | null;
          qualifications_ar?: string | null;
          experience_years?: number;
          approval_status?: TeacherApprovalStatus;
          rejection_reason_ar?: string | null;
          compliance_score?: number;
          total_deductions_egp?: number;
          is_approved?: boolean;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_profiles_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_subjects: {
        Row: {
          id: string;
          school_id: string;
          teacher_id: string;
          subject_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          teacher_id: string;
          subject_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          teacher_id?: string;
          subject_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_subjects_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      halls: {
        Row: {
          id: string;
          school_id: string;
          code: string;
          name_ar: string;
          building_ar: string | null;
          floor_label_ar: string | null;
          max_capacity: number;
          status: HallStatus;
          amenities: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          code: string;
          name_ar: string;
          building_ar?: string | null;
          floor_label_ar?: string | null;
          max_capacity: number;
          status?: HallStatus;
          amenities?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          code?: string;
          name_ar?: string;
          building_ar?: string | null;
          floor_label_ar?: string | null;
          max_capacity?: number;
          status?: HallStatus;
          amenities?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "halls_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      session_series: {
        Row: {
          id: string;
          school_id: string;
          teacher_id: string;
          subject_id: string;
          hall_id: string | null;
          title_ar: string;
          day_of_week: number;
          start_time: string;
          duration_minutes: number;
          recurrence_weeks: number;
          starts_on: string;
          ends_on: string;
          delivery_mode: DeliveryMode;
          meeting_url: string | null;
          price_egp: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          teacher_id: string;
          subject_id: string;
          hall_id?: string | null;
          title_ar: string;
          day_of_week: number;
          start_time: string;
          duration_minutes: number;
          recurrence_weeks?: number;
          starts_on: string;
          ends_on: string;
          delivery_mode?: DeliveryMode;
          meeting_url?: string | null;
          price_egp?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          teacher_id?: string;
          subject_id?: string;
          hall_id?: string | null;
          title_ar?: string;
          day_of_week?: number;
          start_time?: string;
          duration_minutes?: number;
          recurrence_weeks?: number;
          starts_on?: string;
          ends_on?: string;
          delivery_mode?: DeliveryMode;
          meeting_url?: string | null;
          price_egp?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_series_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_series_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_series_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_series_hall_id_fkey";
            columns: ["hall_id"];
            isOneToOne: false;
            referencedRelation: "halls";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          id: string;
          school_id: string;
          series_id: string | null;
          hall_id: string | null;
          teacher_id: string;
          subject_id: string;
          title_ar: string;
          starts_at: string;
          ends_at: string;
          buffer_minutes: number;
          occupied_range: string;
          max_capacity: number;
          booked_seats_count: number;
          status: SessionStatus;
          delivery_mode: DeliveryMode;
          meeting_url: string | null;
          price_egp: number;
          teacher_compliance_status: "scheduled" | "on_time" | "late" | "no_show";
          teacher_deduction_egp: number;
          cancellation_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          series_id?: string | null;
          hall_id?: string | null;
          teacher_id: string;
          subject_id: string;
          title_ar: string;
          starts_at: string;
          ends_at: string;
          buffer_minutes?: number;
          max_capacity: number;
          booked_seats_count?: number;
          status?: SessionStatus;
          delivery_mode?: DeliveryMode;
          meeting_url?: string | null;
          price_egp?: number;
          teacher_compliance_status?: "scheduled" | "on_time" | "late" | "no_show";
          teacher_deduction_egp?: number;
          cancellation_reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          series_id?: string | null;
          hall_id?: string | null;
          teacher_id?: string;
          subject_id?: string;
          title_ar?: string;
          starts_at?: string;
          ends_at?: string;
          buffer_minutes?: number;
          max_capacity?: number;
          booked_seats_count?: number;
          status?: SessionStatus;
          delivery_mode?: DeliveryMode;
          meeting_url?: string | null;
          price_egp?: number;
          teacher_compliance_status?: "scheduled" | "on_time" | "late" | "no_show";
          teacher_deduction_egp?: number;
          cancellation_reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "session_series";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_hall_id_fkey";
            columns: ["hall_id"];
            isOneToOne: false;
            referencedRelation: "halls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          school_id: string;
          session_id: string;
          student_id: string;
          status: BookingStatus;
          attendance_flag: BookingAttendanceFlag;
          late_minutes: number;
          deduction_egp: number;
          payment_amount_egp: number;
          waitlist_position: number | null;
          seat_number: string | null;
          qr_token_hash: string | null;
          qr_nonce: string | null;
          booked_at: string;
          promoted_at: string | null;
          checked_in_at: string | null;
          checked_in_by: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          session_id: string;
          student_id: string;
          status?: BookingStatus;
          attendance_flag?: BookingAttendanceFlag;
          late_minutes?: number;
          deduction_egp?: number;
          payment_amount_egp?: number;
          waitlist_position?: number | null;
          seat_number?: string | null;
          qr_token_hash?: string | null;
          qr_nonce?: string | null;
          booked_at?: string;
          promoted_at?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          session_id?: string;
          student_id?: string;
          status?: BookingStatus;
          attendance_flag?: BookingAttendanceFlag;
          late_minutes?: number;
          deduction_egp?: number;
          payment_amount_egp?: number;
          waitlist_position?: number | null;
          seat_number?: string | null;
          qr_token_hash?: string | null;
          qr_nonce?: string | null;
          booked_at?: string;
          promoted_at?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_checked_in_by_fkey";
            columns: ["checked_in_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          school_id: string;
          recipient_id: string;
          type: NotificationType;
          title_ar: string;
          body_ar: string;
          metadata: Json;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          recipient_id: string;
          type: NotificationType;
          title_ar: string;
          body_ar: string;
          metadata?: Json;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          recipient_id?: string;
          type?: NotificationType;
          title_ar?: string;
          body_ar?: string;
          metadata?: Json;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          school_id: string | null;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id?: string | null;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string | null;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lectures: {
        Row: {
          id: string;
          school_id: string;
          subject_id: string;
          session_id: string | null;
          teacher_id: string;
          title_ar: string;
          description_ar: string | null;
          visibility: LectureVisibility;
          price_egp: number;
          file_size_bytes: number | null;
          mime_type: string | null;
          duration_minutes: number | null;
          share_token: string;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          subject_id: string;
          session_id?: string | null;
          teacher_id: string;
          title_ar: string;
          description_ar?: string | null;
          visibility?: LectureVisibility;
          price_egp?: number;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          duration_minutes?: number | null;
          share_token: string;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          subject_id?: string;
          session_id?: string | null;
          teacher_id?: string;
          title_ar?: string;
          description_ar?: string | null;
          visibility?: LectureVisibility;
          price_egp?: number;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          duration_minutes?: number | null;
          share_token?: string;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lectures_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lectures_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lectures_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lectures_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lecture_media: {
        Row: {
          lecture_id: string;
          storage_path: string | null;
          external_video_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lecture_id: string;
          storage_path?: string | null;
          external_video_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          lecture_id?: string;
          storage_path?: string | null;
          external_video_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lecture_media_lecture_id_fkey";
            columns: ["lecture_id"];
            isOneToOne: true;
            referencedRelation: "lectures";
            referencedColumns: ["id"];
          },
        ];
      };
      lecture_secrets: {
        Row: {
          lecture_id: string;
          password_hash: string;
          updated_at: string;
        };
        Insert: {
          lecture_id: string;
          password_hash: string;
          updated_at?: string;
        };
        Update: {
          lecture_id?: string;
          password_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lecture_secrets_lecture_id_fkey";
            columns: ["lecture_id"];
            isOneToOne: true;
            referencedRelation: "lectures";
            referencedColumns: ["id"];
          },
        ];
      };
      lecture_access_grants: {
        Row: {
          id: string;
          lecture_id: string;
          user_id: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lecture_id: string;
          user_id: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          lecture_id?: string;
          user_id?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lecture_access_grants_lecture_id_fkey";
            columns: ["lecture_id"];
            isOneToOne: false;
            referencedRelation: "lectures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lecture_access_grants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      print_partners: {
        Row: {
          id: string;
          school_id: string | null;
          name_ar: string;
          phone: string;
          whatsapp_number: string | null;
          address_ar: string | null;
          commission_pct: number;
          base_page_piasters: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id?: string | null;
          name_ar: string;
          phone: string;
          whatsapp_number?: string | null;
          address_ar?: string | null;
          commission_pct?: number;
          base_page_piasters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string | null;
          name_ar?: string;
          phone?: string;
          whatsapp_number?: string | null;
          address_ar?: string | null;
          commission_pct?: number;
          base_page_piasters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      print_orders: {
        Row: {
          id: string;
          school_id: string;
          partner_id: string;
          teacher_id: string;
          session_id: string | null;
          title_ar: string;
          file_storage_path: string | null;
          external_file_url: string | null;
          copies_count: number;
          pages_count: number;
          print_specs: PrintSpec;
          binding_type: PrintBindingType;
          subtotal_egp: number;
          vat_egp: number;
          total_egp: number;
          platform_commission_egp: number;
          status: PrintOrderStatus;
          notes_ar: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          partner_id: string;
          teacher_id: string;
          session_id?: string | null;
          title_ar: string;
          file_storage_path?: string | null;
          external_file_url?: string | null;
          copies_count: number;
          pages_count: number;
          print_specs?: PrintSpec;
          binding_type?: PrintBindingType;
          subtotal_egp?: number;
          vat_egp?: number;
          total_egp?: number;
          platform_commission_egp?: number;
          status?: PrintOrderStatus;
          notes_ar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          partner_id?: string;
          teacher_id?: string;
          session_id?: string | null;
          title_ar?: string;
          file_storage_path?: string | null;
          external_file_url?: string | null;
          copies_count?: number;
          pages_count?: number;
          print_specs?: PrintSpec;
          binding_type?: PrintBindingType;
          subtotal_egp?: number;
          vat_egp?: number;
          total_egp?: number;
          platform_commission_egp?: number;
          status?: PrintOrderStatus;
          notes_ar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_booking_compliance: {
        Args: {
          p_booking_id: string;
          p_attendance_flag: BookingAttendanceFlag;
          p_late_minutes?: number;
          p_deduction_egp?: number;
        };
        Returns: RecordBookingComplianceRpcResult;
      };
      reserve_student_seat: {
        Args: {
          p_session_id: string;
          p_booking_id?: string | null;
        };
        Returns: BookStudentSeatRpcResult;
      };
      cancel_student_booking: {
        Args: {
          p_booking_id: string;
        };
        Returns: CancelStudentBookingRpcResult;
      };
      mark_student_attendance: {
        Args: {
          p_booking_id: string;
          p_present?: boolean;
        };
        Returns: MarkStudentAttendanceRpcResult;
      };
      complete_student_onboarding: {
        Args: {
          p_school_id: string;
          p_full_name: string;
          p_phone: string | null;
          p_grade_id: string;
          p_track_id: string;
          p_selected_elective_subject_id?: string | null;
        };
        Returns: CompleteStudentOnboardingRpcResult;
      };
      set_lecture_secret_password: {
        Args: {
          p_lecture_id: string;
          p_password: string;
        };
        Returns: SetLectureSecretPasswordRpcResult;
      };
      get_secret_lecture_preview: {
        Args: {
          p_school_slug: string;
          p_share_token: string;
        };
        Returns: SecretLecturePreviewRpcResult;
      };
      unlock_secret_lecture: {
        Args: {
          p_school_slug: string;
          p_share_token: string;
          p_password: string;
        };
        Returns: UnlockSecretLectureRpcResult;
      };
    };
    Enums: {
      user_role_enum: UserRole;
      subject_type_enum: SubjectType;
      hall_status_enum: HallStatus;
      session_status_enum: SessionStatus;
      booking_status_enum: BookingStatus;
      lecture_visibility_enum: LectureVisibility;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type PublicTableName = keyof Database["public"]["Tables"];
export type TableRow<T extends PublicTableName> = Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends PublicTableName> = Database["public"]["Tables"][T]["Insert"];
export type TableUpdate<T extends PublicTableName> = Database["public"]["Tables"][T]["Update"];

import { getSchoolAdminDashboardData } from "@/application/academic/actions";
import {
  AdminAccessNotice,
  AdminPortalNav,
} from "@/components/admin/AdminOverviewClient";
import {
  TeachersApprovalClient,
  type ApprovedTeacherRow,
} from "@/components/admin/TeachersApprovalClient";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export interface SchoolAdminTeachersPageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function SchoolAdminTeachersPage({
  params,
}: SchoolAdminTeachersPageProps) {
  const { schoolSlug } = await params;
  const result = await getSchoolAdminDashboardData(schoolSlug);

  if (!result.ok) {
    return (
      <AdminAccessNotice
        schoolSlug={schoolSlug}
        errorCode={result.error.code}
        errorMessage={result.error.message}
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: approvedRows } = await supabase
    .from("teacher_profiles")
    .select("id, teacher_code, specialty_ar, approved_at")
    .eq("school_id", result.data.school.id)
    .eq("is_approved", true)
    .order("teacher_code", { ascending: true });

  const approvedTeachers: readonly ApprovedTeacherRow[] = (approvedRows ?? []).map(
    (row) => ({
      id: row.id,
      teacherCode: row.teacher_code,
      specialtyAr: row.specialty_ar,
      approvedAt: row.approved_at,
    })
  );

  return (
    <div>
      <AdminPortalNav
        schoolSlug={schoolSlug}
        pendingCount={result.data.pendingTeachers.length}
      />
      <TeachersApprovalClient
        schoolSlug={schoolSlug}
        dashboard={result.data}
        approvedTeachers={approvedTeachers}
      />
    </div>
  );
}

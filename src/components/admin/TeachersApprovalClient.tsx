"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Clock, ShieldCheck, UserCheck, Users } from "lucide-react";
import type { SchoolAdminDashboardData } from "@/application/academic/actions";
import { approveTeacherAction } from "@/application/halls/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { formatArabicNumber, formatCairoDate } from "@/lib/formatters";

export interface ApprovedTeacherRow {
  readonly id: string;
  readonly teacherCode: string;
  readonly specialtyAr: string;
  readonly approvedAt: string | null;
}

export interface TeachersApprovalClientProps {
  readonly schoolSlug: string;
  readonly dashboard: SchoolAdminDashboardData;
  readonly approvedTeachers: readonly ApprovedTeacherRow[];
}

/**
 * School Admin Teacher Approval Queue & Faculty Code Directory.
 * Strictly zero personal human names — displays institutional teacher codes and specialties.
 */
export function TeachersApprovalClient({
  schoolSlug,
  dashboard,
  approvedTeachers,
}: TeachersApprovalClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [approvingId, setApprovingId] = React.useState<string | null>(null);

  const handleApprove = async (teacherId: string, teacherCode: string) => {
    setApprovingId(teacherId);
    try {
      const result = await approveTeacherAction({
        schoolSlug,
        teacherId,
      });

      if (!result.ok) {
        toast({
          title: "تعذر اعتماد حساب المعلم",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: `تم اعتماد المعلم ${teacherCode}`,
        description: "تم إرسال إشعار للمعلم وتفعيل صلاحية حجز المدرجات.",
        variant: "success",
      });
      router.refresh();
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Metrics Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              المعلمون المعتمدون
            </span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(dashboard.stats.totalTeachers)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            مفعلون لحجز القاعات وإدارة الحصص
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              طلبات بانتظار الاعتماد
            </span>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(dashboard.pendingTeachers.length)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            تتطلب مراجعة وتفعيل من منسق المدرسة
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              المواد الدراسية النشطة
            </span>
            <BookOpen className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(dashboard.subjects.length)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            في {dashboard.school.nameAr}
          </p>
        </Card>
      </div>

      {/* Pending Teacher Approval Queue */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">قائمة انتظار اعتماد المعلمين</CardTitle>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                اعتماد المعلمين حسب الكود الوظيفي والتخصص دون تداول بيانات شخصية
              </p>
            </div>
            <Badge
              variant={dashboard.pendingTeachers.length > 0 ? "warning" : "success"}
              dot
            >
              {dashboard.pendingTeachers.length > 0
                ? `${formatArabicNumber(dashboard.pendingTeachers.length)} طلبات`
                : "لا توجد طلبات معلقة"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dashboard.pendingTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                جميع طلبات المعلمين معتمدة حالياً
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                ستظهر هنا أي حسابات جديدة لمعلمي المدرسة فور تسجيلها.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {dashboard.pendingTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)] font-mono text-xs font-bold text-[var(--text-primary)]" dir="ltr">
                      {teacher.teacherCode}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          معلم مادة — كود{" "}
                          <span className="font-mono" dir="ltr">
                            {teacher.teacherCode}
                          </span>
                        </span>
                        <Badge variant="warning">قيد المراجعة</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        التخصص: {teacher.specialtyAr}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    loading={approvingId === teacher.id}
                    className="min-h-[44px]"
                    onClick={() => handleApprove(teacher.id, teacher.teacherCode)}
                    leftIcon={<UserCheck className="h-4 w-4" />}
                  >
                    اعتماد المعلم
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Faculty Directory */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--text-muted)]" />
            <CardTitle className="text-base">سجل الأكواد المعتمدة بالمدرسة</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {approvedTeachers.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)]">
              لا توجد حسابات معلمين معتمدة مسجلة بعد.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {approvedTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="mono" dir="ltr">
                      {teacher.teacherCode}
                    </Badge>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {teacher.specialtyAr}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" dot>
                      معتمد
                    </Badge>
                    {teacher.approvedAt && (
                      <span className="text-xs text-[var(--text-muted)] tabular-nums">
                        {formatCairoDate(teacher.approvedAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

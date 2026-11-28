"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { SchoolAdminDashboardData } from "@/application/academic/actions";
import {
  approveTeacherAction,
  rejectTeacherAction,
} from "@/application/halls/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatArabicNumber, formatCairoDate } from "@/lib/formatters";

export interface ApprovedTeacherRow {
  readonly id: string;
  readonly teacherCode: string;
  readonly specialtyAr: string;
  readonly qualificationsAr?: string | null;
  readonly experienceYears?: number;
  readonly complianceScore?: number;
  readonly totalDeductionsEgp?: number;
  readonly approvedAt: string | null;
}

export interface TeachersApprovalClientProps {
  readonly schoolSlug: string;
  readonly dashboard: SchoolAdminDashboardData;
  readonly approvedTeachers: readonly ApprovedTeacherRow[];
}

/**
 * Slide 9 Blueprint: Teacher Qualification Vetting Queue (Approve / Reject with reason)
 * and Certified Faculty Registry with zero personal human names.
 */
export function TeachersApprovalClient({
  schoolSlug,
  dashboard,
  approvedTeachers,
}: TeachersApprovalClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<{
    readonly id: string;
    readonly teacherCode: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejecting, setRejecting] = React.useState(false);

  const handleApprove = async (teacherId: string, teacherCode: string) => {
    setApprovingId(teacherId);
    try {
      const result = await approveTeacherAction({ schoolSlug, teacherId });
      if (!result.ok) {
        toast({
          title: "تعذر الاعتماد",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      toast({
        title: `تم اعتماد المعلم ${teacherCode} ✓`,
        variant: "success",
      });
      router.refresh();
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      const result = await rejectTeacherAction({
        schoolSlug,
        teacherId: rejectTarget.id,
        reasonAr: rejectReason.trim(),
      });
      if (!result.ok) {
        toast({
          title: "تعذر رفض الطلب",
          description: result.error.message,
          variant: "error",
        });
        return;
      }
      toast({ title: `تم رفض الطلب ${rejectTarget.teacherCode}`, variant: "info" });
      setRejectTarget(null);
      setRejectReason("");
      router.refresh();
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4 border-b-[3px] border-b-[#16A34A]">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
            <span>المعلمون المعتمدون</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(dashboard.stats.totalTeachers)}
          </p>
        </Card>

        <Card className="p-4 border-b-[3px] border-b-amber-500">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
            <span>طلبات بانتظار المراجعة</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(dashboard.pendingTeachers.length)}
          </p>
        </Card>

        <Card className="p-4 border-b-[3px] border-b-[#2563EB]">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
            <span>المواد المفعلة</span>
            <BookOpen className="h-4 w-4 text-[#2563EB]" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(dashboard.subjects.length)}
          </p>
        </Card>
      </div>

      {/* Pending Queue with Qualifications & Experience Review */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-extrabold">
                مراجعة طلبات اعتماد المعلمين
              </CardTitle>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                التحقق من المؤهل التربوي وسنوات الخبرة قبل تفعيل حجز المدرجات
              </p>
            </div>
            <Badge variant={dashboard.pendingTeachers.length > 0 ? "warning" : "success"} dot>
              {dashboard.pendingTeachers.length > 0
                ? `${formatArabicNumber(dashboard.pendingTeachers.length)} طلبات`
                : "مكتمل"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {dashboard.pendingTeachers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <p className="text-sm font-bold text-[var(--text-primary)]">
                لا توجد طلبات معلقة حالياً
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {dashboard.pendingTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0A1F44] font-mono text-xs font-bold text-cyan-200"
                      dir="ltr"
                    >
                      {teacher.teacherCode}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-[var(--text-primary)]">
                          {teacher.specialtyAr}
                        </span>
                        <Badge variant="warning">قيد المراجعة</Badge>
                        {teacher.experienceYears > 0 && (
                          <Badge variant="info">
                            خبرة {formatArabicNumber(teacher.experienceYears)} سنوات
                          </Badge>
                        )}
                      </div>
                      {teacher.qualificationsAr && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <Award className="h-3.5 w-3.5 text-[#2563EB]" />
                          <span>{teacher.qualificationsAr}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => {
                        setRejectTarget({ id: teacher.id, teacherCode: teacher.teacherCode });
                        setRejectReason("");
                      }}
                      leftIcon={<X className="h-4 w-4 text-red-500" />}
                    >
                      رفض
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      loading={approvingId === teacher.id}
                      onClick={() => handleApprove(teacher.id, teacher.teacherCode)}
                      leftIcon={<UserCheck className="h-4 w-4" />}
                    >
                      اعتماد ✓
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Faculty Directory with Compliance Score */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold">
            <Users className="h-4 w-4 text-[#2563EB]" />
            <span>سجل المعلمين المعتمدين</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-[var(--border-hairline)]">
            {approvedTeachers.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="mono" dir="ltr">
                    {t.teacherCode}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {t.specialtyAr}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {t.qualificationsAr ?? "مؤهل تربوي معتمد"} ·{" "}
                      {t.approvedAt ? `اعتمد ${formatCairoDate(t.approvedAt)}` : "مفعل"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="success">معتمد ✓</Badge>
                  <Badge variant="info">
                    الالتزام {formatArabicNumber(t.complianceScore ?? 100)}٪
                  </Badge>
                  {(t.totalDeductionsEgp ?? 0) > 0 && (
                    <Badge variant="danger">
                      خصومات {formatArabicNumber(t.totalDeductionsEgp ?? 0)} ج.م
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reject Reason Dialog */}
      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض طلب اعتماد المعلم ({rejectTarget?.teacherCode})</DialogTitle>
            <DialogDescription>
              أوضح سبب الرفض ليظهر للمعلم في إشعاره دون نشر أي بيانات عامة.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmReject} className="mt-4 flex flex-col gap-4">
            <Input
              label="سبب الرفض أو الاستكمال المطلوب"
              required
              minLength={3}
              placeholder="مثال: يرجى إرفاق شهادة التأهيل التربوي"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectTarget(null)}
              >
                إلغاء
              </Button>
              <Button type="submit" variant="danger" loading={rejecting}>
                تأكيد الرفض
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

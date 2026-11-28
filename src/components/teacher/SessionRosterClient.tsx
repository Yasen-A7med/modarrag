"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Laptop,
  MapPin,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  markStudentAttendanceAction,
  recordStudentComplianceAction,
  type AttendanceStudentEntry,
  type SessionAttendanceData,
} from "@/application/attendance/actions";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { MotionReveal } from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { calculatePenaltyDeduction } from "@/domain/finance/revenue";
import {
  formatArabicNumber,
  formatCairoDate,
  formatCairoTimeRange,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface SessionRosterClientProps {
  readonly schoolSlug: string;
  readonly initialData: SessionAttendanceData;
}

/**
 * Slide 5 Blueprint: Frictionless Name-Based Attendance Roster with giant `X / Y`
 * tabular counter, wide search pill, 1-tap green present toggle, and optional
 * punctuality / absence deduction logging.
 */
export function SessionRosterClient({
  schoolSlug,
  initialData,
}: SessionRosterClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [students, setStudents] = React.useState<readonly AttendanceStudentEntry[]>(
    initialData.students
  );
  const [query, setQuery] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const confirmedRoster = React.useMemo(
    () => students.filter((s) => s.status !== "waitlisted"),
    [students]
  );
  const waitlistedRoster = React.useMemo(
    () => students.filter((s) => s.status === "waitlisted"),
    [students]
  );

  const checkedInCount = confirmedRoster.filter(
    (s) => s.status === "checked_in"
  ).length;

  const filteredConfirmed = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return confirmedRoster;
    return confirmedRoster.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.seatNumber && s.seatNumber.toLowerCase().includes(q))
    );
  }, [confirmedRoster, query]);

  const handleTogglePresent = async (entry: AttendanceStudentEntry) => {
    const nextPresent = entry.status !== "checked_in";
    setBusyId(entry.bookingId);
    try {
      const res = await markStudentAttendanceAction({
        schoolSlug,
        sessionId: initialData.session.id,
        bookingId: entry.bookingId,
        present: nextPresent,
      });
      if (!res.ok) {
        toast({
          title: "تعذر تحديث التحضير",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      setStudents((prev) =>
        prev.map((s) =>
          s.bookingId === entry.bookingId
            ? {
                ...s,
                status: res.data.status,
                checkedInAt: res.data.checkedInAt,
              }
            : s
        )
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleRecordCompliance = async (
    entry: AttendanceStudentEntry,
    flag: "late" | "absent_deducted"
  ) => {
    const basePrice = Math.max(50, initialData.session.priceEgp || 50);
    const deduction = calculatePenaltyDeduction({
      baseAmountEgp: basePrice,
      eventType: flag === "late" ? "student_late" : "student_absent",
    });

    setBusyId(entry.bookingId);
    try {
      const res = await recordStudentComplianceAction({
        schoolSlug,
        sessionId: initialData.session.id,
        bookingId: entry.bookingId,
        attendanceFlag: flag,
        lateMinutes: flag === "late" ? 15 : 0,
        deductionEgp: deduction,
      });
      if (!res.ok) {
        toast({
          title: "تعذر تسجيل الالتزام",
          description: res.error.message,
          variant: "error",
        });
        return;
      }

      setStudents((prev) =>
        prev.map((s) =>
          s.bookingId === entry.bookingId
            ? {
                ...s,
                attendanceFlag: res.data.flag,
                lateMinutes: flag === "late" ? 15 : 0,
                deductionEgp: res.data.deductionEgp,
                status: flag === "absent_deducted" ? "no_show" : "checked_in",
              }
            : s
        )
      );

      toast({
        title:
          flag === "late"
            ? `تم تسجيل تأخير (${formatArabicNumber(deduction)} ج.م)`
            : `تم تسجيل غياب بخصم (${formatArabicNumber(deduction)} ج.م)`,
        variant: "warning",
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const { session } = initialData;
  const isOnline = session.deliveryMode === "online";

  return (
    <div className="flex flex-col gap-6">
      {/* Slide 5 Giant Header Counter */}
      <MotionReveal className="flex flex-col gap-4 rounded-[2rem] bg-[#0A1F44] p-5 sm:p-7 text-white sm:flex-row sm:items-center sm:justify-between shadow-[0_20px_48px_-18px_rgba(10,31,68,0.45)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="mono"
              className="border-cyan-400/35 bg-cyan-400/15 text-cyan-200"
            >
              {session.subjectNameAr}
            </Badge>
            <Badge
              variant="info"
              className="border-white/20 bg-white/10 text-white"
            >
              {isOnline ? (
                <span className="inline-flex items-center gap-1">
                  <Laptop className="h-3.5 w-3.5" /> أونلاين
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {session.hallNameAr}
                </span>
              )}
            </Badge>
          </div>

          <h1 className="mt-2 text-2xl font-extrabold text-white">
            {session.titleAr}
          </h1>
          <p className="mt-1 text-xs text-slate-300 tabular-nums">
            {formatCairoDate(session.startsAt)} ·{" "}
            {formatCairoTimeRange(session.startsAt, session.endsAt)}
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-end">
            <span className="block text-xs font-semibold text-cyan-200">
              الحضور الفعلي
            </span>
            <p className="text-3xl font-extrabold text-white tabular-nums" dir="ltr">
              {formatArabicNumber(checkedInCount)}{" "}
              <span className="text-cyan-300">/ {formatArabicNumber(confirmedRoster.length)}</span>
            </p>
          </div>
          <RadialGauge
            value={checkedInCount}
            max={Math.max(1, confirmedRoster.length)}
            size={68}
            strokeWidth={6}
            tone="cyan"
            className="text-white"
          />
        </div>
      </MotionReveal>

      {/* Wide Pill Search + Back Link */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          inputSize="lg"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم الطالب..."
          startAdornment={<Search className="h-5 w-5" />}
          containerClassName="flex-1"
        />

        <Link
          href={`/s/${schoolSlug}/teacher`}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "shrink-0",
          })}
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة للجدول</span>
        </Link>
      </div>

      {/* Responsive Student Attendance Cards */}
      {filteredConfirmed.length === 0 ? (
        <Card className="rounded-3xl p-10 text-center">
          <UserCheck className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
          <h2 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
            {query ? "لا يوجد طالب مطابق لاسم البحث" : "لا يوجد طلاب مسجلون بعد"}
          </h2>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredConfirmed.map((student) => {
            const isPresent = student.status === "checked_in";
            const isAbsentDeducted = student.attendanceFlag === "absent_deducted";
            const isLate = student.attendanceFlag === "late";
            const isBusy = busyId === student.bookingId;

            return (
              <Card
                key={student.bookingId}
                className={cn(
                  "flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                  isPresent &&
                    "border-emerald-300 bg-emerald-50/45 dark:border-emerald-500/35 dark:bg-emerald-500/10",
                  isAbsentDeducted &&
                    "border-red-300 bg-red-50/45 dark:border-red-500/35 dark:bg-red-500/10"
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-[var(--text-primary)]">
                      {student.fullName}
                    </span>
                    {student.seatNumber && (
                      <Badge variant="mono" dir="ltr">
                        {student.seatNumber}
                      </Badge>
                    )}
                    {isLate && (
                      <Badge variant="warning">
                        تأخير {formatArabicNumber(student.lateMinutes)} د (-{formatArabicNumber(student.deductionEgp)} ج.م)
                      </Badge>
                    )}
                    {isAbsentDeducted && (
                      <Badge variant="danger">
                        تغيب بخصم (-{formatArabicNumber(student.deductionEgp)} ج.م)
                      </Badge>
                    )}
                  </div>
                  {student.phone && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)] tabular-nums" dir="ltr">
                      {student.phone}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => handleRecordCompliance(student, "late")}
                    leftIcon={<Clock className="h-3.5 w-3.5 text-amber-600" />}
                  >
                    تأخير
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => handleRecordCompliance(student, "absent_deducted")}
                    leftIcon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                  >
                    غياب
                  </Button>

                  <Button
                    size="md"
                    variant={isPresent ? "emerald" : "primary"}
                    loading={isBusy}
                    onClick={() => handleTogglePresent(student)}
                    leftIcon={<Check className="h-4 w-4" />}
                    className="min-w-[130px]"
                  >
                    {isPresent ? "حضر ✓" : "تسجيل حضور"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {waitlistedRoster.length > 0 && (
        <section className="mt-2 flex flex-col gap-2">
          <h2 className="text-sm font-bold text-[var(--text-muted)]">
            قائمة الانتظار ({formatArabicNumber(waitlistedRoster.length)})
          </h2>
          {waitlistedRoster.map((student) => (
            <Card key={student.bookingId} className="flex items-center justify-between p-3.5 opacity-80">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {student.fullName}
                </span>
              </div>
              <Badge variant="warning">
                انتظار #{formatArabicNumber(student.waitlistPosition ?? 1)}
              </Badge>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

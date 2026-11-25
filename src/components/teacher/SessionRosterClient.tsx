"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import {
  markStudentAttendanceAction,
  type AttendanceStudentEntry,
  type SessionAttendanceData,
} from "@/application/attendance/actions";
import {
  AnimatedFilterTabs,
  MotionMetricBar,
  MotionReveal,
  SPRING_EASE,
  TACTILE_SPRING,
} from "@/components/motion/MotionPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import {
  formatArabicNumber,
  formatCairoDate,
  formatCairoTime,
  formatCairoTimeRange,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface SessionRosterClientProps {
  readonly schoolSlug: string;
  readonly initialData: SessionAttendanceData;
}

type RosterFilter = "all" | "pending" | "present";

/** Normalizes Arabic text so search matches reliably regardless of hamza, taa marbuta, or diacritics. */
function normalizeArabicSearch(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

/**
 * Simple, elderly-friendly Teacher Name Attendance Checklist:
 * search student by name, filter All / Not Yet Present / Present,
 * and mark/undo attendance in one generous tap with optimistic UI feedback.
 */
export function SessionRosterClient({
  schoolSlug,
  initialData,
}: SessionRosterClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [overrides, setOverrides] = React.useState<
    Readonly<
      Record<string, Pick<AttendanceStudentEntry, "status" | "checkedInAt">>
    >
  >({});
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<RosterFilter>("all");
  const [pendingBookingId, setPendingBookingId] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const students = React.useMemo(
    () =>
      initialData.students.map((entry) => {
        const patch = overrides[entry.bookingId];
        return patch ? { ...entry, ...patch } : entry;
      }),
    [initialData.students, overrides]
  );

  const { session } = initialData;

  const registeredStudents = React.useMemo(
    () => students.filter((s) => s.status !== "waitlisted"),
    [students]
  );

  const presentCount = React.useMemo(
    () => registeredStudents.filter((s) => s.status === "checked_in").length,
    [registeredStudents]
  );

  const notYetPresentCount = React.useMemo(
    () =>
      registeredStudents.filter(
        (s) => s.status === "confirmed" || s.status === "no_show"
      ).length,
    [registeredStudents]
  );

  const presentPct =
    registeredStudents.length > 0
      ? Math.round((presentCount / registeredStudents.length) * 100)
      : 0;

  const normalizedQuery = normalizeArabicSearch(query);

  const visibleStudents = React.useMemo(() => {
    return students.filter((entry) => {
      if (filter === "present" && entry.status !== "checked_in") {
        return false;
      }
      if (
        filter === "pending" &&
        entry.status !== "confirmed" &&
        entry.status !== "no_show"
      ) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = normalizeArabicSearch(
        `${entry.fullName} ${entry.phone ?? ""} ${entry.seatNumber ?? ""}`
      );
      return haystack.includes(normalizedQuery);
    });
  }, [filter, normalizedQuery, students]);

  const handleToggleAttendance = async (
    entry: AttendanceStudentEntry,
    markPresent: boolean
  ) => {
    if (pendingBookingId) return;

    const prevOverrides = overrides;
    const optimisticTime = markPresent ? new Date().toISOString() : null;

    setPendingBookingId(entry.bookingId);
    setOverrides((prev) => ({
      ...prev,
      [entry.bookingId]: {
        status: markPresent ? "checked_in" : "confirmed",
        checkedInAt: optimisticTime,
      },
    }));

    try {
      const result = await markStudentAttendanceAction({
        schoolSlug,
        sessionId: session.id,
        bookingId: entry.bookingId,
        present: markPresent,
      });

      if (!result.ok) {
        setOverrides(prevOverrides);
        toast({
          title: "تعذر تحديث الحضور",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      setOverrides((prev) => ({
        ...prev,
        [entry.bookingId]: {
          status: result.data.status,
          checkedInAt: result.data.checkedInAt,
        },
      }));

      toast({
        title: markPresent
          ? `تم تحضير: ${entry.fullName}`
          : `تم التراجع عن تحضير: ${entry.fullName}`,
        variant: markPresent ? "success" : "info",
      });
      router.refresh();
    } catch {
      setOverrides(prevOverrides);
      toast({
        title: "خطأ في الاتصال",
        description: "يرجى المحاولة مرة أخرى.",
        variant: "error",
      });
    } finally {
      setPendingBookingId(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Navigation Back + Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/s/${schoolSlug}/teacher`}
          className={buttonVariants({ variant: "outline", size: "md" })}
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة لحصصي</span>
        </Link>

        <Button
          variant="outline"
          size="md"
          onClick={handleRefresh}
          leftIcon={
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          }
        >
          تحديث الأسماء
        </Button>
      </div>

      {/* Clear Session Header & Prominent Attendance Counter with 3D Slate Art */}
      <MotionReveal className="ambient-mesh rounded-3xl border border-[var(--border-hairline)] hairline-lift">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="art-pedestal h-16 w-16 shrink-0 overflow-hidden rounded-2xl p-1">
                <Image
                  src="/images/step-attend-3d.webp"
                  alt="كشف الحضور بالاسم"
                  width={64}
                  height={64}
                  className="h-full w-full rounded-xl object-cover"
                />
              </div>
              <div>
                {session.subjectNameAr && (
                  <Badge variant="primary" size="md" className="mb-2">
                    {session.subjectNameAr}
                  </Badge>
                )}
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                  كشف الحضور: {session.titleAr}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-base text-[var(--text-secondary)]">
                  {session.hallNameAr && (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                      <MapPin className="h-4 w-4 text-[var(--text-muted)]" />
                      {session.hallNameAr}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                    {formatCairoDate(session.startsAt, { includeWeekday: true })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                    {formatCairoTimeRange(session.startsAt, session.endsAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-[#16A34A]/35 bg-emerald-50/85 px-5 py-3.5 text-center shadow-xs dark:border-emerald-500/40 dark:bg-emerald-500/12">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                إجمالي الحضور الآن
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">
                حضر {formatArabicNumber(presentCount)} من{" "}
                {formatArabicNumber(registeredStudents.length)} طالب
              </p>
            </div>
          </div>

          <MotionMetricBar
            percentage={presentPct}
            trackClassName="h-2.5"
            barClassName="bg-gradient-to-l from-[#10B981] to-[#16A34A]"
          />
        </div>
      </MotionReveal>

      {/* Semantic Name Search (<search><form>) + 3 Animated Filter Pills */}
      <Card className="rounded-3xl">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <search>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="relative flex items-center"
            >
              <label htmlFor="student-name-search" className="sr-only">
                ابحث باسم الطالب
              </label>
              <Search className="pointer-events-none absolute start-4 h-5 w-5 text-[var(--text-muted)]" />
              <input
                id="student-name-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="اكتب اسم الطالب للبحث السريع..."
                className="h-[54px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] ps-12 pe-12 text-base font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#0B63CE] focus:outline-none focus:ring-2 focus:ring-[#0B63CE]/25"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute end-1.5 inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="مسح البحث"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </form>
          </search>

          <AnimatedFilterTabs
            layoutId="roster-filter-pill"
            ariaLabel="تصفية قائمة الطلاب"
            value={filter}
            onChange={setFilter}
            activePillClassName={
              filter === "present"
                ? "bg-[#16A34A] dark:bg-emerald-600"
                : "bg-[#0B63CE] dark:bg-blue-600"
            }
            options={[
              {
                id: "all",
                label: `الكل (${formatArabicNumber(students.length)})`,
              },
              {
                id: "pending",
                label: `لم يحضر (${formatArabicNumber(notYetPresentCount)})`,
              },
              {
                id: "present",
                label: `حضر ✓ (${formatArabicNumber(presentCount)})`,
              },
            ]}
          />
        </div>
      </Card>

      {/* Responsive Container-Friendly Student Attendance List */}
      {visibleStudents.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="art-pedestal h-24 w-24 overflow-hidden rounded-2xl p-1.5">
              <Image
                src="/images/empty-calm-3d.webp"
                alt="لا يوجد طلاب مطابقون"
                width={96}
                height={96}
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {students.length === 0
                ? "لا يوجد طلاب مسجلون في هذه الحصة حتى الآن"
                : "لا يوجد اسم مطابق للبحث"}
            </p>
            {query && (
              <Button variant="outline" size="md" onClick={() => setQuery("")}>
                عرض جميع الأسماء
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleStudents.map((entry, idx) => {
            const isPresent = entry.status === "checked_in";
            const isWaitlisted = entry.status === "waitlisted";
            const isBusy = pendingBookingId === entry.bookingId;

            return (
              <motion.div
                key={entry.bookingId}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  delay: Math.min(idx * 0.025, 0.25),
                  ease: SPRING_EASE,
                }}
                className={cn(
                  "hover-lift-card flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 hairline-lift transition-colors",
                  isPresent
                    ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/12"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <motion.span
                    animate={isPresent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                    transition={TACTILE_SPRING}
                    className={cn(
                      "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isPresent
                        ? "bg-[#16A34A] text-white shadow-xs"
                        : "bg-[var(--bg-sunken)] text-[var(--text-muted)]"
                    )}
                    aria-hidden="true"
                  >
                    <UserCheck className="h-6 w-6" />
                  </motion.span>

                  <div className="min-w-0">
                    <p className="text-lg font-bold text-[var(--text-primary)]">
                      {entry.fullName}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
                      {entry.phone && (
                        <span className="inline-flex items-center gap-1 tabular-nums" dir="ltr">
                          <Phone className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          {entry.phone}
                        </span>
                      )}
                      {entry.seatNumber && (
                        <span className="font-medium">مقعد {entry.seatNumber}</span>
                      )}
                      {isPresent && entry.checkedInAt && (
                        <span className="font-semibold text-[#16A34A] dark:text-emerald-400">
                          حضر الساعة {formatCairoTime(entry.checkedInAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Giant 1-Tap Action */}
                <div className="shrink-0">
                  {isWaitlisted ? (
                    <Badge variant="warning" size="md">
                      قائمة انتظار (رقم {formatArabicNumber(entry.waitlistPosition ?? 1)})
                    </Badge>
                  ) : isPresent ? (
                    <div className="flex items-center justify-between gap-2.5 sm:justify-end">
                      <span className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-emerald-100 px-4 text-base font-bold text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">
                        <Check className="h-5 w-5" />
                        <span>حضر</span>
                      </span>
                      <Button
                        variant="outline"
                        size="md"
                        loading={isBusy}
                        disabled={pendingBookingId !== null}
                        onClick={() => handleToggleAttendance(entry, false)}
                        leftIcon={<RotateCcw className="h-4 w-4" />}
                      >
                        تراجع
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="emerald"
                      size="lg"
                      fullWidth
                      loading={isBusy}
                      disabled={pendingBookingId !== null}
                      onClick={() => handleToggleAttendance(entry, true)}
                      leftIcon={<Check className="h-5 w-5" />}
                    >
                      ✓ حضر
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

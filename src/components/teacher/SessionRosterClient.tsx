"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  QrCode,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import type { SessionRosterEntry } from "@/application/sessions/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { BookingStatus } from "@/infrastructure/supabase/database.types";
import { BOOKING_STATUS_TONES, type BadgeTone } from "@/lib/design-tokens";
import {
  BOOKING_STATUS_LABELS,
  formatArabicNumber,
  formatCairoDate,
  formatCairoTime,
  formatCairoTimeRange,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";

function resolveBookingBadge(status: string): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  if (status in BOOKING_STATUS_LABELS) {
    const typed = status as BookingStatus;
    return {
      label: BOOKING_STATUS_LABELS[typed].ar,
      tone: BOOKING_STATUS_TONES[typed],
    };
  }
  return { label: status, tone: "neutral" };
}

export interface RosterSessionSummary {
  readonly id: string;
  readonly titleAr: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly maxCapacity: number;
  readonly bookedSeatsCount: number;
  readonly hallCode: string;
  readonly subjectCode: string;
}

export interface SessionRosterClientProps {
  readonly schoolSlug: string;
  readonly session: RosterSessionSummary | null;
  readonly sessionId: string;
  readonly roster: readonly SessionRosterEntry[];
}

type RosterFilter = "all" | "confirmed" | "checked_in" | "waitlisted" | "no_show";

/**
 * Live student roster table for a teacher session with search by student code,
 * attendance status badges, seat numbers, check-in timestamps, and gate scanner link.
 */
export function SessionRosterClient({
  schoolSlug,
  session,
  sessionId,
  roster,
}: SessionRosterClientProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<RosterFilter>("all");
  const [refreshing, setRefreshing] = React.useState(false);

  const counts = React.useMemo(() => {
    let confirmed = 0;
    let checkedIn = 0;
    let waitlisted = 0;
    let noShow = 0;
    for (const row of roster) {
      if (row.status === "confirmed") confirmed++;
      else if (row.status === "checked_in") checkedIn++;
      else if (row.status === "waitlisted") waitlisted++;
      else if (row.status === "no_show") noShow++;
    }
    return { confirmed, checkedIn, waitlisted, noShow };
  }, [roster]);

  const filteredRoster = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return roster.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) {
        return false;
      }
      if (!normalized) return true;
      return (
        entry.studentLabel.toLowerCase().includes(normalized) ||
        (entry.seatNumber?.toLowerCase().includes(normalized) ?? false)
      );
    });
  }, [query, roster, statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 450);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header Summary Card */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/s/${schoolSlug}/teacher`}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>العودة للجدول</span>
              </Link>
              {session && (
                <>
                  <Badge variant="mono" dir="ltr">
                    {session.hallCode}
                  </Badge>
                  <Badge variant="mono" dir="ltr">
                    {session.subjectCode}
                  </Badge>
                </>
              )}
            </div>

            <h1 className="mt-2 text-lg font-bold text-[var(--text-primary)] sm:text-xl">
              {session?.titleAr ?? "كشف حضور الحصة"}
            </h1>

            {session ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>{formatCairoDate(session.startsAt, { includeWeekday: true })}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>{formatCairoTimeRange(session.startsAt, session.endsAt)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Users className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>
                    {formatArabicNumber(session.bookedSeatsCount)} /{" "}
                    {formatArabicNumber(session.maxCapacity)} مقعد
                  </span>
                </span>
              </div>
            ) : (
              <p className="mt-1 font-mono text-xs text-[var(--text-muted)]" dir="ltr">
                Session: {sessionId}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="md"
              className="min-h-[44px]"
              onClick={handleRefresh}
              leftIcon={
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              }
            >
              تحديث الكشف
            </Button>
            <Link
              href={`/s/${schoolSlug}/scanner`}
              className={buttonVariants({
                variant: "primary",
                size: "md",
                className: "min-h-[44px]",
              })}
            >
              <QrCode className="h-4 w-4" />
              <span>فتح ماسح البوابة</span>
            </Link>
          </div>
        </div>
      </Card>

      {/* Attendance Breakdown Pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5">
          <span className="text-xs text-[var(--text-muted)]">إجمالي الكشف</span>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(roster.length)}
          </p>
        </Card>
        <Card className="p-3.5">
          <span className="text-xs text-emerald-700 dark:text-emerald-400">تم الحضور</span>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(counts.checkedIn)}
          </p>
        </Card>
        <Card className="p-3.5">
          <span className="text-xs text-blue-700 dark:text-blue-400">مؤكد (بانتظار البوابة)</span>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(counts.confirmed)}
          </p>
        </Card>
        <Card className="p-3.5">
          <span className="text-xs text-amber-700 dark:text-amber-400">قائمة الانتظار</span>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(counts.waitlisted)}
          </p>
        </Card>
      </div>

      {/* Filter & Search Toolbar + Roster Table */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base">قائمة الطلاب المسجلين</CardTitle>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث بكود الطالب أو رقم المقعد..."
                startAdornment={<Search className="h-4 w-4" />}
                containerClassName="sm:w-64"
              />
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: "all", label: "الكل" },
                    { key: "checked_in", label: "حاضر" },
                    { key: "confirmed", label: "مؤكد" },
                    { key: "waitlisted", label: "انتظار" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={cn(
                      "min-h-[38px] rounded-md border px-3 text-xs font-medium cursor-pointer transition-colors",
                      statusFilter === tab.key
                        ? "border-[#1E3A8A] bg-[#1E3A8A] text-white dark:border-blue-500 dark:bg-blue-600"
                        : "border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredRoster.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <CheckCircle2 className="h-7 w-7 text-[var(--text-muted)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                لا توجد سجلات مطابقة للبحث
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                تأكد من إزالة الفلتر أو البحث بكود طالب آخر.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View (< md) — Zero horizontal overflow */}
              <div className="divide-y divide-[var(--border-hairline)] md:hidden">
                {filteredRoster.map((entry) => {
                  const badge = resolveBookingBadge(entry.status);
                  return (
                    <div key={entry.bookingId} className="flex flex-col gap-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {entry.studentLabel}
                        </span>
                        <Badge variant={badge.tone} dot>
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="font-mono font-semibold" dir="ltr">
                          المقعد: {entry.seatNumber ?? "قيد التخصيص"}
                        </span>
                        <span className="tabular-nums">
                          {entry.checkedInAt
                            ? `حضر: ${formatCairoTime(entry.checkedInAt)}`
                            : `حجز: ${formatCairoTime(entry.bookedAt)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-start text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)] text-xs font-semibold text-[var(--text-muted)]">
                      <th className="px-4 py-3 text-start">كود الطالب</th>
                      <th className="px-4 py-3 text-start">رقم المقعد</th>
                      <th className="px-4 py-3 text-start">حالة الحضور</th>
                      <th className="px-4 py-3 text-start">توقيت الحجز</th>
                      <th className="px-4 py-3 text-start">توقيت التحضير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {filteredRoster.map((entry) => {
                      const badge = resolveBookingBadge(entry.status);
                      return (
                        <tr
                          key={entry.bookingId}
                          className="transition-colors hover:bg-[var(--bg-sunken)]/50"
                        >
                          <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                            {entry.studentLabel}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                            {entry.seatNumber ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={badge.tone} dot>
                              {badge.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-secondary)] tabular-nums">
                            {formatCairoDate(entry.bookedAt)} · {formatCairoTime(entry.bookedAt)}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-secondary)] tabular-nums">
                            {entry.checkedInAt
                              ? formatCairoTime(entry.checkedInAt)
                              : "لم يمسح بعد"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

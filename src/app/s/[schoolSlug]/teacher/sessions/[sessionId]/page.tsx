import Link from "next/link";
import { AlertCircle } from "lucide-react";
import {
  getTeacherConsoleData,
  getTeacherSessionRoster,
} from "@/application/sessions/actions";
import {
  SessionRosterClient,
  type RosterSessionSummary,
} from "@/components/teacher/SessionRosterClient";
import {
  TeacherAccessNotice,
  TeacherSubNav,
} from "@/components/teacher/TeacherDashboardClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export interface TeacherSessionRosterPageProps {
  readonly params: Promise<{
    readonly schoolSlug: string;
    readonly sessionId: string;
  }>;
}

export default async function TeacherSessionRosterPage({
  params,
}: TeacherSessionRosterPageProps) {
  const { schoolSlug, sessionId } = await params;

  const [consoleResult, rosterResult] = await Promise.all([
    getTeacherConsoleData(schoolSlug),
    getTeacherSessionRoster(schoolSlug, sessionId),
  ]);

  if (!consoleResult.ok) {
    return (
      <TeacherAccessNotice
        schoolSlug={schoolSlug}
        errorCode={consoleResult.error.code}
        errorMessage={consoleResult.error.message}
      />
    );
  }

  if (!rosterResult.ok) {
    return (
      <div>
        <TeacherSubNav schoolSlug={schoolSlug} />
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <CardTitle className="text-base">تعذر تحميل كشف الحصة</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {rosterResult.error.message}
            </p>
            <div>
              <Link
                href={`/s/${schoolSlug}/teacher`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#1E3A8A] bg-[#1E3A8A] px-4 text-sm font-medium text-white transition-colors hover:border-[#1D4ED8] hover:bg-[#1D4ED8] dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                العودة لجدول المعلم
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const matchedSession = consoleResult.data.sessions.find((s) => s.id === sessionId);
  let sessionSummary: RosterSessionSummary | null = matchedSession
    ? {
        id: matchedSession.id,
        titleAr: matchedSession.titleAr,
        startsAt: matchedSession.startsAt,
        endsAt: matchedSession.endsAt,
        maxCapacity: matchedSession.maxCapacity,
        bookedSeatsCount: matchedSession.bookedSeatsCount,
        hallCode: matchedSession.hallCode,
        subjectCode: matchedSession.subjectCode,
      }
    : null;

  if (!sessionSummary) {
    const supabase = await createSupabaseServerClient();
    const { data: row } = await supabase
      .from("sessions")
      .select(
        `
        id, title_ar, starts_at, ends_at, max_capacity, booked_seats_count,
        halls!sessions_hall_id_fkey ( code ),
        subjects!sessions_subject_id_fkey ( code )
      `
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (row) {
      const hall = row.halls as unknown as { code: string } | null;
      const subject = row.subjects as unknown as { code: string } | null;
      sessionSummary = {
        id: row.id,
        titleAr: row.title_ar,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        maxCapacity: row.max_capacity,
        bookedSeatsCount: row.booked_seats_count,
        hallCode: hall?.code ?? "",
        subjectCode: subject?.code ?? "",
      };
    }
  }

  return (
    <div>
      <TeacherSubNav schoolSlug={schoolSlug} />
      <SessionRosterClient
        schoolSlug={schoolSlug}
        session={sessionSummary}
        sessionId={sessionId}
        roster={rosterResult.data}
      />
    </div>
  );
}

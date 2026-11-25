import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getSessionAttendanceData } from "@/application/attendance/actions";
import { SessionRosterClient } from "@/components/teacher/SessionRosterClient";
import {
  TeacherAccessNotice,
  TeacherSubNav,
} from "@/components/teacher/TeacherDashboardClient";
import { buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

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
  const result = await getSessionAttendanceData(schoolSlug, sessionId);

  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED" || result.error.code === "FORBIDDEN") {
      return (
        <TeacherAccessNotice
          schoolSlug={schoolSlug}
          errorCode={result.error.code}
          errorMessage={result.error.message}
        />
      );
    }

    return (
      <div>
        <TeacherSubNav schoolSlug={schoolSlug} />
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              <CardTitle className="text-xl">تعذر فتح كشف الحضور</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-base text-[var(--text-secondary)]">
              {result.error.message}
            </p>
            <div>
              <Link
                href={`/s/${schoolSlug}/teacher`}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                العودة لحصص المعلم
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <TeacherSubNav schoolSlug={schoolSlug} />
      <SessionRosterClient
        schoolSlug={schoolSlug}
        initialData={result.data}
      />
    </div>
  );
}

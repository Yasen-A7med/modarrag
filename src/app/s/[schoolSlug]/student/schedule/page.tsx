import { redirect } from "next/navigation";

export interface StudentSchedulePageProps {
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

/**
 * Unified student experience: bookings and available sessions live on one clean screen.
 */
export default async function StudentSchedulePage({
  params,
}: StudentSchedulePageProps) {
  const { schoolSlug } = await params;
  redirect(`/s/${schoolSlug}/student`);
}

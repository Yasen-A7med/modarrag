import { notFound } from "next/navigation";
import { getCurrentUserContext } from "@/application/auth/actions";
import { SchoolShell } from "@/components/layout/SchoolShell";
import { getSchoolBySlug } from "@/infrastructure/supabase/catalog";
import { getUserRoleLabel } from "@/lib/formatters";

export interface SchoolLayoutProps {
  readonly children: React.ReactNode;
  readonly params: Promise<{ readonly schoolSlug: string }>;
}

export default async function SchoolSlugLayout({
  children,
  params,
}: SchoolLayoutProps) {
  const { schoolSlug } = await params;
  const [school, userCtx] = await Promise.all([
    getSchoolBySlug(schoolSlug),
    getCurrentUserContext().catch(() => null),
  ]);

  if (!school) {
    notFound();
  }

  return (
    <SchoolShell
      school={{
        slug: school.slug,
        nameAr: school.name_ar,
        governorate: school.governorate,
        directorate: school.directorate,
        logoUrl: school.logo_url || "/tenants/ali-bin-abi-talib/logo.svg",
        defaultBufferMinutes: school.default_buffer_minutes,
      }}
      userContext={
        userCtx
          ? {
              role: userCtx.role,
              roleLabelAr: getUserRoleLabel(userCtx.role, "ar"),
              codeLabel: userCtx.fullName,
            }
          : null
      }
    >
      {children}
    </SchoolShell>
  );
}

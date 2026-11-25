import type { Metadata } from "next";
import { getCurrentUserContext } from "@/application/auth/actions";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import {
  getActiveSchools,
  getSchoolCatalogBySlug,
  type SchoolCatalogBundle,
  type SchoolRow,
} from "@/infrastructure/supabase/catalog";
import { getUserRoleLabel } from "@/lib/formatters";

export const metadata: Metadata = {
  title: "اختيار المدرسة والمسار الدراسي",
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [schools, userCtx] = await Promise.all([
    getActiveSchools().catch((): readonly SchoolRow[] => []),
    getCurrentUserContext().catch(() => null),
  ]);

  const targetSlugs =
    schools.length > 0 ? schools.map((s) => s.slug) : ["ali-bin-abi-talib"];

  const catalogResults = await Promise.all(
    targetSlugs.map((slug) =>
      getSchoolCatalogBySlug(slug).catch((): SchoolCatalogBundle | null => null)
    )
  );

  const catalogs = catalogResults.filter(
    (bundle): bundle is SchoolCatalogBundle => bundle !== null
  );

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={[
          { href: "/", label: "الرئيسية" },
          { href: "/onboarding", label: "المسار الدراسي", active: true },
        ]}
        user={
          userCtx
            ? {
                role: userCtx.role,
                roleLabelAr: getUserRoleLabel(userCtx.role, "ar"),
                codeLabel: userCtx.fullName,
              }
            : null
        }
      />

      <main className="arch-grid-bg mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <OnboardingWizard
          catalogs={catalogs}
          initialFullName={userCtx?.fullName ?? ""}
          isAuthenticated={Boolean(userCtx)}
        />
      </main>
    </div>
  );
}

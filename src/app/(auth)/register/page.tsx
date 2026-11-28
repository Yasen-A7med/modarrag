import type { Metadata } from "next";
import { RegisterClient } from "@/components/auth/RegisterClient";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { isGoogleOAuthEnabled } from "@/lib/auth-providers";

export const metadata: Metadata = {
  title: "إنشاء حساب طالب جديد",
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const googleEnabled = await isGoogleOAuthEnabled();

  return (
    <div className="ambient-mesh min-h-dvh text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={[
          { href: "/", label: "الرئيسية" },
          { href: "/login", label: "تسجيل الدخول" },
        ]}
      />
      <main className="mx-auto flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-8 sm:px-6">
        <RegisterClient initialGoogleEnabled={googleEnabled} />
      </main>
    </div>
  );
}

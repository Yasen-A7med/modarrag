import type { Metadata } from "next";
import { LoginClient } from "@/components/auth/LoginClient";
import { TopNavbar } from "@/components/layout/TopNavbar";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={[
          { href: "/", label: "الرئيسية" },
          { href: "/onboarding", label: "تحديد المسار" },
        ]}
      />
      <main className="arch-grid-bg mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8 sm:px-6">
        <LoginClient />
      </main>
    </div>
  );
}

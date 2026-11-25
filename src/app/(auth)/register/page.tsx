import type { Metadata } from "next";
import { RegisterClient } from "@/components/auth/RegisterClient";
import { TopNavbar } from "@/components/layout/TopNavbar";

export const metadata: Metadata = {
  title: "إنشاء حساب طالب جديد",
};

export default function RegisterPage() {
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
        <RegisterClient />
      </main>
    </div>
  );
}

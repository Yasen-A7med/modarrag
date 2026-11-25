import type { Metadata } from "next";
import { RegisterClient } from "@/components/auth/RegisterClient";
import { TopNavbar } from "@/components/layout/TopNavbar";

export const metadata: Metadata = {
  title: "إنشاء حساب طالب",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={[
          { href: "/", label: "الرئيسية" },
          { href: "/login", label: "دخول" },
        ]}
      />
      <main className="arch-grid-bg mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8 sm:px-6">
        <RegisterClient />
      </main>
    </div>
  );
}

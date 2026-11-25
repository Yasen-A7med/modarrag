import type { Metadata } from "next";
import { LoginClient } from "@/components/auth/LoginClient";
import { TopNavbar } from "@/components/layout/TopNavbar";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
};

export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg-hero)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={[
          { href: "/", label: "الرئيسية" },
          { href: "/s/ali-bin-abi-talib", label: "المدرسة" },
        ]}
      />
      <main className="mx-auto flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-8 sm:px-6">
        <LoginClient />
      </main>
    </div>
  );
}

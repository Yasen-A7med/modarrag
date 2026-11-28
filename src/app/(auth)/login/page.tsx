import type { Metadata } from "next";
import { LoginClient } from "@/components/auth/LoginClient";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { isGoogleOAuthEnabled } from "@/lib/auth-providers";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
};

export const dynamic = "force-dynamic";

export interface LoginPageProps {
  readonly searchParams?: Promise<{ readonly error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const googleEnabled = await isGoogleOAuthEnabled();

  return (
    <div className="ambient-mesh min-h-dvh text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={[
          { href: "/", label: "الرئيسية" },
          { href: "/s/ali-bin-abi-talib", label: "المدرسة" },
        ]}
      />
      <main className="mx-auto flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-8 sm:px-6">
        <LoginClient
          initialGoogleEnabled={googleEnabled}
          initialErrorCode={resolvedParams.error ?? null}
        />
      </main>
    </div>
  );
}

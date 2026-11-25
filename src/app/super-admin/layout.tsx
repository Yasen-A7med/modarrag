import * as React from "react";
import { getCurrentUserContext } from "@/application/auth/actions";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { getUserRoleLabel } from "@/lib/formatters";

export interface SuperAdminLayoutProps {
  readonly children: React.ReactNode;
}

export default async function SuperAdminLayout({
  children,
}: SuperAdminLayoutProps) {
  const userCtx = await getCurrentUserContext().catch(() => null);

  const navLinks = [
    { href: "/super-admin", label: "النظرة الوطنية" },
    { href: "/super-admin/schools", label: "المدارس والإنشاء" },
    { href: "/super-admin/security-logs", label: "سجلات التدقيق" },
    { href: "/s/ali-bin-abi-talib", label: "بوابة علي بن أبي طالب" },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNavbar
        brandHref="/"
        links={navLinks}
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

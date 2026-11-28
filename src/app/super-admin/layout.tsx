import * as React from "react";
import { getCurrentUserContext } from "@/application/auth/actions";
import {
  PortalSidebarShell,
  type PortalSidebarNavItem,
} from "@/components/layout/PortalSidebarShell";
import { getUserRoleLabel } from "@/lib/formatters";

export interface SuperAdminLayoutProps {
  readonly children: React.ReactNode;
}

export default async function SuperAdminLayout({
  children,
}: SuperAdminLayoutProps) {
  const userCtx = await getCurrentUserContext().catch(() => null);

  const navItems: readonly PortalSidebarNavItem[] = [
    { href: "/super-admin", label: "النظرة الوطنية", icon: "building" },
    { href: "/super-admin/schools", label: "إنشاء مدرسة", icon: "plus" },
    { href: "/super-admin/security-logs", label: "سجلات التدقيق", icon: "shield" },
    { href: "/s/ali-bin-abi-talib", label: "المدرسة الافتراضية", icon: "home" },
  ];

  return (
    <PortalSidebarShell
      brandSubtitle="المركز الوطني — مُدَرَّج"
      schoolNameAr="القيادة الوطنية للمنصة"
      schoolMeta="المدارس · السناتر · الإيرادات"
      roleBadgeAr={
        userCtx ? getUserRoleLabel(userCtx.role, "ar") : "مشرف المنصة"
      }
      userCodeLabel={userCtx?.fullName ?? null}
      navItems={navItems}
      backHref="/"
      backLabel="الرئيسية"
    >
      {children}
    </PortalSidebarShell>
  );
}

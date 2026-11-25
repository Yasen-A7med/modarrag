"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, User, X } from "lucide-react";
import { signOutAction } from "@/application/auth/actions";
import { ModarragLogo } from "@/components/brand/ModarragLogo";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { UserRole } from "@/infrastructure/supabase/database.types";
import { cn } from "@/lib/utils";

export interface TopNavbarLink {
  readonly href: string;
  readonly label: string;
  readonly active?: boolean;
}

export interface TopNavbarUser {
  readonly role: UserRole;
  readonly roleLabelAr: string;
  readonly codeLabel?: string | null;
}

export interface TopNavbarProps {
  readonly brandHref?: string;
  readonly school?: {
    readonly slug: string;
    readonly nameAr: string;
    readonly logoUrl?: string | null;
  } | null;
  readonly links?: readonly TopNavbarLink[];
  readonly user?: TopNavbarUser | null;
  readonly onSignOut?: () => void | Promise<void>;
  readonly className?: string;
}

/**
 * Friendly floating pill navbar inspired by Bassthalk:
 * effortless contrast, zero noise, accessible 44-48px targets on desktop and mobile.
 */
export function TopNavbar({
  brandHref = "/",
  school,
  links = [],
  user,
  onSignOut,
  className,
}: TopNavbarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      if (onSignOut) {
        await onSignOut();
      } else {
        await signOutAction();
      }
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
      setMobileOpen(false);
    }
  };

  return (
    <header className={cn("sticky top-0 z-40 px-3 pt-3 sm:px-6", className)}>
      <div className="mx-auto max-w-6xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-4 shadow-sm backdrop-blur-md sm:px-5">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Brand + School Name */}
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={brandHref}
              className="inline-flex shrink-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B63CE]/40"
            >
              <ModarragLogo size="sm" showWordmark />
            </Link>

            {school && (
              <>
                <span
                  className="hidden h-5 w-px bg-[var(--border-hairline)] sm:inline-block"
                  aria-hidden="true"
                />
                <Link
                  href={`/s/${school.slug}`}
                  className="hidden min-w-0 items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] sm:inline-flex"
                >
                  {school.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={school.logoUrl}
                      alt={school.nameAr}
                      className="h-5 w-5 shrink-0 rounded-md object-contain"
                    />
                  )}
                  <span className="max-w-[220px] truncate">{school.nameAr}</span>
                </Link>
              </>
            )}
          </div>

          {/* Center Navigation Links (max 3 clear links) */}
          {links.length > 0 && (
            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="التنقل الرئيسي"
            >
              {links.slice(0, 4).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold transition-colors whitespace-nowrap",
                    item.active
                      ? "bg-[#EEF5FF] text-[#0B63CE] dark:bg-blue-500/15 dark:text-blue-300"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Theme Switcher & Auth CTA */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {user ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3.5 text-sm font-semibold text-[var(--text-primary)]">
                  <User className="h-4 w-4 shrink-0 text-[#0B63CE] dark:text-blue-400" />
                  <span className="max-w-[160px] truncate">
                    {user.codeLabel || user.roleLabelAr}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  loading={signingOut}
                  onClick={handleSignOut}
                  leftIcon={<LogOut className="h-4 w-4" />}
                >
                  خروج
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/login"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  دخول
                </Link>
                <Link
                  href="/register"
                  className={buttonVariants({ variant: "emerald", size: "sm" })}
                >
                  ابدأ الآن
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] md:hidden cursor-pointer"
              aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Drawer */}
        {mobileOpen && (
          <div className="border-t border-[var(--border-hairline)] py-3 md:hidden">
            {school && (
              <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
                {school.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={school.logoUrl}
                    alt={school.nameAr}
                    className="h-6 w-6 shrink-0 rounded-md object-contain"
                  />
                )}
                <span className="truncate">{school.nameAr}</span>
              </div>
            )}

            {links.length > 0 && (
              <nav className="flex flex-col gap-1.5" aria-label="قائمة الجوال">
                {links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex min-h-[48px] items-center rounded-xl px-4 text-base font-semibold",
                      item.active
                        ? "bg-[#EEF5FF] text-[#0B63CE] dark:bg-blue-500/15 dark:text-blue-300"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)]"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}

            <div className="mt-3 flex flex-col gap-2.5 border-t border-[var(--border-hairline)] pt-3 sm:hidden">
              {user ? (
                <>
                  <div className="flex items-center justify-between px-1 text-sm">
                    <span className="text-[var(--text-muted)]">الحساب الحالي</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {user.codeLabel || user.roleLabelAr}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    fullWidth
                    loading={signingOut}
                    onClick={handleSignOut}
                    leftIcon={<LogOut className="h-5 w-5" />}
                  >
                    تسجيل الخروج
                  </Button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className={buttonVariants({ variant: "outline", size: "md", fullWidth: true })}
                  >
                    دخول
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className={buttonVariants({ variant: "emerald", size: "md", fullWidth: true })}
                  >
                    حساب جديد
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

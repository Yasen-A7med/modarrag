"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export interface DirectorySchoolItem {
  readonly id: string;
  readonly slug: string;
  readonly nameAr: string;
  readonly governorate: string;
  readonly directorate: string;
  readonly logoUrl: string | null;
  readonly tenantType?: "school" | "center";
}

export interface SchoolDirectorySearchProps {
  readonly schools: readonly DirectorySchoolItem[];
}

/**
 * Interactive multi-tenant school & authorized center finder allowing students
 * to search by school name or governorate and enter their school portal in 1 click.
 */
export function SchoolDirectorySearch({ schools }: SchoolDirectorySearchProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.nameAr.toLowerCase().includes(q) ||
        s.governorate.toLowerCase().includes(q) ||
        s.directorate.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q)
    );
  }, [query, schools]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)] sm:text-2xl">
            ابحث عن مدرستك
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            اكتب اسم المدرسة أو المحافظة للدخول مباشرةً
          </p>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم المدرسة أو المحافظة..."
          aria-label="ابحث باسم المدرسة أو المحافظة"
          startAdornment={<Search className="h-4 w-4" />}
          containerClassName="w-full sm:w-80"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-muted)]">
          لا توجد مدرسة مطابقة لبحثك حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((school) => (
            <div
              key={school.id}
              className={cn(
                "hover-lift-card flex flex-col justify-between gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 hairline-lift"
              )}
            >
              <div className="flex items-start gap-3">
                {school.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={school.logoUrl}
                    alt={school.nameAr}
                    className="h-12 w-12 shrink-0 rounded-xl border border-[var(--border-hairline)] bg-white p-1 object-contain"
                  />
                ) : (
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0A1F44] text-cyan-300">
                    <Building2 className="h-6 w-6" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <Badge
                    variant={school.tenantType === "center" ? "info" : "success"}
                    size="sm"
                  >
                    {school.tenantType === "center" ? "سنتر تعليمي معتمد" : "مدرسة رسمية"}
                  </Badge>
                  <h3 className="mt-1.5 text-base font-bold leading-snug text-[var(--text-primary)]">
                    {school.nameAr}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {school.governorate} · {school.directorate}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-[var(--border-hairline)] pt-3">
                <Link
                  href={`/s/${school.slug}`}
                  className={buttonVariants({
                    variant: "primary",
                    size: "sm",
                    fullWidth: true,
                  })}
                >
                  <span>دخول البوابة</span>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

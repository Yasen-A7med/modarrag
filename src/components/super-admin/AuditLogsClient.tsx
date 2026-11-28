"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  ScrollText,
  Search,
} from "lucide-react";
import {
  getAuditLogs,
  type AuditLogEntry,
  type SuperAdminConsoleData,
} from "@/application/schools/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, SelectInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { BadgeTone } from "@/lib/design-tokens";
import { formatArabicNumber, formatCairoDate, formatCairoTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function resolveAuditActionTone(action: string): {
  readonly labelAr: string;
  readonly tone: BadgeTone;
} {
  const lower = action.toLowerCase();
  if (lower.includes("fail") || lower.includes("reject") || lower.includes("cancel") || lower.includes("absent")) {
    return { labelAr: "تنبيه / مرفوض", tone: "danger" };
  }
  if (lower.includes("update") || lower.includes("late") || lower.includes("reallocate") || lower.includes("compliance")) {
    return { labelAr: "تعديل / التزام", tone: "warning" };
  }
  return { labelAr: "عملية ناجحة", tone: "success" };
}

export interface AuditLogsClientProps {
  readonly schools: SuperAdminConsoleData["schools"];
  readonly initialLogs: readonly AuditLogEntry[];
}

/**
 * Slide 13 Blueprint: High-contrast Append-Only Security & Audit Logs table with
 * semantic severity pills (Green/Amber/Red), filter bar, and expandable JSON inspector.
 */
export function AuditLogsClient({ schools, initialLogs }: AuditLogsClientProps) {
  const { toast } = useToast();

  const [logs, setLogs] = React.useState<readonly AuditLogEntry[]>(initialLogs);
  const [selectedSchoolId, setSelectedSchoolId] = React.useState("");
  const [serverActionFilter, setServerActionFilter] = React.useState("");
  const [localKeyword, setLocalKeyword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);

  const schoolNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of schools) {
      map[s.id] = s.nameAr;
    }
    return map;
  }, [schools]);

  const fetchLogs = async (schoolIdVal: string, actionVal: string) => {
    setLoading(true);
    try {
      const trimmedAction = actionVal.trim();
      const result = await getAuditLogs({
        ...(schoolIdVal ? { schoolId: schoolIdVal } : {}),
        ...(trimmedAction ? { action: trimmedAction } : {}),
        limit: 100,
        offset: 0,
      });

      if (!result.ok) {
        toast({
          title: "تعذر تحميل السجلات",
          description: result.error.message,
          variant: "error",
        });
        return;
      }

      setLogs(result.data);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchLogs(selectedSchoolId, serverActionFilter);
  };

  const filteredLogs = React.useMemo(() => {
    const kw = localKeyword.trim().toLowerCase();
    if (!kw) return logs;
    return logs.filter((entry) => {
      const payloadStr = JSON.stringify(entry.details ?? {}).toLowerCase();
      return (
        entry.action.toLowerCase().includes(kw) ||
        entry.entityType.toLowerCase().includes(kw) ||
        entry.actorLabel.toLowerCase().includes(kw) ||
        payloadStr.includes(kw)
      );
    });
  }, [localKeyword, logs]);

  const handleCopyJson = async (details: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(details ?? {}, null, 2));
      toast({ title: "تم نسخ السجل ✓", variant: "success" });
    } catch {
      toast({ title: "تعذر النسخ التلقائي", variant: "warning" });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="mono" dir="ltr">
            SECURITY AUDIT LOGS
          </Badge>
          <h1 className="mt-1.5 text-2xl font-extrabold text-[var(--text-primary)]">
            سجلات الأمان والتدقيق
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            متابعة كافة الحجوزات وتعديلات الصلاحيات والالتزام عبر المنصة
          </p>
        </div>

        <Link
          href="/super-admin"
          className={buttonVariants({ variant: "outline", size: "md" })}
        >
          <ArrowRight className="h-4 w-4" />
          <span>النظرة الوطنية</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <form
          onSubmit={handleFilterSubmit}
          className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end"
        >
          <div className="md:col-span-4">
            <SelectInput
              label="تصفية حسب المدرسة"
              value={selectedSchoolId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedSchoolId(nextId);
                void fetchLogs(nextId, serverActionFilter);
              }}
            >
              <option value="">جميع المنشآت</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr}
                </option>
              ))}
            </SelectInput>
          </div>

          <div className="md:col-span-3">
            <Input
              label="نوع العملية"
              dir="ltr"
              placeholder="attendance_marked_present"
              value={serverActionFilter}
              onChange={(e) => setServerActionFilter(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <Input
              label="بحث فوري بالسجلات"
              placeholder="المستخدم أو الكيان أو التفاصيل..."
              value={localKeyword}
              onChange={(e) => setLocalKeyword(e.target.value)}
              startAdornment={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              تحديث
            </Button>
          </div>
        </form>
      </Card>

      {/* High-Contrast Responsive Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-extrabold">
              <ScrollText className="h-4 w-4 text-[#2563EB]" />
              <span>السجل المركزي ({formatArabicNumber(filteredLogs.length)})</span>
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--text-muted)]">
              لا توجد أحداث مسجلة مطابقة للبحث.
            </div>
          ) : (
            <div tabIndex={0} role="region" aria-label="سجل الأمان" className="table-wrapper">
              <table className="w-full min-w-[680px] border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#0A1F44] text-white">
                    <th className="px-4 py-3 text-start font-bold">التصنيف / العملية</th>
                    <th className="px-4 py-3 text-start font-bold">المستخدم</th>
                    <th className="px-4 py-3 text-start font-bold">المنشأة</th>
                    <th className="px-4 py-3 text-start font-bold">التاريخ والوقت</th>
                    <th className="px-4 py-3 text-end font-bold">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {filteredLogs.map((entry) => {
                    const severity = resolveAuditActionTone(entry.action);
                    const expanded = expandedLogId === entry.id;
                    return (
                      <React.Fragment key={entry.id}>
                        <tr className="hover:bg-[var(--bg-sunken)]/50">
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <Badge variant={severity.tone} size="sm" dot>
                                {severity.labelAr}
                              </Badge>
                              <span
                                dir="ltr"
                                className="font-mono text-[11px] font-semibold text-[var(--text-primary)]"
                              >
                                {entry.action}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">
                            {entry.actorLabel}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                            {entry.schoolId ? (schoolNameById[entry.schoolId] ?? "مدرسة") : "المنصة"}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-muted)] tabular-nums">
                            {formatCairoDate(entry.createdAt)} · {formatCairoTime(entry.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedLogId(expanded ? null : entry.id)}
                              leftIcon={
                                expanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )
                              }
                            >
                              {expanded ? "إخفاء" : "فحص"}
                            </Button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-[var(--bg-sunken)]">
                            <td colSpan={5} className="p-4">
                              <div className="flex items-center justify-between gap-2 pb-2">
                                <span className="text-xs font-bold text-[var(--text-muted)]">
                                  بيانات السجل (JSON)
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCopyJson(entry.details)}
                                  leftIcon={<Copy className="h-3.5 w-3.5" />}
                                >
                                  نسخ
                                </Button>
                              </div>
                              <pre
                                dir="ltr"
                                className={cn(
                                  "max-h-56 overflow-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 font-mono text-[11px] text-[var(--text-primary)]"
                                )}
                              >
                                {JSON.stringify(entry.details ?? {}, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
import { formatArabicNumber, formatCairoDate, formatCairoTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface AuditLogsClientProps {
  readonly schools: SuperAdminConsoleData["schools"];
  readonly initialLogs: readonly AuditLogEntry[];
}

/**
 * Filterable append-only Security & Audit Logs console for Super Admins
 * with school & action filtering plus expandable JSON payload inspector.
 */
export function AuditLogsClient({ schools, initialLogs }: AuditLogsClientProps) {
  const { toast } = useToast();

  const [logs, setLogs] = React.useState<readonly AuditLogEntry[]>(initialLogs);
  const [selectedSchoolId, setSelectedSchoolId] = React.useState<string>("");
  const [serverActionFilter, setServerActionFilter] = React.useState<string>("");
  const [localKeyword, setLocalKeyword] = React.useState<string>("");
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
          title: "تعذر تحميل سجلات التدقيق",
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
      toast({ title: "تم نسخ حزمة JSON", variant: "success" });
    } catch {
      toast({ title: "تعذر النسخ التلقائي", variant: "warning" });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="mono" dir="ltr">
              APPEND-ONLY AUDIT TRAIL
            </Badge>
          </div>
          <h1 className="mt-1.5 text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
            سجلات الأمان والتدقيق المركزي
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-muted)]">
            مراجعة جميع العمليات الحساسة والحجوزات وعمليات التحقق الموقّعة عبر المدارس
          </p>
        </div>

        <Link
          href="/super-admin"
          className={buttonVariants({
            variant: "outline",
            size: "md",
            className: "min-h-[44px]",
          })}
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة للنظرة الوطنية</span>
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
              <option value="">جميع المدارس المسجلة</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr} ({s.slug})
                </option>
              ))}
            </SelectInput>
          </div>

          <div className="md:col-span-3">
            <Input
              label="رمز العملية الدقيق (الخادم)"
              dir="ltr"
              placeholder="مثال: booking.confirmed"
              value={serverActionFilter}
              onChange={(e) => setServerActionFilter(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <Input
              label="بحث فوري بالسجل"
              placeholder="ابحث بالكلمة أو الفاعل أو JSON..."
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
              className="min-h-[40px]"
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              تحديث
            </Button>
          </div>
        </form>
      </Card>

      {/* Logs Table / List */}
      <Card>
        <CardHeader className="border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-[var(--text-muted)]" />
              <CardTitle className="text-base">
                السجل الزمني ({formatArabicNumber(filteredLogs.length)})
              </CardTitle>
            </div>
            {serverActionFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setServerActionFilter("");
                  void fetchLogs(selectedSchoolId, "");
                }}
              >
                مسح فلتر العملية
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-xs text-[var(--text-muted)]">
              لا توجد قيود تدقيق مطابقة للمعايير المحددة.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {filteredLogs.map((log) => {
                const expanded = expandedLogId === log.id;
                const schoolName = log.schoolId
                  ? schoolNameById[log.schoolId] ?? log.schoolId.slice(0, 8)
                  : "على مستوى المنصة";

                return (
                  <div key={log.id} className="p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="mono" dir="ltr">
                            {log.action}
                          </Badge>
                          <Badge variant="neutral" dir="ltr">
                            {log.entityType}
                            {log.entityId ? `:${log.entityId.slice(0, 8)}` : ""}
                          </Badge>
                          <Badge variant="info">{schoolName}</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                          <span>
                            الفاعل:{" "}
                            <span className="font-mono font-semibold" dir="ltr">
                              {log.actorLabel}
                            </span>
                          </span>
                          <span className="tabular-nums text-[var(--text-muted)]">
                            {formatCairoDate(log.createdAt)} · {formatCairoTime(log.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-[40px]"
                          onClick={() =>
                            setExpandedLogId(expanded ? null : log.id)
                          }
                          rightIcon={
                            expanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )
                          }
                        >
                          معاينة JSON
                        </Button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sunken)]">
                        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-3 py-1.5">
                          <span className="font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                            payload.details
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyJson(log.details)}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded px-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] cursor-pointer"
                          >
                            <Copy className="h-3 w-3" />
                            <span>نسخ</span>
                          </button>
                        </div>
                        <pre
                          dir="ltr"
                          className={cn(
                            "max-h-64 overflow-x-auto p-3 font-mono text-xs text-[var(--text-primary)] leading-relaxed"
                          )}
                        >
                          {JSON.stringify(log.details ?? {}, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

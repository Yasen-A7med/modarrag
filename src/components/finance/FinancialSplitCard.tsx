import { Landmark, Percent, Receipt, Wallet } from "lucide-react";
import type { SchoolFinancialSummary } from "@/application/finance/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatArabicNumber } from "@/lib/formatters";

export interface FinancialSplitCardProps {
  readonly summary: SchoolFinancialSummary;
  readonly audience: "teacher" | "admin";
}

/**
 * Transparent 70/30 + 14% VAT financial breakdown ledger rendered cleanly on
 * Teacher and School Admin consoles with zero client-side guesswork.
 */
export function FinancialSplitCard({ summary, audience }: FinancialSplitCardProps) {
  return (
    <Card className="p-5 border-[var(--border-hairline)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A1F44] text-cyan-300 dark:bg-blue-600/20">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {audience === "teacher" ? "المستحقات والضرائب" : "الحوكمة المالية والضرائب"}
            </h2>
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              {formatArabicNumber(summary.teacherSharePct)}٪ للمعلم ·{" "}
              {formatArabicNumber(summary.platformFeePct)}٪ للمنصة ·{" "}
              {formatArabicNumber(summary.vatRatePct)}٪ ضريبة القيمة المضافة
            </p>
          </div>
        </div>

        <Badge variant="info" size="md">
          قيمة مضافة {formatArabicNumber(summary.vatRatePct)}٪
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>{audience === "teacher" ? "صافي المعلم" : "مستحقات المعلمين"}</span>
            <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatArabicNumber(summary.teacherEarningsEgp)} ج.م
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>حصة المنصة ({formatArabicNumber(summary.platformFeePct)}٪)</span>
            <Landmark className="h-3.5 w-3.5 text-[#2563EB] dark:text-cyan-400" />
          </div>
          <p className="mt-1.5 text-lg font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(summary.platformEarningsEgp)} ج.م
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>ضريبة VAT ({formatArabicNumber(summary.vatRatePct)}٪)</span>
            <Percent className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-1.5 text-lg font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(summary.vatCollectedEgp)} ج.م
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-sunken)] p-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>{summary.totalDeductionsEgp > 0 ? "الخصومات والالتزام" : "عائد المطبعة"}</span>
            <Receipt className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <p className="mt-1.5 text-lg font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatArabicNumber(
              summary.totalDeductionsEgp > 0
                ? summary.totalDeductionsEgp
                : summary.printCommissionEgp
            )}{" "}
            ج.م
          </p>
        </div>
      </div>
    </Card>
  );
}

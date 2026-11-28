"use server";

import {
  calculateSessionRevenueBreakdown,
  DEFAULT_PLATFORM_FEE_PCT,
  DEFAULT_TEACHER_SHARE_PCT,
  DEFAULT_VAT_RATE_PCT,
} from "@/domain/finance/revenue";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export interface SchoolFinancialSummary {
  readonly teacherSharePct: number;
  readonly platformFeePct: number;
  readonly schoolSharePct: number;
  readonly vatRatePct: number;
  readonly grossStudentRevenueEgp: number;
  readonly netRevenueEgp: number;
  readonly vatCollectedEgp: number;
  readonly teacherEarningsEgp: number;
  readonly platformEarningsEgp: number;
  readonly schoolEarningsEgp: number;
  readonly printCommissionEgp: number;
  readonly totalDeductionsEgp: number;
  readonly paidBookingsCount: number;
}

/**
 * Computes deterministic school or teacher financial ledger summary on the server
 * following the 70% teacher / 30% platform split and 14% VAT rule.
 */
export async function computeSchoolFinancialSummary(input: {
  readonly schoolId: string;
  readonly teacherId?: string;
}): Promise<SchoolFinancialSummary> {
  const supabase = await createSupabaseServerClient();

  const [{ data: school }, { data: sessions }, { data: printOrders }] = await Promise.all([
    supabase
      .from("schools")
      .select("teacher_share_pct, platform_fee_pct, school_share_pct, vat_rate_pct")
      .eq("id", input.schoolId)
      .maybeSingle(),
    input.teacherId
      ? supabase
          .from("sessions")
          .select("price_egp, booked_seats_count, teacher_deduction_egp, status")
          .eq("school_id", input.schoolId)
          .eq("teacher_id", input.teacherId)
          .neq("status", "cancelled")
      : supabase
          .from("sessions")
          .select("price_egp, booked_seats_count, teacher_deduction_egp, status")
          .eq("school_id", input.schoolId)
          .neq("status", "cancelled"),
    input.teacherId
      ? supabase
          .from("print_orders")
          .select("platform_commission_egp, status")
          .eq("school_id", input.schoolId)
          .eq("teacher_id", input.teacherId)
          .neq("status", "cancelled")
      : supabase
          .from("print_orders")
          .select("platform_commission_egp, status")
          .eq("school_id", input.schoolId)
          .neq("status", "cancelled"),
  ]);

  const teacherSharePct = school?.teacher_share_pct ?? DEFAULT_TEACHER_SHARE_PCT;
  const platformFeePct = school?.platform_fee_pct ?? DEFAULT_PLATFORM_FEE_PCT;
  const schoolSharePct = school?.school_share_pct ?? 0;
  const vatRatePct = school?.vat_rate_pct ?? DEFAULT_VAT_RATE_PCT;

  let grossStudentRevenueEgp = 0;
  let netRevenueEgp = 0;
  let vatCollectedEgp = 0;
  let teacherEarningsEgp = 0;
  let platformEarningsEgp = 0;
  let schoolEarningsEgp = 0;
  let totalDeductionsEgp = 0;
  let paidBookingsCount = 0;

  for (const s of sessions ?? []) {
    totalDeductionsEgp += s.teacher_deduction_egp ?? 0;
    if ((s.price_egp ?? 0) <= 0) continue;
    const seats = s.booked_seats_count ?? 0;
    paidBookingsCount += seats;

    const breakdown = calculateSessionRevenueBreakdown({
      priceEgp: s.price_egp,
      seatCount: seats,
      vatRatePct,
      teacherSharePct,
      platformFeePct,
      schoolSharePct,
    });

    grossStudentRevenueEgp += breakdown.grossStudentTotalEgp;
    netRevenueEgp += breakdown.netRevenueEgp;
    vatCollectedEgp += breakdown.vatCollectedEgp;
    teacherEarningsEgp += breakdown.teacherNetEgp;
    platformEarningsEgp += breakdown.platformNetEgp;
    schoolEarningsEgp += breakdown.schoolShareEgp;
  }

  const printCommissionEgp = (printOrders ?? []).reduce(
    (acc, o) => acc + (o.platform_commission_egp ?? 0),
    0
  );

  return {
    teacherSharePct,
    platformFeePct,
    schoolSharePct,
    vatRatePct,
    grossStudentRevenueEgp,
    netRevenueEgp,
    vatCollectedEgp,
    teacherEarningsEgp: Math.max(0, teacherEarningsEgp - totalDeductionsEgp),
    platformEarningsEgp,
    schoolEarningsEgp,
    printCommissionEgp,
    totalDeductionsEgp,
    paidBookingsCount,
  };
}

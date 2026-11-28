export type PrintSpec = "bw_single" | "bw_double" | "color";
export type PrintBindingType = "none" | "staple" | "spiral";
export type CompliancePenaltyEvent =
  | "teacher_late"
  | "teacher_no_show"
  | "student_absent"
  | "student_late";

export const DEFAULT_VAT_RATE_PCT = 14 as const;
export const DEFAULT_TEACHER_SHARE_PCT = 70 as const;
export const DEFAULT_PLATFORM_FEE_PCT = 30 as const;
export const DEFAULT_PRINT_COMMISSION_PCT = 15 as const;

export function egpToPiasters(amountEgp: number): number {
  if (!Number.isFinite(amountEgp) || amountEgp < 0) return 0;
  return Math.round(amountEgp * 100);
}

export function piastersToEgpRounded(piasters: number): number {
  if (!Number.isFinite(piasters) || piasters <= 0) return 0;
  return Math.round(piasters / 100);
}

export interface SessionRevenueInput {
  readonly priceEgp: number;
  readonly seatCount: number;
  readonly vatRatePct?: number;
  readonly teacherSharePct?: number;
  readonly platformFeePct?: number;
  readonly schoolSharePct?: number;
}

export interface SessionRevenueBreakdown {
  readonly seatCount: number;
  readonly basePriceEgp: number;
  readonly vatPerSeatPiasters: number;
  readonly studentPayablePerSeatEgp: number;
  readonly netRevenuePiasters: number;
  readonly vatCollectedPiasters: number;
  readonly grossStudentTotalPiasters: number;
  readonly teacherNetPiasters: number;
  readonly schoolSharePiasters: number;
  readonly platformNetPiasters: number;
  readonly netRevenueEgp: number;
  readonly vatCollectedEgp: number;
  readonly grossStudentTotalEgp: number;
  readonly teacherNetEgp: number;
  readonly schoolShareEgp: number;
  readonly platformNetEgp: number;
}

/**
 * Computes exact integer-piaster revenue breakdown following Modarrag's 70/30 agreement
 * plus 14% Egyptian VAT and optional host-school allocation from the platform cut.
 */
export function calculateSessionRevenueBreakdown(
  input: SessionRevenueInput
): SessionRevenueBreakdown {
  const safePriceEgp = Math.max(0, Math.round(input.priceEgp));
  const safeSeats = Math.max(0, Math.round(input.seatCount));
  const vatRate = Math.min(30, Math.max(0, input.vatRatePct ?? DEFAULT_VAT_RATE_PCT));
  const teacherPct = Math.min(100, Math.max(0, input.teacherSharePct ?? DEFAULT_TEACHER_SHARE_PCT));
  const schoolCutOfPlatformPct = Math.min(100, Math.max(0, input.schoolSharePct ?? 0));

  const pricePiasters = egpToPiasters(safePriceEgp);
  const vatPerSeatPiasters = Math.round((pricePiasters * vatRate) / 100);
  const netRevenuePiasters = pricePiasters * safeSeats;
  const vatCollectedPiasters = vatPerSeatPiasters * safeSeats;
  const grossStudentTotalPiasters = netRevenuePiasters + vatCollectedPiasters;

  const teacherNetPiasters = Math.round((netRevenuePiasters * teacherPct) / 100);
  const platformTotalPoolPiasters = netRevenuePiasters - teacherNetPiasters;
  const schoolSharePiasters = Math.round(
    (platformTotalPoolPiasters * schoolCutOfPlatformPct) / 100
  );
  const platformNetPiasters = platformTotalPoolPiasters - schoolSharePiasters;

  return {
    seatCount: safeSeats,
    basePriceEgp: safePriceEgp,
    vatPerSeatPiasters,
    studentPayablePerSeatEgp: piastersToEgpRounded(pricePiasters + vatPerSeatPiasters),
    netRevenuePiasters,
    vatCollectedPiasters,
    grossStudentTotalPiasters,
    teacherNetPiasters,
    schoolSharePiasters,
    platformNetPiasters,
    netRevenueEgp: piastersToEgpRounded(netRevenuePiasters),
    vatCollectedEgp: piastersToEgpRounded(vatCollectedPiasters),
    grossStudentTotalEgp: piastersToEgpRounded(grossStudentTotalPiasters),
    teacherNetEgp: piastersToEgpRounded(teacherNetPiasters),
    schoolShareEgp: piastersToEgpRounded(schoolSharePiasters),
    platformNetEgp: piastersToEgpRounded(platformNetPiasters),
  };
}

export interface PrintOrderPricingInput {
  readonly copiesCount: number;
  readonly pagesCount: number;
  readonly printSpecs: PrintSpec;
  readonly bindingType: PrintBindingType;
  readonly vatRatePct?: number;
  readonly commissionPct?: number;
}

export interface PrintOrderPricingResult {
  readonly subtotalEgp: number;
  readonly vatEgp: number;
  readonly totalEgp: number;
  readonly platformCommissionEgp: number;
  readonly partnerNetEgp: number;
}

const PRINT_PAGE_RATE_PIASTERS: Readonly<Record<PrintSpec, number>> = {
  bw_single: 60,
  bw_double: 45,
  color: 200,
};

const BINDING_COST_PIASTERS: Readonly<Record<PrintBindingType, number>> = {
  none: 0,
  staple: 300,
  spiral: 1500,
};

/**
 * Deterministic pricing calculator for teacher handout print orders with 14% VAT
 * and partner print-shop platform commission.
 */
export function calculatePrintOrderPricing(
  input: PrintOrderPricingInput
): PrintOrderPricingResult {
  const copies = Math.max(1, Math.min(5000, Math.round(input.copiesCount)));
  const pages = Math.max(1, Math.min(1000, Math.round(input.pagesCount)));
  const vatRate = Math.min(30, Math.max(0, input.vatRatePct ?? DEFAULT_VAT_RATE_PCT));
  const commissionPct = Math.min(
    50,
    Math.max(0, input.commissionPct ?? DEFAULT_PRINT_COMMISSION_PCT)
  );

  const pageCostPiasters = pages * PRINT_PAGE_RATE_PIASTERS[input.printSpecs];
  const copyCostPiasters = pageCostPiasters + BINDING_COST_PIASTERS[input.bindingType];
  const subtotalPiasters = copyCostPiasters * copies;
  const vatPiasters = Math.round((subtotalPiasters * vatRate) / 100);
  const totalPiasters = subtotalPiasters + vatPiasters;
  const commissionPiasters = Math.round((subtotalPiasters * commissionPct) / 100);
  const partnerNetPiasters = subtotalPiasters - commissionPiasters;

  return {
    subtotalEgp: piastersToEgpRounded(subtotalPiasters),
    vatEgp: piastersToEgpRounded(vatPiasters),
    totalEgp: piastersToEgpRounded(totalPiasters),
    platformCommissionEgp: piastersToEgpRounded(commissionPiasters),
    partnerNetEgp: piastersToEgpRounded(partnerNetPiasters),
  };
}

const PENALTY_PCT_BY_EVENT: Readonly<Record<CompliancePenaltyEvent, number>> = {
  teacher_late: 10,
  teacher_no_show: 30,
  student_absent: 50,
  student_late: 15,
};

/**
 * Computes consistent policy deductions when a teacher misses/delays a session
 * or when a booked student fails to attend on time.
 */
export function calculatePenaltyDeduction(input: {
  readonly baseAmountEgp: number;
  readonly eventType: CompliancePenaltyEvent;
}): number {
  const safeBase = Math.max(0, Math.round(input.baseAmountEgp));
  if (safeBase === 0) return 0;
  const pct = PENALTY_PCT_BY_EVENT[input.eventType];
  return Math.round((safeBase * pct) / 100);
}

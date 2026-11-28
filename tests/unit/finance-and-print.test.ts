import { describe, expect, it } from "vitest";
import {
  calculatePenaltyDeduction,
  calculatePrintOrderPricing,
  calculateSessionRevenueBreakdown,
  egpToPiasters,
  piastersToEgpRounded,
} from "@/domain/finance/revenue";

describe("deterministic financial revenue & 14% VAT breakdown (70/30 split)", () => {
  it("computes exact integer piasters with zero floating-point drift for 70/30 + 14% VAT", () => {
    const res = calculateSessionRevenueBreakdown({
      priceEgp: 100,
      seatCount: 40,
      vatRatePct: 14,
      teacherSharePct: 70,
      platformFeePct: 30,
      schoolSharePct: 0,
    });

    // 40 seats * 100 EGP = 4000 EGP net
    expect(res.netRevenueEgp).toBe(4000);
    // 14% VAT = 560 EGP
    expect(res.vatCollectedEgp).toBe(560);
    // Gross student payable = 4560 EGP
    expect(res.grossStudentTotalEgp).toBe(4560);
    // Teacher 70% = 2800 EGP, Platform 30% = 1200 EGP
    expect(res.teacherNetEgp).toBe(2800);
    expect(res.platformNetEgp).toBe(1200);
    expect(res.schoolShareEgp).toBe(0);
    expect(res.teacherNetEgp + res.platformNetEgp + res.schoolShareEgp).toBe(
      res.netRevenueEgp
    );
  });

  it("allocates optional school incentive share out of platform revenue while conserving net total", () => {
    const res = calculateSessionRevenueBreakdown({
      priceEgp: 150,
      seatCount: 10,
      vatRatePct: 14,
      teacherSharePct: 70,
      platformFeePct: 30,
      schoolSharePct: 20, // 20% of platform's 30% cut -> 90 EGP to school, 360 EGP to platform
    });

    expect(res.netRevenueEgp).toBe(1500);
    expect(res.vatCollectedEgp).toBe(210);
    expect(res.teacherNetEgp).toBe(1050);
    expect(res.schoolShareEgp).toBe(90);
    expect(res.platformNetEgp).toBe(360);
    expect(
      res.teacherNetPiasters + res.schoolSharePiasters + res.platformNetPiasters
    ).toBe(res.netRevenuePiasters);
  });

  it("returns zero breakdown safely when session is free", () => {
    const res = calculateSessionRevenueBreakdown({
      priceEgp: 0,
      seatCount: 60,
    });

    expect(res.grossStudentTotalEgp).toBe(0);
    expect(res.vatCollectedEgp).toBe(0);
    expect(res.teacherNetEgp).toBe(0);
    expect(res.platformNetEgp).toBe(0);
  });

  it("converts between EGP and piasters cleanly", () => {
    expect(egpToPiasters(12.5)).toBe(1250);
    expect(piastersToEgpRounded(1250)).toBe(13);
  });
});

describe("online print shop pricing and platform commission", () => {
  it("calculates black-and-white double-sided spiral handout orders with 14% VAT", () => {
    const pricing = calculatePrintOrderPricing({
      copiesCount: 50,
      pagesCount: 20,
      printSpecs: "bw_double",
      bindingType: "spiral",
      vatRatePct: 14,
      commissionPct: 15,
    });

    // 20 pages * 0.45 EGP = 9 EGP printing + 15 EGP spiral = 24 EGP/copy -> 50 copies = 1200 EGP subtotal
    expect(pricing.subtotalEgp).toBe(1200);
    expect(pricing.vatEgp).toBe(168);
    expect(pricing.totalEgp).toBe(1368);
    expect(pricing.platformCommissionEgp).toBe(180);
  });

  it("calculates single color pages with staple binding deterministically", () => {
    const pricing = calculatePrintOrderPricing({
      copiesCount: 10,
      pagesCount: 10,
      printSpecs: "color",
      bindingType: "staple",
    });

    // 10 * 2.0 EGP = 20 EGP + 3 EGP staple = 23 EGP/copy -> 10 copies = 230 EGP subtotal
    expect(pricing.subtotalEgp).toBe(230);
    expect(pricing.vatEgp).toBe(32);
    expect(pricing.totalEgp).toBe(262);
  });
});

describe("schedule compliance & punctuality deductions", () => {
  it("computes fair capped deduction percentages for late and absent events", () => {
    expect(
      calculatePenaltyDeduction({ baseAmountEgp: 200, eventType: "teacher_late" })
    ).toBe(20); // 10%
    expect(
      calculatePenaltyDeduction({ baseAmountEgp: 200, eventType: "teacher_no_show" })
    ).toBe(60); // 30%
    expect(
      calculatePenaltyDeduction({ baseAmountEgp: 100, eventType: "student_absent" })
    ).toBe(50); // 50%
    expect(
      calculatePenaltyDeduction({ baseAmountEgp: 0, eventType: "student_absent" })
    ).toBe(0);
  });
});

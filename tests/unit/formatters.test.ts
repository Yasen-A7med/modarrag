import { describe, expect, it } from "vitest";
import {
  CAIRO_TIME_ZONE,
  formatArabicNumber,
  formatCairoDayKey,
  formatCairoTime,
  formatDurationAr,
  formatSeatOccupancyAr,
  getBookingStatusLabel,
  getUserRoleLabel,
} from "@/lib/formatters";

describe("Cairo formatters and display labels", () => {
  it("formats dates and day keys strictly in Africa/Cairo timezone", () => {
    expect(CAIRO_TIME_ZONE).toBe("Africa/Cairo");

    // 22:30 UTC on Dec 1 is 00:30 Dec 2 in Cairo (UTC+2)
    expect(formatCairoDayKey("2026-12-01T22:30:00.000Z")).toBe("2026-12-02");

    const cairoTime = formatCairoTime("2026-12-01T14:00:00.000Z", {
      locale: "ar-EG-u-nu-latn",
      hour12: false,
    });
    expect(cairoTime).toContain("16:00");
  });

  it("formats Eastern Arabic and Latin tabular numerals and seat occupancy", () => {
    expect(formatArabicNumber(42)).toBe("٤٢");
    expect(formatArabicNumber(42, { useEasternDigits: false })).toBe("42");
    expect(formatSeatOccupancyAr(28, 40)).toContain("١٢");
    expect(formatDurationAr(120)).toBe("ساعتان");
    expect(formatDurationAr(90)).toContain("٩٠");
  });

  it("returns anonymous institutional role and booking labels", () => {
    expect(getUserRoleLabel("school_admin")).toBe("منسق المدرسة");
    expect(getUserRoleLabel("teacher", "en")).toBe("Subject Teacher");
    expect(getBookingStatusLabel("checked_in")).toBe("تم الحضور");
  });
});

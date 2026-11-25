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
    expect(formatCairoDayKey("2026-12-01T22:30:00.000Z")).toBe("2026-12-02");

    const cairoTime = formatCairoTime("2026-12-01T14:00:00.000Z", {
      locale: "ar-EG-u-nu-latn",
      hour12: false,
    });
    expect(cairoTime).toContain("16:00");
  });

  it("uses one consistent Western digit system across Arabic numbers and occupancy", () => {
    expect(formatArabicNumber(42)).toBe("42");
    expect(formatArabicNumber(42, { useEasternDigits: true })).toBe("٤٢");
    expect(formatSeatOccupancyAr(28, 40)).toContain("12");
    expect(formatDurationAr(120)).toBe("ساعتان");
    expect(formatDurationAr(90)).toContain("90");
  });

  it("returns plain accessible Arabic and English role and booking labels", () => {
    expect(getUserRoleLabel("school_admin")).toBe("إدارة المدرسة");
    expect(getUserRoleLabel("teacher", "en")).toBe("Subject Teacher");
    expect(getBookingStatusLabel("checked_in")).toBe("حضر");
  });
});

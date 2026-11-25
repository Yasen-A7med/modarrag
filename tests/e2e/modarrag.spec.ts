import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";

const SHOTS_DIR =
  "C:\\Users\\ya377\\.gemini\\antigravity\\brain\\77f03649-8ce8-4ab7-be41-d2ab384463fa\\scratch\\verify_shots";

const SCHOOL_SLUG = "ali-bin-abi-talib";

interface DiagnosticsTracker {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedResponses: string[];
  detach: () => void;
}

function attachDiagnostics(page: Page): DiagnosticsTracker {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  };
  const onPageError = (err: Error) => {
    pageErrors.push(err.message);
  };
  const onResponse = (res: { status: () => number; url: () => string }) => {
    if (res.status() >= 500) {
      failedResponses.push(`${res.status()} ${res.url()}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  return {
    consoleErrors,
    pageErrors,
    failedResponses,
    detach: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("response", onResponse);
    },
  };
}

function assertNoRuntimeErrors(tracker: DiagnosticsTracker, label: string): void {
  expect(
    tracker.consoleErrors,
    `Console errors on ${label}: ${tracker.consoleErrors.join(" | ")}`
  ).toEqual([]);
  expect(
    tracker.pageErrors,
    `Page errors on ${label}: ${tracker.pageErrors.join(" | ")}`
  ).toEqual([]);
  expect(
    tracker.failedResponses,
    `5xx responses on ${label}: ${tracker.failedResponses.join(" | ")}`
  ).toEqual([]);
}

async function assertRtlAndNoOverflow(page: Page, contextLabel: string): Promise<void> {
  const metrics = await page.evaluate(() => {
    const html = document.documentElement;
    return {
      dir: html.dir,
      lang: html.lang,
      scrollWidth: html.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });

  expect(metrics.dir, `${contextLabel}: html dir`).toBe("rtl");
  expect(metrics.lang, `${contextLabel}: html lang`).toBe("ar");
  expect(
    metrics.scrollWidth,
    `${contextLabel}: horizontal overflow (${metrics.scrollWidth} > ${metrics.innerWidth})`
  ).toBeLessThanOrEqual(metrics.innerWidth);
}

async function assertImagesAndSvgsHealthy(page: Page, label: string): Promise<void> {
  const result = await page.evaluate(() => {
    const brokenImages: string[] = [];
    const imgs = Array.from(document.querySelectorAll("img"));
    for (const img of imgs) {
      if (!img.complete || img.naturalWidth === 0) {
        brokenImages.push(img.getAttribute("src") ?? "unknown-img");
      }
    }

    const emptySvgs: number[] = [];
    const svgs = Array.from(document.querySelectorAll("svg"));
    svgs.forEach((svg, idx) => {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        emptySvgs.push(idx);
      }
    });

    return {
      imgCount: imgs.length,
      svgCount: svgs.length,
      brokenImages,
      emptySvgs,
    };
  });

  expect(
    result.brokenImages,
    `${label}: broken images ${result.brokenImages.join(", ")}`
  ).toEqual([]);
  expect(result.svgCount, `${label}: expected SVG emblems`).toBeGreaterThan(0);
}

async function assertTouchTargetsAtLeast40px(
  locator: Locator,
  label: string
): Promise<void> {
  const count = await locator.count();
  expect(count, `${label}: expected visible interactive controls`).toBeGreaterThan(0);

  for (let i = 0; i < Math.min(count, 10); i += 1) {
    const el = locator.nth(i);
    if (await el.isVisible()) {
      const box = await el.boundingBox();
      if (box) {
        expect(
          Math.max(box.width, box.height),
          `${label} control #${i} primary dimension`
        ).toBeGreaterThanOrEqual(40);
        expect(
          box.height,
          `${label} control #${i} height (${box.height}px)`
        ).toBeGreaterThanOrEqual(40);
      }
    }
  }
}

async function loginAsDemoRole(
  page: Page,
  buttonText: string,
  expectedPathPrefix: string
): Promise<void> {
  await page.goto("/login", { waitUntil: "load" });
  const roleButton = page.locator("button", { hasText: buttonText }).first();
  await expect(roleButton).toBeVisible();
  await roleButton.click();
  await page.waitForURL((url) => url.pathname.startsWith(expectedPathPrefix), {
    timeout: 30_000,
  });
  await page.waitForLoadState("load");
}

function shotPath(fileName: string): string {
  return path.join(SHOTS_DIR, fileName);
}

test.describe("Modarrag Full Production E2E Verification", () => {
  test("0) /api/health endpoint returns 200 ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      status?: string;
      service?: string;
      defaultSchoolSlug?: string;
    };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("modarrag");
    expect(body.defaultSchoolSlug).toBe(SCHOOL_SLUG);
  });

  test("a) National Landing (/) desktop 1440px & mobile 360px, ThemeToggle & Cal preview", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/", { waitUntil: "load" });

      await assertRtlAndNoOverflow(page, "Landing Desktop 1440");
      await assertImagesAndSvgsHealthy(page, "Landing Desktop 1440");

      // Interact with Cal.com-style LiveBookingPreview
      const medTrackBtn = page.getByRole("button", { name: /طب وعلوم الحياة/ });
      await medTrackBtn.click();
      const dayBtn = page.getByRole("button", { name: /الأربعاء/ });
      await dayBtn.click();
      const slotBtn = page.getByRole("button", { name: /٠٢:٠٠ م|14:00/ });
      await slotBtn.click();
      await page.getByRole("button", { name: "تثبيت المعاينة" }).click();
      await expect(page.getByText("معاينة تذكرة الدخول")).toBeVisible();
      await expect(page.getByText(/MDRG-2026-/)).toBeVisible();

      // Capture light desktop landing screenshot
      await page.screenshot({
        path: shotPath("01-landing-desktop-1440-light.png"),
        fullPage: true,
      });

      // Toggle theme to dark and back cleanly
      const themeBtn = page
        .getByRole("button", { name: /تفعيل الوضع الليلي|تفعيل الوضع النهاري/ })
        .first();
      const wasDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      await themeBtn.click();
      const isNowDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      expect(isNowDark).toBe(!wasDark);

      await expect
        .poll(() =>
          themeBtn.evaluate((el) => getComputedStyle(el).backgroundColor)
        )
        .not.toBe("rgb(255, 255, 255)");
      const unselectedDayBtn = page.getByRole("button", { name: /الأحد/ }).first();
      await expect
        .poll(() =>
          unselectedDayBtn.evaluate((el) => getComputedStyle(el).backgroundColor)
        )
        .toBe("rgb(15, 22, 35)");

      await page.screenshot({
        path: shotPath("02-landing-desktop-1440-dark.png"),
        fullPage: false,
      });

      // Restore light mode for consistency
      if (isNowDark) {
        await themeBtn.click();
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.classList.contains("dark"))
          )
          .toBe(false);
      }

      // Mobile 360x800 RTL & 0px overflow check
      await page.setViewportSize({ width: 360, height: 800 });
      await page.reload({ waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "Landing Mobile 360");
      await assertTouchTargetsAtLeast40px(
        page.locator("header button"),
        "Landing Mobile Header Buttons"
      );

      await page.screenshot({
        path: shotPath("03-landing-mobile-360.png"),
        fullPage: true,
      });

      assertNoRuntimeErrors(tracker, "National Landing");
    } finally {
      tracker.detach();
    }
  });

  test("b) School Portal & Student Demo Flow (student_201 -> schedule -> QR ticket -> restore)", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/s/${SCHOOL_SLUG}`, { waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "School Portal Desktop");
      await assertImagesAndSvgsHealthy(page, "School Portal Desktop");
      await expect(
        page.getByText("مدرسة علي بن أبي طالب الثانوية بنين").first()
      ).toBeVisible();

      // Login via Demo Role Switcher as student_201
      await loginAsDemoRole(page, "طالب الهندسة", `/s/${SCHOOL_SLUG}/student`);
      await assertRtlAndNoOverflow(page, "Student Portal Desktop");
      await expect(page.getByText("مسار الهندسة").first()).toBeVisible();

      await page.screenshot({
        path: shotPath("04-student-portal-desktop-1440.png"),
        fullPage: true,
      });

      // Mobile 360px overflow check first (collect touch target violations after ticket flow too)
      await page.setViewportSize({ width: 360, height: 800 });
      await assertRtlAndNoOverflow(page, "Student Portal Mobile 360");
      await page.screenshot({
        path: shotPath("05-student-portal-mobile-360.png"),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });

      // Open existing confirmed ticket or book one cleanly and restore seat state afterwards
      let createdBookingId: string | null = null;
      const existingTicketLink = page
        .locator(`a[href*="/s/${SCHOOL_SLUG}/student/tickets/"]`)
        .first();

      if ((await existingTicketLink.count()) > 0) {
        await existingTicketLink.click();
        await page.waitForURL(
          (url) => url.pathname.includes(`/s/${SCHOOL_SLUG}/student/tickets/`),
          { timeout: 20_000 }
        );
      } else {
        const bookSeatButton = page.getByRole("button", { name: "حجز مقعد" }).first();
        await expect(bookSeatButton).toBeVisible();
        await bookSeatButton.click();

        const openQrBtn = page.getByRole("link", { name: "عرض تذكرة QR" });
        await expect(openQrBtn).toBeVisible({ timeout: 20_000 });
        const href = await openQrBtn.getAttribute("href");
        createdBookingId = href ? href.split("/").pop() ?? null : null;
        await openQrBtn.click();
        await page.waitForURL(
          (url) => url.pathname.includes(`/s/${SCHOOL_SLUG}/student/tickets/`),
          { timeout: 20_000 }
        );
      }

      await page.waitForLoadState("load");
      await assertRtlAndNoOverflow(page, "Student QR Ticket Desktop");

      // Verify MDRG-2026- reference code, SVG QR code, and light-only plaque
      await expect(page.getByText(/MDRG-2026-/).first()).toBeVisible();
      const qrSvg = page.locator('svg[role="img"][aria-label*="MDRG-2026-"]');
      await expect(qrSvg).toBeVisible();

      const plaqueColorScheme = await qrSvg.evaluate((svg) => {
        const parent = svg.parentElement;
        if (!parent) return "";
        return (
          parent.getAttribute("style") ??
          window.getComputedStyle(parent).colorScheme ??
          ""
        );
      });
      expect(plaqueColorScheme.toLowerCase()).toContain("light");

      await page.screenshot({
        path: shotPath("06-student-qr-ticket-desktop-1440.png"),
        fullPage: true,
      });

      // Navigate to Student Schedule & restore booked seat if test created it
      await page.goto(`/s/${SCHOOL_SLUG}/student/schedule`, {
        waitUntil: "load",
      });
      await assertRtlAndNoOverflow(page, "Student Schedule Desktop");
      await expect(page.getByRole("tab", { name: /الحصص المؤكدة/ })).toBeVisible();

      if (createdBookingId) {
        const cancelBtn = page.getByRole("button", { name: "إلغاء الحجز" }).first();
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
        const confirmCancelBtn = page.getByRole("button", { name: "تأكيد الإلغاء" });
        await expect(confirmCancelBtn).toBeVisible();
        await confirmCancelBtn.click();
        await expect(page.getByText("تم إلغاء الحجز بنجاح")).toBeVisible({
          timeout: 20_000,
        });
      }

      // Check mobile 360px header/button/dock minimum dimensions (>= 40px)
      await page.goto(`/s/${SCHOOL_SLUG}/student`, { waitUntil: "load" });
      await page.setViewportSize({ width: 360, height: 800 });
      await assertTouchTargetsAtLeast40px(
        page.locator("header button, main button:visible, nav[aria-label='التنقل السفلي'] a"),
        "Student Portal Mobile 360"
      );

      assertNoRuntimeErrors(tracker, "Student Portal & Ticket Flow");
    } finally {
      tracker.detach();
    }
  });

  test("c) Teacher Console & Cal 3-Column Hall Grid (teacher_101)", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsDemoRole(page, "معلم البرمجة", `/s/${SCHOOL_SLUG}/teacher`);
      await assertRtlAndNoOverflow(page, "Teacher Dashboard Desktop");
      await expect(page.getByRole("heading", { name: "لوحة تحكم المعلم" })).toBeVisible();

      await page.goto(`/s/${SCHOOL_SLUG}/teacher/book-hall`, {
        waitUntil: "load",
      });
      await assertRtlAndNoOverflow(page, "Teacher Book Hall Desktop");

      // Verify 3-column Cal hall grid & 15m buffer visuals
      await expect(page.getByText("١ · بيانات الحصة والمدرج")).toBeVisible();
      await expect(page.getByText("٢ · التقويم والجدول اليومي للقاعة")).toBeVisible();
      await expect(page.getByText("٣ · اختيار التوقيت والتأكيد")).toBeVisible();
      await expect(page.getByText("فاصل انتقالي ١٥د")).toBeVisible();

      // Check day buttons with existing sessions to verify hatched buffer band when rendered
      const busyDayBtn = page.locator("button", { hasText: /[٠-٩0-9]+\s+حصة/ }).first();
      if ((await busyDayBtn.count()) > 0) {
        await busyDayBtn.click();
        await expect(page.getByText(/فاصل انتقال ١٥ دقيقة/).first()).toBeVisible();
      }

      await page.screenshot({
        path: shotPath("07-teacher-book-hall-desktop-1440.png"),
        fullPage: true,
      });

      // Mobile 360px overflow check
      await page.setViewportSize({ width: 360, height: 800 });
      await assertRtlAndNoOverflow(page, "Teacher Book Hall Mobile 360");
      await page.screenshot({
        path: shotPath("08-teacher-book-hall-mobile-360.png"),
        fullPage: true,
      });

      assertNoRuntimeErrors(tracker, "Teacher Console");
    } finally {
      tracker.detach();
    }
  });

  test("d) Gate QR Scanner & Simulator Invalid Token (gate_scanner)", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsDemoRole(page, "مشرف البوابة", `/s/${SCHOOL_SLUG}/scanner`);
      await assertRtlAndNoOverflow(page, "Gate Scanner Desktop");

      // Verify session selector, Kiosk Sync Pack button, and simulator invalid-token banner
      const sessionSelect = page.locator("select").first();
      await expect(sessionSelect).toBeVisible();

      const syncPackBtn = page.getByRole("button", { name: "حفظ كشف الحصة أوفلاين" });
      await expect(syncPackBtn).toBeVisible();

      const invalidSimBtn = page.getByRole("button", {
        name: "محاكاة تذكرة غير صالحة",
      });
      await expect(invalidSimBtn).toBeVisible();
      await invalidSimBtn.click();

      const outcomeBanner = page.locator('[role="status"][aria-live="assertive"]');
      await expect(outcomeBanner).toBeVisible({ timeout: 15_000 });

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: shotPath("09-gate-scanner-desktop-1440.png"),
        fullPage: true,
      });

      // Mobile 360px check
      await page.setViewportSize({ width: 360, height: 800 });
      await assertRtlAndNoOverflow(page, "Gate Scanner Mobile 360");

      assertNoRuntimeErrors(tracker, "Gate QR Scanner");
    } finally {
      tracker.detach();
    }
  });

  test("e) School Admin, Ministry Presentation & CSV Export (school_admin)", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsDemoRole(page, "منسق المدرسة", `/s/${SCHOOL_SLUG}/admin`);
      await assertRtlAndNoOverflow(page, "School Admin Desktop");

      // Verify SVG occupancy gauges on Admin Overview
      await expect(page.getByText("الإشغال الحي للقاعات والمدرجات")).toBeVisible();
      const gaugeCircles = page.locator("svg circle");
      expect(await gaugeCircles.count()).toBeGreaterThanOrEqual(2);

      await page.screenshot({
        path: shotPath("10-school-admin-desktop-1440.png"),
        fullPage: true,
      });

      // Navigate Admin sub-routes
      for (const route of ["academic", "halls", "teachers"] as const) {
        await page.goto(`/s/${SCHOOL_SLUG}/admin/${route}`, {
          waitUntil: "load",
        });
        await assertRtlAndNoOverflow(page, `School Admin /${route}`);
      }

      // Ministry Presentation Mode
      await page.goto(`/s/${SCHOOL_SLUG}/admin/presentation`, {
        waitUntil: "load",
      });
      await assertRtlAndNoOverflow(page, "Ministry Presentation Desktop");
      await expect(
        page.getByText("ملف العرض الرسمي — وزارة التربية والتعليم")
      ).toBeVisible();

      await page.screenshot({
        path: shotPath("11-ministry-presentation-desktop-1440.png"),
        fullPage: true,
      });

      // Verify authenticated CSV export API with UTF-8 BOM + Reference Code header
      const csvResponse = await page.request.get(
        `/api/reports/export?schoolSlug=${SCHOOL_SLUG}&format=csv`
      );
      expect(csvResponse.status()).toBe(200);
      const contentType = csvResponse.headers()["content-type"] ?? "";
      expect(contentType.toLowerCase()).toContain("text/csv");

      const csvBytes = await csvResponse.body();
      expect(csvBytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      const csvText = csvBytes.toString("utf8");
      expect(csvText).toContain("Reference Code");

      assertNoRuntimeErrors(tracker, "School Admin & Ministry Presentation");
    } finally {
      tracker.detach();
    }
  });

  test("f) Super Admin National Console (super_admin)", async ({ page }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsDemoRole(page, "مدير المنصة", "/super-admin");
      await assertRtlAndNoOverflow(page, "Super Admin Desktop");

      await expect(page.getByRole("heading", { name: "لوحة التحكم الوطنية — مُدَرَّج" })).toBeVisible();
      await expect(
        page.getByText("مدرسة علي بن أبي طالب الثانوية بنين").first()
      ).toBeVisible();

      await page.screenshot({
        path: shotPath("12-super-admin-desktop-1440.png"),
        fullPage: true,
      });

      await page.goto("/super-admin/schools", { waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "Super Admin Schools Desktop");
      await expect(
        page.getByText("معالج إنشاء مدرسة جديدة (Multi-Tenant)")
      ).toBeVisible();

      await page.goto("/super-admin/security-logs", { waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "Super Admin Security Logs Desktop");
      await expect(page.getByText("سجلات الأمان والتدقيق المركزي")).toBeVisible();

      assertNoRuntimeErrors(tracker, "Super Admin Console");
    } finally {
      tracker.detach();
    }
  });
});

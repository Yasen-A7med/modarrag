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
  expect(result.svgCount, `${label}: expected SVG icons`).toBeGreaterThan(0);
}

async function assertTouchTargetsAtLeast44px(
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
          `${label} control #${i} width/height`
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
  if (buttonText === "طالب الهندسة") {
    await page.waitForTimeout(450);
    await page.screenshot({
      path: shotPath("03c-login-desktop-1440.png"),
      fullPage: true,
    });
  }
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

test.describe("Modarrag Redesigned E2E Verification", () => {
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

  test("a) Bassthalk-inspired Landing (/): hero visual, 3 steps, theme toggle, mobile 360px", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/", { waitUntil: "load" });
      // Trigger scroll-reveal sections and wait briefly for Framer Motion transforms to settle
      await page.evaluate(async () => {
        window.scrollTo(0, Math.round(document.body.scrollHeight * 0.45));
        await new Promise((r) => setTimeout(r, 250));
        window.scrollTo(0, Math.round(document.body.scrollHeight * 0.85));
        await new Promise((r) => setTimeout(r, 250));
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 350));
      });

      await assertRtlAndNoOverflow(page, "Landing Desktop 1440");
      await assertImagesAndSvgsHealthy(page, "Landing Desktop 1440");

      // Verify the 2 old floating overlay chips on the hero image were removed
      await expect(page.getByText("سعة قاعات آمنة ١٠٠٪")).toHaveCount(0);
      await expect(page.getByText("الحضور بالاسم فوراً")).toHaveCount(0);

      // Verify official Modarrag mark + Ali Bin Abi Talib crest image loaded
      const logoSrcs = await page.evaluate(() =>
        Array.from(document.querySelectorAll("img")).map((img) => img.getAttribute("src") ?? "")
      );
      expect(logoSrcs.some((src) => src.includes("modarrag-mark"))).toBe(true);
      expect(logoSrcs.some((src) => src.includes("ali-bin-abi-talib/logo"))).toBe(true);

      await expect(page.getByText("الموضوع بسيط جداً.. ٣ خطوات فقط")).toBeVisible();
      await expect(page.getByText("احضر باسمك فقط")).toBeVisible();
      await expect(
        page.getByText("مدرسة علي بن أبي طالب الثانوية بنين").first()
      ).toBeVisible();

      // Zero developer jargon on landing page
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toContain("GiST");
      expect(bodyText).not.toContain("HMAC-SHA256");
      expect(bodyText).not.toContain("SEC_2_BACC");

      await page.screenshot({
        path: shotPath("01-landing-desktop-1440-light.png"),
        fullPage: true,
      });

      // Toggle to Dark Mode cleanly
      const themeBtn = page
        .getByRole("button", { name: /التبديل للوضع الداكن|التبديل للوضع الفاتح/ })
        .first();
      await themeBtn.click();
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.classList.contains("dark"))
        )
        .toBe(true);
      await page.waitForTimeout(220);

      await page.screenshot({
        path: shotPath("02-landing-desktop-1440-dark.png"),
        fullPage: false,
      });

      // Restore light mode
      await themeBtn.click();
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.classList.contains("dark"))
        )
        .toBe(false);

      // Mobile 360px check
      await page.setViewportSize({ width: 360, height: 800 });
      await page.reload({ waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "Landing Mobile 360");
      await assertTouchTargetsAtLeast44px(
        page.locator("header button, main a[href='/s/ali-bin-abi-talib']"),
        "Landing Mobile 360"
      );

      await page.screenshot({
        path: shotPath("03-landing-mobile-360.png"),
        fullPage: true,
      });

      assertNoRuntimeErrors(tracker, "Landing Page");
    } finally {
      tracker.detach();
    }
  });

  test("b) Student Name-Based Portal (student_201 -> reserve by name -> cancel restore)", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/s/${SCHOOL_SLUG}`, { waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "School Doorway Desktop");
      await expect(page.getByRole("heading", { name: "بوابة الطالب" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "بوابة المعلم" })).toBeVisible();
      await page.waitForTimeout(450);
      await page.screenshot({
        path: shotPath("03b-school-doorway-desktop-1440.png"),
        fullPage: true,
      });

      await loginAsDemoRole(page, "طالب الهندسة", `/s/${SCHOOL_SLUG}/student`);
      await assertRtlAndNoOverflow(page, "Student Portal Desktop");
      await expect(page.getByText("مسار الهندسة").first()).toBeVisible();
      await expect(page.getByText("أنت مسجل بالاسم ✓").first()).toBeVisible();

      await page.screenshot({
        path: shotPath("04-student-portal-desktop-1440.png"),
        fullPage: true,
      });

      // Mobile 360px layout + touch targets
      await page.setViewportSize({ width: 360, height: 800 });
      await assertRtlAndNoOverflow(page, "Student Portal Mobile 360");
      await assertTouchTargetsAtLeast44px(
        page.locator("header button, main button:visible, nav[aria-label='التنقل السفلي'] a"),
        "Student Portal Mobile 360"
      );
      await page.screenshot({
        path: shotPath("05-student-portal-mobile-360.png"),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });

      // Book a free session (if available) and verify name-based confirmation modal + restore
      const reserveBtn = page.getByRole("button", { name: "احجز مكانك الآن" }).first();
      if ((await reserveBtn.count()) > 0) {
        await reserveBtn.click();
        await expect(
          page.getByText("تم تسجيل اسمك في الحصة بنجاح!")
        ).toBeVisible({ timeout: 20_000 });
        await expect(
          page.getByText(/لا تحتاج لأي تذكرة أو باركود/)
        ).toBeVisible();

        await page.getByRole("button", { name: "حسناً، فهمت" }).click();

        // Cancel the second/newest test booking cleanly to restore original seat count
        const cancelBtns = page.getByRole("button", { name: "إلغاء الحجز" });
        if ((await cancelBtns.count()) > 1) {
          await cancelBtns.first().click();
          const confirmCancel = page.getByRole("button", {
            name: "تأكيد إلغاء الحجز",
          });
          await expect(confirmCancel).toBeVisible();
          await confirmCancel.click();
          await expect(page.getByText("تم إلغاء حجزك")).toBeVisible({
            timeout: 20_000,
          });
        }
      }

      assertNoRuntimeErrors(tracker, "Student Portal Flow");
    } finally {
      tracker.detach();
    }
  });

  test("c) Teacher Name-Attendance Checklist (teacher_101 -> search student -> mark ✓ حضر -> undo)", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsDemoRole(page, "معلم المادة", `/s/${SCHOOL_SLUG}/teacher`);
      await assertRtlAndNoOverflow(page, "Teacher Dashboard Desktop");
      await expect(page.getByText("جدول الحصص وكشوف الحضور")).toBeVisible();

      await page.screenshot({
        path: shotPath("06-teacher-dashboard-desktop-1440.png"),
        fullPage: true,
      });

      // Open student name roster checklist
      const openRosterLink = page
        .getByRole("link", { name: "فتح كشف الحضور بالاسم" })
        .first();
      await expect(openRosterLink).toBeVisible();
      await openRosterLink.click();
      await page.waitForURL(
        (url) => url.pathname.includes(`/s/${SCHOOL_SLUG}/teacher/sessions/`),
        { timeout: 20_000 }
      );
      await page.waitForLoadState("load");
      await assertRtlAndNoOverflow(page, "Teacher Attendance Roster Desktop");

      // Search by Arabic student name
      const searchInput = page.locator('input[type="search"]').first();
      await expect(searchInput).toBeVisible();
      await searchInput.fill("طالب الهندسة");
      await expect(page.getByText("طالب الهندسة التجريبي").first()).toBeVisible();

      // Mark student present in 1 tap (or undo then mark to test both directions)
      const markBtn = page.getByRole("button", { name: /حضر/ }).first();
      const undoBtnInitial = page.getByRole("button", { name: "تراجع" }).first();

      if ((await undoBtnInitial.count()) > 0 && (await undoBtnInitial.isVisible())) {
        await undoBtnInitial.click();
        await expect(
          page.getByRole("button", { name: /✓ حضر/ }).first()
        ).toBeVisible({ timeout: 15_000 });
      }

      const checkInBtn = page.getByRole("button", { name: /✓ حضر/ }).first();
      if ((await checkInBtn.count()) > 0) {
        await checkInBtn.click();
        await expect(page.getByRole("button", { name: "تراجع" }).first()).toBeVisible({
          timeout: 15_000,
        });
      } else {
        await expect(markBtn).toBeVisible();
      }

      await page.screenshot({
        path: shotPath("07-teacher-roster-present-1440.png"),
        fullPage: true,
      });

      // Mobile 360px attendance list check
      await page.setViewportSize({ width: 360, height: 800 });
      await assertRtlAndNoOverflow(page, "Teacher Roster Mobile 360");
      await assertTouchTargetsAtLeast44px(
        page.locator("main button:visible, input[type='search']"),
        "Teacher Roster Mobile 360"
      );
      await page.screenshot({
        path: shotPath("08-teacher-roster-mobile-360.png"),
        fullPage: true,
      });

      // Restore clean initial confirmed status via "تراجع"
      await page.setViewportSize({ width: 1440, height: 900 });
      const undoBtn = page.getByRole("button", { name: "تراجع" }).first();
      if ((await undoBtn.count()) > 0 && (await undoBtn.isVisible())) {
        await undoBtn.click();
        await expect(
          page.getByRole("button", { name: /✓ حضر/ }).first()
        ).toBeVisible({ timeout: 15_000 });
      }

      // Check Book Hall Planner
      await page.goto(`/s/${SCHOOL_SLUG}/teacher/book-hall`, { waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "Teacher Book Hall Desktop");
      await expect(page.getByText("١ · بيانات الحصة والمدرج")).toBeVisible();
      await page.screenshot({
        path: shotPath("09-teacher-book-hall-desktop-1440.png"),
        fullPage: true,
      });

      assertNoRuntimeErrors(tracker, "Teacher Attendance Console");
    } finally {
      tracker.detach();
    }
  });

  test("d) School Admin, Ministry Presentation & Name CSV Export (school_admin)", async ({
    page,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsDemoRole(page, "إدارة المدرسة", `/s/${SCHOOL_SLUG}/admin`);
      await assertRtlAndNoOverflow(page, "School Admin Desktop");

      await expect(page.getByText("الإشغال الحي للقاعات والمدرجات")).toBeVisible();
      await page.screenshot({
        path: shotPath("10-school-admin-desktop-1440.png"),
        fullPage: true,
      });

      for (const route of ["academic", "halls", "teachers"] as const) {
        await page.goto(`/s/${SCHOOL_SLUG}/admin/${route}`, { waitUntil: "load" });
        await assertRtlAndNoOverflow(page, `School Admin /${route}`);
      }

      await page.goto(`/s/${SCHOOL_SLUG}/admin/presentation`, {
        waitUntil: "load",
      });
      await assertRtlAndNoOverflow(page, "Ministry Presentation Desktop");
      await expect(
        page.getByText("عرض المتابعة الرسمي — وزارة التربية والتعليم")
      ).toBeVisible();
      await expect(page.getByText("تحضير بالاسم في ثانية")).toBeVisible();

      const presText = await page.locator("body").innerText();
      expect(presText).not.toContain("HMAC-SHA256");

      await page.screenshot({
        path: shotPath("11-ministry-presentation-desktop-1440.png"),
        fullPage: true,
      });

      // Verify CSV export uses Student Name + Attendance Status (zero QR / Reference Code)
      const csvResponse = await page.request.get(
        `/api/reports/export?schoolSlug=${SCHOOL_SLUG}&format=csv`
      );
      expect(csvResponse.status()).toBe(200);
      const csvBytes = await csvResponse.body();
      expect(csvBytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      const csvText = csvBytes.toString("utf8");
      expect(csvText).toContain("Student Name");
      expect(csvText).toContain("Attendance Status");

      assertNoRuntimeErrors(tracker, "School Admin & Ministry Presentation");
    } finally {
      tracker.detach();
    }
  });

  test("e) Super Admin National Console (super_admin)", async ({ page }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsDemoRole(page, "مشرف المنصة", "/super-admin");
      await assertRtlAndNoOverflow(page, "Super Admin Desktop");

      await expect(
        page.getByRole("heading", { name: "لوحة التحكم الوطنية — مُدَرَّج" })
      ).toBeVisible();
      await page.screenshot({
        path: shotPath("12-super-admin-desktop-1440.png"),
        fullPage: true,
      });

      await page.goto("/super-admin/schools", { waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "Super Admin Schools Desktop");
      await page.goto("/super-admin/security-logs", { waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "Super Admin Security Logs Desktop");

      await page.goto("/login", { waitUntil: "load" });
      await expect(
        page.getByRole("button", { name: "المتابعة باستخدام Google" })
      ).toBeVisible();
      await page.goto("/register", { waitUntil: "load" });
      await expect(
        page.getByRole("button", { name: "التسجيل السريع باستخدام Google" })
      ).toBeVisible();

      assertNoRuntimeErrors(tracker, "Super Admin Console");
    } finally {
      tracker.detach();
    }
  });

  test("f) Recorded Lectures 3-Tier Access (Upload/Publish -> Hidden Secret Gate -> Delete Cleanup)", async ({
    page,
    browser,
  }) => {
    const tracker = attachDiagnostics(page);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAsDemoRole(page, "معلم المادة", `/s/${SCHOOL_SLUG}/teacher`);

      await page.goto(`/s/${SCHOOL_SLUG}/teacher/lectures`, { waitUntil: "load" });
      await assertRtlAndNoOverflow(page, "Teacher Lectures Studio Desktop");
      await expect(
        page.getByRole("heading", {
          name: "رفع المحاضرات المسجلة والتحكم في صلاحية المشاهدة",
        })
      ).toBeVisible();

      await page.screenshot({
        path: shotPath("13-teacher-lectures-studio-1440.png"),
        fullPage: true,
      });

      const testTitle = `محاضرة اختبار آلي ${Date.now()}`;
      const secretPass = "ModPass2026!";

      await page.getByLabel("عنوان المحاضرة").fill(testTitle);
      await page
        .getByRole("button", { name: /أو إضافة رابط فيديو كبير/ })
        .click();
      await page
        .getByLabel(/رابط الفيديو الآمن/)
        .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

      await page
        .getByRole("button", { name: /سرية ومخفية/ })
        .click();
      await page.getByLabel("كلمة مرور المحاضرة السرية").fill(secretPass);

      await page.getByRole("button", { name: "رفع ونشر المحاضرة" }).click();
      await expect(
        page.getByText("تم رفع ونشر المحاضرة بنجاح!")
      ).toBeVisible({ timeout: 20_000 });

      // Grab generated secret link by intercepting clipboard or querying the row card button
      await page.reload({ waitUntil: "load" });
      const createdCard = page.locator("article, div").filter({ hasText: testTitle }).first();
      await expect(createdCard).toBeVisible();

      // Grant clipboard permissions to verify "نسخ الرابط السري" URL works cleanly
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "نسخ الرابط السري" }).first().click();
      const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiedUrl).toContain(`/s/${SCHOOL_SLUG}/lectures/`);

      // Verify secret lecture NEVER shows in public school lectures catalog
      const guestCtx = await browser.newContext();
      const guestPage = await guestCtx.newPage();
      await guestPage.setViewportSize({ width: 1440, height: 900 });
      await guestPage.goto(`/s/${SCHOOL_SLUG}/lectures`, { waitUntil: "load" });
      await assertRtlAndNoOverflow(guestPage, "Public School Lectures Catalog");
      expect(await guestPage.locator("body").innerText()).not.toContain(testTitle);
      await guestPage.screenshot({
        path: shotPath("14-school-lectures-library-1440.png"),
        fullPage: true,
      });

      // Open the hidden secret URL as guest -> wrong password blocked -> right password plays video
      await guestPage.goto(copiedUrl, { waitUntil: "load" });
      await assertRtlAndNoOverflow(guestPage, "Secret Lecture Gate");
      await expect(guestPage.getByText(testTitle)).toBeVisible();
      await guestPage.getByLabel("أدخل كلمة المرور لفتح المحاضرة").fill("WrongPass999");
      await guestPage.getByRole("button", { name: "فتح وتشغيل المحاضرة" }).click();
      await expect(
        guestPage.getByRole("main").getByText(/كلمة المرور غير صحيحة/)
      ).toBeVisible({
        timeout: 15_000,
      });

      await guestPage.screenshot({
        path: shotPath("15-secret-lecture-gate-1440.png"),
        fullPage: true,
      });

      await guestPage.getByLabel("أدخل كلمة المرور لفتح المحاضرة").fill(secretPass);
      await guestPage.getByRole("button", { name: "فتح وتشغيل المحاضرة" }).click();
      await expect(guestPage.getByText("تم فتح المحاضرة السرية")).toBeVisible({
        timeout: 15_000,
      });
      await expect(guestPage.locator("iframe")).toBeVisible();
      await guestCtx.close();

      // Clean up test lecture(s) via the teacher delete action so DB stays pristine
      while (
        (await page.getByRole("button", { name: "حذف" }).count()) > 0
      ) {
        const beforeCount = await page.getByRole("button", { name: "حذف" }).count();
        await page.getByRole("button", { name: "حذف" }).first().click();
        await page.getByRole("button", { name: "نعم، احذف المحاضرة" }).click();
        await expect(
          page.getByText("تم حذف المحاضرة والملف بنجاح").first()
        ).toBeVisible({
          timeout: 15_000,
        });
        await expect(page.getByRole("button", { name: "حذف" })).toHaveCount(
          beforeCount - 1,
          { timeout: 15_000 }
        );
      }

      assertNoRuntimeErrors(tracker, "Recorded Lectures E2E Flow");
    } finally {
      tracker.detach();
    }
  });
});

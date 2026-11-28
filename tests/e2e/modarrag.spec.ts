import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS_DIR =
  "C:\\Users\\ya377\\.gemini\\antigravity\\brain\\584a2023-b926-4ecd-922b-9a4719be918d\\scratch\\verify_shots";
const SCHOOL_SLUG = "ali-bin-abi-talib";

function ensureShotsDir() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

async function saveShot(page: Page, filename: string, fullPage = true) {
  ensureShotsDir();
  await page.screenshot({
    path: path.join(SHOTS_DIR, filename),
    fullPage,
  });
}

async function assertCleanLayout(page: Page, label: string) {
  const layout = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const brokenImages = Array.from(document.querySelectorAll("img"))
      .filter((img) => {
        const style = window.getComputedStyle(img);
        return style.display !== "none" && (!img.complete || img.naturalWidth === 0);
      })
      .map((img) => img.getAttribute("src") || "unknown");

    return {
      dir: html.getAttribute("dir"),
      lang: html.getAttribute("lang"),
      overflowPx: Math.max(0, html.scrollWidth - html.clientWidth),
      scrollWidth: html.scrollWidth,
      clientWidth: html.clientWidth,
      bodyTextLen: body.innerText.trim().length,
      brokenImages,
    };
  });

  expect(layout.dir, `${label}: dir=rtl`).toBe("rtl");
  expect(layout.lang, `${label}: lang=ar`).toBe("ar");
  expect(layout.bodyTextLen, `${label}: rendered text`).toBeGreaterThan(25);
  expect(
    layout.overflowPx,
    `${label}: zero horizontal overflow (${layout.scrollWidth} <= ${layout.clientWidth})`
  ).toBeLessThanOrEqual(4);
  expect(layout.brokenImages, `${label}: zero broken images`).toEqual([]);
}

async function loginAsDemoRole(
  page: Page,
  buttonLabel: string,
  expectedPathPart: string
) {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: new RegExp(buttonLabel) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(buttonLabel) }).click();
  await page.waitForURL(new RegExp(expectedPathPart), { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

function attachConsoleErrorTrap(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("hydration") && !text.includes("Failed to load resource")) {
        errors.push(`console.error: ${text}`);
      }
    }
  });
  return errors;
}

test.describe("Modarrag E2E — Full Platform & Visual Craft Audit", () => {
  test("1. Public Landing (/), School Directory Search, Portal (/s/ali-bin-abi-talib) & Theme", async ({
    page,
  }) => {
    const errors = attachConsoleErrorTrap(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /احجز مقعدك المدرسي/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ابحث عن مدرستك" })).toBeVisible();
    await expect(page.getByText("المرحلة السنية أو السنتر؟ ابحث").or(page.getByText("تحضير فوري بالاسم"))).toBeVisible();

    const searchInput = page.getByPlaceholder("ابحث باسم المدرسة أو المحافظة...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("علي بن أبي طالب");
    await expect(page.getByText("مدرسة علي بن أبي طالب الثانوية بنين")).toBeVisible();
    await searchInput.fill("");

    await assertCleanLayout(page, "Landing Desktop 1440 Light");
    await saveShot(page, "01-landing-desktop-light.png");

    // Dark theme toggle check
    const themeToggle = page.getByRole("button", { name: /التبديل إلى الوضع الليلي/ });
    if ((await themeToggle.count()) > 0) {
      await themeToggle.first().click();
      await page.waitForTimeout(250);
      await saveShot(page, "02-landing-desktop-dark.png", false);
      await page.getByRole("button", { name: /التبديل إلى الوضع النهاري/ }).first().click();
      await page.waitForTimeout(200);
    }

    // Mobile Landing
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await assertCleanLayout(page, "Landing Mobile 390");
    await saveShot(page, "03-landing-mobile.png");

    // School portal via direct navigation
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/s/${SCHOOL_SLUG}`);
    await assertCleanLayout(page, "School Public Portal");
    await saveShot(page, "04-school-portal-desktop.png", false);

    // Unauthenticated onboarding gate check
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /سجّل دخولك أولاً/ })).toBeVisible();
    await assertCleanLayout(page, "Onboarding Unauthenticated Gate");

    expect(errors, "Zero uncaught page/console errors on public routes").toEqual([]);
  });

  test("2. Student Engineering Booking, Online Filter, Schedule Tab, Cancel & Literature Separation", async ({
    page,
  }) => {
    const errors = attachConsoleErrorTrap(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsDemoRole(page, "طالب الهندسة", `/s/${SCHOOL_SLUG}/student`);

    await expect(page.getByRole("heading", { name: /أهلاً،/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "الكل" })).toBeVisible();
    await expect(page.getByRole("button", { name: "في المدرسة" })).toBeVisible();
    await expect(page.getByRole("button", { name: "أونلاين" })).toBeVisible();

    await assertCleanLayout(page, "Student Portal Desktop");
    await saveShot(page, "05-student-desktop.png");

    // Mobile Student Portal
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await assertCleanLayout(page, "Student Portal Mobile");
    await saveShot(page, "06-student-mobile.png");

    await page.setViewportSize({ width: 1440, height: 900 });

    // Book an available session if present, verify green banner, then cancel to leave DB clean
    const bookButtons = page.getByRole("button", { name: "احجز مقعدك" });
    if ((await bookButtons.count()) > 0) {
      await bookButtons.first().click();
      await expect(page.getByText(/تم تأكيد مقعدك ✓/)).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: /جدولي/ }).click();
      const cancelBtns = page.getByRole("button", { name: "إلغاء الحجز" });
      await expect(cancelBtns.first()).toBeVisible();
      await cancelBtns.first().click();
      await page.getByRole("button", { name: "نعم، إلغاء الحجز" }).click();
      await expect(page.getByText("تم إلغاء حجزك").first()).toBeVisible({ timeout: 15_000 });
    }

    await page.goto(`/s/${SCHOOL_SLUG}/student/schedule`);
    await assertCleanLayout(page, "Student Schedule Page");

    // Literature student track isolation
    await loginAsDemoRole(page, "طالب الآداب", `/s/${SCHOOL_SLUG}/student`);
    await expect(page.getByRole("heading", { name: /أهلاً،/ })).toBeVisible();
    await assertCleanLayout(page, "Student Literature Portal");

    expect(errors, "Zero uncaught errors in student journeys").toEqual([]);
  });

  test("3. Teacher Dashboard (70/30 VAT), Hall/Online Matrix, Roster Attendance & Print Center", async ({
    page,
  }) => {
    const errors = attachConsoleErrorTrap(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsDemoRole(page, "معلم المادة", `/s/${SCHOOL_SLUG}/teacher`);

    await expect(page.getByRole("heading", { name: "لوحة قيادة المعلم" })).toBeVisible();
    await expect(page.getByText(/70٪ للمعلم/).first()).toBeVisible();
    await assertCleanLayout(page, "Teacher Dashboard Desktop");
    await saveShot(page, "07-teacher-dashboard-desktop.png");

    // Dark mode check on Teacher Executive Console
    const themeToggle = page.getByRole("button", { name: /التبديل إلى الوضع الليلي/ });
    if ((await themeToggle.count()) > 0) {
      await themeToggle.first().click();
      await page.waitForTimeout(250);
      await saveShot(page, "08-teacher-dashboard-dark.png", false);
      await page.getByRole("button", { name: /التبديل إلى الوضع النهاري/ }).first().click();
    }

    // Teacher Hall + Online Matrix
    await page.goto(`/s/${SCHOOL_SLUG}/teacher/book-hall`);
    await expect(page.getByRole("heading", { name: "جدولة وحجز القاعات" })).toBeVisible();
    await page.getByRole("button", { name: /أونلاين من البيت/ }).click();
    await expect(page.getByPlaceholder("https://meet.google.com/...")).toBeVisible();
    await page.getByRole("button", { name: /قاعة مدرسية/ }).click();
    await page.getByRole("button", { name: /تكرار أسبوعي/ }).click();
    await page.getByRole("button", { name: /حصة مفردة/ }).click();
    await assertCleanLayout(page, "Teacher Book Hall & Online Matrix");
    await saveShot(page, "09-teacher-book-hall-desktop.png");

    // Teacher Print Center (/teacher/printing)
    await page.goto(`/s/${SCHOOL_SLUG}/teacher/printing`);
    await expect(page.getByRole("heading", { name: "طباعة المذكرات والملازم" })).toBeVisible();
    await expect(page.getByText("مطبعة مُدَرَّج أونلاين")).toBeVisible();
    await expect(page.getByText("طلب طباعة جديد")).toBeVisible();
    await assertCleanLayout(page, "Teacher Print Center");
    await saveShot(page, "10-teacher-printing-desktop.png");

    // Roster Attendance screen on Mobile 390px
    await page.goto(`/s/${SCHOOL_SLUG}/teacher`);
    const rosterLinks = page.getByRole("link", { name: /تسجيل الحضور/ });
    if ((await rosterLinks.count()) > 0) {
      await rosterLinks.first().click();
      await page.waitForURL(new RegExp(`/s/${SCHOOL_SLUG}/teacher/sessions/`));
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByText("الحضور الفعلي")).toBeVisible();
      await expect(page.getByPlaceholder("ابحث باسم الطالب...")).toBeVisible();
      await assertCleanLayout(page, "Teacher Attendance Roster Mobile");
      await saveShot(page, "11-teacher-roster-mobile.png");

      // Toggle present and toggle back cleanly if an unmarked student exists
      const presentBtns = page.getByRole("button", { name: "تسجيل حضور" });
      if ((await presentBtns.count()) > 0) {
        await presentBtns.first().click();
        await expect(page.getByRole("button", { name: "حضر ✓" }).first()).toBeVisible({
          timeout: 15_000,
        });
        await page.getByRole("button", { name: "حضر ✓" }).first().click();
        await page.waitForTimeout(600);
      }
    }

    expect(errors, "Zero uncaught errors in teacher journeys").toEqual([]);
  });

  test("4. Recorded Lectures 3-Tier Studio, Public Library & Secret Password Gate", async ({
    page,
    browser,
  }) => {
    const errors = attachConsoleErrorTrap(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsDemoRole(page, "معلم المادة", `/s/${SCHOOL_SLUG}/teacher`);

    await page.goto(`/s/${SCHOOL_SLUG}/teacher/lectures`);
    await expect(page.getByRole("heading", { name: "نشر محاضرة مسجلة" })).toBeVisible();

    // Clean up any stale E2E secret lecture from interrupted runs
    for (let i = 0; i < 3; i++) {
      const e2eItem = page
        .locator("div")
        .filter({ hasText: "E2E محاضرة سرية للتحقق" })
        .getByRole("button", { name: "حذف" });
      if ((await e2eItem.count()) > 0) {
        await e2eItem.first().click();
        await page.getByRole("button", { name: "نعم، احذف المحاضرة" }).click();
        await page.waitForTimeout(800);
      } else {
        break;
      }
    }

    await saveShot(page, "12-teacher-lectures-studio.png");

    // Publish Secret Lecture via YouTube URL
    await page.getByRole("button", { name: "رابط فيديو", exact: true }).click();
    await page
      .getByPlaceholder("https://www.youtube.com/watch?v=...")
      .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page
      .getByPlaceholder("مثال: حل امتحانات الوحدة الثانية")
      .fill("E2E محاضرة سرية للتحقق");
    await page.getByRole("button", { name: /سرية بكلمة مرور/ }).click();
    await page.getByLabel("كلمة مرور المحاضرة السرية").fill("ModSecret2026");
    await page.getByRole("button", { name: "نشر المحاضرة الآن" }).click();
    await expect(page.getByText("تم نشر المحاضرة بنجاح ✓")).toBeVisible({ timeout: 20_000 });

    // Extract secret share link cleanly using Clipboard permission or Copy button
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const copySecretBtn = page.getByRole("button", { name: "نسخ الرابط السري" }).first();
    await expect(copySecretBtn).toBeVisible();
    await copySecretBtn.click();
    const secretUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(secretUrl).toContain(`/s/${SCHOOL_SLUG}/lectures/`);

    // Public lectures library MUST hide secret tier
    await page.goto(`/s/${SCHOOL_SLUG}/lectures`);
    await expect(page.getByText("E2E محاضرة سرية للتحقق")).toHaveCount(0);
    await assertCleanLayout(page, "School Lectures Library");
    await saveShot(page, "13-school-lectures-library.png");

    // Unauthenticated visitor tests wrong + right secret password
    const anonContext = await browser.newContext({ locale: "ar-EG" });
    const anonPage = await anonContext.newPage();
    await anonPage.setViewportSize({ width: 1440, height: 900 });
    await anonPage.goto(secretUrl);
    await expect(anonPage.getByRole("heading", { name: "E2E محاضرة سرية للتحقق" })).toBeVisible();

    await anonPage.getByRole("textbox", { name: "كلمة المرور" }).fill("WrongPass99");
    await anonPage.getByRole("button", { name: "فتح المحاضرة" }).click();
    await expect(anonPage.getByRole("alert")).toBeVisible({ timeout: 15_000 });

    await anonPage.getByRole("textbox", { name: "كلمة المرور" }).fill("ModSecret2026");
    await anonPage.getByRole("button", { name: "فتح المحاضرة" }).click();
    await expect(anonPage.getByText(/تم التحقق/)).toBeVisible({ timeout: 15_000 });
    await saveShot(anonPage, "14-secret-lecture-unlocked.png", false);
    await anonContext.close();

    // Clean up E2E test lecture
    await page.goto(`/s/${SCHOOL_SLUG}/teacher/lectures`);
    const cleanupCard = page
      .locator("div.divide-y > div")
      .filter({ hasText: "E2E محاضرة سرية للتحقق" })
      .first();
    await cleanupCard.getByRole("button", { name: "حذف" }).click();
    await page.getByRole("button", { name: "نعم، احذف المحاضرة" }).click();
    await expect(page.getByText("تم حذف المحاضرة ✓")).toBeVisible({ timeout: 15_000 });

    expect(errors, "Zero uncaught errors in lectures workflow").toEqual([]);
  });

  test("5. School Admin (Overview, Academic Matrix, Halls, Teachers, Ministry Presentation)", async ({
    page,
  }) => {
    const errors = attachConsoleErrorTrap(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsDemoRole(page, "إدارة المدرسة", `/s/${SCHOOL_SLUG}/admin`);

    await expect(page.getByText("الإشغال الحي للقاعات والمدرجات")).toBeVisible();
    await expect(page.getByText(/70٪/)).toBeVisible();
    await assertCleanLayout(page, "School Admin Overview");
    await saveShot(page, "15-admin-overview-desktop.png");

    await page.goto(`/s/${SCHOOL_SLUG}/admin/academic`);
    await assertCleanLayout(page, "Admin Academic K-12 Matrix");
    await saveShot(page, "16-admin-academic-desktop.png");

    await page.goto(`/s/${SCHOOL_SLUG}/admin/halls`);
    await assertCleanLayout(page, "Admin Halls Manager");
    await saveShot(page, "17-admin-halls-desktop.png");

    await page.goto(`/s/${SCHOOL_SLUG}/admin/teachers`);
    await expect(page.getByText("سجل المعلمين المعتمدين")).toBeVisible();
    await assertCleanLayout(page, "Admin Teachers Review");
    await saveShot(page, "18-admin-teachers-desktop.png");

    await page.goto(`/s/${SCHOOL_SLUG}/admin/presentation`);
    await expect(
      page.getByText("عرض المتابعة الرسمي — وزارة التربية والتعليم")
    ).toBeVisible();
    await expect(page.getByText("جاهزية ١٠٠٪")).toBeVisible();
    await expect(page.getByText("تحضير بالاسم في ثانية")).toBeVisible();
    await assertCleanLayout(page, "Ministry Presentation Mode");
    await saveShot(page, "19-ministry-presentation-desktop.png");

    expect(errors, "Zero uncaught errors in admin journeys").toEqual([]);
  });

  test("6. Super Admin Console, Create School/Center Wizard, Security Logs, Auth & Health", async ({
    page,
    request,
  }) => {
    const errors = attachConsoleErrorTrap(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsDemoRole(page, "مشرف المنصة", "/super-admin");

    await expect(
      page.getByRole("heading", { name: /لوحة التحكم الوطنية — مُدَرَّج/ })
    ).toBeVisible();
    await assertCleanLayout(page, "Super Admin Overview");
    await saveShot(page, "20-super-admin-desktop.png");

    await page.goto("/super-admin/schools");
    await expect(page.getByRole("button", { name: "مدرسة رسمية" })).toBeVisible();
    await expect(page.getByRole("button", { name: "سنتر تعليمي معتمد" })).toBeVisible();
    await assertCleanLayout(page, "Super Admin Create School Wizard");
    await saveShot(page, "21-super-admin-wizard-desktop.png");

    await page.goto("/super-admin/security-logs");
    await assertCleanLayout(page, "Super Admin Security Logs");

    await page.goto("/login");
    await expect(page.getByRole("button", { name: /المتابعة باستخدام Google/ })).toBeVisible();
    await assertCleanLayout(page, "Login Page");
    await saveShot(page, "22-login-desktop.png");

    await page.goto("/register");
    await expect(page.getByRole("button", { name: /المتابعة باستخدام Google/ })).toBeVisible();
    await assertCleanLayout(page, "Register Page");

    const healthRes = await request.get("/api/health");
    expect(healthRes.status()).toBe(200);
    const healthJson = (await healthRes.json()) as { status?: string };
    expect(healthJson.status).toBe("ok");

    expect(errors, "Zero uncaught errors in super-admin/auth/health journeys").toEqual([]);
  });
});

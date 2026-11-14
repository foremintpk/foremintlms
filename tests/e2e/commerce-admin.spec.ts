import { expect, test, type Page } from "@playwright/test";
import { readState, totpCode } from "./fixtures";

/** Admin screens for public pricing, course orders, coupons and the course advisor. */

async function signInAdmin(page: Page) {
  const { admin } = readState();
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(admin.email);
  await page.getByLabel(/^password/i).fill(admin.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  for (let attempt = 0; attempt < 2 && new URL(page.url()).pathname.startsWith("/mfa"); attempt++) {
    if (attempt > 0) await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
    await page.getByLabel(/6-digit code/i).fill(totpCode(admin.totpSecret));
    await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 15_000 }).catch(() => undefined);
  }
  await expect(page).toHaveURL(/\/admin/);
}

test("admin commerce and advisor pages require an admin", async ({ page }) => {
  for (const path of ["/admin/pricing/public", "/admin/orders", "/admin/advisor", "/admin/advisor/intents"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("admin can open pricing, orders, coupons and every advisor screen", async ({ page }) => {
  test.setTimeout(180_000);
  await signInAdmin(page);
  const screens: [string, RegExp][] = [
    ["/admin/pricing/public", /public course pricing/i],
    ["/admin/orders", /course orders/i],
    ["/admin/coupons", /coupons/i],
    ["/admin/advisor", /course advisor/i],
    ["/admin/advisor/intents", /course advisor|intents/i],
    ["/admin/advisor/synonyms", /course advisor|synonyms/i],
    ["/admin/advisor/settings", /course advisor|behaviour/i],
    ["/admin/advisor/conversations", /course advisor|conversations/i],
  ];
  for (const [path, heading] of screens) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(heading);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  }
  // The overview shows course-package orders and chatbot activity.
  await page.goto("/admin");
  await expect(page.getByText(/course packages & chatbot/i)).toBeVisible();
  // The price grid and the bulk tool are present.
  await page.goto("/admin/pricing/public");
  await expect(page.getByTestId("price-matrix")).toBeVisible();
  await expect(page.getByTestId("bulk-price-open")).toBeVisible();
  // Intent editor opens from the list.
  await page.goto("/admin/advisor/intents");
  await page.getByRole("link", { name: /build websites/i }).first().click();
  await expect(page).toHaveURL(/\/admin\/advisor\/intents\/[0-9a-f-]{36}/);
  await expect(page.getByLabel(/what the advisor says/i)).toBeVisible();
});

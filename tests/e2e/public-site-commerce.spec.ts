import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "./fixtures";

/**
 * Build your learning plan, guest checkout and the course advisor, in a real
 * browser against the real catalogue (no sign-in). Payment links are created
 * only when E2E_CREATE_PAYMENT_LINKS=1, because each one creates objects in
 * the connected Whop account; payment fulfilment is covered by
 * tests/integration/public-orders.test.ts.
 */

const run = Date.now().toString(36);

// Visitors dismiss the cookie banner first; it (correctly) sits above the advisor launcher until then.
test.beforeEach(async ({ context, baseURL }) => {
  const url = new URL(baseURL ?? "http://localhost:3000");
  await context.addCookies([
    { name: "fm_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ts: Date.now() })), domain: url.hostname, path: "/" },
  ]);
});

function money(text: string | null): number {
  return Math.round(Number((text ?? "").replace(/[^0-9.]/g, "")) * 100);
}

async function openSelector(page: Page) {
  await page.goto("/courses/select");
  await expect(page.getByRole("heading", { level: 1, name: /build your own learning experience/i })).toBeVisible();
  await expect(page.getByTestId("selector-card").first()).toBeVisible();
}

async function addCourses(page: Page, count: number) {
  const prices: number[] = [];
  for (let i = 0; i < count; i++) {
    const card = page.locator('[data-testid="selector-card"][data-selected="false"]').filter({ has: page.getByRole("button", { name: /add to package/i }) }).first();
    prices.push(money(await card.getByTestId("selector-price").textContent()));
    await card.getByTestId("selector-toggle").click();
    await expect(page.locator('[data-testid="selector-card"][data-selected="true"]')).toHaveCount(i + 1);
  }
  return prices;
}

test.describe("course selector and cart (TEST A)", () => {
  test("select, price, remove, persist and change the access period", async ({ page, isMobile }) => {
    await openSelector(page);
    const count = Number(await page.getByTestId("selector-course-count").textContent());
    await expect(page.getByTestId("selector-card")).toHaveCount(count);

    const prices = await addCourses(page, 3);
    if (isMobile) await page.getByTestId("mobile-cart-bar").click();
    // Desktop shows the sticky sidebar; phones show the same summary in a drawer.
    const summary = isMobile ? page.getByRole("dialog") : page.getByRole("complementary", { name: /your learning package/i });
    const total = summary.getByTestId("cart-total");
    await expect(summary.getByTestId("cart-line").first()).toBeVisible();
    await expect(total).toHaveText(new RegExp(((prices[0] + prices[1] + prices[2]) / 100).toFixed(2).replace(".", "\\.")));
    if (isMobile) await page.keyboard.press("Escape");

    // Remove one from its card and check the recalculation.
    await page.locator('[data-testid="selector-card"][data-selected="true"]').first().getByTestId("selector-toggle").click();
    await expect(page.locator('[data-testid="selector-card"][data-selected="true"]')).toHaveCount(2);

    // The cart survives a reload (server-side cart, cookie-identified).
    await page.reload();
    await expect(page.locator('[data-testid="selector-card"][data-selected="true"]')).toHaveCount(2);

    // Switch the access period: prices change for every selected course.
    const periods = page.getByTestId("duration-picker").getByRole("radio");
    if ((await periods.count()) > 1) {
      const before = await page.getByTestId("header-cart").textContent();
      await periods.last().click();
      await expect(page.getByTestId("header-cart")).not.toHaveText(before ?? "");
      await periods.first().click();
    }
  });

  test("checkout validates the student email and shows server prices", async ({ page }) => {
    await openSelector(page);
    await addCourses(page, 2);
    await page.goto("/checkout");
    await expect(page.getByTestId("summary-line")).toHaveCount(2);
    await page.getByTestId("learner-email").fill("not-an-email");
    await page.getByTestId("proceed-secure-checkout").click();
    await expect(page.getByText(/valid email address/i)).toBeVisible();
  });
});

test.describe("coupons (TEST B)", () => {
  const code = `E2E${run}`.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  let couponId: string | null = null;

  test.beforeAll(async () => {
    const { data, error } = await adminClient().from("coupons").insert({ code, discount_type: "percent", amount: 10, applies_to: "packages", status: "active" }).select("id").single();
    if (error) throw new Error(error.message);
    couponId = data.id;
  });

  test.afterAll(async () => {
    if (couponId) await adminClient().from("coupons").delete().eq("id", couponId);
  });

  test("apply, see the discount, remove; reject unknown codes", async ({ page }) => {
    await openSelector(page);
    await addCourses(page, 2);
    await page.goto("/checkout");
    const subtotal = money(await page.getByTestId("cart-subtotal").textContent());

    await page.getByTestId("coupon-input").fill("NOSUCHCODE1");
    await page.getByTestId("coupon-apply").click();
    await expect(page.getByTestId("coupon-feedback")).toContainText(/isn't valid/i);

    await page.getByTestId("coupon-input").fill(code);
    await page.getByTestId("coupon-apply").click();
    await expect(page.getByTestId("coupon-applied")).toContainText(code);
    const discount = Math.floor(subtotal / 10);
    await expect(page.getByTestId("cart-discount")).toContainText((discount / 100).toFixed(2));
    await expect(page.getByTestId("cart-total").first()).toContainText(((subtotal - discount) / 100).toFixed(2));

    await page.getByTestId("coupon-remove").click();
    await expect(page.getByTestId("cart-total").first()).toContainText((subtotal / 100).toFixed(2));
  });
});

test.describe("course advisor (TESTS F, G)", () => {
  async function ask(page: Page, text: string) {
    await page.getByTestId("advisor-input").fill(text);
    await page.getByTestId("advisor-send").click();
  }

  test("recommends real courses, adds them to the shared cart, answers FAQs and falls back", async ({ page }) => {
    await page.goto("/courses/select");
    await page.getByTestId("advisor-launcher").click();
    const panel = page.getByTestId("advisor-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/welcome to foremint academy/i);

    await ask(page, "I want to create websites.");
    const cards = panel.getByTestId("advisor-course");
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().getByTestId("advisor-course-price")).toHaveText(/\$\d/);

    await panel.getByTestId("advisor-add-all").click();
    await expect(panel.getByTestId("advisor-cart").last()).toBeVisible();
    await expect(page.getByTestId("header-cart")).toBeVisible();

    await ask(page, "How do I pay?");
    await expect(panel.getByTestId("advisor-reply").last()).toContainText(/whop/i);

    await ask(page, "purple elephants on tuesday");
    await expect(panel.getByTestId("advisor-reply").last()).toContainText(/tell me a little more about your goal/i);

    await ask(page, "I want to start an online business.");
    await expect(panel.getByTestId("advisor-reply").last()).toContainText(/which direction/i);
    await panel.getByTestId("advisor-option").filter({ hasText: /building my own store/i }).last().click();
    await expect(panel.getByTestId("advisor-reply").last()).toContainText(/shopify or learn general e-commerce/i);
  });

  test("asks for the learner email before creating a payment link", async ({ page }) => {
    test.skip(process.env.E2E_CREATE_PAYMENT_LINKS !== "1", "Set E2E_CREATE_PAYMENT_LINKS=1 to create real (sandbox) payment links.");
    await page.goto("/courses/select");
    await page.getByTestId("advisor-launcher").click();
    await ask(page, "I want to learn SEO.");
    await page.getByTestId("advisor-add-course").first().click();
    await ask(page, "send me the payment link");
    await page.getByTestId("advisor-email").fill(`e2e+advisor-${run}@example.com`);
    await page.getByTestId("advisor-create-link").click();
    await expect(page.getByTestId("advisor-payment-link")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("payment-link-url").last()).toHaveValue(/^https:\/\/(sandbox\.)?whop\.com\/checkout\//);
  });
});

test("security: forged order tokens and cross-site cart writes are refused (TEST H)", async ({ page, request }) => {
  await page.goto("/checkout/order/forged-token-that-does-not-exist-000000000000000");
  await expect(page.getByTestId("order-status")).toHaveAttribute("data-state", "invalid");
  const res = await request.post("/api/commerce/cart", { data: { op: "clear" }, headers: { Origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
  const bad = await request.post("/api/commerce/cart", { data: { op: "add", courseIds: ["not-a-uuid"] } });
  expect(bad.status()).toBe(400);
});

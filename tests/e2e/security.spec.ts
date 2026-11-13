import { expect, test } from "@playwright/test";
import { readState } from "./fixtures";

/**
 * Spec §26 critical security checks that are observable over HTTP / in the
 * browser. Database-level rules are covered by supabase/tests and
 * tests/integration.
 */

test.describe("unauthenticated access", () => {
  for (const path of ["/learn", "/teach", "/admin", "/learn/billing", "/admin/payments"]) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=/);
    });
  }

  test("cron endpoints reject requests without the shared secret", async ({ request }) => {
    const res = await request.get("/api/cron/email-outbox");
    expect(res.status()).toBe(401);
    const wrong = await request.get("/api/cron/email-outbox", { headers: { Authorization: "Bearer wrong-secret-value" } });
    expect(wrong.status()).toBe(401);
  });

  test("the Whop webhook rejects unsigned and forged payloads", async ({ request }) => {
    const forged = {
      type: "payment.succeeded",
      data: { id: "pay_forged", metadata: { foremint_user_id: "00000000-0000-0000-0000-000000000000" } },
    };
    const unsigned = await request.post("/api/webhooks/whop", { data: forged });
    expect([400, 401, 403]).toContain(unsigned.status());
    const badSig = await request.post("/api/webhooks/whop", {
      data: forged,
      headers: { "webhook-id": "msg_forged", "webhook-timestamp": `${Math.floor(Date.now() / 1000)}`, "webhook-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" },
    });
    expect([400, 401, 403]).toContain(badSig.status());
  });

  test("file downloads require a session", async ({ request }) => {
    const res = await request.get("/api/files/00000000-0000-4000-8000-000000000000", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });

  test("the Zoom webhook rejects unsigned events", async ({ request }) => {
    const res = await request.post("/api/webhooks/zoom", { data: { event: "meeting.started", payload: {} } });
    expect([400, 401, 403]).toContain(res.status());
  });
});

test.describe("signed-in student boundaries", () => {
  test.beforeEach(async ({ page }) => {
    const { student } = readState();
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(student.email);
    await page.getByLabel(/^password/i).fill(student.password);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await expect(page).toHaveURL(/\/learn/);
  });

  test("cannot open the admin or teacher workspaces", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/access-denied/);
    await page.goto("/teach");
    await expect(page).toHaveURL(/\/access-denied/);
  });

  test("cannot download a file it has no access to", async ({ page }) => {
    const res = await page.request.get("/api/files/00000000-0000-4000-8000-000000000000", { maxRedirects: 0 });
    expect(res.status()).toBe(403);
  });

  test("a checkout success page alone does not grant access", async ({ page }) => {
    const { otherCourseSlug } = readState();
    await page.goto(`/checkout/success?session=00000000-0000-4000-8000-000000000000`);
    await page.goto(`/learn/courses/${otherCourseSlug}`);
    await expect(page.getByText(/don.t have access|enrol|buy|choose a plan/i).first()).toBeVisible();
  });
});

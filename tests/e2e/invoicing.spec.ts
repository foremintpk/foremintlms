import { expect, test, type Page } from "@playwright/test";
import { adminClient, readState, totpCode } from "./fixtures";

/**
 * Custom invoicing journeys in a real browser against the real database.
 * Whop calls run only when the site is connected to the Whop sandbox; paying
 * a sandbox checkout needs a Whop buyer account, so payment confirmation is
 * covered by tests/integration/custom-invoicing.test.ts.
 */

const run = Date.now().toString(36);

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
}

async function signInAdmin(page: Page) {
  const { admin } = readState();
  await signIn(page, admin.email, admin.password);
  await page.waitForURL(/\/(mfa|admin)/);
  if (page.url().includes("/mfa")) {
    await page.getByLabel(/6-digit code/i).fill(totpCode(admin.totpSecret));
    await page.getByRole("button", { name: /verify and continue/i }).click();
  }
  await page.waitForURL(/\/admin/);
}

test.describe("custom invoicing: boundaries", () => {
  test("billing pages and documents require the right role", async ({ page, request }) => {
    for (const path of ["/admin/billing", "/admin/billing/invoices/new", "/learn/company"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    const res = await request.get("/api/billing/custom-invoices/00000000-0000-4000-8000-000000000000/summary", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });

  test("an invalid invitation link and a forged payment return page grant nothing", async ({ page }) => {
    await page.goto(`/join/${"x".repeat(43)}`);
    await expect(page.getByText(/isn.t valid/i)).toBeVisible();
    await page.goto("/payment/complete?ref=00000000-0000-4000-8000-000000000000&status=success");
    await expect(page.getByText(/couldn.t find that payment/i)).toBeVisible();
  });

  test("a student can't open admin billing and isn't shown a company", async ({ page }) => {
    const { student } = readState();
    await signIn(page, student.email, student.password);
    await expect(page).toHaveURL(/\/learn/);
    await page.goto("/admin/billing");
    await expect(page).toHaveURL(/\/access-denied/);
    await page.goto("/learn/company");
    await expect(page.getByText(/not part of a company/i)).toBeVisible();
  });
});

test.describe("custom invoicing: admin builder", () => {
  const created: string[] = [];
  test.afterAll(async () => {
    const db = adminClient();
    for (const id of created) {
      await db.from("whop_invoice_mappings").delete().eq("local_invoice_id", id);
      await db.from("custom_invoices").delete().eq("id", id);
    }
  });

  test("A: creates an individual invoice for three courses, $100, 90 days, with a payment link when Whop is connected", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/billing/invoices/new");
    await page.getByTestId("customer-type-individual").click();
    await page.getByLabel(/^full name/i).fill(`E2E Customer ${run}`);
    await page.getByLabel(/^email address/i).fill(`e2e+invoice-${run}@example.com`);
    await page.getByLabel(/^description/i).fill(`E2E package ${run}`);
    const boxes = page.locator("#section-courses li label:has(button[role=checkbox]:not([disabled]))");
    for (let i = 0; i < 3; i++) await boxes.nth(i).click();
    await page.getByTestId("amount").fill("100");
    await page.getByTestId("billing-one_time").click();
    await page.getByTestId("access-90").click();
    await expect(page.getByTestId("summary-amount")).toHaveText("$100.00");
    await expect(page.getByTestId("summary-courses")).toHaveText("3 selected");
    await expect(page.getByTestId("summary-access")).toHaveText("90 days from payment");

    await page.getByTestId("review-invoice").click();
    await expect(page.getByText(/review the commercial terms/i)).toBeVisible();
    const generate = page.getByTestId("generate-invoice");
    await expect(generate).toBeDisabled();
    await page.getByTestId("confirm-terms").click();

    if (await generate.isEnabled()) {
      await generate.click();
      await page.waitForURL(/\/admin\/billing\/invoices\/[0-9a-f-]{36}$/);
      created.push(page.url().split("/").pop()!);
      const url = page.getByTestId("payment-url");
      // Sandbox account → the official link Whop returned; otherwise the Whop error is shown with a retry.
      if (await url.isVisible()) {
        await expect(url).toHaveValue(/^https:\/\/(sandbox\.)?whop\.com\/checkout\//);
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.getByTestId("copy-payment-link").first().click();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await url.inputValue());
      } else {
        await expect(page.getByTestId("retry-generation")).toBeVisible();
      }
    } else {
      await page.getByRole("button", { name: /save as draft/i }).click();
      await page.waitForURL(/\/admin\/billing\/invoices\/[0-9a-f-]{36}$/);
      created.push(page.url().split("/").pop()!);
      await expect(page.getByText(/draft/i).first()).toBeVisible();
    }
  });

  test("B: validates a company invoice for all courses before review", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/billing/invoices/new");
    await page.getByTestId("customer-type-company").click();
    await page.getByTestId("course-mode-all_published").click();
    await page.getByTestId("review-invoice").click();
    await expect(page.getByText(/enter the company name/i)).toBeVisible();
    await expect(page.getByText(/enter an amount/i)).toBeVisible();
  });
});

test.describe("custom invoicing: company contact and employees", () => {
  let companyId = "";
  let invoiceId = "";
  let entitlementId = "";
  const employeeEmail = `e2e+employee-${run}@example.com`;

  test.beforeAll(async () => {
    const db = adminClient();
    const { student, courseId } = readState();
    const { data: company } = await db.from("companies").insert({ name: `E2E Company ${run}`, primary_contact_email: student.email, primary_contact_user_id: student.id }).select("id").single();
    companyId = company!.id;
    await db.from("company_members").insert({ company_id: companyId, user_id: student.id, can_invite_members: true, can_view_billing: true });
    const { data: number } = await db.rpc("next_custom_invoice_number", { p_prefix: "E2E" });
    const { data: inv } = await db
      .from("custom_invoices")
      .insert({
        invoice_number: number,
        invoice_type: "company",
        company_id: companyId,
        company_name: `E2E Company ${run}`,
        customer_name: "E2E Contact",
        customer_email: student.email,
        invoice_description: `E2E company package ${run}`,
        amount_minor: 50_000,
        billing_type: "one_time",
        access_mode: "days",
        access_duration_days: 180,
        course_selection_mode: "selected",
        course_ids: [courseId],
        selected_course_snapshot: [{ id: courseId, title: "E2E course", slug: "e2e", category: null, status: "published" }],
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    invoiceId = inv!.id;
    const { data: ent } = await db
      .from("invoice_entitlements")
      .insert({ invoice_id: invoiceId, company_id: companyId, entitlement_type: "one_time", course_selection_mode: "selected", included_course_ids: [courseId], starts_at: new Date().toISOString(), expires_at: new Date(Date.now() + 180 * 86_400_000).toISOString() })
      .select("id")
      .single();
    entitlementId = ent!.id;
    await db.rpc("sync_invoice_entitlement_access", { p_entitlement: entitlementId });
  });

  test.afterAll(async () => {
    const db = adminClient();
    const { data: members } = await db.from("company_members").select("user_id").eq("company_id", companyId);
    await db.from("invoice_entitlements").delete().eq("id", entitlementId);
    await db.from("custom_invoices").delete().eq("id", invoiceId);
    await db.from("companies").delete().eq("id", companyId);
    const { student } = readState();
    for (const m of members ?? []) if (m.user_id !== student.id) await db.auth.admin.deleteUser(m.user_id);
  });

  test("C: the contact invites an employee who joins with their own account and gets the shared courses", async ({ page, browser }) => {
    const { student } = readState();
    await signIn(page, student.email, student.password);
    await page.goto("/learn/company");
    await expect(page.getByRole("heading", { name: `E2E Company ${run}` })).toBeVisible();
    await page.getByTestId("invite-employee").click();
    await page.getByTestId("invite-email").fill(employeeEmail);
    await page.getByTestId("send-invite").click();
    await expect(page.getByText(employeeEmail)).toBeVisible();

    // The emailed link (read from the outbox, as the employee would from their inbox).
    const db = adminClient();
    const { data: outbox } = await db.from("email_outbox").select("payload").eq("to_email", employeeEmail).eq("template_key", "company.employee_invitation").order("created_at", { ascending: false }).limit(1).single();
    const link = String((outbox!.payload as { cta_url: string }).cta_url);
    expect(link).toMatch(/\/join\/[A-Za-z0-9_-]{20,}/);

    const employeeContext = await browser.newContext();
    const employee = await employeeContext.newPage();
    await employee.goto(new URL(link).pathname);
    await employee.getByLabel(/full name/i).fill("E2E Employee");
    await employee.getByLabel(/create a password/i).fill(`Emp!${run}-Strong-Pass-42`);
    await employee.getByTestId("join-create-account").click();
    await employee.waitForURL(/\/learn\/company/);
    await expect(employee.getByText("E2E course").first()).toBeVisible();
    // Employees don't manage the team or see billing.
    await expect(employee.getByTestId("invite-employee")).toHaveCount(0);
    await expect(employee.getByRole("heading", { name: /invoices/i })).toHaveCount(0);
    const summary = await employee.request.get(`/api/billing/custom-invoices/${invoiceId}/summary`);
    expect(summary.status()).toBe(403);
    await employee.goto("/admin/billing");
    await expect(employee).toHaveURL(/\/access-denied/);
    // The link is single-use.
    await employee.goto(new URL(link).pathname);
    await expect(employee.getByText(/already been used/i)).toBeVisible();
    await employeeContext.close();

    // Back on the contact's dashboard the employee is listed.
    await page.reload();
    await expect(page.getByText("E2E Employee")).toBeVisible();
  });
});

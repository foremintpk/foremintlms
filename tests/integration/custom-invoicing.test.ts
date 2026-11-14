import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupUsers, hasSupabase, makeUser, runId, service, skipReason } from "./helpers";

/**
 * Custom invoicing against the real database. Whop is stubbed (no network,
 * no money): the stub returns the payment/membership objects each test
 * prepares, exactly as the webhook path would after re-fetching from Whop.
 * Emails are captured instead of queued.
 */

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {}, updateTag: () => {}, revalidateTag: () => {}, revalidatePath: () => {} }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ getAll: () => [], set: () => {} }) }));

const emails: { templateKey: string; to: string; idempotencyKey: string; payload?: Record<string, unknown> }[] = [];
vi.mock("@/lib/services/email/outbox", () => ({
  enqueueEmail: async (input: { templateKey: string; to: string; idempotencyKey: string; payload?: Record<string, unknown> }) => {
    emails.push(input);
    return { queued: true };
  },
}));
vi.mock("@/lib/services/account", async (orig) => ({ ...(await orig<typeof import("@/lib/services/account")>()), listAdminUserIds: async () => [] }));

const whopPayments = new Map<string, Record<string, unknown>>();
const deletedCheckouts: string[] = [];
const whopMemberships = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/services/payments/whop", () => ({
  WHOP_API_VERSION: "test",
  isWhopReady: async () => true,
  describeWhopError: () => "Whop error",
  isWhopNotFound: () => false,
  getWhopClient: async () => ({
    config: { apiKey: "test", companyId: "biz_it", webhookSecret: "ws_test", environment: "sandbox" },
    client: {
      payments: { retrieve: async ({ id }: { id: string }) => whopPayments.get(id) },
      memberships: { retrieve: async ({ id }: { id: string }) => whopMemberships.get(id) },
      checkoutConfigurations: { delete: async ({ id }: { id: string }) => { deletedCheckouts.push(id); return { id, deleted: true }; } },
    },
  }),
}));

const hasServerEnv = hasSupabase && Boolean(process.env.ENCRYPTION_KEY && process.env.CRON_SECRET);
const DAY = 86_400_000;

function money(amount: string) {
  return { amount, currency: "usd", decimals: 2, display_decimals: 2 };
}

function payment(id: string, opts: { amount?: string; tax?: string | null; account?: string; currency?: string; status?: string; substatus?: string; refunded?: string | null; membershipId?: string | null; paidAt?: string; billingReason?: string; checkoutId?: string | null; variantId?: string | null } = {}) {
  const p = {
    id,
    account_id: opts.account ?? "biz_it",
    currency: opts.currency ?? "usd",
    subtotal: money(opts.amount ?? "100.00"),
    total: money(opts.amount ?? "100.00"),
    tax_amount: opts.tax ? money(opts.tax) : null,
    status: opts.status ?? "paid",
    substatus: opts.substatus ?? "succeeded",
    refunded_amount: opts.refunded ? money(opts.refunded) : null,
    refunded_at: opts.refunded ? new Date().toISOString() : null,
    paid_at: opts.paidAt ?? new Date().toISOString(),
    membership_id: opts.membershipId ?? null,
    metadata: {},
    billing_reason: opts.billingReason ?? "one_time",
    failure_message: opts.status === "open" ? "Card declined" : null,
    payment_instrument: null,
    payments_failed: 0,
    recovery_url: null,
    line_items: [],
    member_id: null,
    user: null,
    customer_email: null,
    checkout_configuration_id: opts.checkoutId ?? null,
    variant_id: opts.variantId ?? null,
    promo_code_id: null,
  };
  whopPayments.set(id, p);
  return p as never;
}

describe.skipIf(!hasServerEnv)("custom invoicing: fulfilment, company access and security", () => {
  let admin = null as unknown as ReturnType<typeof service>;
  let courseIds: string[] = [];
  let otherCourseId = "";
  const invoiceIds: string[] = [];
  const companyIds: string[] = [];
  let individual: Awaited<ReturnType<typeof makeUser>>;
  let outsider: Awaited<ReturnType<typeof makeUser>>;
  let teacher: Awaited<ReturnType<typeof makeUser>>;

  async function createInvoice(values: Record<string, unknown>, whopId: string) {
    const { data: number } = await admin.rpc("next_custom_invoice_number", { p_prefix: "IT" });
    const { data: inv, error } = await admin
      .from("custom_invoices")
      .insert({
        invoice_number: number,
        invoice_type: "individual",
        customer_name: "IT Customer",
        customer_email: `it+none-${runId}@example.com`,
        invoice_description: "IT custom package",
        currency: "usd",
        amount_minor: 10_000,
        billing_type: "one_time",
        access_mode: "days",
        access_duration_days: 90,
        course_selection_mode: "selected",
        course_ids: courseIds,
        selected_course_snapshot: courseIds.map((id, i) => ({ id, title: `Course ${i}`, slug: `c${i}`, category: null, status: "published" })),
        status: "awaiting_payment",
        ...values,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    invoiceIds.push(inv!.id);
    await admin.from("whop_invoice_mappings").insert({ local_invoice_id: inv!.id, environment: "sandbox", whop_account_id: "biz_it", whop_invoice_id: whopId, payment_url: `https://sandbox.whop.com/checkout/${whopId}/?token=t` });
    return inv!;
  }

  async function pay(p: never) {
    const { findInvoiceForPayment, applyCustomInvoicePayment } = await import("@/lib/services/invoicing/fulfillment");
    const link = await findInvoiceForPayment(p);
    expect(link).not.toBeNull();
    return applyCustomInvoicePayment(p, link!);
  }

  beforeAll(async () => {
    admin = service();
    const { data: courses } = await admin.from("courses").select("id").eq("status", "published").order("title").limit(4);
    courseIds = (courses ?? []).slice(0, 3).map((c) => c.id);
    otherCourseId = courses![3].id;
    individual = await makeUser("buyer");
    outsider = await makeUser("outsider");
    teacher = await makeUser("teacher", ["teacher"]);
  });

  afterAll(async () => {
    const { data: ents } = await admin.from("invoice_entitlements").select("id").in("invoice_id", invoiceIds);
    await admin.from("invoice_entitlements").delete().in("id", (ents ?? []).map((e) => e.id));
    await admin.from("payment_transactions").delete().in("custom_invoice_id", invoiceIds);
    await admin.from("whop_invoice_mappings").delete().in("local_invoice_id", invoiceIds);
    await admin.from("access_invitations").delete().in("invoice_id", invoiceIds);
    const { data: created } = await admin.from("custom_invoices").select("company_id").in("id", invoiceIds);
    const allCompanies = [...new Set([...companyIds, ...(created ?? []).map((c) => c.company_id).filter(Boolean)])] as string[];
    await admin.from("custom_invoices").delete().in("id", invoiceIds);
    await admin.from("companies").delete().in("id", allCompanies);
    await cleanupUsers();
  });

  it("A: an individual's verified payment grants exactly the invoiced courses for 90 days from payment", async () => {
    const inv = await createInvoice({ customer_email: individual.email, customer_user_id: individual.id }, `pay_it_a_${runId}`);
    const paidAt = new Date(Date.now() - 5 * DAY).toISOString(); // paid days after the invoice was created
    await pay(payment(`pay_it_a_${runId}`, { paidAt }));

    const { data: after } = await admin.from("custom_invoices").select("status, paid_amount_minor").eq("id", inv.id).single();
    expect(after?.status).toBe("paid");
    expect(after?.paid_amount_minor).toBe(10_000);

    const { data: rows } = await individual.client.from("course_entitlements").select("course_id, status, expires_at, source").eq("source", "invoice");
    expect(rows?.map((r) => r.course_id).sort()).toEqual([...courseIds].sort());
    for (const r of rows ?? []) expect(new Date(r.expires_at!).getTime()).toBe(new Date(paidAt).getTime() + 90 * DAY);
    expect((rows ?? []).some((r) => r.course_id === otherCourseId)).toBe(false);
    expect(emails.some((e) => e.templateKey === "invoice.payment_received" && e.to === individual.email)).toBe(true);
  });

  it("A (payment link): a client pays the direct link; the payment is matched by its checkout and the link is closed", async () => {
    const client = await makeUser("linkbuyer");
    const { data: number } = await admin.rpc("next_custom_invoice_number", { p_prefix: "IT" });
    const { data: inv } = await admin
      .from("custom_invoices")
      .insert({
        invoice_number: number,
        invoice_type: "individual",
        collection_method: "payment_link",
        customer_name: "IT Link",
        customer_email: client.email,
        invoice_description: "IT link package",
        currency: "usd",
        amount_minor: 10_000,
        billing_type: "one_time",
        access_mode: "days",
        access_duration_days: 30,
        course_selection_mode: "selected",
        course_ids: courseIds.slice(0, 1),
        selected_course_snapshot: [{ id: courseIds[0], title: "Course 0", slug: "c0", category: null, status: "published" }],
        status: "awaiting_payment",
      })
      .select("*")
      .single();
    invoiceIds.push(inv!.id);
    const checkoutId = `ch_it_${runId}`;
    const variantId = `plan_it_${runId}`;
    await admin.from("whop_invoice_mappings").insert({ local_invoice_id: inv!.id, environment: "sandbox", whop_account_id: "biz_it", whop_checkout_configuration_id: checkoutId, whop_variant_id: variantId, payment_url: `https://sandbox.whop.com/checkout/${checkoutId}/` });

    // The payer may use any Whop email; access goes to the invoiced customer.
    await pay(payment(`pay_it_link_${runId}`, { checkoutId, variantId }));
    const { data: after } = await admin.from("custom_invoices").select("status").eq("id", inv!.id).single();
    expect(after?.status).toBe("paid");
    expect(deletedCheckouts).toContain(checkoutId);
    const { count } = await client.client.from("course_entitlements").select("id", { count: "exact", head: true }).eq("source", "invoice").eq("status", "active");
    expect(count).toBe(1);

    // Any later payment on the same variant is never treated as the invoice payment.
    const { findInvoiceForPayment } = await import("@/lib/services/invoicing/fulfillment");
    const second = await findInvoiceForPayment(payment(`pay_it_link2_${runId}`, { variantId }));
    expect(second?.kind).toBe("renewal");
  });

  it("E/H: a duplicate webhook changes nothing and reuses every idempotency key", async () => {
    const before = await admin.from("course_entitlements").select("id", { count: "exact", head: true }).eq("user_id", individual.id).eq("source", "invoice");
    const sentBefore = emails.map((e) => e.idempotencyKey);
    await pay(payment(`pay_it_a_${runId}`));
    const afterCount = await admin.from("course_entitlements").select("id", { count: "exact", head: true }).eq("user_id", individual.id).eq("source", "invoice");
    expect(afterCount.count).toBe(before.count);
    const { count: tx } = await admin.from("payment_transactions").select("id", { count: "exact", head: true }).eq("whop_payment_id", `pay_it_a_${runId}`);
    expect(tx).toBe(1);
    const newKeys = emails.map((e) => e.idempotencyKey).slice(sentBefore.length);
    for (const key of newKeys) expect(sentBefore).toContain(key); // the outbox dedupes on these keys
  });

  it("E: an out-of-order failure event cannot undo a verified payment", async () => {
    const { data: inv } = await admin.from("custom_invoices").select("id").eq("customer_user_id", individual.id).single();
    whopPayments.set(`pay_it_a_${runId}`, { ...(whopPayments.get(`pay_it_a_${runId}`) as object) }); // Whop still reports it paid
    await pay(payment(`pay_it_a_${runId}`));
    const { data } = await admin.from("custom_invoices").select("status").eq("id", inv!.id).single();
    expect(data?.status).toBe("paid");
  });

  it("E: wrong amount, wrong currency, wrong Whop account and voided invoices are held for review without access", async () => {
    const cases = [
      { key: "amt", opts: { amount: "99.99" } },
      { key: "cur", opts: { currency: "eur" } },
      { key: "acct", opts: { account: "biz_somebody_else" } },
    ];
    for (const c of cases) {
      const inv = await createInvoice({}, `pay_it_${c.key}_${runId}`);
      await pay(payment(`pay_it_${c.key}_${runId}`, c.opts));
      const { data } = await admin.from("custom_invoices").select("status").eq("id", inv.id).single();
      expect(data?.status, c.key).toBe("under_review");
      const { count } = await admin.from("invoice_entitlements").select("id", { count: "exact", head: true }).eq("invoice_id", inv.id);
      expect(count, c.key).toBe(0);
    }
    const voided = await createInvoice({ status: "voided" }, `pay_it_void_${runId}`);
    await pay(payment(`pay_it_void_${runId}`));
    const { data } = await admin.from("custom_invoices").select("status").eq("id", voided.id).single();
    expect(data?.status).toBe("under_review");
  });

  it("A: a buyer without an account gets an activation invitation, and access only after activating", async () => {
    const email = `it+buyer2-${runId}@example.com`;
    const inv = await createInvoice({ customer_email: email }, `pay_it_new_${runId}`);
    await pay(payment(`pay_it_new_${runId}`));
    const { data: ent } = await admin.from("invoice_entitlements").select("id, user_id").eq("invoice_id", inv.id).single();
    expect(ent?.user_id).toBeNull();
    const { data: invite } = await admin.from("access_invitations").select("*").eq("invoice_id", inv.id).single();
    expect(invite?.kind).toBe("purchase_activation");
    expect(invite?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(emails.some((e) => e.templateKey === "invoice.account_activation" && e.to === email && String(e.payload?.cta_url).includes("/join/"))).toBe(true);

    const buyer = await makeUser(`newbuyer`);
    // makeUser uses its own address; accept with the invited one to mimic account creation from the link.
    const { acceptAccessInvitation } = await import("@/lib/services/invoicing/acceptance");
    await expect(acceptAccessInvitation(invite as never, { id: buyer.id, email: buyer.email })).rejects.toThrow(/different email/);
    await acceptAccessInvitation(invite as never, { id: buyer.id, email });
    const { count } = await admin.from("course_entitlements").select("id", { count: "exact", head: true }).eq("user_id", buyer.id).eq("source", "invoice").eq("status", "active");
    expect(count).toBe(courseIds.length);
    await expect(acceptAccessInvitation(invite as never, { id: buyer.id, email })).rejects.toThrow(); // single use
  });

  describe("B/C/D: company package", () => {
    let contact: Awaited<ReturnType<typeof makeUser>>;
    let employee: Awaited<ReturnType<typeof makeUser>>;
    let lateJoiner: Awaited<ReturnType<typeof makeUser>>;
    let otherCo: Awaited<ReturnType<typeof makeUser>>;
    let companyId = "";
    let packageExpiry = "";

    beforeAll(async () => {
      contact = await makeUser("contact");
      employee = await makeUser("employee");
      lateJoiner = await makeUser("late");
      otherCo = await makeUser("otherco");
    });

    it("paying a company invoice creates the workspace and makes the existing contact its manager", async () => {
      const inv = await createInvoice(
        { invoice_type: "company", company_name: `IT Co ${runId}`, customer_name: "IT Contact", customer_email: contact.email, amount_minor: 50_000, access_duration_days: 180, course_selection_mode: "all_published" },
        `pay_it_co_${runId}`,
      );
      await pay(payment(`pay_it_co_${runId}`, { amount: "500.00" }));
      const { data: after } = await admin.from("custom_invoices").select("company_id, status").eq("id", inv.id).single();
      expect(after?.status).toBe("paid");
      companyId = after!.company_id!;
      companyIds.push(companyId);
      const { data: member } = await admin.from("company_members").select("*").eq("company_id", companyId).eq("user_id", contact.id).single();
      expect(member?.can_invite_members).toBe(true);
      const { data: ent } = await admin.from("invoice_entitlements").select("expires_at").eq("invoice_id", inv.id).single();
      packageExpiry = ent!.expires_at!;
      const { count } = await contact.client.from("course_entitlements").select("id", { count: "exact", head: true }).eq("source", "company").eq("status", "active");
      expect(count).toBe(courseIds.length);
    });

    it("the contact can invite an employee, who joins with their own account and inherits the same expiry", async () => {
      const { resolveCompanyActor, inviteToCompany } = await import("@/lib/services/invoicing/companies");
      const { acceptAccessInvitation } = await import("@/lib/services/invoicing/acceptance");
      const contactUser = { id: contact.id, email: contact.email, fullName: "IT Contact", displayName: "IT", roles: ["student"] } as never;
      const actor = await resolveCompanyActor(contactUser, companyId, { asAdmin: false });
      const invite = await inviteToCompany(actor, companyId, { email: employee.email, canInviteMembers: true });
      expect(invite.can_invite_members).toBe(false); // contacts can't create managers
      await expect(inviteToCompany(actor, companyId, { email: employee.email })).rejects.toThrow(/pending invitation/);
      const { data: row } = await admin.from("access_invitations").select("*").eq("id", invite.id).single();
      await acceptAccessInvitation(row as never, { id: employee.id, email: employee.email });
      const { data: rows } = await employee.client.from("course_entitlements").select("expires_at").eq("source", "company");
      expect(rows).toHaveLength(courseIds.length);
      for (const r of rows ?? []) expect(r.expires_at).toBe(packageExpiry);
    });

    it("a later joiner gets the remaining time, not a new period", async () => {
      const { addCompanyMember } = await import("@/lib/services/invoicing/companies");
      await addCompanyMember({ companyId, userId: lateJoiner.id, performerRole: "admin" });
      const { data: rows } = await lateJoiner.client.from("course_entitlements").select("expires_at").eq("source", "company");
      for (const r of rows ?? []) expect(r.expires_at).toBe(packageExpiry);
    });

    it("I: employees can't see billing, invitations, other members or other companies; outsiders and teachers see nothing", async () => {
      expect((await employee.client.from("custom_invoices").select("id")).data ?? []).toHaveLength(0);
      expect((await employee.client.from("access_invitations").select("id")).data ?? []).toHaveLength(0);
      const { data: members } = await employee.client.from("company_members").select("user_id").eq("company_id", companyId);
      expect(members?.map((m) => m.user_id)).toEqual([employee.id]);
      const { data: contactView } = await contact.client.from("company_members").select("user_id").eq("company_id", companyId);
      expect(contactView?.length).toBeGreaterThanOrEqual(3);
      expect((await contact.client.from("custom_invoices").select("id")).data ?? []).toHaveLength(0); // amounts/notes are admin-only
      expect((await contact.client.from("access_invitations").select("token_hash").limit(1)).error).not.toBeNull(); // token hashes never readable
      for (const u of [outsider, teacher, otherCo]) {
        expect((await u.client.from("companies").select("id").eq("id", companyId)).data ?? []).toHaveLength(0);
        expect((await u.client.from("invoice_entitlements").select("id")).data ?? []).toHaveLength(0);
      }
    });

    it("I: a member can't escalate privileges or join another company by editing rows", async () => {
      const promote = await employee.client.from("company_members").update({ can_invite_members: true }).eq("user_id", employee.id).select("id");
      expect(promote.data ?? []).toHaveLength(0);
      const join = await outsider.client.from("company_members").insert({ company_id: companyId, user_id: outsider.id, can_invite_members: true });
      expect(join.error).not.toBeNull();
      const grant = await outsider.client.from("invoice_entitlements").update({ company_id: companyId }).neq("id", "00000000-0000-0000-0000-000000000000").select("id");
      expect(grant.data ?? []).toHaveLength(0);
      const { resolveCompanyActor } = await import("@/lib/services/invoicing/companies");
      await expect(resolveCompanyActor({ id: employee.id, roles: ["student"] } as never, companyId, { asAdmin: false })).rejects.toThrow();
      await expect(resolveCompanyActor({ id: outsider.id, roles: ["student"] } as never, companyId, { asAdmin: true })).rejects.toThrow();
    });

    it("D: removing an employee ends company access but keeps their own purchase and progress", async () => {
      await admin.from("course_entitlements").insert({ user_id: employee.id, course_id: otherCourseId, scope: "course", source: "manual", grant_reason: "IT own purchase", status: "active" });
      const { resolveCompanyActor, removeCompanyMember } = await import("@/lib/services/invoicing/companies");
      const actor = await resolveCompanyActor({ id: contact.id, roles: ["admin"] } as never, companyId, { asAdmin: true });
      const { data: member } = await admin.from("company_members").select("id").eq("company_id", companyId).eq("user_id", employee.id).single();
      await removeCompanyMember(actor, companyId, member!.id, "IT removal");
      const { data: companyRows } = await employee.client.from("course_entitlements").select("status").eq("source", "company");
      expect(companyRows?.every((r) => r.status === "revoked")).toBe(true);
      const { data: own } = await employee.client.from("course_entitlements").select("status").eq("course_id", otherCourseId).eq("source", "manual").single();
      expect(own?.status).toBe("active");
    });

    it("G: access ends at expiry without waiting for any job, and a manual extension (with reason) restores it", async () => {
      const { data: ent } = await admin.from("invoice_entitlements").select("id, starts_at").eq("company_id", companyId).single();
      const soon = new Date(Date.now() + 2500).toISOString();
      await admin.from("invoice_entitlements").update({ expires_at: soon }).eq("id", ent!.id);
      const { syncPackageAccess, extendPackage } = await import("@/lib/services/invoicing/access");
      await syncPackageAccess(ent!.id);
      await new Promise((r) => setTimeout(r, 3000));
      const { data: valid } = await contact.client.from("course_entitlements").select("id").eq("source", "company").eq("status", "active").gt("expires_at", new Date().toISOString());
      expect(valid ?? []).toHaveLength(0);
      const result = await extendPackage({ entitlementId: ent!.id, mode: "add_from_today", days: 30, reason: "IT goodwill", actorId: contact.id });
      expect(new Date(result.next).getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
      const { data: restored } = await contact.client.from("course_entitlements").select("id").eq("source", "company").eq("status", "active").gt("expires_at", new Date().toISOString());
      expect(restored?.length).toBe(courseIds.length);
      const { count } = await admin.from("company_access_audit_logs").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("action", "access_extended");
      expect(count).toBe(1);
    });

    it("E: a full refund revokes the company package per policy", async () => {
      const { data: inv } = await admin.from("custom_invoices").select("id").eq("company_id", companyId).single();
      await pay(payment(`pay_it_co_${runId}`, { amount: "500.00", substatus: "refunded", refunded: "500.00" }));
      const { data: after } = await admin.from("custom_invoices").select("status").eq("id", inv!.id).single();
      expect(after?.status).toBe("refunded");
      const { data: ent } = await admin.from("invoice_entitlements").select("status").eq("invoice_id", inv!.id).single();
      expect(ent?.status).toBe("revoked");
      const { count } = await contact.client.from("course_entitlements").select("id", { count: "exact", head: true }).eq("source", "company").eq("status", "active");
      expect(count).toBe(0);
    });
  });

  it("F: a recurring invoice follows the live membership: renewal extends once, cancellation keeps the paid period, a contract cap ends it", async () => {
    const sub = await makeUser("subscriber");
    const memId = `mem_it_${runId}`;
    const periodEnd = new Date(Date.now() + 30 * DAY).toISOString();
    whopMemberships.set(memId, { id: memId, status: "active", cancel_at_period_end: false, current_period_end: periodEnd, expires_at: null, metadata: {} });
    const inv = await createInvoice(
      { customer_email: sub.email, customer_user_id: sub.id, billing_type: "recurring", access_mode: null, access_duration_days: null, billing_interval_days: 30, billing_cycles: 3, amount_minor: 25_000, upfront_fee_minor: 5_000, grace_period_days: 3 },
      `pay_it_sub_${runId}`,
    );
    await admin.from("whop_invoice_mappings").update({ whop_membership_id: memId }).eq("local_invoice_id", inv.id);
    await pay(payment(`pay_it_sub_${runId}`, { amount: "300.00", membershipId: memId, billingReason: "subscription_create" }));
    let { data: ent } = await admin.from("invoice_entitlements").select("*").eq("invoice_id", inv.id).single();
    expect(ent?.status).toBe("active");
    expect(new Date(ent!.expires_at!).getTime()).toBe(new Date(periodEnd).getTime() + 3 * DAY);
    expect(ent?.contract_ends_at).not.toBeNull();

    // Renewal: Whop moves the period forward; delivering it twice extends once.
    const nextEnd = new Date(Date.now() + 60 * DAY).toISOString();
    whopMemberships.set(memId, { ...whopMemberships.get(memId)!, current_period_end: nextEnd });
    const renewal = payment(`pay_it_sub2_${runId}`, { amount: "250.00", membershipId: memId, billingReason: "subscription_cycle" });
    await pay(renewal);
    await pay(renewal);
    ({ data: ent } = await admin.from("invoice_entitlements").select("*").eq("invoice_id", inv.id).single());
    expect(new Date(ent!.expires_at!).getTime()).toBe(new Date(nextEnd).getTime() + 3 * DAY);
    const { count: renewed } = await admin.from("custom_invoice_events").select("id", { count: "exact", head: true }).eq("invoice_id", inv.id).eq("event_type", "renewed");
    expect(renewed).toBe(1);

    // Cancellation at period end keeps access until the paid-through date, without grace.
    whopMemberships.set(memId, { ...whopMemberships.get(memId)!, cancel_at_period_end: true });
    const { applyCustomInvoiceMembership, findInvoiceForMembership } = await import("@/lib/services/invoicing/fulfillment");
    const m = whopMemberships.get(memId) as never;
    await applyCustomInvoiceMembership(m, (await findInvoiceForMembership(m))!);
    ({ data: ent } = await admin.from("invoice_entitlements").select("*").eq("invoice_id", inv.id).single());
    expect(ent?.status).toBe("active");
    expect(new Date(ent!.expires_at!).getTime()).toBe(new Date(nextEnd).getTime());

    // Past due beyond grace ends access; it never comes back from an old payment alone.
    whopMemberships.set(memId, { ...whopMemberships.get(memId)!, status: "past_due", cancel_at_period_end: false, current_period_end: new Date(Date.now() - 10 * DAY).toISOString() });
    await applyCustomInvoiceMembership(whopMemberships.get(memId) as never, (await findInvoiceForMembership(whopMemberships.get(memId) as never))!);
    ({ data: ent } = await admin.from("invoice_entitlements").select("status").eq("invoice_id", inv.id).single());
    expect(ent?.status).toBe("expired");
    await pay(payment(`pay_it_sub_${runId}`, { amount: "300.00", membershipId: memId })); // replay of the first payment
    ({ data: ent } = await admin.from("invoice_entitlements").select("status").eq("invoice_id", inv.id).single());
    expect(ent?.status).toBe("expired");
  });

  it("creates drafts from validated input with a frozen course snapshot and exact amounts", async () => {
    const { createOrUpdateInvoice } = await import("@/lib/services/invoicing/invoices");
    const actor = { id: individual.id, roles: ["admin"], primaryRole: "admin", fullName: "IT Admin", displayName: "IT" } as never;
    const result = await createOrUpdateInvoice(
      actor,
      {
        invoiceType: "company",
        customerName: "John Smith",
        customerEmail: "JOHN@company.example",
        companyName: "ABC Digital Solutions",
        invoiceDescription: "IT draft",
        courseSelectionMode: "selected",
        courseIds: courseIds.slice(0, 2),
        currency: "usd",
        amount: "1,250.50",
        billingType: "one_time",
        accessMode: "days",
        accessDurationDays: 180,
      },
      { intent: "draft" },
    );
    invoiceIds.push(result.id);
    const { data: inv } = await admin.from("custom_invoices").select("*").eq("id", result.id).single();
    expect(inv?.status).toBe("draft");
    expect(inv?.amount_minor).toBe(125_050);
    expect(inv?.customer_email).toBe("john@company.example");
    expect(inv?.course_ids).toHaveLength(2);
    expect((inv?.selected_course_snapshot as { title: string }[]).every((c) => typeof c.title === "string")).toBe(true);
    await expect(
      createOrUpdateInvoice(actor, { invoiceType: "individual", customerName: "X Y", customerEmail: "x@example.com", invoiceDescription: "Bad", courseSelectionMode: "selected", courseIds: ["00000000-0000-4000-8000-000000000000"], currency: "usd", amount: "100", billingType: "one_time", accessMode: "days", accessDurationDays: 30 }, { intent: "draft" }),
    ).rejects.toThrow(/no longer exists/);
  });
});

describe.skipIf(hasServerEnv)("custom invoicing: fulfilment, company access and security", () => {
  it.skip(`skipped: ${skipReason}`, () => {});
});

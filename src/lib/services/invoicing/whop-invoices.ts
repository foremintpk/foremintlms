import "server-only";
import { WhopError, type Whop } from "@whop/sdk";
import { describeWhopError, getWhopClient, type WhopConfig } from "@/lib/services/payments/whop";
import { hostedCheckoutUrl, majorStringToMinor, minorToApiNumber } from "@/lib/domain/invoicing";
import type { Tables } from "@/types/database";

/**
 * Whop native invoices (Api-Version-Date ≥ 2026-11-11), current API only.
 *
 * Every custom invoice gets its own hidden Whop product + variant, created
 * inline on Create Invoice (`items[].variant` with `product.external_identifier`
 * and `force_create_new_plan`). Public plans and retail prices are never
 * touched. The draft is then issued, which finalises tax, opens it for
 * payment and returns the signed `checkout_link`; the hosted payment URL is
 * built from that link as Whop's invoices guide documents.
 *
 * Permissions used: payment:charge (create/issue/send/void), payment:basic:read
 * (retrieve, PDF), plan:create (inline variant), access_pass:create (inline
 * product), access_pass:update (archive product), member:basic:read
 * (membership_id, customer name) and member:email:read (recipient emails).
 */

export type CustomInvoiceRow = Tables<"custom_invoices">;
export type WhopInvoiceMappingRow = Tables<"whop_invoice_mappings">;

/** A Whop error code such as "invoice_account_verification_required", when present. */
export function whopErrorCode(err: unknown): string | null {
  if (!(err instanceof WhopError)) return null;
  const body = err.body as { error?: { code?: string } } | undefined;
  return body?.error?.code ?? null;
}

const FRIENDLY: Record<string, string> = {
  invoice_account_verification_required:
    "Whop requires your business account to finish verification before it can issue invoices. Complete verification in the Whop dashboard, then retry.",
  invoice_account_suspended: "Your Whop account is suspended, so it can't issue invoices.",
  invoice_tax_address_required: "Whop needs the customer's billing address to calculate tax for this invoice.",
  invoice_tax_unresolved: "Whop couldn't calculate tax for this invoice. Retry in a few minutes.",
  invoice_send_limit_reached: "Whop already emailed this invoice three times in the last 24 hours.",
  invoice_payment_link_unavailable: "Whop has no payment link for this invoice right now.",
  invoice_not_issuable: "This Whop invoice can no longer be issued.",
};

export function describeInvoiceError(err: unknown): string {
  const code = whopErrorCode(err);
  if (code && FRIENDLY[code]) return FRIENDLY[code];
  return describeWhopError(err);
}

function itemFor(inv: CustomInvoiceRow, courseCount: number) {
  const recurring = inv.billing_type === "recurring";
  const courseNote = inv.includes_future_courses ? "All published courses, including new ones" : `${courseCount} course${courseCount === 1 ? "" : "s"}`;
  return {
    quantity: 1,
    variant: {
      currency: inv.currency,
      billing_type: recurring ? "renewal" : "one_time",
      // One-time: the full amount. Recurring: the optional upfront fee; the
      // first invoice bills initial_price + renewal_price (API ≥ 2026-11-11).
      initial_price: minorToApiNumber(recurring ? inv.upfront_fee_minor : inv.amount_minor, inv.currency),
      ...(recurring
        ? {
            renewal_price: minorToApiNumber(inv.amount_minor, inv.currency),
            billing_period: inv.billing_interval_days,
            ...(inv.billing_cycles ? { split_pay_required_payments: inv.billing_cycles } : {}),
          }
        : {}),
      title: `${inv.invoice_number}`.slice(0, 120),
      description: `${inv.invoice_description} — ${courseNote}`.slice(0, 1000),
      visibility: "hidden",
      force_create_new_plan: true,
      internal_notes: `Foremint custom invoice ${inv.invoice_number} (${inv.id}). Access is managed by Foremint Academy.`,
      product: {
        external_identifier: `foremint-custom-invoice-${inv.id}`,
        title: inv.invoice_description.slice(0, 120),
        description: `Custom training package ${inv.invoice_number} from Foremint Academy.`,
        visibility: "hidden",
      },
    },
  };
}

function memo(inv: CustomInvoiceRow, accessSummary: string): string {
  const who = inv.invoice_type === "company" && inv.company_name ? `${inv.company_name}\n` : "";
  return `${who}${inv.invoice_description}\n${accessSummary}`.slice(0, 1500);
}

export interface IssuedInvoice {
  whopInvoice: Whop.Invoice;
  paymentUrl: string | null;
  mapping: Partial<WhopInvoiceMappingRow>;
}

function mappingFields(i: Whop.Invoice, config: WhopConfig) {
  const line = i.line_items?.[0];
  const currency = (i.total?.currency ?? "usd").toLowerCase();
  return {
    environment: config.environment,
    whop_account_id: i.account_id ?? config.companyId,
    whop_invoice_id: i.id,
    whop_invoice_number: i.number,
    whop_payment_id: i.id,
    whop_membership_id: i.membership_id ?? null,
    whop_member_id: i.member_id ?? null,
    whop_product_id: line?.product_id ?? null,
    whop_variant_id: line?.variant_id ?? null,
    checkout_link: i.checkout_link ?? null,
    payment_url: hostedCheckoutUrl(i.checkout_link, i.id, config.environment),
    provider_status: i.status,
    totals_status: i.totals_status,
    provider_total_minor: i.total ? majorStringToMinor(i.total.amount, currency) : null,
    provider_tax_minor: i.tax_amount ? majorStringToMinor(i.tax_amount.amount, currency) : null,
    provider_currency: currency,
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Create (or reuse) the Whop draft and issue it. Idempotent across retries:
 * the create call carries an idempotency key derived from the local invoice,
 * and an existing draft id is issued again instead of creating a new one.
 */
export async function createAndIssueWhopInvoice(
  inv: CustomInvoiceRow,
  existing: WhopInvoiceMappingRow | null,
  opts: { accessSummary: string; courseCount: number; attempt: number },
): Promise<{ draft: Whop.Invoice | null; issued: Whop.Invoice | null; fields: ReturnType<typeof mappingFields> | null; error: string | null; errorCode: string | null; config: WhopConfig }> {
  const { client, config } = await getWhopClient();
  if (existing && existing.environment !== config.environment) {
    return { draft: null, issued: null, fields: null, error: `This invoice was created in Whop ${existing.environment}; the site is now connected to ${config.environment}. Duplicate it instead.`, errorCode: "environment_mismatch", config };
  }

  let draft: Whop.Invoice | null = null;
  try {
    if (existing?.whop_invoice_id) {
      draft = await client.invoices.retrieve({ id: existing.whop_invoice_id });
    } else {
      draft = await client.invoices.create(
        {
          account_id: config.companyId,
          email_address: inv.customer_email,
          customer_name: inv.customer_name,
          items: [itemFor(inv, opts.courseCount)],
          due_at: inv.due_at,
          memo: memo(inv, opts.accessSummary),
          metadata: {
            foremint_custom_invoice_id: inv.id,
            foremint_invoice_number: inv.invoice_number,
            foremint_invoice_type: inv.invoice_type,
            foremint_environment: config.environment,
          },
          // Delivery is chosen per send (Foremint email or Whop's own); saving recipients sends nothing.
          recipient_emails: [inv.customer_email],
        },
        { idempotencyKey: `foremint-invoice-create-${inv.id}` },
      );
    }
  } catch (err) {
    return { draft: null, issued: null, fields: null, error: describeInvoiceError(err), errorCode: whopErrorCode(err), config };
  }

  if (draft.status !== "draft" && draft.status !== "open") {
    return { draft, issued: draft.status === "paid" ? draft : null, fields: mappingFields(draft, config), error: draft.status === "paid" ? null : `Whop reports this invoice as ${draft.status}.`, errorCode: null, config };
  }

  try {
    const issued =
      draft.status === "open"
        ? draft
        : await client.invoices.issue(
            { id: draft.id, ...(inv.billing_type === "recurring" ? { collection_method: "charge_automatically" as const } : {}) },
            { idempotencyKey: `foremint-invoice-issue-${inv.id}-${opts.attempt}` },
          );
    // Re-read so the stored state (checkout link, membership) is Whop's current one.
    const fresh = await client.invoices.retrieve({ id: issued.id });
    return { draft, issued: fresh, fields: mappingFields(fresh, config), error: fresh.checkout_link ? null : "Whop issued the invoice but returned no payment link. Check that the API key has the payment:charge permission.", errorCode: fresh.checkout_link ? null : "no_checkout_link", config };
  } catch (err) {
    return { draft, issued: null, fields: mappingFields(draft, config), error: describeInvoiceError(err), errorCode: whopErrorCode(err), config };
  }
}

// ---------------------------------------------------------------------------
// Direct payment links (Whop checkout configurations)
// ---------------------------------------------------------------------------

export interface PaymentLinkOutcome {
  fields: Partial<WhopInvoiceMappingRow> & { environment: "sandbox" | "production"; whop_account_id: string };
  paymentUrl: string | null;
  error: string | null;
  errorCode: string | null;
  config: WhopConfig;
}

/**
 * A payment link the client can open and pay straight away (no Whop sign-in
 * beforehand). Built from a dedicated hidden product + variant with stock 1
 * (so the link can be paid once) and a checkout configuration carrying our
 * metadata, which Whop copies onto the payment and membership. Resumable:
 * each created object is saved before the next step, and every create call
 * has an idempotency key derived from the local invoice.
 */
export async function createPaymentLink(
  inv: CustomInvoiceRow,
  existing: WhopInvoiceMappingRow | null,
  opts: { courseCount: number; redirectUrl: string; save: (fields: Partial<WhopInvoiceMappingRow>) => Promise<void> },
): Promise<PaymentLinkOutcome> {
  const { client, config } = await getWhopClient();
  const base = { environment: config.environment, whop_account_id: config.companyId };
  if (existing && existing.environment !== config.environment) {
    return { fields: base, paymentUrl: null, error: `This invoice was created in Whop ${existing.environment}; the site is now connected to ${config.environment}. Duplicate it instead.`, errorCode: "environment_mismatch", config };
  }
  const recurring = inv.billing_type === "recurring";
  const courseNote = inv.includes_future_courses ? "All published courses, including new ones" : `${opts.courseCount} course${opts.courseCount === 1 ? "" : "s"}`;
  const meta = { foremint_custom_invoice_id: inv.id, foremint_invoice_number: inv.invoice_number, foremint_environment: config.environment };
  let productId = existing?.whop_product_id ?? null;
  let variantId = existing?.whop_variant_id ?? null;
  let configId = existing?.whop_checkout_configuration_id ?? null;
  let paymentUrl = existing?.payment_url ?? null;
  try {
    if (!productId) {
      const product = await client.products.create(
        {
          account_id: config.companyId,
          title: inv.invoice_description.slice(0, 120),
          description: `${inv.invoice_type === "company" && inv.company_name ? `${inv.company_name} · ` : ""}${courseNote}. Custom package ${inv.invoice_number} from Foremint Academy.`.slice(0, 500),
          visibility: "hidden",
          metadata: meta,
        },
        { idempotencyKey: `foremint-link-product-${inv.id}` },
      );
      productId = product.id;
      await opts.save({ ...base, whop_product_id: productId });
    }
    if (!variantId) {
      const variant = await client.variants.create(
        {
          account_id: config.companyId,
          product_id: productId,
          currency: inv.currency,
          // Whop refuses null prices, so each billing type sends both fields.
          ...(recurring
            ? {
                billing_type: "renewal",
                initial_price: minorToApiNumber(inv.upfront_fee_minor, inv.currency),
                renewal_price: minorToApiNumber(inv.amount_minor, inv.currency),
                billing_period: inv.billing_interval_days,
                ...(inv.billing_cycles ? { split_pay_required_payments: inv.billing_cycles } : {}),
              }
            : { billing_type: "one_time", initial_price: minorToApiNumber(inv.amount_minor, inv.currency), renewal_price: 0 }),
          title: inv.invoice_number,
          description: `${inv.invoice_description} — ${courseNote}`.slice(0, 1000),
          visibility: "hidden",
          release_method: "buy_now",
          stock: 1,
          unlimited_stock: false,
          allow_multiple_quantity: false,
          internal_notes: `Foremint custom invoice ${inv.invoice_number} (${inv.id}). Access is managed by Foremint Academy.`,
          metadata: meta,
        },
        { idempotencyKey: `foremint-link-variant-${inv.id}` },
      );
      variantId = variant.id;
      await opts.save({ ...base, whop_variant_id: variantId });
    }
    if (!configId || !paymentUrl) {
      const cfg = await client.checkoutConfigurations.create(
        { account_id: config.companyId, variant_id: variantId, metadata: meta, redirect_url: opts.redirectUrl },
        { idempotencyKey: `foremint-link-checkout-${inv.id}` },
      );
      configId = cfg.id;
      paymentUrl = cfg.purchase_url ?? null;
      if (!paymentUrl) {
        await opts.save({ ...base, whop_checkout_configuration_id: configId });
        return { fields: base, paymentUrl: null, error: "Whop created the checkout but returned no payment link.", errorCode: "no_purchase_url", config };
      }
    }
  } catch (err) {
    return { fields: { ...base, whop_product_id: productId, whop_variant_id: variantId }, paymentUrl: null, error: describeInvoiceError(err), errorCode: whopErrorCode(err), config };
  }
  return {
    fields: {
      ...base,
      whop_product_id: productId,
      whop_variant_id: variantId,
      whop_checkout_configuration_id: configId,
      payment_url: paymentUrl,
      provider_status: "open",
      provider_currency: inv.currency,
      provider_total_minor: inv.billing_type === "recurring" ? inv.amount_minor + inv.upfront_fee_minor : inv.amount_minor,
      last_synced_at: new Date().toISOString(),
    },
    paymentUrl,
    error: null,
    errorCode: null,
    config,
  };
}

/** Stop a payment link from working: delete its checkout and hide its variant and product (kept for audit). */
export async function closePaymentLink(mapping: Pick<WhopInvoiceMappingRow, "whop_checkout_configuration_id" | "whop_variant_id" | "whop_product_id">): Promise<boolean> {
  const { client } = await getWhopClient();
  let ok = true;
  if (mapping.whop_checkout_configuration_id) {
    try {
      await client.checkoutConfigurations.delete({ id: mapping.whop_checkout_configuration_id });
    } catch (err) {
      if (!(err instanceof WhopError && err.statusCode === 404)) ok = false;
    }
  }
  if (mapping.whop_variant_id) {
    try {
      await client.variants.update({ id: mapping.whop_variant_id, visibility: "archived" });
    } catch {
      ok = false;
    }
  }
  if (mapping.whop_product_id) ok = (await archiveWhopProduct(mapping.whop_product_id)) && ok;
  return ok;
}

/** Payments made through an invoice's dedicated variant (used to refresh a payment link's status). */
export async function listVariantPayments(variantId: string, accountId: string): Promise<Whop.Payment[]> {
  const { client } = await getWhopClient();
  const page = await client.payments.list({ account_id: accountId, variant_id: variantId });
  const out: Whop.Payment[] = [];
  for await (const p of page) {
    out.push(p as unknown as Whop.Payment);
    if (out.length >= 25) break;
  }
  return out;
}

/** Whop's own receipt PDF for a paid payment (short-lived link). */
export async function whopPaymentPdfUrl(paymentId: string): Promise<string> {
  const { client } = await getWhopClient();
  const pdf = await client.payments.generatePdf({ id: paymentId });
  return pdf.url;
}

export async function retrieveWhopInvoice(id: string) {
  const { client, config } = await getWhopClient();
  const invoice = await client.invoices.retrieve({ id });
  return { invoice, fields: mappingFields(invoice, config), config };
}

export async function voidWhopInvoice(id: string): Promise<Whop.Invoice> {
  const { client } = await getWhopClient();
  return client.invoices.void({ id }, { idempotencyKey: `foremint-invoice-void-${id}` });
}

export async function sendWhopInvoice(id: string, attemptKey: string): Promise<Whop.Invoice> {
  const { client } = await getWhopClient();
  return client.invoices.send({ id }, { idempotencyKey: `foremint-invoice-send-${id}-${attemptKey}` });
}

/** Whop's own invoice PDF: a short-lived link (≈15 minutes). Each call makes a new file. */
export async function whopInvoicePdfUrl(id: string): Promise<string> {
  const { client } = await getWhopClient();
  const pdf = await client.invoices.generatePdf({ id });
  return pdf.url;
}

/** Hide an unpaid, voided invoice's product on Whop (kept for audit history, never deleted). */
export async function archiveWhopProduct(productId: string): Promise<boolean> {
  try {
    const { client } = await getWhopClient();
    await client.products.update({ id: productId, visibility: "archived" });
    return true;
  } catch (err) {
    console.warn("[invoicing] could not archive Whop product", productId, describeWhopError(err));
    return false;
  }
}

export async function cancelWhopMembership(membershipId: string, atPeriodEnd: boolean, reason: string) {
  const { client } = await getWhopClient();
  return client.memberships.cancel({ id: membershipId, cancel_at_period_end: atPeriodEnd, reason });
}

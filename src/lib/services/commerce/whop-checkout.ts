import "server-only";
import type { WhopClient } from "@whop/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopClient, type WhopConfig } from "@/lib/services/payments/whop";
import { closePaymentLink, describeInvoiceError, listVariantPayments, whopErrorCode } from "@/lib/services/invoicing/whop-invoices";
import { minorToApiNumber } from "@/lib/domain/invoicing";
import { courseTitlesText, durationAccessLabel, durationKeyFromDays } from "@/lib/domain/commerce";
import type { Json } from "@/types/database";
import type { OrderItemRow, OrderRow } from "./store";

/**
 * Whop side of a course-package order. Reuses the payment-link pattern that
 * custom invoices already use (and its helpers): one hidden, one-time
 * variant per order, priced at the order's exact discounted total, with
 * stock 1 so it can be paid once, plus a checkout configuration carrying our
 * order metadata (Whop copies it onto the payment). All variants live under
 * one shared hidden "course package" product per Whop account, so the Whop
 * dashboard doesn't fill up with products. Every create call has an
 * idempotency key derived from the order, so retries never duplicate.
 */

const PRODUCTS_SETTING = "commerce.whop_package_products";

async function ensurePackageProduct(client: WhopClient, config: WhopConfig): Promise<string> {
  const admin = createAdminClient();
  const key = `${config.environment}:${config.companyId}`;
  const { data } = await admin.from("platform_settings").select("value").eq("key", PRODUCTS_SETTING).maybeSingle();
  const map = (data?.value && typeof data.value === "object" && !Array.isArray(data.value) ? (data.value as Record<string, string>) : {}) ?? {};
  if (typeof map[key] === "string" && map[key].startsWith("prod_")) return map[key];

  const product = await client.products.create(
    {
      account_id: config.companyId,
      title: "Foremint Academy course package",
      description: "Courses chosen on the Foremint Academy website. Access is managed by Foremint Academy.",
      visibility: "hidden",
      metadata: { foremint_kind: "course_package" },
    },
    { idempotencyKey: `foremint-package-product-${config.environment}-${config.companyId}` },
  );
  const next = { ...map, [key]: product.id };
  await admin
    .from("platform_settings")
    .upsert({ key: PRODUCTS_SETTING, value: next as unknown as Json, description: "Shared hidden Whop product for course-package orders, per Whop account.", is_public: false }, { onConflict: "key" });
  return product.id;
}

export interface OrderCheckoutOutcome {
  paymentUrl: string | null;
  error: string | null;
  errorCode: string | null;
  config: WhopConfig;
}

/**
 * Create (or finish creating) the order's Whop checkout. Resumable: each
 * created object is saved before the next step.
 */
export async function createOrderCheckout(
  order: OrderRow,
  items: OrderItemRow[],
  opts: { redirectUrl: string | null; save: (patch: Partial<OrderRow>) => Promise<void> },
): Promise<OrderCheckoutOutcome> {
  const { client, config } = await getWhopClient();
  if (order.environment && order.environment !== config.environment) {
    return { paymentUrl: null, error: `This order was created in Whop ${order.environment}; the site now uses ${config.environment}.`, errorCode: "environment_mismatch", config };
  }
  const meta = { foremint_public_order_id: order.id, foremint_order_number: order.order_number, foremint_environment: config.environment };
  const titles = items.map((i) => i.course_title_snapshot);
  const access = durationAccessLabel(durationKeyFromDays(order.duration_days));
  let productId = order.whop_product_id;
  let variantId = order.whop_plan_id;
  let checkoutId = order.whop_checkout_configuration_id;
  let paymentUrl = order.whop_checkout_url;
  try {
    if (!productId) {
      productId = await ensurePackageProduct(client, config);
      await opts.save({ whop_product_id: productId, environment: config.environment, whop_account_id: config.companyId });
    }
    if (!variantId) {
      const variant = await client.variants.create(
        {
          account_id: config.companyId,
          product_id: productId,
          currency: order.currency,
          billing_type: "one_time",
          initial_price: minorToApiNumber(order.total_minor, order.currency),
          renewal_price: 0,
          ...(order.duration_days ? { expiration_days: order.duration_days } : {}),
          title: order.order_number.slice(0, 30),
          description: `${items.length} course${items.length === 1 ? "" : "s"} · ${access}: ${courseTitlesText(titles, 12)}`.slice(0, 1000),
          visibility: "hidden",
          release_method: "buy_now",
          stock: 1,
          unlimited_stock: false,
          allow_multiple_quantity: false,
          internal_notes: `Foremint course package ${order.order_number} (${order.id}). Access is managed by Foremint Academy.`,
          metadata: meta,
        },
        { idempotencyKey: `foremint-order-variant-${order.id}` },
      );
      variantId = variant.id;
      await opts.save({ whop_plan_id: variantId });
    }
    if (!checkoutId || !paymentUrl) {
      const cfg = await client.checkoutConfigurations.create(
        { account_id: config.companyId, variant_id: variantId, metadata: meta, ...(opts.redirectUrl ? { redirect_url: opts.redirectUrl } : {}) },
        { idempotencyKey: `foremint-order-checkout-${order.id}` },
      );
      checkoutId = cfg.id;
      paymentUrl = cfg.purchase_url ?? null;
      await opts.save({ whop_checkout_configuration_id: checkoutId, whop_checkout_url: paymentUrl });
      if (!paymentUrl) return { paymentUrl: null, error: "Whop created the checkout but returned no payment link.", errorCode: "no_purchase_url", config };
    }
  } catch (err) {
    return { paymentUrl: null, error: describeInvoiceError(err), errorCode: whopErrorCode(err), config };
  }
  return { paymentUrl, error: null, errorCode: null, config };
}

/** Stop the order's link from working: delete its checkout and archive its variant (the shared product stays). */
export async function closeOrderCheckout(order: Pick<OrderRow, "whop_checkout_configuration_id" | "whop_plan_id">): Promise<boolean> {
  if (!order.whop_checkout_configuration_id && !order.whop_plan_id) return true;
  return closePaymentLink({ whop_checkout_configuration_id: order.whop_checkout_configuration_id, whop_variant_id: order.whop_plan_id, whop_product_id: null });
}

/** Payments made through the order's own variant (status refresh / reconciliation). */
export async function listOrderPayments(order: Pick<OrderRow, "whop_plan_id" | "whop_account_id">) {
  if (!order.whop_plan_id) return [];
  const { config } = await getWhopClient();
  return listVariantPayments(order.whop_plan_id, order.whop_account_id ?? config.companyId);
}

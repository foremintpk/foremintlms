/** Row shapes for the commerce tables (see 20261114000400_commerce.sql). */

export type ProductKind = "course" | "bundle" | "membership";
export type PlanType = "free" | "one_time" | "recurring";
export type PlanVisibility = "public" | "hidden" | "archived";

export interface ProductRow {
  id: string;
  kind: ProductKind;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  course_id: string | null;
  grants_all_courses: boolean;
  status: "active" | "archived";
  is_featured: boolean;
  sort_order: number;
  whop_product_id: string | null;
  whop_synced_at: string | null;
  whop_sync_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  plan_type: PlanType;
  currency: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  access_duration_days: number | null;
  billing_period_days: number | null;
  trial_days: number | null;
  grace_period_days: number;
  stock_limit: number | null;
  units_sold: number;
  available_from: string | null;
  available_until: string | null;
  promo_label: string | null;
  visibility: PlanVisibility;
  is_featured: boolean;
  sort_order: number;
  whop_plan_id: string | null;
  whop_synced_at: string | null;
  whop_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  amount: number;
  currency: string | null;
  max_redemptions: number | null;
  redemptions_count: number;
  starts_at: string | null;
  expires_at: string | null;
  plan_ids: string[];
  new_customers_only: boolean;
  status: "active" | "disabled" | "archived";
  whop_promo_code_id: string | null;
  whop_synced_at: string | null;
  whop_sync_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CheckoutStatus = "created" | "completed" | "expired" | "failed";

export interface CheckoutSessionRow {
  id: string;
  user_id: string;
  plan_id: string;
  product_id: string;
  coupon_id: string | null;
  whop_checkout_id: string | null;
  purchase_url: string | null;
  status: CheckoutStatus;
  metadata: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
}

export type TransactionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "voided";

export interface PaymentTransactionRow {
  id: string;
  whop_payment_id: string;
  user_id: string | null;
  plan_id: string | null;
  product_id: string | null;
  checkout_session_id: string | null;
  subscription_record_id: string | null;
  whop_membership_id: string | null;
  status: TransactionStatus;
  billing_reason: "initial" | "renewal" | "one_time" | "other" | null;
  currency: string;
  subtotal_cents: number | null;
  discount_cents: number;
  tax_cents: number | null;
  total_cents: number;
  refunded_cents: number;
  promo_code: string | null;
  card_brand: string | null;
  card_last4: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  last_synced_at: string | null;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceling"
  | "canceled"
  | "expired"
  | "completed"
  | "unresolved"
  | "drafted";

export interface SubscriptionRecordRow {
  id: string;
  whop_membership_id: string;
  user_id: string | null;
  plan_id: string | null;
  product_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  manage_url: string | null;
  last_synced_at: string | null;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BillingDocumentRow {
  id: string;
  user_id: string | null;
  transaction_id: string | null;
  document_type: "receipt" | "invoice" | "credit_note";
  issuer: "whop" | "foremint";
  number: string;
  whop_invoice_id: string | null;
  external_url: string | null;
  storage_path: string | null;
  status: "draft" | "issued" | "paid" | "void" | "refunded";
  currency: string;
  total_cents: number;
  issued_at: string;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export interface WebhookEventRow {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: "received" | "processing" | "processed" | "failed" | "ignored";
  attempts: number;
  last_error: string | null;
  received_at: string;
  processed_at: string | null;
  next_attempt_at: string | null;
}

export interface ReconciliationLogRow {
  id: string;
  trigger: "scheduled" | "manual";
  status: "running" | "completed" | "failed" | "skipped";
  started_at: string;
  finished_at: string | null;
  checked_count: number;
  updated_count: number;
  mismatches: ReconciliationMismatch[];
  error: string | null;
  triggered_by: string | null;
}

export interface ReconciliationMismatch {
  kind: "membership" | "payment";
  whopId: string;
  field: string;
  local: string | null;
  remote: string | null;
  action: string;
}

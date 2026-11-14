import { StatusBadge } from "@/components/common/status-badge";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/domain/commerce";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const ORDER_TONE: Record<OrderStatus, Tone> = {
  draft: "neutral",
  pending_payment: "info",
  payment_processing: "info",
  paid: "success",
  fulfillment_pending: "warning",
  fulfilled: "success",
  failed: "danger",
  expired: "neutral",
  cancelled: "neutral",
  refunded: "neutral",
  partially_refunded: "warning",
  under_review: "warning",
};

const PAYMENT_LABEL: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  pending: { label: "Pending", tone: "info" },
  succeeded: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Part refunded", tone: "warning" },
  disputed: { label: "Disputed", tone: "danger" },
  not_required: { label: "Free", tone: "brand" },
};

const FULFILLMENT_LABEL: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  awaiting_activation: { label: "Awaiting activation", tone: "info" },
  fulfilled: { label: "Access active", tone: "success" },
  failed: { label: "Setup failed", tone: "danger" },
  suspended: { label: "Suspended", tone: "warning" },
  revoked: { label: "Revoked", tone: "danger" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} label={ORDER_STATUS_LABEL[status as OrderStatus] ?? status} tone={ORDER_TONE[status as OrderStatus] ?? "neutral"} />;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = PAYMENT_LABEL[status] ?? { label: status, tone: "neutral" as Tone };
  return <StatusBadge status={status} label={s.label} tone={s.tone} />;
}

export function FulfillmentStatusBadge({ status }: { status: string }) {
  const s = FULFILLMENT_LABEL[status] ?? { label: status, tone: "neutral" as Tone };
  return <StatusBadge status={status} label={s.label} tone={s.tone} />;
}

export function SourceBadge({ source }: { source: string }) {
  return <StatusBadge status={source} label={source === "advisor" ? "Course advisor" : "Website"} tone={source === "advisor" ? "brand" : "neutral"} />;
}

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_LABEL).map(([value, v]) => ({ value, label: v.label }));

import { StatusBadge } from "@/components/common/status-badge";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/domain/invoicing";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONE: Record<InvoiceStatus, Tone> = {
  draft: "neutral",
  pending_generation: "info",
  awaiting_payment: "brand",
  paid: "success",
  past_due: "warning",
  failed: "danger",
  expired: "neutral",
  cancelled: "neutral",
  voided: "neutral",
  refunded: "neutral",
  partially_refunded: "warning",
  under_review: "danger",
};

/** Local (Foremint) invoice status. "Paid" only ever comes from a verified Whop payment. */
export function InvoiceStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as InvoiceStatus;
  return <StatusBadge status={status} label={INVOICE_STATUS_LABEL[s] ?? status} tone={TONE[s] ?? "neutral"} className={className} />;
}

const PACKAGE_TONE: Record<string, Tone> = { active: "success", expired: "neutral", suspended: "warning", revoked: "danger" };

export function PackageStatusBadge({ status, expiresAt, className }: { status: string; expiresAt?: string | null; className?: string }) {
  const now = new Date();
  const ended = status === "active" && expiresAt && new Date(expiresAt) <= now;
  const s = ended ? "expired" : status;
  return <StatusBadge status={s} label={s === "active" ? "Access active" : s === "expired" ? "Access ended" : s === "suspended" ? "Access suspended" : "Access revoked"} tone={PACKAGE_TONE[s] ?? "neutral"} className={className} />;
}

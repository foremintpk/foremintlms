/**
 * Maps payment-provider membership state to our entitlement state.
 * Pure — the Whop webhook handler and reconciliation job both use it, so a
 * webhook and a later API check always reach the same conclusion.
 */

export type MembershipStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceling"
  | "canceled"
  | "expired"
  | "completed"
  | "unresolved"
  | "drafted";

export interface MembershipSnapshot {
  status: MembershipStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  /** True when a refund or chargeback was recorded against the membership. */
  refunded?: boolean;
  disputed?: boolean;
}

export interface EntitlementTarget {
  status: "active" | "expired" | "revoked" | "suspended";
  expiresAt: Date | null;
  reason: string;
}

const DAY_MS = 86_400_000;

export function entitlementForMembership(m: MembershipSnapshot, graceDays: number, now: Date = new Date()): EntitlementTarget {
  if (m.refunded) return { status: "revoked", expiresAt: now, reason: "Payment refunded" };
  if (m.disputed || m.status === "unresolved") return { status: "suspended", expiresAt: null, reason: "Payment disputed" };

  const periodEnd = m.currentPeriodEnd;
  const withGrace = periodEnd ? new Date(periodEnd.getTime() + graceDays * DAY_MS) : null;

  switch (m.status) {
    case "trialing":
    case "active":
    case "canceling":
      // Paid through the period; renewal extends it. Cancel-at-period-end
      // keeps access until the period closes, without grace.
      return {
        status: "active",
        expiresAt: m.cancelAtPeriodEnd || m.status === "canceling" ? periodEnd : withGrace,
        reason: m.cancelAtPeriodEnd ? "Cancels at period end" : "Membership active",
      };
    case "past_due":
      if (withGrace && withGrace.getTime() > now.getTime()) {
        return { status: "active", expiresAt: withGrace, reason: "Payment past due — in grace period" };
      }
      return { status: "expired", expiresAt: withGrace ?? now, reason: "Payment past due" };
    case "canceled":
    case "expired":
    case "completed":
      // Ended memberships keep access only until a period end still in the future.
      if (periodEnd && periodEnd.getTime() > now.getTime() && m.status === "canceled") {
        return { status: "active", expiresAt: periodEnd, reason: "Cancelled — access until period end" };
      }
      return { status: "expired", expiresAt: periodEnd && periodEnd < now ? periodEnd : now, reason: `Membership ${m.status}` };
    case "drafted":
    default:
      return { status: "suspended", expiresAt: null, reason: "Membership not active yet" };
  }
}

/** Normalise provider status strings (case, aliases) to our union. */
export function normalizeMembershipStatus(raw: string | null | undefined): MembershipStatus {
  const s = (raw ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const known: MembershipStatus[] = ["trialing", "active", "past_due", "canceling", "canceled", "expired", "completed", "unresolved", "drafted"];
  if ((known as string[]).includes(s)) return s as MembershipStatus;
  if (s === "cancelled") return "canceled";
  if (s === "cancelling") return "canceling";
  return "unresolved";
}

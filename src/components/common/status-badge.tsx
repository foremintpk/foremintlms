import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info-soft text-info",
};

/** Default tone for statuses used across the platform. */
const STATUS_TONE: Record<string, Tone> = {
  // publication
  draft: "neutral",
  in_review: "warning",
  published: "success",
  unpublished: "neutral",
  archived: "neutral",
  scheduled: "info",
  // access
  active: "success",
  expired: "neutral",
  revoked: "danger",
  suspended: "danger",
  completed: "brand",
  // payments
  pending: "warning",
  succeeded: "success",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "warning",
  disputed: "danger",
  voided: "neutral",
  void: "neutral",
  issued: "success",
  // subscriptions
  trialing: "info",
  past_due: "warning",
  canceling: "warning",
  canceled: "neutral",
  // tickets
  open: "info",
  in_progress: "brand",
  waiting_on_student: "warning",
  resolved: "success",
  closed: "neutral",
  // assessment
  submitted: "info",
  under_review: "brand",
  resubmission_requested: "warning",
  graded: "success",
  approved: "success",
  needs_review: "warning",
  passed: "success",
  // teachers / integrations
  invited: "info",
  approved_teacher: "success",
  connected: "success",
  configured: "info",
  not_configured: "neutral",
  error: "danger",
  live: "danger",
  // email
  sent: "success",
  sending: "info",
  skipped: "neutral",
  cancelled: "neutral",
  // generic
  visible: "success",
  hidden: "neutral",
  removed: "danger",
  new: "info",
  contacted: "brand",
  spam: "neutral",
  dismissed: "neutral",
  actioned: "success",
};

export function humanizeStatus(status: string): string {
  const s = status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: string;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const t = tone ?? STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        TONES[t],
        className,
      )}
    >
      {status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> : null}
      {label ?? humanizeStatus(status)}
    </span>
  );
}

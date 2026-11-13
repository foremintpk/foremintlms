import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";
import { statusLabel, type TicketPriority, type TicketStatus } from "../lib/tickets";

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-warning-soft text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

export function TicketStatusBadge({ status, viewer }: { status: TicketStatus; viewer: "requester" | "staff" }) {
  return <StatusBadge status={status} label={statusLabel(status, viewer)} />;
}

export function PriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium capitalize", PRIORITY_STYLE[priority], className)}>
      {priority}
    </span>
  );
}

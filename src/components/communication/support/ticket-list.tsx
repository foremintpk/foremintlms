import Link from "next/link";
import { LocalTime } from "@/components/common/local-time";
import type { TicketListItem } from "@/lib/services/support";
import { CATEGORY_LABEL } from "../lib/tickets";
import { PriorityBadge, TicketStatusBadge } from "./ticket-badges";

/** Requester-facing ticket list (cards, works on every screen size). */
export function MyTicketList({ items, basePath }: { items: TicketListItem[]; basePath: string }) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
      {items.map((t) => (
        <li key={t.id}>
          <Link href={`${basePath}/${t.id}`} className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{t.number}</span> · {CATEGORY_LABEL[t.category]}
                {t.courseTitle ? ` · ${t.courseTitle}` : ""}
              </p>
              <p className="mt-0.5 truncate font-medium">{t.subject}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Updated <LocalTime value={t.lastActivityAt} format="relative" />
              </p>
            </div>
            <TicketStatusBadge status={t.status} viewer="requester" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TicketMeta({ t }: { t: TicketListItem }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <TicketStatusBadge status={t.status} viewer="staff" />
      <PriorityBadge priority={t.priority} />
    </span>
  );
}

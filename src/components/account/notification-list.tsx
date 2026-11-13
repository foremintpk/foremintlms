"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Award,
  Bell,
  CalendarClock,
  CheckCheck,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  MessagesSquare,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/common/local-time";
import { createClient } from "@/lib/supabase/browser";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { deleteNotificationAction, markAllNotificationsReadAction, markNotificationReadAction } from "./notification-actions";

export interface NotificationItem {
  id: string;
  category: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

const ICONS: Record<string, LucideIcon> = {
  learning: Award,
  billing: CreditCard,
  messages: MessageSquare,
  discussions: MessagesSquare,
  support: LifeBuoy,
  live: CalendarClock,
  system: ShieldCheck,
};

/** Only follow in-app links from notifications (never external URLs). */
function safeHref(url: string | null): string | null {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

export function NotificationList({ userId, items, hasUnread }: { userId: string; items: NotificationItem[]; hasUnread: boolean }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const markRead = useAction(markNotificationReadAction, { silent: true });
  const markAll = useAction(markAllNotificationsReadAction, { onSuccess: () => router.refresh() });
  const remove = useAction(deleteNotificationAction, { silent: true, onSuccess: () => router.refresh() });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { title?: string };
          toast(row.title ?? "New notification");
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  const visible = items.filter((n) => !hidden.has(n.id));

  return (
    <div className="grid gap-4">
      {hasUnread ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={markAll.pending} onClick={() => markAll.run(undefined)}>
            <CheckCheck className="size-4" /> Mark all as read
          </Button>
        </div>
      ) : null}
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
        {visible.map((n) => {
          const Icon = ICONS[n.category] ?? Bell;
          const unread = !n.read_at && !readIds.has(n.id);
          const href = safeHref(n.url);
          const content = (
            <>
              <span
                className={cn(
                  "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
                  unread ? "bg-brand-soft text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", unread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>{n.title}</span>
                {n.body ? <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span> : null}
                <span className="mt-1 block text-xs text-muted-foreground">
                  <LocalTime value={n.created_at} format="relative" />
                </span>
              </span>
            </>
          );
          const onOpen = () => {
            if (unread) {
              setReadIds((s) => new Set(s).add(n.id));
              void markRead.run({ id: n.id });
            }
          };
          return (
            <li key={n.id} className={cn("group relative flex items-start gap-2 px-4 py-3.5", unread && "bg-brand-soft/30")}>
              {unread ? <span className="absolute top-5 left-1.5 size-1.5 rounded-full bg-primary" aria-label="Unread" /> : null}
              {href ? (
                <Link href={href} onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  {content}
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                aria-label={`Delete notification: ${n.title}`}
                onClick={() => {
                  setHidden((s) => new Set(s).add(n.id));
                  void remove.run({ id: n.id });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

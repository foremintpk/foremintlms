import "server-only";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { parseListParams } from "@/lib/list-params";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { NotificationList, type NotificationItem } from "./notification-list";

/** Paginated notification centre shared by the student and instructor workspaces. */
export async function NotificationsView({
  userId,
  basePath,
  searchParams,
}: {
  userId: string;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = parseListParams(searchParams, { pageSize: 20, filterKeys: ["filter"] });
  const unreadOnly = params.filters.filter === "unread";
  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select("id, category, title, body, url, read_at, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(params.from, params.to);
  if (unreadOnly) query = query.is("read_at", null);

  const [{ data, count, error }, unread] = await Promise.all([
    query,
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  const items = (data ?? []) as NotificationItem[];
  const unreadCount = unread.count ?? 0;

  const tab = (label: string, href: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="grid gap-4">
      <nav className="flex items-center gap-1" aria-label="Filter notifications">
        {tab("All", basePath, !unreadOnly)}
        {tab(`Unread${unreadCount ? ` (${unreadCount})` : ""}`, `${basePath}?filter=unread`, unreadOnly)}
      </nav>
      {items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={unreadOnly ? "You're all caught up" : "No notifications yet"}
          description={
            unreadOnly
              ? "New activity on your courses, messages and billing will show up here."
              : "We'll let you know here about new lessons, feedback, live classes, replies and account activity."
          }
        />
      ) : (
        <NotificationList userId={userId} items={items} hasUnread={unreadCount > 0} />
      )}
      <PaginationBar basePath={basePath} searchParams={searchParams} page={params.page} pageSize={params.pageSize} total={count ?? 0} />
    </div>
  );
}

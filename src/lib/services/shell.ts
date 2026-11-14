import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";
import type { ShellArea } from "@/components/app-shell/nav-config";
import type { ShellBadges, ShellUser } from "@/components/app-shell/types";

export function toShellUser(user: SessionUser): ShellUser {
  return {
    id: user.id,
    displayName: user.displayName,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    roles: user.roles,
  };
}

async function unreadConversationCount(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("conversation_participants")
    .select("last_read_at, conversations!inner(last_message_at)")
    .eq("user_id", userId);
  return (data ?? []).filter((row) => {
    const conv = row.conversations as unknown as { last_message_at: string | null } | null;
    const last = conv?.last_message_at;
    return Boolean(last && (!row.last_read_at || new Date(last) > new Date(row.last_read_at)));
  }).length;
}

/** Counts shown as badges in the dashboard navigation. */
export async function getShellBadges(user: SessionUser, area: ShellArea): Promise<ShellBadges> {
  const admin = createAdminClient();
  const badges: ShellBadges = {};

  const [notifications, messages] = await Promise.all([
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    unreadConversationCount(user.id),
  ]);
  badges.unreadNotifications = notifications.count ?? 0;
  badges.unreadMessages = messages;

  if (area === "teach") {
    const { data: courses } = await admin.from("course_instructors").select("course_id").eq("user_id", user.id);
    const ids = (courses ?? []).map((c) => c.course_id);
    if (ids.length) {
      const [subs, attempts, tickets] = await Promise.all([
        admin
          .from("assignment_submissions")
          .select("id", { count: "exact", head: true })
          .in("course_id", ids)
          .in("status", ["submitted", "under_review"]),
        admin.from("quiz_attempts").select("id", { count: "exact", head: true }).in("course_id", ids).eq("status", "needs_review"),
        admin
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"])
          .or(`assigned_to.eq.${user.id},and(course_id.in.(${ids.join(",")}),category.in.(course_content,certificate))`),
      ]);
      badges.pendingReviews = (subs.count ?? 0) + (attempts.count ?? 0);
      badges.openTickets = tickets.count ?? 0;
    }
  }

  if (area === "admin") {
    const [tickets, pendingCourses, invoicesNeedingReview] = await Promise.all([
      admin.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
      admin.from("courses").select("id", { count: "exact", head: true }).eq("status", "in_review"),
      admin.from("custom_invoices").select("id", { count: "exact", head: true }).eq("status", "under_review"),
    ]);
    badges.openTickets = tickets.count ?? 0;
    badges.pendingCourses = pendingCourses.count ?? 0;
    badges.invoicesNeedingReview = invoicesNeedingReview.count ?? 0;
  }

  return badges;
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CourseSnapshotItem } from "@/lib/domain/invoicing";
import type { Tables } from "@/types/database";
import { getUserCompanies, type CompanyMembership } from "./companies";

/**
 * What a company member sees on /learn/company. Everyone sees the company's
 * courses and access dates; team lists and invitations only reach members
 * with the team-management capability; invoices only reach members allowed
 * to see billing. Nothing from another company is ever loaded.
 */
export async function getCompanyPortal(userId: string, requestedCompanyId: string | null) {
  const memberships = await getUserCompanies(userId);
  if (memberships.length === 0) return null;
  const me: CompanyMembership = memberships.find((m) => m.companyId === requestedCompanyId) ?? memberships[0];
  const admin = createAdminClient();

  const [{ data: company }, { data: ents }] = await Promise.all([
    admin.from("companies").select("id, name, description, status, access_status, seat_limit, primary_contact_user_id, primary_contact_name, primary_contact_email").eq("id", me.companyId).single(),
    admin
      .from("invoice_entitlements")
      .select("id, status, starts_at, expires_at, entitlement_type, subscription_status, includes_future_courses, included_course_ids, invoice_id, custom_invoices!inner(invoice_description, invoice_number, selected_course_snapshot)")
      .eq("company_id", me.companyId)
      .order("created_at", { ascending: false }),
  ]);

  const packages = (ents ?? []).map((e) => {
    const inv = e.custom_invoices as unknown as { invoice_description: string; invoice_number: string; selected_course_snapshot: CourseSnapshotItem[] };
    return { ...e, description: inv.invoice_description, invoiceNumber: inv.invoice_number, snapshot: inv.selected_course_snapshot ?? [] };
  });
  const now = Date.now();
  const live = packages.filter((p) => p.status === "active" && (!p.expires_at || new Date(p.expires_at).getTime() > now));
  const includesAll = live.some((p) => p.includes_future_courses);
  const courseIds = [...new Set(live.flatMap((p) => p.included_course_ids))];
  const { data: courses } = includesAll
    ? await admin.from("courses").select("id, title, slug, short_description").eq("status", "published").order("title")
    : courseIds.length
      ? await admin.from("courses").select("id, title, slug, short_description").in("id", courseIds).order("title")
      : { data: [] as { id: string; title: string; slug: string; short_description: string | null }[] };

  let team: {
    members: (Pick<Tables<"company_members">, "id" | "user_id" | "can_invite_members" | "joined_at" | "membership_status"> & { name: string; email: string; avgProgress: number | null })[];
    invitations: Pick<Tables<"access_invitations">, "id" | "email" | "full_name" | "status" | "expires_at" | "send_count" | "created_at" | "invited_by_role">[];
    activeCount: number;
  } | null = null;
  if (me.canInviteMembers) {
    const [{ data: members }, { data: invitations }] = await Promise.all([
      admin.from("company_members").select("id, user_id, can_invite_members, joined_at, membership_status").eq("company_id", me.companyId).eq("membership_status", "active").order("joined_at"),
      admin.from("access_invitations").select("id, email, full_name, status, expires_at, send_count, created_at, invited_by_role").eq("company_id", me.companyId).in("status", ["pending", "expired"]).order("created_at", { ascending: false }).limit(200),
    ]);
    const ids = (members ?? []).map((m) => m.user_id);
    const [{ data: profiles }, { data: priv }, { data: enrollments }] = ids.length
      ? await Promise.all([
          admin.from("profiles").select("id, full_name").in("id", ids),
          admin.from("profile_private").select("user_id, email").in("user_id", ids),
          admin.from("enrollments").select("user_id, course_id, progress_percent").in("user_id", ids),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
    const scope = new Set(includesAll ? (courses ?? []).map((c) => c.id) : courseIds);
    team = {
      members: (members ?? []).map((m) => {
        const rows = (enrollments ?? []).filter((e) => e.user_id === m.user_id && scope.has(e.course_id));
        return {
          ...m,
          name: (profiles ?? []).find((p) => p.id === m.user_id)?.full_name ?? "",
          email: (priv ?? []).find((p) => p.user_id === m.user_id)?.email ?? "",
          avgProgress: rows.length ? rows.reduce((a, r) => a + Number(r.progress_percent), 0) / rows.length : null,
        };
      }),
      invitations: invitations ?? [],
      activeCount: (members ?? []).length,
    };
  }

  let billing: Pick<Tables<"custom_invoices">, "id" | "invoice_number" | "invoice_description" | "status" | "currency" | "amount_minor" | "billing_type" | "paid_at" | "billing_interval_days">[] | null = null;
  if (me.canViewBilling) {
    const { data } = await admin
      .from("custom_invoices")
      .select("id, invoice_number, invoice_description, status, currency, amount_minor, billing_type, paid_at, billing_interval_days")
      .eq("company_id", me.companyId)
      .in("status", ["paid", "partially_refunded", "refunded"])
      .order("paid_at", { ascending: false });
    billing = data ?? [];
  }

  const { data: allowInvites } = await admin.from("custom_invoices").select("allow_contact_invites").eq("company_id", me.companyId).eq("status", "paid");
  const contactInvitesAllowed = !allowInvites?.length || allowInvites.some((i) => i.allow_contact_invites);

  return { me, memberships, company: company!, packages, live, courses: courses ?? [], team, billing, contactInvitesAllowed };
}

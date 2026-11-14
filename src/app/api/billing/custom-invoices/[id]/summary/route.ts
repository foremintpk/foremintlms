import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { adminNeedsMfa } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserCompanies } from "@/lib/services/invoicing/companies";
import { getServiceSummary } from "@/lib/services/invoicing/summary";
import type { CustomInvoiceRow } from "@/lib/services/invoicing/whop-invoices";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * Branded service summary PDF for a custom invoice.
 * Who may download: administrators (MFA session), the individual purchaser,
 * and company members allowed to see billing for that company.
 * `?regenerate=1` (admins only) writes a new version; `?download=1` saves
 * instead of previewing.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/billing/custom-invoices/[id]/summary">) {
  await connection();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to download documents." }, { status: 401, headers: noStore });

  const { data } = await createAdminClient().from("custom_invoices").select("*").eq("id", id).maybeSingle();
  const inv = data as CustomInvoiceRow | null;
  if (!inv) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });

  const isAdmin = user.roles.includes("admin") && !(await adminNeedsMfa(user));
  let allowed = isAdmin || (inv.invoice_type === "individual" && inv.customer_user_id === user.id && ["paid", "partially_refunded"].includes(inv.status));
  if (!allowed && inv.company_id && ["paid", "partially_refunded"].includes(inv.status)) {
    const membership = (await getUserCompanies(user.id)).find((c) => c.companyId === inv.company_id);
    allowed = Boolean(membership?.canViewBilling);
  }
  if (!allowed) return NextResponse.json({ error: "You don't have access to this document." }, { status: 403, headers: noStore });

  const url = new URL(req.url);
  const { buffer, version } = await getServiceSummary(inv, { regenerate: isAdmin && url.searchParams.get("regenerate") === "1", actorId: user.id });
  const fileName = `service-summary-${inv.invoice_number}-v${version}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      ...noStore,
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${fileName}"`,
    },
  });
}

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { adminNeedsMfa } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeInvoiceError, whopInvoicePdfUrl, whopPaymentPdfUrl } from "@/lib/services/invoicing/whop-invoices";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * The official Whop invoice PDF (administrators only). Whop generates a new
 * file per request and returns a short-lived link, which we redirect to.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/billing/custom-invoices/[id]/whop-pdf">) {
  await connection();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  const user = await getSessionUser();
  if (!user || !user.roles.includes("admin") || (await adminNeedsMfa(user))) {
    return NextResponse.json({ error: "Administrators only." }, { status: user ? 403 : 401, headers: noStore });
  }
  const { data } = await createAdminClient().from("whop_invoice_mappings").select("whop_invoice_id, whop_payment_id").eq("local_invoice_id", id).maybeSingle();
  try {
    // Native invoice: Whop's invoice PDF. Payment link: Whop's receipt for the payment, once paid.
    if (data?.whop_invoice_id) return NextResponse.redirect(await whopInvoicePdfUrl(data.whop_invoice_id), { status: 302, headers: noStore });
    if (data?.whop_payment_id) return NextResponse.redirect(await whopPaymentPdfUrl(data.whop_payment_id), { status: 302, headers: noStore });
    return NextResponse.json({ error: "Whop issues a receipt once the payment link has been paid." }, { status: 404, headers: noStore });
  } catch (err) {
    return NextResponse.json({ error: describeInvoiceError(err) }, { status: 502, headers: noStore });
  }
}

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { adminNeedsMfa } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopClient, describeWhopError } from "@/lib/services/payments/whop";
import { snapshotOf } from "@/lib/services/billing/documents";
import { renderReceiptPdf } from "@/lib/pdf/receipt";
import type { BillingDocumentRow } from "@/lib/services/payments/types";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * Download a billing document (owner or administrator only).
 * - issuer "foremint": rendered from the frozen snapshot.
 * - issuer "whop": Whop generates its own receipt PDF; we redirect to the
 *   short-lived URL it returns.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/billing/documents/[id]/pdf">) {
  await connection();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to download documents." }, { status: 401, headers: noStore });

  const admin = createAdminClient();
  const { data } = await admin.from("billing_documents").select("*").eq("id", id).maybeSingle();
  const doc = data as BillingDocumentRow | null;
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });

  const isOwner = doc.user_id === user.id;
  const isAdmin = user.roles.includes("admin") && !(await adminNeedsMfa(user));
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "You don't have access to this document." }, { status: 403, headers: noStore });

  if (doc.issuer === "whop") {
    const whopPaymentId = (doc.snapshot as { whopPaymentId?: string }).whopPaymentId;
    if (!whopPaymentId) return NextResponse.json({ error: "This receipt isn't linked to a payment." }, { status: 404, headers: noStore });
    try {
      const { client } = await getWhopClient();
      const pdf = await client.payments.generatePdf({ id: whopPaymentId });
      return NextResponse.redirect(pdf.url, { status: 302, headers: noStore });
    } catch (err) {
      return NextResponse.json({ error: describeWhopError(err) }, { status: 502, headers: noStore });
    }
  }

  const snapshot = snapshotOf(doc);
  if (!snapshot) return NextResponse.json({ error: "This document has no printable data." }, { status: 404, headers: noStore });

  const buffer = await renderReceiptPdf(snapshot, new URL(req.url).origin);
  const download = new URL(req.url).searchParams.get("download") === "1";
  const fileName = `${doc.document_type === "credit_note" ? "credit-note" : "receipt"}-${doc.number}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      ...noStore,
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
    },
  });
}

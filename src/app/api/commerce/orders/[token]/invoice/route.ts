import { NextResponse } from "next/server";
import { apiError, noStore } from "@/lib/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { renderOrderInvoicePdf } from "@/lib/pdf/order-invoice";
import { buildOrderInvoiceModel } from "@/lib/services/commerce/invoice";
import { loadOrderByToken, loadOrderItems } from "@/lib/services/commerce/store";

/**
 * GET /api/commerce/orders/:token/invoice — the order's invoice PDF with its
 * current status (Paid / Unpaid / …). Authorised by the unguessable order
 * token (the same one in the order page link and the order emails).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/commerce/orders/[token]/invoice">) {
  try {
    await enforceRateLimit("order-invoice", 30, 600);
    const { token } = await ctx.params;
    const order = await loadOrderByToken(token);
    if (!order) return NextResponse.json({ error: "Invoice not found." }, { status: 404, headers: noStore });
    const model = await buildOrderInvoiceModel(order, await loadOrderItems(order.id));
    const pdf = await renderOrderInvoicePdf(model, new URL(req.url).origin);
    const download = new URL(req.url).searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="invoice-${order.order_number}.pdf"`,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

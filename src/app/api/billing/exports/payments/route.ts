import { NextResponse, connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { adminNeedsMfa } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { parseListParams } from "@/lib/list-params";
import { listPayments } from "@/lib/services/billing/queries";

const MAX_ROWS = 10_000;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of payments using the same filters as Admin → Payments. */
export async function GET(req: Request) {
  await connection();
  const user = await getSessionUser();
  if (!user || !user.roles.includes("admin")) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  if (await adminNeedsMfa(user)) return NextResponse.json({ error: "Verify with your authenticator app first." }, { status: 403 });

  const raw = Object.fromEntries(new URL(req.url).searchParams.entries());
  const params = parseListParams(raw, { pageSize: 100, filterKeys: ["status", "reason", "from", "to"], sortable: ["created", "total", "paid"], defaultSort: "created" });

  const header = ["payment_id", "created_at", "paid_at", "status", "billing_reason", "customer_name", "customer_email", "product", "plan", "currency", "subtotal", "discount", "tax", "total", "refunded", "membership_id"];
  const lines = [header.join(",")];
  let fetched = 0;
  for (let page = 0; fetched < MAX_ROWS; page++) {
    const from = page * 500;
    const { rows } = await listPayments({ ...params, from, to: from + 499 });
    for (const r of rows) {
      lines.push(
        [
          r.whop_payment_id,
          r.created_at,
          r.paid_at,
          r.status,
          r.billing_reason,
          r.customerName,
          r.customerEmail,
          r.productName,
          r.planName,
          r.currency,
          r.subtotal_cents !== null ? (r.subtotal_cents / 100).toFixed(2) : "",
          (r.discount_cents / 100).toFixed(2),
          r.tax_cents !== null ? (r.tax_cents / 100).toFixed(2) : "",
          (r.total_cents / 100).toFixed(2),
          (r.refunded_cents / 100).toFixed(2),
          r.whop_membership_id,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    fetched += rows.length;
    if (rows.length < 500) break;
  }

  await audit({ actor: user, action: "export.payments", entityType: "payment_transaction", summary: `Exported ${fetched} payments`, metadata: { filters: params.filters, q: params.q } });
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

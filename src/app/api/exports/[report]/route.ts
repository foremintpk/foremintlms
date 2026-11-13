import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/guards";
import { apiError, noStore } from "@/lib/api";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { csvFileName, toCsv } from "@/lib/services/admin/csv";
import { collectReportRows, REPORTS } from "@/lib/services/admin/exports";

function parseDay(value: string | null, endOfDay: boolean): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Admin CSV export: /api/exports/<report>?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: Request, ctx: RouteContext<"/api/exports/[report]">) {
  try {
    const user = await assertAdmin();
    await enforceRateLimit("admin-export", 30, 600, user.id);
    const { report: key } = await ctx.params;
    const report = REPORTS[key];
    if (!report) return NextResponse.json({ error: "Unknown report." }, { status: 404, headers: noStore });

    const url = new URL(req.url);
    const from = parseDay(url.searchParams.get("from"), false);
    const to = parseDay(url.searchParams.get("to"), true);
    if (from && to && to < from) return NextResponse.json({ error: "The end date is before the start date." }, { status: 400, headers: noStore });

    const { rows, truncated } = await collectReportRows(report, { from, to });
    const csv = toCsv(report.columns, rows);
    await audit({
      actor: user,
      action: "report.exported",
      entityType: "report",
      entityId: key,
      summary: `${report.label} export (${rows.length} rows)`,
      metadata: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null, rows: rows.length, truncated },
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFileName(key, from, to)}"`,
        "X-Export-Truncated": truncated ? "true" : "false",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

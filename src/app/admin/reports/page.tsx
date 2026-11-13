import { PageHeader } from "@/components/app-shell/page-header";
import { ReportCard } from "@/components/admin/reports/report-card";
import { requireAdmin } from "@/lib/auth/guards";
import { MAX_EXPORT_ROWS, REPORTS } from "@/lib/services/admin/exports";
import { formatNumber } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Reports & exports" };

export default async function ReportsPage() {
  await requireAdmin("/admin/reports");
  return (
    <>
      <PageHeader
        title="Reports & exports"
        description={`Download CSV files for spreadsheets or accounting. Each export is recorded in the audit log and limited to ${formatNumber(MAX_EXPORT_ROWS)} rows.`}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(REPORTS).map(([key, r]) => (
          <ReportCard key={key} reportKey={key} label={r.label} description={r.description} dated={Boolean(r.dateColumn)} />
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
        Files contain personal data. Store them securely, share them only with people who need them, and delete them when you no longer need them.
      </p>
    </>
  );
}

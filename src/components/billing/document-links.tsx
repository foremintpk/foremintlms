import { Download, ExternalLink, FileText } from "lucide-react";
import type { BillingDocumentRow } from "@/lib/services/payments/types";

function label(doc: Pick<BillingDocumentRow, "issuer" | "document_type">) {
  if (doc.issuer === "whop") return "Whop receipt";
  if (doc.document_type === "credit_note") return "Credit note";
  return "Receipt";
}

/** Links to every document for a payment. Foremint PDFs open inline; Whop's open from Whop. */
export function DocumentLinks({ documents }: { documents: Pick<BillingDocumentRow, "id" | "issuer" | "document_type" | "number">[] }) {
  if (!documents.length) return <span className="text-xs text-muted-foreground">—</span>;
  const ordered = [...documents].sort((a, b) => (a.issuer === b.issuer ? a.document_type.localeCompare(b.document_type) : a.issuer === "foremint" ? -1 : 1));
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {ordered.map((doc) => (
        <a
          key={doc.id}
          href={`/api/billing/documents/${doc.id}/pdf`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          title={doc.issuer === "foremint" ? `${label(doc)} ${doc.number}` : label(doc)}
        >
          {doc.issuer === "whop" ? <ExternalLink className="size-3.5" aria-hidden /> : <FileText className="size-3.5" aria-hidden />}
          {label(doc)}
        </a>
      ))}
    </div>
  );
}

export function DownloadDocumentLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a href={`/api/billing/documents/${id}/pdf?download=1`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      <Download className="size-3.5" aria-hidden />
      {children}
    </a>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Copy, ExternalLink, FileDown, FileText, Mail, MoreHorizontal, PencilLine, RefreshCw, RotateCw, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import { CopyButton } from "./copy-button";
import {
  approveReviewAction,
  cancelSubscriptionAction,
  generateInvoiceAction,
  refreshInvoiceAction,
  regenerateSummaryAction,
  resendActivationAction,
  sendInvoiceEmailAction,
  voidInvoiceAction,
} from "@/app/admin/billing/actions";

export function PaymentLinkCard({ invoiceId, url, deliveryChannel, method }: { invoiceId: string; url: string; deliveryChannel: "foremint" | "whop"; method: "payment_link" | "whop_invoice" }) {
  const router = useRouter();
  const send = useAction(sendInvoiceEmailAction, { onSuccess: () => router.refresh() });
  return (
    <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-brand-soft via-card to-card p-5 shadow-card" aria-labelledby="payment-link-title">
      <h2 id="payment-link-title" className="text-sm font-semibold">
        Payment link
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {method === "payment_link"
          ? "Send this link to your client: they pay on Whop's secure checkout straight away, no sign-in needed first. It can be paid once and stops working after payment or if you void the invoice."
          : "The checkout for this Whop invoice. Only the invoiced customer can pay it (they sign in to Whop with the invoiced email), and it stops working once paid or voided."}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Payment URL" data-testid="payment-url" />
        <div className="flex shrink-0 gap-2">
          <CopyButton value={url} label="Copy payment link" variant="default" />
          <Button asChild variant="outline" size="sm">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Open
            </a>
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void send.run({ id: invoiceId })} disabled={send.pending}>
          <Mail aria-hidden />
          {deliveryChannel === "whop" && method === "whop_invoice" ? "Send via Whop" : "Email the link to the client"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {deliveryChannel === "whop" && method === "whop_invoice" ? "Whop emails the invoice and its reminders." : "A branded Foremint email with this exact link."}
        </span>
      </div>
    </section>
  );
}

export function GenerateButton({ invoiceId, label = "Retry generation" }: { invoiceId: string; label?: string }) {
  const router = useRouter();
  const { run, pending } = useAction(generateInvoiceAction, { onSuccess: () => router.refresh() });
  return (
    <Button size="sm" onClick={() => void run({ id: invoiceId })} disabled={pending} data-testid="retry-generation">
      <Sparkles aria-hidden />
      {label}
    </Button>
  );
}

export function ApproveReviewButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button size="sm">
          <ShieldCheck aria-hidden />
          Approve and provision access
        </Button>
      }
      title="Approve this payment?"
      description="Access is granted as if the payment had matched. Whop must still report the payment as paid. Your reason is recorded in the audit log."
      confirmLabel="Approve and provision"
      requireReason
      action={(i) => approveReviewAction({ id: invoiceId, reason: i.reason })}
      onDone={() => router.refresh()}
    />
  );
}

export function InvoiceActionsMenu({
  invoiceId,
  canVoid,
  isDraft,
  canRefresh,
  whopPdfLabel,
  canCancelSubscription,
}: {
  invoiceId: string;
  canVoid: boolean;
  isDraft: boolean;
  canRefresh: boolean;
  whopPdfLabel: string | null;
  canCancelSubscription: boolean;
}) {
  const router = useRouter();
  const refresh = useAction(refreshInvoiceAction, { onSuccess: () => router.refresh() });
  const summary = useAction(regenerateSummaryAction, { onSuccess: () => router.refresh() });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRefresh ? (
        <Button size="sm" variant="outline" onClick={() => void refresh.run({ id: invoiceId })} disabled={refresh.pending} data-testid="refresh-status">
          <RefreshCw aria-hidden />
          Refresh payment status
        </Button>
      ) : null}
      <Button asChild size="sm" variant="outline">
        <a href={`/api/billing/custom-invoices/${invoiceId}/summary?download=1`}>
          <FileDown aria-hidden />
          Service summary
        </a>
      </Button>
      {isDraft ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/billing/invoices/new?draft=${invoiceId}`}>
            <PencilLine aria-hidden />
            Edit draft
          </Link>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="outline" aria-label="More invoice actions">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild>
            <a href={`/api/billing/custom-invoices/${invoiceId}/summary`} target="_blank" rel="noopener">
              <FileText aria-hidden />
              Preview service summary
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void summary.run({ id: invoiceId })}>
            <RotateCw aria-hidden />
            Regenerate service summary
          </DropdownMenuItem>
          {whopPdfLabel ? (
            <DropdownMenuItem asChild>
              <a href={`/api/billing/custom-invoices/${invoiceId}/whop-pdf`} target="_blank" rel="noopener">
                <ExternalLink aria-hidden />
                {whopPdfLabel}
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/admin/billing/invoices/new?from=${invoiceId}`}>
              <Copy aria-hidden />
              Duplicate invoice
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/billing/invoices/new?from=${invoiceId}&revise=1`}>
              <PencilLine aria-hidden />
              Create revised invoice
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canCancelSubscription ? (
        <ConfirmAction
          trigger={
            <Button size="sm" variant="outline">
              <Ban aria-hidden />
              Cancel subscription
            </Button>
          }
          title="Cancel at the end of the paid period?"
          description="Whop stops renewing. The customer keeps access until the current period ends."
          confirmLabel="Cancel at period end"
          requireReason
          action={(i) => cancelSubscriptionAction({ id: invoiceId, atPeriodEnd: true, reason: i.reason ?? "" })}
          onDone={() => router.refresh()}
        />
      ) : null}
      {canVoid ? (
        <ConfirmAction
          trigger={
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" data-testid="void-invoice">
              <XCircle aria-hidden />
              Void invoice
            </Button>
          }
          title="Void this invoice?"
          description="Its Whop payment link stops working (a native Whop invoice is voided on Whop). If the customer was emailed, they're told it was cancelled. This can't be undone; duplicate it to bill again."
          confirmLabel="Void invoice"
          destructive
          requireReason
          action={(i) => voidInvoiceAction({ id: invoiceId, reason: i.reason })}
          onDone={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

export function ResendInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { run, pending } = useAction(resendActivationAction, { onSuccess: () => router.refresh() });
  return (
    <Button size="xs" variant="outline" onClick={() => void run({ invitationId })} disabled={pending}>
      <Mail aria-hidden />
      Resend
    </Button>
  );
}

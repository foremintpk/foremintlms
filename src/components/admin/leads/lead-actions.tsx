"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmAction } from "@/components/common/confirm-action";
import { LocalTime } from "@/components/common/local-time";
import { useAction } from "@/hooks/use-action";
import { setLeadStatus, unsubscribeNewsletter } from "@/app/admin/leads/actions";

export interface LeadRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string | null;
  source: string;
  status: "new" | "contacted" | "closed" | "spam";
  created_at: string;
  course_title: string | null;
}

export function LeadActions({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const update = useAction(setLeadStatus, { onSuccess: () => router.refresh() });
  return (
    <div className="flex items-center justify-end gap-1">
      <Dialog>
        <DialogTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`Read message from ${lead.full_name}`}>
            <MessageSquareText />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{lead.subject || "Enquiry"}</DialogTitle>
            <DialogDescription>
              From {lead.full_name} · <LocalTime value={lead.created_at} />
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>
              <a className="text-primary hover:underline" href={`mailto:${lead.email}`}>
                {lead.email}
              </a>
            </dd>
            {lead.phone ? (
              <>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{lead.phone}</dd>
              </>
            ) : null}
            {lead.course_title ? (
              <>
                <dt className="text-muted-foreground">Course</dt>
                <dd>{lead.course_title}</dd>
              </>
            ) : null}
          </dl>
          <p className="max-h-80 overflow-y-auto rounded-xl bg-muted p-4 text-sm whitespace-pre-wrap">{lead.message || "No message."}</p>
          <DialogFooter>
            <Button asChild>
              <a href={`mailto:${lead.email}?subject=${encodeURIComponent(`Re: ${lead.subject ?? "your enquiry"}`)}`}>Reply by email</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as LeadRow["status"]);
          void update.run({ ids: [lead.id], status: v as LeadRow["status"] });
        }}
        disabled={update.pending}
      >
        <SelectTrigger size="sm" className="w-28" aria-label="Lead status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="new">New</SelectItem>
          <SelectItem value="contacted">Contacted</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
          <SelectItem value="spam">Spam</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function LeadsBulkBar({ ids }: { ids: string[] }) {
  const router = useRouter();
  const { run, pending } = useAction(setLeadStatus, { onSuccess: () => router.refresh() });
  if (ids.length === 0) return null;
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-2 text-sm">
      <span>
        {ids.length} new enquir{ids.length === 1 ? "y" : "ies"} on this page
      </span>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => void run({ ids, status: "contacted" })}>
        Mark all as contacted
      </Button>
    </div>
  );
}

export function UnsubscribeButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button size="sm" variant="ghost">
          Unsubscribe
        </Button>
      }
      title={`Unsubscribe ${email}?`}
      description="They will stop receiving newsletter emails. They can subscribe again from the website."
      confirmLabel="Unsubscribe"
      action={() => unsubscribeNewsletter({ id })}
      onDone={() => router.refresh()}
    />
  );
}

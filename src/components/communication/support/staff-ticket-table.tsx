"use client";

import Link from "next/link";
import { useState } from "react";
import { useTrackedTransition } from "@/hooks/use-tracked-transition";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalTime } from "@/components/common/local-time";
import { CATEGORY_LABEL, statusLabel, TICKET_STATUSES, type TicketCategory, type TicketPriority, type TicketStatus } from "../lib/tickets";
import { PersonAvatar, type PersonCard } from "../person";
import { bulkTicketStatusAction } from "./actions";
import { PriorityBadge, TicketStatusBadge } from "./ticket-badges";

export interface StaffTicketRow {
  id: string;
  number: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  courseTitle: string | null;
  requester: PersonCard;
  assignee: PersonCard | null;
  lastActivityAt: string;
  createdAt: string;
}

/** Helpdesk table. Admins get row selection and bulk status changes. */
export function StaffTicketTable({ rows, basePath, bulk }: { rows: StaffTicketRow[]; basePath: string; bulk: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TicketStatus>("resolved");
  const [pending, startTransition] = useTrackedTransition();
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const applyBulk = () =>
    startTransition(async () => {
      const res = await bulkTicketStatusAction({ ticketIds: [...selected], status: bulkStatus });
      if (res.ok) {
        toast.success(res.message ?? "Updated");
        setSelected(new Set());
      } else toast.error(res.error);
    });

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      {bulk && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-brand-soft/60 px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <span className="text-muted-foreground">Set status to</span>
          <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as TicketStatus)}>
            <SelectTrigger className="h-8 w-44" aria-label="New status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s, "staff")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={applyBulk} disabled={pending}>
            {pending ? "Updating…" : "Apply"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {/* Phones: stacked cards */}
      <ul className="divide-y md:hidden">
        {rows.map((t) => (
          <li key={t.id} className="flex gap-3 p-4">
            {bulk ? <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.number}`} className="mt-1" /> : null}
            <Link href={`${basePath}/${t.id}`} className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{t.number}</span> · {t.requester.name}
              </p>
              <p className="mt-0.5 font-medium">{t.subject}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <TicketStatusBadge status={t.status} viewer="staff" />
                <PriorityBadge priority={t.priority} />
                <span className="text-xs text-muted-foreground">
                  <LocalTime value={t.lastActivityAt} format="relative" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablets and up: table */}
      <Table className="max-md:hidden">
        <TableHeader>
          <TableRow>
            {bulk ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())}
                  aria-label="Select all tickets on this page"
                />
              </TableHead>
            ) : null}
            <TableHead>Ticket</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead className="text-right">Last activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
              {bulk ? (
                <TableCell>
                  <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.number}`} />
                </TableCell>
              ) : null}
              <TableCell className="max-w-80">
                <Link href={`${basePath}/${t.id}`} className="block">
                  <span className="block truncate font-medium hover:underline">{t.subject}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{t.number}</span> · {CATEGORY_LABEL[t.category]}
                    {t.courseTitle ? ` · ${t.courseTitle}` : ""}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <PersonAvatar person={t.requester} className="size-7" />
                  <span className="truncate text-sm">{t.requester.name}</span>
                </span>
              </TableCell>
              <TableCell>
                <TicketStatusBadge status={t.status} viewer="staff" />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={t.priority} />
              </TableCell>
              <TableCell className="text-sm">{t.assignee ? t.assignee.name : <span className="text-muted-foreground">Unassigned</span>}</TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                <LocalTime value={t.lastActivityAt} format="relative" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

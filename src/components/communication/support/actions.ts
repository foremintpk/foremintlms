"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertUser } from "@/lib/auth/guards";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import {
  assignTicket,
  bulkSetStatus,
  createTicket,
  replyToTicket,
  requesterSetStatus,
  setTicketPriority,
  setTicketStatus,
} from "@/lib/services/support";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "../lib/tickets";

const status = z.enum(TICKET_STATUSES);

export async function createTicketAction(input: {
  subject: string;
  description: string;
  category: string;
  priority: string;
  courseId?: string | null;
  attachmentIds?: string[];
}): Promise<ActionResult<{ id: string; number: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        subject: z.string().trim().min(3, "Add a short subject").max(200),
        description: z.string().trim().min(10, "Describe the problem in a sentence or two").max(20_000),
        category: z.enum(TICKET_CATEGORIES),
        priority: z.enum(["low", "normal", "high"]),
        courseId: z.uuid().nullable().optional(),
        attachmentIds: z.array(z.uuid()).max(5).default([]),
      })
      .parse(input);
    const ticket = await createTicket(user, data);
    return ok(ticket, `Ticket ${ticket.number} created`);
  });
}

export async function replyTicketAction(input: {
  ticketId: string;
  body: string;
  isInternal?: boolean;
  attachmentIds?: string[];
  setStatus?: string | null;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        ticketId: z.uuid(),
        body: z.string().trim().min(1, "Write a reply").max(20_000),
        isInternal: z.boolean().default(false),
        attachmentIds: z.array(z.uuid()).max(5).default([]),
        setStatus: status.nullable().optional(),
      })
      .parse(input);
    await replyToTicket(user, data);
    refresh();
    return ok(null, data.isInternal ? "Internal note added" : "Reply sent");
  });
}

export async function setTicketStatusAction(input: { ticketId: string; status: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ ticketId: z.uuid(), status }).parse(input);
    await setTicketStatus(user, data.ticketId, data.status);
    refresh();
    return ok(null, "Status updated");
  });
}

export async function setTicketPriorityAction(input: { ticketId: string; priority: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ ticketId: z.uuid(), priority: z.enum(TICKET_PRIORITIES) }).parse(input);
    await setTicketPriority(user, data.ticketId, data.priority);
    refresh();
    return ok(null, "Priority updated");
  });
}

export async function requesterTicketAction(input: { ticketId: string; action: "close" | "reopen" }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ ticketId: z.uuid(), action: z.enum(["close", "reopen"]) }).parse(input);
    await requesterSetStatus(user, data.ticketId, data.action);
    refresh();
    return ok(null, data.action === "close" ? "Ticket closed" : "Ticket reopened");
  });
}

export async function assignTicketAction(input: { ticketId: string; assigneeId: string | null }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ ticketId: z.uuid(), assigneeId: z.uuid().nullable() }).parse(input);
    await assignTicket(user, data.ticketId, data.assigneeId);
    refresh();
    return ok(null, data.assigneeId ? "Ticket assigned" : "Ticket unassigned");
  });
}

export async function bulkTicketStatusAction(input: { ticketIds: string[]; status: string }): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ ticketIds: z.array(z.uuid()).min(1).max(100), status }).parse(input);
    const updated = await bulkSetStatus(user, data.ticketIds, data.status);
    refresh();
    return ok({ updated }, `${updated} ticket${updated === 1 ? "" : "s"} updated`);
  });
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Inbox, LifeBuoy, Paperclip, Plus, Timer } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatCard } from "@/components/common/stat-card";
import { requireRole, requireUser } from "@/lib/auth/guards";
import { formatBytes } from "@/lib/format";
import { parseListParams } from "@/lib/list-params";
import { cn } from "@/lib/utils";
import {
  getTicket,
  getTicketMetrics,
  listAssignableStaff,
  listMyTickets,
  listStaffTickets,
  myTicketCourses,
  SUPPORT_BASE,
  teacherCourseIds,
  type TicketAttachment,
} from "@/lib/services/support";
import type { CommsArea } from "@/lib/services/messaging";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CATEGORY_LABEL,
  formatHours,
  statusLabel,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
} from "../lib/tickets";
import { PersonAvatar, RoleBadge } from "../person";
import { PlainText } from "../plain-text";
import { NewTicketForm } from "./new-ticket-form";
import { RequesterTicketControls, StaffTicketControls, TicketReplyForm } from "./ticket-controls";
import { MyTicketList } from "./ticket-list";
import { StaffTicketTable } from "./staff-ticket-table";
import { PriorityBadge, TicketStatusBadge } from "./ticket-badges";

type SearchParams = Record<string, string | string[] | undefined>;

// ---------------------------------------------------------------------------
// Student: my tickets / new ticket
// ---------------------------------------------------------------------------

export async function MyTicketsScreen({ searchParams }: { searchParams: SearchParams }) {
  const base = SUPPORT_BASE.learn;
  const user = await requireUser(base);
  const lp = parseListParams(searchParams, { pageSize: 20, filterKeys: ["status"] });
  const { items, total } = await listMyTickets(user, { status: lp.filters.status, from: lp.from, to: lp.to });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Support"
        description="Get help with your account, billing, courses or certificates. We reply by email and here."
        actions={
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus className="size-4" /> New ticket
            </Link>
          </Button>
        }
      />
      <ListToolbar
        filters={[
          {
            key: "status",
            label: "Tickets",
            options: [
              { value: "active", label: "Open tickets" },
              { value: "closed", label: "Resolved and closed" },
            ],
          },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={lp.filters.status ? "No tickets here" : "No support tickets yet"}
          description="If something isn't working or you have a question about billing or a course, open a ticket and our team will help."
          action={
            <Button asChild>
              <Link href={`${base}/new`}>Open a ticket</Link>
            </Button>
          }
        />
      ) : (
        <MyTicketList items={items} basePath={base} />
      )}
      <PaginationBar basePath={base} searchParams={searchParams} page={lp.page} pageSize={lp.pageSize} total={total} />
    </div>
  );
}

export async function NewTicketScreen({ searchParams }: { searchParams: SearchParams }) {
  const base = SUPPORT_BASE.learn;
  const user = await requireUser(`${base}/new`);
  const courses = await myTicketCourses(user);
  const rawCategory = Array.isArray(searchParams.category) ? searchParams.category[0] : searchParams.category;
  const rawCourse = Array.isArray(searchParams.course) ? searchParams.course[0] : searchParams.course;
  const category = (TICKET_CATEGORIES as readonly string[]).includes(rawCategory ?? "") ? (rawCategory as TicketCategory) : "general";
  const course = courses.find((c) => c.id === rawCourse)?.id ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Open a support ticket"
        description="Tell us what's going on. You'll get an email confirmation with your ticket number."
        back={{ href: base, label: "Support" }}
      />
      <NewTicketForm courses={courses} basePath={base} defaultCategory={category} defaultCourseId={course} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff: helpdesk
// ---------------------------------------------------------------------------

async function TicketMetricsPanel() {
  const m = await getTicketMetrics(90);
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Open tickets" value={m.openCount} icon={Inbox} tone="brand" hint={`${m.byStatus.open} new · ${m.byStatus.in_progress} in progress`} />
      <StatCard
        label="High & urgent open"
        value={m.openByPriority.high + m.openByPriority.urgent}
        icon={LifeBuoy}
        tone={m.openByPriority.urgent > 0 ? "warning" : "default"}
        hint={`${m.openByPriority.urgent} urgent`}
      />
      <StatCard label="Avg. first response" value={formatHours(m.avgFirstResponseHours)} icon={Timer} hint={`${m.respondedCount} answered tickets, last 90 days`} />
      <StatCard label="Avg. time to resolve" value={formatHours(m.avgResolutionHours)} icon={Clock} tone="success" hint={`${m.resolvedCount} resolved, last 90 days`} />
    </div>
  );
}

export async function StaffTicketsScreen({ area, searchParams }: { area: "teach" | "admin"; searchParams: SearchParams }) {
  const base = SUPPORT_BASE[area];
  const user = await requireRole(area === "admin" ? "admin" : "teacher", base);
  const lp = parseListParams(searchParams, {
    pageSize: 25,
    sortable: ["last_activity_at", "created_at", "priority"],
    defaultSort: "last_activity_at",
    filterKeys: ["status", "priority", "category", "assignee", "course"],
  });
  const status = lp.filters.status ?? "active";
  const [{ items, total }, staff, courseOptions] = await Promise.all([
    listStaffTickets(user, area, {
      status,
      priority: lp.filters.priority,
      category: lp.filters.category,
      assignee: lp.filters.assignee,
      course: lp.filters.course,
      q: lp.q,
      sort: lp.sort,
      dir: lp.dir,
      from: lp.from,
      to: lp.to,
    }),
    area === "admin" ? listAssignableStaff() : Promise.resolve([]),
    (async () => {
      const admin = createAdminClient();
      if (area === "admin") {
        const { data } = await admin.from("courses").select("id, title").order("title");
        return (data ?? []) as { id: string; title: string }[];
      }
      const ids = await teacherCourseIds(user.id);
      if (!ids.length) return [];
      const { data } = await admin.from("courses").select("id, title").in("id", ids).order("title");
      return (data ?? []) as { id: string; title: string }[];
    })(),
  ]);

  const statusOptions = [{ value: "active", label: "Active (not resolved)" }, ...TICKET_STATUSES.map((s) => ({ value: s, label: statusLabel(s, "staff") }))];

  return (
    <>
      <PageHeader
        title={area === "admin" ? "Support tickets" : "Support"}
        description={
          area === "admin"
            ? "Every support request, with assignment, priorities and response times."
            : "Tickets assigned to you and course or certificate questions for your courses."
        }
        actions={
          area === "teach" ? (
            <Button asChild variant="outline">
              <Link href="/learn/support">My own requests</Link>
            </Button>
          ) : null
        }
      />
      {area === "admin" ? <TicketMetricsPanel /> : null}
      <ListToolbar
        searchPlaceholder="Search subject or ticket number"
        filters={[
          { key: "status", label: "Statuses", options: statusOptions },
          { key: "priority", label: "Priorities", options: TICKET_PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })) },
          { key: "category", label: "Topics", options: TICKET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })) },
          {
            key: "assignee",
            label: "Assignees",
            options: [
              { value: "me", label: "Assigned to me" },
              { value: "unassigned", label: "Unassigned" },
              ...staff.map((s) => ({ value: s.id, label: s.name })),
            ],
          },
          ...(courseOptions.length ? [{ key: "course", label: "Courses", options: courseOptions.map((c) => ({ value: c.id, label: c.title })) }] : []),
          {
            key: "sort",
            label: "Order",
            options: [
              { value: "created_at", label: "Newest tickets" },
              { value: "priority", label: "Priority" },
            ],
          },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No tickets match"
          description={status === "active" && !lp.q ? "Nothing is waiting on you right now." : "Try a different filter or search."}
        />
      ) : (
        <StaffTicketTable rows={items} basePath={base} bulk={area === "admin"} />
      )}
      <PaginationBar basePath={base} searchParams={searchParams} page={lp.page} pageSize={lp.pageSize} total={total} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Ticket detail (all areas)
// ---------------------------------------------------------------------------

function AttachmentList({ files }: { files: TicketAttachment[] }) {
  if (!files.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.id}>
          <a
            href={`/api/files/${f.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
          >
            <Paperclip className="size-3.5" />
            <span className="max-w-56 truncate font-medium">{f.fileName}</span>
            <span className="text-muted-foreground">{formatBytes(f.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export async function TicketDetailScreen({ area, id }: { area: CommsArea; id: string }) {
  const base = SUPPORT_BASE[area];
  const user = await requireUser(`${base}/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getTicket(user, id);
  if (!detail) notFound();
  const { ticket } = detail;
  const viewer = detail.isStaff && area !== "learn" ? "staff" : "requester";
  const showStaffTools = detail.isStaff && area !== "learn";
  const staffOptions = showStaffTools && detail.isAdmin ? await listAssignableStaff() : [];
  const closed = ticket.status === "closed";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="min-w-0">
        <PageHeader
          title={ticket.subject}
          description={
            <span className="font-mono text-xs">
              {ticket.ticket_number} · opened <LocalTime value={ticket.created_at} format="datetime" />
            </span>
          }
          back={{ href: base, label: area === "learn" ? "Support" : "Tickets" }}
          actions={
            detail.isRequester && area === "learn" ? (
              <RequesterTicketControls ticketId={ticket.id} status={ticket.status} canReopen={detail.canReopen} />
            ) : null
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} viewer={viewer} />
            {viewer === "staff" ? <PriorityBadge priority={ticket.priority} /> : null}
            <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[ticket.category]}</span>
            {detail.courseTitle ? <span className="text-xs text-muted-foreground">· {detail.courseTitle}</span> : null}
          </div>
        </PageHeader>

        <ol className="space-y-4">
          <li className="rounded-2xl border bg-card p-4 shadow-card sm:p-5">
            <MessageHeader name={detail.requester.name} avatar={detail.requester} role={detail.requester.role} at={ticket.created_at} label="opened this ticket" />
            <PlainText text={ticket.description} className="mt-3" />
            <AttachmentList files={detail.openingAttachments} />
          </li>
          {detail.messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "rounded-2xl border p-4 sm:p-5",
                m.isInternal ? "border-warning/40 bg-warning-soft/40" : m.authorIsRequester ? "bg-card" : "border-primary/20 bg-brand-soft/40",
              )}
            >
              <MessageHeader
                name={m.author.name}
                avatar={m.author}
                role={m.author.role}
                at={m.createdAt}
                label={m.isInternal ? "added an internal note" : m.authorIsRequester ? "replied" : "replied from support"}
              />
              <PlainText text={m.body} className="mt-3" />
              <AttachmentList files={m.attachments} />
            </li>
          ))}
        </ol>

        <div className="mt-6">
          {closed && !detail.isStaff ? (
            <p className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
              This ticket is closed.{" "}
              {detail.canReopen ? "Reopen it to add a reply." : (
                <>
                  Need more help?{" "}
                  <Link href={`${SUPPORT_BASE.learn}/new`} className="font-medium text-primary hover:underline">
                    Open a new ticket
                  </Link>{" "}
                  and mention {ticket.ticket_number}.
                </>
              )}
            </p>
          ) : (
            <TicketReplyForm ticketId={ticket.id} isStaff={showStaffTools} currentStatus={ticket.status} />
          )}
        </div>
      </div>

      <aside className="space-y-4 lg:pt-16">
        {showStaffTools ? (
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Ticket settings</h2>
            <StaffTicketControls
              ticketId={ticket.id}
              status={ticket.status}
              priority={ticket.priority}
              assigneeId={ticket.assigned_to}
              meId={user.id}
              isAdmin={detail.isAdmin}
              staff={staffOptions}
            />
          </div>
        ) : null}
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="mb-3 font-semibold">Details</h2>
          <dl className="grid gap-2.5">
            <div>
              <dt className="text-xs text-muted-foreground">Requester</dt>
              <dd className="flex items-center gap-2">
                <PersonAvatar person={detail.requester} className="size-6" />
                {detail.requester.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Assigned to</dt>
              <dd>{detail.assignee ? detail.assignee.name : "Not assigned yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last activity</dt>
              <dd>
                <LocalTime value={ticket.last_activity_at} format="datetime" />
              </dd>
            </div>
            {ticket.resolved_at ? (
              <div>
                <dt className="text-xs text-muted-foreground">Resolved</dt>
                <dd>
                  <LocalTime value={ticket.resolved_at} format="datetime" />
                </dd>
              </div>
            ) : null}
          </dl>
          {showStaffTools ? (
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href={`/${area === "admin" ? "admin" : "teach"}/messages?to=${ticket.requester_id}`}>Message the student</Link>
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function MessageHeader({
  name,
  avatar,
  role,
  at,
  label,
}: {
  name: string;
  avatar: { name: string; avatarUrl: string | null };
  role: "admin" | "teacher" | "student";
  at: string;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <PersonAvatar person={avatar} className="size-8" />
      <span className="font-semibold">{name}</span>
      <RoleBadge role={role} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground">
        <LocalTime value={at} format="datetime" />
      </span>
    </div>
  );
}

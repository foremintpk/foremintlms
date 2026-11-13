import Link from "next/link";
import { CalendarPlus, Radio, Video } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import { buildQueryString, parseListParams } from "@/lib/list-params";
import { listSessions, type SessionTab } from "@/lib/services/live/queries";
import { getMeetingAvailability } from "@/lib/services/live/availability";
import { sessionPhase, utcToZonedParts } from "@/lib/services/live/time";
import { PROVIDER_LABEL } from "@/lib/services/live/types";
import { cn } from "@/lib/utils";
import { SessionFormDialog } from "./session-form-dialog";

const TABS: { key: SessionTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "canceled", label: "Cancelled" },
];

/** Request-time clock: default date for new classes (tomorrow, host zone) and "now" for phases. */
function scheduleClock(zone: string) {
  const now = new Date();
  return { now, defaults: utcToZonedParts(new Date(now.getTime() + 86_400_000), zone) };
}

export async function LiveSessionsPage({
  user,
  area,
  searchParams,
}: {
  user: SessionUser;
  area: "teach" | "admin";
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const basePath = area === "admin" ? "/admin/live" : "/teach/live";
  const settingsHref = area === "admin" ? "/admin/live/accounts" : "/teach/settings?section=meetings";
  const params = parseListParams(searchParams, { pageSize: 20, filterKeys: ["course", "provider", "tab"] });
  const tab = (["upcoming", "past", "canceled"].includes(params.filters.tab ?? "") ? params.filters.tab : "upcoming") as SessionTab;

  const [{ rows, total, courses }, availability] = await Promise.all([
    listSessions(user, area, {
      tab,
      courseId: params.filters.course,
      provider: params.filters.provider,
      q: params.q,
      from: params.from,
      to: params.to,
    }),
    getMeetingAvailability(user.id),
  ]);

  const zone = user.timezone || "UTC";
  const { defaults, now } = scheduleClock(zone);

  const scheduleButton =
    courses.length > 0 ? (
      <SessionFormDialog
        mode="create"
        basePath={basePath}
        courses={courses}
        availability={availability}
        settingsHref={settingsHref}
        initial={{
          courseId: params.filters.course ?? (courses.length === 1 ? courses[0].id : ""),
          title: "",
          description: "",
          provider: availability.zoom === "connected" ? "zoom" : availability.google_meet === "connected" ? "google_meet" : "external",
          externalUrl: "",
          date: defaults.date,
          time: "18:00",
          timezone: zone,
          durationMinutes: 60,
          announcement: "",
        }}
        trigger={
          <Button>
            <CalendarPlus /> Schedule class
          </Button>
        }
      />
    ) : null;

  return (
    <>
      <PageHeader
        title="Live classes"
        description={
          area === "admin"
            ? "Every scheduled workshop and live class across the academy."
            : "Schedule workshops for your courses, share resources and track who attended."
        }
        actions={scheduleButton}
      />

      <nav aria-label="Session status" className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${basePath}${buildQueryString(searchParams, { tab: t.key === "upcoming" ? null : t.key, page: null })}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <ListToolbar
        searchPlaceholder="Search classes"
        filters={[
          { key: "course", label: "Courses", options: courses.map((c) => ({ value: c.id, label: c.title })) },
          {
            key: "provider",
            label: "Platforms",
            options: [
              { value: "zoom", label: "Zoom" },
              { value: "google_meet", label: "Google Meet" },
              { value: "external", label: "External link" },
            ],
          },
        ]}
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No courses to schedule for yet"
          description="Live classes belong to a course. Once you're assigned to a course you can schedule classes for its students."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Video}
          title={tab === "upcoming" ? "No upcoming classes" : tab === "past" ? "No past classes yet" : "No cancelled classes"}
          description={tab === "upcoming" ? "Schedule a workshop or Q&A and your students will be invited automatically." : undefined}
          action={tab === "upcoming" ? scheduleButton : undefined}
        />
      ) : (
        <ul className="grid gap-3">
          {rows.map((s) => {
            const phase = s.status === "scheduled" || s.status === "live" ? sessionPhase(s.starts_at, s.duration_minutes, now) : null;
            return (
              <li key={s.id}>
                <Link
                  href={`${basePath}/${s.id}`}
                  className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:gap-5"
                >
                  <div className="flex w-full items-center gap-3 sm:w-48 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0.5">
                    <LocalTime value={s.starts_at} format="weekday" className="text-sm font-semibold" />
                    <span className="text-xs text-muted-foreground">{s.duration_minutes} min</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium group-hover:text-primary">{s.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {s.course_title}
                      {area === "admin" && s.host_name ? ` · hosted by ${s.host_name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={s.provider} label={PROVIDER_LABEL[s.provider]} tone="neutral" />
                    {s.status === "canceled" ? (
                      <StatusBadge status="canceled" label="Cancelled" />
                    ) : phase === "live" ? (
                      <StatusBadge status="live" label="Live now" />
                    ) : phase === "joinable" ? (
                      <StatusBadge status="scheduled" label="Starting soon" tone="warning" />
                    ) : s.status === "completed" ? (
                      <StatusBadge status="completed" label="Ended" tone="neutral" />
                    ) : (
                      <StatusBadge status="scheduled" />
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {s.invited} invited{s.recordings ? ` · ${s.recordings} recording${s.recordings === 1 ? "" : "s"}` : ""}
                    </span>
                    {s.provider_sync_error ? <StatusBadge status="error" label="Needs attention" /> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <PaginationBar basePath={basePath} searchParams={searchParams} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}

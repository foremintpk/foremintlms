import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarClock, Clock, ExternalLink, KeyRound, Users, Video } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SessionUser } from "@/lib/auth/session";
import { getCourseRole } from "@/lib/auth/guards";
import { getMeetingAvailability } from "@/lib/services/live/availability";
import { getSessionDetail } from "@/lib/services/live/queries";
import { scopedCourses } from "@/lib/services/live/queries";
import { formatInZone, sessionPhase, utcToZonedParts } from "@/lib/services/live/time";
import { PROVIDER_LABEL } from "@/lib/services/live/types";
import {
  AddRecordingForm,
  AddResourceForm,
  AnnouncementForm,
  AttendanceToggle,
  CancelSessionButton,
  InviteStudentsButton,
  RecordingControls,
  ResourceRow,
  SyncArtifactsButton,
} from "./session-panels";
import { SessionFormDialog } from "./session-form-dialog";

function formatSeconds(s: number | null): string {
  if (!s) return "—";
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export async function LiveSessionDetail({ user, area, sessionId }: { user: SessionUser; area: "teach" | "admin"; sessionId: string }) {
  const basePath = area === "admin" ? "/admin/live" : "/teach/live";
  const detail = await getSessionDetail(sessionId);
  if (!detail) notFound();
  const role = await getCourseRole(user, detail.session.course_id);
  // Instructors only manage classes of courses they're assigned to.
  if (!(role.isAdmin || role.isInstructor) || (area === "admin" && !role.isAdmin)) notFound();

  const { session, course, attendees, attendance, recordings, resources } = detail;
  const [availability, courses] = await Promise.all([getMeetingAvailability(user.id), scopedCourses(user, area)]);
  const phase = sessionPhase(session.starts_at, session.duration_minutes);
  const editable = session.status !== "canceled";
  const parts = utcToZonedParts(session.starts_at, session.timezone);

  const presence = new Map<string, { source: string; duration: number | null }>();
  for (const row of attendance) {
    if (!row.user_id) continue;
    const prev = presence.get(row.user_id);
    const duration = (prev?.duration ?? 0) + (row.duration_seconds ?? 0);
    // Manual/join-click marks are what staff can toggle; provider rows add duration.
    const source = prev?.source === "manual" || prev?.source === "join_click" ? prev.source : row.source;
    presence.set(row.user_id, { source, duration: duration || null });
  }
  const invitedIds = new Set(attendees.map((a) => a.user_id));
  const otherParticipants = attendance.filter((a) => a.source === "provider" && (!a.user_id || !invitedIds.has(a.user_id)));
  const attendedCount = attendees.filter((a) => presence.has(a.user_id)).length;

  return (
    <>
      <PageHeader
        back={{ href: basePath, label: "Live classes" }}
        title={session.title}
        description={
          <>
            <Link href={area === "admin" ? `/admin/courses/${course.id}` : `/teach/courses/${course.id}`} className="font-medium text-foreground hover:text-primary">
              {course.title}
            </Link>
            {detail.hostName ? ` · hosted by ${detail.hostName}` : ""}
          </>
        }
        actions={
          editable ? (
            <>
              <SessionFormDialog
                mode="edit"
                basePath={basePath}
                courses={courses.some((c) => c.id === course.id) ? courses : [...courses, { id: course.id, title: course.title }]}
                availability={availability}
                settingsHref={area === "admin" ? "/admin/live/accounts" : "/teach/settings?section=meetings"}
                initial={{
                  sessionId: session.id,
                  courseId: session.course_id,
                  title: session.title,
                  description: session.description ?? "",
                  provider: session.provider,
                  externalUrl: session.provider === "external" ? session.join_url ?? "" : "",
                  date: parts.date,
                  time: parts.time,
                  timezone: session.timezone,
                  durationMinutes: session.duration_minutes,
                  announcement: session.announcement ?? "",
                }}
                trigger={<Button variant="outline">Edit class</Button>}
              />
              {phase !== "ended" ? <CancelSessionButton sessionId={session.id} title={session.title} /> : null}
            </>
          ) : null
        }
      />

      {session.status === "canceled" ? (
        <Alert className="mb-6">
          <AlertTriangle />
          <AlertTitle>This class was cancelled</AlertTitle>
          <AlertDescription>{session.canceled_reason || "No reason was given."}</AlertDescription>
        </Alert>
      ) : null}
      {session.provider_sync_error ? (
        <Alert className="mb-6 border-warning/30 bg-warning-soft text-warning">
          <AlertTriangle />
          <AlertTitle>Meeting provider needs attention</AlertTitle>
          <AlertDescription className="text-warning/90">{session.provider_sync_error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <CalendarClock className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Starts (your time)</dt>
                <dd className="text-sm font-medium">
                  <LocalTime value={session.starts_at} format="weekday" />
                </dd>
                <dd className="text-xs text-muted-foreground">Scheduled as {formatInZone(session.starts_at, session.timezone)}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="text-sm font-medium">{session.duration_minutes} minutes</dd>
                <dd className="mt-1">
                  {session.status === "canceled" ? (
                    <StatusBadge status="canceled" label="Cancelled" />
                  ) : phase === "live" ? (
                    <StatusBadge status="live" label="Live now" />
                  ) : phase === "ended" ? (
                    <StatusBadge status="completed" label="Ended" tone="neutral" />
                  ) : (
                    <StatusBadge status="scheduled" label={phase === "joinable" ? "Starting soon" : "Scheduled"} />
                  )}
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Video className="mt-0.5 size-4 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Platform</dt>
                <dd className="text-sm font-medium">{PROVIDER_LABEL[session.provider]}</dd>
                {session.join_url && session.status !== "canceled" ? (
                  <dd className="mt-1">
                    <a href={session.join_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      Open meeting <ExternalLink className="size-3.5" />
                    </a>
                  </dd>
                ) : null}
              </div>
            </div>
            {session.meeting_passcode ? (
              <div className="flex gap-3">
                <KeyRound className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Passcode</dt>
                  <dd className="font-mono text-sm">{session.meeting_passcode}</dd>
                </div>
              </div>
            ) : null}
          </dl>
          {session.description ? <p className="mt-5 border-t pt-4 text-sm whitespace-pre-line text-muted-foreground">{session.description}</p> : null}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <SectionHeader title="Announcement" description="Shown to students on the class card." />
          <AnnouncementForm sessionId={session.id} initial={session.announcement ?? ""} disabled={!editable} />
        </section>
      </div>

      <section className="mt-8">
        <SectionHeader
          title="Students & attendance"
          description={`${attendees.length} invited · ${attendedCount} attended`}
          actions={
            <div className="flex flex-wrap gap-2">
              <InviteStudentsButton sessionId={session.id} disabled={!editable} />
              {session.provider !== "external" && session.status !== "canceled" ? <SyncArtifactsButton sessionId={session.id} /> : null}
            </div>
          }
        />
        {attendees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students invited yet"
            description="Students with current access to the course are invited automatically. Use “Invite new students” after new enrollments."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="max-sm:hidden">RSVP</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right max-sm:hidden">Time in class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendees.map((a) => {
                  const p = presence.get(a.user_id);
                  return (
                    <TableRow key={a.user_id}>
                      <TableCell>
                        <p className="font-medium">{a.name}</p>
                        {a.email ? <p className="text-xs text-muted-foreground">{a.email}</p> : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize max-sm:hidden">{a.rsvp ?? "—"}</TableCell>
                      <TableCell>
                        <AttendanceToggle sessionId={session.id} userId={a.user_id} present={Boolean(p)} source={p?.source ?? null} />
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums max-sm:hidden">{formatSeconds(p?.duration ?? null)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {otherParticipants.length > 0 ? (
          <details className="mt-4 rounded-xl border bg-card p-4 text-sm">
            <summary className="cursor-pointer font-medium">
              {otherParticipants.length} participant record{otherParticipants.length === 1 ? "" : "s"} not matched to an invited student
            </summary>
            <p className="mt-2 text-muted-foreground">
              {session.provider === "google_meet"
                ? "Google Meet reports display names only, so these can't be matched to accounts automatically. Mark students above if you recognise them."
                : "These people joined with an email that doesn't belong to an invited student (for example the host or a guest)."}
            </p>
            <ul className="mt-3 grid gap-1">
              {otherParticipants.map((o) => (
                <li key={o.id} className="flex justify-between gap-3">
                  <span>{o.participant_name || o.participant_email || "Unknown participant"}</span>
                  <span className="text-muted-foreground tabular-nums">{formatSeconds(o.duration_seconds)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeader title="Recordings" description="Students see visible recordings on the class card." />
          <div className="grid gap-3">
            {recordings.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {session.provider === "external"
                  ? "Add the recording link once it's available."
                  : "Recordings appear here automatically when the provider makes them available (plan permitting). You can also add a link."}
              </p>
            ) : (
              <ul className="grid gap-2">
                {recordings.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                    <div className="min-w-0">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium hover:text-primary">
                          <span className="truncate">{r.title || "Recording"}</span> <ExternalLink className="size-3.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="font-medium">{r.title || "Recording"}</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {r.provider === "external" ? "Added manually" : `From ${PROVIDER_LABEL[r.provider as "zoom" | "google_meet"] ?? "provider"}`}
                        {r.passcode ? ` · passcode ${r.passcode}` : ""}
                        {r.duration_seconds ? ` · ${formatSeconds(r.duration_seconds)}` : ""}
                      </p>
                    </div>
                    <RecordingControls recordingId={r.id} isVisible={r.is_visible} title={r.title || "recording"} />
                  </li>
                ))}
              </ul>
            )}
            <AddRecordingForm sessionId={session.id} />
          </div>
        </section>

        <section>
          <SectionHeader title="Resources" description="Slides, worksheets and links for this class." />
          <div className="grid gap-3">
            {resources.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No resources yet.</p>
            ) : (
              <ul className="grid gap-2">
                {resources.map((r) => (
                  <ResourceRow
                    key={r.id}
                    id={r.id}
                    title={r.title}
                    href={r.media_file_id ? `/api/files/${r.media_file_id}` : (r.url ?? "#")}
                    external={!r.media_file_id}
                  />
                ))}
              </ul>
            )}
            {editable ? <AddResourceForm sessionId={session.id} courseId={session.course_id} /> : null}
          </div>
        </section>
      </div>
    </>
  );
}

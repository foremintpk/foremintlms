import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarPlus, Info, Megaphone, Paperclip, PlayCircle, Radio, Video } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isoHoursAgo, liveJoinState } from "@/components/learning/lib";
import { requireUser } from "@/lib/auth/guards";
import { formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaybackForAsset } from "@/lib/services/video";
import type { PlaybackSource } from "@/lib/services/video/types";
import { VideoPlayer } from "@/components/learning/video-player";

export const instant = false;

export const metadata: Metadata = { title: "Live classes" };

const PROVIDER: Record<string, string> = { zoom: "Zoom", google_meet: "Google Meet", external: "Online meeting" };

const JOIN_MESSAGE: Record<string, string> = {
  early: "That class isn't open yet. You can join from 15 minutes before it starts.",
  ended: "That class has already ended. Recordings appear below when available.",
  canceled: "That class was cancelled.",
  no_link: "The join link isn't ready yet. Try again shortly or message your instructor.",
  not_found: "We couldn't find that live class.",
};

interface SessionRow {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  provider: string;
  status: string;
  announcement: string | null;
  canceled_reason: string | null;
  courses: { title: string; slug: string } | null;
  meeting_recordings: { id: string; title: string | null; url: string | null; passcode: string | null; video_asset_id: string | null; is_visible: boolean }[];
  live_session_resources: { id: string; title: string; media_file_id: string | null; url: string | null }[];
}

export default async function LiveClassesPage({ searchParams }: PageProps<"/learn/live">) {
  const sp = await searchParams;
  const join = typeof sp.join === "string" ? JOIN_MESSAGE[sp.join] : undefined;
  return (
    <>
      <PageHeader title="Live classes" description="Workshops and Q&A sessions for your courses, shown in your local time." />
      {join ? (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-xl border bg-info-soft px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" /> {join}
        </p>
      ) : null}
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <Sessions />
      </Suspense>
    </>
  );
}

async function Sessions() {
  const user = await requireUser("/learn/live");
  const supabase = await createClient();
  const since = isoHoursAgo(90 * 24);
  const { data } = await supabase
    .from("live_sessions")
    .select(
      "id, course_id, title, description, starts_at, duration_minutes, provider, status, announcement, canceled_reason, courses(title, slug), meeting_recordings(id, title, url, passcode, video_asset_id, is_visible), live_session_resources(id, title, media_file_id, url)",
    )
    .gte("starts_at", since)
    .order("starts_at", { ascending: true })
    .limit(200);
  const rows = (data ?? []) as unknown as SessionRow[];
  const now = new Date();
  const upcoming = rows.filter((s) => {
    const state = liveJoinState(s.starts_at, s.duration_minutes, s.status, now);
    return state === "upcoming" || state === "joinable" || (state === "canceled" && new Date(s.starts_at) > now);
  });
  const past = rows.filter((s) => !upcoming.includes(s) && s.status !== "canceled").reverse();

  // Recordings stored as video assets play inline (assets must belong to the session's course).
  const assetRecs = past.flatMap((s) => s.meeting_recordings.filter((r) => r.is_visible && r.video_asset_id).map((r) => ({ s, r }))).slice(0, 12);
  const playback = new Map<string, PlaybackSource>();
  if (assetRecs.length) {
    const { data: assets } = await createAdminClient()
      .from("video_assets")
      .select("id, course_id")
      .in("id", assetRecs.map((x) => x.r.video_asset_id!));
    const courseOf = new Map(((assets ?? []) as { id: string; course_id: string | null }[]).map((a) => [a.id, a.course_id]));
    await Promise.all(
      assetRecs.map(async ({ s, r }) => {
        if (courseOf.get(r.video_asset_id!) !== s.course_id) return;
        const src = await getPlaybackForAsset(r.video_asset_id!, user.id, 0);
        if (src) playback.set(r.id, src);
      }),
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        title="No live classes yet"
        description="When your instructors schedule a workshop or Q&A for your courses, it will appear here with a join button."
      />
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader title="Upcoming" />
        {upcoming.length ? (
          <ul className="space-y-3">
            {upcoming.map((s) => (
              <SessionCard key={s.id} s={s} state={liveJoinState(s.starts_at, s.duration_minutes, s.status, now)} playback={playback} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing scheduled right now.</p>
        )}
      </section>
      {past.length ? (
        <section>
          <SectionHeader title="Past classes" description="Recordings and materials from the last 90 days." />
          <ul className="space-y-3">
            {past.map((s) => (
              <SessionCard key={s.id} s={s} state="ended" playback={playback} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SessionCard({ s, state, playback }: { s: SessionRow; state: ReturnType<typeof liveJoinState>; playback: Map<string, PlaybackSource> }) {
  const recordings = s.meeting_recordings.filter((r) => r.is_visible);
  return (
    <li className="rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex w-full shrink-0 items-center gap-3 sm:w-28 sm:flex-col sm:items-start sm:gap-0.5">
          <LocalTime value={s.starts_at} format="date" className="font-heading text-base font-semibold" />
          <LocalTime value={s.starts_at} format="time" className="text-sm text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{s.title}</h3>
            {state === "joinable" ? <StatusBadge status="live" label={s.status === "live" ? "Live now" : "Starting soon"} /> : null}
            {state === "canceled" ? <StatusBadge status="canceled" /> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {s.courses ? (
              <Link href={`/learn/courses/${s.courses.slug}`} className="hover:text-foreground hover:underline">
                {s.courses.title}
              </Link>
            ) : null}{" "}
            · {formatDuration(s.duration_minutes)} · {PROVIDER[s.provider] ?? "Online"}
          </p>
          {s.description ? <p className="text-sm whitespace-pre-wrap">{s.description}</p> : null}
          {state === "canceled" && s.canceled_reason ? <p className="text-sm text-muted-foreground">Reason: {s.canceled_reason}</p> : null}
          {s.announcement ? (
            <p className="flex items-start gap-2 rounded-lg bg-brand-soft/60 px-3 py-2 text-sm">
              <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" /> {s.announcement}
            </p>
          ) : null}
          {s.live_session_resources.length ? (
            <ul className="flex flex-wrap gap-2 pt-1">
              {s.live_session_resources.map((r) => {
                const href = r.media_file_id ? `/api/files/${r.media_file_id}` : r.url && /^https?:\/\//.test(r.url) ? r.url : null;
                return href ? (
                  <li key={r.id}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    >
                      <Paperclip className="size-3" /> {r.title}
                    </a>
                  </li>
                ) : null;
              })}
            </ul>
          ) : null}
          {state === "ended" && recordings.length ? (
            <ul className="flex flex-wrap gap-2 pt-1">
              {recordings.map((r) =>
                playback.get(r.id) ? (
                  <li key={r.id} className="w-full">
                    <details className="rounded-lg border">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                        <PlayCircle className="size-3.5" /> {r.title ?? "Watch recording"}
                      </summary>
                      <div className="p-2">
                        <VideoPlayer source={playback.get(r.id)!} lessonId={s.id} title={r.title ?? s.title} track={false} />
                      </div>
                    </details>
                  </li>
                ) : r.url && /^https:\/\//.test(r.url) ? (
                  <li key={r.id}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                    >
                      <PlayCircle className="size-3.5" /> {r.title ?? "Watch recording"}
                      {r.passcode ? <span className="font-mono text-muted-foreground">· {r.passcode}</span> : null}
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          ) : state === "ended" ? (
            <p className="text-xs text-muted-foreground">No recording has been shared for this class.</p>
          ) : null}
        </div>
        {state === "joinable" || state === "upcoming" ? (
          <div className="flex shrink-0 gap-2 sm:flex-col">
            {state === "joinable" ? (
              <Button asChild>
                <a href={`/api/live/${s.id}/join`} target="_blank" rel="noopener">
                  <Video /> Join class
                </a>
              </Button>
            ) : (
              <Button disabled variant="outline" title="Opens 15 minutes before the start time">
                <Video /> Join opens soon
              </Button>
            )}
            <Button asChild variant="outline">
              <a href={`/api/live/${s.id}/ics`}>
                <CalendarPlus /> Add to calendar
              </a>
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";
import { expireDueEntitlements, remindExpiringEntitlements } from "@/lib/services/entitlements";
import { processEmailOutbox } from "@/lib/services/email/worker";
import { sendLiveSessionReminders, syncLiveSessionArtifacts } from "@/lib/services/live/reminders";
import { sendAssignmentDeadlineReminders } from "@/lib/services/assignments/reminders";
import { reconcileWhopPayments, retryFailedWebhookEvents } from "@/lib/services/payments/reconcile";
import { publishScheduledContent } from "@/lib/services/courses/scheduled";
import { issuePendingCertificates } from "@/lib/services/certificates";
import { syncProcessingVideos } from "@/lib/services/video/sync";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Background jobs. Each job is idempotent and safe to run concurrently
 * (work is claimed with SKIP LOCKED / per-row "sent_at" markers), so a
 * missed or doubled run never sends duplicate emails or grants access twice.
 *
 * Triggered by Vercel Cron (vercel.json) or Supabase pg_cron + pg_net with
 * `Authorization: Bearer $CRON_SECRET`.
 */
const JOBS: Record<string, () => Promise<unknown>> = {
  // every 5 minutes
  "email-outbox": async () => {
    await createAdminClient().rpc("release_stale_email_locks", { p_older_than_minutes: 10 });
    return processEmailOutbox({ limit: 50 });
  },
  "live-reminders": () => sendLiveSessionReminders(),
  "scheduled-publishing": () => publishScheduledContent(),
  "webhook-retries": () => retryFailedWebhookEvents(),
  "video-sync": () => syncProcessingVideos(),
  // hourly
  "entitlement-expiry": () => expireDueEntitlements(),
  "assignment-reminders": () => sendAssignmentDeadlineReminders(),
  "live-artifacts": () => syncLiveSessionArtifacts(),
  "certificates": () => issuePendingCertificates(),
  // daily
  "access-expiry-reminders": async () => remindExpiringEntitlements(await getSetting<number>("learning.access_expiry_reminder_days", 7)),
  "payment-reconciliation": () => reconcileWhopPayments({ trigger: "scheduled" }),
};

function authorized(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && safeEqual(token, serverEnv().CRON_SECRET);
}

async function handle(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { job } = await ctx.params;
  const run = JOBS[job];
  if (!run) return NextResponse.json({ error: `Unknown job "${job}"` }, { status: 404 });
  const started = Date.now();
  try {
    const result = await run();
    return NextResponse.json({ job, ok: true, result, ms: Date.now() - started });
  } catch (err) {
    console.error(`[cron:${job}] failed`, err);
    return NextResponse.json({ job, ok: false, error: "Job failed — see server logs" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

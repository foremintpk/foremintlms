# Teaching workspace & live classes

Covers the instructor workspace (`/teach`) and live classes with Zoom, Google Meet or any external meeting link (`/teach/live`, `/admin/live`).

## What's built

| Area | Routes | Notes |
| --- | --- | --- |
| Instructor dashboard | `/teach` | Assigned courses, enrolled students, completion chart, pending reviews, unanswered questions, upcoming classes, recent conversations, notifications. |
| Students | `/teach/students`, `/teach/students/[id]` | Only students enrolled in the instructor's assigned courses. Filters: course, status, progress; search by name/email. Detail: per-course progress, quizzes, assignments, activity timeline, "Message" (→ `/teach/messages?to=`). |
| Reviews | `/teach/reviews`, `/teach/reviews/submissions/[id]`, `/teach/reviews/quiz-attempts/[id]` | Queue (oldest first) of submitted/in-review assignments and quiz attempts needing manual review. Rubric scoring, points, late penalty, feedback thread, Approve / Save grade / Request resubmission, comments. Manual scoring of written quiz answers. Students are notified; passing results call `syncCompletionAfterGrading` (lesson completion, progress, certificates). |
| Analytics | `/teach/analytics` | Date range (7d/30d/90d/12m) + course filter. New enrollments trend, completion rate by course, lesson drop-off (single course), quiz table, assignment table. Aggregates run in SQL as the signed-in user (RLS), so only assigned courses are counted. No revenue data. |
| Settings | `/teach/settings` (`?section=account|profile|meetings`) | Account (shared `AccountSettings`), public instructor profile, meeting accounts (connect/disconnect Zoom and Google Meet). |
| Live classes | `/teach/live`, `/teach/live/[id]`, `/admin/live`, `/admin/live/[id]`, `/admin/live/accounts` | Schedule / edit / reschedule / cancel; invites everyone with current course access; announcement; resources (files + links); recordings (synced + manual, visibility toggle); attendance (provider + join clicks + manual). |
| OAuth | `/api/integrations/zoom/{connect,callback}`, `/api/integrations/google/{connect,callback}` | Per-instructor accounts. CSRF `state` in an httpOnly SameSite=Lax cookie; tokens AES-256-GCM encrypted at rest; refreshed two minutes before expiry; never sent to the browser. |
| Webhook | `/api/webhooks/zoom` | Signature-verified, stored idempotently in `webhook_events` (provider `zoom`). |

Background jobs (wired in `/api/cron/[job]`):

- `live-reminders` (every 5 min) → `sendLiveSessionReminders()`: moves sessions to *live*/*completed* by time and sends the long (default 24 h) and short (default 1 h) reminders once, in each student's time zone. Offsets come from the `live.reminder_offsets_minutes` setting (first two values). A class scheduled inside the short window gets one reminder only.
- `live-artifacts` (hourly) → `syncLiveSessionArtifacts()`: for Zoom/Meet classes that ended in the last 7 days (15 min grace), imports recordings and participants where the plan allows. Limitations are recorded on the session (`provider_sync_error`) instead of failing.

Migration `20261114104001_live_teacher_analytics.sql` adds SECURITY INVOKER aggregate functions (`teacher_enrollment_series`, `teacher_course_completion`, `teacher_student_count`, `teacher_lesson_dropoff`, `teacher_quiz_stats`, `teacher_assignment_stats`) and two indexes.

## Time zones

A session stores `starts_at` (UTC) and the `timezone` it was scheduled in. Staff pick date + time + IANA zone; the server converts with `zonedLocalToUtc` (DST-aware). Students always see their own local time (`LocalTime` in the browser) and emails use each recipient's profile time zone.

Students can join from 15 minutes before the start until the scheduled end (the student join flow lives in `/learn/live`).

## Setting up Zoom

Zoom docs: OAuth — https://developers.zoom.us/docs/integrations/oauth/ · Webhooks — https://developers.zoom.us/docs/api/webhooks/ · Meetings API — https://developers.zoom.us/docs/api/meetings/

1. In the Zoom App Marketplace create a **General app** with **user-managed** OAuth.
2. **Redirect URL / allow list:** `https://YOUR_DOMAIN/api/integrations/zoom/callback` (and `http://localhost:3000/api/integrations/zoom/callback` for development).
3. **Scopes** (granular, user level):
   - `meeting:write:meeting`, `meeting:update:meeting`, `meeting:delete:meeting`, `meeting:read:meeting` — create/update/cancel meetings
   - `user:read:user` — read the connected account's email
   - `cloud_recording:read:list_recording_files` — import cloud recordings (*Pro plan or higher with cloud recording*)
   - `meeting:read:list_past_participants` — import attendance (*Pro plan or higher*; Zoom returns nothing for one-person meetings)
4. **Event subscription** (Features → Access → Event subscription): endpoint `https://YOUR_DOMAIN/api/webhooks/zoom`, events `meeting.started`, `meeting.ended`, `recording.completed`, `meeting.participant_joined`, `meeting.participant_left`. Copy the **Secret token**. Zoom validates the URL with `endpoint.url_validation`; the route answers with `{plainToken, encryptedToken}` (HMAC-SHA256 hex).
5. Environment (or Admin → Integrations → Zoom): `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_REDIRECT_URI`, `ZOOM_WEBHOOK_SECRET_TOKEN`.
6. Each instructor connects their own account in **Settings → Meeting accounts**; admins use **Admin → Live classes → Your meeting accounts**.

Signature check: `x-zm-signature` must equal `v0=` + HMAC-SHA256(secret, `v0:${x-zm-request-timestamp}:${rawBody}`) in hex. Deliveries more than 5 minutes from the server clock are rejected (replay protection — Zoom's docs don't define a window, this is our choice). Zoom retries non-2xx responses; failed events are reprocessed on retry.

Access tokens last 1 hour; refresh tokens 90 days and rotate on every refresh — we always store the newest. If refreshing fails (e.g. the user removed the app), the connection is marked *expired* and the instructor is asked to reconnect.

## Setting up Google Meet

Google docs: Meet REST API spaces — https://developers.google.com/workspace/meet/api/guides/meeting-spaces · scopes — https://developers.google.com/workspace/meet/api/guides/authenticate-authorize · conference records — https://developers.google.com/workspace/meet/api/guides/conferences

1. Google Cloud console → enable the **Google Meet REST API**.
2. OAuth consent screen: add scopes `openid`, `email`, `https://www.googleapis.com/auth/meetings.space.created`.
   - `meetings.space.created` is a **sensitive** scope: until Google verifies the app, only test users you add can connect (and they see an "unverified app" warning).
3. Credentials → OAuth client ID (Web application). Authorized redirect URI: `https://YOUR_DOMAIN/api/integrations/google/callback` (+ localhost for development).
4. Environment (or Admin → Integrations → Google): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
5. We request `access_type=offline&prompt=consent` so a refresh token is issued.

How it maps: scheduling creates a meeting space (`POST https://meet.googleapis.com/v2/spaces`) and stores its `meetingUri` as the join link; Meet spaces have no scheduled time, so the schedule lives in our database (rescheduling changes nothing on Google's side). Cancelling ends any active conference in the space; the link itself stays valid on Google's side.

Attendance and recordings: we read conference records for the space (`space.name = "spaces/…"` filter), participants and recordings. Google only returns **display names** for participants (no email), so they're listed as "not matched" for staff to mark manually. Recordings are available only on Workspace editions with Meet recording; downloading the files themselves would need the *restricted* `drive.readonly` scope, so we link to the Drive file instead.

## External meeting links (always available)

Any https meeting URL can be used — no integration required. Recordings and attendance are then added manually on the class page.

## Plan limitations (handled gracefully)

| Capability | Zoom | Google Meet | External |
| --- | --- | --- | --- |
| Create / update / cancel meeting | Any plan | Create + end conference (no scheduling on Google's side) | Manual |
| Cloud recordings | Pro+ with cloud recording | Workspace editions with recording | Manual link |
| Attendance | Pro+ (past participants) + webhooks | Display names only | Manual |

When the provider refuses (401/403/404), the class shows a "needs attention" note explaining why, and the manual fallbacks always work.

## Security notes

- Instructors can only see and manage classes, students, submissions and analytics for courses in `course_instructors`. Every page re-checks this server-side (`getCourseRole`), actions use `assertCourseStaff`, and analytics aggregates run under RLS.
- `meeting_provider_connections` tokens are encrypted with `ENCRYPTION_KEY`; authenticated users can't select token columns (column privileges), and only server code decrypts them.
- Every staff action is written to `audit_logs`.

## Not tested against live accounts

The Zoom and Google integrations were implemented from the official documentation and are covered by unit tests for signatures, URL validation, OAuth state and time handling. They have **not** been exercised against real Zoom/Google accounts (no credentials were available). Verify end to end once credentials are configured: connect an account, schedule a class, reschedule, cancel, and (on a paid plan) confirm recordings/attendance import.

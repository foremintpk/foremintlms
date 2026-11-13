# Learning experience (student workspace)

What students see under `/learn`, and the services behind it.

## Routes

| Route | Purpose |
| --- | --- |
| `/learn` | Dashboard: continue learning, overall progress, active courses, assignments to do, recently viewed lessons, upcoming live classes, announcements, notifications, certificates, recommended courses |
| `/learn/courses` | My courses — Active / Completed / Expired tabs, plus an **All-access library** tab for members |
| `/learn/courses/[slug]` | Course overview: access state, progress, resume, curriculum with completion / drip / lock states, certificate checklist and download, instructor messaging, discussions and live links, course review |
| `/learn/courses/[slug]/lessons/[lessonId]` | Lesson player |
| `/learn/courses/[slug]/quizzes/[quizId]` | Quiz overview, attempt (`?attempt=`) and results (`?result=`) |
| `/learn/courses/[slug]/assignments/[assignmentId]` | Instructions, rubric, submission form, version history and feedback |
| `/learn/live` | Upcoming and past live classes (local time, join, calendar file, resources, recordings) |
| `/learn/assignments` | Every assignment across courses with status and due date |
| `/learn/certificates` | Issued certificates: view, download, copy verification link |
| `POST /api/progress` | Video heartbeat (also `navigator.sendBeacon` on pause/unload) |
| `GET /api/certificates/[id]/pdf` | Certificate PDF (owner, course staff, admin). `?download=1` forces download |
| `GET /api/live/[id]/ics` | iCalendar file for a live class |
| `GET /api/live/[id]/join` | Records attendance (`join_click`) and redirects to the meeting |

Course discussions (`/learn/courses/[slug]/discussions`), messages, support, billing, notifications and settings belong to other workstreams.

## Access rules (enforced on the server, not just hidden)

- Every page re-resolves access with `getCourseAccess` (entitlements → `resolveCourseAccess`). Clear messages for **not enrolled / expired / revoked / paused (dispute) / course unavailable**, each with the right next step.
- Lesson blocks, resources, recordings and live sessions are read with the **user's own Supabase client**, so RLS (`private.can_view_lesson`, `has_course_access`) applies a second time, including drip release.
- **Drip release** (`release_at`, `release_after_days` on lessons and modules) and **sequential / prerequisite locks** are checked before a lesson renders and before any progress is recorded. Locked lessons show when they open or what to finish first.
- **Preview lessons** of public courses can be opened by any signed-in visitor; progress isn't tracked and notes are off.
- **Staff preview**: admins and assigned instructors can open everything; progress isn't recorded unless they're also enrolled.
- **All-access members** are enrolled the first time they open a course (drip schedules count from then).
- Progress, quiz attempts, answers, submissions and certificates are written only by server code using the service role *after* these checks — RLS gives clients no write access.

## Lesson player

Layout: outline (left on desktop, drawer on mobile) · content · resources / notes / bookmarks (right on wide screens, below otherwise) · lesson summary · mark complete · previous / next (sticky on mobile) · lesson Q&A (`LessonDiscussions` from the communication workstream).

Every block type renders: video, video playlist, allow-listed embeds (YouTube, Vimeo, Loom, Google Docs/Slides/Sheets, Figma, CodePen, Miro — sandboxed iframe), rich text (sanitised again on render), PDF (inline + download), Word / PowerPoint / Excel (download — private files can't use online viewers), images, files, external links, quiz cards, assignment cards, live session cards (join window + calendar), recordings, resource collections.

### Video

`VideoPlayer` takes the provider-agnostic `PlaybackSource` from `getPlaybackForAsset`:

- **YouTube (unlisted)** — IFrame API on `youtube-nocookie.com`, resume via `start`. Unlisted videos can be watched by anyone with the link; only enrolled learners receive the ID.
- **Mux** — `@mux/mux-player-react` with signed playback / thumbnail / storyboard tokens, captions and quality selection.
- **Bunny Stream** — token-signed iframe; resume via the `t` parameter; time tracking via player.js (loaded from `assets.mediadelivery.net`, falling back to the embed.ly build). If player.js can't load, playback still works but progress isn't tracked automatically.

Progress is sent every 10 seconds while playing and on pause/end/page hide. Position is saved for resume (restarts if the video was finished). Lessons with completion rule **video_watched** complete at 90%.

### Completion rules

| Rule | Completes when |
| --- | --- |
| `manual` | The learner clicks **Mark as complete** (and can undo) |
| `video_watched` | 90% of the lesson's first video has been watched |
| `quiz_passed` | Every quiz the lesson links to has a passing attempt |
| `assignment_approved` | Every assignment the lesson links to is approved, or graded at/above its pass mark |

Course progress is recalculated by `recalculate_enrollment_progress`; at 100% the enrollment becomes **completed**. Certificates are attempted whenever progress reaches the course's minimum.

## Quizzes

- Starting an attempt checks access, release, attempt limits and cooldown; draws `draw_count` questions from the bank when configured; shuffles questions/options with a crypto RNG; stores the order on the attempt.
- The browser never receives answer keys or explanations before submission.
- Answers autosave every 15 seconds. The timer is shown client-side but **enforced server-side**: answers arriving after the time limit (+15s grace) are ignored, and expired attempts are auto-graded with what was saved.
- Grading uses `gradeAttempt` (single/multiple choice all-or-nothing, true/false, short answer with accepted answers). Answers that need manual review leave the attempt `needs_review` and notify the course's instructors.
- Results honour the quiz's *show correct answers* setting (never / after submit / after pass).

## Assignments

- Due date: absolute, or relative to the learner's enrollment date. Late submissions are flagged; blocked when the assignment doesn't allow them.
- Server enforces submission types, file extensions, file count and size; files must be the learner's own uploads for this assignment (`submissions/<user>/<assignment>/…`).
- New submissions are allowed only when nothing is pending and either there is no submission yet or a resubmission was requested.
- Instructors are notified of each submission; feedback and grades appear in the version history.

## Certificates

- Eligibility: minimum progress, passing every published quiz and every published assignment that counts toward completion (configurable per course).
- Number format `FMA-YYYY-XXXXXXXX` (no ambiguous characters), unique, retried on collision. Recipient, course and lead instructor names are snapshotted.
- PDF: A4 landscape, Foremint mark, Funnel fonts, completion date, number, verification URL and QR code. Falls back to Helvetica if font files aren't available at runtime.
- Public verification lives at `/certificates/verify/<number>` (public site workstream).

## Background jobs (registered in `/api/cron/[job]`)

| Job | Function | Notes |
| --- | --- | --- |
| `assignment-reminders` (hourly) | `sendAssignmentDeadlineReminders` | Unsubmitted assignments due within 24h. Each (assignment, learner, due date) is claimed in `assignment_deadline_reminders` first, so reruns never double-send |
| `certificates` (hourly) | `issuePendingCertificates` | Issues certificates for learners who qualified outside a request (e.g. a late grade) |

## Contracts exported to other workstreams

- `@/lib/services/progress` → `syncCompletionAfterGrading({ userId, courseId, assignmentId?, quizId? })` — call after approving/grading an assignment or finishing a manual quiz review.
- `@/lib/services/certificates` → `issueCertificateIfEligible(userId, courseId)`, `issuePendingCertificates()`.
- `@/lib/services/assignments/reminders` → `sendAssignmentDeadlineReminders()`.

## Migration

`supabase/migrations/20261114102001_learning_assignment_reminders.sql` — `assignment_deadline_reminders` table (owner-read RLS, server-only writes) and two lookup indexes.

## Known limitations

- Office documents (DOCX/PPTX/XLSX) in private storage are downloaded rather than previewed in the browser.
- Bunny progress tracking depends on player.js; YouTube/Mux tracking is native.
- Certificate PDF fonts are read from `node_modules/@fontsource/*` and the mark from `public/brand`. On Vercel these must be included in the function bundle (`outputFileTracingIncludes`, see the deployment notes); otherwise the PDF uses Helvetica and omits the mark.

# Course builder & video delivery

This covers how instructors and administrators build courses, how lesson content is stored, how course publication is reviewed, and how video works with Mux, Bunny Stream and YouTube.

## Routes

| Route | Who | Purpose |
| --- | --- | --- |
| `/teach/courses` | Approved instructors | Courses the instructor is assigned to; **New course** appears when the account has `can_create_courses` |
| `/admin/courses` | Admins (MFA) | Every course, with search, status, category and instructor filters, a **Review queue** tab, pagination and bulk unpublish/archive |
| `…/courses/new` | Both | Create a draft course |
| `…/courses/[id]` | Both | **Details**: title, address (slug), descriptions, images, promo video, category, level, language, duration, outcomes/requirements/audience/tags, visibility, free flag, sequential lessons, discussions, certificate rules, SEO |
| `…/courses/[id]/curriculum` | Both | Modules and lessons with drag-and-drop (lessons can move between modules), drip release, prerequisites, completion rules, preview and visibility |
| `…/courses/[id]/lessons/[lessonId]` | Both | Lesson editor: ordered content blocks plus lesson resources |
| `…/courses/[id]/quizzes` | Both | Quizzes and question banks |
| `…/courses/[id]/quizzes/[quizId]` | Both | Quiz settings and questions; copy questions from banks |
| `…/courses/[id]/quizzes/banks/[bankId]` | Both | Questions in a bank |
| `…/courses/[id]/assignments[/assignmentId]` | Both | Assignment instructions, files, deadline, late policy, submission types, rubric |
| `…/courses/[id]/review` | Both | Readiness checklist, submit/withdraw (instructors), approve now / schedule / request changes / unpublish / feature / archive / restore (admins) |
| `/admin/courses/[id]/instructors` | Admins | Assign approved instructors as lead/assistant and set edit rights |
| `/api/webhooks/mux` | Mux | Asset/upload status updates |
| `/api/webhooks/bunny` | Bunny Stream | Encoding status updates |

The Live classes, Students and Pricing tabs link to the pages owned by those features (`/teach/live?course=`, `/teach/students?course=`, `/admin/live?course=`, `/admin/pricing?course=`).

Instructors without edit rights (`course_instructors.can_edit = false`) see every builder page read-only.

## Content blocks

A lesson is an ordered list of `lesson_content_blocks`. Type-specific settings live in `data` (validated by `src/lib/validation/course-blocks.ts`); references use dedicated columns:

| Block | References | `data` |
| --- | --- | --- |
| `video` | `video_asset_id` | `caption?` |
| `video_playlist` | — | `video_asset_ids[]` (≤ 50, all from the course), `caption?` |
| `embed` | — | `url` (as pasted), `embed_url` (normalised, allow-listed), `provider`, `aspect`, `caption?` |
| `rich_text` | — | `html` (sanitised on save) |
| `pdf`, `document`, `presentation`, `spreadsheet`, `image`, `file` | `media_file_id` | `description?` / `alt?` + `caption?` (image), `allow_download` |
| `link` | — | `url` (https only), `label`, `description?` |
| `quiz` | `quiz_id` | `intro?` |
| `assignment` | `assignment_id` | `intro?` |
| `live_session` | `live_session_id` | `intro?` |
| `recording` | `video_asset_id` when `source = video_asset` | `source`, `meeting_recording_id?`, `caption?` |
| `resource_collection` | — | `heading?`, `description?` — renders the lesson's `lesson_resources` at this position |

Embeds accept share links from YouTube, Vimeo, Loom, Google Docs/Slides/Sheets/Forms/Drive, Figma, CodePen and Miro, and only ever store a canonical embed URL on an allow-listed host (`src/lib/services/courses/embeds.ts`). Renderers should also check `isAllowedEmbedUrl()`.

Files are uploaded through the shared signed-upload flow (`purpose = course_content`). Each file block accepts specific extensions (e.g. `.pptx` for presentations); the platform-wide upload limits in Admin → Settings still apply. Files no longer used by any block or resource are deleted from storage.

## Publication workflow

```
draft ──(instructor: Submit for review)──▶ in_review ──(admin: Publish now)──▶ published
  ▲                                          │   └─(admin: Schedule)──▶ in_review + scheduled_publish_at ──(cron)──▶ published
  └────────(withdraw / request changes)──────┘
published ──(admin)──▶ unpublished │ archived ──(admin: restore)──▶ draft
```

- Database triggers stop instructors from publishing, featuring or scheduling directly — even through the raw API. Any non-admin status change also clears an earlier approval and schedule (`guard_course_schedule` in `20261114103000_builder_rpc.sql`), so an old approval can never publish newer, unreviewed content.
- Submitting requires the readiness checklist (descriptions, thumbnail, category, 3+ outcomes, at least one published lesson, no empty published lessons). Admins see the same checklist but can publish anyway.
- Admins are notified of submissions (in-app + `learning.course_submitted`); instructors are notified of review outcomes (`learning.course_review_result`). Every publish/schedule/unpublish/archive/restore/feature/instructor change is written to the audit log.
- `publishScheduledContent()` (cron `scheduled-publishing`, every 5 minutes) publishes due courses and scheduled blog posts and revalidates the `courses`, `catalog`, `course:<id>`, `course:<slug>`, `blog`, `blog:<slug>` cache tags. The public site should tag its cached course queries with those tags.

Quizzes and assignments with student attempts/submissions are archived rather than deleted, so results and feedback are kept. Questions that students have answered can be edited but not deleted. Saving a question keeps existing option IDs (past answers reference them).

## Video providers

Videos are `video_assets` rows owned by a course and reusable in any of its lessons. The provider can differ per video. Code: `src/lib/services/video/`.

### Mux (recommended for paid content)

1. Mux dashboard → **Settings → Access tokens** → create a token with **Mux Video: Read + Write**. Set `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`.
2. **Settings → Signing keys** → create a key. Set `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_PRIVATE_KEY` (the base64 private key as shown). With a signing key, new uploads use the **signed** playback policy and the player receives short-lived (3 h) playback, thumbnail and storyboard tokens (`jwt.signPlaybackId`). Without one, uploads are public-playback (anyone with the playback ID can watch).
3. **Settings → Webhooks** → add `https://<your-domain>/api/webhooks/mux`, copy the signing secret into `MUX_WEBHOOK_SECRET`. Signatures are verified with `mux.webhooks.unwrap`.
4. Uploads go straight from the browser to Mux (direct upload, `cors_origin` = `NEXT_PUBLIC_APP_URL`). New assets request English auto-generated captions, `basic` video quality and up to 1080p.

Docs: <https://www.mux.com/docs/guides/upload-files-directly>, <https://www.mux.com/docs/guides/secure-video-playback>, <https://www.mux.com/docs/core/listen-for-webhooks>.

### Bunny Stream

1. Bunny dashboard → **Stream → your library → API**: set `BUNNY_STREAM_LIBRARY_ID` and `BUNNY_STREAM_API_KEY` (library API key), and `BUNNY_STREAM_CDN_HOSTNAME` (e.g. `vz-xxxx.b-cdn.net`, used for thumbnails).
2. **Security → Embed view token authentication**: enable it and set `BUNNY_STREAM_TOKEN_KEY`. Embeds are then signed as `SHA256(token_key + video_id + expires)` and expire after 3 h. Without a token key, embeds are unsigned.
3. **Webhooks**: Bunny signs deliveries with HMAC-SHA256 of the raw body keyed by the library's **read-only API key** (`X-BunnyStream-Signature`, version `v1`). Set `BUNNY_WEBHOOK_SECRET` to that read-only key and register `https://<your-domain>/api/webhooks/bunny`. If your library sends unsigned webhooks, register `https://<your-domain>/api/webhooks/bunny?secret=<BUNNY_WEBHOOK_SECRET>` instead. The handler never trusts the payload: it re-fetches the video from the Bunny API.
4. Browser uploads use TUS (`tus-js-client`, resumable) with `AuthorizationSignature = SHA256(library_id + api_key + expiration + video_id)`, generated on the server; the API key never reaches the browser.

Docs: <https://docs.bunny.net/reference/tus-resumable-uploads>, <https://docs.bunny.net/docs/stream-embed-token-authentication>, <https://docs.bunny.net/docs/stream-webhook>, <https://docs.bunny.net/reference/video_getvideo>.

### YouTube (unlisted)

No credentials. Paste a YouTube link; it is validated with YouTube's public oEmbed endpoint (works for public and unlisted videos with embedding allowed). Playback uses `youtube-nocookie.com`.

**Limitation:** YouTube cannot enforce our access rules. The platform only gives the video ID to learners who pass the course access checks, but anyone who obtains the link can watch an unlisted video. Use Mux or Bunny for content that must stay behind the paywall. Duration isn't available without a YouTube Data API key, so YouTube videos show no duration.

### Status and processing

Mux/Bunny assets move `waiting → processing → ready | errored` via webhooks, the editor's status polling, and the `video-sync` cron (`syncProcessingVideos`, every 5 minutes), which also marks uploads that never arrived within 48 h as failed.

### Contracts for other parts of the app

- `getPlaybackForAsset(assetId, viewerId, startSeconds)` (`@/lib/services/video`) returns `PlaybackSource | null` (null while processing). **Callers must check lesson access first.**
- `getVideoProvider(id)`, `testVideoProvider(id)` for the admin integrations page.

## Testing

`npx vitest run tests/unit/builder` covers YouTube ID parsing, Bunny TUS/embed/webhook signatures (fixed vectors), embed normalisation and allow-listing, block schemas and completeness, curriculum reordering, slug rules, and question/assignment validation.

Not yet tested against live services: Mux uploads/webhooks/signed playback and Bunny uploads/webhooks/token embeds need real credentials; the builder RPCs and triggers need to be exercised against the database once the migrations are applied.

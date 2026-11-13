# Communication: messaging, discussions, support and moderation

This covers spec §9 (private messaging, course discussions, support ticketing) and the related admin moderation screens.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/learn/messages`, `/teach/messages`, `/admin/messages` | everyone | Inbox: conversation list with unread counts, filter, “New message”, message search (`?search=1&q=`) |
| `…/messages/[id]` | participants (admins also as moderators) | Realtime thread with attachments, edit/delete, report, mute email alerts |
| `…/messages?to=<userId>` | everyone | Deep link: opens or creates a conversation if the rules allow it |
| `/admin/messages/reported` | admins | Conversations containing reported messages |
| `/learn/courses/[slug]/discussions` | anyone with course access (students, instructors, admins) | Course discussions: pinned first, filters (questions / unanswered / resolved / announcements), lesson filter, search, “Start a discussion” |
| `/learn/courses/[slug]/discussions/[id]` | same | Thread: one level of nested replies, @mentions, reactions, accepted answer, instructor badge, edit/delete own, report, staff moderation |
| `/teach/questions` | instructors | Unanswered questions across assigned courses with inline answers |
| `/learn/support`, `/learn/support/new`, `/learn/support/[id]` | everyone | My tickets, new ticket (topic, priority, course, attachments), ticket conversation, close/reopen |
| `/teach/support`, `/teach/support/[id]` | instructors | Tickets assigned to them + course-content/certificate tickets for their courses: reply, internal notes, status, “Assign to me” |
| `/admin/support`, `/admin/support/[id]` | admins | Helpdesk: metrics, filters (status, priority, topic, assignee, course, search), sorting, bulk status, assignment |
| `/admin/discussions` | admins | Reports queue (dismiss / hide / remove) and all discussions with moderation |
| `/admin/reviews` | admins | Course review moderation (publish / reject with a note to the reviewer) |

The lesson player embeds `LessonDiscussions` (`src/components/communication/lesson-discussions.tsx`) for lesson-level Q&A.

## Permissions (server-enforced)

- **Who may message whom** is enforced by `public.start_direct_conversation` → `private.can_message_user`:
  - students → approved instructors of courses they can currently access;
  - instructors → students enrolled in their courses;
  - admins → anyone;
  - students → any approved instructor only when `messaging.students_can_message_any_teacher` is on (Admin → Settings).

  The “New message” picker (`public.list_message_contacts`) lists exactly these people.
- Messages, participants and attachments are readable only by participants (RLS); admins can read conversations for moderation, and the thread clearly says when you're viewing as a moderator.
- Discussions require course access (`private.has_course_access`); hidden posts are visible only to staff and the author. Guard triggers stop non-staff users from pinning, locking, hiding or marking instructor answers. Only the question author or course staff can accept an answer.
- Tickets: requesters see their own tickets (internal notes are hidden by RLS); staff access follows `private.can_staff_ticket`. Requester close/reopen and the status changes that follow a reply are applied by the server after an ownership check.
- Every write goes through a server action: guard → Zod → service → audit for moderation → `refresh()`. Message, post, reply, reaction, report and ticket creation are rate-limited per user.
- Bodies are stored as plain text (HTML stripped) and rendered with line breaks and safe auto-links (`http(s)` only, `rel="noopener noreferrer nofollow"`).

## Notifications

| Event | In-app | Email template | Notes |
| --- | --- | --- | --- |
| New private message | — (unread badge) | `communication.new_message` | One email per recipient, per conversation, per 15-minute window; skipped if the recipient muted the conversation or read it in the last 3 minutes |
| Reply in a discussion you started or joined | yes | `communication.discussion_reply` | Debounced per thread per 15 minutes |
| @mention | yes | `communication.mention` | Mentions are limited to course members |
| New question in your course (instructors) | yes | — | |
| Ticket created | yes | `communication.ticket_created` (required) | Plus `communication.staff_ticket_alert` to the support address in settings |
| Staff reply / resolved | yes | `communication.ticket_replied` / `communication.ticket_resolved` | Internal notes never notify the student |
| Ticket assigned / student replied | yes (assignee) | — | |

All emails go through the durable outbox, with idempotency keys.

## Realtime

The browser Supabase client subscribes to `postgres_changes` on `messages`, both per conversation and for the inbox refresh. Realtime respects RLS, so users only receive events for conversations they can read. The thread shows a “Reconnecting…” or “You're offline” banner whenever the channel or the network drops. Messages that fail to send can be retried or discarded.

## Database (migration `20261114107000_comms_rpcs.sql`)

- `course_discussions.answered_at` is set by a trigger when an instructor answers or an answer is accepted. Accepting an answer also marks the question resolved. This column drives the “Unanswered” filter and the instructor queue.
- **Fix:** `private.guard_discussion` now lets writes made by other triggers through (`pg_trigger_depth() > 1`). Before the fix, a student's reply failed because the reply-count trigger runs as that student and the guard rejected the change to `reply_count`.
- New RPCs, each scoped to `auth.uid()` and granted to `authenticated` only:
  - `list_my_conversations`: inbox with unread counts and the other participant's card.
  - `search_my_messages`: full-text search across your own conversations.
  - `list_message_contacts`: the people you may message.
  - `course_discussion_members`: @mention suggestions; requires course access.

## Limitations

- Message edits are allowed for 15 minutes after sending. Deleting replaces the text with “Message deleted”. Moderator removal keeps a preview of the original in the audit log.
- Conversations are one-to-one: `start_direct_conversation` reuses an existing two-person thread, and the UI supports group threads if they're ever created server-side.
- Ticket metrics cover all open tickets plus those opened in the last 90 days, capped at 5,000 rows.
- The admin “All discussions” search matches titles only. Full-text search is available inside each course's discussions.

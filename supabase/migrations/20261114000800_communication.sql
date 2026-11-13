-- Communication: private conversations, course discussions, reactions,
-- content reports and the support helpdesk.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'support')),
  course_id uuid references public.courses (id) on delete set null,
  subject text check (length(subject) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index conversations_last_message_idx on public.conversations (last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  is_muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 10000),
  search_vector tsvector generated always as (to_tsvector('simple', body)) stored,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_search_idx on public.messages using gin (search_vector);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  media_file_id uuid not null references public.media_files (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index message_attachments_message_idx on public.message_attachments (message_id);

create table public.course_discussions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 20000),
  kind text not null default 'discussion' check (kind in ('discussion', 'question', 'announcement')),
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  is_resolved boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  mentions uuid[] not null default '{}',
  reply_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  search_vector tsvector generated always as (to_tsvector('simple', title || ' ' || body)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_discussions_course_idx on public.course_discussions (course_id, is_pinned desc, last_activity_at desc);
create index course_discussions_lesson_idx on public.course_discussions (lesson_id);
create index course_discussions_search_idx on public.course_discussions using gin (search_vector);

create table public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.course_discussions (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  parent_reply_id uuid references public.discussion_replies (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 20000),
  is_instructor_answer boolean not null default false,
  is_accepted_answer boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discussion_replies_discussion_idx on public.discussion_replies (discussion_id, created_at);

create table public.discussion_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  discussion_id uuid references public.course_discussions (id) on delete cascade,
  reply_id uuid references public.discussion_replies (id) on delete cascade,
  emoji text not null check (emoji in ('like', 'love', 'insightful', 'celebrate', 'thanks')),
  created_at timestamptz not null default now(),
  check ((discussion_id is not null) <> (reply_id is not null))
);
create unique index discussion_reactions_discussion_uniq on public.discussion_reactions (user_id, discussion_id, emoji) where discussion_id is not null;
create unique index discussion_reactions_reply_uniq on public.discussion_reactions (user_id, reply_id, emoji) where reply_id is not null;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  course_id uuid references public.courses (id) on delete cascade,
  target_type text not null check (target_type in ('discussion', 'reply', 'message', 'review')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'off_topic', 'other')),
  details text check (length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index content_reports_status_idx on public.content_reports (status, created_at desc);

create sequence public.support_ticket_number_seq start 1001;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('FMA-' || nextval('public.support_ticket_number_seq')::text),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  subject text not null check (length(subject) between 3 and 200),
  description text not null check (length(description) between 1 and 20000),
  category text not null default 'general' check (category in ('general', 'billing', 'technical', 'course_content', 'account', 'certificate', 'other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_on_student', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_requester_idx on public.support_tickets (requester_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status, priority, last_activity_at desc);
create index support_tickets_assignee_idx on public.support_tickets (assigned_to);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 20000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index support_ticket_messages_ticket_idx on public.support_ticket_messages (ticket_id, created_at);

create table public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  message_id uuid references public.support_ticket_messages (id) on delete cascade,
  media_file_id uuid not null references public.media_files (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index support_ticket_attachments_ticket_idx on public.support_ticket_attachments (ticket_id);

create trigger course_discussions_updated_at before update on public.course_discussions for each row execute function private.set_updated_at();
create trigger discussion_replies_updated_at before update on public.discussion_replies for each row execute function private.set_updated_at();
create trigger support_tickets_updated_at before update on public.support_tickets for each row execute function private.set_updated_at();

-- Keep conversation ordering and discussion counters current.
create or replace function private.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_participants set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;
create trigger messages_touch_conversation after insert on public.messages
  for each row execute function private.touch_conversation();

create or replace function private.touch_discussion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.course_discussions
      set reply_count = reply_count + 1, last_activity_at = new.created_at
      where id = new.discussion_id;
  elsif tg_op = 'DELETE' then
    update public.course_discussions
      set reply_count = greatest(reply_count - 1, 0)
      where id = old.discussion_id;
  end if;
  return null;
end;
$$;
create trigger discussion_replies_touch after insert or delete on public.discussion_replies
  for each row execute function private.touch_discussion();

create or replace function private.touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_tickets set last_activity_at = new.created_at where id = new.ticket_id;
  return new;
end;
$$;
create trigger support_ticket_messages_touch after insert on public.support_ticket_messages
  for each row execute function private.touch_ticket();

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.course_discussions enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.discussion_reactions enable row level security;
alter table public.content_reports enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_attachments enable row level security;

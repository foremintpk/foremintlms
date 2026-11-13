-- Communication: answered-state tracking, a guard fix for system counter
-- updates, and read RPCs for messaging and discussions.

----------------------------------------------------------------------------
-- 1. Discussion guard: allow writes made by other triggers.
-- private.touch_discussion (reply counters) and the answered-state trigger
-- below update course_discussions while the request still runs as the
-- replying learner. Those nested writes are system bookkeeping, not user
-- edits, so the guard lets them through (pg_trigger_depth() > 1).
----------------------------------------------------------------------------

create or replace function private.guard_discussion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  v_staff := private.is_trusted_writer() or private.is_course_instructor(coalesce(new.course_id, old.course_id));
  if v_staff then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.is_pinned or new.is_locked or new.kind = 'announcement' or new.status <> 'visible' or new.reply_count <> 0 or new.answered_at is not null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.is_pinned is distinct from old.is_pinned
    or new.is_locked is distinct from old.is_locked
    or new.kind is distinct from old.kind
    or new.status is distinct from old.status
    or new.course_id is distinct from old.course_id
    or new.author_id is distinct from old.author_id
    or new.reply_count is distinct from old.reply_count
    or new.answered_at is distinct from old.answered_at
  then
    raise exception 'Only course staff can moderate discussions' using errcode = '42501';
  end if;
  return new;
end;
$$;

----------------------------------------------------------------------------
-- 2. Answered state for questions (drives "unanswered" filters and the
-- instructor question queue).
----------------------------------------------------------------------------

alter table public.course_discussions add column if not exists answered_at timestamptz;

create index if not exists course_discussions_unanswered_idx
  on public.course_discussions (course_id, created_at desc)
  where kind = 'question' and answered_at is null and not is_resolved and status = 'visible';

create or replace function private.mark_discussion_answered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'visible' and (new.is_instructor_answer or new.is_accepted_answer) then
    update public.course_discussions
    set answered_at = coalesce(answered_at, now()),
        is_resolved = case when new.is_accepted_answer then true else is_resolved end
    where id = new.discussion_id;
  end if;
  return new;
end;
$$;

create trigger discussion_replies_mark_answered
  after insert or update of is_instructor_answer, is_accepted_answer, status on public.discussion_replies
  for each row execute function private.mark_discussion_answered();

----------------------------------------------------------------------------
-- 3. Messaging read models. SECURITY DEFINER, always scoped to auth.uid().
----------------------------------------------------------------------------

create or replace function private.user_role_label(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.user_roles r where r.user_id = p_user and r.role = 'admin') then 'admin'
    when exists (select 1 from public.teacher_profiles t where t.user_id = p_user and t.status = 'approved') then 'teacher'
    else 'student'
  end;
$$;

-- Conversations of the signed-in user with unread counts, last message and
-- the other participant's display card, in one round trip.
create or replace function public.list_my_conversations(p_search text default null, p_limit integer default 100)
returns table (
  conversation_id uuid,
  kind text,
  course_id uuid,
  course_title text,
  subject text,
  created_at timestamptz,
  last_message_at timestamptz,
  last_message_body text,
  last_message_sender_id uuid,
  unread_count integer,
  last_read_at timestamptz,
  is_muted boolean,
  other_user_id uuid,
  other_name text,
  other_avatar_url text,
  other_role text
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select cp.conversation_id, cp.last_read_at, cp.is_muted
    from public.conversation_participants cp
    where cp.user_id = (select auth.uid())
  )
  select
    c.id,
    c.kind,
    c.course_id,
    co.title,
    c.subject,
    c.created_at,
    c.last_message_at,
    lm.body,
    lm.sender_id,
    (
      select count(*)::integer
      from public.messages m
      where m.conversation_id = c.id
        and m.deleted_at is null
        and m.sender_id is distinct from (select auth.uid())
        and (mine.last_read_at is null or m.created_at > mine.last_read_at)
    ),
    mine.last_read_at,
    mine.is_muted,
    other.user_id,
    coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'Former member'),
    p.avatar_url,
    case when other.user_id is null then null else private.user_role_label(other.user_id) end
  from mine
  join public.conversations c on c.id = mine.conversation_id
  left join public.courses co on co.id = c.course_id
  left join lateral (
    select m.body, m.sender_id
    from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select cp2.user_id
    from public.conversation_participants cp2
    where cp2.conversation_id = c.id and cp2.user_id <> (select auth.uid())
    order by cp2.joined_at
    limit 1
  ) other on true
  left join public.profiles p on p.id = other.user_id
  where coalesce(trim(p_search), '') = ''
     or coalesce(p.full_name, '') ilike '%' || trim(p_search) || '%'
     or coalesce(p.display_name, '') ilike '%' || trim(p_search) || '%'
     or coalesce(c.subject, '') ilike '%' || trim(p_search) || '%'
  order by coalesce(c.last_message_at, c.created_at) desc
  limit least(greatest(p_limit, 1), 200);
$$;
revoke execute on function public.list_my_conversations(text, integer) from public, anon;
grant execute on function public.list_my_conversations(text, integer) to authenticated;

-- Full-text search across the signed-in user's own conversations only.
create or replace function public.search_my_messages(p_query text, p_limit integer default 30)
returns table (
  message_id uuid,
  conversation_id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  created_at timestamptz,
  other_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.conversation_id,
    m.sender_id,
    coalesce(nullif(sp.display_name, ''), nullif(sp.full_name, ''), 'Former member'),
    m.body,
    m.created_at,
    (
      select coalesce(nullif(op.display_name, ''), nullif(op.full_name, ''), 'Former member')
      from public.conversation_participants o
      join public.profiles op on op.id = o.user_id
      where o.conversation_id = m.conversation_id and o.user_id <> (select auth.uid())
      limit 1
    )
  from public.messages m
  join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id and cp.user_id = (select auth.uid())
  left join public.profiles sp on sp.id = m.sender_id
  where m.deleted_at is null
    and length(trim(coalesce(p_query, ''))) >= 2
    and m.search_vector @@ websearch_to_tsquery('simple', p_query)
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function public.search_my_messages(text, integer) from public, anon;
grant execute on function public.search_my_messages(text, integer) to authenticated;

-- People the signed-in user may start a conversation with. Mirrors
-- private.can_message_user; start_direct_conversation re-checks on create.
create or replace function public.list_message_contacts(p_search text default null, p_limit integer default 30)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  role text,
  context text
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    -- instructors of courses I can currently access
    select ci.user_id, c.title as context
    from public.course_instructors ci
    join public.courses c on c.id = ci.course_id
    join public.teacher_profiles tp on tp.user_id = ci.user_id and tp.status = 'approved'
    where private.has_course_access(ci.course_id)
    union all
    -- my students (teachers)
    select e.user_id, c.title
    from public.enrollments e
    join public.course_instructors ci on ci.course_id = e.course_id and ci.user_id = (select auth.uid())
    join public.courses c on c.id = e.course_id
    where e.status in ('active', 'completed') and private.is_teacher()
    union all
    -- any approved teacher, when the platform allows it
    select tp.user_id, null
    from public.teacher_profiles tp
    where tp.status = 'approved'
      and private.setting_bool('messaging.students_can_message_any_teacher', false)
    union all
    -- administrators can reach anyone (search required to avoid listing everyone)
    select p.id, null
    from public.profiles p
    where private.is_admin() and length(trim(coalesce(p_search, ''))) >= 2
  ),
  grouped as (
    select c.user_id, string_agg(distinct c.context, ', ') as context
    from candidates c
    where c.user_id <> (select auth.uid())
    group by c.user_id
  )
  select
    g.user_id,
    coalesce(nullif(p.full_name, ''), nullif(p.display_name, ''), 'Unnamed member'),
    p.avatar_url,
    private.user_role_label(g.user_id),
    g.context
  from grouped g
  join public.profiles p on p.id = g.user_id
  join public.profile_private pp on pp.user_id = g.user_id and pp.status = 'active'
  where coalesce(trim(p_search), '') = ''
     or p.full_name ilike '%' || trim(p_search) || '%'
     or coalesce(p.display_name, '') ilike '%' || trim(p_search) || '%'
     or (private.is_admin() and pp.email ilike '%' || trim(p_search) || '%')
  order by 2
  limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function public.list_message_contacts(text, integer) from public, anon;
grant execute on function public.list_message_contacts(text, integer) to authenticated;

----------------------------------------------------------------------------
-- 4. Course members for @mention suggestions (course access required).
----------------------------------------------------------------------------

create or replace function public.course_discussion_members(p_course uuid, p_search text default null, p_limit integer default 8)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  is_instructor boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), 'Member'),
    p.avatar_url,
    exists (select 1 from public.course_instructors ci where ci.course_id = p_course and ci.user_id = p.id)
  from public.profiles p
  where private.has_course_access(p_course)
    and p.id <> (select auth.uid())
    and (
      exists (
        select 1 from public.enrollments e
        where e.course_id = p_course and e.user_id = p.id and e.status in ('active', 'completed')
      )
      or exists (select 1 from public.course_instructors ci where ci.course_id = p_course and ci.user_id = p.id)
    )
    and (
      coalesce(trim(p_search), '') = ''
      or p.full_name ilike trim(p_search) || '%'
      or p.full_name ilike '% ' || trim(p_search) || '%'
      or coalesce(p.display_name, '') ilike trim(p_search) || '%'
    )
  order by 4 desc, 2
  limit least(greatest(p_limit, 1), 20);
$$;
revoke execute on function public.course_discussion_members(uuid, text, integer) from public, anon;
grant execute on function public.course_discussion_members(uuid, text, integer) to authenticated;

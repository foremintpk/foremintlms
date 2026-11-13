-- Storage buckets, realtime publication and RPC functions.

----------------------------------------------------------------------------
-- Storage
-- Private buckets are written and read only through the server: it checks
-- permissions, then issues short-lived signed upload/download URLs.
----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif']),
  ('avatars', 'avatars', true, 5242880,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('course-content', 'course-content', false, 524288000, null),
  ('submissions', 'submissions', false, 104857600, null),
  ('attachments', 'attachments', false, 26214400, null),
  ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy "avatars: users manage their own folder (insert)" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: users manage their own folder (update)" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: users manage their own folder (delete)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

----------------------------------------------------------------------------
-- Realtime
----------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.messages,
  public.conversation_participants,
  public.notifications,
  public.course_discussions,
  public.discussion_replies,
  public.support_ticket_messages;

----------------------------------------------------------------------------
-- RPC: start (or reuse) a private conversation, enforcing who may message whom.
----------------------------------------------------------------------------

create or replace function public.start_direct_conversation(
  p_other uuid,
  p_course uuid default null,
  p_subject text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.can_message_user(p_other) then
    raise exception 'You cannot message this person' using errcode = '42501';
  end if;

  select c.id into v_id
  from public.conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = v_me)
    and exists (select 1 from public.conversation_participants where conversation_id = c.id and user_id = p_other)
    and (select count(*) from public.conversation_participants where conversation_id = c.id) = 2
  order by c.last_message_at desc nulls last
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversations (kind, course_id, subject, created_by)
  values ('direct', p_course, left(p_subject, 200), v_me)
  returning id into v_id;

  insert into public.conversation_participants (conversation_id, user_id, last_read_at)
  values (v_id, v_me, now()), (v_id, p_other, null);

  return v_id;
end;
$$;
revoke execute on function public.start_direct_conversation(uuid, uuid, text) from public, anon;
grant execute on function public.start_direct_conversation(uuid, uuid, text) to authenticated;

----------------------------------------------------------------------------
-- RPC: fixed-window rate limiting (server only).
----------------------------------------------------------------------------

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limit_buckets as b (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case when b.window_start < v_now - make_interval(secs => p_window_seconds) then 1 else b.count + 1 end,
        window_start = case when b.window_start < v_now - make_interval(secs => p_window_seconds) then v_now else b.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- (Session listing/revocation RPCs intentionally omitted: sessions are managed
-- with supabase.auth.signOut({ scope: 'others' }) and account bans.)

----------------------------------------------------------------------------
-- RPC: claim work items for background jobs (server only). SKIP LOCKED lets
-- overlapping cron runs share the queue without double-sending.
----------------------------------------------------------------------------

create or replace function public.claim_email_outbox(p_limit integer default 25)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox o
  set status = 'sending', locked_at = now(), attempts = o.attempts + 1
  where o.id in (
    select id from public.email_outbox
    where (status = 'pending' or status = 'failed')
      and attempts < max_attempts
      and next_attempt_at <= now()
    order by next_attempt_at
    limit p_limit
    for update skip locked
  )
  returning o.*;
$$;
revoke execute on function public.claim_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;

-- Emails stuck in "sending" (crashed worker) become retryable again.
create or replace function public.release_stale_email_locks(p_older_than_minutes integer default 10)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.email_outbox
  set status = 'failed', last_error = coalesce(last_error, 'Worker timed out'), locked_at = null
  where status = 'sending' and locked_at < now() - make_interval(mins => p_older_than_minutes);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.release_stale_email_locks(integer) from public, anon, authenticated;
grant execute on function public.release_stale_email_locks(integer) to service_role;

----------------------------------------------------------------------------
-- RPC: course progress recalculation (server only).
----------------------------------------------------------------------------

create or replace function public.recalculate_enrollment_progress(p_user uuid, p_course uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_done integer;
  v_percent numeric(5, 2);
begin
  select count(*) into v_total
  from public.lessons l join public.course_modules m on m.id = l.module_id
  where l.course_id = p_course and l.is_published and m.is_published;

  select count(*) into v_done
  from public.lesson_progress p
  join public.lessons l on l.id = p.lesson_id
  join public.course_modules m on m.id = l.module_id
  where p.user_id = p_user and p.course_id = p_course and p.status = 'completed'
    and l.is_published and m.is_published;

  v_percent := case when v_total = 0 then 0 else round((v_done::numeric / v_total) * 100, 2) end;

  update public.enrollments
  set progress_percent = v_percent
  where user_id = p_user and course_id = p_course;

  return v_percent;
end;
$$;
revoke execute on function public.recalculate_enrollment_progress(uuid, uuid) from public, anon, authenticated;
grant execute on function public.recalculate_enrollment_progress(uuid, uuid) to service_role;

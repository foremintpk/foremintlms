-- Access helpers. All are SECURITY DEFINER with an empty search_path, live in
-- the non-exposed `private` schema, and read tables directly (bypassing RLS),
-- which keeps policies free of recursion.

create or replace function private.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select auth.uid();
$$;

create or replace function private.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_private
    where user_id = (select auth.uid()) and status = 'active'
  );
$$;

create or replace function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profile_private p on p.user_id = r.user_id
    where r.user_id = (select auth.uid()) and r.role = p_role and p.status = 'active'
  );
$$;

create or replace function private.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::boolean from public.platform_settings where key = p_key), p_default);
$$;

-- Admins must hold an MFA-verified (aal2) session unless MFA enforcement has
-- been switched off in platform settings.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin')
    and (
      not private.setting_bool('security.require_admin_mfa', true)
      or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    );
$$;

create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('teacher') and exists (
    select 1 from public.teacher_profiles
    where user_id = (select auth.uid()) and status = 'approved'
  );
$$;

create or replace function private.is_course_instructor(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_teacher() and exists (
    select 1 from public.course_instructors
    where course_id = p_course and user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or (
    private.is_teacher() and exists (
      select 1 from public.course_instructors
      where course_id = p_course and user_id = (select auth.uid()) and can_edit
    )
  );
$$;

create or replace function private.is_course_public(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses
    where id = p_course and status = 'published' and visibility in ('public', 'unlisted')
  );
$$;

create or replace function private.has_active_entitlement(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_entitlements e
    where e.user_id = (select auth.uid())
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now())
      and (e.course_id = p_course or e.scope = 'all_access')
  ) and private.is_active_account();
$$;

-- Content access: staff of the course, or a student holding a valid
-- entitlement for a course that has been released to students.
create or replace function private.has_course_access(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or private.is_course_instructor(p_course)
    or (
      private.has_active_entitlement(p_course)
      and exists (
        select 1 from public.courses
        where id = p_course and status in ('published', 'unpublished', 'archived')
      )
    );
$$;

-- Drip/scheduled release for a learner.
create or replace function private.lesson_released_for(p_lesson uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      (l.release_at is null or l.release_at <= now())
      and (m.release_at is null or m.release_at <= now())
      and (l.release_after_days is null or (e.enrolled_at is not null and e.enrolled_at + make_interval(days => l.release_after_days) <= now()))
      and (m.release_after_days is null or (e.enrolled_at is not null and e.enrolled_at + make_interval(days => m.release_after_days) <= now()))
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    left join public.enrollments e on e.course_id = l.course_id and e.user_id = p_user
    where l.id = p_lesson
  ), false);
$$;

create or replace function private.can_view_lesson(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    where l.id = p_lesson and (
      private.is_admin()
      or private.is_course_instructor(l.course_id)
      or (l.is_preview and l.is_published and m.is_published and private.is_course_public(l.course_id))
      or (
        l.is_published and m.is_published
        and private.has_course_access(l.course_id)
        and private.lesson_released_for(l.id, (select auth.uid()))
      )
    )
  );
$$;

create or replace function private.teaches_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_teacher() and exists (
    select 1
    from public.enrollments e
    join public.course_instructors ci on ci.course_id = e.course_id
    where e.user_id = p_student and ci.user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_course(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select course_id from public.enrollments where user_id = (select auth.uid()) and status in ('active', 'completed')
    union
    select course_id from public.course_instructors where user_id = (select auth.uid())
  ), theirs as (
    select course_id from public.enrollments where user_id = p_other and status in ('active', 'completed')
    union
    select course_id from public.course_instructors where user_id = p_other
  )
  select exists (select 1 from mine join theirs using (course_id));
$$;

create or replace function private.is_conversation_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_conversation(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants a
    join public.conversation_participants b on b.conversation_id = a.conversation_id
    where a.user_id = (select auth.uid()) and b.user_id = p_other
  );
$$;

create or replace function private.can_staff_ticket(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.support_tickets t
    where t.id = p_ticket and (
      t.assigned_to = (select auth.uid())
      or (
        t.course_id is not null
        and t.category in ('course_content', 'certificate')
        and private.is_course_instructor(t.course_id)
      )
    )
  );
$$;

create or replace function private.can_access_ticket(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.support_tickets
    where id = p_ticket and requester_id = (select auth.uid())
  ) or private.can_staff_ticket(p_ticket);
$$;

create or replace function private.can_see_profile(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = (select auth.uid())
    or private.is_admin()
    or exists (select 1 from public.teacher_profiles where user_id = p_user and status = 'approved')
    or private.shares_course(p_user)
    or private.shares_conversation(p_user)
    or exists (
      select 1 from public.support_tickets t
      where (t.requester_id = (select auth.uid()) and t.assigned_to = p_user)
         or (t.assigned_to = (select auth.uid()) and t.requester_id = p_user)
    );
$$;

-- Who may start a private conversation with whom.
create or replace function private.can_message_user(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_other <> (select auth.uid())
    and exists (select 1 from public.profile_private where user_id = p_other and status = 'active')
    and (
      private.is_admin()
      -- teachers ↔ their own students
      or private.teaches_student(p_other)
      -- students → instructors of courses they can currently access
      or exists (
        select 1
        from public.course_instructors ci
        join public.teacher_profiles tp on tp.user_id = ci.user_id and tp.status = 'approved'
        where ci.user_id = p_other and private.has_course_access(ci.course_id)
      )
      -- optional platform switch: students may message any approved teacher
      or (
        private.setting_bool('messaging.students_can_message_any_teacher', false)
        and exists (select 1 from public.teacher_profiles where user_id = p_other and status = 'approved')
      )
      -- anyone may reply to an admin who is already in a conversation with them
      or (
        exists (select 1 from public.user_roles where user_id = p_other and role = 'admin')
        and private.shares_conversation(p_other)
      )
    );
$$;

grant execute on all functions in schema private to anon, authenticated, service_role;

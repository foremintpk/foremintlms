-- Row Level Security policies and privileged-column guards.
-- Convention: helper calls are wrapped in (select …) so Postgres evaluates
-- them once per statement instead of once per row.

----------------------------------------------------------------------------
-- Column guards: block non-admin users from changing privileged columns
-- even when a row-level UPDATE policy lets them edit the row. Requests from
-- the service role (auth.uid() is null) are trusted server code.
----------------------------------------------------------------------------

create or replace function private.is_trusted_writer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is null or private.is_admin();
$$;

create or replace function private.guard_profile_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_trusted_writer() and (
    new.status is distinct from old.status
    or new.suspended_reason is distinct from old.suspended_reason
    or new.email is distinct from old.email
    or new.user_id is distinct from old.user_id
    or new.last_sign_in_at is distinct from old.last_sign_in_at
  ) then
    raise exception 'Not allowed to change account status or email here' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profile_private_guard before update on public.profile_private
  for each row execute function private.guard_profile_private();

create or replace function private.guard_teacher_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_trusted_writer() and (
    new.status is distinct from old.status
    or new.is_featured is distinct from old.is_featured
    or new.can_create_courses is distinct from old.can_create_courses
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.sort_order is distinct from old.sort_order
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Only administrators can change teacher approval settings' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger teacher_profiles_guard before update on public.teacher_profiles
  for each row execute function private.guard_teacher_profile();

-- Teachers can save drafts and submit for review; only admins publish.
create or replace function private.guard_course()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_writer() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft') or new.is_featured or new.published_at is not null then
      raise exception 'New courses start as drafts' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and not (
    (old.status in ('draft', 'unpublished') and new.status = 'in_review')
    or (old.status = 'in_review' and new.status = 'draft')
  ) then
    raise exception 'Course publication requires administrator approval' using errcode = '42501';
  end if;
  if new.is_featured is distinct from old.is_featured
    or new.sort_order is distinct from old.sort_order
    or new.published_at is distinct from old.published_at
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.review_notes is distinct from old.review_notes
    or new.slug is distinct from old.slug and old.status = 'published'
  then
    raise exception 'Not allowed to change these course settings' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger courses_guard before insert or update on public.courses
  for each row execute function private.guard_course();

-- A teacher who creates a course becomes its lead instructor.
create or replace function private.add_creator_as_instructor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null and exists (
    select 1 from public.user_roles where user_id = new.created_by and role = 'teacher'
  ) then
    insert into public.course_instructors (course_id, user_id, role, can_edit)
    values (new.id, new.created_by, 'lead', true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger courses_add_creator after insert on public.courses
  for each row execute function private.add_creator_as_instructor();

create or replace function private.guard_discussion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.is_trusted_writer() or private.is_course_instructor(coalesce(new.course_id, old.course_id));
begin
  if v_staff then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.is_pinned or new.is_locked or new.kind = 'announcement' or new.status <> 'visible' or new.reply_count <> 0 then
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
  then
    raise exception 'Only course staff can moderate discussions' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger course_discussions_guard before insert or update on public.course_discussions
  for each row execute function private.guard_discussion();

create or replace function private.guard_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.is_trusted_writer() or private.is_course_instructor(coalesce(new.course_id, old.course_id));
  v_discussion_author uuid;
begin
  if v_staff then
    if tg_op = 'INSERT' and (select auth.uid()) is not null then
      new.is_instructor_answer := private.is_admin() or private.is_course_instructor(new.course_id);
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.is_instructor_answer or new.is_accepted_answer or new.status <> 'visible' then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    return new;
  end if;
  select author_id into v_discussion_author from public.course_discussions where id = new.discussion_id;
  if new.is_accepted_answer is distinct from old.is_accepted_answer
     and v_discussion_author is distinct from (select auth.uid()) then
    raise exception 'Only the question author can accept an answer' using errcode = '42501';
  end if;
  if new.is_instructor_answer is distinct from old.is_instructor_answer
    or new.status is distinct from old.status
    or new.author_id is distinct from old.author_id
    or new.discussion_id is distinct from old.discussion_id
  then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger discussion_replies_guard before insert or update on public.discussion_replies
  for each row execute function private.guard_reply();

-- Reviews: verification flag is computed, moderation is staff-only and an
-- edited review goes back to moderation.
create or replace function private.guard_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_writer() then
    return new;
  end if;
  new.verified_enrollment := exists (
    select 1 from public.enrollments
    where user_id = new.user_id and course_id = new.course_id
  );
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.moderated_by := null;
    new.moderated_at := null;
  else
    if new.rating is distinct from old.rating or new.title is distinct from old.title or new.body is distinct from old.body then
      new.status := 'pending';
    elsif new.status is distinct from old.status then
      raise exception 'Only administrators moderate reviews' using errcode = '42501';
    end if;
    new.moderated_by := old.moderated_by;
    new.moderated_at := old.moderated_at;
  end if;
  return new;
end;
$$;
create trigger course_reviews_guard before insert or update on public.course_reviews
  for each row execute function private.guard_review();

create or replace function private.guard_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_writer() then
    return new;
  end if;
  if new.conversation_id is distinct from old.conversation_id or new.sender_id is distinct from old.sender_id or new.created_at is distinct from old.created_at then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
create trigger messages_guard before update on public.messages
  for each row execute function private.guard_message();

create or replace function private.guard_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_writer() then
    return new;
  end if;
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'Only read status can be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger notifications_guard before update on public.notifications
  for each row execute function private.guard_notification();

create or replace function private.guard_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_writer() then
    return new;
  end if;
  if new.conversation_id is distinct from old.conversation_id or new.user_id is distinct from old.user_id or new.joined_at is distinct from old.joined_at then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger conversation_participants_guard before update on public.conversation_participants
  for each row execute function private.guard_participant();

create or replace function private.guard_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_trusted_writer() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'open';
    new.assigned_to := null;
    new.resolved_at := null;
    new.closed_at := null;
    if new.priority = 'urgent' then
      new.priority := 'high';
    end if;
    return new;
  end if;
  -- Course staff may update workflow fields; nobody but admins reassigns away
  -- from themselves or changes the requester.
  if new.requester_id is distinct from old.requester_id or new.ticket_number is distinct from old.ticket_number then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is distinct from (select auth.uid()) then
    raise exception 'Only administrators can assign tickets to others' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger support_tickets_guard before insert or update on public.support_tickets
  for each row execute function private.guard_ticket();

----------------------------------------------------------------------------
-- Identity
----------------------------------------------------------------------------

create policy "profiles: visible within shared context" on public.profiles
  for select to authenticated using ((select private.can_see_profile(id)));
create policy "profiles: owner updates" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admin updates" on public.profiles
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "profile_private: owner, admin or instructor reads" on public.profile_private
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.is_admin()) or (select private.teaches_student(user_id))
  );
create policy "profile_private: owner updates" on public.profile_private
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "profile_private: admin updates" on public.profile_private
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "user_roles: owner or admin reads" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "user_roles: admin manages" on public.user_roles
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "teacher_profiles: public when approved" on public.teacher_profiles
  for select to anon, authenticated using (
    (status = 'approved' and is_public) or user_id = (select auth.uid()) or (select private.is_admin())
  );
create policy "teacher_profiles: owner updates" on public.teacher_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "teacher_profiles: admin manages" on public.teacher_profiles
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "user_preferences: owner manages" on public.user_preferences
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "account_invitations: admin manages" on public.account_invitations
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "auth_events: owner or admin reads" on public.auth_events
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));

----------------------------------------------------------------------------
-- Catalog
----------------------------------------------------------------------------

create policy "course_categories: published are public" on public.course_categories
  for select to anon, authenticated using (status = 'published' or (select private.is_admin()) or (select private.is_teacher()));
create policy "course_categories: admin manages" on public.course_categories
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "courses: public, staff or entitled" on public.courses
  for select to anon, authenticated using (
    (status = 'published' and visibility in ('public', 'unlisted'))
    or (select private.has_course_access(id))
  );
create policy "courses: admin or permitted teacher creates" on public.courses
  for insert to authenticated with check (
    (select private.is_admin())
    or (
      (select private.is_teacher())
      and created_by = (select auth.uid())
      and exists (select 1 from public.teacher_profiles where user_id = (select auth.uid()) and can_create_courses)
    )
  );
create policy "courses: editors update" on public.courses
  for update to authenticated using ((select private.can_edit_course(id))) with check ((select private.can_edit_course(id)));
create policy "courses: admin deletes" on public.courses
  for delete to authenticated using ((select private.is_admin()));

create policy "course_instructors: visible with course" on public.course_instructors
  for select to anon, authenticated using (
    (select private.is_course_public(course_id)) or (select private.has_course_access(course_id)) or user_id = (select auth.uid())
  );
create policy "course_instructors: admin manages" on public.course_instructors
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "learning_paths: published are public" on public.learning_paths
  for select to anon, authenticated using (status = 'published' or (select private.is_admin()));
create policy "learning_paths: admin manages" on public.learning_paths
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "learning_path_courses: visible with path" on public.learning_path_courses
  for select to anon, authenticated using (
    exists (select 1 from public.learning_paths p where p.id = learning_path_id and p.status = 'published')
    or (select private.is_admin())
  );
create policy "learning_path_courses: admin manages" on public.learning_path_courses
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Curriculum outline (module and lesson titles) is public for published
-- courses; lesson content lives in content blocks with stricter rules.
create policy "course_modules: outline visibility" on public.course_modules
  for select to anon, authenticated using (
    (is_published and (select private.is_course_public(course_id))) or (select private.has_course_access(course_id))
  );
create policy "course_modules: editors manage" on public.course_modules
  for all to authenticated using ((select private.can_edit_course(course_id))) with check ((select private.can_edit_course(course_id)));

create policy "lessons: outline visibility" on public.lessons
  for select to anon, authenticated using (
    (is_published and (select private.is_course_public(course_id))) or (select private.has_course_access(course_id))
  );
create policy "lessons: editors manage" on public.lessons
  for all to authenticated using ((select private.can_edit_course(course_id))) with check ((select private.can_edit_course(course_id)));

create policy "lesson_content_blocks: lesson viewers read" on public.lesson_content_blocks
  for select to anon, authenticated using ((select private.can_view_lesson(lesson_id)));
create policy "lesson_content_blocks: editors manage" on public.lesson_content_blocks
  for all to authenticated using ((select private.can_edit_course(course_id))) with check ((select private.can_edit_course(course_id)));

create policy "lesson_resources: lesson viewers read" on public.lesson_resources
  for select to authenticated using (
    case when lesson_id is null then (select private.has_course_access(course_id))
         else (select private.can_view_lesson(lesson_id)) end
  );
create policy "lesson_resources: editors manage" on public.lesson_resources
  for all to authenticated using ((select private.can_edit_course(course_id))) with check ((select private.can_edit_course(course_id)));

create policy "media_files: uploader or course editor reads" on public.media_files
  for select to authenticated using (
    uploaded_by = (select auth.uid())
    or (select private.is_admin())
    or (course_id is not null and (select private.can_edit_course(course_id)))
  );
create policy "media_files: editors delete" on public.media_files
  for delete to authenticated using (
    (select private.is_admin()) or (course_id is not null and (select private.can_edit_course(course_id)))
  );

create policy "video_assets: course editors read" on public.video_assets
  for select to authenticated using (
    (select private.is_admin())
    or created_by = (select auth.uid())
    or (course_id is not null and (select private.can_edit_course(course_id)))
  );
create policy "video_assets: course editors manage" on public.video_assets
  for all to authenticated using (
    (select private.is_admin()) or (course_id is not null and (select private.can_edit_course(course_id)))
  ) with check (
    (select private.is_admin()) or (course_id is not null and (select private.can_edit_course(course_id)))
  );

create policy "course_reviews: published are public" on public.course_reviews
  for select to anon, authenticated using (
    status = 'published' or user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );
create policy "course_reviews: enrolled students write their own" on public.course_reviews
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.enrollments e where e.user_id = (select auth.uid()) and e.course_id = course_reviews.course_id)
  );
create policy "course_reviews: owner edits" on public.course_reviews
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "course_reviews: admin moderates" on public.course_reviews
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "course_reviews: owner deletes" on public.course_reviews
  for delete to authenticated using (user_id = (select auth.uid()));

----------------------------------------------------------------------------
-- Commerce (writes happen only in trusted server code)
----------------------------------------------------------------------------

create policy "products: active are public" on public.products
  for select to anon, authenticated using (status = 'active' or (select private.is_admin()));
create policy "products: admin manages" on public.products
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "product_courses: visible with product" on public.product_courses
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'active') or (select private.is_admin())
  );
create policy "product_courses: admin manages" on public.product_courses
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "pricing_plans: public plans are public" on public.pricing_plans
  for select to anon, authenticated using (visibility = 'public' or (select private.is_admin()));
create policy "pricing_plans: admin manages" on public.pricing_plans
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "course_bundles: public" on public.course_bundles
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'active') or (select private.is_admin())
  );
create policy "course_bundles: admin manages" on public.course_bundles
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "coupons: admin manages" on public.coupons
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "whop_customers: owner or admin reads" on public.whop_customers
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "checkout_sessions: owner or admin reads" on public.checkout_sessions
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "subscription_records: owner or admin reads" on public.subscription_records
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "payment_transactions: owner or admin reads" on public.payment_transactions
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "billing_documents: owner or admin reads" on public.billing_documents
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "webhook_events: admin reads" on public.webhook_events
  for select to authenticated using ((select private.is_admin()));
create policy "payment_reconciliation_logs: admin reads" on public.payment_reconciliation_logs
  for select to authenticated using ((select private.is_admin()));

----------------------------------------------------------------------------
-- Learning
----------------------------------------------------------------------------

create policy "enrollments: owner, admin or instructor reads" on public.enrollments
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );

create policy "course_entitlements: owner, admin or instructor reads" on public.course_entitlements
  for select to authenticated using (
    user_id = (select auth.uid())
    or (select private.is_admin())
    or (course_id is not null and (select private.is_course_instructor(course_id)))
  );

create policy "lesson_progress: owner, admin or instructor reads" on public.lesson_progress
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );

create policy "bookmarks: owner reads" on public.bookmarks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "bookmarks: owner creates on viewable lessons" on public.bookmarks
  for insert to authenticated with check (user_id = (select auth.uid()) and (select private.can_view_lesson(lesson_id)));
create policy "bookmarks: owner deletes" on public.bookmarks
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "student_notes: owner reads" on public.student_notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "student_notes: owner creates on viewable lessons" on public.student_notes
  for insert to authenticated with check (user_id = (select auth.uid()) and (select private.can_view_lesson(lesson_id)));
create policy "student_notes: owner updates" on public.student_notes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "student_notes: owner deletes" on public.student_notes
  for delete to authenticated using (user_id = (select auth.uid()));

----------------------------------------------------------------------------
-- Assessment (students receive questions through the server, which strips
-- answer keys; they never read question/option tables directly)
----------------------------------------------------------------------------

create policy "question_banks: course editors" on public.question_banks
  for all to authenticated using ((select private.can_edit_course(course_id))) with check ((select private.can_edit_course(course_id)));

create policy "quizzes: learners see published, editors see all" on public.quizzes
  for select to authenticated using (
    (status = 'published' and (select private.has_course_access(course_id))) or (select private.can_edit_course(course_id))
  );
create policy "quizzes: course editors manage" on public.quizzes
  for all to authenticated using ((select private.can_edit_course(course_id))) with check ((select private.can_edit_course(course_id)));

create policy "quiz_questions: course editors" on public.quiz_questions
  for all to authenticated using ((select private.can_edit_course(course_id))) with check ((select private.can_edit_course(course_id)));

create policy "quiz_options: course editors" on public.quiz_options
  for all to authenticated using (
    exists (select 1 from public.quiz_questions q where q.id = question_id and (select private.can_edit_course(q.course_id)))
  ) with check (
    exists (select 1 from public.quiz_questions q where q.id = question_id and (select private.can_edit_course(q.course_id)))
  );

create policy "quiz_attempts: owner or course staff reads" on public.quiz_attempts
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );

create policy "quiz_answers: owner or course staff reads" on public.quiz_answers
  for select to authenticated using (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = attempt_id
        and (a.user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(a.course_id)))
    )
  );

create policy "assignments: learners see published, editors see all" on public.assignments
  for select to authenticated using (
    (status = 'published' and (select private.has_course_access(course_id))) or (select private.can_edit_course(course_id))
  );
create policy "assignments: course editors manage" on public.assignments
  for all to authenticated using ((select private.can_edit_course(course_id))) with check ((select private.can_edit_course(course_id)));

create policy "assignment_submissions: owner or course staff reads" on public.assignment_submissions
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );
create policy "assignment_submissions: course staff grades" on public.assignment_submissions
  for update to authenticated using (
    (select private.is_admin()) or (select private.is_course_instructor(course_id))
  ) with check (
    (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );

create policy "assignment_feedback: owner or course staff reads" on public.assignment_feedback
  for select to authenticated using (
    exists (
      select 1 from public.assignment_submissions s
      where s.id = submission_id
        and (s.user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(s.course_id)))
    )
  );
create policy "assignment_feedback: course staff writes" on public.assignment_feedback
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.assignment_submissions s
      where s.id = submission_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id)))
    )
  );

create policy "certificates: owner or course staff reads" on public.certificates
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );
create policy "certificate_verifications: admin reads" on public.certificate_verifications
  for select to authenticated using ((select private.is_admin()));

----------------------------------------------------------------------------
-- Live learning
----------------------------------------------------------------------------

-- Connection rows hold encrypted tokens; owners may read status metadata
-- only (column privileges below), writes happen in server code.
create policy "meeting_provider_connections: owner or admin reads" on public.meeting_provider_connections
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "meeting_provider_connections: owner disconnects" on public.meeting_provider_connections
  for delete to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "live_sessions: course members read" on public.live_sessions
  for select to authenticated using ((select private.has_course_access(course_id)));
create policy "live_sessions: course staff manage" on public.live_sessions
  for all to authenticated using (
    (select private.is_admin()) or (select private.is_course_instructor(course_id))
  ) with check (
    (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );

create policy "live_session_attendees: owner or staff reads" on public.live_session_attendees
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.live_sessions s where s.id = session_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id))))
  );
create policy "live_session_attendees: owner rsvps" on public.live_session_attendees
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "live_session_attendance: owner or staff reads" on public.live_session_attendance
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.live_sessions s where s.id = session_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id))))
  );
create policy "live_session_attendance: staff records" on public.live_session_attendance
  for all to authenticated using (
    exists (select 1 from public.live_sessions s where s.id = session_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id))))
  ) with check (
    exists (select 1 from public.live_sessions s where s.id = session_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id))))
  );

create policy "meeting_recordings: course members read visible" on public.meeting_recordings
  for select to authenticated using (
    exists (
      select 1 from public.live_sessions s where s.id = session_id and (
        (is_visible and (select private.has_course_access(s.course_id)))
        or (select private.is_admin()) or (select private.is_course_instructor(s.course_id))
      )
    )
  );
create policy "meeting_recordings: staff manage" on public.meeting_recordings
  for all to authenticated using (
    exists (select 1 from public.live_sessions s where s.id = session_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id))))
  ) with check (
    exists (select 1 from public.live_sessions s where s.id = session_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id))))
  );

create policy "live_session_resources: course members read" on public.live_session_resources
  for select to authenticated using (
    exists (select 1 from public.live_sessions s where s.id = session_id and (select private.has_course_access(s.course_id)))
  );
create policy "live_session_resources: staff manage" on public.live_session_resources
  for all to authenticated using (
    exists (select 1 from public.live_sessions s where s.id = session_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id))))
  ) with check (
    exists (select 1 from public.live_sessions s where s.id = session_id and ((select private.is_admin()) or (select private.is_course_instructor(s.course_id))))
  );

----------------------------------------------------------------------------
-- Communication
----------------------------------------------------------------------------

create policy "conversations: participants read" on public.conversations
  for select to authenticated using ((select private.is_conversation_participant(id)) or (select private.is_admin()));

create policy "conversation_participants: co-participants read" on public.conversation_participants
  for select to authenticated using ((select private.is_conversation_participant(conversation_id)) or (select private.is_admin()));
create policy "conversation_participants: owner updates read state" on public.conversation_participants
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "messages: participants read" on public.messages
  for select to authenticated using ((select private.is_conversation_participant(conversation_id)) or (select private.is_admin()));
create policy "messages: participants send" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and (select private.is_conversation_participant(conversation_id))
  );
create policy "messages: sender edits" on public.messages
  for update to authenticated using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));

create policy "message_attachments: participants read" on public.message_attachments
  for select to authenticated using (
    exists (select 1 from public.messages m where m.id = message_id and ((select private.is_conversation_participant(m.conversation_id)) or (select private.is_admin())))
  );

create policy "course_discussions: course members read" on public.course_discussions
  for select to authenticated using (
    (select private.is_admin())
    or (select private.is_course_instructor(course_id))
    or ((select private.has_course_access(course_id)) and (status = 'visible' or author_id = (select auth.uid())))
  );
create policy "course_discussions: course members post" on public.course_discussions
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and (select private.has_course_access(course_id))
    and exists (select 1 from public.courses c where c.id = course_id and c.discussions_enabled)
  );
create policy "course_discussions: author or staff updates" on public.course_discussions
  for update to authenticated using (
    author_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  ) with check (
    (select private.has_course_access(course_id))
  );
create policy "course_discussions: author or staff deletes" on public.course_discussions
  for delete to authenticated using (
    author_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );

create policy "discussion_replies: course members read" on public.discussion_replies
  for select to authenticated using (
    (select private.is_admin())
    or (select private.is_course_instructor(course_id))
    or ((select private.has_course_access(course_id)) and (status = 'visible' or author_id = (select auth.uid())))
  );
create policy "discussion_replies: course members reply" on public.discussion_replies
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and (select private.has_course_access(course_id))
    and exists (
      select 1 from public.course_discussions d
      where d.id = discussion_id and d.course_id = discussion_replies.course_id and d.status = 'visible'
        and (not d.is_locked or (select private.is_admin()) or (select private.is_course_instructor(d.course_id)))
    )
  );
create policy "discussion_replies: author or staff updates" on public.discussion_replies
  for update to authenticated using (
    author_id = (select auth.uid())
    or (select private.is_admin())
    or (select private.is_course_instructor(course_id))
    or exists (select 1 from public.course_discussions d where d.id = discussion_id and d.author_id = (select auth.uid()))
  ) with check ((select private.has_course_access(course_id)));
create policy "discussion_replies: author or staff deletes" on public.discussion_replies
  for delete to authenticated using (
    author_id = (select auth.uid()) or (select private.is_admin()) or (select private.is_course_instructor(course_id))
  );

create policy "discussion_reactions: course members read" on public.discussion_reactions
  for select to authenticated using ((select private.has_course_access(course_id)));
create policy "discussion_reactions: course members react" on public.discussion_reactions
  for insert to authenticated with check (user_id = (select auth.uid()) and (select private.has_course_access(course_id)));
create policy "discussion_reactions: owner removes" on public.discussion_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "content_reports: reporter creates" on public.content_reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "content_reports: reporter or moderators read" on public.content_reports
  for select to authenticated using (
    reporter_id = (select auth.uid())
    or (select private.is_admin())
    or (course_id is not null and (select private.is_course_instructor(course_id)))
  );
create policy "content_reports: moderators resolve" on public.content_reports
  for update to authenticated using (
    (select private.is_admin()) or (course_id is not null and (select private.is_course_instructor(course_id)))
  ) with check (
    (select private.is_admin()) or (course_id is not null and (select private.is_course_instructor(course_id)))
  );

create policy "support_tickets: requester or staff reads" on public.support_tickets
  for select to authenticated using ((select private.can_access_ticket(id)));
create policy "support_tickets: requester opens" on public.support_tickets
  for insert to authenticated with check (requester_id = (select auth.uid()));
create policy "support_tickets: staff updates" on public.support_tickets
  for update to authenticated using ((select private.can_staff_ticket(id))) with check ((select private.can_staff_ticket(id)));

create policy "support_ticket_messages: visible to ticket members" on public.support_ticket_messages
  for select to authenticated using (
    (select private.can_staff_ticket(ticket_id)) or (not is_internal and (select private.can_access_ticket(ticket_id)))
  );
create policy "support_ticket_messages: ticket members reply" on public.support_ticket_messages
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and (select private.can_access_ticket(ticket_id))
    and (not is_internal or (select private.can_staff_ticket(ticket_id)))
  );

create policy "support_ticket_attachments: ticket members read" on public.support_ticket_attachments
  for select to authenticated using (
    (select private.can_staff_ticket(ticket_id))
    or (
      (select private.can_access_ticket(ticket_id))
      and (message_id is null or exists (select 1 from public.support_ticket_messages m where m.id = message_id and not m.is_internal))
    )
  );

----------------------------------------------------------------------------
-- Marketing & content
----------------------------------------------------------------------------

create policy "cms_pages: published are public" on public.cms_pages
  for select to anon, authenticated using (status = 'published' or (select private.is_admin()));
create policy "cms_pages: admin manages" on public.cms_pages
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "cms_sections: visible are public" on public.cms_sections
  for select to anon, authenticated using (
    (is_visible and exists (select 1 from public.cms_pages p where p.id = page_id and p.status = 'published')) or (select private.is_admin())
  );
create policy "cms_sections: admin manages" on public.cms_sections
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "testimonials: published are public" on public.testimonials
  for select to anon, authenticated using (status = 'published' or (select private.is_admin()));
create policy "testimonials: admin manages" on public.testimonials
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "case_studies: published are public" on public.case_studies
  for select to anon, authenticated using (status = 'published' or (select private.is_admin()));
create policy "case_studies: admin manages" on public.case_studies
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "blog_posts: published are public" on public.blog_posts
  for select to anon, authenticated using ((status = 'published' and published_at <= now()) or (select private.is_admin()));
create policy "blog_posts: admin manages" on public.blog_posts
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "faqs: published are public" on public.faqs
  for select to anon, authenticated using (is_published or (select private.is_admin()));
create policy "faqs: admin manages" on public.faqs
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "newsletter_subscriptions: admin reads" on public.newsletter_subscriptions
  for select to authenticated using ((select private.is_admin()));
create policy "newsletter_subscriptions: admin manages" on public.newsletter_subscriptions
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "marketing_leads: admin manages" on public.marketing_leads
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "announcements: audience reads" on public.announcements
  for select to authenticated using (
    (select private.is_admin())
    or (
      published_at is not null and published_at <= now() and (
        audience = 'all'
        or (audience = 'students' and (select private.has_role('student')))
        or (audience = 'teachers' and (select private.is_teacher()))
        or (audience = 'course' and (select private.has_course_access(course_id)))
      )
    )
  );
create policy "announcements: admin manages" on public.announcements
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "announcements: instructors post to their courses" on public.announcements
  for insert to authenticated with check (
    audience = 'course' and created_by = (select auth.uid()) and (select private.is_course_instructor(course_id))
  );

----------------------------------------------------------------------------
-- Notifications & email
----------------------------------------------------------------------------

create policy "notifications: owner reads" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: owner marks read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: owner deletes" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "notification_preferences: owner manages" on public.notification_preferences
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "email_templates: admin manages" on public.email_templates
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "email_outbox: admin reads" on public.email_outbox
  for select to authenticated using ((select private.is_admin()));
create policy "email_delivery_events: admin reads" on public.email_delivery_events
  for select to authenticated using ((select private.is_admin()));

----------------------------------------------------------------------------
-- Administration
----------------------------------------------------------------------------

create policy "platform_settings: public keys readable" on public.platform_settings
  for select to anon, authenticated using (is_public or (select private.is_admin()));
create policy "platform_settings: admin manages" on public.platform_settings
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- integration_settings and rate_limit_buckets: no client policies at all.

create policy "legal_documents: public" on public.legal_documents
  for select to anon, authenticated using (true);
create policy "legal_documents: admin manages" on public.legal_documents
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "legal_document_versions: published are public" on public.legal_document_versions
  for select to anon, authenticated using (status in ('published', 'superseded') or (select private.is_admin()));
create policy "legal_document_versions: admin manages" on public.legal_document_versions
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "audit_logs: admin reads" on public.audit_logs
  for select to authenticated using ((select private.is_admin()));

----------------------------------------------------------------------------
-- Column privileges for token-bearing rows
----------------------------------------------------------------------------

revoke select on public.meeting_provider_connections from anon, authenticated;
grant select (id, user_id, provider, account_email, external_account_id, token_expires_at, scopes, status, last_error, created_at, updated_at)
  on public.meeting_provider_connections to authenticated;

revoke all on public.integration_settings from anon, authenticated;
revoke all on public.rate_limit_buckets from anon, authenticated;

-- ============================================================================
-- Foremint Academy — Row Level Security test suite
--
-- Runs entirely inside one transaction and ALWAYS rolls back: it ends by
-- raising RLS_SUITE_PASSED (success) or the first failing assertion's
-- message. Nothing it creates is ever committed.
--
-- Run with the Supabase MCP `execute_sql` tool, psql, or the SQL editor.
-- Covers spec §26 "Critical security tests" at the database layer.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as the table owner; triggers create profiles + student roles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'rls-admin@test.invalid',   '{"full_name":"RLS Admin"}',    'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'rls-teacher1@test.invalid','{"full_name":"RLS Teacher1"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000003', 'rls-teacher2@test.invalid','{"full_name":"RLS Teacher2"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000004', 'rls-student1@test.invalid','{"full_name":"RLS Student1"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000005', 'rls-student2@test.invalid','{"full_name":"RLS Student2"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000006', 'rls-expired@test.invalid', '{"full_name":"RLS Expired"}',  'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000007', 'rls-revoked@test.invalid', '{"full_name":"RLS Revoked"}',  'authenticated', 'authenticated');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-a000-000000000001', 'admin'),
  ('00000000-0000-4000-a000-000000000002', 'teacher'),
  ('00000000-0000-4000-a000-000000000003', 'teacher');

insert into public.teacher_profiles (user_id, slug, public_name, status, is_public) values
  ('00000000-0000-4000-a000-000000000002', 'rls-teacher-one', 'RLS Teacher One', 'approved', true),
  ('00000000-0000-4000-a000-000000000003', 'rls-teacher-two', 'RLS Teacher Two', 'approved', true);

insert into public.courses (id, slug, title, status, visibility) values
  ('00000000-0000-4000-b000-000000000001', 'rls-course-one',   'RLS Course One (published)', 'published', 'public'),
  ('00000000-0000-4000-b000-000000000002', 'rls-course-two',   'RLS Course Two (published)', 'published', 'public'),
  ('00000000-0000-4000-b000-000000000003', 'rls-course-three', 'RLS Course Three (draft)',   'draft',     'public');

insert into public.course_instructors (course_id, user_id) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000002'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000003');

insert into public.course_modules (id, course_id, title) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'Module 1'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000002', 'Module 2'),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000003', 'Module 3');

insert into public.lessons (id, course_id, module_id, title, is_preview) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001', 'Preview lesson', true),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001', 'Paid lesson', false),
  ('00000000-0000-4000-d000-000000000003', '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-c000-000000000003', 'Draft-course lesson', false),
  ('00000000-0000-4000-d000-000000000004', '00000000-0000-4000-b000-000000000002', '00000000-0000-4000-c000-000000000002', 'Other course lesson', false);

insert into public.lesson_content_blocks (id, lesson_id, course_id, block_type, data) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-b000-000000000001', 'rich_text', '{"html":"preview"}'),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-b000-000000000001', 'rich_text', '{"html":"paid"}'),
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-d000-000000000003', '00000000-0000-4000-b000-000000000003', 'rich_text', '{"html":"draft"}'),
  ('00000000-0000-4000-e000-000000000004', '00000000-0000-4000-d000-000000000004', '00000000-0000-4000-b000-000000000002', 'rich_text', '{"html":"other"}');

insert into public.enrollments (user_id, course_id, source) values
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-b000-000000000001', 'purchase'),
  ('00000000-0000-4000-a000-000000000006', '00000000-0000-4000-b000-000000000001', 'purchase'),
  ('00000000-0000-4000-a000-000000000007', '00000000-0000-4000-b000-000000000001', 'purchase'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000002', 'purchase');

insert into public.course_entitlements (user_id, scope, course_id, source, status, starts_at, expires_at, revoked_at, revoke_reason) values
  ('00000000-0000-4000-a000-000000000004', 'course', '00000000-0000-4000-b000-000000000001', 'purchase', 'active',  now() - interval '1 day',  null, null, null),
  ('00000000-0000-4000-a000-000000000006', 'course', '00000000-0000-4000-b000-000000000001', 'purchase', 'active',  now() - interval '40 days', now() - interval '1 day', null, null),
  ('00000000-0000-4000-a000-000000000007', 'course', '00000000-0000-4000-b000-000000000001', 'purchase', 'revoked', now() - interval '5 days', null, now(), 'refund'),
  ('00000000-0000-4000-a000-000000000005', 'course', '00000000-0000-4000-b000-000000000002', 'purchase', 'active',  now() - interval '1 day',  null, null, null);

insert into public.quizzes (id, course_id, title, status) values
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-b000-000000000001', 'Quiz', 'published');
insert into public.quiz_questions (id, course_id, quiz_id, question_type, prompt) values
  ('00000000-0000-4000-f000-000000000011', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-f000-000000000001', 'single_choice', 'Q?');
insert into public.quiz_options (question_id, label, is_correct) values
  ('00000000-0000-4000-f000-000000000011', 'Right', true),
  ('00000000-0000-4000-f000-000000000011', 'Wrong', false);

insert into public.payment_transactions (whop_payment_id, user_id, status, total_cents) values
  ('rls_pay_s1', '00000000-0000-4000-a000-000000000004', 'succeeded', 4900),
  ('rls_pay_s2', '00000000-0000-4000-a000-000000000005', 'succeeded', 9900);

insert into public.lesson_progress (user_id, lesson_id, course_id) values
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-b000-000000000001'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-d000-000000000004', '00000000-0000-4000-b000-000000000002');

insert into public.student_notes (user_id, lesson_id, course_id, body) values
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-d000-000000000004', '00000000-0000-4000-b000-000000000002', 'S2 private note');

insert into public.conversations (id, kind, created_by) values
  ('00000000-0000-4000-9000-000000000001', 'direct', '00000000-0000-4000-a000-000000000005');
insert into public.conversation_participants (conversation_id, user_id) values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-a000-000000000005'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-a000-000000000003');
insert into public.messages (conversation_id, sender_id, body) values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-a000-000000000005', 'Private between S2 and T2');

insert into public.support_tickets (id, requester_id, subject, description, category, course_id) values
  ('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-a000-000000000004', 'S1 billing', 'help', 'billing', null),
  ('00000000-0000-4000-9000-000000000012', '00000000-0000-4000-a000-000000000005', 'S2 content', 'help', 'course_content', '00000000-0000-4000-b000-000000000002');

insert into public.audit_logs (action, entity_type, summary) values ('rls.test', 'test', 'fixture');

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  assert (select count(*) from public.courses where id = '00000000-0000-4000-b000-000000000001') = 1, 'anon: published course must be visible';
  assert (select count(*) from public.courses where id = '00000000-0000-4000-b000-000000000003') = 0, 'anon: draft course must be hidden';
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000001') = 1, 'anon: preview lesson content must be visible';
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000002') = 0, 'anon: paid lesson content must be hidden';
  assert (select count(*) from public.profiles) = 0, 'anon: profiles must be hidden';
  assert (select count(*) from public.quiz_options) = 0, 'anon: quiz answer keys must be hidden';
  assert (select count(*) from public.payment_transactions) = 0, 'anon: payments must be hidden';
  begin
    perform 1 from public.integration_settings;
    raise exception 'anon: integration_settings must not be readable';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Student 1 — entitled to course one
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated","aal":"aal1"}', true);
do $$
declare
  v_conv uuid;
begin
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000002') = 1, 'S1: entitled lesson content must be visible';
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000003') = 0, 'S1: unpublished course content must be hidden';
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000004') = 0, 'S1: content of a course without entitlement must be hidden';
  assert (select count(*) from public.enrollments where user_id = '00000000-0000-4000-a000-000000000005') = 0, 'S1: another student''s enrollments must be hidden';
  assert (select count(*) from public.enrollments where user_id = '00000000-0000-4000-a000-000000000004') = 1, 'S1: own enrollment must be visible';
  assert (select count(*) from public.lesson_progress where user_id <> '00000000-0000-4000-a000-000000000004') = 0, 'S1: others'' progress must be hidden';
  assert (select count(*) from public.student_notes) = 0, 'S1: another student''s notes must be hidden';
  assert (select count(*) from public.payment_transactions where user_id <> '00000000-0000-4000-a000-000000000004') = 0, 'S1: others'' payments must be hidden';
  assert (select count(*) from public.payment_transactions) = 1, 'S1: own payment must be visible';
  assert (select count(*) from public.quiz_options) = 0, 'S1: quiz answer keys must be hidden from students';
  assert (select count(*) from public.quiz_questions) = 0, 'S1: quiz questions must only come through the server';
  assert (select count(*) from public.profile_private where user_id = '00000000-0000-4000-a000-000000000005') = 0, 'S1: another student''s private details must be hidden';
  assert (select count(*) from public.profile_private where user_id = '00000000-0000-4000-a000-000000000004') = 1, 'S1: own private details must be visible';
  assert (select count(*) from public.messages) = 0, 'S1: other people''s conversations must be hidden';
  assert (select count(*) from public.support_tickets where id = '00000000-0000-4000-9000-000000000012') = 0, 'S1: another student''s ticket must be hidden';
  assert (select count(*) from public.support_tickets where id = '00000000-0000-4000-9000-000000000011') = 1, 'S1: own ticket must be visible';
  assert (select count(*) from public.audit_logs) = 0, 'S1: audit logs must be hidden';

  begin
    insert into public.course_entitlements (user_id, scope, course_id, source) values
      ('00000000-0000-4000-a000-000000000004', 'course', '00000000-0000-4000-b000-000000000002', 'purchase');
    raise exception 'S1: was able to grant itself an entitlement';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.enrollments (user_id, course_id, source) values
      ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-b000-000000000002', 'manual');
    raise exception 'S1: was able to create its own enrollment';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.payment_transactions (whop_payment_id, user_id, status) values ('forged', '00000000-0000-4000-a000-000000000004', 'succeeded');
    raise exception 'S1: was able to forge a payment record';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.lesson_progress (user_id, lesson_id, course_id, status) values
      ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-b000-000000000001', 'completed');
    raise exception 'S1: was able to write progress directly';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.user_roles (user_id, role) values ('00000000-0000-4000-a000-000000000004', 'admin');
    raise exception 'S1: was able to make itself an admin';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profile_private set status = 'active', suspended_reason = 'x' where user_id = '00000000-0000-4000-a000-000000000004';
    raise exception 'S1: was able to change its own account status';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.course_discussions (course_id, author_id, title, body, is_pinned) values
      ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'Pinned?', 'x', true);
    raise exception 'S1: was able to pin a discussion';
  exception when insufficient_privilege then null;
  end;

  insert into public.course_discussions (course_id, author_id, title, body) values
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'A question', 'Body');

  begin
    insert into public.course_discussions (course_id, author_id, title, body) values
      ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000004', 'Not my course', 'x');
    raise exception 'S1: was able to post in a course it cannot access';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.start_direct_conversation('00000000-0000-4000-a000-000000000003');
    raise exception 'S1: was able to message a teacher who does not teach them';
  exception when insufficient_privilege then null;
  end;

  v_conv := public.start_direct_conversation('00000000-0000-4000-a000-000000000002');
  assert v_conv is not null, 'S1: should be able to message their own instructor';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Student whose fixed-term access has expired, and one whose access was revoked
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000006","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000002') = 0, 'expired: paid content must be hidden after expiry';
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000001') = 1, 'expired: preview content stays visible';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000007","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000002') = 0, 'revoked: paid content must be hidden after revocation';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Teacher 1 — instructor of course one and draft course three
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}', true);
do $$
declare
  v_rows integer;
begin
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000003') = 1, 'T1: own draft course content must be visible';
  assert (select count(*) from public.lesson_content_blocks where id = '00000000-0000-4000-e000-000000000004') = 0, 'T1: another teacher''s course content must be hidden';
  assert (select count(*) from public.enrollments where course_id = '00000000-0000-4000-b000-000000000002') = 0, 'T1: another teacher''s students must be hidden';
  assert (select count(*) from public.enrollments where course_id = '00000000-0000-4000-b000-000000000001') = 3, 'T1: own course enrollments must be visible';
  assert (select count(*) from public.profile_private where user_id = '00000000-0000-4000-a000-000000000005') = 0, 'T1: unrelated student details must be hidden';
  assert (select count(*) from public.profile_private where user_id = '00000000-0000-4000-a000-000000000004') = 1, 'T1: own student details must be visible';
  assert (select count(*) from public.payment_transactions) = 0, 'T1: platform payments must be hidden from teachers';
  assert (select count(*) from public.messages) = 0, 'T1: another teacher''s messages must be hidden';
  assert (select count(*) from public.support_tickets where id = '00000000-0000-4000-9000-000000000012') = 0, 'T1: tickets outside their courses must be hidden';
  assert (select count(*) from public.quiz_options) = 2, 'T1: answer keys of own quizzes must be editable';

  begin
    insert into public.user_roles (user_id, role) values ('00000000-0000-4000-a000-000000000002', 'admin');
    raise exception 'T1: was able to change its own role';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.teacher_profiles set is_featured = true where user_id = '00000000-0000-4000-a000-000000000002';
    raise exception 'T1: was able to change admin-only profile flags';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.courses set status = 'published' where id = '00000000-0000-4000-b000-000000000003';
    raise exception 'T1: was able to publish without approval';
  exception when insufficient_privilege then null;
  end;

  update public.courses set status = 'in_review' where id = '00000000-0000-4000-b000-000000000003';
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'T1: should be able to submit own course for review';

  update public.courses set title = 'Hijacked' where id = '00000000-0000-4000-b000-000000000002';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'T1: must not be able to edit another teacher''s course';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Admin without MFA (aal1) vs. with MFA (aal2)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}', true);
do $$
begin
  assert (select count(*) from public.audit_logs) = 0, 'admin aal1: admin data must require MFA';
  assert (select count(*) from public.enrollments where course_id = '00000000-0000-4000-b000-000000000002') = 0, 'admin aal1: must not act as admin without MFA';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}', true);
do $$
begin
  assert (select count(*) from public.audit_logs) >= 1, 'admin aal2: audit logs must be visible';
  assert (select count(*) from public.enrollments) >= 4, 'admin aal2: all enrollments must be visible';
  assert (select count(*) from public.payment_transactions) >= 2, 'admin aal2: all payments must be visible';
  begin
    perform 1 from public.integration_settings;
    raise exception 'admin: integration secrets must only be readable by the server';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Every assertion passed. Abort deliberately so no fixture is committed.
do $$ begin raise exception 'RLS_SUITE_PASSED'; end $$;

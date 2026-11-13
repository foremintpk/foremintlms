-- Course builder RPCs: atomic reordering and quiz question saving.
-- Every function re-checks edit rights with private.can_edit_course() using
-- the caller's JWT, so they are safe to expose to authenticated users.

-- Reorder modules and lessons (including moving lessons between modules).
-- p_structure: [{"id": "<module uuid>", "lessons": ["<lesson uuid>", …]}, …]
create or replace function public.reorder_curriculum(p_course uuid, p_structure jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_module jsonb;
  v_module_id uuid;
  v_lesson_id uuid;
  v_m_index integer := 0;
  v_l_index integer;
begin
  if not private.can_edit_course(p_course) then
    raise exception 'You cannot edit this course' using errcode = '42501';
  end if;
  if jsonb_typeof(p_structure) <> 'array' then
    raise exception 'Invalid curriculum structure' using errcode = '22023';
  end if;

  for v_module in select * from jsonb_array_elements(p_structure) loop
    v_module_id := (v_module ->> 'id')::uuid;
    if not exists (select 1 from public.course_modules where id = v_module_id and course_id = p_course) then
      raise exception 'Module does not belong to this course' using errcode = '22023';
    end if;
    update public.course_modules set sort_order = v_m_index where id = v_module_id;
    v_m_index := v_m_index + 1;

    v_l_index := 0;
    for v_lesson_id in select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(v_module -> 'lessons', '[]'::jsonb)) loop
      if not exists (select 1 from public.lessons where id = v_lesson_id and course_id = p_course) then
        raise exception 'Lesson does not belong to this course' using errcode = '22023';
      end if;
      update public.lessons set module_id = v_module_id, sort_order = v_l_index where id = v_lesson_id;
      v_l_index := v_l_index + 1;
    end loop;
  end loop;
end;
$$;

create or replace function public.reorder_lesson_blocks(p_lesson uuid, p_block_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  i integer;
begin
  select course_id into v_course from public.lessons where id = p_lesson;
  if v_course is null or not private.can_edit_course(v_course) then
    raise exception 'You cannot edit this lesson' using errcode = '42501';
  end if;
  for i in 1 .. coalesce(array_length(p_block_ids, 1), 0) loop
    update public.lesson_content_blocks set sort_order = i - 1 where id = p_block_ids[i] and lesson_id = p_lesson;
  end loop;
end;
$$;

create or replace function public.reorder_lesson_resources(p_lesson uuid, p_resource_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  i integer;
begin
  select course_id into v_course from public.lessons where id = p_lesson;
  if v_course is null or not private.can_edit_course(v_course) then
    raise exception 'You cannot edit this lesson' using errcode = '42501';
  end if;
  for i in 1 .. coalesce(array_length(p_resource_ids, 1), 0) loop
    update public.lesson_resources set sort_order = i - 1 where id = p_resource_ids[i] and lesson_id = p_lesson;
  end loop;
end;
$$;

create or replace function public.reorder_quiz_questions(p_quiz uuid, p_question_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  i integer;
begin
  select course_id into v_course from public.quizzes where id = p_quiz;
  if v_course is null or not private.can_edit_course(v_course) then
    raise exception 'You cannot edit this quiz' using errcode = '42501';
  end if;
  for i in 1 .. coalesce(array_length(p_question_ids, 1), 0) loop
    update public.quiz_questions set sort_order = i - 1 where id = p_question_ids[i] and quiz_id = p_quiz;
  end loop;
end;
$$;

-- Insert or update a question and its options in one transaction. Existing
-- option ids are preserved (past attempts reference them). Returns
-- {question_id, option_ids}; the app deletes dropped options via RLS.
-- p_question: {id?, course_id, quiz_id?, question_bank_id?, question_type, prompt,
--              explanation?, points, accepted_answers[], case_sensitive, requires_manual_review}
-- p_options:  [{id?, label, is_correct}]
create or replace function public.save_quiz_question(p_question jsonb, p_options jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_question ->> 'id', '')::uuid;
  v_course uuid := (p_question ->> 'course_id')::uuid;
  v_quiz uuid := nullif(p_question ->> 'quiz_id', '')::uuid;
  v_bank uuid := nullif(p_question ->> 'question_bank_id', '')::uuid;
  v_option jsonb;
  v_option_id uuid;
  v_keep uuid[] := '{}';
  v_index integer := 0;
  v_next_sort integer;
begin
  if v_course is null or not private.can_edit_course(v_course) then
    raise exception 'You cannot edit this course' using errcode = '42501';
  end if;
  if v_quiz is null and v_bank is null then
    raise exception 'A question belongs to a quiz or a question bank' using errcode = '22023';
  end if;
  if v_quiz is not null and not exists (select 1 from public.quizzes where id = v_quiz and course_id = v_course) then
    raise exception 'Quiz not found in this course' using errcode = '22023';
  end if;
  if v_bank is not null and not exists (select 1 from public.question_banks where id = v_bank and course_id = v_course) then
    raise exception 'Question bank not found in this course' using errcode = '22023';
  end if;

  if v_id is null then
    select coalesce(max(sort_order) + 1, 0) into v_next_sort
    from public.quiz_questions
    where (v_quiz is not null and quiz_id = v_quiz) or (v_quiz is null and question_bank_id = v_bank);

    insert into public.quiz_questions (
      course_id, quiz_id, question_bank_id, question_type, prompt, explanation, points, sort_order,
      accepted_answers, case_sensitive, requires_manual_review
    ) values (
      v_course, v_quiz, v_bank,
      p_question ->> 'question_type',
      p_question ->> 'prompt',
      nullif(p_question ->> 'explanation', ''),
      coalesce((p_question ->> 'points')::numeric, 1),
      v_next_sort,
      coalesce(array(select jsonb_array_elements_text(p_question -> 'accepted_answers')), '{}'),
      coalesce((p_question ->> 'case_sensitive')::boolean, false),
      coalesce((p_question ->> 'requires_manual_review')::boolean, false)
    ) returning id into v_id;
  else
    if not exists (select 1 from public.quiz_questions where id = v_id and course_id = v_course) then
      raise exception 'Question not found in this course' using errcode = '22023';
    end if;
    update public.quiz_questions set
      question_type = p_question ->> 'question_type',
      prompt = p_question ->> 'prompt',
      explanation = nullif(p_question ->> 'explanation', ''),
      points = coalesce((p_question ->> 'points')::numeric, 1),
      accepted_answers = coalesce(array(select jsonb_array_elements_text(p_question -> 'accepted_answers')), '{}'),
      case_sensitive = coalesce((p_question ->> 'case_sensitive')::boolean, false),
      requires_manual_review = coalesce((p_question ->> 'requires_manual_review')::boolean, false)
    where id = v_id;
  end if;

  for v_option in select * from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) loop
    v_option_id := nullif(v_option ->> 'id', '')::uuid;
    if v_option_id is not null and exists (select 1 from public.quiz_options where id = v_option_id and question_id = v_id) then
      update public.quiz_options
      set label = v_option ->> 'label', is_correct = coalesce((v_option ->> 'is_correct')::boolean, false), sort_order = v_index
      where id = v_option_id;
    else
      insert into public.quiz_options (question_id, label, is_correct, sort_order)
      values (v_id, v_option ->> 'label', coalesce((v_option ->> 'is_correct')::boolean, false), v_index)
      returning id into v_option_id;
    end if;
    v_keep := array_append(v_keep, v_option_id);
    v_index := v_index + 1;
  end loop;

  -- The application removes this question's other options through RLS.
  return jsonb_build_object('question_id', v_id, 'option_ids', to_jsonb(v_keep));
end;
$$;

-- Copy questions from a bank into a quiz (with their options).
create or replace function public.copy_bank_questions_to_quiz(p_quiz uuid, p_question_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_source record;
  v_new uuid;
  v_sort integer;
  v_count integer := 0;
begin
  select course_id into v_course from public.quizzes where id = p_quiz;
  if v_course is null or not private.can_edit_course(v_course) then
    raise exception 'You cannot edit this quiz' using errcode = '42501';
  end if;
  select coalesce(max(sort_order) + 1, 0) into v_sort from public.quiz_questions where quiz_id = p_quiz;

  for v_source in
    select * from public.quiz_questions
    where id = any (p_question_ids) and course_id = v_course and question_bank_id is not null
    order by sort_order
  loop
    insert into public.quiz_questions (
      course_id, quiz_id, question_bank_id, question_type, prompt, explanation, points, sort_order,
      accepted_answers, case_sensitive, requires_manual_review
    ) values (
      v_course, p_quiz, null, v_source.question_type, v_source.prompt, v_source.explanation, v_source.points, v_sort,
      v_source.accepted_answers, v_source.case_sensitive, v_source.requires_manual_review
    ) returning id into v_new;
    insert into public.quiz_options (question_id, label, is_correct, sort_order)
    select v_new, label, is_correct, sort_order from public.quiz_options where question_id = v_source.id;
    v_sort := v_sort + 1;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Publication scheduling is admin-only, and any non-admin status change
-- (submitting, withdrawing) invalidates an earlier approval/schedule, so an
-- old approval can never publish newer, unreviewed content. Runs after
-- courses_guard (triggers fire in name order).
create or replace function private.guard_course_schedule()
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
    new.scheduled_publish_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;
  if new.scheduled_publish_at is distinct from old.scheduled_publish_at then
    raise exception 'Only administrators can schedule publication' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    new.scheduled_publish_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

create trigger courses_schedule_guard before insert or update on public.courses
  for each row execute function private.guard_course_schedule();

revoke execute on function public.reorder_curriculum(uuid, jsonb) from public, anon;
revoke execute on function public.reorder_lesson_blocks(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_lesson_resources(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_quiz_questions(uuid, uuid[]) from public, anon;
revoke execute on function public.save_quiz_question(jsonb, jsonb) from public, anon;
revoke execute on function public.copy_bank_questions_to_quiz(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_curriculum(uuid, jsonb) to authenticated;
grant execute on function public.reorder_lesson_blocks(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_lesson_resources(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_quiz_questions(uuid, uuid[]) to authenticated;
grant execute on function public.save_quiz_question(jsonb, jsonb) to authenticated;
grant execute on function public.copy_bank_questions_to_quiz(uuid, uuid[]) to authenticated;

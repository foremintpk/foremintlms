-- Every sign-up receives the student role, so administrators hold it too.
-- Administrators are staff, not learners: keep them out of the admin Students
-- list and every student count on the analytics dashboard.

create or replace function private.is_admin_account(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = p_user and role = 'admin');
$$;
revoke execute on function private.is_admin_account(uuid) from public, anon, authenticated;

create or replace function public.admin_overview_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'students_total', (select count(distinct r.user_id) from public.user_roles r where r.role = 'student' and not private.is_admin_account(r.user_id)),
    'students_new', (
      select count(*) from public.user_roles r
      join public.profiles p on p.id = r.user_id
      where r.role = 'student' and not private.is_admin_account(r.user_id) and p.created_at between p_from and p_to
    ),
    'students_active', (
      select count(distinct x.user_id) from (
        select lp.user_id from public.lesson_progress lp where lp.last_viewed_at between p_from and p_to
        union
        select pp.user_id from public.profile_private pp where pp.last_sign_in_at between p_from and p_to
      ) x
      join public.user_roles r on r.user_id = x.user_id and r.role = 'student' and not private.is_admin_account(r.user_id)
    ),
    'courses_total', (select count(*) from public.courses),
    'courses_published', (select count(*) from public.courses where status = 'published'),
    'courses_draft', (select count(*) from public.courses where status = 'draft'),
    'courses_in_review', (select count(*) from public.courses where status = 'in_review'),
    'teachers_total', (select count(*) from public.teacher_profiles where status = 'approved'),
    'teachers_pending', (select count(*) from public.teacher_profiles where status in ('pending', 'invited')),
    'enrollments_active', (select count(*) from public.enrollments where status = 'active'),
    'enrollments_new', (select count(*) from public.enrollments where enrolled_at between p_from and p_to),
    'enrollments_total', (select count(*) from public.enrollments),
    'enrollments_completed_total', (select count(*) from public.enrollments where status = 'completed' or completed_at is not null),
    'completions_in_range', (select count(*) from public.enrollments where completed_at between p_from and p_to),
    'avg_progress_active', (select coalesce(round(avg(progress_percent), 1), 0) from public.enrollments where status = 'active'),
    'lessons_completed', (select count(*) from public.lesson_progress where completed_at between p_from and p_to),
    'quiz_attempts', (select count(*) from public.quiz_attempts where submitted_at between p_from and p_to),
    'submissions', (select count(*) from public.assignment_submissions where submitted_at between p_from and p_to),
    'certificates_issued', (select count(*) from public.certificates where issued_at between p_from and p_to and status = 'issued'),
    'payments_count', (
      select count(*) from public.payment_transactions
      where status in ('succeeded', 'partially_refunded', 'refunded', 'disputed') and paid_at between p_from and p_to
    ),
    'payments_failed', (select count(*) from public.payment_transactions where status = 'failed' and created_at between p_from and p_to),
    'refunds_count', (select count(*) from public.payment_transactions where refunded_cents > 0 and coalesce(refunded_at, updated_at) between p_from and p_to),
    'revenue', coalesce((
      select jsonb_agg(jsonb_build_object('currency', t.currency, 'gross_cents', t.gross, 'refunded_cents', t.refunded, 'net_cents', t.gross - t.refunded) order by t.gross desc)
      from (
        select currency, sum(total_cents)::bigint as gross, sum(refunded_cents)::bigint as refunded
        from public.payment_transactions
        where status in ('succeeded', 'partially_refunded', 'refunded', 'disputed') and paid_at between p_from and p_to
        group by currency
      ) t
    ), '[]'::jsonb),
    'subscriptions_by_status', coalesce((
      select jsonb_object_agg(s.status, s.n) from (
        select status, count(*) as n from public.subscription_records group by status
      ) s
    ), '{}'::jsonb),
    'subscriptions_new', (select count(*) from public.subscription_records where created_at between p_from and p_to),
    'subscriptions_canceled', (select count(*) from public.subscription_records where canceled_at between p_from and p_to),
    'tickets_open', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting_on_student')),
    'tickets_new', (select count(*) from public.support_tickets where created_at between p_from and p_to),
    'tickets_resolved', (select count(*) from public.support_tickets where resolved_at between p_from and p_to),
    'deletion_requests', (select count(*) from public.profile_private where deletion_requested_at is not null)
  ) into v;

  return v;
end;
$$;
revoke execute on function public.admin_overview_metrics(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_overview_metrics(timestamptz, timestamptz) to authenticated;

create or replace function public.admin_timeseries(
  p_metric text,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'day',
  p_currency text default null
)
returns table (bucket date, value numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'Invalid bucket %', p_bucket;
  end if;
  if p_metric not in ('signups', 'enrollments', 'completions', 'revenue', 'refunds', 'new_subscriptions', 'canceled_subscriptions', 'tickets', 'certificates', 'lessons_completed') then
    raise exception 'Invalid metric %', p_metric;
  end if;

  return query
  with buckets as (
    select generate_series(
      date_trunc(p_bucket, p_from),
      date_trunc(p_bucket, p_to),
      ('1 ' || p_bucket)::interval
    )::date as b
  ),
  events as (
    select p.created_at as ts, 1::numeric as v
      from public.profiles p
      join public.user_roles r on r.user_id = p.id and r.role = 'student' and not private.is_admin_account(r.user_id)
      where p_metric = 'signups' and p.created_at between p_from and p_to
    union all
    select e.enrolled_at, 1 from public.enrollments e
      where p_metric = 'enrollments' and e.enrolled_at between p_from and p_to
    union all
    select e.completed_at, 1 from public.enrollments e
      where p_metric = 'completions' and e.completed_at between p_from and p_to
    union all
    select t.paid_at, t.total_cents::numeric from public.payment_transactions t
      where p_metric = 'revenue'
        and t.status in ('succeeded', 'partially_refunded', 'refunded', 'disputed')
        and t.paid_at between p_from and p_to
        and (p_currency is null or t.currency = p_currency)
    union all
    select coalesce(t.refunded_at, t.updated_at), t.refunded_cents::numeric from public.payment_transactions t
      where p_metric = 'refunds' and t.refunded_cents > 0
        and coalesce(t.refunded_at, t.updated_at) between p_from and p_to
        and (p_currency is null or t.currency = p_currency)
    union all
    select s.created_at, 1 from public.subscription_records s
      where p_metric = 'new_subscriptions' and s.created_at between p_from and p_to
    union all
    select s.canceled_at, 1 from public.subscription_records s
      where p_metric = 'canceled_subscriptions' and s.canceled_at between p_from and p_to
    union all
    select k.created_at, 1 from public.support_tickets k
      where p_metric = 'tickets' and k.created_at between p_from and p_to
    union all
    select c.issued_at, 1 from public.certificates c
      where p_metric = 'certificates' and c.issued_at between p_from and p_to
    union all
    select lp.completed_at, 1 from public.lesson_progress lp
      where p_metric = 'lessons_completed' and lp.completed_at between p_from and p_to
  ),
  grouped as (
    select date_trunc(p_bucket, ts)::date as b, sum(v) as v from events group by 1
  )
  select buckets.b, coalesce(grouped.v, 0)
  from buckets left join grouped on grouped.b = buckets.b
  order by buckets.b;
end;
$$;
revoke execute on function public.admin_timeseries(text, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.admin_timeseries(text, timestamptz, timestamptz, text, text) to authenticated;

create or replace function public.admin_search_users(
  p_role public.app_role default null,
  p_query text default null,
  p_status text default null,
  p_sort text default 'created_desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  status text,
  roles text[],
  created_at timestamptz,
  last_sign_in_at timestamptz,
  deletion_requested_at timestamptz,
  enrollments_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  if not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  with base as (
    select p.id, p.full_name, pp.email::text as email, p.avatar_url, pp.status,
      array(select r.role::text from public.user_roles r where r.user_id = p.id order by r.role) as roles,
      p.created_at, pp.last_sign_in_at, pp.deletion_requested_at,
      (select count(*) from public.enrollments e where e.user_id = p.id) as enrollments_count
    from public.profiles p
    join public.profile_private pp on pp.user_id = p.id
    where (p_role is null or exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = p_role))
      and (p_role is distinct from 'student' or not private.is_admin_account(p.id))
      and (p_status is null or (p_status = 'deletion_requested' and pp.deletion_requested_at is not null) or pp.status = p_status)
      and (
        v_q is null
        or p.full_name ilike '%' || v_q || '%'
        or pp.email::text ilike '%' || v_q || '%'
        or p.id::text = v_q
      )
  )
  select b.*, count(*) over () as total_count
  from base b
  order by
    case when p_sort = 'name_asc' then b.full_name end asc,
    case when p_sort = 'last_sign_in_desc' then b.last_sign_in_at end desc nulls last,
    case when p_sort = 'created_asc' then b.created_at end asc,
    b.created_at desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
end;
$$;
revoke execute on function public.admin_search_users(public.app_role, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_search_users(public.app_role, text, text, text, integer, integer) to authenticated;

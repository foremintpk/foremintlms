-- Public website: published course reviews with a privacy-preserving reviewer
-- name ("Sam K."). Reviewer profiles are not readable anonymously, so this
-- SECURITY DEFINER function exposes only the first name and last initial,
-- and only for published reviews of publicly visible courses.

create or replace function public.get_published_course_reviews(p_course uuid, p_limit integer default 12)
returns table (
  id uuid,
  rating smallint,
  title text,
  body text,
  created_at timestamptz,
  verified_enrollment boolean,
  reviewer_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.rating,
    r.title,
    r.body,
    r.created_at,
    r.verified_enrollment,
    case
      when n.parts is null or array_length(n.parts, 1) is null then 'Foremint learner'
      when array_length(n.parts, 1) = 1 then n.parts[1]
      else n.parts[1] || ' ' || left(n.parts[array_length(n.parts, 1)], 1) || '.'
    end as reviewer_name
  from public.course_reviews r
  join public.courses c on c.id = r.course_id
  left join public.profiles p on p.id = r.user_id
  left join lateral (
    select regexp_split_to_array(nullif(btrim(coalesce(p.full_name, '')), ''), '\s+') as parts
  ) n on true
  where r.course_id = p_course
    and r.status = 'published'
    and c.status = 'published'
    and c.visibility in ('public', 'unlisted')
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke execute on function public.get_published_course_reviews(uuid, integer) from public;
grant execute on function public.get_published_course_reviews(uuid, integer) to anon, authenticated, service_role;

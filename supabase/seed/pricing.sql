-- Foremint Academy starter pricing. Run AFTER supabase/seed/courses/*.sql so
-- product descriptions pick up the final course summaries. Idempotent: rows
-- that already exist (matched by slug / course) are left untouched.
--
-- Prices are a starting point; change them in Admin → Products & pricing,
-- then use "Sync to Whop" so checkout uses the same amounts.
do $$
declare
  r record;
  p uuid;
  bundle uuid;
  membership uuid;
  i integer := 0;
begin
  -- One product per published course: 90-day access and lifetime access.
  for r in
    select id, slug, title, short_description, thumbnail_url
    from public.courses
    where status = 'published'
    order by created_at
  loop
    select id into p from public.products where course_id = r.id;
    if p is null then
      insert into public.products (kind, name, slug, description, image_url, course_id, sort_order)
        values ('course', r.title, r.slug, r.short_description, r.thumbnail_url, r.id, i)
        returning id into p;
      insert into public.product_courses (product_id, course_id) values (p, r.id)
        on conflict do nothing;
    end if;

    if not exists (select 1 from public.pricing_plans where product_id = p) then
      insert into public.pricing_plans
        (product_id, name, description, plan_type, price_cents, access_duration_days, sort_order, is_featured)
      values
        (p, '90-day access', 'Full course access for 90 days, including quizzes, assignments and certificate.', 'one_time', 4900, 90, 0, false),
        (p, 'Lifetime access', 'Keep the course and every future update, with no expiry.', 'one_time', 9900, null, 1, true);
    end if;
    i := i + 1;
  end loop;

  -- Seller bundle: the four selling courses, lifetime access.
  select id into bundle from public.products where slug = 'seller-bundle';
  if bundle is null then
    insert into public.products (kind, name, slug, description, is_featured, sort_order)
      values ('bundle', 'Seller bundle', 'seller-bundle',
        'Amazon FBA, eBay, Shopify and e-commerce essentials together: everything you need to start selling online across marketplaces and your own store.',
        true, 0)
      returning id into bundle;
    insert into public.product_courses (product_id, course_id, sort_order)
      select bundle, c.id, x.ord
      from (values ('e-commerce-business-essentials', 0), ('amazon-fba-foundations', 1),
                   ('ebay-selling-playbook', 2), ('shopify-store-launch', 3)) as x(slug, ord)
      join public.courses c on c.slug = x.slug
      on conflict do nothing;
    insert into public.pricing_plans
      (product_id, name, description, plan_type, price_cents, compare_at_price_cents, access_duration_days, is_featured, promo_label)
      values (bundle, 'Lifetime bundle', 'Lifetime access to all four selling courses and their future updates.',
        'one_time', 14900, 39600, null, true, 'Save over 60%');
  end if;

  -- Complete library: every course, billed monthly.
  select id into membership from public.products where slug = 'complete-library';
  if membership is null then
    insert into public.products (kind, name, slug, description, grants_all_courses, is_featured, sort_order)
      values ('membership', 'Complete library', 'complete-library',
        'Every Foremint Academy course, including new courses as they are released, live workshops and certificates, for as long as your membership is active.',
        true, true, 0)
      returning id into membership;
    insert into public.pricing_plans
      (product_id, name, description, plan_type, price_cents, billing_period_days, is_featured)
      values (membership, 'Monthly', 'Billed every month. Cancel any time; access continues until the end of the paid period.',
        'recurring', 2900, 30, true);
  end if;

  -- Feature six courses on the home page and catalogue.
  update public.courses set is_featured = (slug in (
    'amazon-fba-foundations', 'shopify-store-launch', 'complete-seo-framework',
    'modern-web-development', 'digital-marketing-fundamentals', 'wordpress-development-fundamentals'
  ))
  where status = 'published';
end
$$;

-- Custom invoicing, Whop invoice payment links and company-wide course access.
--
-- Model
--   custom_invoices        the commercial agreement (who, which courses, price, access terms)
--   whop_invoice_mappings  the Whop invoice/variant/membership created for it (provider side)
--   invoice_entitlements   the paid package: courses + access window, owned by a company or one user
--   companies              company workspaces; company_members are ordinary Student accounts
--   access_invitations     single-use, hashed-token invitations (employees, company contacts,
--                          purchasers who have no account yet)
--
-- Access is never granted from these tables directly. sync_invoice_entitlement_access()
-- materialises one course_entitlements row per beneficiary and course (or one all-access
-- row when future courses are included), linked back by invoice_entitlement_id. Every
-- existing access check (TS guards, RLS helpers, signed video URLs) therefore applies
-- unchanged, and each check compares expires_at with now() at request time.

-- ---------------------------------------------------------------------------
-- Entitlement sources
-- ---------------------------------------------------------------------------

alter table public.course_entitlements drop constraint course_entitlements_source_check;
alter table public.course_entitlements add constraint course_entitlements_source_check
  check (source in ('purchase', 'subscription', 'membership', 'bundle', 'free', 'manual', 'invoice', 'company'));

alter table public.enrollments drop constraint enrollments_source_check;
alter table public.enrollments add constraint enrollments_source_check
  check (source in ('purchase', 'subscription', 'membership', 'bundle', 'free', 'manual', 'invoice', 'company'));

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  description text check (length(description) <= 4000),
  services_description text check (length(services_description) <= 4000),
  primary_contact_user_id uuid references public.profiles (id) on delete set null,
  primary_contact_email extensions.citext not null,
  primary_contact_name text check (length(primary_contact_name) <= 160),
  -- Internal only: never shown to company members or printed on documents.
  primary_contact_phone text check (length(primary_contact_phone) <= 40),
  internal_notes text check (length(internal_notes) <= 4000),
  -- Administrative state, set by Foremint admins.
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  suspended_reason text,
  suspended_at timestamptz,
  -- Derived from the company's entitlements by refresh_company_access_status().
  access_status text not null default 'pending' check (access_status in ('pending', 'active', 'expired')),
  -- Maximum active members + pending invitations; null = unlimited.
  seat_limit integer check (seat_limit is null or seat_limit between 1 and 100000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_name_idx on public.companies (lower(name));
create index companies_contact_email_idx on public.companies (primary_contact_email);
create index companies_status_idx on public.companies (status, access_status);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invitation_id uuid,
  membership_status text not null default 'active' check (membership_status in ('active', 'removed')),
  -- Scoped company capability (never a platform role): invite/remove employees.
  can_invite_members boolean not null default false,
  -- May see the company's invoices and payment status.
  can_view_billing boolean not null default false,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  removal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id, membership_status);
create index company_members_company_idx on public.company_members (company_id, membership_status);

-- ---------------------------------------------------------------------------
-- Custom invoices
-- ---------------------------------------------------------------------------

create sequence public.custom_invoice_number_seq start 1001;

create table public.custom_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  invoice_type text not null check (invoice_type in ('individual', 'company')),
  -- Individual purchaser once known (existing account, or after activation).
  customer_user_id uuid references public.profiles (id) on delete set null,
  -- Existing company chosen at creation, or the workspace created on payment.
  company_id uuid references public.companies (id) on delete set null,
  customer_name text not null check (length(customer_name) between 1 and 160),
  customer_email extensions.citext not null check (length(customer_email) <= 254),
  customer_phone text check (length(customer_phone) <= 40),
  company_name text check (length(company_name) <= 200),
  company_description text check (length(company_description) <= 4000),
  company_services text check (length(company_services) <= 4000),
  invoice_description text not null check (length(invoice_description) between 3 and 500),
  customer_reference text check (length(customer_reference) <= 120),
  internal_reference text check (length(internal_reference) <= 120),
  internal_notes text check (length(internal_notes) <= 4000),

  -- Money in integer minor units of `currency` (never floating point).
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  -- Recurring only: extra amount charged once with the first invoice.
  upfront_fee_minor bigint not null default 0 check (upfront_fee_minor >= 0),
  billing_type text not null check (billing_type in ('one_time', 'recurring')),

  -- One-time access terms (counted from the verified payment time).
  access_mode text check (access_mode in ('days', 'lifetime', 'until_date')),
  access_duration_days integer check (access_duration_days between 1 and 3650),
  access_end_at timestamptz,
  -- Recurring terms.
  billing_interval_days integer check (billing_interval_days between 2 and 365),
  billing_cycles integer check (billing_cycles between 2 and 115),
  grace_period_days integer not null default 3 check (grace_period_days between 0 and 60),

  course_selection_mode text not null check (course_selection_mode in ('selected', 'all_published', 'all_including_future')),
  includes_future_courses boolean not null default false,
  -- [{id, title, slug, category, status}] frozen at creation; never rewritten.
  selected_course_snapshot jsonb not null default '[]'::jsonb,
  course_ids uuid[] not null default '{}',
  snapshot_taken_at timestamptz not null default now(),

  -- Company options.
  seat_limit integer check (seat_limit is null or seat_limit between 1 and 100000),
  allow_contact_invites boolean not null default true,

  due_at timestamptz,
  -- Optional: after this the unpaid invoice is voided on Whop and marked expired.
  link_expires_at timestamptz,

  status text not null default 'draft' check (status in (
    'draft', 'pending_generation', 'awaiting_payment', 'paid', 'past_due', 'failed',
    'expired', 'cancelled', 'voided', 'refunded', 'partially_refunded', 'under_review'
  )),
  status_reason text,
  generation_error text,
  generation_attempts integer not null default 0,
  generation_locked_at timestamptz,

  paid_at timestamptz,
  paid_amount_minor bigint,
  paid_tax_minor bigint,
  refunded_amount_minor bigint not null default 0,
  voided_at timestamptz,
  cancelled_at timestamptz,
  last_synced_at timestamptz,

  service_summary_storage_path text,
  service_summary_version integer not null default 0,
  service_summary_generated_at timestamptz,

  email_send_count integer not null default 0,
  last_email_sent_at timestamptz,
  reminder_sent_at timestamptz,
  past_due_notified_at timestamptz,

  revision_of uuid references public.custom_invoices (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (invoice_type <> 'company' or company_name is not null),
  check (billing_type <> 'one_time' or access_mode is not null),
  check (access_mode is distinct from 'days' or access_duration_days is not null),
  check (access_mode is distinct from 'until_date' or access_end_at is not null),
  check (billing_type <> 'recurring' or billing_interval_days is not null),
  check (billing_type = 'recurring' or (upfront_fee_minor = 0 and billing_cycles is null)),
  check (course_selection_mode = 'all_including_future' or cardinality(course_ids) > 0),
  check (includes_future_courses = (course_selection_mode = 'all_including_future'))
);
create index custom_invoices_status_idx on public.custom_invoices (status, created_at desc);
create index custom_invoices_company_idx on public.custom_invoices (company_id);
create index custom_invoices_customer_idx on public.custom_invoices (customer_user_id);
create index custom_invoices_email_idx on public.custom_invoices (customer_email);
create index custom_invoices_due_idx on public.custom_invoices (due_at) where status in ('awaiting_payment', 'past_due', 'failed');
create index custom_invoices_course_ids_idx on public.custom_invoices using gin (course_ids);

-- Provider side of a custom invoice. One per local invoice; a duplicate or
-- revision is a new local invoice with its own Whop invoice.
create table public.whop_invoice_mappings (
  id uuid primary key default gen_random_uuid(),
  local_invoice_id uuid not null unique references public.custom_invoices (id) on delete restrict,
  environment text not null check (environment in ('sandbox', 'production')),
  whop_account_id text not null,
  whop_invoice_id text unique,          -- pay_… (the invoice is also the first payment)
  whop_invoice_number text,
  whop_payment_id text,
  whop_membership_id text,              -- recurring: the subscription the invoice starts
  whop_member_id text,
  whop_product_id text,
  whop_variant_id text,
  checkout_link text,                   -- signed value returned by Whop (pay_….<signature>)
  payment_url text,                     -- hosted checkout URL built from checkout_link per Whop's docs
  provider_status text,
  totals_status text,
  provider_total_minor bigint,
  provider_tax_minor bigint,
  provider_currency text,
  -- The per-invoice hidden Whop product/variant is kept for audit history;
  -- unpaid voided ones are archived (never deleted).
  cleanup_status text not null default 'retained' check (cleanup_status in ('retained', 'archived', 'archive_failed')),
  last_synced_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index whop_invoice_mappings_membership_uniq on public.whop_invoice_mappings (whop_membership_id) where whop_membership_id is not null;

-- Paid package. A company package is shared by every active company member;
-- an individual package belongs to one user (null until they activate).
create table public.invoice_entitlements (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.custom_invoices (id) on delete restrict,
  company_id uuid references public.companies (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  beneficiary_email extensions.citext,
  entitlement_type text not null check (entitlement_type in ('one_time', 'subscription')),
  course_selection_mode text not null check (course_selection_mode in ('selected', 'all_published', 'all_including_future')),
  included_course_ids uuid[] not null default '{}',
  includes_future_courses boolean not null default false,
  starts_at timestamptz not null,
  expires_at timestamptz,               -- null = no end (lifetime, or a live subscription without a period end)
  contract_ends_at timestamptz,         -- recurring contracts with a fixed number of payments
  grace_period_days integer not null default 3,
  subscription_status text,
  whop_membership_id text,
  whop_payment_id text,
  last_renewal_payment_id text,
  status text not null default 'active' check (status in ('active', 'expired', 'suspended', 'revoked')),
  status_reason text,
  expiry_reminder_sent_at timestamptz,
  expired_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (company_id is null or user_id is null),
  check (expires_at is null or expires_at > starts_at)
);
create index invoice_entitlements_company_idx on public.invoice_entitlements (company_id, status);
create index invoice_entitlements_user_idx on public.invoice_entitlements (user_id, status);
create index invoice_entitlements_expiry_idx on public.invoice_entitlements (expires_at) where status = 'active';
create index invoice_entitlements_membership_idx on public.invoice_entitlements (whop_membership_id);

alter table public.course_entitlements
  add column invoice_entitlement_id uuid references public.invoice_entitlements (id) on delete cascade;
create unique index course_entitlements_invoice_user_course_uniq
  on public.course_entitlements (invoice_entitlement_id, user_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where invoice_entitlement_id is not null;

alter table public.payment_transactions
  add column custom_invoice_id uuid references public.custom_invoices (id) on delete set null;
create index payment_transactions_custom_invoice_idx on public.payment_transactions (custom_invoice_id) where custom_invoice_id is not null;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create table public.access_invitations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('company_member', 'company_contact', 'purchase_activation')),
  company_id uuid references public.companies (id) on delete cascade,
  invoice_id uuid references public.custom_invoices (id) on delete cascade,
  email extensions.citext not null check (length(email) <= 254),
  full_name text check (length(full_name) <= 160),
  -- SHA-256 of the emailed token; the raw token is never stored.
  token_hash text not null unique,
  can_invite_members boolean not null default false,
  invited_by uuid references public.profiles (id) on delete set null,
  invited_by_role text not null default 'system' check (invited_by_role in ('admin', 'company', 'system')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  send_count integer not null default 1,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'purchase_activation' or company_id is not null),
  check (kind <> 'purchase_activation' or invoice_id is not null)
);
create unique index access_invitations_company_pending_uniq on public.access_invitations (company_id, email) where status = 'pending' and company_id is not null;
create unique index access_invitations_purchase_pending_uniq on public.access_invitations (invoice_id, email) where status = 'pending' and kind = 'purchase_activation';
create index access_invitations_email_idx on public.access_invitations (email, status);

alter table public.company_members
  add constraint company_members_invitation_fk foreign key (invitation_id) references public.access_invitations (id) on delete set null;

-- ---------------------------------------------------------------------------
-- History
-- ---------------------------------------------------------------------------

create table public.custom_invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.custom_invoices (id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  actor_id uuid references public.profiles (id) on delete set null,
  -- Makes system events idempotent (e.g. "renewed:pay_123").
  dedupe_key text unique,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index custom_invoice_events_invoice_idx on public.custom_invoice_events (invoice_id, created_at desc);

create table public.company_access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  affected_user_id uuid references public.profiles (id) on delete set null,
  performed_by uuid references public.profiles (id) on delete set null,
  performer_role text not null default 'system' check (performer_role in ('admin', 'company_contact', 'system')),
  action text not null,
  reason text,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index company_access_audit_logs_company_idx on public.company_access_audit_logs (company_id, created_at desc);

create trigger companies_updated_at before update on public.companies for each row execute function private.set_updated_at();
create trigger company_members_updated_at before update on public.company_members for each row execute function private.set_updated_at();
create trigger custom_invoices_updated_at before update on public.custom_invoices for each row execute function private.set_updated_at();
create trigger whop_invoice_mappings_updated_at before update on public.whop_invoice_mappings for each row execute function private.set_updated_at();
create trigger invoice_entitlements_updated_at before update on public.invoice_entitlements for each row execute function private.set_updated_at();
create trigger access_invitations_updated_at before update on public.access_invitations for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Functions (service role only unless stated)
-- ---------------------------------------------------------------------------

create or replace function public.next_custom_invoice_number(p_prefix text default 'FMA-INV')
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(nullif(regexp_replace(p_prefix, '[^A-Za-z0-9-]', '', 'g'), ''), 'FMA-INV')
    || '-' || to_char(now() at time zone 'utc', 'YYYY')
    || '-' || lpad(nextval('public.custom_invoice_number_seq')::text, 6, '0');
$$;
revoke execute on function public.next_custom_invoice_number(text) from public, anon, authenticated;
grant execute on function public.next_custom_invoice_number(text) to service_role;

-- Company membership helpers for RLS (no recursion: they read tables directly).
create or replace function private.is_company_member(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company and user_id = (select auth.uid()) and membership_status = 'active'
  ) and private.is_active_account();
$$;

create or replace function private.can_manage_company(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company and user_id = (select auth.uid()) and membership_status = 'active' and can_invite_members
  ) and private.is_active_account();
$$;

create or replace function public.refresh_company_access_status(p_company uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select case
      when exists (
        select 1 from public.invoice_entitlements e
        where e.company_id = p_company and e.status = 'active' and (e.expires_at is null or e.expires_at > now())
      ) then 'active'
      when exists (select 1 from public.invoice_entitlements e where e.company_id = p_company) then 'expired'
      else 'pending'
    end
  into v_status;
  update public.companies set access_status = v_status where id = p_company and access_status is distinct from v_status;
  return v_status;
end;
$$;
revoke execute on function public.refresh_company_access_status(uuid) from public, anon, authenticated;
grant execute on function public.refresh_company_access_status(uuid) to service_role;

-- Materialise a package's access for every beneficiary, atomically.
-- Idempotent: running it twice changes nothing. Returns the (user, course)
-- rows it created, so callers can welcome new learners exactly once.
create or replace function public.sync_invoice_entitlement_access(p_entitlement uuid)
returns table (user_id uuid, course_id uuid, inserted boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  e public.invoice_entitlements%rowtype;
  v_company_status text;
  v_status text;
  v_reason text;
  v_source text;
  v_users uuid[];
  v_courses uuid[];
begin
  select * into e from public.invoice_entitlements where id = p_entitlement for update;
  if not found then
    return;
  end if;

  if e.company_id is not null then
    v_source := 'company';
    select c.status into v_company_status from public.companies c where c.id = e.company_id;
    select coalesce(array_agg(m.user_id), '{}') into v_users
    from public.company_members m
    where m.company_id = e.company_id and m.membership_status = 'active';
  else
    v_source := 'invoice';
    v_users := case when e.user_id is null then '{}'::uuid[] else array[e.user_id] end;
  end if;

  v_status := case
    when e.status = 'active' and e.expires_at is not null and e.expires_at <= now() then 'expired'
    else e.status
  end;
  if v_status = 'active' and v_company_status = 'suspended' then
    v_status := 'suspended';
  end if;
  v_reason := coalesce(e.status_reason, 'Custom invoice package');

  -- Only courses that still exist; archived courses keep their rows (the
  -- LMS's own course-status rules decide what an archived course shows).
  select coalesce(array_agg(c.id), '{}') into v_courses
  from public.courses c
  where c.id = any (e.included_course_ids);

  return query
  with targets as (
    select 'all_access'::text as scope, null::uuid as cid where e.includes_future_courses
    union all
    select 'course'::text, x from unnest(v_courses) as x where not e.includes_future_courses
  ),
  upserted as (
    insert into public.course_entitlements as ce
      (user_id, scope, course_id, source, status, starts_at, expires_at, invoice_entitlement_id, whop_membership_id, grant_reason, revoked_at, revoke_reason)
    select u.uid, t.scope, t.cid, v_source, v_status, e.starts_at, e.expires_at, e.id, e.whop_membership_id, v_reason,
           case when v_status = 'revoked' then now() end,
           case when v_status = 'revoked' then v_reason end
    from unnest(v_users) as u(uid)
    cross join targets t
    on conflict (invoice_entitlement_id, user_id, (coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      where invoice_entitlement_id is not null
    do update set
      status = excluded.status,
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      whop_membership_id = excluded.whop_membership_id,
      grant_reason = excluded.grant_reason,
      revoked_at = case when excluded.status = 'revoked' then coalesce(ce.revoked_at, now()) end,
      revoke_reason = case when excluded.status = 'revoked' then excluded.revoke_reason end
    returning ce.user_id, ce.course_id, (xmax = 0) as inserted
  )
  select up.user_id, up.course_id, up.inserted from upserted up;

  -- People no longer covered (removed members) and courses no longer in the package.
  update public.course_entitlements ce
  set status = 'revoked', revoked_at = coalesce(ce.revoked_at, now()),
      revoke_reason = coalesce(ce.revoke_reason, 'No longer covered by the company package')
  where ce.invoice_entitlement_id = e.id
    and ce.status <> 'revoked'
    and (
      not (ce.user_id = any (v_users))
      or (e.includes_future_courses and ce.course_id is not null)
      or (not e.includes_future_courses and (ce.course_id is null or not (ce.course_id = any (v_courses))))
    );

  -- Enrollments: open the courses for active rows; close them when no other
  -- valid entitlement still covers the course. Completed enrollments keep
  -- their status (the record of achievement stays).
  if v_status = 'active' and (e.expires_at is null or e.expires_at > now()) then
    insert into public.enrollments as en (user_id, course_id, source, status)
    select ce.user_id, ce.course_id, v_source, 'active'
    from public.course_entitlements ce
    where ce.invoice_entitlement_id = e.id and ce.status = 'active' and ce.course_id is not null
    on conflict (user_id, course_id) do update
      set status = 'active'
      where en.status in ('expired', 'revoked', 'archived');
  end if;

  update public.enrollments en
  set status = case when ce.status = 'revoked' then 'revoked' else 'expired' end
  from public.course_entitlements ce
  where ce.invoice_entitlement_id = e.id
    and (ce.status <> 'active' or (ce.expires_at is not null and ce.expires_at <= now()))
    and en.user_id = ce.user_id
    and en.status = 'active'
    and (ce.course_id is null or en.course_id = ce.course_id)
    and not exists (
      select 1 from public.course_entitlements other
      where other.user_id = en.user_id
        and other.id <> ce.id
        and other.status = 'active'
        and other.starts_at <= now()
        and (other.expires_at is null or other.expires_at > now())
        and (other.course_id = en.course_id or other.scope = 'all_access')
    );

  if e.company_id is not null then
    perform public.refresh_company_access_status(e.company_id);
  end if;
end;
$$;
revoke execute on function public.sync_invoice_entitlement_access(uuid) from public, anon, authenticated;
grant execute on function public.sync_invoice_entitlement_access(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security. All writes go through server code (service role) after
-- explicit permission checks; there are no client write policies.
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.custom_invoices enable row level security;
alter table public.whop_invoice_mappings enable row level security;
alter table public.invoice_entitlements enable row level security;
alter table public.access_invitations enable row level security;
alter table public.custom_invoice_events enable row level security;
alter table public.company_access_audit_logs enable row level security;

create policy "companies: admin or member reads" on public.companies
  for select to authenticated using ((select private.is_admin()) or (select private.is_company_member(id)));

-- Employees see only their own membership; company managers see their company's.
create policy "company_members: admin, self or manager reads" on public.company_members
  for select to authenticated using (
    (select private.is_admin())
    or user_id = (select auth.uid())
    or (select private.can_manage_company(company_id))
  );

create policy "invoice_entitlements: admin, owner or company member reads" on public.invoice_entitlements
  for select to authenticated using (
    (select private.is_admin())
    or user_id = (select auth.uid())
    or (company_id is not null and (select private.is_company_member(company_id)))
  );

create policy "access_invitations: admin or company manager reads" on public.access_invitations
  for select to authenticated using (
    (select private.is_admin())
    or (company_id is not null and (select private.can_manage_company(company_id)))
  );

-- Commercial records (amounts, internal notes, provider ids) are admin-only.
create policy "custom_invoices: admin reads" on public.custom_invoices
  for select to authenticated using ((select private.is_admin()));
create policy "whop_invoice_mappings: admin reads" on public.whop_invoice_mappings
  for select to authenticated using ((select private.is_admin()));
create policy "custom_invoice_events: admin reads" on public.custom_invoice_events
  for select to authenticated using ((select private.is_admin()));
create policy "company_access_audit_logs: admin reads" on public.company_access_audit_logs
  for select to authenticated using ((select private.is_admin()));

-- Token hashes and internal fields are never readable from the browser.
revoke all on public.access_invitations from anon, authenticated;
grant select (id, kind, company_id, email, full_name, can_invite_members, invited_by_role, status, expires_at, accepted_at, revoked_at, send_count, last_sent_at, created_at)
  on public.access_invitations to authenticated;
revoke all on public.companies from anon, authenticated;
grant select (id, name, description, services_description, primary_contact_user_id, primary_contact_name, status, access_status, seat_limit, created_at)
  on public.companies to authenticated;
revoke all on public.custom_invoices, public.whop_invoice_mappings, public.custom_invoice_events, public.company_access_audit_logs from anon;
revoke insert, update, delete, truncate on public.company_members, public.invoice_entitlements, public.custom_invoices,
  public.whop_invoice_mappings, public.custom_invoice_events, public.company_access_audit_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, description, is_public) values
  ('invoicing.number_prefix', '"FMA-INV"', 'Prefix of custom invoice numbers (FMA-INV-2026-001001).', false),
  ('invoicing.default_due_days', '14', 'Days until a new custom invoice is due.', false),
  ('invoicing.invitation_ttl_days', '7', 'Days an employee or activation invitation stays valid.', false),
  ('invoicing.delivery', '"foremint"', 'Who emails invoice payment links: foremint (branded email via Resend) or whop (Whop''s invoice email with reminders).', false),
  ('invoicing.payment_reminder_days', '3', 'Days before the due date to send one payment reminder.', false),
  ('invoicing.package_expiry_reminder_days', '14', 'Days before a company or individual package ends to remind the customer.', false),
  ('invoicing.refund_full_policy', '"revoke"', 'Access after a full refund: revoke, suspend or keep.', false),
  ('invoicing.refund_partial_policy', '"keep"', 'Access after a partial refund: keep, suspend or revoke.', false),
  ('invoicing.dispute_policy', '"suspend"', 'Access while a payment is disputed: suspend or keep.', false),
  ('invoicing.allow_lifetime', 'true', 'Allow lifetime access on one-time custom invoices.', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Email templates (editable in Admin → Email templates)
-- ---------------------------------------------------------------------------

insert into public.email_templates (key, name, category, subject, preheader, heading, body, cta_label, is_required) values
  ('invoice.payment_link', 'Custom invoice: payment link', 'billing',
   'Your {{brand_name}} invoice {{invoice_number}}', '{{amount}} for {{invoice_description}}.', 'Your invoice is ready',
   'Hi {{first_name}},

Here is your invoice for {{invoice_description}}.

Payment is processed securely by Whop. You don''t need a {{brand_name}} account to pay: once your payment is confirmed we''ll set up access and email you the next steps.', 'Pay {{amount}}', true),
  ('invoice.reminder', 'Custom invoice: payment reminder', 'billing',
   'Reminder: invoice {{invoice_number}} is due {{due_date}}', 'Your payment link is inside.', 'A friendly reminder',
   'Hi {{first_name}},

Invoice {{invoice_number}} for {{invoice_description}} is due on {{due_date}}. You can pay it any time using the secure link below.', 'Pay {{amount}}', true),
  ('invoice.past_due', 'Custom invoice: past due', 'billing',
   'Invoice {{invoice_number}} is past due', 'The payment link still works.', 'Your invoice is past due',
   'Hi {{first_name}},

Invoice {{invoice_number}} for {{invoice_description}} was due on {{due_date}}. Your access will be set up as soon as it''s paid.

If you''ve already paid, you can ignore this email.', 'Pay {{amount}}', true),
  ('invoice.voided', 'Custom invoice: cancelled', 'billing',
   'Invoice {{invoice_number}} was cancelled', 'Its payment link no longer works.', 'Your invoice was cancelled',
   'Hi {{first_name}},

Invoice {{invoice_number}} for {{invoice_description}} has been cancelled and its payment link no longer works. Nothing was charged.

If you think this is a mistake, reply to this email.', null, true),
  ('invoice.payment_received', 'Custom invoice: payment received', 'billing',
   'Payment received for invoice {{invoice_number}}', 'Thank you, your access is being set up.', 'Payment received',
   'Hi {{first_name}},

Thank you, we''ve received your payment for {{invoice_description}}.

{{access_summary}}', 'Open {{brand_name}}', true),
  ('invoice.account_activation', 'Custom invoice: activate your account', 'auth',
   'Set up your {{brand_name}} account', 'Your courses are ready.', 'Your courses are ready',
   'Hi {{first_name}},

Your purchase of {{invoice_description}} is confirmed. Create your password to start learning. Your courses: {{course_list}}.

{{access_summary}}

This link can be used once and expires on {{expires_at}}.', 'Set up my account', true),
  ('company.contact_invitation', 'Company: primary contact invitation', 'auth',
   '{{company_name}} now has access to {{brand_name}}', 'Set up your account and invite your team.', 'Your team''s training is ready',
   'Hi {{first_name}},

{{company_name}}''s training package is active: {{course_list}}.

{{access_summary}}

As the company contact you can invite your colleagues. Each person gets their own login and their own progress. This link can be used once and expires on {{expires_at}}.', 'Set up my account', true),
  ('company.employee_invitation', 'Company: employee invitation', 'auth',
   '{{inviter_name}} invited you to {{company_name}} on {{brand_name}}', 'Join your team''s training.', 'You''re invited to join {{company_name}}',
   'Hi {{first_name}},

{{inviter_name}} invited you to join {{company_name}} on {{brand_name}}. You''ll get access to: {{course_list}}.

{{access_summary}}

This link can be used once and expires on {{expires_at}}.', 'Accept invitation', true),
  ('company.access_activated', 'Company: access activated', 'billing',
   '{{company_name}}''s {{brand_name}} access is active', 'Invite your team.', 'Your company access is active',
   'Hi {{first_name}},

{{company_name}}''s training package is active: {{course_list}}.

{{access_summary}}

You can invite colleagues from your company dashboard. Each person gets their own login and their own progress.', 'Open company dashboard', false),
  ('company.member_joined', 'Company: employee joined', 'communication',
   '{{member_name}} joined {{company_name}} on {{brand_name}}', 'Your team is growing.', '{{member_name}} accepted your invitation',
   'Hi {{first_name}},

{{member_name}} ({{member_email}}) accepted the invitation and now has access to {{company_name}}''s courses.', 'View team', false),
  ('company.member_removed', 'Company: access removed', 'billing',
   'Your {{company_name}} access on {{brand_name}} has ended', 'Your own account stays open.', 'Your company access has ended',
   'Hi {{first_name}},

You no longer have access to {{company_name}}''s courses on {{brand_name}}. Your account, your progress and any courses you bought yourself are not affected.', 'Open my courses', true),
  ('company.package_renewed', 'Company/individual: package renewed', 'billing',
   '{{package_name}} renewed', 'Access continues.', 'Your package renewed',
   'Hi {{first_name}},

{{package_name}} renewed and access continues. {{access_summary}}', 'Open {{brand_name}}', false),
  ('company.access_expiring', 'Company/individual: package ending soon', 'billing',
   '{{package_name}} ends on {{ends_at}}', 'Renew to keep learning.', 'Access ends on {{ends_at}}',
   'Hi {{first_name}},

Access to {{package_name}} ends on {{ends_at}}. Reply to this email if you''d like to renew or extend it.', 'Open {{brand_name}}', false),
  ('company.access_expired', 'Company/individual: package ended', 'billing',
   '{{package_name}} has ended', 'Reply to renew.', 'Your package has ended',
   'Hi {{first_name}},

Access to {{package_name}} ended on {{ended_at}}. Your progress and certificates are kept. Reply to this email if you''d like to renew.', 'Contact us', false)
on conflict (key) do nothing;

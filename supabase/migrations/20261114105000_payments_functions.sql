-- Payments & billing helpers (server-only). Additive to 20261114000400_commerce.sql.

-- Sequential document numbers for Foremint-issued receipts and credit notes.
create or replace function public.next_billing_document_number()
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  select nextval('public.billing_document_number_seq');
$$;
revoke execute on function public.next_billing_document_number() from public, anon, authenticated;
grant execute on function public.next_billing_document_number() to service_role;

-- Atomic stock counter for plans with limited availability.
create or replace function public.increment_plan_units_sold(p_plan uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  update public.pricing_plans
  set units_sold = units_sold + 1
  where id = p_plan
  returning units_sold;
$$;
revoke execute on function public.increment_plan_units_sold(uuid) from public, anon, authenticated;
grant execute on function public.increment_plan_units_sold(uuid) to service_role;

-- Atomic redemption counter for coupons, keyed by the synced Whop promo code.
create or replace function public.increment_coupon_redemptions(p_whop_promo_code_id text)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  update public.coupons
  set redemptions_count = redemptions_count + 1
  where whop_promo_code_id = p_whop_promo_code_id
  returning redemptions_count;
$$;
revoke execute on function public.increment_coupon_redemptions(text) from public, anon, authenticated;
grant execute on function public.increment_coupon_redemptions(text) to service_role;

-- One document per transaction, issuer and type: webhook retries and the
-- reconciliation job can call "create receipt" repeatedly without duplicates.
create unique index if not exists billing_documents_tx_issuer_type_uniq
  on public.billing_documents (transaction_id, issuer, document_type)
  where transaction_id is not null;

-- Claim failed webhook events for a retry run. SKIP LOCKED lets overlapping
-- cron invocations share the queue without processing an event twice.
create or replace function public.claim_failed_webhook_events(p_provider text, p_limit integer default 25)
returns setof public.webhook_events
language sql
volatile
security definer
set search_path = ''
as $$
  update public.webhook_events w
  set status = 'processing', attempts = w.attempts + 1
  where w.id in (
    select id from public.webhook_events
    where provider = p_provider
      and status = 'failed'
      and attempts < 12
      and (next_attempt_at is null or next_attempt_at <= now())
    order by received_at
    limit p_limit
    for update skip locked
  )
  returning w.*;
$$;
revoke execute on function public.claim_failed_webhook_events(text, integer) from public, anon, authenticated;
grant execute on function public.claim_failed_webhook_events(text, integer) to service_role;

-- Events stuck in "processing" (crashed request) become retryable.
create or replace function public.release_stale_webhook_events(p_provider text, p_older_than_minutes integer default 15)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.webhook_events
  set status = 'failed', last_error = coalesce(last_error, 'Processing timed out'), next_attempt_at = now()
  where provider = p_provider
    and status in ('processing', 'received')
    and received_at < now() - make_interval(mins => p_older_than_minutes)
    and processed_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.release_stale_webhook_events(text, integer) from public, anon, authenticated;
grant execute on function public.release_stale_webhook_events(text, integer) to service_role;

create index if not exists payment_transactions_checkout_idx on public.payment_transactions (checkout_session_id);
create index if not exists payment_transactions_subscription_idx on public.payment_transactions (subscription_record_id);
create index if not exists subscription_records_status_idx on public.subscription_records (status, current_period_end);
create index if not exists checkout_sessions_whop_idx on public.checkout_sessions (whop_checkout_id);
create index if not exists course_entitlements_checkout_idx on public.course_entitlements (checkout_session_id);
create index if not exists course_entitlements_subscription_idx on public.course_entitlements (subscription_record_id);

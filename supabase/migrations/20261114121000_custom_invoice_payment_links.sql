-- Custom invoices can be collected through a direct Whop checkout link
-- (default: anyone with the link can pay, no prior sign-in) or a native Whop
-- invoice (numbered invoice, PDF and reminders; only the invoiced customer can pay).
alter table public.custom_invoices
  add column collection_method text not null default 'payment_link'
  check (collection_method in ('payment_link', 'whop_invoice'));

alter table public.whop_invoice_mappings
  add column whop_checkout_configuration_id text unique;

insert into public.platform_settings (key, value, description, is_public) values
  ('invoicing.default_collection_method', '"payment_link"', 'Default for new custom invoices: payment_link (direct Whop checkout link) or whop_invoice (native Whop invoice).', false)
on conflict (key) do nothing;

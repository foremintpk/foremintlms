-- Foremint Academy — foundation
-- Extensions, private helper schema, shared enums and utility triggers.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Helper functions used by RLS live in a schema that PostgREST does not expose,
-- so they cannot be invoked directly as RPCs by clients.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- The three application roles. Authorization is always derived from
-- public.user_roles (never from editable auth metadata).
create type public.app_role as enum ('admin', 'teacher', 'student');

-- Generic updated_at trigger.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Slug sanity check used by several tables.
create or replace function private.is_valid_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(p_slug) between 1 and 120;
$$;

-- HTTP from the database. Used by pg_cron schedules that call /api/cron/*
-- (see docs/DEPLOYMENT.md) and for loading supabase/seed files.
create extension if not exists pg_net;

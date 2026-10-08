-- مواعيدنا — schema. Safe to run more than once (Supabase → SQL Editor → Run).

create extension if not exists pgcrypto; -- gen_random_uuid() (already on in Supabase)

create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  event_date    date not null,
  event_time    time,
  notes         text check (notes is null or char_length(notes) <= 2000),
  repeat_yearly boolean not null default false,
  created_by    text check (created_by is null or char_length(created_by) <= 60),
  created_at    timestamptz not null default now()
);
create index if not exists events_event_date_idx on events (event_date);

-- One row per day a digest was sent, so a double-fired cron cannot send twice.
create table if not exists reminder_runs (
  run_date date primary key,
  sent_at  timestamptz not null default now(),
  items    integer not null default 0
);

-- RLS on with no policies on purpose: the browser never talks to Supabase.
-- All access goes through the site's API routes with the service-role key.
alter table events        enable row level security;
alter table reminder_runs enable row level security;

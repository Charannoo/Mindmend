-- Run in Supabase: SQL Editor → New query → paste → Run (free tier OK).
-- Service role key on the backend bypasses RLS; anon users cannot touch these rows.

create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid (),
  clerk_id text not null unique,
  email text not null default '',
  first_name text,
  last_name text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid (),
  user_id text,
  user_email text,
  date text not null,
  mood_value integer not null,
  mood_label text not null,
  text text not null,
  affirmation text,
  created_at timestamptz not null default now()
);

create index if not exists journal_entries_user_id_idx on public.journal_entries (user_id);
create index if not exists journal_entries_created_idx on public.journal_entries (created_at desc);

alter table public.user_profiles enable row level security;
alter table public.journal_entries enable row level security;

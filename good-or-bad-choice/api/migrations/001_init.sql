-- The whole schema. Three tables, and two of them exist only so that a person
-- can see their taps on a second device.

create extension if not exists pgcrypto;

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- Case-insensitively unique, because nobody remembers whether they signed up as
-- Gabriel or gabriel. The original casing is kept for display.
create unique index if not exists users_username_key on users (lower(username));

create table if not exists sessions (
  -- The token itself is never stored, only its SHA-256. A database dump
  -- therefore contains no usable sessions.
  token_hash   text primary key,
  user_id      uuid not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists choices (
  -- Minted by the client, at the moment of the tap, before anything is sent.
  -- That is what makes syncing an upsert rather than a conversation: a retry
  -- after a dropped connection carries the same id and lands once.
  id         uuid primary key,
  user_id    uuid not null references users (id) on delete cascade,
  kind       text not null check (kind in ('good', 'bad')),
  -- When the tap happened, which is not when the row arrived. A week offline
  -- and then a sync must not pile a week of choices onto today.
  at         timestamptz not null,
  created_at timestamptz not null default now()
);

-- Every read is "this person, this stretch of time", in order.
create index if not exists choices_user_at_idx on choices (user_id, at);

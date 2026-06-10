-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ─── USERS ────────────────────────────────────────────────────────────────────
-- Note: Supabase Auth creates the auth.users table automatically.
-- This public.users table stores app-specific user data, linked to auth.users.
create table public.users (
  id            uuid          primary key references auth.users(id) on delete cascade,
  email         text          unique not null,
  display_name  text,
  created_at    timestamptz   not null default now(),
  streak_count  int           not null default 0,
  notif_enabled bool          not null default true
);

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
create table public.categories (
  id          uuid    primary key default gen_random_uuid(),
  user_id     uuid    references public.users(id) on delete cascade,
  -- user_id is NULL for system default categories
  name        text    not null,
  color       text    not null,
  is_default  bool    not null default false
);

-- ─── LINKS ────────────────────────────────────────────────────────────────────
create table public.links (
  id               uuid          primary key default gen_random_uuid(),
  user_id          uuid          not null references public.users(id) on delete cascade,
  url              text          not null,
  title            text,
  user_note        text,
  platform         text          not null default 'other',
  -- platform values: youtube | tiktok | instagram | linkedin | twitter | blog | other
  status           text          not null default 'pending',
  -- status values: pending | ready | done
  is_actioned      bool          not null default false,
  actioned_note    text,
  saved_at         timestamptz   not null default now(),
  actioned_at      timestamptz,
  reminder_count   int           not null default 0,
  next_reminder_at timestamptz   default (now() + interval '3 days')
);

-- ─── AI SUMMARIES ─────────────────────────────────────────────────────────────
create table public.ai_summaries (
  id                uuid          primary key default gen_random_uuid(),
  link_id           uuid          not null unique references public.links(id) on delete cascade,
  summary           text,
  key_points        jsonb,
  -- jsonb array of strings: ["point 1", "point 2", ...]
  resources         jsonb,
  -- jsonb array of objects: [{"name": "n8n", "type": "tool", "url": "https://n8n.io"}, ...]
  freshness_score   int,
  -- integer 1-10, AI estimated freshness
  is_time_sensitive bool          not null default false,
  created_at        timestamptz   not null default now()
);

-- ─── LINK CATEGORIES (join) ───────────────────────────────────────────────────
create table public.link_categories (
  link_id      uuid    not null references public.links(id) on delete cascade,
  category_id  uuid    not null references public.categories(id) on delete cascade,
  assigned_by  text    not null default 'ai',
  -- assigned_by values: 'ai' | 'user'
  primary key (link_id, category_id)
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
create table public.notifications (
  id        uuid          primary key default gen_random_uuid(),
  user_id   uuid          not null references public.users(id) on delete cascade,
  link_id   uuid          references public.links(id) on delete set null,
  -- link_id is NULL for digest notifications
  type      text          not null,
  -- type values: 'reminder' | 'urgent' | 'digest'
  sent_at   timestamptz   not null default now(),
  opened    bool          not null default false
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
-- Speed up the most common queries

-- Library screen: all links for a user, sorted by saved_at
create index idx_links_user_id on public.links(user_id);
create index idx_links_status on public.links(user_id, status);
create index idx_links_not_actioned on public.links(user_id, is_actioned) where is_actioned = false;

-- Reminder scheduler: find links due for reminders
create index idx_links_next_reminder on public.links(next_reminder_at) where is_actioned = false;

-- Summary lookup by link
create index idx_ai_summaries_link_id on public.ai_summaries(link_id);

-- Notifications by user
create index idx_notifications_user_id on public.notifications(user_id);

-- Link categories
create index idx_link_categories_link_id on public.link_categories(link_id);
create index idx_link_categories_category_id on public.link_categories(category_id);

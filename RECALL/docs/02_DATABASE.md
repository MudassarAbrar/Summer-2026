# Recall — Database Schema Spec

> AI agent: execute these SQL files in order inside your Supabase project.  
> Run via Supabase CLI: `supabase db push` or paste into the Supabase SQL editor.

---

## Migration 001 — Initial Schema

**File:** `supabase/migrations/001_initial_schema.sql`

```sql
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
```

---

## Migration 002 — Row Level Security

**File:** `supabase/migrations/002_rls_policies.sql`

```sql
-- ─── ENABLE RLS ON ALL TABLES ─────────────────────────────────────────────────
alter table public.users          enable row level security;
alter table public.categories     enable row level security;
alter table public.links          enable row level security;
alter table public.ai_summaries   enable row level security;
alter table public.link_categories enable row level security;
alter table public.notifications  enable row level security;

-- ─── USERS ────────────────────────────────────────────────────────────────────
create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- New user profile created via auth trigger (see below)

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
-- Users can see system defaults (user_id is null) AND their own custom categories
create policy "Users can read categories"
  on public.categories for select
  using (user_id is null or auth.uid() = user_id);

create policy "Users can create custom categories"
  on public.categories for insert
  with check (auth.uid() = user_id and is_default = false);

create policy "Users can update own categories"
  on public.categories for update
  using (auth.uid() = user_id and is_default = false);

create policy "Users can delete own categories"
  on public.categories for delete
  using (auth.uid() = user_id and is_default = false);

-- ─── LINKS ────────────────────────────────────────────────────────────────────
create policy "Users can read own links"
  on public.links for select
  using (auth.uid() = user_id);

create policy "Users can insert own links"
  on public.links for insert
  with check (auth.uid() = user_id);

create policy "Users can update own links"
  on public.links for update
  using (auth.uid() = user_id);

create policy "Users can delete own links"
  on public.links for delete
  using (auth.uid() = user_id);

-- ─── AI SUMMARIES ─────────────────────────────────────────────────────────────
-- Access granted through the link relationship
create policy "Users can read summaries for own links"
  on public.ai_summaries for select
  using (
    exists (
      select 1 from public.links
      where links.id = ai_summaries.link_id
      and links.user_id = auth.uid()
    )
  );

-- Edge Function inserts summaries using the service role key (bypasses RLS)
-- No insert/update policy needed for regular users

-- ─── LINK CATEGORIES ──────────────────────────────────────────────────────────
create policy "Users can read own link categories"
  on public.link_categories for select
  using (
    exists (
      select 1 from public.links
      where links.id = link_categories.link_id
      and links.user_id = auth.uid()
    )
  );

create policy "Users can manage own link categories"
  on public.link_categories for all
  using (
    exists (
      select 1 from public.links
      where links.id = link_categories.link_id
      and links.user_id = auth.uid()
    )
  );

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- ─── AUTH TRIGGER ─────────────────────────────────────────────────────────────
-- Automatically create a public.users row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## Migration 003 — pgvector (Semantic Search)

**File:** `supabase/migrations/003_pgvector.sql`

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding column to ai_summaries
alter table public.ai_summaries
  add column if not exists embedding vector(768);

-- Create vector similarity search index (IVFFlat for fast approximate search)
create index if not exists idx_ai_summaries_embedding
  on public.ai_summaries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Function for semantic search
-- Called from the app with a query embedding vector
create or replace function search_links(
  query_embedding  vector(768),
  user_id_param    uuid,
  match_count      int default 10
)
returns table (
  link_id          uuid,
  similarity       float
)
language sql stable
as $$
  select
    s.link_id,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.ai_summaries s
  inner join public.links l on l.id = s.link_id
  where l.user_id = user_id_param
    and s.embedding is not null
  order by s.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## Migration 004 — pg_cron Scheduled Jobs

**File:** `supabase/migrations/004_pg_cron_jobs.sql`

```sql
-- Enable pg_cron (must be done from Supabase dashboard in some plans)
-- Dashboard → Database → Extensions → enable pg_cron

-- ─── DAILY REMINDER JOB ───────────────────────────────────────────────────────
-- Runs every day at 9:00 AM UTC
-- Calls the send-reminders Edge Function
select cron.schedule(
  'daily-reminders',
  '0 9 * * *',
  $$
    select net.http_post(
      url := current_setting('app.edge_function_url') || '/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ─── WEEKLY DIGEST JOB ────────────────────────────────────────────────────────
-- Runs every Sunday at 10:00 AM UTC
select cron.schedule(
  'weekly-digest',
  '0 10 * * 0',
  $$
    select net.http_post(
      url := current_setting('app.edge_function_url') || '/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"type": "digest"}'::jsonb
    );
  $$
);
```

---

## Seed Data

**File:** `supabase/seed.sql`

```sql
-- Insert default system categories (user_id = null, is_default = true)
insert into public.categories (id, user_id, name, color, is_default) values
  (gen_random_uuid(), null, 'Tools & Apps',   '#378ADD', true),
  (gen_random_uuid(), null, 'Courses',         '#1D9E75', true),
  (gen_random_uuid(), null, 'Opportunities',   '#BA7517', true),
  (gen_random_uuid(), null, 'Inspiration',     '#7F77DD', true),
  (gen_random_uuid(), null, 'Resources',       '#639922', true),
  (gen_random_uuid(), null, 'News & Trends',   '#D85A30', true),
  (gen_random_uuid(), null, 'Locations',       '#D4537E', true),
  (gen_random_uuid(), null, 'Reference',       '#888780', true);
```

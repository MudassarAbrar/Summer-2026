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
    and exists (
      select 1 from public.categories
      where categories.id = link_categories.category_id
      and (categories.user_id is null or categories.user_id = auth.uid())
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

-- Trigger to auto-confirm new users in auth.users
create or replace function public.auto_confirm_new_user()
returns trigger
language plpgsql
security definer set search_path = pg_catalog, pg_temp
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

-- Drop trigger if it already exists on either table to avoid schema conflicts
drop trigger if exists on_auth_user_before_insert on auth.users;

do $$
begin
  if exists (
    select 1 
    from information_schema.tables 
    where table_schema = 'public' 
      and table_name = 'users'
  ) then
    execute 'drop trigger if exists on_auth_user_before_insert on public.users';
  end if;
end $$;

-- Create the trigger on auth.users table
create trigger on_auth_user_before_insert
  before insert on auth.users
  for each row execute procedure public.auto_confirm_new_user();

-- Auto-confirm any existing users who are currently unconfirmed
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;

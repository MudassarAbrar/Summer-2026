-- Create increment_streak function to update user streak counts
create or replace function public.increment_streak(user_id_param uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.users
  set streak_count = streak_count + 1
  where id = user_id_param;
end;
$$;

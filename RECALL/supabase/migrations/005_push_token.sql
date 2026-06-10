-- Add push_token column to users table
alter table public.users
  add column if not exists push_token text;

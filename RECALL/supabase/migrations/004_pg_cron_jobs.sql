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

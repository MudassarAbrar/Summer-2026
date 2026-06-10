# Supabase Edge Functions — required environment variables

Store these environment variables in the Supabase dashboard (Settings → Edge Functions → Environment Variables) — do NOT put secret keys in client apps.

- `SUPABASE_URL` — your Supabase project URL (e.g. `https://xyz.supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY` — server-side service role key for privileged DB operations (keep secret).
- `GEMINI_API_KEY` — API key for Gemini (Google AI Studio) if used as primary LLM.
- `GROQ_API_KEY` — API key for Groq (fallback LLM) if used.
- `AI_API_URL` — Optional: custom AI API base URL if you proxy or use non-standard endpoints.
- `AI_PROVIDER` — Optional: `gemini` or `groq` to control which provider to call by default.
- `EXPO_PUSH_TOKEN` — Expo push notification access token for sending pushes (if using Expo push service).

Optional dev helpers (do NOT use in production unless rotated frequently):
- `DEV_SUPABASE_ANON_KEY` — anon key for non-privileged requests during local testing.

Security notes:
- Never commit these values to source control. Use Supabase dashboard secret storage.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` periodically.

# Recall — Deployment & Setup Guide

This guide walks through setting up Recall from scratch: database, Supabase configuration, workspace, and running the apps locally.

## Table of Contents

1. [Supabase Setup](#supabase-setup)
2. [Environment Variables](#environment-variables)
3. [Workspace Initialization](#workspace-initialization)
4. [Running Apps](#running-apps)

---

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"** and fill in:
   - **Organization**: your account
   - **Name**: `recall`
   - **Database Password**: save this somewhere safe
   - **Region**: closest to you
3. Wait for the project to initialize (~2 min)

### 2. Deploy Database Migrations

#### Option A: Using Supabase CLI (Recommended)

```bash
npm install -g supabase
supabase link --project-id <your-project-id>
supabase db push
```

#### Option B: Manual SQL via Dashboard

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Copy and paste each migration file in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_pgvector.sql`
   - `supabase/migrations/004_pg_cron_jobs.sql`
3. After each, click **Run**

#### Option C: Direct File Upload

1. Go to **Database** → **Migrations** in Supabase dashboard
2. Upload migration files one at a time

### 3. Run Seed Data

In the **SQL Editor**, run:

```sql
-- Insert default system categories
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

### 4. Enable Extensions

Go to **Database** → **Extensions** in Supabase dashboard and enable:

- ✅ `uuid-ossp` (likely already enabled)
- ✅ `vector` (for pgvector similarity search)
- ✅ `pg_cron` (for scheduled reminder jobs)

### 5. Get Your Credentials

In Supabase dashboard, go to **Settings** → **API**:

- Copy **Project URL** (e.g. `https://xyz.supabase.co`)
- Copy **anon public** key (for client apps)

You'll need these for `.env` files later.

---

## Environment Variables

### Supabase Edge Functions Environment Variables

These are **secrets** used by the `process-link` and `send-reminders` Edge Functions. They must be set in Supabase, NOT in your client `.env`.

1. In Supabase dashboard, go to **Settings** → **Edge Functions**
2. Click **Environment Variables** and add:

| Key | Value | Where to Get |
|-----|-------|-------------|
| `SUPABASE_URL` | `https://xyz.supabase.co` | From Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | From Settings → API (keep secret!) |
| `GEMINI_API_KEY` | From Google AI Studio | [ai.google.dev](https://ai.google.dev) → Get API key |
| `GROQ_API_KEY` | From Groq console | [console.groq.com](https://console.groq.com) → API keys |
| `EXPO_PUSH_TOKEN` | Your Expo access token | Run `expo whoami` then `expo login` |

### Client App Environment Variables

Once you have the Supabase credentials:

**`apps/mobile/.env`** (copy from `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**`apps/web/.env.local`** (copy from `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Workspace Initialization

### Prerequisites

- **Node.js**: v18 or higher
- **pnpm**: `npm install -g pnpm` (or use `npm` if you prefer)

### Install Dependencies

```bash
cd /path/to/RECALL
pnpm install
```

This installs dependencies for all workspaces: `apps/mobile`, `apps/web`, and `packages/shared`.

### Verify Installation

```bash
pnpm list
```

You should see all three workspaces listed.

---

## Running Apps

### Mobile App (Expo)

```bash
cd apps/mobile
pnpm dev
```

> **First time?** You'll be prompted to create an Expo account and link the project.

Press `i` for iOS simulator or `a` for Android emulator.

### Web App (Next.js)

```bash
cd apps/web
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

### Both (in parallel)

From repo root:

```bash
pnpm dev
```

---

## Troubleshooting

**"SUPABASE_URL is not set"**
- Make sure `.env` files exist in `apps/mobile` and `apps/web`
- Check that values are correct (starting with `https://`)

**"pnpm: command not found"**
- Install: `npm install -g pnpm`
- Or use `npm` instead: `npm run dev` (from root)

**"Expo not found"**
- Install globally: `npm install -g expo-cli`
- Or use via pnpm: `pnpm exec expo start`

**"Next.js port 3000 already in use"**
- Kill the process: `lsof -i :3000` then `kill -9 <PID>`
- Or run on different port: `pnpm dev -- -p 3001`

**Migrations failed in Supabase**
- Check the SQL syntax matches version from docs
- Verify `pgvector` and `pg_cron` extensions are enabled
- Review error message in Supabase dashboard SQL editor

---

## Next Steps

1. ✅ Database deployed
2. ✅ Workspace initialized
3. ⏳ Implement auth screens (Supabase Auth UI)
4. ⏳ Mobile: Test share sheet capture
5. ⏳ Web: Test URL form submission
6. ⏳ Deploy to Vercel (web) and TestFlight/Google Play (mobile)

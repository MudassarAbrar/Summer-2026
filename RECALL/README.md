# Recall — Complete Project Setup

Welcome! This document summarizes what has been created and the next steps to get the app running.

## ✅ What's Been Created

### 1. **Database & Backend**
- ✅ SQL migrations (4 files) with full schema, RLS policies, pgvector, and cron jobs
- ✅ Seed data for 8 default categories
- ✅ `process-link` Edge Function that fetches URLs, calls Gemini/Groq, and stores summaries

### 2. **Mobile App** (Expo + React Native)
- ✅ Auth screens (login, signup)
- ✅ Tab-based navigation (Library, Search, Add, Alerts, Stats)
- ✅ Library screen showing saved links
- ✅ Add URL screen (manual paste)
- ✅ Link detail screen
- ✅ Supabase + Zustand integration
- ✅ Real-time hooks for fetching links

### 3. **Web App** (Next.js 15)
- ✅ Auth screens (login)
- ✅ Dashboard with link feed
- ✅ Add URL form
- ✅ Responsive design
- ✅ Supabase integration

### 4. **Shared Package**
- ✅ TypeScript types (Link, User, Category, Notification, AISummary)
- ✅ Utility functions (platform detection, date formatting)
- ✅ Constants (platform patterns, default categories)

### 5. **Browser Extension** (Manifest V3)
- ✅ Popup HTML and basic JS
- ✅ Ready for further implementation

### 6. **Documentation**
- ✅ `DEPLOYMENT.md` — complete setup guide for Supabase, env vars, and running apps

---

## 🚀 Quick Start

### Step 1: Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run migrations (see `DEPLOYMENT.md` for details)
3. Enable extensions: `uuid-ossp`, `vector`, `pg_cron`
4. Seed default categories
5. Get your `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Settings → API

### Step 2: Set Environment Variables

**Mobile** (`apps/mobile/.env` — copy from `.env.example`):
```env
EXPO_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Web** (`apps/web/.env.local` — copy from `.env.local.example`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Supabase Edge Functions** (set in Supabase dashboard → Settings → Edge Functions):
```env
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=from-ai.google.dev
GROQ_API_KEY=from-console.groq.com
```

### Step 3: Run the Apps

```bash
# Install dependencies
pnpm install

# Run both mobile and web in development mode
pnpm dev

# Or individually:
cd apps/mobile && pnpm dev
cd apps/web && pnpm dev
```

---

## 📋 What's Next

### Immediate (Phase 1 — MVP)

1. **Mobile Share Intent** — Integrate `expo-share-intent` to capture shares from other apps
2. **Push Notifications** — Set up Expo push notifications with reminder scheduler
3. **Test Core Flow** — Save a link, verify AI processing, check summary appears
4. **Browser Extension** — Implement save button to call Recall API

### Phase 2 — Smart Features

1. **Semantic Search** — Implement pgvector search with embeddings
2. **Stats Screen** — Query and display user statistics
3. **Action Tracking** — Implement mark-as-actioned flow
4. **Notification Reminders** — Trigger scheduled reminders daily

### Phase 3 — Public Launch

1. **Spaces** — Shared link libraries for teams
2. **Export** — CSV/JSON export functionality
3. **Landing Page** — Marketing site
4. **App Store Submission** — iOS App Store and Google Play

---

## 🗂️ Project Structure

```
RECALL/
├── DEPLOYMENT.md           # Deployment guide
├── package.json            # Root workspace config
├── pnpm-workspace.yaml     # Pnpm workspaces definition
├── apps/
│   ├── mobile/             # Expo app
│   │   ├── app/           # Expo Router pages
│   │   ├── hooks/         # Custom hooks (useLinks, useShareIntent)
│   │   ├── stores/        # Zustand stores
│   │   └── lib/           # Utilities (Supabase client)
│   └── web/               # Next.js app
│       ├── app/           # App router pages
│       └── lib/           # Utilities
├── packages/
│   └── shared/            # Shared types & utilities
├── extension/             # Browser extension (Manifest V3)
└── supabase/
    ├── migrations/        # SQL migrations
    ├── functions/         # Edge Functions
    └── seed.sql          # Seed data
```

---

## 🔧 Troubleshooting

**"Module not found: @recall/shared"**
- Make sure `pnpm install` completed without errors
- Check that `packages/shared/package.json` exists

**"SUPABASE_URL not found"**
- Verify `.env` files are in place and filled correctly
- Check that env variable names exactly match the Expected values in `.env.example`

**"Port 3000 already in use"**
- Kill the process: `lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9`
- Or run on different port: `pnpm dev -- -p 3001`

**Expo app won't start**
- Clear cache: `pnpm exec expo start --clear`
- Make sure Node.js version is 18+: `node --version`

---

## 📝 Key Files to Review

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Full setup instructions
- [supabase/migrations/001_initial_schema.sql](./supabase/migrations/001_initial_schema.sql) — Database schema
- [supabase/functions/process-link/index.ts](./supabase/functions/process-link/index.ts) — AI processing pipeline
- [apps/mobile/app/_layout.tsx](./apps/mobile/app/_layout.tsx) — Mobile navigation
- [apps/web/app/dashboard/page.tsx](./apps/web/app/dashboard/page.tsx) — Web dashboard

---

## 💡 Tips

- Always run `pnpm install` after pulling changes that modify `package.json`
- Use Supabase dashboard RLS policies testing tool to verify security
- Test the `process-link` function in Supabase Edge Functions editor before production
- For mobile testing, use Expo Go app for quick iteration

---

## 🤝 Contributing

When adding new features:
1. Add types to `packages/shared/types/`
2. Add shared utilities to `packages/shared/utils/`
3. Update migrations if schema changes
4. Test on both mobile and web

---

Good luck! 🚀

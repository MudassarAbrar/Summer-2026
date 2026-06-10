# Recall — Project Structure & Architecture Spec

> **Read this first before any other spec file.**  
> This file defines the folder structure, naming conventions, environment setup, and architecture decisions that all other spec files depend on.

---

## Stack Summary

| Layer | Tool | Version |
|-------|------|---------|
| Mobile framework | Expo + React Native | SDK 52+ |
| Navigation | Expo Router v4 | file-based |
| State | Zustand | 5.x |
| Backend | Supabase | latest |
| AI primary | Gemini 2.0 Flash | via Google AI Studio API |
| AI fallback | Groq Llama 3.3 70B | via Groq API |
| Web | Next.js 15 (App Router) | latest |
| Web hosting | Vercel | free hobby |
| Extension | Manifest V3 | vanilla JS |

---

## Monorepo Structure

```
recall/
├── apps/
│   ├── mobile/               # Expo React Native app
│   └── web/                  # Next.js web dashboard
├── packages/
│   ├── shared/               # Types, constants, utils shared across apps
│   └── ui/                   # Shared UI components (optional Phase 2)
├── extension/                # Browser extension (Manifest V3)
├── supabase/
│   ├── migrations/           # SQL migration files
│   ├── functions/            # Edge Functions
│   │   ├── process-link/     # AI processing pipeline
│   │   └── send-reminders/   # Notification scheduler
│   └── seed.sql              # Default categories seed data
├── specs/                    # All spec MD files (this folder)
└── README.md
```

---

## Mobile App Structure (`apps/mobile/`)

```
apps/mobile/
├── app/                      # Expo Router pages (file = route)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab bar definition
│   │   ├── index.tsx         # Library screen (home)
│   │   ├── search.tsx        # Semantic search screen
│   │   ├── add.tsx           # Manual URL add screen
│   │   ├── alerts.tsx        # Notifications/reminders screen
│   │   └── stats.tsx         # Stats screen
│   ├── link/
│   │   └── [id].tsx          # Link detail screen
│   ├── action/
│   │   └── [id].tsx          # Mark as actioned screen
│   └── _layout.tsx           # Root layout (auth guard)
├── components/
│   ├── cards/
│   │   ├── LinkCard.tsx      # Summary card in library
│   │   └── NotifCard.tsx     # Notification item card
│   ├── sheets/
│   │   └── ShareSheet.tsx    # Bottom sheet on share intent
│   ├── ui/
│   │   ├── Badge.tsx         # Category badge
│   │   ├── Chip.tsx          # Resource chip
│   │   ├── FreshnessBar.tsx  # Visual freshness indicator
│   │   ├── PlatformIcon.tsx  # Platform favicon/icon
│   │   └── StreakBadge.tsx   # Day streak indicator
│   └── layout/
│       └── ScreenHeader.tsx
├── hooks/
│   ├── useLinks.ts           # Fetch + filter links from Supabase
│   ├── useCategories.ts      # Fetch user categories
│   ├── useSearch.ts          # Semantic search hook
│   └── useNotifications.ts   # Expo push notification setup
├── stores/
│   ├── authStore.ts          # Zustand: user session
│   ├── linkStore.ts          # Zustand: cached links list
│   └── categoryStore.ts      # Zustand: categories list
├── lib/
│   ├── supabase.ts           # Supabase client init
│   ├── notifications.ts      # Expo push token registration
│   └── platforms.ts          # Platform detection from URL
├── constants/
│   ├── categories.ts         # Default category definitions
│   └── colors.ts             # App color tokens
└── app.json                  # Expo config
```

---

## Web App Structure (`apps/web/`)

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx          # Library view
│   │   ├── search/page.tsx
│   │   └── stats/page.tsx
│   ├── link/[id]/page.tsx    # Link detail
│   └── layout.tsx
├── components/               # Same component names as mobile where possible
├── lib/
│   └── supabase.ts           # Supabase client (browser)
└── next.config.ts
```

---

## Browser Extension Structure (`extension/`)

```
extension/
├── manifest.json             # Manifest V3 config
├── popup.html                # Extension popup UI
├── popup.js                  # Popup logic
├── background.js             # Service worker (optional)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Supabase Structure (`supabase/`)

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   ├── 003_pgvector.sql
│   └── 004_pg_cron_jobs.sql
├── functions/
│   ├── process-link/
│   │   └── index.ts          # Fetch URL + call Gemini + write summary
│   └── send-reminders/
│       └── index.ts          # Check overdue reminders + send push notifs
└── seed.sql                  # Default categories (8 system categories)
```

---

## Shared Package (`packages/shared/`)

```
packages/shared/
├── types/
│   ├── link.ts               # Link, AIStummary, LinkWithSummary types
│   ├── category.ts           # Category type
│   ├── notification.ts       # Notification type
│   └── user.ts               # User type
├── constants/
│   └── platforms.ts          # Platform enum + URL patterns
└── utils/
    ├── platform.ts           # Detect platform from URL
    └── format.ts             # Date, truncation helpers
```

---

## Environment Variables

### Mobile (`apps/mobile/.env`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Supabase Edge Functions (set via Supabase dashboard → Settings → Edge Functions)
```
GEMINI_API_KEY=
GROQ_API_KEY=
EXPO_PUSH_TOKEN=          # Expo push notification access token
```

> **Never** put Gemini or Groq keys in the client apps. They must only live in Edge Function environment variables.

---

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Components | PascalCase | `LinkCard.tsx` |
| Hooks | camelCase with `use` prefix | `useLinks.ts` |
| Stores | camelCase with `Store` suffix | `linkStore.ts` |
| Supabase functions | kebab-case | `process-link/` |
| DB tables | snake_case | `ai_summaries` |
| DB columns | snake_case | `is_actioned` |
| Routes (Expo Router) | kebab-case | `link/[id].tsx` |
| Constants | SCREAMING_SNAKE | `DEFAULT_CATEGORIES` |
| Types/Interfaces | PascalCase | `LinkWithSummary` |

---

## Architecture Decisions

### Why Expo over bare React Native
- Faster setup for solo developer
- expo-share-intent handles the share sheet without native code changes
- Expo Push Notifications handles iOS + Android without separate APNs/FCM setup
- Expo Router gives clean file-based navigation

### Why Supabase over custom backend
- Auth, database, storage, edge functions, realtime, and pgvector in one free service
- pg_cron for scheduled reminder jobs without a separate cron server
- Row-level security means data isolation is handled at database level, not app level

### Why Gemini over GPT-4
- Permanently free tier (1,500 req/day) — no credit card required
- Native YouTube URL understanding — no transcript scraping needed
- 1M token context window — handles very long articles
- Gemini text-embedding also free — needed for semantic search

### Why Groq as fallback
- Fastest free AI API available (low latency)
- 14,400 free requests per day
- OpenAI-compatible API — same prompt format as Gemini with minimal changes

### Why Monorepo
- Mobile and web share types (packages/shared/types)
- Supabase schema and migrations live in one place
- Single repo for the browser extension, backend, mobile, and web

### Data flow pattern
```
Client (mobile/web/extension)
  → Supabase (save link, trigger webhook)
  → Edge Function (process-link)
  → Gemini API (AI processing)
  → Supabase (write summary back)
  → Supabase Realtime (push update to client)
```
Clients never call AI APIs directly. All AI happens server-side in Edge Functions.

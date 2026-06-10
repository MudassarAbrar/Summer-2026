# Recall — Product Requirements Document

**Version:** 1.0  
**Date:** June 2026  
**Status:** Draft  
**Platform:** Mobile (iOS/Android) + Browser Extension + Web Dashboard

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem & Solution](#2-problem--solution)
3. [Target Users](#3-target-users)
4. [Core Loop](#4-core-loop)
5. [Feature Requirements](#5-feature-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technology Stack](#7-technology-stack)
8. [Data Model](#8-data-model)
9. [User Flows](#9-user-flows)
10. [Known Risks & Mitigations](#10-known-risks--mitigations)
11. [Build Phases](#11-build-phases)
12. [Open Questions](#12-open-questions)

---

## 1. Product Overview

**Recall** is an intelligent content memory system. You share any link to it — from any platform, any device — and it visits the link, reads and summarizes the content with AI, extracts any tools or resources mentioned, categorizes it automatically, and persistently reminds you until you have actually acted on it.

When you mark something done, it moves to your permanent archive — but never disappears.

> **Tagline:** Save it once. Never forget it. Always act on it.

---

## 2. Problem & Solution

### The Problem

People who consume large amounts of online content — YouTube videos, TikToks, LinkedIn posts, blog articles, Instagram posts — routinely save content across a dozen different platforms:

- YouTube watch-later lists
- Browser bookmarks
- Instagram saved posts
- LinkedIn saved posts
- Downloaded files and screenshots

The content sits there for weeks or months. It never gets revisited. The consequences are real:

- Time-sensitive opportunities expire unnoticed
- Useful tools are forgotten before being tried
- Courses never get started
- The entire effort of saving was wasted

This is the **"save and forget" problem**.

### The Solution

Recall breaks the save-and-forget loop with three things no other app combines:

1. **Universal capture** — one tap from any platform via share sheet or browser extension
2. **AI understanding** — summary, resource extraction, and categorization happen automatically
3. **Persistent accountability** — reminders fire until you act, not just once

### Key Differentiators

| App | What it does | What it lacks vs Recall |
|-----|-------------|------------------------|
| Pocket / Raindrop | Save and organize links | No AI summary, no resource extraction, no persistent reminders, no action tracking |
| Browser bookmarks | Save URLs | No organization, no reminders, no intelligence |
| YouTube Watch Later | Save videos | Platform-locked, no reminders, no summaries |
| **Recall** | Save, understand, remind, act | — |

---

## 3. Target Users

### Primary (Phase 1 — Personal)
Students and young professionals who consume high volumes of content daily — tutorials, tools, opportunities, courses, resources — and struggle to act on what they save. Specifically: builders, developers, entrepreneurs, and learners active on YouTube, LinkedIn, TikTok, Instagram, and the broader web.

### Secondary (Phase 3 — Public Launch)
Anyone with a save-and-forget habit across any platform. Every person with a watch-later list or bookmark folder they never revisit.

---

## 4. Core Loop

```
User shares link
      ↓
Share sheet / browser extension captures URL
      ↓
Saved to Supabase with status: pending
      ↓
Edge Function triggered
      ↓
Fetch URL content server-side
      ↓
Gemini API: summarize + extract resources + categorize + score freshness
      ↓
Write results to ai_summaries table
      ↓
Card appears in library — ready to review
      ↓
Reminder fires until user acts
      ↓
User marks done → archived forever
```

---

## 5. Feature Requirements

### P0 — Must Have (MVP)

#### F-01: Mobile Share Sheet Capture
- App registers as a share target on iOS and Android
- When user shares any URL to Recall, a bottom sheet opens showing the URL title and an optional note input
- User adds optional note ("try this automation idea") to help AI categorize
- User taps Save → returned to originating app immediately, no waiting
- Link sent to backend in background
- **Implementation:** `expo-share-intent` package

#### F-02: Browser Extension Capture
- Manifest V3 extension for Chrome, Edge, Brave, Firefox
- Toolbar button opens a popup with current page title, URL, optional note, and Save button
- On Save: calls Recall API with URL + note + auth token
- Shows confirmation: "Saved to Recall ✓"
- Works independently of mobile app

#### F-03: Manual URL Paste
- Add tab in mobile app with a URL input field
- Web dashboard input field for desktop users
- Fallback for platforms where share sheet is unavailable

#### F-04: AI Processing Pipeline
- Triggered automatically when a link is saved (database webhook → Edge Function)
- Fetches URL content server-side
- Calls Gemini 2.0 Flash with structured prompt
- Gemini returns JSON with: `summary`, `key_points`, `resources`, `suggested_category`, `is_time_sensitive`, `freshness_score`
- Results written to `ai_summaries` table
- Link status updated: `pending → ready`
- **YouTube:** URL passed directly to Gemini — it reads YouTube transcripts natively, no scraping needed
- **Paywalled content:** Falls back to title + domain + user note. Card shows: "Full content unavailable — summary based on title and your note."
- **TikTok/Instagram:** Title + caption + user note used. Full transcript not available.
- **Fallback AI:** If Gemini daily limit hit, falls back to Groq (Llama 3.3 70B) with identical prompt

#### F-05: Summary Card
Every saved link rendered as a card in the library containing:
- Platform icon (YouTube, LinkedIn, TikTok, etc.)
- Content title
- 2–4 sentence AI summary
- Resources row: chips for every tool/app mentioned inside the content
- Category badge with color
- Platform + time saved ("YouTube · 3 days ago")
- Status: Not actioned / Urgent (red) / Actioned (green, reduced opacity)

#### F-06: Link Detail Screen
Full detail view for a saved link:
- Full title + platform icon
- Category badge + saved timestamp
- Full AI summary (expanded)
- Key points: 3–5 bullet takeaways
- Tools & resources mentioned: full list with name and type
- User's note (if added at save)
- Freshness bar: color-coded green/amber/red
- Buttons: Mark as actioned (primary), Open link, Edit category

#### F-07: Categorization
**Default categories:**
| Category | Description |
|----------|-------------|
| Tools & Apps | Software, AI models, web apps, developer tools |
| Courses | Tutorials, learning resources, how-to guides |
| Opportunities | Jobs, grants, applications, deadlines, events |
| Inspiration | Ideas, case studies, success stories |
| Resources | Templates, frameworks, reference material |
| News & Trends | Industry news, launches, trending topics |
| Locations | Places, restaurants, travel destinations |
| Reference | Articles saved for future reference |

- AI suggests category automatically on processing
- User can override from detail screen or long-press card
- Users can create custom categories with name and color
- `assigned_by` field records `ai` or `user`

#### F-08: Reminder & Notification System
- **Time-sensitive alerts:** When `is_time_sensitive = true`, push notification sent immediately. Message references the content: "YC S25 applications close in 4 days — you saved this 6 days ago."
- **Persistent nudge schedule:**
  - Day 3: first reminder
  - Day 7: second reminder
  - Day 14: third reminder
  - Day 30: final reminder → moves to "long dormant" state
- **Weekly digest:** Every Sunday, notification summarizing unactioned items by urgency. Opens Alerts screen filtered by urgency.
- **Grouped reminders:** If 3+ items share a category and are unactioned: "You have 4 saved items about Supabase — want to review them together?"
- **Implementation:** Supabase `pg_cron` + Edge Functions + Expo Push Notifications

#### F-09: Action Tracking
When user marks a link as actioned:
- Mark as Actioned screen shows quick action buttons: Watched it / Read it / Tried the tool / Applied or signed up
- Optional free-text note: "What did you do?"
- Link updated: `is_actioned = true`, `actioned_at = now()`, `actioned_note = text`
- Link stays in library permanently — never deleted
- Actioned cards shown with reduced opacity + green checkmark
- Reminders stop immediately

---

### P1 — Important (Phase 2)

#### F-10: Semantic Search
- Search bar on Search tab
- Query converted to embedding via Gemini text-embedding model
- pgvector similarity search across all user's links
- Returns top 10 results ranked by semantic relevance
- Fallback: keyword search on title and summary text
- Enables: "find that video about cold email" even without exact title match

#### F-11: Stats Screen
- Total saved (lifetime)
- Actioned count
- Action rate % (actioned / total)
- Day streak (consecutive days with at least one action)
- Bar chart: links saved per category
- Unactioned count with time-sensitive highlight

#### F-12: Freshness Scoring
- Visual freshness bar on detail screen
- Green = score 7–10 (still relevant)
- Amber = score 4–6 (may be outdated)
- Red = score 1–3 (likely outdated)
- Score assigned by AI during processing

#### F-13: Cross-link Detection
- If 3+ unactioned links share same category, surface them grouped in reminders
- "You have 4 saved items about n8n — want to review them together?"
- Tapping opens library filtered to that category

#### F-14: Action Notes History
- Log of all actioned items with the user's notes
- Accessible from Stats screen as "What I've done"
- Useful for reflecting on execution over time

---

### P2 — Nice to Have (Phase 3)

#### F-15: Spaces (Shared Libraries)
- Shared category workspace for a team or community
- Members can add links to a shared space
- Shared library visible to all space members

#### F-16: Export
- Export full library as CSV or JSON
- Fields: URL, title, summary, category, saved_at, actioned_at, actioned_note

#### F-17: Link Expiry Detection
- Periodically re-check saved URLs for 404 or removed content
- Flag expired links in the library

---

## 6. Non-Functional Requirements

| Requirement | Specification |
|-------------|---------------|
| Processing time | Summary and categorization completed within 30 seconds for standard web content |
| Notification delivery | Push notifications delivered within 60 seconds of trigger |
| Search latency | Semantic search results returned within 2 seconds |
| App cold start | Under 3 seconds on mid-range Android device |
| Offline behavior | Library browsable offline; saving requires network |
| Data retention | Links never deleted — only archived. User data retained indefinitely |
| Auth security | JWT tokens via Supabase Auth; row-level security on all tables |
| API key security | Gemini and Groq keys stored as Edge Function env variables — never in client |
| Scalability | Supabase free tier supports personal use + early public launch. Queue system before exceeding Gemini limits at scale |

---

## 7. Technology Stack

> **Constraint:** Zero cost. All tools free or covered by GitHub Student Developer Pack.

### Mobile
| Layer | Tool | Cost |
|-------|------|------|
| Framework | Expo + React Native | Free |
| Share sheet | expo-share-intent | Free |
| Push notifications | Expo Push Notifications | Free |
| Navigation | Expo Router | Free |
| State management | Zustand | Free |
| iOS testing | TestFlight | Free |
| iOS public | App Store | $99/year (deferred) |
| Android public | Google Play | $25 one-time |

### Backend
| Layer | Tool | Cost |
|-------|------|------|
| Database | Supabase (Postgres) | Free (500MB, 50k MAU) |
| Auth | Supabase Auth | Free |
| Serverless | Supabase Edge Functions | Free (500k/month) |
| Scheduler | Supabase pg_cron | Free |
| Vector search | pgvector via Supabase | Free |
| Realtime | Supabase Realtime | Free |
| Storage | Supabase Storage | Free (1GB) |

### Web & Extension
| Layer | Tool | Cost |
|-------|------|------|
| Web framework | Next.js (App Router) | Free |
| Hosting | Vercel | Free (hobby tier) |
| Browser extension | Manifest V3 (vanilla JS) | Free |
| Domain | get.tech via Student Pack | Free (1 year) |
| Design | Figma via Student Pack | Free |

### AI
| Layer | Tool | Cost |
|-------|------|------|
| Primary AI | Gemini 2.0 Flash | Free (1,500 req/day) |
| YouTube summaries | Gemini native YouTube support | Free (same tier) |
| Embeddings | Gemini text-embedding | Free |
| AI fallback | Groq Llama 3.3 70B | Free (14,400 req/day) |

### Developer Tools (Student Pack)
| Tool | Purpose |
|------|---------|
| GitHub Copilot Pro | AI code completion |
| GitHub Actions | CI/CD |
| Sentry | Error monitoring |

---

## 8. Data Model

### Table: users
```sql
id            uuid          PRIMARY KEY  -- auto by Supabase Auth
email         text          UNIQUE NOT NULL
display_name  text
created_at    timestamptz   DEFAULT now()
streak_count  int           DEFAULT 0
notif_enabled bool          DEFAULT true
```

### Table: links
```sql
id               uuid          PRIMARY KEY DEFAULT gen_random_uuid()
user_id          uuid          REFERENCES users(id) ON DELETE CASCADE
url              text          NOT NULL
title            text
user_note        text
platform         text          -- youtube | tiktok | instagram | linkedin | twitter | blog | other
status           text          DEFAULT 'pending'  -- pending | ready | done
is_actioned      bool          DEFAULT false
actioned_note    text
saved_at         timestamptz   DEFAULT now()
actioned_at      timestamptz
reminder_count   int           DEFAULT 0
next_reminder_at timestamptz   DEFAULT now() + interval '3 days'
```

### Table: ai_summaries
```sql
id               uuid          PRIMARY KEY DEFAULT gen_random_uuid()
link_id          uuid          REFERENCES links(id) ON DELETE CASCADE UNIQUE
summary          text
key_points       jsonb         -- string[]
resources        jsonb         -- {name: string, type: string, url: string}[]
freshness_score  int           -- 1-10
is_time_sensitive bool         DEFAULT false
embedding        vector(768)   -- pgvector, from Gemini text-embedding
created_at       timestamptz   DEFAULT now()
```

### Table: categories
```sql
id          uuid    PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid    REFERENCES users(id) ON DELETE CASCADE  -- null for defaults
name        text    NOT NULL
color       text    NOT NULL  -- hex string e.g. "#378ADD"
is_default  bool    DEFAULT false
```

### Table: link_categories
```sql
link_id      uuid    REFERENCES links(id) ON DELETE CASCADE
category_id  uuid    REFERENCES categories(id) ON DELETE CASCADE
assigned_by  text    -- 'ai' | 'user'
PRIMARY KEY (link_id, category_id)
```

### Table: notifications
```sql
id        uuid          PRIMARY KEY DEFAULT gen_random_uuid()
user_id   uuid          REFERENCES users(id) ON DELETE CASCADE
link_id   uuid          REFERENCES links(id) ON DELETE SET NULL
type      text          -- 'reminder' | 'urgent' | 'digest'
sent_at   timestamptz   DEFAULT now()
opened    bool          DEFAULT false
```

### Row-Level Security (RLS)
All tables must have RLS enabled. Policy: `user_id = auth.uid()` on all select/insert/update/delete operations.

---

## 9. User Flows

### Flow 1: Capture from YouTube (Mobile)
1. User on YouTube taps Share on a video
2. Selects Recall from share sheet
3. Recall opens with bottom sheet: video title + note input
4. User optionally types a note → taps Save
5. Returned to YouTube immediately
6. Background: URL + note saved to Supabase → Edge Function → Gemini → results written → card ready
7. Push notification (optional): "Your link from YouTube is ready"

### Flow 2: Capture from Browser (Desktop)
1. User on any webpage clicks the Recall extension button
2. Popup shows: page title, URL, note input
3. User optionally adds note → clicks Save
4. Popup shows "Saved ✓" and closes
5. Same background processing pipeline fires

### Flow 3: Reminder → Action
1. Day 3: push notification — "Still haven't acted on: [title]"
2. User taps → opens Link Detail screen
3. Reads summary, reviews tools mentioned
4. Taps "Mark as actioned"
5. Mark as Actioned screen: quick buttons + note field
6. User selects "Tried the tool", writes note
7. Link archived. Streak increments. Reminders stop.

### Flow 4: Semantic Search
1. User taps Search tab
2. Types "cold email automation"
3. Query → embedding → pgvector similarity search
4. Top 10 results shown, ranked by relevance
5. User taps a result → Link Detail screen

---

## 10. Known Risks & Mitigations

| Risk | Description | Mitigation |
|------|-------------|-----------|
| Paywalled content | Medium, LinkedIn, private posts cannot be fetched server-side | Fallback: title + domain + user note. Clear message on card. Not blocking. |
| TikTok/Instagram transcripts | No public transcript API | Title + caption + user note. Acceptable for MVP. |
| Gemini rate limits at scale | 1,500 req/day free tier | Groq fallback (14,400/day). Queue system in Phase 2. |
| iOS App Store cost | $99/year required for public App Store distribution | TestFlight for personal use. Android-first for public launch. iOS deferred. |
| Chrome Web Store cost | $5 one-time registration fee | Edge Add-ons store is free alternative. |
| Duplicate URLs | User may save same URL multiple times | Detect duplicate URLs per user on save. Show: "You already saved this — open it?" |

---

## 11. Build Phases

### Phase 1 — Personal MVP
Goal: Working app used daily by the primary user.

- [ ] Supabase project setup (schema, RLS, auth)
- [ ] Expo app: auth screens, navigation shell
- [ ] Library screen with filter chips
- [ ] Summary card component
- [ ] Link detail screen
- [ ] expo-share-intent share sheet integration
- [ ] Supabase Edge Function: fetch + Gemini + write results
- [ ] Gemini integration with structured JSON prompt
- [ ] Groq fallback in Edge Function
- [ ] Push notification setup (Expo + pg_cron scheduler)
- [ ] Mark as actioned flow
- [ ] Browser extension (Manifest V3 popup)

### Phase 2 — Smart Layer
Goal: Richer AI output and accountability features.

- [ ] Semantic search (pgvector + Gemini embeddings)
- [ ] Stats screen
- [ ] Freshness scoring visual bar
- [ ] Cross-link grouping in reminders
- [ ] Weekly digest notification
- [ ] Action notes history
- [ ] Web dashboard (Next.js on Vercel)

### Phase 3 — Public Launch
Goal: Onboard external users.

- [ ] User onboarding flow
- [ ] Google Play Store submission
- [ ] Public landing page
- [ ] Spaces (shared libraries)
- [ ] Export (CSV / JSON)
- [ ] Analytics (privacy-respecting)

---

## 12. Open Questions

| Question | Context |
|----------|---------|
| Monetization model | Freemium? Pro tier for higher AI usage, team spaces? Decide before public launch. |
| AI re-processing | Should users re-trigger AI on a link (e.g., if failed or content changed)? |
| Duplicate detection | Silently deduplicate same URL, or warn the user? |
| iOS App Store timing | At what user count or revenue does $99/year make sense? |
| Chrome extension timing | When to pay $5 for Chrome vs staying on Edge Add-ons? |
| Link expiry | Periodically check for 404s and flag dead links? |

# Recall — Mobile App Spec

> AI agent: implement the full mobile app at `apps/mobile/` using Expo + React Native + Expo Router.  
> Read `01_ARCHITECTURE.md` for folder structure and `02_DATABASE.md` for types before starting.

---

## Setup & Dependencies

```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
cd apps/mobile

npx expo install expo-router expo-share-intent expo-notifications
npx expo install @supabase/supabase-js zustand
npx expo install @react-native-async-storage/async-storage
npm install react-native-url-polyfill
```

**`app.json` — required config:**
```json
{
  "expo": {
    "name": "Recall",
    "slug": "recall",
    "scheme": "recall",
    "plugins": [
      "expo-router",
      [
        "expo-share-intent",
        {
          "iosActivationRules": {
            "NSExtensionActivationSupportsWebURLWithMaxCount": 1
          },
          "androidIntentFilters": ["text/plain"]
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#2563EB"
        }
      ]
    ]
  }
}
```

---

## Supabase Client

**File:** `lib/supabase.ts`
```typescript
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
)
```

---

## Types

**File:** `packages/shared/types/link.ts`
```typescript
export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'twitter' | 'blog' | 'other'
export type LinkStatus = 'pending' | 'ready' | 'done'

export interface Link {
  id: string
  user_id: string
  url: string
  title: string | null
  user_note: string | null
  platform: Platform
  status: LinkStatus
  is_actioned: boolean
  actioned_note: string | null
  saved_at: string
  actioned_at: string | null
  reminder_count: number
  next_reminder_at: string | null
}

export interface AIStummary {
  id: string
  link_id: string
  summary: string | null
  key_points: string[] | null
  resources: { name: string; type: string; url: string }[] | null
  freshness_score: number | null
  is_time_sensitive: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  color: string
  is_default: boolean
}

export interface LinkWithSummary extends Link {
  ai_summaries: AIStummary | null
  link_categories: { category_id: string; categories: Category }[]
}
```

---

## Stores (Zustand)

**File:** `stores/authStore.ts`
```typescript
import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  setSession: (session: Session | null) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null })
  }
}))
```

**File:** `stores/linkStore.ts`
```typescript
import { create } from 'zustand'
import { LinkWithSummary } from '../../../packages/shared/types/link'

interface LinkState {
  links: LinkWithSummary[]
  setLinks: (links: LinkWithSummary[]) => void
  addLink: (link: LinkWithSummary) => void
  updateLink: (id: string, updates: Partial<LinkWithSummary>) => void
  selectedCategory: string | null
  setSelectedCategory: (id: string | null) => void
}

export const useLinkStore = create<LinkState>((set) => ({
  links: [],
  setLinks: (links) => set({ links }),
  addLink: (link) => set((s) => ({ links: [link, ...s.links] })),
  updateLink: (id, updates) =>
    set((s) => ({
      links: s.links.map((l) => (l.id === id ? { ...l, ...updates } : l))
    })),
  selectedCategory: null,
  setSelectedCategory: (id) => set({ selectedCategory: id })
}))
```

---

## Screens

### Root Layout

**File:** `app/_layout.tsx`
```typescript
import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { registerPushToken } from '../lib/notifications'

export default function RootLayout() {
  const { session, setSession } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) registerPushToken()
    })
  }, [])

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) router.replace('/(auth)/login')
    if (session && inAuthGroup) router.replace('/(tabs)/')
  }, [session, segments])

  return <Slot />
}
```

---

### Auth Screens

**File:** `app/(auth)/login.tsx`
```typescript
// Login screen with email + password
// Also show "Sign up" link

// Fields: email (TextInput), password (TextInput, secureTextEntry)
// Button: "Log in" → supabase.auth.signInWithPassword({ email, password })
// Link: "Don't have an account? Sign up" → router.push('/(auth)/signup')
// Error handling: show error message below the form
// Loading state: disable button while request in flight
```

**File:** `app/(auth)/signup.tsx`
```typescript
// Sign up screen with name + email + password
// Fields: display_name, email, password
// Button: "Create account" → supabase.auth.signUp({ email, password, options: { data: { display_name } } })
// On success: Supabase Auth trigger creates public.users row automatically
// Show: "Check your email for a confirmation link"
```

---

### Tab Layout

**File:** `app/(tabs)/_layout.tsx`
```typescript
import { Tabs } from 'expo-router'
import { COLORS } from '../../constants/colors'

// 5 tabs in order:
// 1. index      — icon: grid-2x2       — label: Library
// 2. search     — icon: search         — label: Search
// 3. add        — icon: plus (larger)  — label: Add
// 4. alerts     — icon: bell           — label: Alerts
// 5. stats      — icon: bar-chart      — label: Stats

// Active tint: COLORS.primary (#2563EB)
// Inactive tint: COLORS.muted (#94A3B8)
// Tab bar background: white / dark mode aware
```

---

### Library Screen

**File:** `app/(tabs)/index.tsx`

**Purpose:** Show all the user's saved links as cards. Filterable by category.

**Data fetching:**
```typescript
// Fetch all links with their summaries and categories
const { data } = await supabase
  .from('links')
  .select(`
    *,
    ai_summaries (*),
    link_categories (
      category_id,
      categories (*)
    )
  `)
  .eq('user_id', session.user.id)
  .order('saved_at', { ascending: false })
```

**Supabase Realtime subscription:**
```typescript
// Subscribe to changes on links table for this user
// When a link status changes to 'ready', update the card in the list
supabase
  .channel('links')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'links',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    updateLink(payload.new.id, payload.new)
  })
  .subscribe()
```

**Layout:**
- Screen header: "Recall" title, search icon, bell icon
- Category filter row (horizontal scroll): All, Tools & Apps, Courses, Opportunities, Inspiration, Resources, News & Trends, Locations, Reference, + user custom categories
- Filtered link list: `FlatList` of `LinkCard` components
- Empty state: "No links yet — share something to Recall from any app"
- Pull-to-refresh

---

### Link Card Component

**File:** `components/cards/LinkCard.tsx`

**Props:**
```typescript
interface LinkCardProps {
  link: LinkWithSummary
  onPress: () => void
}
```

**Visual layout (top to bottom):**
1. Row: `PlatformIcon` (28px) + title (font weight 500, 2 lines max)
2. Summary text (2–3 lines, muted color, 13px)
3. Resources row: `Chip` for each resource in `ai_summaries.resources` (max 4 shown, "+N more" if overflow)
4. Bottom row: category `Badge` + platform + time ago (e.g. "YouTube · 3d ago")
5. Status row:
   - Pending: show skeleton shimmer (summary loading)
   - Not actioned: small bell icon + "Not actioned yet" in muted text
   - Urgent (is_time_sensitive = true): red warning icon + "Time-sensitive — act now"
   - Actioned: green check + "Actioned" with reduced card opacity (0.6)

**Styling:**
- White background, 0.5px border (#E2E8F0), 12px border radius
- 12px padding all sides
- 8px margin bottom
- No shadow

---

### Link Detail Screen

**File:** `app/link/[id].tsx`

**Data fetching:**
```typescript
const { data } = await supabase
  .from('links')
  .select(`*, ai_summaries (*), link_categories (category_id, assigned_by, categories (*))`)
  .eq('id', linkId)
  .single()
```

**Layout (scrollable):**
1. Back button row: "← Library"
2. Header: platform icon (36px) + full title
3. Category badge + "Platform · X days ago"
4. Divider
5. **Summary section** — label "Summary" + full summary text
6. **Key points section** — label "Key points" + bulleted list from `key_points`
7. **Tools & resources** — label "Tools & resources mentioned" + `Chip` grid for each resource
8. **Your note** — label "Your note" + italic user note text (hidden if null)
9. **Freshness bar** — label "Freshness" + `FreshnessBar` component + text label (Still relevant / May be outdated / Likely outdated)
10. Divider
11. Primary button: "Mark as actioned" → navigate to `/action/[id]`
12. Secondary button: "Open link" → `Linking.openURL(link.url)`
13. Tertiary button: "Edit category" → show category picker bottom sheet

---

### Mark as Actioned Screen

**File:** `app/action/[id].tsx`

**Layout:**
1. Header: "← Cancel" + screen title "Mark as actioned"
2. Gray box: link title (non-editable reminder)
3. Label: "Quick action"
4. 2×2 grid of quick action buttons:
   - "Watched it"
   - "Read it"
   - "Tried the tool"
   - "Applied / signed up"
5. Label: "Or write what you did (optional)"
6. `TextInput` multiline: "e.g. signed up for n8n, built first workflow..."
7. Primary button: "Mark done"

**On submit:**
```typescript
await supabase
  .from('links')
  .update({
    is_actioned: true,
    actioned_at: new Date().toISOString(),
    actioned_note: selectedAction
      ? `${selectedAction}${noteText ? ' — ' + noteText : ''}`
      : noteText
  })
  .eq('id', linkId)

// Also increment streak
await supabase.rpc('increment_streak', { user_id_param: userId })
// Create the increment_streak function in migrations
```

After submit: navigate back to Library screen.

---

### Search Screen

**File:** `app/(tabs)/search.tsx`

**Layout:**
- Search input at top (autofocus on mount)
- Results list: same `LinkCard` components
- Empty state (before search): "Search your saved links by topic, tool, or idea"
- No results state: "No matches found — try different words"

**Search implementation:**
```typescript
async function semanticSearch(query: string) {
  // 1. Generate embedding for query via Supabase Edge Function
  const { data: embeddingResult } = await supabase.functions.invoke('generate-embedding', {
    body: { text: query }
  })
  const embedding = embeddingResult.embedding

  // 2. Call pgvector search function
  const { data: results } = await supabase.rpc('search_links', {
    query_embedding: embedding,
    user_id_param: userId,
    match_count: 10
  })

  // 3. Fetch full link data for the returned IDs
  const linkIds = results.map((r) => r.link_id)
  const { data: links } = await supabase
    .from('links')
    .select(`*, ai_summaries (*), link_categories (category_id, categories (*))`)
    .in('id', linkIds)

  return links
}
```

Note: create a simple `generate-embedding` Edge Function that accepts `{ text: string }` and returns `{ embedding: number[] }` using Gemini text-embedding model.

---

### Alerts Screen

**File:** `app/(tabs)/alerts.tsx`

**Data fetching:**
```typescript
// Fetch recent notifications with linked link data
const { data } = await supabase
  .from('notifications')
  .select(`*, links (id, title, url, platform)`)
  .eq('user_id', userId)
  .order('sent_at', { ascending: false })
  .limit(50)
```

**Layout:**
- Screen header: "Alerts"
- Subtitle: "Things that need your attention"
- List of `NotifCard` components grouped by type (Urgent first, then Reminders, then Digest)
- Empty state: "You're all caught up" + checkmark icon

---

### Stats Screen

**File:** `app/(tabs)/stats.tsx`

**Data fetching:**
```typescript
// Total saved
const { count: totalCount } = await supabase.from('links').select('id', { count: 'exact', head: true }).eq('user_id', userId)

// Total actioned
const { count: actionedCount } = await supabase.from('links').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_actioned', true)

// Per category counts
const { data: categoryData } = await supabase
  .from('link_categories')
  .select('category_id, categories (name, color), links!inner (user_id)')
  .eq('links.user_id', userId)

// Streak from users table
const { data: userData } = await supabase.from('users').select('streak_count').eq('id', userId).single()
```

**Layout:**
- 2×2 metric grid: Total saved / Actioned / Action rate % / Day streak
- Category bar chart (horizontal bars, colored by category color)
- Unactioned box: count + "X are time-sensitive right now"

---

### Share Intent Handler

The share sheet integration needs to be handled in the root layout so the app can respond when launched via share intent.

**Add to `app/_layout.tsx`:**
```typescript
import { useShareIntentContext } from 'expo-share-intent'
import { useRouter } from 'expo-router'

// Inside the component:
const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext()
const router = useRouter()

useEffect(() => {
  if (hasShareIntent && shareIntent?.webUrl && session) {
    // Navigate to add screen pre-filled with the shared URL
    router.push({
      pathname: '/(tabs)/add',
      params: {
        url: shareIntent.webUrl,
        title: shareIntent.meta?.title ?? ''
      }
    })
    resetShareIntent()
  }
}, [hasShareIntent, session])
```

**File:** `app/(tabs)/add.tsx`
```typescript
// Receives: url (string), title (string) as route params
// If params present: pre-fill URL field, show "Saving from [platform]" header
// Fields: URL (pre-filled, editable), title (pre-filled if available), note (empty)
// Button: "Save to Recall"

// On save:
const { data: link } = await supabase
  .from('links')
  .insert({
    user_id: session.user.id,
    url,
    title,
    user_note: note,
    status: 'pending'
  })
  .select()
  .single()

// Then navigate to Library — the Edge Function processes in background
router.replace('/(tabs)/')
```

---

## UI Components

### PlatformIcon
```typescript
// Returns the correct icon/color for each platform
// youtube → red play icon
// linkedin → blue linkedin icon
// tiktok → black tiktok icon
// instagram → gradient/pink instagram icon
// twitter/x → black X icon
// blog / other → globe icon
```

### Badge (Category)
```typescript
interface BadgeProps {
  label: string
  color: string // hex color from category
}
// Pill-shaped, small font, background is color at 15% opacity, text is color at 100%
```

### Chip (Resource)
```typescript
interface ChipProps {
  label: string
}
// Small outlined chip, border gray, text muted
```

### FreshnessBar
```typescript
interface FreshnessBarProps {
  score: number // 1-10
}
// Horizontal bar
// 7-10: green fill, label "Still relevant"
// 4-6: amber fill, label "May be outdated"
// 1-3: red fill, label "Likely outdated"
```

---

## Constants

**File:** `constants/colors.ts`
```typescript
export const COLORS = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  text: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  white: '#FFFFFF'
}
```

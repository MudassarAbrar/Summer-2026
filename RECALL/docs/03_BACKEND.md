# Recall — Backend & Edge Functions Spec

> AI agent: implement these two Edge Functions inside `supabase/functions/`.  
> Both functions use the Supabase service role key and are never called directly from the client.

---

## Edge Function 1: `process-link`

**Path:** `supabase/functions/process-link/index.ts`  
**Trigger:** Database webhook — fires when a new row is inserted into `public.links`  
**Purpose:** Fetch URL content → call Gemini → write AI summary back to database

### Setup the webhook in Supabase dashboard
```
Dashboard → Database → Webhooks → Create webhook
  Table: public.links
  Event: INSERT
  URL: https://<project-ref>.supabase.co/functions/v1/process-link
  HTTP method: POST
  Headers: Authorization: Bearer <service_role_key>
```

### Full implementation

```typescript
// supabase/functions/process-link/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface LinkRecord {
  id: string
  url: string
  title: string | null
  user_note: string | null
  platform: string
}

interface AIResult {
  summary: string
  key_points: string[]
  resources: { name: string; type: string; url: string }[]
  suggested_category: string
  is_time_sensitive: boolean
  freshness_score: number
}

// ─── PLATFORM DETECTION ───────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('linkedin.com')) return 'linkedin'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
  return 'blog'
}

// ─── CONTENT FETCHING ─────────────────────────────────────────────────────────

async function fetchContent(url: string, platform: string): Promise<string> {
  // YouTube: Gemini handles natively — return the URL itself as content
  if (platform === 'youtube') {
    return `YouTube video URL: ${url}`
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecallBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html = await res.text()
    // Strip HTML tags, collapse whitespace, limit to 8000 chars
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000)

    return text
  } catch (err) {
    // Fallback: return empty string — AI will use title + note only
    console.log(`Fetch failed for ${url}: ${err}`)
    return ''
  }
}

// ─── AI PROMPT ────────────────────────────────────────────────────────────────

function buildPrompt(link: LinkRecord, content: string): string {
  const isYouTube = link.platform === 'youtube'

  return `You are analyzing saved content for a personal knowledge management app.

${isYouTube
  ? `Analyze this YouTube video: ${link.url}
Watch and understand the video content.`
  : `Analyze this content:
URL: ${link.url}
Title: ${link.title || 'Unknown'}
Content: ${content || 'Content could not be fetched'}
User note: ${link.user_note || 'None'}`
}

Return ONLY a valid JSON object with these exact fields. No markdown, no explanation, just JSON:

{
  "summary": "2-4 sentences describing what this content is about",
  "key_points": ["point 1", "point 2", "point 3"],
  "resources": [
    {"name": "Tool Name", "type": "tool|app|course|website", "url": "https://..."}
  ],
  "suggested_category": "one of: Tools & Apps | Courses | Opportunities | Inspiration | Resources | News & Trends | Locations | Reference",
  "is_time_sensitive": false,
  "freshness_score": 8
}

Rules:
- summary: 2-4 sentences, plain English, no jargon
- key_points: 3-5 actionable takeaways, each under 15 words
- resources: list EVERY tool, app, service, or resource mentioned in the content. Empty array if none.
- suggested_category: pick the single best fit from the list above
- is_time_sensitive: true only if there is a deadline, limited-time offer, or expiring opportunity
- freshness_score: 1-10 (10 = timeless, 1 = almost certainly outdated already)`
}

// ─── GEMINI CALL ──────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<AIResult> {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json'
      }
    })
  })

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No Gemini response text')

  return JSON.parse(text) as AIResult
}

// ─── GROQ FALLBACK ────────────────────────────────────────────────────────────

async function callGroq(prompt: string): Promise<AIResult> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a content analysis assistant. Always respond with valid JSON only. No markdown, no explanation.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1000
    })
  })

  if (!res.ok) throw new Error(`Groq error: ${res.status}`)

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No Groq response text')

  // Strip markdown code fences if present
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean) as AIResult
}

// ─── GEMINI EMBEDDING ─────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] }
      })
    }
  )

  if (!res.ok) throw new Error(`Embedding error: ${res.status}`)
  const data = await res.json()
  return data.embedding.values
}

// ─── FIND OR CREATE CATEGORY ──────────────────────────────────────────────────

async function findCategoryId(
  suggestedName: string,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .ilike('name', suggestedName)
    .single()

  return data?.id ?? null
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    // Supabase webhook sends: { type: 'INSERT', record: {...} }
    const link: LinkRecord = payload.record

    if (!link?.id || !link?.url) {
      return new Response('Invalid payload', { status: 400 })
    }

    // Detect platform and update it on the link row
    const platform = detectPlatform(link.url)
    await supabase
      .from('links')
      .update({ platform })
      .eq('id', link.id)

    // Fetch page content
    const content = await fetchContent(link.url, platform)

    // Build prompt
    const prompt = buildPrompt({ ...link, platform }, content)

    // Call AI (Gemini first, Groq as fallback)
    let result: AIResult
    try {
      result = await callGemini(prompt)
    } catch (geminiErr) {
      console.log('Gemini failed, trying Groq:', geminiErr)
      result = await callGroq(prompt)
    }

    // Generate embedding from summary
    let embedding: number[] | null = null
    try {
      embedding = await generateEmbedding(result.summary)
    } catch (embErr) {
      console.log('Embedding failed (non-fatal):', embErr)
    }

    // Write summary to database
    const { error: summaryError } = await supabase
      .from('ai_summaries')
      .upsert({
        link_id: link.id,
        summary: result.summary,
        key_points: result.key_points,
        resources: result.resources,
        freshness_score: result.freshness_score,
        is_time_sensitive: result.is_time_sensitive,
        embedding: embedding ? JSON.stringify(embedding) : null
      })

    if (summaryError) throw summaryError

    // Update link status to ready
    await supabase
      .from('links')
      .update({ status: 'ready' })
      .eq('id', link.id)

    // Find matching category and assign it
    const userId = (await supabase
      .from('links')
      .select('user_id')
      .eq('id', link.id)
      .single()).data?.user_id

    if (userId && result.suggested_category) {
      const categoryId = await findCategoryId(result.suggested_category, userId)
      if (categoryId) {
        await supabase
          .from('link_categories')
          .upsert({
            link_id: link.id,
            category_id: categoryId,
            assigned_by: 'ai'
          })
      }
    }

    // If time-sensitive, send immediate notification
    if (result.is_time_sensitive && userId) {
      await supabase.from('notifications').insert({
        user_id: userId,
        link_id: link.id,
        type: 'urgent'
      })
      // TODO: trigger Expo push notification here (see notifications spec)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('process-link error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

---

## Edge Function 2: `send-reminders`

**Path:** `supabase/functions/send-reminders/index.ts`  
**Trigger:** pg_cron — daily at 9 AM UTC, weekly digest on Sundays at 10 AM UTC  
**Purpose:** Find overdue unactioned links → send push notifications

```typescript
// supabase/functions/send-reminders/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// ─── SEND EXPO PUSH NOTIFICATION ─────────────────────────────────────────────

async function sendPush(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      title,
      body,
      data: data ?? {},
      sound: 'default',
      priority: 'high'
    })
  })
}

// ─── GET USER PUSH TOKEN ──────────────────────────────────────────────────────
// Push tokens are stored in a push_tokens table (create separately or add to users table)

async function getUserPushToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('push_token')
    .eq('id', userId)
    .single()
  return data?.push_token ?? null
}

// ─── REMINDER BACKOFF SCHEDULE ────────────────────────────────────────────────

function nextReminderInterval(reminderCount: number): string {
  switch (reminderCount) {
    case 0: return '3 days'
    case 1: return '7 days'
    case 2: return '14 days'
    case 3: return '30 days'
    default: return null as unknown as string // stop reminding after 4
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}))
  const isDigest = body?.type === 'digest'

  if (isDigest) {
    // ── WEEKLY DIGEST ──────────────────────────────────────────────────────────
    // Find all users with unactioned links
    const { data: users } = await supabase
      .from('links')
      .select('user_id')
      .eq('is_actioned', false)
      .eq('status', 'ready')

    const uniqueUserIds = [...new Set((users ?? []).map((u) => u.user_id))]

    for (const userId of uniqueUserIds) {
      // Count unactioned links for this user
      const { count: totalCount } = await supabase
        .from('links')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_actioned', false)

      // Count time-sensitive ones
      const { count: urgentCount } = await supabase
        .from('links')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_actioned', false)
        .eq('status', 'ready')
        .filter(
          'id',
          'in',
          `(select link_id from ai_summaries where is_time_sensitive = true)`
        )

      const token = await getUserPushToken(userId)
      if (!token || !totalCount) continue

      await sendPush(
        token,
        'Your weekly Recall digest',
        `You have ${totalCount} unactioned items${urgentCount ? `, ${urgentCount} are time-sensitive` : ''}.`,
        { type: 'digest' }
      )

      await supabase.from('notifications').insert({
        user_id: userId,
        link_id: null,
        type: 'digest'
      })
    }

  } else {
    // ── DAILY REMINDERS ───────────────────────────────────────────────────────
    // Find all links due for a reminder
    const { data: dueLinks } = await supabase
      .from('links')
      .select(`
        id,
        user_id,
        title,
        url,
        reminder_count,
        next_reminder_at,
        ai_summaries (summary, is_time_sensitive)
      `)
      .eq('is_actioned', false)
      .eq('status', 'ready')
      .lte('next_reminder_at', new Date().toISOString())
      .lt('reminder_count', 4)

    for (const link of dueLinks ?? []) {
      const token = await getUserPushToken(link.user_id)
      if (!token) continue

      const isUrgent = link.ai_summaries?.[0]?.is_time_sensitive
      const title = isUrgent
        ? '⚠️ Time-sensitive item not actioned'
        : 'Still unactioned in Recall'
      const bodyText = `${link.title || 'A saved link'} — you haven't acted on this yet.`

      await sendPush(token, title, bodyText, {
        type: isUrgent ? 'urgent' : 'reminder',
        linkId: link.id
      })

      // Update reminder count and next reminder date
      const nextInterval = nextReminderInterval(link.reminder_count)

      if (nextInterval) {
        await supabase
          .from('links')
          .update({
            reminder_count: link.reminder_count + 1,
            next_reminder_at: new Date(
              Date.now() + parseDays(nextInterval) * 86400000
            ).toISOString()
          })
          .eq('id', link.id)
      } else {
        // No more reminders — set next_reminder_at far in the future
        await supabase
          .from('links')
          .update({ next_reminder_at: null })
          .eq('id', link.id)
      }

      await supabase.from('notifications').insert({
        user_id: link.user_id,
        link_id: link.id,
        type: isUrgent ? 'urgent' : 'reminder'
      })
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

function parseDays(interval: string): number {
  return parseInt(interval.split(' ')[0])
}
```

---

## Push Token Storage

Add `push_token` column to the users table:

```sql
alter table public.users
  add column if not exists push_token text;
```

The mobile app must register the Expo push token and save it to Supabase on login:

```typescript
// lib/notifications.ts (mobile)

import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

export async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const token = (await Notifications.getExpoPushTokenAsync()).data

  await supabase
    .from('users')
    .update({ push_token: token })
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
}
```

Call `registerPushToken()` once after the user logs in.

---

## Environment Variables Required

Set these in Supabase dashboard → Settings → Edge Functions → Secrets:

```
GEMINI_API_KEY          # From Google AI Studio: aistudio.google.com
GROQ_API_KEY            # From console.groq.com
SUPABASE_URL            # Auto-available in Edge Functions
SUPABASE_SERVICE_ROLE_KEY  # Auto-available in Edge Functions
```

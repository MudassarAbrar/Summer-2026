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
  try {
    const res = await fetch(EXPO_PUSH_URL, {
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
    if (!res.ok) {
      console.error(`Expo Push failed with status ${res.status}: ${await res.text()}`)
    }
  } catch (err) {
    console.error('Failed to send push notification via Expo:', err)
  }
}

// ─── GET USER PUSH TOKEN ──────────────────────────────────────────────────────

async function getUserPushToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('push_token')
    .eq('id', userId)
    .single()

  if (error) {
    console.error(`Error fetching push token for user ${userId}:`, error)
    return null
  }
  return data?.push_token ?? null
}

// ─── REMINDER BACKOFF SCHEDULE ────────────────────────────────────────────────

function nextReminderInterval(reminderCount: number): string | null {
  switch (reminderCount) {
    case 0: return '3 days'
    case 1: return '7 days'
    case 2: return '14 days'
    case 3: return '30 days'
    default: return null // stop reminding after 4 reminders
  }
}

function parseDays(interval: string): number {
  return parseInt(interval.split(' ')[0])
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    // Authenticate the request using service role or verify authorization header
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!authHeader || !authHeader.includes(serviceRoleKey!)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json().catch(() => ({}))
    const isDigest = body?.type === 'digest'

    if (isDigest) {
      // ── WEEKLY DIGEST ──────────────────────────────────────────────────────────
      // Find all users with unactioned links
      const { data: users, error: usersError } = await supabase
        .from('links')
        .select('user_id')
        .eq('is_actioned', false)
        .eq('status', 'ready')

      if (usersError) throw usersError

      const uniqueUserIds = [...new Set((users ?? []).map((u) => u.user_id))]

      for (const userId of uniqueUserIds) {
        // Count total unactioned links for this user
        const { count: totalCount, error: countError } = await supabase
          .from('links')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_actioned', false)

        if (countError) {
          console.error(`Error counting links for user ${userId}:`, countError)
          continue
        }

        // Count time-sensitive ones (safely join/filter via inner join)
        const { count: urgentCount, error: urgentError } = await supabase
          .from('links')
          .select('id, ai_summaries!inner(is_time_sensitive)', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_actioned', false)
          .eq('status', 'ready')
          .eq('ai_summaries.is_time_sensitive', true)

        if (urgentError) {
          console.error(`Error counting urgent links for user ${userId}:`, urgentError)
          continue
        }

        const token = await getUserPushToken(userId)
        if (!token || !totalCount) continue

        const bodyMsg = `You have ${totalCount} unactioned items${urgentCount ? `, ${urgentCount} are time-sensitive` : ''}.`
        await sendPush(
          token,
          'Your weekly Recall digest',
          bodyMsg,
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
      const { data: dueLinks, error: dueLinksError } = await supabase
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

      if (dueLinksError) throw dueLinksError

      for (const link of dueLinks ?? []) {
        const token = await getUserPushToken(link.user_id)
        if (!token) continue

        const summaries = link.ai_summaries
        const isUrgent = Array.isArray(summaries)
          ? summaries[0]?.is_time_sensitive
          : (summaries as any)?.is_time_sensitive

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
          // No more reminders — set next_reminder_at to null so it's not checked again
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
  } catch (err) {
    console.error('send-reminders error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useLinkStore } from '../stores/linkStore'
import { LinkWithSummary } from '@recall/shared'

export function useLinks() {
  const user = useAuthStore((state) => state.user)
  const { links, setLinks, addLink, updateLink } = useLinkStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLinks = async () => {
    if (!user) return
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('links')
        .select(`
          *,
          ai_summaries (*),
          link_categories (
            category_id,
            categories (*)
          )
        `)
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false })

      if (fetchError) throw fetchError
      setLinks((data || []) as LinkWithSummary[])
      setError(null)
    } catch (err) {
      console.error('Error fetching links:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch links')
    } finally {
      setLoading(false)
    }
  }

  const fetchSingleFullLink = async (linkId: string): Promise<LinkWithSummary | null> => {
    try {
      const { data, error: singleError } = await supabase
        .from('links')
        .select(`
          *,
          ai_summaries (*),
          link_categories (
            category_id,
            categories (*)
          )
        `)
        .eq('id', linkId)
        .single()

      if (singleError) throw singleError
      return data as LinkWithSummary
    } catch (err) {
      console.error(`Error fetching single link ${linkId}:`, err)
      return null
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    fetchLinks()

    // Subscribe to real-time updates using Supabase JS v2 Channels
    const channel = supabase
      .channel(`user-links-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'links',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch full link details with AI summary
            const fullLink = await fetchSingleFullLink(payload.new.id)
            if (fullLink) addLink(fullLink)
          } else if (payload.eventType === 'UPDATE') {
            // Fetch the updated full record so we get the AI summary and categories
            const fullLink = await fetchSingleFullLink(payload.new.id)
            if (fullLink) {
              updateLink(payload.new.id, fullLink)
            } else {
              updateLink(payload.new.id, payload.new as LinkWithSummary)
            }
          } else if (payload.eventType === 'DELETE') {
            // Remove the link from the store by setting the updated array
            // We can fetch links again or filter locally
            fetchLinks()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  return { links, loading, error, refetch: fetchLinks }
}

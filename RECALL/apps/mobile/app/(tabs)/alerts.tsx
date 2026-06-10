import React, { useEffect, useState } from 'react'
import { View, FlatList, Text, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons, Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { COLORS } from '../../constants/colors'
import { relativeTime } from '@recall/shared'

interface NotificationItem {
  id: string
  user_id: string
  link_id: string | null
  type: 'urgent' | 'reminder' | 'digest'
  sent_at: string
  opened: boolean
  links: {
    id: string
    title: string | null
    url: string
    platform: string
  } | null
}

export default function AlertsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const user = useAuthStore((state) => state.user)
  const router = useRouter()

  const fetchNotifications = async () => {
    if (!user) return
    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          link_id,
          type,
          sent_at,
          opened,
          links (
            id,
            title,
            url,
            platform
          )
        `)
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError
      setNotifications((data || []) as any[])
      setError(null)
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchNotifications()
  }

  const handlePressNotification = async (item: NotificationItem) => {
    // Mark as read in background
    if (!item.opened) {
      await supabase
        .from('notifications')
        .update({ opened: true })
        .eq('id', item.id)
      
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, opened: true } : n))
      )
    }

    // Redirect to link details if linked
    if (item.link_id) {
      router.push(`/link/${item.link_id}`)
    }
  }

  // Sort: Urgent first, then Reminders, then Digest. Secondary sort: date descending
  const sortedNotifications = [...notifications].sort((a, b) => {
    const typePriority = { urgent: 1, reminder: 2, digest: 3 }
    const priorityA = typePriority[a.type] || 99
    const priorityB = typePriority[b.type] || 99

    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    return new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  })

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Subheader */}
      <View style={styles.subheader}>
        <Text style={styles.subheaderText}>Things that need your attention</Text>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sortedNotifications.length === 0 ? (
        <ScrollViewContent handleRefresh={handleRefresh} refreshing={refreshing} />
      ) : (
        <FlatList
          data={sortedNotifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
          renderItem={({ item }) => {
            const isUrgent = item.type === 'urgent'
            const isDigest = item.type === 'digest'
            
            let iconName: any = 'notifications'
            let iconColor = COLORS.primary
            let title = 'Notification'

            if (isUrgent) {
              iconName = 'alert-triangle'
              iconColor = COLORS.danger
              title = 'Time-Sensitive Reminder'
            } else if (isDigest) {
              iconName = 'mail'
              iconColor = COLORS.warning
              title = 'Weekly Digest Summary'
            } else {
              iconName = 'bell'
              iconColor = COLORS.primary
              title = 'Recall Reminder'
            }

            const bodyText = isDigest
              ? 'Click to check your digest statistics. You have unactioned items waiting.'
              : item.links?.title
              ? `"${item.links.title}" requires your action.`
              : 'A saved link is waiting for action.'

            return (
              <TouchableOpacity
                onPress={() => handlePressNotification(item)}
                activeOpacity={0.7}
                style={[
                  styles.card,
                  item.opened && styles.cardOpened
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: iconColor + '15' }]}>
                  <Feather name={iconName} size={18} color={iconColor} />
                </View>
                
                <View style={styles.bodyBox}>
                  <View style={styles.topMeta}>
                    <Text style={[styles.cardTitle, { color: iconColor }]}>
                      {title}
                    </Text>
                    <Text style={styles.timeText}>{relativeTime(item.sent_at)}</Text>
                  </View>
                  
                  <Text style={styles.bodyText} numberOfLines={2}>
                    {bodyText}
                  </Text>
                  
                  {!item.opened && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

function ScrollViewContent({ handleRefresh, refreshing }: { handleRefresh: () => void, refreshing: boolean }) {
  const { ScrollView } = require('react-native')
  return (
    <ScrollView
      contentContainerStyle={styles.emptyContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
      }
    >
      <Ionicons name="checkmark-circle-outline" size={60} color={COLORS.success} />
      <Text style={styles.emptyTitle}>You're all caught up</Text>
      <Text style={styles.emptyText}>
        No pending reminders or digests at the moment.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
  },
  subheader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  subheaderText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '500',
  },
  listContainer: {
    padding: 12,
    gap: 8,
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  cardOpened: {
    opacity: 0.65,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyBox: {
    flex: 1,
  },
  topMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.muted,
  },
  bodyText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
    paddingRight: 12,
  },
  unreadDot: {
    position: 'absolute',
    right: 0,
    top: '40%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
})

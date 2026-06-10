import React from 'react'
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons, Feather } from '@expo/vector-icons'
import { LinkWithSummary } from '@recall/shared'
import { COLORS } from '../../constants/colors'
import { relativeTime } from '@recall/shared'
import PlatformIcon from '../ui/PlatformIcon'
import Badge from '../ui/Badge'
import Chip from '../ui/Chip'

interface LinkCardProps {
  link: LinkWithSummary
  onPress: () => void
}

export default function LinkCard({ link, onPress }: LinkCardProps) {
  const summaryData = link.ai_summaries
  const categoryData = link.link_categories?.[0]?.categories
  
  const isPending = link.status === 'pending'
  const isActioned = link.is_actioned
  const isUrgent = summaryData?.is_time_sensitive && !isActioned

  // Resources list logic
  const resources = summaryData?.resources || []
  const maxResourcesShown = 3
  const displayedResources = resources.slice(0, maxResourcesShown)
  const remainingCount = resources.length - maxResourcesShown

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        isActioned && styles.cardActioned
      ]}
    >
      {/* Top row: PlatformIcon + Title */}
      <View style={styles.headerRow}>
        <PlatformIcon platform={link.platform} size={24} />
        <Text style={styles.title} numberOfLines={2}>
          {link.title || link.url}
        </Text>
      </View>

      {/* Middle: Summary or Loading indicator */}
      {isPending ? (
        <View style={styles.pendingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.spinner} />
          <Text style={styles.pendingText}>AI summary is generating...</Text>
        </View>
      ) : (
        summaryData?.summary && (
          <Text style={styles.summary} numberOfLines={3}>
            {summaryData.summary}
          </Text>
        )
      )}

      {/* Resources row */}
      {!isPending && resources.length > 0 && (
        <View style={styles.resourcesRow}>
          {displayedResources.map((res, index) => (
            <Chip key={index} label={res.name} />
          ))}
          {remainingCount > 0 && (
            <Text style={styles.moreText}>+{remainingCount} more</Text>
          )}
        </View>
      )}

      {/* Bottom Info: Badge, Platform, Time */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomLeft}>
          {categoryData && (
            <Badge label={categoryData.name} color={categoryData.color || COLORS.muted} />
          )}
          <Text style={styles.platformTimeText}>
            {categoryData ? ' · ' : ''}
            {link.platform.toUpperCase()} · {relativeTime(link.saved_at)}
          </Text>
        </View>

        {/* Status Indicators */}
        <View style={styles.statusContainer}>
          {isActioned ? (
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Text style={[styles.statusText, { color: COLORS.success }]}>Actioned</Text>
            </View>
          ) : isUrgent ? (
            <View style={styles.statusRow}>
              <Feather name="alert-triangle" size={14} color={COLORS.danger} />
              <Text style={[styles.statusText, { color: COLORS.danger, fontWeight: '600' }]}>
                Time-sensitive
              </Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <Feather name="bell" size={12} color={COLORS.muted} />
              <Text style={[styles.statusText, { color: COLORS.muted }]}>Saved</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardActioned: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
    flex: 1,
  },
  summary: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
    marginBottom: 10,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  spinner: {
    marginRight: 8,
  },
  pendingText: {
    fontSize: 12,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  resourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  moreText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '500',
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  bottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  platformTimeText: {
    fontSize: 11,
    color: COLORS.muted,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    color: COLORS.text,
  },
})

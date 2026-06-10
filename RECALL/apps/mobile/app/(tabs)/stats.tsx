import React, { useEffect, useState } from 'react'
import { View, ScrollView, Text, StyleSheet, ActivityIndicator, RefreshControl, Dimensions } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { COLORS } from '../../constants/colors'
import { Ionicons, Feather } from '@expo/vector-icons'

interface StatsData {
  totalSaved: number
  totalActioned: number
  actionRate: number
  streakCount: number
  urgentCount: number
  categories: { name: string; count: number; color: string }[]
}

export default function StatsScreen() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const user = useAuthStore((state) => state.user)

  const fetchStats = async () => {
    if (!user) return
    try {
      // 1. Fetch user profile for streak count
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('streak_count')
        .eq('id', user.id)
        .maybeSingle()

      if (userError) throw userError

      // 2. Fetch all user links with summaries & categories
      const { data: linksData, error: linksError } = await supabase
        .from('links')
        .select(`
          id,
          is_actioned,
          ai_summaries (
            is_time_sensitive
          ),
          link_categories (
            categories (
              name,
              color
            )
          )
        `)
        .eq('user_id', user.id)

      if (linksError) throw linksError

      const links = linksData || []
      const totalSaved = links.length
      const totalActioned = links.filter((l) => l.is_actioned).length
      const actionRate = totalSaved > 0 ? Math.round((totalActioned / totalSaved) * 100) : 0
      
      // Calculate urgent unactioned count
      const urgentCount = links.filter((l) => {
        if (l.is_actioned) return false
        const summaries = l.ai_summaries
        return Array.isArray(summaries)
          ? summaries[0]?.is_time_sensitive
          : (summaries as any)?.is_time_sensitive
      }).length

      // Accumulate category counts
      const categoryMap: Record<string, { count: number; color: string }> = {}
      links.forEach((link) => {
        link.link_categories?.forEach((lc) => {
          const catRaw = lc.categories
          const cat = Array.isArray(catRaw) ? catRaw[0] : (catRaw as any)
          if (cat) {
            const catName = cat.name
            const catColor = cat.color
            if (catName) {
              if (!categoryMap[catName]) {
                categoryMap[catName] = { count: 0, color: catColor || COLORS.muted }
              }
              categoryMap[catName].count++
            }
          }
        })
      })

      const categories = Object.entries(categoryMap)
        .map(([name, val]) => ({
          name,
          count: val.count,
          color: val.color
        }))
        .sort((a, b) => b.count - a.count)

      setStats({
        totalSaved,
        totalActioned,
        actionRate,
        streakCount: userData?.streak_count || 0,
        urgentCount,
        categories
      })
      setError(null)
    } catch (err) {
      console.error('Error fetching stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to aggregate statistics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchStats()
    }
  }, [user])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStats()
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading stats...</Text>
      </View>
    )
  }

  const maxCategoryCount = stats?.categories.length ? Math.max(...stats.categories.map((c) => c.count)) : 1

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
      }
    >
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Error aggregating stats: {error}</Text>
        </View>
      )}

      {stats && (
        <>
          {/* 2x2 Metric Grid */}
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.primaryLight }]}>
                <Feather name="bookmark" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.metricValue}>{stats.totalSaved}</Text>
              <Text style={styles.metricLabel}>Total Saved</Text>
            </View>

            <View style={styles.gridItem}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.successLight }]}>
                <Feather name="check-circle" size={20} color={COLORS.success} />
              </View>
              <Text style={styles.metricValue}>{stats.totalActioned}</Text>
              <Text style={styles.metricLabel}>Actioned</Text>
            </View>

            <View style={styles.gridItem}>
              <View style={[styles.iconBox, { backgroundColor: '#F3E8FF' }]}>
                <Feather name="pie-chart" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.metricValue}>{stats.actionRate}%</Text>
              <Text style={styles.metricLabel}>Action Rate</Text>
            </View>

            <View style={styles.gridItem}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.warningLight }]}>
                <Ionicons name="flame" size={20} color={COLORS.warning} />
              </View>
              <Text style={styles.metricValue}>{stats.streakCount}</Text>
              <Text style={styles.metricLabel}>Day Streak</Text>
            </View>
          </View>

          {/* Action Reminder Box */}
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Feather name="info" size={16} color={COLORS.primary} />
              <Text style={styles.alertTitle}>Unfinished Tasks</Text>
            </View>
            <Text style={styles.alertText}>
              You have <Text style={styles.boldText}>{stats.totalSaved - stats.totalActioned}</Text> unactioned items.
              {stats.urgentCount > 0 && (
                <Text style={{ color: COLORS.danger }}>
                  {' '}<Text style={styles.boldText}>{stats.urgentCount}</Text> are time-sensitive right now!
                </Text>
              )}
            </Text>
          </View>

          {/* Category Bar Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Distribution by Category</Text>

            {stats.categories.length === 0 ? (
              <Text style={styles.emptyChartText}>No category statistics available yet.</Text>
            ) : (
              <View style={styles.chartContainer}>
                {stats.categories.map((cat) => {
                  const widthPercent = (cat.count / maxCategoryCount) * 100
                  return (
                    <View key={cat.name} style={styles.chartRow}>
                      <View style={styles.rowLabelContainer}>
                        <Text style={styles.rowLabel} numberOfLines={1}>
                          {cat.name}
                        </Text>
                        <Text style={styles.rowCount}>{cat.count}</Text>
                      </View>
                      <View style={styles.barContainer}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${widthPercent}%`,
                              backgroundColor: cat.color || COLORS.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
  },
  errorCard: {
    backgroundColor: COLORS.dangerLight,
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  alertCard: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  alertText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  emptyChartText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  chartContainer: {
    gap: 12,
  },
  chartRow: {
    gap: 4,
  },
  rowLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  rowCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  barContainer: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
})

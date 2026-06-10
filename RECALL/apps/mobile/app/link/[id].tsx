import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, Modal, FlatList } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/colors'
import { relativeTime } from '@recall/shared'
import PlatformIcon from '../../components/ui/PlatformIcon'
import Badge from '../../components/ui/Badge'
import Chip from '../../components/ui/Chip'
import FreshnessBar from '../../components/ui/FreshnessBar'
import { Ionicons } from '@expo/vector-icons'
import { useLinkStore } from '../../stores/linkStore'

interface CategoryItem {
  id: string
  name: string
  color: string
}

export default function LinkDetailScreen() {
  const { id: linkId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { updateLink } = useLinkStore()

  const [link, setLink] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [pickerVisible, setPickerVisible] = useState(false)
  const [categoryUpdating, setCategoryUpdating] = useState(false)

  const fetchLinkDetails = async () => {
    if (!linkId) return
    try {
      const { data, error } = await supabase
        .from('links')
        .select(`
          *, 
          ai_summaries (*), 
          link_categories (
            category_id, 
            assigned_by, 
            categories (*)
          )
        `)
        .eq('id', linkId)
        .single()

      if (error) throw error
      setLink(data)

      // Sync Zustand store in background
      updateLink(linkId, data)
    } catch (err) {
      console.error('Error fetching link details:', err)
      Alert.alert('Error', 'Failed to load link details.')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, color')
        .order('name')
      
      if (error) throw error
      setCategories(data || [])
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  useEffect(() => {
    fetchLinkDetails()
    fetchCategories()
  }, [linkId])

  const handleOpenLink = () => {
    if (link?.url) {
      Linking.openURL(link.url).catch((err) => {
        Alert.alert('Error', 'Cannot open link URL: ' + err.message)
      })
    }
  }

  const handleUpdateCategory = async (newCategoryId: string) => {
    if (!linkId) return
    setCategoryUpdating(true)
    setPickerVisible(false)

    try {
      // 1. Delete existing category links
      await supabase
        .from('link_categories')
        .delete()
        .eq('link_id', linkId)

      // 2. Insert new association
      const { error: insertError } = await supabase
        .from('link_categories')
        .insert({
          link_id: linkId,
          category_id: newCategoryId,
          assigned_by: 'user'
        })

      if (insertError) throw insertError

      // 3. Refresh display
      await fetchLinkDetails()
      Alert.alert('Success', 'Category updated successfully.')
    } catch (err) {
      console.error('Error updating category:', err)
      Alert.alert('Update Failed', 'Could not assign category.')
    } finally {
      setCategoryUpdating(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    )
  }

  if (!link) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Link not found.</Text>
      </View>
    )
  }

  const summary = link.ai_summaries
  const currentCategory = link.link_categories?.[0]?.categories
  const isPending = link.status === 'pending'
  const isActioned = link.is_actioned

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header Platform + Title */}
        <View style={styles.header}>
          <View style={styles.platformRow}>
            <PlatformIcon platform={link.platform} size={32} />
            <Text style={styles.platformText}>{link.platform.toUpperCase()}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.timeText}>{relativeTime(link.saved_at)}</Text>
          </View>
          <Text style={styles.title}>{link.title || link.url}</Text>
          
          <View style={styles.metaRow}>
            {currentCategory && (
              <Badge label={currentCategory.name} color={currentCategory.color || COLORS.muted} />
            )}
            {isActioned && (
              <View style={styles.actionedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.actionedBadgeText}>Actioned</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Note from User */}
        {link.user_note && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your Note</Text>
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>{link.user_note}</Text>
            </View>
          </View>
        )}

        {/* AI Summary */}
        {isPending ? (
          <View style={styles.pendingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.pendingText}>Generating AI summary...</Text>
          </View>
        ) : (
          <>
            {summary?.summary && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Summary</Text>
                <Text style={styles.summaryText}>{summary.summary}</Text>
              </View>
            )}

            {/* Key Points */}
            {summary?.key_points && summary.key_points.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Key Takeaways</Text>
                <View style={styles.bulletList}>
                  {summary.key_points.map((point: string, idx: number) => (
                    <View key={idx} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>{point}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Resources mentioned */}
            {summary?.resources && summary.resources.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Resources Mentioned</Text>
                <View style={styles.chipsGrid}>
                  {summary.resources.map((res: any, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => res.url && Linking.openURL(res.url)}
                      disabled={!res.url}
                    >
                      <Chip label={`${res.name} (${res.type})`} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Freshness Indicator */}
            {summary?.freshness_score !== null && summary?.freshness_score !== undefined && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Content Freshness</Text>
                <FreshnessBar score={summary.freshness_score} />
              </View>
            )}
          </>
        )}

        <View style={styles.divider} />

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {!isActioned && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push(`/action/${link.id}`)}
            >
              <Text style={styles.primaryButtonText}>Mark as Actioned</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenLink}>
            <Ionicons name="open-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryButtonText}>Open original link</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tertiaryButton, categoryUpdating && { opacity: 0.5 }]} 
            onPress={() => setPickerVisible(true)}
            disabled={categoryUpdating}
          >
            <Ionicons name="pricetag-outline" size={15} color={COLORS.muted} style={{ marginRight: 6 }} />
            <Text style={styles.tertiaryButtonText}>
              {categoryUpdating ? 'Updating...' : 'Change category'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Category Selection Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Category</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleUpdateCategory(item.id)}
                >
                  <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  {currentCategory?.id === item.id && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
  },
  header: {
    marginBottom: 16,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  platformText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    marginLeft: 8,
  },
  dot: {
    marginHorizontal: 6,
    color: COLORS.muted,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 28,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  actionedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.success,
  },
  divider: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  noteBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
  },
  noteText: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    marginVertical: 12,
  },
  pendingText: {
    fontSize: 13,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  summaryText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  bulletList: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 15,
    color: COLORS.muted,
    marginRight: 8,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    lineHeight: 20,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  actionSection: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  tertiaryButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  tertiaryButtonText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalList: {
    padding: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.surface,
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  modalItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
})

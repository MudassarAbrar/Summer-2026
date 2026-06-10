import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { COLORS } from '../../constants/colors'
import { useLinkStore } from '../../stores/linkStore'
import { Ionicons } from '@expo/vector-icons'

const QUICK_ACTIONS = [
  'Watched it',
  'Read it',
  'Tried the tool',
  'Applied / signed up'
]

export default function MarkActionedScreen() {
  const { id: linkId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const { updateLink } = useLinkStore()

  const [linkTitle, setLinkTitle] = useState('')
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    const fetchLinkTitle = async () => {
      if (!linkId) return
      try {
        const { data, error } = await supabase
          .from('links')
          .select('title, url')
          .eq('id', linkId)
          .single()

        if (error) throw error
        setLinkTitle(data.title || data.url)
      } catch (err) {
        console.error('Error fetching link for action:', err)
      } finally {
        setFetching(false)
      }
    }

    fetchLinkTitle()
  }, [linkId])

  const handleSubmit = async () => {
    if (!linkId || !user) return

    setLoading(true)
    try {
      // Build final actioned note
      const finalNote = selectedAction
        ? `${selectedAction}${noteText.trim() ? ' — ' + noteText.trim() : ''}`
        : noteText.trim() || 'Marked done'

      // 1. Update the link in Supabase
      const { error: updateError } = await supabase
        .from('links')
        .update({
          is_actioned: true,
          status: 'done',
          actioned_at: new Date().toISOString(),
          actioned_note: finalNote
        })
        .eq('id', linkId)

      if (updateError) throw updateError

      // 2. Call RPC to increment streak
      const { error: rpcError } = await supabase.rpc('increment_streak', {
        user_id_param: user.id
      })

      if (rpcError) {
        console.error('Failed to increment streak:', rpcError)
        // Non-blocking, continue redirect
      }

      // 3. Sync local Zustand store
      updateLink(linkId, {
        is_actioned: true,
        status: 'done',
        actioned_at: new Date().toISOString(),
        actioned_note: finalNote
      })

      Alert.alert(
        'Well Done! 🎉',
        'Recall marked this link as actioned and incremented your streak.',
        [
          {
            text: 'Back to Library',
            onPress: () => router.replace('/(tabs)/')
          }
        ]
      )
    } catch (err) {
      console.error('Error actioning link:', err)
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update link.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header Preview card */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>ACTIONING</Text>
          <Text style={styles.previewTitle} numberOfLines={2}>
            {linkTitle}
          </Text>
        </View>

        {/* Quick Action Selection Grid */}
        <Text style={styles.label}>Select Quick Action</Text>
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => {
            const isSelected = selectedAction === action
            return (
              <TouchableOpacity
                key={action}
                style={[
                  styles.gridItem,
                  isSelected && styles.gridItemActive
                ]}
                onPress={() => setSelectedAction(isSelected ? null : action)}
              >
                <Text
                  style={[
                    styles.gridText,
                    isSelected && styles.gridTextActive
                  ]}
                >
                  {action}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Notes Input */}
        <Text style={styles.label}>Or write what you did (optional)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="e.g. signed up for n8n, built first workflow..."
          placeholderTextColor={COLORS.muted}
          value={noteText}
          onChangeText={setNoteText}
          multiline
          numberOfLines={4}
          editable={!loading}
        />

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="checkmark-done-circle-outline" size={20} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Mark Done</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContainer: {
    padding: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  previewCard: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexGrow: 1,
    minWidth: '45%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  gridText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  gridTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    textAlignVertical: 'top',
  },
  primaryButton: {
    height: 50,
    backgroundColor: COLORS.success,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: COLORS.successLight,
    opacity: 0.8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
})

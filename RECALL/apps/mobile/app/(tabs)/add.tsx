import React, { useState, useEffect } from 'react'
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { COLORS } from '../../constants/colors'

export default function AddScreen() {
  const params = useLocalSearchParams<{ url?: string; title?: string }>()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  // Sync params when screen is loaded via share sheet redirect
  useEffect(() => {
    if (params.url) {
      setUrl(params.url)
    }
    if (params.title) {
      setTitle(params.title)
    }
  }, [params.url, params.title])

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Validation Error', 'Please enter or paste a valid URL.')
      return
    }

    if (!user) {
      Alert.alert('Session Error', 'You must be logged in to save links.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('links')
        .insert({
          user_id: user.id,
          url: url.trim(),
          title: title.trim() || null,
          user_note: note.trim() || null,
          status: 'pending',
          platform: 'other', // Detected by edge function trigger
          is_actioned: false
        })

      if (error) throw error

      Alert.alert(
        'Link Saved',
        'Recall is analyzing this link in the background. Check your library in a few seconds!',
        [
          {
            text: 'View Library',
            onPress: () => {
              // Clear state
              setUrl('')
              setTitle('')
              setNote('')
              // Redirect
              router.replace('/(tabs)/')
            }
          }
        ]
      )
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const hasSharedHeader = !!params.url

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {hasSharedHeader && (
          <View style={styles.sharedHeader}>
            <Text style={styles.sharedHeaderText}>
              Saving link shared from external app
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Link URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://example.com/article"
            placeholderTextColor={COLORS.muted}
            value={url}
            onChangeText={setUrl}
            editable={!loading}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.label}>Link Title (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. My Favorite Article"
            placeholderTextColor={COLORS.muted}
            value={title}
            onChangeText={setTitle}
            editable={!loading}
          />

          <Text style={styles.label}>Your Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. Remember to try this API or read this project code later..."
            placeholderTextColor={COLORS.muted}
            value={note}
            onChangeText={setNote}
            editable={!loading}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.buttonText}>Save to Recall</Text>
            )}
          </TouchableOpacity>
        </View>
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
    paddingTop: 8,
  },
  sharedHeader: {
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: COLORS.primary,
  },
  sharedHeaderText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    padding: 18,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  button: {
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: COLORS.primaryLight,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
})

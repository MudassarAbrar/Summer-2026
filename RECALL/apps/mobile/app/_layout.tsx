import React, { useEffect } from 'react'
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent'
import { useAuthStore } from '../stores/authStore'
import { registerPushToken } from '../lib/notifications'
import { COLORS } from '../constants/colors'

function LayoutContent() {
  const { user, loading, initialize } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext()

  useEffect(() => {
    initialize()
  }, [])

  // Push token registration on login
  useEffect(() => {
    if (user) {
      registerPushToken()
    }
  }, [user])

  // Share Intent Handler
  useEffect(() => {
    if (hasShareIntent && shareIntent?.webUrl && user) {
      router.push({
        pathname: '/(tabs)/add',
        params: {
          url: shareIntent.webUrl,
          title: shareIntent.meta?.title ?? ''
        }
      })
      resetShareIntent()
    }
  }, [hasShareIntent, shareIntent, user])

  // Routing Auth Protection
  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [user, segments, loading])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Connecting to Recall...</Text>
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="link/[id]" 
        options={{ 
          headerShown: true, 
          title: 'Link Detail',
          headerTintColor: COLORS.primary,
          headerTitleStyle: { color: COLORS.text }
        }} 
      />
      <Stack.Screen 
        name="action/[id]" 
        options={{ 
          headerShown: true, 
          title: 'Mark as Actioned',
          headerTintColor: COLORS.primary,
          headerTitleStyle: { color: COLORS.text }
        }} 
      />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <LayoutContent />
    </ShareIntentProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: '500',
  },
})

import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { Platform } from '@recall/shared'

interface PlatformIconProps {
  platform: Platform
  size?: number
}

export default function PlatformIcon({ platform, size = 24 }: PlatformIconProps) {
  let iconComponent = null

  switch (platform) {
    case 'youtube':
      iconComponent = <Ionicons name="logo-youtube" size={size} color="#EF4444" />
      break
    case 'linkedin':
      iconComponent = <Ionicons name="logo-linkedin" size={size} color="#0A66C2" />
      break
    case 'tiktok':
      iconComponent = <Ionicons name="logo-tiktok" size={size} color="#000000" />
      break
    case 'instagram':
      iconComponent = <Ionicons name="logo-instagram" size={size} color="#E1306C" />
      break
    case 'twitter':
      iconComponent = <Ionicons name="logo-twitter" size={size} color="#1DA1F2" />
      break
    case 'blog':
    default:
      iconComponent = <Feather name="globe" size={size - 2} color="#64748B" />
      break
  }

  return (
    <View style={[styles.container, { width: size + 4, height: size + 4 }]}>
      {iconComponent}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
})

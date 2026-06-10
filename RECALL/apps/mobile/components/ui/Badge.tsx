import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface BadgeProps {
  label: string
  color: string
}

export default function Badge({ label, color }: BadgeProps) {
  // Safe background color with ~15% opacity if color is hex
  const getBackgroundColor = (baseColor: string) => {
    if (baseColor.startsWith('#') && baseColor.length === 7) {
      return `${baseColor}26` // 15% opacity hex suffix
    }
    return 'rgba(100, 116, 139, 0.15)'
  }

  return (
    <View style={[styles.badge, { backgroundColor: getBackgroundColor(color) }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
})

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'

interface ChipProps {
  label: string
}

export default function Chip({ label }: ChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.text} numberOfLines={1}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginRight: 6,
    marginBottom: 6,
    maxWidth: 140,
  },
  text: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '500',
  },
})

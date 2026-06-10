import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'

interface FreshnessBarProps {
  score: number // 1-10
}

export default function FreshnessBar({ score }: FreshnessBarProps) {
  let fillColor = COLORS.success
  let label = 'Still relevant'

  if (score >= 7) {
    fillColor = COLORS.success
    label = 'Still relevant'
  } else if (score >= 4) {
    fillColor = COLORS.warning
    label = 'May be outdated'
  } else {
    fillColor = COLORS.danger
    label = 'Likely outdated'
  }

  // Calculate percentage width (clamped between 10% and 100%)
  const percentage = Math.min(Math.max(score * 10, 10), 100)

  return (
    <View style={styles.container}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={[styles.label, { color: fillColor }]}>{label} ({score}/10)</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  barBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
})

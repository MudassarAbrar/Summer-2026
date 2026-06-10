import { Platform } from '../constants/platforms'
import { Category } from './category'

export type LinkStatus = 'pending' | 'ready' | 'done'

export interface Link {
  id: string
  user_id: string
  url: string
  title: string | null
  user_note: string | null
  platform: Platform
  status: LinkStatus
  is_actioned: boolean
  actioned_note: string | null
  saved_at: string
  actioned_at: string | null
  reminder_count: number
  next_reminder_at: string | null
}

export interface AISummary {
  id: string
  link_id: string
  summary: string | null
  key_points: string[] | null
  resources: { name: string; type: string; url: string }[] | null
  freshness_score: number | null
  is_time_sensitive: boolean
  created_at: string
}

export interface LinkWithSummary extends Link {
  ai_summaries: AISummary | null
  link_categories: { category_id: string; categories: Category }[]
}

/**
 * Platform constants and enums
 */

export const PLATFORMS = {
  YOUTUBE: 'youtube',
  TIKTOK: 'tiktok',
  INSTAGRAM: 'instagram',
  LINKEDIN: 'linkedin',
  TWITTER: 'twitter',
  BLOG: 'blog',
  OTHER: 'other',
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

export const DEFAULT_CATEGORIES = [
  { name: 'Tools & Apps', color: '#378ADD' },
  { name: 'Courses', color: '#1D9E75' },
  { name: 'Opportunities', color: '#BA7517' },
  { name: 'Inspiration', color: '#7F77DD' },
  { name: 'Resources', color: '#639922' },
  { name: 'News & Trends', color: '#D85A30' },
  { name: 'Locations', color: '#D4537E' },
  { name: 'Reference', color: '#888780' },
] as const;

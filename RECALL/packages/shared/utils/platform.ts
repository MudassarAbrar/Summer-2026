/**
 * Platform detection and patterns for Recall
 */

export type PlatformType =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'blog'
  | 'other';

export const PLATFORM_PATTERNS: Record<PlatformType, RegExp> = {
  youtube: /^https?:\/\/(www\.)?youtube\.com|youtu\.be/,
  tiktok: /^https?:\/\/(www\.)?tiktok\.com/,
  instagram: /^https?:\/\/(www\.)?instagram\.com/,
  linkedin: /^https?:\/\/(www\.)?linkedin\.com/,
  twitter: /^https?:\/\/(www\.)?(twitter|x)\.com/,
  blog: /^https?:\/\/.+\.(blog|medium\.com|substack\.com)/,
  other: /./,
};

/**
 * Detect the platform from a URL
 */
export function detectPlatform(url: string): PlatformType {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (platform !== 'other' && pattern.test(url)) {
      return platform as PlatformType;
    }
  }
  return 'other';
}

/**
 * Extract domain from URL for display
 */
export function getDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

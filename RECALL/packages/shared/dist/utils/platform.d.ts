/**
 * Platform detection and patterns for Recall
 */
export type PlatformType = 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'twitter' | 'blog' | 'other';
export declare const PLATFORM_PATTERNS: Record<PlatformType, RegExp>;
/**
 * Detect the platform from a URL
 */
export declare function detectPlatform(url: string): PlatformType;
/**
 * Extract domain from URL for display
 */
export declare function getDomain(url: string): string;
//# sourceMappingURL=platform.d.ts.map
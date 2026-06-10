/**
 * Platform detection and patterns for Recall
 */
export const PLATFORM_PATTERNS = {
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
export function detectPlatform(url) {
    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
        if (platform !== 'other' && pattern.test(url)) {
            return platform;
        }
    }
    return 'other';
}
/**
 * Extract domain from URL for display
 */
export function getDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace('www.', '');
    }
    catch {
        return 'unknown';
    }
}
//# sourceMappingURL=platform.js.map
/**
 * Platform constants and enums
 */
export declare const PLATFORMS: {
    readonly YOUTUBE: "youtube";
    readonly TIKTOK: "tiktok";
    readonly INSTAGRAM: "instagram";
    readonly LINKEDIN: "linkedin";
    readonly TWITTER: "twitter";
    readonly BLOG: "blog";
    readonly OTHER: "other";
};
export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];
export declare const DEFAULT_CATEGORIES: readonly [{
    readonly name: "Tools & Apps";
    readonly color: "#378ADD";
}, {
    readonly name: "Courses";
    readonly color: "#1D9E75";
}, {
    readonly name: "Opportunities";
    readonly color: "#BA7517";
}, {
    readonly name: "Inspiration";
    readonly color: "#7F77DD";
}, {
    readonly name: "Resources";
    readonly color: "#639922";
}, {
    readonly name: "News & Trends";
    readonly color: "#D85A30";
}, {
    readonly name: "Locations";
    readonly color: "#D4537E";
}, {
    readonly name: "Reference";
    readonly color: "#888780";
}];
//# sourceMappingURL=platforms.d.ts.map
import { z } from "zod";
export declare const MarketplaceCatalogEntrySchema: z.ZodObject<{
    listingId: z.ZodString;
    title: z.ZodString;
    trustLevel: z.ZodEnum<["sandboxed", "verified", "enterprise"]>;
    lifecycleState: z.ZodEnum<["draft", "submitted", "certified", "published", "deprecated", "retired"]>;
    qualityMetrics: z.ZodDefault<z.ZodObject<{
        reliabilityScore: z.ZodDefault<z.ZodNumber>;
        usabilityScore: z.ZodDefault<z.ZodNumber>;
        supportScore: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        reliabilityScore: number;
        usabilityScore: number;
        supportScore: number;
    }, {
        reliabilityScore?: number | undefined;
        usabilityScore?: number | undefined;
        supportScore?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    lifecycleState: "draft" | "deprecated" | "retired" | "submitted" | "published" | "certified";
    trustLevel: "verified" | "enterprise" | "sandboxed";
    listingId: string;
    qualityMetrics: {
        reliabilityScore: number;
        usabilityScore: number;
        supportScore: number;
    };
}, {
    title: string;
    lifecycleState: "draft" | "deprecated" | "retired" | "submitted" | "published" | "certified";
    trustLevel: "verified" | "enterprise" | "sandboxed";
    listingId: string;
    qualityMetrics?: {
        reliabilityScore?: number | undefined;
        usabilityScore?: number | undefined;
        supportScore?: number | undefined;
    } | undefined;
}>;
export type MarketplaceCatalogEntry = z.infer<typeof MarketplaceCatalogEntrySchema>;
export declare function sortMarketplaceCatalog(entries: readonly MarketplaceCatalogEntry[]): MarketplaceCatalogEntry[];

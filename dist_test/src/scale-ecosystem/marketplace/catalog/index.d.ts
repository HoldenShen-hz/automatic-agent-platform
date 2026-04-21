import { z } from "zod";
export declare const MarketplaceCatalogEntrySchema: z.ZodObject<{
    listingId: z.ZodString;
    title: z.ZodString;
    trustLevel: z.ZodEnum<["sandboxed", "verified", "enterprise"]>;
    lifecycleState: z.ZodEnum<["draft", "submitted", "certified", "published", "deprecated", "retired"]>;
}, "strip", z.ZodTypeAny, {
    title: string;
    lifecycleState: "draft" | "submitted" | "published" | "deprecated" | "certified" | "retired";
    trustLevel: "verified" | "enterprise" | "sandboxed";
    listingId: string;
}, {
    title: string;
    lifecycleState: "draft" | "submitted" | "published" | "deprecated" | "certified" | "retired";
    trustLevel: "verified" | "enterprise" | "sandboxed";
    listingId: string;
}>;
export type MarketplaceCatalogEntry = z.infer<typeof MarketplaceCatalogEntrySchema>;
export declare function sortMarketplaceCatalog(entries: readonly MarketplaceCatalogEntry[]): MarketplaceCatalogEntry[];

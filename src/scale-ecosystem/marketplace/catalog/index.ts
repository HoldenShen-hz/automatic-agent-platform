import { z } from "zod";

export const MarketplaceCatalogEntrySchema = z.object({
  listingId: z.string().min(1),
  title: z.string().min(1),
  trustLevel: z.enum(["sandboxed", "verified", "enterprise"]),
  lifecycleState: z.enum(["draft", "submitted", "certified", "published", "deprecated", "retired"]),
  qualityMetrics: z.object({
    reliabilityScore: z.number().min(0).max(1).default(0),
    usabilityScore: z.number().min(0).max(1).default(0),
    supportScore: z.number().min(0).max(1).default(0),
  }).default({
    reliabilityScore: 0,
    usabilityScore: 0,
    supportScore: 0,
  }),
});

export type MarketplaceCatalogEntry = z.infer<typeof MarketplaceCatalogEntrySchema>;

export function sortMarketplaceCatalog(entries: readonly MarketplaceCatalogEntry[]): MarketplaceCatalogEntry[] {
  const rank = { enterprise: 0, verified: 1, sandboxed: 2 } as const;
  return [...entries].sort((left, right) => {
    const trustDelta = rank[left.trustLevel] - rank[right.trustLevel];
    if (trustDelta !== 0) {
      return trustDelta;
    }
    const leftQuality = left.qualityMetrics.reliabilityScore + left.qualityMetrics.usabilityScore + left.qualityMetrics.supportScore;
    const rightQuality = right.qualityMetrics.reliabilityScore + right.qualityMetrics.usabilityScore + right.qualityMetrics.supportScore;
    return rightQuality - leftQuality;
  });
}

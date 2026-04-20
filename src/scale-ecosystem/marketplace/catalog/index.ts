import { z } from "zod";

export const MarketplaceCatalogEntrySchema = z.object({
  listingId: z.string().min(1),
  title: z.string().min(1),
  trustLevel: z.enum(["sandboxed", "verified", "enterprise"]),
  lifecycleState: z.enum(["draft", "submitted", "certified", "published", "deprecated", "retired"]),
});

export type MarketplaceCatalogEntry = z.infer<typeof MarketplaceCatalogEntrySchema>;

export function sortMarketplaceCatalog(entries: readonly MarketplaceCatalogEntry[]): MarketplaceCatalogEntry[] {
  const rank = { enterprise: 0, verified: 1, sandboxed: 2 } as const;
  return [...entries].sort((left, right) => rank[left.trustLevel] - rank[right.trustLevel]);
}

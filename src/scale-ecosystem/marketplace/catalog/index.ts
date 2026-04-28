import { z } from "zod";

export const MarketplaceCatalogEntrySchema = z.object({
  listingId: z.string().min(1),
  publisherId: z.string().min(1).default("unknown_publisher"),
  title: z.string().min(1),
  artifactType: z.enum(["pack", "plugin", "connector", "template"]).default("pack"),
  artifactRef: z.string().min(1).default("artifact://unknown"),
  pricingModel: z.enum(["free", "enterprise_included", "paid"]).default("free"),
  capabilities: z.array(z.string()).default([]),
  version: z.string().min(1).default("0.0.0"),
  dependencies: z.array(z.object({
    listingId: z.string().min(1),
    versionRange: z.string().min(1),
    optional: z.boolean().default(false),
  })).default([]),
  compatibility: z.object({
    minPlatformVersion: z.string().min(1).default("0.0.0"),
    supportedArtifactTypes: z.array(z.string()).default([]),
  }).default({}),
  trustLevel: z.enum(["internal", "verified", "community", "unknown"]).default("unknown"),
  reviewStatus: z.enum(["draft", "submitted", "certified"]).default("draft"),
  lifecycleState: z.enum(["active", "deprecated", "sunset", "removed"]).default("active"),
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
  const rank = { internal: 0, verified: 1, community: 2, unknown: 3 } as const;
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

export interface ListingCompatibilityCheck {
  readonly valid: boolean;
  readonly missingDependencies: readonly string[];
  readonly incompatibilities: readonly string[];
}

export function validateListingDependencies(
  entry: MarketplaceCatalogEntry,
  availableEntries: readonly MarketplaceCatalogEntry[],
): ListingCompatibilityCheck {
  const availableById = new Map(availableEntries.map((item) => [item.listingId, item]));
  const missingDependencies: string[] = [];
  const incompatibilities: string[] = [];
  for (const dependency of entry.dependencies) {
    const target = availableById.get(dependency.listingId);
    if (target == null) {
      if (!dependency.optional) {
        missingDependencies.push(dependency.listingId);
      }
      continue;
    }
    if (entry.compatibility.supportedArtifactTypes.length > 0
      && !entry.compatibility.supportedArtifactTypes.includes(target.artifactType)) {
      incompatibilities.push(`artifact_type:${dependency.listingId}`);
    }
  }
  return {
    valid: missingDependencies.length === 0 && incompatibilities.length === 0,
    missingDependencies,
    incompatibilities,
  };
}

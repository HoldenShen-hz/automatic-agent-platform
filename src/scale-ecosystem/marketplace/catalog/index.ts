import { z } from "zod";

export const MarketplaceCatalogEntrySchema = z.object({
  entryId: z.string().min(1),
  packId: z.string().min(1).optional(),
  publisherId: z.string().min(1).default("unknown_publisher"),
  title: z.string().min(1),
  artifactType: z.enum(["pack", "plugin", "connector", "template"]).default("pack"),
  artifactRef: z.string().min(1).default("artifact://unknown"),
  pricingModel: z.enum(["free", "enterprise_included", "paid"]).default("free"),
  rating: z.number().min(0).max(5).optional().default(0),
  installCount: z.number().int().nonnegative().optional().default(0),
  capabilities: z.array(z.string()).default([]),
  version: z.string().min(1).default("0.0.0"),
  dependencies: z.array(z.object({
    entryId: z.string().min(1),
    versionRange: z.string().min(1),
    optional: z.boolean().default(false),
  })).default([]),
  compatibility: z.object({
    minPlatformVersion: z.string().min(1).default("0.0.0"),
    supportedArtifactTypes: z.array(z.string()).default([]),
  }).default({}),
  trustLevel: z.enum(["internal", "verified", "community", "unknown"]).default("unknown"),
  certificationStatus: z.enum(["uncertified", "self_certified", "third_party_certified", "platform_certified"]).default("uncertified"),
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
  const availableById = new Map(availableEntries.map((item) => [item.entryId, item]));
  const missingDependencies: string[] = [];
  const incompatibilities: string[] = [];
  for (const dependency of entry.dependencies) {
    const target = availableById.get(dependency.entryId);
    if (target == null) {
      if (!dependency.optional) {
        missingDependencies.push(dependency.entryId);
      }
      continue;
    }
    if (entry.compatibility.supportedArtifactTypes.length > 0
      && !entry.compatibility.supportedArtifactTypes.includes(target.artifactType)) {
      incompatibilities.push(`artifact_type:${dependency.entryId}`);
    }
  }
  return {
    valid: missingDependencies.length === 0 && incompatibilities.length === 0,
    missingDependencies,
    incompatibilities,
  };
}

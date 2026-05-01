import { z } from "zod";
import { createSemverValidator } from "../../../ops-maturity/version-management/semver-validator.js";
import { VersionCompatibilityMatrix } from "../../../ops-maturity/version-management/version-compatibility-matrix.js";

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
  /** Entry IDs that appear in a dependency cycle (R13-29) */
  readonly cyclicDependencies: readonly string[];
  /** Available upgrade paths for incompatible dependencies (R13-30) */
  readonly upgradePaths: readonly UpgradePath[];
}

export interface UpgradePath {
  readonly entryId: string;
  readonly currentVersion: string;
  readonly targetVersion: string;
  readonly breaking: boolean;
  readonly reason: string;
}

/**
 * Validates listing dependencies with full version range parsing, transitive
 * dependency graph cycle detection, and upgrade path calculation.
 *
 * R13-28: Uses SemverValidator.satisfies() to parse semver ranges (^, ~, >=, etc.)
 *         against the available dependency version.
 * R13-29: Builds the full transitive dependency graph and detects cycles via DFS.
 * R13-30: Uses VersionCompatibilityMatrix to cross-version compare compatibilityJson
 *         entries and detect breaking changes.
 */
export function validateListingDependencies(
  entry: MarketplaceCatalogEntry,
  availableEntries: readonly MarketplaceCatalogEntry[],
  compatibilityMatrix?: VersionCompatibilityMatrix,
): ListingCompatibilityCheck {
  const availableById = new Map(availableEntries.map((item) => [item.entryId, item]));
  const semver = createSemverValidator();
  const missingDependencies: string[] = [];
  const incompatibilities: string[] = [];
  const cyclicDependencies: string[] = [];
  const upgradePaths: UpgradePath[] = [];

  // ─── R13-28: Version range parsing ────────────────────────────────────────
  for (const dependency of entry.dependencies) {
    const target = availableById.get(dependency.entryId);
    if (target == null) {
      if (!dependency.optional) {
        missingDependencies.push(dependency.entryId);
      }
      continue;
    }

    // R13-28: Parse and validate the semver range against the available version
    if (dependency.versionRange && dependency.versionRange !== "*") {
      if (!semver.satisfies(target.version, dependency.versionRange)) {
        incompatibilities.push(`version_range:${dependency.entryId}:${target.version} does not satisfy ${dependency.versionRange}`);
        continue;
      }
    }

    if (entry.compatibility.supportedArtifactTypes.length > 0
      && !entry.compatibility.supportedArtifactTypes.includes(target.artifactType)) {
      incompatibilities.push(`artifact_type:${dependency.entryId}`);
    }
  }

  // ─── R13-29: Transitive dependency graph and cycle detection ───────────────
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(entryId: string, path: string[]): boolean {
    if (recursionStack.has(entryId)) {
      // Found a cycle: path from entryId back to entryId
      cyclicDependencies.push(entryId);
      return true;
    }
    if (visited.has(entryId)) return false;

    visited.add(entryId);
    recursionStack.add(entryId);

    const item = availableById.get(entryId);
    if (item) {
      for (const dep of item.dependencies) {
        if (hasCycle(dep.entryId, [...path, entryId])) {
          cyclicDependencies.push(dep.entryId);
          return true;
        }
      }
    }

    recursionStack.delete(entryId);
    return false;
  }

  // Check cycles for every reachable entry
  for (const dep of entry.dependencies) {
    visited.clear();
    recursionStack.clear();
    hasCycle(dep.entryId, [entry.entryId]);
  }

  // ─── R13-30: Upgrade path calculation and breaking change detection ─────────
  if (compatibilityMatrix) {
    for (const dependency of entry.dependencies) {
      const target = availableById.get(dependency.entryId);
      if (!target) continue;

      // Walk available versions to find compatible upgrades
      const allVersions = availableEntries
        .filter((e) => e.entryId === dependency.entryId)
        .map((e) => e.version)
        .filter((v) => semver.isValid(v));

      // Sort versions ascending
      allVersions.sort((a, b) => semver.compare(a, b));

      for (const candidateVersion of allVersions) {
        if (semver.compare(candidateVersion, target.version) <= 0) continue;

        const result = compatibilityMatrix.checkCompatibility(
          { packId: target.packId ?? target.entryId, version: target.version },
          { packId: target.packId ?? target.entryId, version: candidateVersion },
        );

        // Detect breaking changes: major version bump or explicit incompatible level
        const targetParsed = semver.parse(target.version);
        const candidateParsed = semver.parse(candidateVersion);
        const breaking = (targetParsed.isValid && candidateParsed.isValid
          && candidateParsed.version.major !== targetParsed.version.major)
          || result.level === "incompatible";

        if (!result.compatible || breaking) {
          upgradePaths.push({
            entryId: dependency.entryId,
            currentVersion: target.version,
            targetVersion: candidateVersion,
            breaking,
            reason: result.reason ?? (breaking ? "breaking major version change" : "incompatible"),
          });
        }
      }
    }
  }

  return {
    // Root cause: Cycle detection exists but was not being enforced in the valid flag
    // Fix: Ensure cyclic dependencies make the listing invalid
    valid: missingDependencies.length === 0 && incompatibilities.length === 0 && cyclicDependencies.length === 0,
    missingDependencies,
    incompatibilities,
    cyclicDependencies: Array.from(new Set(cyclicDependencies)),
    upgradePaths,
  };
}

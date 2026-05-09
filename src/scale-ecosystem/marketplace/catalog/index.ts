import { z } from "zod";

/**
 * Parse and compare semantic versions
 */
function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split(".").map((p) => parseInt(p, 10) || 0);
  return { major: parts[0] ?? 0, minor: parts[1] ?? 0, patch: parts[2] ?? 0 };
}

function compareSemver(a: string, b: string): number {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  if (av.major !== bv.major) return av.major - bv.major;
  if (av.minor !== bv.minor) return av.minor - bv.minor;
  return av.patch - bv.patch;
}

/**
 * Check if a version satisfies a version range (simple semver)
 * Supports: exact, ^, ~, >=, <=, >
 */
function satisfiesVersionRange(version: string, range: string): boolean {
  const v = parseSemver(version);
  // Parse range (simplified - supports ^, ~, exact)
  if (range.startsWith("^")) {
    const min = parseSemver(range.slice(1));
    return v.major === min.major && v.minor >= min.minor && v.patch >= min.patch;
  }
  if (range.startsWith("~")) {
    const min = parseSemver(range.slice(1));
    return v.major === min.major && v.minor === min.minor && v.patch >= min.patch;
  }
  if (range.startsWith(">=")) {
    return compareSemver(version, range.slice(2)) >= 0;
  }
  if (range.startsWith("<=")) {
    return compareSemver(version, range.slice(2)) <= 0;
  }
  if (range.startsWith(">")) {
    return compareSemver(version, range.slice(1)) > 0;
  }
  if (range.startsWith("<")) {
    return compareSemver(version, range.slice(1)) < 0;
  }
  // Exact match
  return version === range || compareSemver(version, range) === 0;
}

/**
 * Check if upgrade is a breaking change (major version bump)
 */
function isBreakingChange(fromVersion: string, toVersion: string): boolean {
  const from = parseSemver(fromVersion);
  const to = parseSemver(toVersion);
  return to.major > from.major;
}

/**
 * Dependency node for graph analysis
 */
interface DependencyNode {
  readonly entryId: string;
  readonly version: string;
  readonly dependencies: readonly { listingId: string; versionRange: string }[];
}

function resolveMarketplaceCatalogEntryId(
  entry: Pick<MarketplaceCatalogEntry, "entryId" | "listingId">,
): string {
  return entry.entryId ?? entry.listingId ?? "unknown_entry";
}

/**
 * Build dependency graph and detect cycles
 */
function buildDependencyGraph(
  entry: MarketplaceCatalogEntry,
  allEntries: readonly MarketplaceCatalogEntry[],
): { graph: Map<string, DependencyNode>; cycles: readonly string[][] } {
  const graph = new Map<string, DependencyNode>();
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(entryId: string, path: string[]): void {
    if (recursionStack.has(entryId)) {
      // Found cycle
      const cycleStart = path.indexOf(entryId);
      cycles.push([...path.slice(cycleStart), entryId]);
      return;
    }
    if (visited.has(entryId)) return;

    visited.add(entryId);
    recursionStack.add(entryId);

    const catalogEntry = allEntries.find((item) => resolveMarketplaceCatalogEntryId(item) === entryId);
    if (catalogEntry) {
      const deps = catalogEntry.dependencies ?? [];
      graph.set(entryId, {
        entryId: resolveMarketplaceCatalogEntryId(catalogEntry),
        version: catalogEntry.version ?? "0.0.0",
        dependencies: deps.map((d) => ({ listingId: d.listingId, versionRange: d.versionRange })),
      });
      for (const dep of deps) {
        dfs(dep.listingId, [...path, entryId]);
      }
    }

    recursionStack.delete(entryId);
  }

  const entryId = resolveMarketplaceCatalogEntryId(entry);
  const entryDeps = entry.dependencies ?? [];
  graph.set(entryId, {
    entryId,
    version: entry.version ?? "0.0.0",
    dependencies: entryDeps.map((d) => ({ listingId: d.listingId, versionRange: d.versionRange })),
  });
  for (const dep of entryDeps) {
    dfs(dep.listingId, [entryId]);
  }

  return { graph, cycles };
}

/**
 * Calculate upgrade path between versions
 */
function calculateUpgradePath(
  currentVersion: string,
  targetVersion: string,
): readonly string[] {
  const upgrades: string[] = [];
  const current = parseSemver(currentVersion);
  const target = parseSemver(targetVersion);

  // Simple path: increment patch, then minor, then major
  let v = { ...current };
  while (v.major < target.major || v.minor < target.minor || v.patch < target.patch) {
    if (v.patch < target.patch || (v.patch === target.patch && v.minor === target.minor && v.major < target.major)) {
      v.patch++;
    } else if (v.minor < target.minor || (v.minor === target.minor && v.major < target.major)) {
      v.minor++;
      v.patch = 0;
    } else {
      v.major++;
      v.minor = 0;
      v.patch = 0;
    }
    upgrades.push(`${v.major}.${v.minor}.${v.patch}`);
    if (upgrades.length > 100) break; // Safety limit
  }

  return upgrades;
}

export const MarketplaceCatalogEntrySchema = z.object({
  entryId: z.string().min(1).optional(),
  listingId: z.string().min(1).optional(),
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
    listingId: z.string().min(1),
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
  reviewStatus: z.enum(["submitted", "reviewing", "approved", "published", "suspended", "rejected", "revoked"]).default("submitted"),
  qualityMetrics: z.object({
    reliabilityScore: z.number().min(0).max(1).default(0),
    usabilityScore: z.number().min(0).max(1).default(0),
    supportScore: z.number().min(0).max(1).default(0),
  }).default({
    reliabilityScore: 0,
    usabilityScore: 0,
    supportScore: 0,
  }),
}).superRefine((value, ctx) => {
  if ((value.entryId ?? value.listingId) == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "entryId or listingId is required",
      path: ["entryId"],
    });
  }
}).transform((value) => {
  const entryId = value.entryId ?? value.listingId!;
  return {
    ...value,
    entryId,
    listingId: value.listingId ?? entryId,
    packId: value.packId ?? entryId,
  };
});

export type MarketplaceCatalogEntry = z.input<typeof MarketplaceCatalogEntrySchema>;
export type NormalizedMarketplaceCatalogEntry = z.output<typeof MarketplaceCatalogEntrySchema>;

export function sortMarketplaceCatalog(entries: readonly MarketplaceCatalogEntry[]): MarketplaceCatalogEntry[] {
  const rank = { internal: 0, verified: 1, community: 2, unknown: 3 } as const;
  return [...entries].sort((left, right) => {
    const leftTrust = rank[left.trustLevel ?? "unknown"];
    const rightTrust = rank[right.trustLevel ?? "unknown"];
    const trustDelta = leftTrust - rightTrust;
    if (trustDelta !== 0) {
      return trustDelta;
    }
    const leftMetrics = left.qualityMetrics ?? { reliabilityScore: 0, usabilityScore: 0, supportScore: 0 };
    const rightMetrics = right.qualityMetrics ?? { reliabilityScore: 0, usabilityScore: 0, supportScore: 0 };
    const leftQuality = (leftMetrics.reliabilityScore ?? 0) + (leftMetrics.usabilityScore ?? 0) + (leftMetrics.supportScore ?? 0);
    const rightQuality = (rightMetrics.reliabilityScore ?? 0) + (rightMetrics.usabilityScore ?? 0) + (rightMetrics.supportScore ?? 0);
    return rightQuality - leftQuality;
  });
}

export interface ListingCompatibilityCheck {
  readonly valid: boolean;
  readonly missingDependencies: readonly string[];
  readonly incompatibilities: readonly string[];
  /** Version range mismatches (R13-28) */
  readonly versionMismatches: readonly string[];
}

/**
 * Validate listing dependencies with semver range checking (R13-28)
 */
export function validateListingDependencies(
  entry: MarketplaceCatalogEntry,
  availableEntries: readonly MarketplaceCatalogEntry[],
): ListingCompatibilityCheck {
  const availableById = new Map(availableEntries.map((item) => [resolveMarketplaceCatalogEntryId(item), item]));
  const missingDependencies: string[] = [];
  const incompatibilities: string[] = [];
  const versionMismatches: string[] = [];

  for (const dependency of entry.dependencies ?? []) {
    const target = availableById.get(dependency.listingId);
    if (target == null) {
      if (!dependency.optional) {
        missingDependencies.push(dependency.listingId);
      }
      continue;
    }

    // R13-28: Validate version range
    const targetVersion = target.version ?? "0.0.0";
    if (!satisfiesVersionRange(targetVersion, dependency.versionRange)) {
      versionMismatches.push(`${dependency.listingId}: need ${dependency.versionRange}, got ${targetVersion}`);
    }

    const supportedTypes = entry.compatibility?.supportedArtifactTypes ?? [];
    const targetArtifactType = target.artifactType ?? "pack";
    if (supportedTypes.length > 0 && !supportedTypes.includes(targetArtifactType)) {
      incompatibilities.push(`artifact_type:${dependency.listingId}`);
    }
  }

  return {
    valid: missingDependencies.length === 0 && incompatibilities.length === 0 && versionMismatches.length === 0,
    missingDependencies,
    incompatibilities,
    versionMismatches,
  };
}

/**
 * Result of transitive dependency graph analysis (R13-29)
 */
export interface DependencyGraphResult {
  readonly valid: boolean;
  readonly cycles: readonly string[][];
  readonly graph: ReadonlyMap<string, DependencyNode>;
  readonly missingDependencies: readonly string[];
}

/**
 * Analyze transitive dependency graph and detect cycles (R13-29)
 */
export function analyzeDependencyGraph(
  entry: MarketplaceCatalogEntry,
  allEntries: readonly MarketplaceCatalogEntry[],
): DependencyGraphResult {
  const { graph, cycles } = buildDependencyGraph(entry, allEntries);
  const missingDependencies: string[] = [];

  for (const [id, node] of graph) {
    if (id === resolveMarketplaceCatalogEntryId(entry)) continue;
    if (!allEntries.some((item) => resolveMarketplaceCatalogEntryId(item) === id)) {
      missingDependencies.push(id);
    }
  }

  return {
    valid: cycles.length === 0 && missingDependencies.length === 0,
    cycles,
    graph,
    missingDependencies,
  };
}

/**
 * R15-64: Reverse dependency check result for uninstall/deprecation operations
 */
export interface ReverseDependencyCheck {
  readonly hasReverseDependencies: boolean;
  readonly dependentEntries: readonly MarketplaceCatalogEntry[];
  readonly canSafelyRemove: boolean;
  readonly blockers: readonly string[];
}

/**
 * R15-64: Check if any other entries depend on the given entry before uninstall/deprecation.
 *
 * This performs a reverse dependency analysis to ensure that removing or deprecating
 * an entry won't break other entries that depend on it.
 */
export function checkReverseDependencies(
  entry: MarketplaceCatalogEntry,
  allEntries: readonly MarketplaceCatalogEntry[],
): ReverseDependencyCheck {
  const entryId = resolveMarketplaceCatalogEntryId(entry);
  // Find all entries that list this entry as a dependency
  const dependentEntries = allEntries.filter((e) =>
    resolveMarketplaceCatalogEntryId(e) !== entryId &&
    (e.dependencies ?? []).some((dep) => dep.listingId === entryId)
  );

  const blockers: string[] = [];
  for (const dependent of dependentEntries) {
    blockers.push(`${resolveMarketplaceCatalogEntryId(dependent)}@${dependent.version ?? "0.0.0"} depends on ${entryId}`);
  }

  return {
    hasReverseDependencies: dependentEntries.length > 0,
    dependentEntries,
    canSafelyRemove: dependentEntries.length === 0,
    blockers,
  };
}

/**
 * Upgrade path calculation result (R13-30)
 */
export interface UpgradePathResult {
  readonly listingId: string;
  readonly currentVersion: string;
  readonly targetVersion: string;
  readonly path: readonly string[];
  readonly isBreaking: boolean;
  readonly estimatedSteps: number;
}

/**
 * Calculate upgrade path and detect breaking changes (R13-30)
 */
export function calculateUpgradePathForEntry(
  entry: MarketplaceCatalogEntry,
  targetVersion: string,
): UpgradePathResult {
  const currentVersion = entry.version ?? "0.0.0";
  const path = calculateUpgradePath(currentVersion, targetVersion);
  return {
    currentVersion,
    targetVersion,
    path,
    isBreaking: isBreakingChange(currentVersion, targetVersion),
    estimatedSteps: path.length,
    listingId: resolveMarketplaceCatalogEntryId(entry),
  };
}

/**
 * Detect breaking changes between versions (R13-30)
 */
export function detectBreakingChanges(
  fromVersion: string,
  toVersion: string,
): boolean {
  return isBreakingChange(fromVersion, toVersion);
}

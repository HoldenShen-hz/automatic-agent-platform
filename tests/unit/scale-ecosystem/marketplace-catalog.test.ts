import assert from "node:assert/strict";
import test from "node:test";

import {
  sortMarketplaceCatalog,
  MarketplaceCatalogEntrySchema,
  validateListingDependencies,
  analyzeDependencyGraph,
  calculateUpgradePathForEntry,
  checkReverseDependencies,
  detectBreakingChanges,
  type MarketplaceCatalogEntry,
} from "../../../src/scale-ecosystem/marketplace/catalog/index.js";

function createCatalogEntry(overrides: Partial<MarketplaceCatalogEntry> = {}): MarketplaceCatalogEntry {
  return {
    listingId: overrides.listingId ?? "listing-1",
    title: overrides.title ?? "Test Listing",
    trustLevel: overrides.trustLevel ?? "community",
    lifecycleState: overrides.lifecycleState ?? "active",
    version: overrides.version ?? "1.0.0",
    dependencies: overrides.dependencies ?? [],
    artifactType: overrides.artifactType ?? "pack",
    compatibility: overrides.compatibility ?? {
      minPlatformVersion: "0.0.0",
      supportedArtifactTypes: [],
    },
    qualityMetrics: overrides.qualityMetrics ?? {
      reliabilityScore: 0.8,
      usabilityScore: 0.8,
      supportScore: 0.8,
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// sortMarketplaceCatalog Tests
// ─────────────────────────────────────────────────────────────────────────────

test("sortMarketplaceCatalog orders internal before verified [marketplace-catalog]", () => {
  const entries = [
    createCatalogEntry({ listingId: "verified-entry", trustLevel: "verified" }),
    createCatalogEntry({ listingId: "internal-entry", trustLevel: "internal" }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted[0]!.listingId, "internal-entry");
  assert.equal(sorted[1]!.listingId, "verified-entry");
});

test("sortMarketplaceCatalog orders verified before community [marketplace-catalog]", () => {
  const entries = [
    createCatalogEntry({ listingId: "community-entry", trustLevel: "community" }),
    createCatalogEntry({ listingId: "verified-entry", trustLevel: "verified" }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted[0]!.listingId, "verified-entry");
  assert.equal(sorted[1]!.listingId, "community-entry");
});

test("sortMarketplaceCatalog sorts by quality score within same trust level [marketplace-catalog]", () => {
  const entries = [
    createCatalogEntry({ listingId: "low-quality", trustLevel: "verified", qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 } }),
    createCatalogEntry({ listingId: "high-quality", trustLevel: "verified", qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 } }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted[0]!.listingId, "high-quality");
  assert.equal(sorted[1]!.listingId, "low-quality");
});

test("sortMarketplaceCatalog does not mutate original array [marketplace-catalog]", () => {
  const entries = [
    createCatalogEntry({ listingId: "entry-a", trustLevel: "community" }),
    createCatalogEntry({ listingId: "entry-b", trustLevel: "internal" }),
  ];
  const original = [...entries];

  sortMarketplaceCatalog(entries);

  assert.equal(entries[0]!.listingId, original[0]!.listingId);
});

test("sortMarketplaceCatalog handles empty array [marketplace-catalog]", () => {
  const sorted = sortMarketplaceCatalog([]);

  assert.deepEqual(sorted, []);
});

test("sortMarketplaceCatalog handles single entry [marketplace-catalog]", () => {
  const entries = [createCatalogEntry({ listingId: "only" })];
  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.listingId, "only");
});

test("sortMarketplaceCatalog handles all same trust level with different quality [marketplace-catalog]", () => {
  const entries = [
    createCatalogEntry({ listingId: "a", trustLevel: "community", qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 } }),
    createCatalogEntry({ listingId: "b", trustLevel: "community", qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 } }),
    createCatalogEntry({ listingId: "c", trustLevel: "community", qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 } }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted[0]!.listingId, "b");
  assert.equal(sorted[1]!.listingId, "a");
  assert.equal(sorted[2]!.listingId, "c");
});

test("sortMarketplaceCatalog handles mixed trust levels and quality [marketplace-catalog]", () => {
  const entries = [
    createCatalogEntry({ listingId: "community-high", trustLevel: "community", qualityMetrics: { reliabilityScore: 0.95, usabilityScore: 0.95, supportScore: 0.95 } }),
    createCatalogEntry({ listingId: "verified-low", trustLevel: "verified", qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 } }),
    createCatalogEntry({ listingId: "internal-low", trustLevel: "internal", qualityMetrics: { reliabilityScore: 0.4, usabilityScore: 0.4, supportScore: 0.4 } }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted[0]!.listingId, "internal-low");
  assert.equal(sorted[1]!.listingId, "verified-low");
  assert.equal(sorted[2]!.listingId, "community-high");
});

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceCatalogEntrySchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("MarketplaceCatalogEntrySchema parses valid entry [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "listing-123",
    title: "My Marketplace Listing",
    trustLevel: "verified",
    lifecycleState: "active",
    qualityMetrics: {
      reliabilityScore: 0.9,
      usabilityScore: 0.85,
      supportScore: 0.8,
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.listingId, "listing-123");
    assert.equal(result.data.trustLevel, "verified");
  }
});

test("MarketplaceCatalogEntrySchema accepts all trust levels [marketplace-catalog]", () => {
  for (const trustLevel of ["internal", "verified", "community", "unknown"]) {
    const result = MarketplaceCatalogEntrySchema.safeParse({
      listingId: "test",
      title: "Test",
      trustLevel,
      lifecycleState: "active",
    });
    assert.equal(result.success, true, `Trust level ${trustLevel} should be valid`);
  }
});

test("MarketplaceCatalogEntrySchema accepts all lifecycle states [marketplace-catalog]", () => {
  for (const lifecycleState of ["active", "deprecated", "sunset", "removed"]) {
    const result = MarketplaceCatalogEntrySchema.safeParse({
      listingId: "test",
      title: "Test",
      trustLevel: "community",
      lifecycleState,
    });
    assert.equal(result.success, true, `Lifecycle state ${lifecycleState} should be valid`);
  }
});

test("MarketplaceCatalogEntrySchema accepts default quality metrics [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "test",
    title: "Test",
    trustLevel: "community",
    lifecycleState: "active",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.qualityMetrics.reliabilityScore, 0);
    assert.equal(result.data.qualityMetrics.usabilityScore, 0);
    assert.equal(result.data.qualityMetrics.supportScore, 0);
  }
});

test("MarketplaceCatalogEntrySchema rejects empty listingId [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "",
    title: "Test",
    trustLevel: "community",
    lifecycleState: "active",
  });

  assert.equal(result.success, false);
});

test("MarketplaceCatalogEntrySchema rejects empty title [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "test",
    title: "",
    trustLevel: "community",
    lifecycleState: "active",
  });

  assert.equal(result.success, false);
});

test("MarketplaceCatalogEntrySchema rejects invalid trust level [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "test",
    title: "Test",
    trustLevel: "sandboxed",
    lifecycleState: "active",
  });

  assert.equal(result.success, false);
});

test("MarketplaceCatalogEntrySchema rejects invalid lifecycle state [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "test",
    title: "Test",
    trustLevel: "community",
    lifecycleState: "invalid",
  });

  assert.equal(result.success, false);
});

test("MarketplaceCatalogEntrySchema rejects reliability score below 0 [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "test",
    title: "Test",
    trustLevel: "community",
    lifecycleState: "active",
    qualityMetrics: { reliabilityScore: -0.1, usabilityScore: 0.5, supportScore: 0.5 },
  });

  assert.equal(result.success, false);
});

test("MarketplaceCatalogEntrySchema rejects reliability score above 1 [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "test",
    title: "Test",
    trustLevel: "community",
    lifecycleState: "active",
    qualityMetrics: { reliabilityScore: 1.1, usabilityScore: 0.5, supportScore: 0.5 },
  });

  assert.equal(result.success, false);
});

test("checkReverseDependencies blocks deprecation when other listings still depend on target [marketplace-catalog]", () => {
  const core = createCatalogEntry({
    listingId: "core-plugin",
    version: "1.0.0",
  });
  const dependent = createCatalogEntry({
    listingId: "dependent-plugin",
    version: "2.0.0",
    dependencies: [{ listingId: "core-plugin", versionRange: "^1.0.0", optional: false }],
  });

  const result = checkReverseDependencies(core, [core, dependent]);
  assert.equal(result.hasReverseDependencies, true);
  assert.equal(result.canSafelyRemove, false);
  assert.equal(result.dependentEntries[0]?.listingId, "dependent-plugin");
});

test("MarketplaceCatalogEntrySchema accepts boundary values 0 and 1 for quality scores [marketplace-catalog]", () => {
  const result = MarketplaceCatalogEntrySchema.safeParse({
    listingId: "test",
    title: "Test",
    trustLevel: "community",
    lifecycleState: "active",
    qualityMetrics: { reliabilityScore: 0, usabilityScore: 1, supportScore: 0.5 },
  });

  assert.equal(result.success, true);
});

test("validateListingDependencies enforces semver version ranges [marketplace-catalog]", () => {
  const listing = createCatalogEntry({
    listingId: "parent",
    version: "1.0.0",
    dependencies: [
      { listingId: "dep-a", versionRange: "^2.1.0", optional: false },
    ],
  });
  const available = [
    listing,
    createCatalogEntry({
      listingId: "dep-a",
      version: "2.0.0",
    }),
  ];

  const result = validateListingDependencies(listing, available);

  assert.equal(result.valid, false);
  assert.deepEqual(result.versionMismatches, ["dep-a: need ^2.1.0, got 2.0.0"]);
});

test("analyzeDependencyGraph detects transitive dependency cycles [marketplace-catalog]", () => {
  const root = createCatalogEntry({
    listingId: "root",
    version: "1.0.0",
    dependencies: [{ listingId: "dep-a", versionRange: "^1.0.0", optional: false }],
  });
  const depA = createCatalogEntry({
    listingId: "dep-a",
    version: "1.0.0",
    dependencies: [{ listingId: "dep-b", versionRange: "^1.0.0", optional: false }],
  });
  const depB = createCatalogEntry({
    listingId: "dep-b",
    version: "1.0.0",
    dependencies: [{ listingId: "dep-a", versionRange: "^1.0.0", optional: false }],
  });

  const result = analyzeDependencyGraph(root, [root, depA, depB]);

  assert.equal(result.valid, false);
  assert.equal(result.cycles.length, 1);
  assert.deepEqual(result.cycles[0], ["dep-a", "dep-b", "dep-a"]);
});

test("calculateUpgradePathForEntry returns stepwise upgrade path and breaking-change flag [marketplace-catalog]", () => {
  const listing = createCatalogEntry({
    listingId: "upgrade-target",
    version: "1.2.3",
  });

  const result = calculateUpgradePathForEntry(listing, "2.0.0");

  assert.equal(result.listingId, "upgrade-target");
  assert.equal(result.currentVersion, "1.2.3");
  assert.equal(result.targetVersion, "2.0.0");
  assert.equal(result.isBreaking, true);
  assert.ok(result.path.length > 0);
  assert.equal(result.path.at(-1), "2.0.0");
});

test("detectBreakingChanges distinguishes patch upgrades from major upgrades [marketplace-catalog]", () => {
  assert.equal(detectBreakingChanges("1.2.3", "1.2.4"), false);
  assert.equal(detectBreakingChanges("1.2.3", "2.0.0"), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { sortMarketplaceCatalog, validateListingDependencies, MarketplaceCatalogEntrySchema } from "../../../src/scale-ecosystem/marketplace/catalog/index.js";

test("integration: sortMarketplaceCatalog prioritizes internal over verified over community", () => {
  const entries = [
    MarketplaceCatalogEntrySchema.parse({ entryId: "community-pack", title: "Community Pack", trustLevel: "community", artifactType: "pack", version: "1.0.0" }),
    MarketplaceCatalogEntrySchema.parse({ entryId: "verified-plugin", title: "Verified Plugin", trustLevel: "verified", artifactType: "plugin", version: "1.0.0" }),
    MarketplaceCatalogEntrySchema.parse({ entryId: "internal-template", title: "Internal Template", trustLevel: "internal", artifactType: "template", version: "1.0.0" }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted[0].entryId, "internal-template");
  assert.equal(sorted[1].entryId, "verified-plugin");
  assert.equal(sorted[2].entryId, "community-pack");
});

test("integration: validateListingDependencies resolves transitive dependencies", () => {
  const available = [
    MarketplaceCatalogEntrySchema.parse({ entryId: "dep-A", title: "Dep A", artifactType: "pack", version: "1.0.0" }),
    MarketplaceCatalogEntrySchema.parse({ entryId: "dep-B", title: "Dep B", artifactType: "pack", version: "2.0.0" }),
  ];

  const parent = MarketplaceCatalogEntrySchema.parse({
    entryId: "parent-pack",
    title: "Parent Pack",
    artifactType: "pack",
    version: "1.0.0",
    compatibility: { supportedArtifactTypes: ["pack", "plugin"] },
    dependencies: [
      { entryId: "dep-A", versionRange: ">=1.0.0" },
      { entryId: "dep-B", versionRange: ">=2.0.0" },
    ],
  });

  const result = validateListingDependencies(parent, available);
  assert.equal(result.valid, true);
  assert.equal(result.missingDependencies.length, 0);
  assert.equal(result.incompatibilities.length, 0);
});

test("integration: validateListingDependencies detects missing required dependency", () => {
  const available = [
    MarketplaceCatalogEntrySchema.parse({ entryId: "available-dep", title: "Available", artifactType: "pack", version: "1.0.0" }),
  ];

  const parent = MarketplaceCatalogEntrySchema.parse({
    entryId: "parent",
    title: "Parent",
    dependencies: [
      { entryId: "missing-dep", versionRange: ">=1.0.0" },
    ],
  });

  const result = validateListingDependencies(parent, available);
  assert.equal(result.valid, false);
  assert.equal(result.missingDependencies.includes("missing-dep"), true);
});

test("integration: sortMarketplaceCatalog handles quality score sorting within trust level", () => {
  const entries = [
    MarketplaceCatalogEntrySchema.parse({
      entryId: "low-quality",
      title: "Low Quality Verified",
      trustLevel: "verified",
      qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 },
    }),
    MarketplaceCatalogEntrySchema.parse({
      entryId: "high-quality",
      title: "High Quality Verified",
      trustLevel: "verified",
      qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 },
    }),
    MarketplaceCatalogEntrySchema.parse({
      entryId: "medium-quality",
      title: "Medium Quality Verified",
      trustLevel: "verified",
      qualityMetrics: { reliabilityScore: 0.6, usabilityScore: 0.6, supportScore: 0.6 },
    }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted[0].entryId, "high-quality");
  assert.equal(sorted[1].entryId, "medium-quality");
  assert.equal(sorted[2].entryId, "low-quality");
});

test("integration: validateListingDependencies handles optional dependencies gracefully", () => {
  const available = [
    MarketplaceCatalogEntrySchema.parse({ entryId: "required-dep", title: "Required", artifactType: "pack" }),
  ];

  const parent = MarketplaceCatalogEntrySchema.parse({
    entryId: "parent",
    title: "Parent",
    dependencies: [
      { entryId: "required-dep", versionRange: ">=1.0.0" },
      { entryId: "optional-dep", versionRange: ">=1.0.0", optional: true },
    ],
  });

  const result = validateListingDependencies(parent, available);
  assert.equal(result.valid, true);
  assert.equal(result.missingDependencies.length, 0);
});

test("integration: validateListingDependencies detects artifact type incompatibility", () => {
  const available = [
    MarketplaceCatalogEntrySchema.parse({ entryId: "connector-x", title: "Connector X", artifactType: "connector" }),
  ];

  const parent = MarketplaceCatalogEntrySchema.parse({
    entryId: "pack-y",
    title: "Pack Y",
    artifactType: "pack",
    compatibility: { supportedArtifactTypes: ["pack", "plugin"] },
    dependencies: [
      { entryId: "connector-x", versionRange: ">=1.0.0" },
    ],
  });

  const result = validateListingDependencies(parent, available);
  assert.equal(result.valid, false);
  assert.equal(result.incompatibilities.includes("artifact_type:connector-x"), true);
});

test("integration: sortMarketplaceCatalog handles mixed trust and quality", () => {
  const entries = [
    MarketplaceCatalogEntrySchema.parse({
      entryId: "internal-low",
      title: "Internal Low Quality",
      trustLevel: "internal",
      qualityMetrics: { reliabilityScore: 0.2, usabilityScore: 0.2, supportScore: 0.2 },
    }),
    MarketplaceCatalogEntrySchema.parse({
      entryId: "verified-high",
      title: "Verified High Quality",
      trustLevel: "verified",
      qualityMetrics: { reliabilityScore: 0.95, usabilityScore: 0.95, supportScore: 0.95 },
    }),
    MarketplaceCatalogEntrySchema.parse({
      entryId: "community-high",
      title: "Community High Quality",
      trustLevel: "community",
      qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 },
    }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  // Internal always comes before verified, regardless of quality
  assert.equal(sorted[0].entryId, "internal-low");
  assert.equal(sorted[1].entryId, "verified-high");
  assert.equal(sorted[2].entryId, "community-high");
});

test("integration: sortMarketplaceCatalog does not modify original array", () => {
  const entries = [
    MarketplaceCatalogEntrySchema.parse({ entryId: "entry-1", title: "Entry", trustLevel: "internal" }),
  ];
  const originalEntry = entries[0];
  sortMarketplaceCatalog(entries);
  assert.equal(entries[0], originalEntry);
});

test("integration: validateListingDependencies handles empty dependencies array", () => {
  const parent = MarketplaceCatalogEntrySchema.parse({
    entryId: "standalone",
    title: "Standalone Pack",
    dependencies: [],
  });

  const result = validateListingDependencies(parent, []);
  assert.equal(result.valid, true);
  assert.equal(result.missingDependencies.length, 0);
  assert.equal(result.incompatibilities.length, 0);
});
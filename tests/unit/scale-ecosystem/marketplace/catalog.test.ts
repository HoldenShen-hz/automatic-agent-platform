/**
 * Unit tests for Marketplace Catalog
 *
 * @see src/scale-ecosystem/marketplace/catalog/
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MarketplaceCatalogEntrySchema,
  sortMarketplaceCatalog,
  type MarketplaceCatalogEntry,
} from "../../../../src/scale-ecosystem/marketplace/catalog/index.js";

function createEntry(overrides: Partial<MarketplaceCatalogEntry> = {}): MarketplaceCatalogEntry {
  return MarketplaceCatalogEntrySchema.parse({
    entryId: overrides.entryId ?? "entry-default",
    title: overrides.title ?? "Default Entry",
    trustLevel: overrides.trustLevel ?? "verified",
    lifecycleState: overrides.lifecycleState ?? "active",
    qualityMetrics: overrides.qualityMetrics,
  });
}

test("MarketplaceCatalogEntrySchema parses valid entry", () => {
  const entry = createEntry({
    entryId: "listing_001",
    title: "Analytics Pack",
    trustLevel: "verified",
    lifecycleState: "active",
  });

  const result = MarketplaceCatalogEntrySchema.parse(entry);

  assert.equal(result.entryId, "listing_001");
  assert.equal(result.title, "Analytics Pack");
  assert.equal(result.trustLevel, "verified");
  assert.equal(result.lifecycleState, "active");
});

test("MarketplaceCatalogEntrySchema applies default quality metrics", () => {
  const entry = {
    entryId: "listing_002",
    title: "Basic Pack",
    trustLevel: "community",
    lifecycleState: "active",
  };

  const result = MarketplaceCatalogEntrySchema.parse(entry);

  assert.equal(result.qualityMetrics.reliabilityScore, 0);
  assert.equal(result.qualityMetrics.usabilityScore, 0);
  assert.equal(result.qualityMetrics.supportScore, 0);
});

test("MarketplaceCatalogEntrySchema accepts custom quality metrics", () => {
  const entry = {
    entryId: "listing_003",
    title: "Premium Pack",
    trustLevel: "internal",
    lifecycleState: "active",
    qualityMetrics: {
      reliabilityScore: 0.95,
      usabilityScore: 0.88,
      supportScore: 0.92,
    },
  };

  const result = MarketplaceCatalogEntrySchema.parse(entry);

  assert.equal(result.qualityMetrics.reliabilityScore, 0.95);
  assert.equal(result.qualityMetrics.usabilityScore, 0.88);
  assert.equal(result.qualityMetrics.supportScore, 0.92);
});

test("MarketplaceCatalogEntrySchema rejects invalid trustLevel", () => {
  const entry = {
    entryId: "listing_004",
    title: "Bad Pack",
    trustLevel: "invalid",
    lifecycleState: "active",
  };

  assert.throws(
    () => MarketplaceCatalogEntrySchema.parse(entry),
    /trustLevel/
  );
});

test("MarketplaceCatalogEntrySchema rejects invalid lifecycleState", () => {
  const entry = {
    entryId: "listing_005",
    title: "Bad Pack",
    trustLevel: "community",
    lifecycleState: "invalid_state",
  };

  assert.throws(
    () => MarketplaceCatalogEntrySchema.parse(entry),
    /lifecycleState/
  );
});

test("MarketplaceCatalogEntrySchema rejects empty entryId", () => {
  const entry = {
    entryId: "",
    title: "Bad Pack",
    trustLevel: "community",
    lifecycleState: "active",
  };

  assert.throws(
    () => MarketplaceCatalogEntrySchema.parse(entry),
    /entryId/
  );
});

test("MarketplaceCatalogEntrySchema rejects empty title", () => {
  const entry = {
    entryId: "listing_006",
    title: "",
    trustLevel: "community",
    lifecycleState: "active",
  };

  assert.throws(
    () => MarketplaceCatalogEntrySchema.parse(entry),
    /title/
  );
});

test("sortMarketplaceCatalog sorts by trust level first", () => {
  const entries: MarketplaceCatalogEntry[] = [
    createEntry({
      entryId: "community_pack",
      title: "Community",
      trustLevel: "community",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
    createEntry({
      entryId: "internal_pack",
      title: "Internal",
      trustLevel: "internal",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
    createEntry({
      entryId: "verified_pack",
      title: "Verified",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted.length, 3);
  assert.equal(sorted[0]!.trustLevel, "internal");
  assert.equal(sorted[1]!.trustLevel, "verified");
  assert.equal(sorted[2]!.trustLevel, "community");
});

test("sortMarketplaceCatalog sorts by quality metrics within same trust level", () => {
  const entries: MarketplaceCatalogEntry[] = [
    createEntry({
      entryId: "low_quality",
      title: "Low Quality",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 },
    }),
    createEntry({
      entryId: "high_quality",
      title: "High Quality",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 },
    }),
    createEntry({
      entryId: "medium_quality",
      title: "Medium Quality",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.6, usabilityScore: 0.6, supportScore: 0.6 },
    }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted.length, 3);
  assert.equal(sorted[0]!.entryId, "high_quality");
  assert.equal(sorted[1]!.entryId, "medium_quality");
  assert.equal(sorted[2]!.entryId, "low_quality");
});

test("sortMarketplaceCatalog does not mutate original array", () => {
  const entries: MarketplaceCatalogEntry[] = [
    createEntry({
      entryId: "first",
      title: "First",
      trustLevel: "community",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.1, usabilityScore: 0.1, supportScore: 0.1 },
    }),
    createEntry({
      entryId: "second",
      title: "Second",
      trustLevel: "internal",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 },
    }),
  ];

  const originalFirst = entries[0];
  sortMarketplaceCatalog(entries);

  assert.equal(entries[0], originalFirst);
  assert.equal(entries[0]!.trustLevel, "community");
});

test("sortMarketplaceCatalog handles empty array", () => {
  const sorted = sortMarketplaceCatalog([]);
  assert.equal(sorted.length, 0);
});

test("sortMarketplaceCatalog handles single element", () => {
  const entries: MarketplaceCatalogEntry[] = [
    createEntry({
      entryId: "only",
      title: "Only",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.entryId, "only");
});

test("sortMarketplaceCatalog sorts internal above verified even with low quality", () => {
  const entries: MarketplaceCatalogEntry[] = [
    createEntry({
      entryId: "verified_high",
      title: "Verified High",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.99, usabilityScore: 0.99, supportScore: 0.99 },
    }),
    createEntry({
      entryId: "internal_low",
      title: "Internal Low",
      trustLevel: "internal",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.1, usabilityScore: 0.1, supportScore: 0.1 },
    }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted.length, 2);
  assert.equal(sorted[0]!.entryId, "internal_low");
  assert.equal(sorted[1]!.entryId, "verified_high");
});

test("sortMarketplaceCatalog handles all lifecycle states", () => {
  const entries: MarketplaceCatalogEntry[] = [
    createEntry({
      entryId: "active_item",
      title: "Active Item",
      trustLevel: "community",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
    createEntry({
      entryId: "deprecated_item",
      title: "Deprecated Item",
      trustLevel: "community",
      lifecycleState: "deprecated",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
    createEntry({
      entryId: "sunset_item",
      title: "Sunset Item",
      trustLevel: "community",
      lifecycleState: "sunset",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
    createEntry({
      entryId: "removed_item",
      title: "Removed Item",
      trustLevel: "community",
      lifecycleState: "removed",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted.length, 4);
  // All same trust level, should be sorted by quality (equal), original order preserved
  assert.equal(sorted[0]!.entryId, "active_item");
});

test("sortMarketplaceCatalog quality score sum determines order within trust level", () => {
  const entries: MarketplaceCatalogEntry[] = [
    createEntry({
      entryId: "sum_0.3",
      title: "Sum 0.3",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.1, usabilityScore: 0.1, supportScore: 0.1 },
    }),
    createEntry({
      entryId: "sum_2.7",
      title: "Sum 2.7",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 },
    }),
    createEntry({
      entryId: "sum_1.5",
      title: "Sum 1.5",
      trustLevel: "verified",
      lifecycleState: "active",
      qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
    }),
  ];

  const sorted = sortMarketplaceCatalog(entries);

  assert.equal(sorted[0]!.entryId, "sum_2.7");
  assert.equal(sorted[1]!.entryId, "sum_1.5");
  assert.equal(sorted[2]!.entryId, "sum_0.3");
});

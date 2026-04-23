/**
 * Unit tests for Marketplace Catalog
 *
 * @see src/scale-ecosystem/marketplace/catalog/
 */
import assert from "node:assert/strict";
import test from "node:test";
import { MarketplaceCatalogEntrySchema, sortMarketplaceCatalog, } from "../../../../../src/scale-ecosystem/marketplace/catalog/index.js";
test("MarketplaceCatalogEntrySchema parses valid entry", () => {
    const entry = {
        listingId: "listing_001",
        title: "Analytics Pack",
        trustLevel: "verified",
        lifecycleState: "published",
    };
    const result = MarketplaceCatalogEntrySchema.parse(entry);
    assert.equal(result.listingId, "listing_001");
    assert.equal(result.title, "Analytics Pack");
    assert.equal(result.trustLevel, "verified");
    assert.equal(result.lifecycleState, "published");
});
test("MarketplaceCatalogEntrySchema applies default quality metrics", () => {
    const entry = {
        listingId: "listing_002",
        title: "Basic Pack",
        trustLevel: "sandboxed",
        lifecycleState: "draft",
    };
    const result = MarketplaceCatalogEntrySchema.parse(entry);
    assert.equal(result.qualityMetrics.reliabilityScore, 0);
    assert.equal(result.qualityMetrics.usabilityScore, 0);
    assert.equal(result.qualityMetrics.supportScore, 0);
});
test("MarketplaceCatalogEntrySchema accepts custom quality metrics", () => {
    const entry = {
        listingId: "listing_003",
        title: "Premium Pack",
        trustLevel: "enterprise",
        lifecycleState: "certified",
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
        listingId: "listing_004",
        title: "Bad Pack",
        trustLevel: "invalid",
        lifecycleState: "published",
    };
    assert.throws(() => MarketplaceCatalogEntrySchema.parse(entry), /trustLevel/);
});
test("MarketplaceCatalogEntrySchema rejects invalid lifecycleState", () => {
    const entry = {
        listingId: "listing_005",
        title: "Bad Pack",
        trustLevel: "sandboxed",
        lifecycleState: "invalid_state",
    };
    assert.throws(() => MarketplaceCatalogEntrySchema.parse(entry), /lifecycleState/);
});
test("MarketplaceCatalogEntrySchema rejects empty listingId", () => {
    const entry = {
        listingId: "",
        title: "Bad Pack",
        trustLevel: "sandboxed",
        lifecycleState: "draft",
    };
    assert.throws(() => MarketplaceCatalogEntrySchema.parse(entry), /listingId/);
});
test("MarketplaceCatalogEntrySchema rejects empty title", () => {
    const entry = {
        listingId: "listing_006",
        title: "",
        trustLevel: "sandboxed",
        lifecycleState: "draft",
    };
    assert.throws(() => MarketplaceCatalogEntrySchema.parse(entry), /title/);
});
test("sortMarketplaceCatalog sorts by trust level first", () => {
    const entries = [
        {
            listingId: "sandboxed_pack",
            title: "Sandboxed",
            trustLevel: "sandboxed",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
        },
        {
            listingId: "enterprise_pack",
            title: "Enterprise",
            trustLevel: "enterprise",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
        },
        {
            listingId: "verified_pack",
            title: "Verified",
            trustLevel: "verified",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
        },
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted.length, 3);
    assert.equal(sorted[0].trustLevel, "enterprise");
    assert.equal(sorted[1].trustLevel, "verified");
    assert.equal(sorted[2].trustLevel, "sandboxed");
});
test("sortMarketplaceCatalog sorts by quality metrics within same trust level", () => {
    const entries = [
        {
            listingId: "low_quality",
            title: "Low Quality",
            trustLevel: "verified",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 },
        },
        {
            listingId: "high_quality",
            title: "High Quality",
            trustLevel: "verified",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 },
        },
        {
            listingId: "medium_quality",
            title: "Medium Quality",
            trustLevel: "verified",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.6, usabilityScore: 0.6, supportScore: 0.6 },
        },
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted.length, 3);
    assert.equal(sorted[0].listingId, "high_quality");
    assert.equal(sorted[1].listingId, "medium_quality");
    assert.equal(sorted[2].listingId, "low_quality");
});
test("sortMarketplaceCatalog does not mutate original array", () => {
    const entries = [
        {
            listingId: "first",
            title: "First",
            trustLevel: "sandboxed",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.1, usabilityScore: 0.1, supportScore: 0.1 },
        },
        {
            listingId: "second",
            title: "Second",
            trustLevel: "enterprise",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 },
        },
    ];
    const originalFirst = entries[0];
    sortMarketplaceCatalog(entries);
    assert.equal(entries[0], originalFirst);
    assert.equal(entries[0].trustLevel, "sandboxed");
});
test("sortMarketplaceCatalog handles empty array", () => {
    const sorted = sortMarketplaceCatalog([]);
    assert.equal(sorted.length, 0);
});
test("sortMarketplaceCatalog handles single element", () => {
    const entries = [
        {
            listingId: "only",
            title: "Only",
            trustLevel: "verified",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 },
        },
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0].listingId, "only");
});
test("sortMarketplaceCatalog sorts enterprise above verified even with low quality", () => {
    const entries = [
        {
            listingId: "verified_high",
            title: "Verified High",
            trustLevel: "verified",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.99, usabilityScore: 0.99, supportScore: 0.99 },
        },
        {
            listingId: "enterprise_low",
            title: "Enterprise Low",
            trustLevel: "enterprise",
            lifecycleState: "published",
            qualityMetrics: { reliabilityScore: 0.1, usabilityScore: 0.1, supportScore: 0.1 },
        },
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted.length, 2);
    assert.equal(sorted[0].listingId, "enterprise_low");
    assert.equal(sorted[1].listingId, "verified_high");
});
//# sourceMappingURL=catalog.test.js.map
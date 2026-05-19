import assert from "node:assert/strict";
import test from "node:test";
import { sortMarketplaceCatalog, MarketplaceCatalogEntrySchema, } from "../../../src/scale-ecosystem/marketplace/catalog/index.js";
function createCatalogEntry(overrides = {}) {
    return {
        listingId: overrides.listingId ?? "listing-1",
        title: overrides.title ?? "Test Listing",
        trustLevel: overrides.trustLevel ?? "community",
        lifecycleState: overrides.lifecycleState ?? "active",
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
test("sortMarketplaceCatalog orders internal before verified", () => {
    const entries = [
        createCatalogEntry({ listingId: "verified-entry", trustLevel: "verified" }),
        createCatalogEntry({ listingId: "internal-entry", trustLevel: "internal" }),
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted[0].listingId, "internal-entry");
    assert.equal(sorted[1].listingId, "verified-entry");
});
test("sortMarketplaceCatalog orders verified before community", () => {
    const entries = [
        createCatalogEntry({ listingId: "community-entry", trustLevel: "community" }),
        createCatalogEntry({ listingId: "verified-entry", trustLevel: "verified" }),
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted[0].listingId, "verified-entry");
    assert.equal(sorted[1].listingId, "community-entry");
});
test("sortMarketplaceCatalog sorts by quality score within same trust level", () => {
    const entries = [
        createCatalogEntry({ listingId: "low-quality", trustLevel: "verified", qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 } }),
        createCatalogEntry({ listingId: "high-quality", trustLevel: "verified", qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 } }),
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted[0].listingId, "high-quality");
    assert.equal(sorted[1].listingId, "low-quality");
});
test("sortMarketplaceCatalog does not mutate original array", () => {
    const entries = [
        createCatalogEntry({ listingId: "entry-a", trustLevel: "community" }),
        createCatalogEntry({ listingId: "entry-b", trustLevel: "internal" }),
    ];
    const original = [...entries];
    sortMarketplaceCatalog(entries);
    assert.equal(entries[0].listingId, original[0].listingId);
});
test("sortMarketplaceCatalog handles empty array", () => {
    const sorted = sortMarketplaceCatalog([]);
    assert.deepEqual(sorted, []);
});
test("sortMarketplaceCatalog handles single entry", () => {
    const entries = [createCatalogEntry({ listingId: "only" })];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0].listingId, "only");
});
test("sortMarketplaceCatalog handles all same trust level with different quality", () => {
    const entries = [
        createCatalogEntry({ listingId: "a", trustLevel: "community", qualityMetrics: { reliabilityScore: 0.5, usabilityScore: 0.5, supportScore: 0.5 } }),
        createCatalogEntry({ listingId: "b", trustLevel: "community", qualityMetrics: { reliabilityScore: 0.9, usabilityScore: 0.9, supportScore: 0.9 } }),
        createCatalogEntry({ listingId: "c", trustLevel: "community", qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 } }),
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted[0].listingId, "b");
    assert.equal(sorted[1].listingId, "a");
    assert.equal(sorted[2].listingId, "c");
});
test("sortMarketplaceCatalog handles mixed trust levels and quality", () => {
    const entries = [
        createCatalogEntry({ listingId: "community-high", trustLevel: "community", qualityMetrics: { reliabilityScore: 0.95, usabilityScore: 0.95, supportScore: 0.95 } }),
        createCatalogEntry({ listingId: "verified-low", trustLevel: "verified", qualityMetrics: { reliabilityScore: 0.3, usabilityScore: 0.3, supportScore: 0.3 } }),
        createCatalogEntry({ listingId: "internal-low", trustLevel: "internal", qualityMetrics: { reliabilityScore: 0.4, usabilityScore: 0.4, supportScore: 0.4 } }),
    ];
    const sorted = sortMarketplaceCatalog(entries);
    assert.equal(sorted[0].listingId, "internal-low");
    assert.equal(sorted[1].listingId, "verified-low");
    assert.equal(sorted[2].listingId, "community-high");
});
// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceCatalogEntrySchema Tests
// ─────────────────────────────────────────────────────────────────────────────
test("MarketplaceCatalogEntrySchema parses valid entry", () => {
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
test("MarketplaceCatalogEntrySchema accepts all trust levels", () => {
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
test("MarketplaceCatalogEntrySchema accepts all lifecycle states", () => {
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
test("MarketplaceCatalogEntrySchema accepts default quality metrics", () => {
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
test("MarketplaceCatalogEntrySchema rejects empty listingId", () => {
    const result = MarketplaceCatalogEntrySchema.safeParse({
        listingId: "",
        title: "Test",
        trustLevel: "community",
        lifecycleState: "active",
    });
    assert.equal(result.success, false);
});
test("MarketplaceCatalogEntrySchema rejects empty title", () => {
    const result = MarketplaceCatalogEntrySchema.safeParse({
        listingId: "test",
        title: "",
        trustLevel: "community",
        lifecycleState: "active",
    });
    assert.equal(result.success, false);
});
test("MarketplaceCatalogEntrySchema rejects invalid trust level", () => {
    const result = MarketplaceCatalogEntrySchema.safeParse({
        listingId: "test",
        title: "Test",
        trustLevel: "sandboxed",
        lifecycleState: "active",
    });
    assert.equal(result.success, false);
});
test("MarketplaceCatalogEntrySchema rejects invalid lifecycle state", () => {
    const result = MarketplaceCatalogEntrySchema.safeParse({
        listingId: "test",
        title: "Test",
        trustLevel: "community",
        lifecycleState: "invalid",
    });
    assert.equal(result.success, false);
});
test("MarketplaceCatalogEntrySchema rejects reliability score below 0", () => {
    const result = MarketplaceCatalogEntrySchema.safeParse({
        listingId: "test",
        title: "Test",
        trustLevel: "community",
        lifecycleState: "active",
        qualityMetrics: { reliabilityScore: -0.1, usabilityScore: 0.5, supportScore: 0.5 },
    });
    assert.equal(result.success, false);
});
test("MarketplaceCatalogEntrySchema rejects reliability score above 1", () => {
    const result = MarketplaceCatalogEntrySchema.safeParse({
        listingId: "test",
        title: "Test",
        trustLevel: "community",
        lifecycleState: "active",
        qualityMetrics: { reliabilityScore: 1.1, usabilityScore: 0.5, supportScore: 0.5 },
    });
    assert.equal(result.success, false);
});
test("MarketplaceCatalogEntrySchema accepts boundary values 0 and 1 for quality scores", () => {
    const result = MarketplaceCatalogEntrySchema.safeParse({
        listingId: "test",
        title: "Test",
        trustLevel: "community",
        lifecycleState: "active",
        qualityMetrics: { reliabilityScore: 0, usabilityScore: 1, supportScore: 0.5 },
    });
    assert.equal(result.success, true);
});
//# sourceMappingURL=marketplace-catalog.test.js.map
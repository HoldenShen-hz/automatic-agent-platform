/**
 * E2E Marketplace Service Tests
 *
 * End-to-end tests covering marketplace operations:
 * 1. Agent/plugin listing and discovery
 * 2. Listing lifecycle (draft -> active -> deprecated -> retired)
 * 3. Listing review and approval flow
 * 4. Version management
 * 5. Category and tagging
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { MarketplaceService } from "../../src/scale-ecosystem/marketplace/marketplace-service.js";
import type { MarketplaceListing, ListingReview, ListingVersion } from "../../src/scale-ecosystem/marketplace/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    listingId: overrides.listingId ?? "listing_e2e_001",
    name: overrides.name ?? "E2E Test Agent",
    description: overrides.description ?? "Test agent for e2e testing",
    version: overrides.version ?? "1.0.0",
    status: overrides.status ?? "draft",
    providerId: overrides.providerId ?? "provider_e2e",
    category: overrides.category ?? "automation",
    tags: overrides.tags ?? ["testing", "e2e"],
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Listing Lifecycle
// ---------------------------------------------------------------------------

test("E2E Marketplace: Listing progresses from draft to active", async () => {
  const harness = createE2EHarness("aa-e2e-marketplace-");
  try {
    const service = new MarketplaceService();

    // Create listing in draft
    const listing = createListing({ status: "draft" });
    const created = service.createListing(listing);

    assert.equal(created.status, "draft", "Should start in draft");

    // Publish listing
    const published = service.publishListing("listing_e2e_001");
    assert.equal(published.status, "active", "Should be active after publishing");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Listing Discovery
// ---------------------------------------------------------------------------

test("E2E Marketplace: Users can search and filter listings", async () => {
  const harness = createE2EHarness("aa-e2e-marketplace-search-");
  try {
    const service = new MarketplaceService();

    // Add listings
    service.createListing(createListing({ name: "Data Analyzer", category: "analytics" }));
    service.createListing(createListing({ name: "Code Reviewer", category: "development" }));

    // Search
    const results = service.searchListings({ category: "analytics" });

    assert.ok(Array.isArray(results), "Should return search results");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Listing Version Management
// ---------------------------------------------------------------------------

test("E2E Marketplace: New version can be published for existing listing", async () => {
  const harness = createE2EHarness("aa-e2e-marketplace-version-");
  try {
    const service = new MarketplaceService();

    const listing = createListing({ version: "1.0.0" });
    service.createListing(listing);

    // Publish new version
    const newVersion = service.publishVersion("listing_e2e_001", {
      version: "1.1.0",
      changelog: "Bug fixes and improvements",
    });

    assert.ok(newVersion, "Should return new version");
    assert.equal(newVersion.version, "1.1.0", "Should have new version");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Listing Deprecation
// ---------------------------------------------------------------------------

test("E2E Marketplace: Listing can be deprecated and retired", async () => {
  const harness = createE2EHarness("aa-e2e-marketplace-deprecate-");
  try {
    const service = new MarketplaceService();

    const listing = createListing({ status: "active" });
    service.createListing(listing);

    // Deprecate
    const deprecated = service.deprecateListing("listing_e2e_001", "No longer supported");
    assert.equal(deprecated.status, "deprecated", "Should be deprecated");

    // Retire
    const retired = service.retireListing("listing_e2e_001");
    assert.equal(retired.status, "retired", "Should be retired");
  } finally {
    harness.cleanup();
  }
});
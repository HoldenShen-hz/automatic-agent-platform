/**
 * Tests for marketplace index - verifies barrel re-exports
 *
 * Tests that the marketplace index properly re-exports all expected modules.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import from the marketplace barrel
import * as Marketplace from "../../../../src/scale-ecosystem/marketplace/index.js";

test("Marketplace index exports MarketplaceGovernanceService [marketplace-index]", () => {
  assert.ok(Marketplace.MarketplaceGovernanceService !== undefined);
});

test("Marketplace index exports PackSecurityService [marketplace-index]", () => {
  assert.ok(Marketplace.PackSecurityService !== undefined);
});

test("Marketplace index exports PluginTrustStore [marketplace-index]", () => {
  assert.ok(Marketplace.PluginTrustStore !== undefined);
});

test("Marketplace index exports sortMarketplaceCatalog function [marketplace-index]", () => {
  assert.ok(typeof Marketplace.sortMarketplaceCatalog === "function");
});

test("Marketplace index exports MarketplaceCatalogEntrySchema [marketplace-index]", () => {
  assert.ok(Marketplace.MarketplaceCatalogEntrySchema !== undefined);
});

test("Marketplace index exports CertificationRecordSchema [marketplace-index]", () => {
  assert.ok(Marketplace.CertificationRecordSchema !== undefined);
});

test("Marketplace index exports PublisherProfileSchema [marketplace-index]", () => {
  assert.ok(Marketplace.PublisherProfileSchema !== undefined);
});

test("Marketplace index exports isMarketplaceListingCertified function [marketplace-index]", () => {
  assert.ok(typeof Marketplace.isMarketplaceListingCertified === "function");
});

test("Marketplace index exports canPublisherReleaseArtifact function [marketplace-index]", () => {
  assert.ok(typeof Marketplace.canPublisherReleaseArtifact === "function");
});

/**
 * Unit tests for Marketplace barrel exports
 *
 * @see src/scale-ecosystem/marketplace/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as marketplace from "../../../src/scale-ecosystem/marketplace/index.js";

test("marketplace barrel exports billing types", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("billing")),
    "should export billing types"
  );
});

test("marketplace barrel exports certification", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("certification")),
    "should export certification"
  );
});

test("marketplace barrel exports compliance-program-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("complianceprogram") || k.toLowerCase().includes("compliance")),
    "should export compliance-program-service"
  );
});

test("marketplace barrel exports cost-estimation-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("costestimation") || k.toLowerCase().includes("cost")),
    "should export cost-estimation-service"
  );
});

test("marketplace barrel exports enterprise-capability-matrix-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("enterprisecapability") || k.toLowerCase().includes("enterprise")),
    "should export enterprise-capability-matrix-service"
  );
});

test("marketplace barrel exports license-enforcement-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("licenseenforcement") || k.toLowerCase().includes("license")),
    "should export license-enforcement-service"
  );
});

test("marketplace barrel exports marketplace-governance-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("marketplacegovernance") || k.toLowerCase().includes("governance")),
    "should export marketplace-governance-service"
  );
});

test("marketplace barrel exports pack-security-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("packsecurity") || k.toLowerCase().includes("security")),
    "should export pack-security-service"
  );
});

test("marketplace barrel exports platform-operator-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("platformoperator") || k.toLowerCase().includes("operator")),
    "should export platform-operator-service"
  );
});

test("marketplace barrel exports pmf-validation-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("pmfvalidation") || k.toLowerCase().includes("pmf")),
    "should export pmf-validation-service"
  );
});

test("marketplace barrel exports publisher", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("publisher")),
    "should export publisher"
  );
});

test("marketplace barrel exports tenant-platform-service", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("tenantplatform") || k.toLowerCase().includes("tenant")),
    "should export tenant-platform-service"
  );
});

test("marketplace barrel exports MarketplaceCatalogEntrySchema", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("catalog") || k.includes("Schema")),
    "should export MarketplaceCatalogEntrySchema"
  );
});

test("marketplace barrel exports sortMarketplaceCatalog", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("sortcatalog") || k.toLowerCase().includes("sort")),
    "should export sortMarketplaceCatalog"
  );
});

test("marketplace barrel exports MarketplaceCatalogEntry type", () => {
  const keys = Object.keys(marketplace);
  assert.ok(
    keys.some(k => k.toLowerCase().includes("catalog") && k.includes("Entry")),
    "should export MarketplaceCatalogEntry type"
  );
});

test("marketplace barrel has multiple exports", () => {
  const keys = Object.keys(marketplace);
  assert.ok(keys.length > 10, "should have multiple exports from marketplace submodules");
});

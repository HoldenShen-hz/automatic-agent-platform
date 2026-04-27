/**
 * Unit tests for org-governance index exports
 *
 * @see src/org-governance/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import all exports to verify they are available
import * as OrgGovernanceExports from "../../../src/org-governance/index.js";

test("org-governance index exports GOVERNANCE_CAPABILITY_BASELINES", () => {
  assert.ok(OrgGovernanceExports.GOVERNANCE_CAPABILITY_BASELINES, "GOVERNANCE_CAPABILITY_BASELINES should be exported");
  assert.ok(Array.isArray(OrgGovernanceExports.GOVERNANCE_CAPABILITY_BASELINES));
  assert.equal(OrgGovernanceExports.GOVERNANCE_CAPABILITY_BASELINES.length, 6);
});

test("org-governance index exports listGovernanceCapabilityBaselines function", () => {
  assert.ok(OrgGovernanceExports.listGovernanceCapabilityBaselines, "listGovernanceCapabilityBaselines should be exported");
  assert.equal(typeof OrgGovernanceExports.listGovernanceCapabilityBaselines, "function");
});

test("org-governance index exports resolveGovernanceCapabilityBaseline function", () => {
  assert.ok(OrgGovernanceExports.resolveGovernanceCapabilityBaseline, "resolveGovernanceCapabilityBaseline should be exported");
  assert.equal(typeof OrgGovernanceExports.resolveGovernanceCapabilityBaseline, "function");
});

test("org-governance index exports GOVERNANCE_CATALOG_SERVICE_ID", () => {
  assert.ok(OrgGovernanceExports.GOVERNANCE_CATALOG_SERVICE_ID, "GOVERNANCE_CATALOG_SERVICE_ID should be exported");
  assert.equal(OrgGovernanceExports.GOVERNANCE_CATALOG_SERVICE_ID, "w3.governance.catalog");
});

test("org-governance index exports GOVERNANCE_BOOTSTRAP_SERVICE_ID", () => {
  assert.ok(OrgGovernanceExports.GOVERNANCE_BOOTSTRAP_SERVICE_ID, "GOVERNANCE_BOOTSTRAP_SERVICE_ID should be exported");
  assert.equal(OrgGovernanceExports.GOVERNANCE_BOOTSTRAP_SERVICE_ID, "w3.governance.bootstrap");
});

test("org-governance index exports buildGovernanceBootstrap function", () => {
  assert.ok(OrgGovernanceExports.buildGovernanceBootstrap, "buildGovernanceBootstrap should be exported");
  assert.equal(typeof OrgGovernanceExports.buildGovernanceBootstrap, "function");
});

test("org-governance index exports registerGovernanceBootstrap function", () => {
  assert.ok(OrgGovernanceExports.registerGovernanceBootstrap, "registerGovernanceBootstrap should be exported");
  assert.equal(typeof OrgGovernanceExports.registerGovernanceBootstrap, "function");
});

test("listGovernanceCapabilityBaselines returns all 6 capabilities", () => {
  const baselines = OrgGovernanceExports.listGovernanceCapabilityBaselines();
  assert.equal(baselines.length, 6);
});

test("resolveGovernanceCapabilityBaseline resolves valid capabilityId", () => {
  const baseline = OrgGovernanceExports.resolveGovernanceCapabilityBaseline("org-model");
  assert.equal(baseline.capabilityId, "org-model");
  assert.ok(baseline.entryModule.includes("org-model"));
});

test("resolveGovernanceCapabilityBaseline throws for invalid capabilityId", () => {
  assert.throws(() => {
    OrgGovernanceExports.resolveGovernanceCapabilityBaseline("invalid-capability" as any);
  });
});

test("GOVERNANCE_CAPABILITY_BASELINES has correct structure", () => {
  for (const baseline of OrgGovernanceExports.GOVERNANCE_CAPABILITY_BASELINES) {
    assert.ok(baseline.capabilityId);
    assert.ok(baseline.entryModule);
    assert.ok(baseline.description);
    assert.ok(Array.isArray(baseline.architectureSections));
    assert.ok(Array.isArray(baseline.baselineServices));
  }
});

test("buildGovernanceBootstrap returns valid bootstrap object", () => {
  const bootstrap = OrgGovernanceExports.buildGovernanceBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "org-governance");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.equal(bootstrap.catalog.length, 6);
});

test("all exported capability IDs are valid", () => {
  const capabilityIds = ["org-model", "approval-routing", "sso-scim", "compliance-engine", "knowledge-boundary", "delegated-governance"];
  for (const id of capabilityIds) {
    const baseline = OrgGovernanceExports.resolveGovernanceCapabilityBaseline(id as any);
    assert.ok(baseline, `Should resolve capabilityId: ${id}`);
  }
});

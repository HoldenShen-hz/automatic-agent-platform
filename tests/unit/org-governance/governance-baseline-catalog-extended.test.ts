/**
 * Unit tests for Governance Baseline Catalog - Additional coverage
 * Tests for governance-baseline-catalog.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  listGovernanceCapabilityBaselines,
  resolveGovernanceCapabilityBaseline,
  GOVERNANCE_CAPABILITY_BASELINES,
  type GovernanceCapabilityBaseline,
  type GovernanceCapabilityId,
} from "../../../src/org-governance/governance-baseline-catalog.js";

test("listGovernanceCapabilityBaselines returns all 6 capability baselines", () => {
  const baselines = listGovernanceCapabilityBaselines();
  assert.equal(baselines.length, 6);
});

test("all governance capability baselines have required fields", () => {
  const baselines = listGovernanceCapabilityBaselines();
  for (const baseline of baselines) {
    assert.ok(typeof baseline.capabilityId === "string");
    assert.ok(baseline.capabilityId.length > 0);
    assert.ok(typeof baseline.entryModule === "string");
    assert.ok(baseline.entryModule.length > 0);
    assert.ok(typeof baseline.description === "string");
    assert.ok(baseline.description.length > 0);
    assert.ok(Array.isArray(baseline.architectureSections));
    assert.ok(baseline.architectureSections.length > 0);
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});

test("resolveGovernanceCapabilityBaseline returns correct baseline for org-model", () => {
  const baseline = resolveGovernanceCapabilityBaseline("org-model");
  assert.equal(baseline.capabilityId, "org-model");
  assert.ok(baseline.entryModule.includes("org-model"));
  assert.ok(baseline.description.length > 0);
  assert.ok(baseline.baselineServices.includes("HrRoleGovernanceService"));
});

test("resolveGovernanceCapabilityBaseline returns correct baseline for approval-routing", () => {
  const baseline = resolveGovernanceCapabilityBaseline("approval-routing");
  assert.equal(baseline.capabilityId, "approval-routing");
  assert.ok(baseline.entryModule.includes("approval-routing"));
  assert.ok(baseline.baselineServices.includes("ApprovalRoutingService"));
});

test("resolveGovernanceCapabilityBaseline returns correct baseline for sso-scim", () => {
  const baseline = resolveGovernanceCapabilityBaseline("sso-scim");
  assert.equal(baseline.capabilityId, "sso-scim");
  assert.ok(baseline.entryModule.includes("sso-scim"));
  assert.ok(baseline.baselineServices.includes("IdentitySyncService"));
});

test("resolveGovernanceCapabilityBaseline returns correct baseline for compliance-engine", () => {
  const baseline = resolveGovernanceCapabilityBaseline("compliance-engine");
  assert.equal(baseline.capabilityId, "compliance-engine");
  assert.ok(baseline.entryModule.includes("compliance-engine"));
  assert.ok(baseline.baselineServices.includes("ComplianceGovernanceService"));
});

test("resolveGovernanceCapabilityBaseline returns correct baseline for knowledge-boundary", () => {
  const baseline = resolveGovernanceCapabilityBaseline("knowledge-boundary");
  assert.equal(baseline.capabilityId, "knowledge-boundary");
  assert.ok(baseline.entryModule.includes("knowledge-boundary"));
  assert.ok(baseline.baselineServices.includes("KnowledgeBoundaryService"));
});

test("resolveGovernanceCapabilityBaseline returns correct baseline for delegated-governance", () => {
  const baseline = resolveGovernanceCapabilityBaseline("delegated-governance");
  assert.equal(baseline.capabilityId, "delegated-governance");
  assert.ok(baseline.entryModule.includes("delegated-governance"));
  assert.ok(baseline.baselineServices.includes("DelegatedGovernanceService"));
});

test("resolveGovernanceCapabilityBaseline throws for invalid capabilityId", () => {
  assert.throws(
    () => resolveGovernanceCapabilityBaseline("invalid" as GovernanceCapabilityId),
    (error: unknown) => error instanceof Error && error.message.includes("governance_capability.not_found"),
  );
});

test("resolveGovernanceCapabilityBaseline throws with correct error message format", () => {
  try {
    resolveGovernanceCapabilityBaseline("nonexistent" as GovernanceCapabilityId);
    assert.fail("Expected error to be thrown");
  } catch (error: any) {
    assert.ok(error.message.includes("governance_capability.not_found"));
    assert.ok(error.message.includes("nonexistent"));
  }
});

test("GOVERNANCE_CAPABILITY_BASELINES is frozen", () => {
  assert.ok(Object.isFrozen(GOVERNANCE_CAPABILITY_BASELINES));
});

test("each baseline in GOVERNANCE_CAPABILITY_BASELINES is frozen", () => {
  for (const baseline of GOVERNANCE_CAPABILITY_BASELINES) {
    assert.ok(Object.isFrozen(baseline));
  }
});

test("all capability IDs are unique", () => {
  const ids = GOVERNANCE_CAPABILITY_BASELINES.map((b) => b.capabilityId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, "All capability IDs should be unique");
});

test("all entry modules are valid TypeScript imports", () => {
  for (const baseline of GOVERNANCE_CAPABILITY_BASELINES) {
    assert.ok(baseline.entryModule.startsWith("src/"));
    assert.ok(baseline.entryModule.endsWith(".ts") || baseline.entryModule.endsWith("/"));
  }
});

test("all architecture sections reference architecture doc sections", () => {
  for (const baseline of GOVERNANCE_CAPABILITY_BASELINES) {
    for (const section of baseline.architectureSections) {
      assert.ok(section.startsWith("§"), `Architecture section should start with §: ${section}`);
    }
  }
});

test("baseline services are non-empty strings", () => {
  for (const baseline of GOVERNANCE_CAPABILITY_BASELINES) {
    for (const service of baseline.baselineServices) {
      assert.ok(typeof service === "string");
      assert.ok(service.length > 0);
    }
  }
});

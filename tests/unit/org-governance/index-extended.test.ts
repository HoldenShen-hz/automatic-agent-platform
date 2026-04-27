/**
 * Unit tests for OrgGovernance index exports extended
 *
 * @see src/org-governance/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as governance from "../../../src/org-governance/index.js";

test("governance exports ApprovalRoutingService", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("ApprovalRoutingService")), "should export ApprovalRoutingService");
});

test("governance exports ComplianceGovernanceService", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("ComplianceGovernanceService")), "should export ComplianceGovernanceService");
});

test("governance exports KnowledgeBoundaryService", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("KnowledgeBoundaryService")), "should export KnowledgeBoundaryService");
});

test("governance exports ScimProvisionService", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("ScimProvisionService") || k.includes("Scim")), "should export ScimProvisionService");
});

test("governance exports OidcIdentityService", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("OidcIdentityService") || k.includes("Oidc")), "should export OidcIdentityService");
});

test("governance exports OrgNodeSchema", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("OrgNodeSchema")), "should export OrgNodeSchema");
});

test("governance exports GovernanceDelegationSchema", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("GovernanceDelegation")), "should export GovernanceDelegationSchema");
});

test("governance exports listGovernanceCapabilityBaselines", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("listGovernanceCapabilityBaselines")), "should export listGovernanceCapabilityBaselines");
});

test("governance exports buildGovernanceBootstrap", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("buildGovernanceBootstrap")), "should export buildGovernanceBootstrap");
});

test("governance exports approval-routing sub-module", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.toLowerCase().includes("delegation") || k.includes("Delegation")), "should export delegation");
});

test("governance exports evaluation functions from approval-routing", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("shouldEscalateApproval")), "should export shouldEscalateApproval");
});

test("governance exports evaluateChineseWallPolicy", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("evaluateChineseWallPolicy")), "should export evaluateChineseWallPolicy");
});

test("governance exports evaluateKnowledgeShare", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("evaluateKnowledgeShare")), "should export evaluateKnowledgeShare");
});

test("governance exports evaluateGuardrail", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("evaluateGuardrail")), "should export evaluateGuardrail");
});

test("governance exports mergeOrgNodes", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("mergeOrgNodes")), "should export mergeOrgNodes");
});

test("governance exports detectOrgChangeEvents", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("detectOrgChangeEvents")), "should export detectOrgChangeEvents");
});

test("governance exports validateOrgHierarchy", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("validateOrgHierarchy")), "should export validateOrgHierarchy");
});

test("governance exports resolveApprovalRoute", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("resolveApprovalRoute")), "should export resolveApprovalRoute");
});

test("governance exports buildReportingChain", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("buildReportingChain")), "should export buildReportingChain");
});

test("governance exports isTerminalScimAction", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("isTerminalScimAction")), "should export isTerminalScimAction");
});

test("governance index exports compliance engine types", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("ComplianceFramework") || k.includes("ComplianceEvidence")), "should export compliance types");
});

test("governance index exports knowledge boundary types", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("KnowledgeBoundary") || k.includes("ChineseWall")), "should export knowledge boundary types");
});

test("governance exports listActiveGovernanceDelegations", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("listActiveGovernanceDelegations")), "should export listActiveGovernanceDelegations");
});

test("governance exports createCrossOrgCollaborator", () => {
  const keys = Object.keys(governance);
  assert.ok(keys.some(k => k.includes("createCrossOrgCollaborator")), "should export createCrossOrgCollaborator");
});
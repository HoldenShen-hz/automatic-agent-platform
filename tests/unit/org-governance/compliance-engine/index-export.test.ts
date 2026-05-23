/**
 * Unit tests for compliance-engine index exports
 *
 * @see src/org-governance/compliance-engine/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import all exports to verify they are available
import * as ComplianceEngineExports from "../../../../src/org-governance/compliance-engine/index.js";

test("compliance-engine index exports GovernanceAuditRecordSchema", () => {
  assert.ok(ComplianceEngineExports.GovernanceAuditRecordSchema, "GovernanceAuditRecordSchema should be exported");
  assert.equal(typeof ComplianceEngineExports.GovernanceAuditRecordSchema, "object");
});

test("compliance-engine index exports buildGovernanceAuditRecord", () => {
  assert.ok(ComplianceEngineExports.buildGovernanceAuditRecord, "buildGovernanceAuditRecord should be exported");
  assert.equal(typeof ComplianceEngineExports.buildGovernanceAuditRecord, "function");
});

test("compliance-engine index exports ComplianceGovernanceService", () => {
  assert.ok(ComplianceEngineExports.ComplianceGovernanceService, "ComplianceGovernanceService should be exported");
});

test("compliance-engine index exports ComplianceEvidenceCollector", () => {
  assert.ok(ComplianceEngineExports.ComplianceEvidenceCollector, "ComplianceEvidenceCollector should be exported");
});

test("compliance-engine index exports inheritPolicyLayers function", () => {
  assert.ok(ComplianceEngineExports.inheritPolicyLayers, "inheritPolicyLayers should be exported");
  assert.equal(typeof ComplianceEngineExports.inheritPolicyLayers, "function");
});

test("compliance-engine index exports resolveCompliancePolicyForNode function", () => {
  assert.ok(ComplianceEngineExports.resolveCompliancePolicyForNode, "resolveCompliancePolicyForNode should be exported");
  assert.equal(typeof ComplianceEngineExports.resolveCompliancePolicyForNode, "function");
});

test("inheritPolicyLayers works via exported function", () => {
  const layers = [
    { policyId: "p1", rules: { auditEnabled: true } },
    { policyId: "p2", rules: { auditEnabled: false } },
  ];

  const result = ComplianceEngineExports.inheritPolicyLayers(layers);

  // OR logic for booleans: true || false = true
  assert.strictEqual(result.auditEnabled, true);
});

test("resolveCompliancePolicyForNode works via exported function", () => {
  const nodes = [
    {
      orgNodeId: "root",
      nodeType: "company" as const,
      displayName: "Acme",
      parentOrgNodeId: null,
      ownerUserIds: [],
      active: true,
      costCenter: "",
      metadata: {},
      effectivePolicies: {},
      status: "active" as const,
    },
  ];

  const policiesByNodeId = {
    root: [{ policyId: "root_policy", rules: { complianceMode: "strict" } }],
  };

  const result = ComplianceEngineExports.resolveCompliancePolicyForNode(nodes, "root", policiesByNodeId);

  assert.strictEqual(result.complianceMode, "strict");
});

test("buildGovernanceAuditRecord works via exported function", () => {
  const record = ComplianceEngineExports.buildGovernanceAuditRecord({
    recordId: "audit-001",
    action: "test.action",
    actorId: "user-1",
    orgNodeId: "node-1",
    allowed: true,
    reasonCodes: [],
    occurredAt: "2024-01-15T10:00:00.000Z",
  });

  assert.strictEqual(record.recordId, "audit-001");
  assert.strictEqual(record.action, "test.action");
});

test("ComplianceEvidenceCollector works via exported class", () => {
  const collector = new ComplianceEngineExports.ComplianceEvidenceCollector();
  const record = collector.collect({
    frameworkId: "sox",
    controlId: "ctrl-1",
    source: "system",
    artifactRef: "artifact-1",
  });

  assert.ok(record.evidenceId.startsWith("compliance_evidence_"));
  assert.strictEqual(record.frameworkId, "sox");
});

test("GovernanceAuditRecordSchema parses valid record", () => {
  const result = ComplianceEngineExports.GovernanceAuditRecordSchema.safeParse({
    recordId: "audit-001",
    action: "test.action",
    actorId: "user-1",
    orgNodeId: "node-1",
    allowed: true,
    reasonCodes: [],
    occurredAt: "2024-01-15T10:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("GovernanceAuditRecordSchema rejects missing recordId", () => {
  const result = ComplianceEngineExports.GovernanceAuditRecordSchema.safeParse({
    recordId: "",
    action: "test.action",
    actorId: "user-1",
    orgNodeId: "node-1",
    allowed: true,
    reasonCodes: [],
    occurredAt: "2024-01-15T10:00:00.000Z",
  });
  assert.equal(result.success, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceGovernanceService, type ComplianceEvaluationInput } from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";
import type { PolicyLayer } from "../../../../src/org-governance/compliance-engine/inheritance/index.js";
import { DEFAULT_COMPLIANCE_FRAMEWORKS, type ComplianceFramework } from "../../../../src/org-governance/compliance-engine/framework-catalog.js";

function createMockOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: "org_1",
    nodeType: "department",
    displayName: "Test Department",
    parentOrgNodeId: null,
    ownerUserIds: [],
    active: true,
    costCenter: "CC-001",
    metadata: {},
    ...overrides,
  };
}

function createMockPolicyLayer(overrides: Partial<PolicyLayer> = {}): PolicyLayer {
  return {
    policyId: "policy_1",
    rules: {
      encryptionRequired: true,
      retentionDays: 365,
      allowDataExport: true,
    },
    ...overrides,
  };
}

test("ComplianceGovernanceService constructor initializes with empty state", () => {
  // Pass empty arrays for frameworks and bindings to get truly empty state
  const service = new ComplianceGovernanceService([], {}, [], []);
  assert.deepStrictEqual(service.listFrameworks(), []);
});

test("ComplianceGovernanceService registers framework and returns it", () => {
  // Pass empty arrays for frameworks and bindings to get truly empty state
  const service = new ComplianceGovernanceService([], {}, [], []);
  const framework: ComplianceFramework = {
    frameworkId: "test_framework",
    type: "gdpr",
    displayName: "Test Framework",
    controlIds: ["control_1", "control_2"],
    auditRequirements: [],
    reportTemplate: "test_template",
    minimumPolicies: { encryptionRequired: true },
  };

  const result = service.registerFramework(framework);

  assert.strictEqual(result.frameworkId, "test_framework");
  const frameworks = service.listFrameworks();
  assert.strictEqual(frameworks.length, 1);
  assert.strictEqual(frameworks[0]?.frameworkId, "test_framework");
});

test("ComplianceGovernanceService attachFrameworks binds framework to org node", () => {
  const service = new ComplianceGovernanceService([], {}, [], []);
  const binding = {
    bindingId: "binding_1",
    orgNodeId: "org_1",
    frameworkIds: ["gdpr", "hipaa"],
    attachedAt: "2026-04-01T00:00:00Z",
    attachedBy: "admin_1",
  };

  const result = service.attachFrameworks(binding);

  assert.strictEqual(result.orgNodeId, "org_1");
  assert.deepStrictEqual(result.frameworkIds, ["gdpr", "hipaa"]);
});

test("ComplianceGovernanceService collectEvidence creates evidence record", () => {
  const service = new ComplianceGovernanceService([], {}, [], []);

  const evidence = service.collectEvidence({
    frameworkId: "gdpr",
    controlId: "data_retention",
    source: "CRM System",
    artifactRef: "doc_123",
    evidenceType: "document",
    collectedBy: "auditor_1",
    content: "Retention policy",
    sourceSystem: "CRM",
  });

  assert.ok(evidence.evidenceId.length > 0);
  assert.strictEqual(evidence.frameworkId, "gdpr");
  assert.strictEqual(evidence.controlId, "data_retention");
  assert.ok(evidence.collectedAt.length > 0);
  assert.ok(evidence.previousHash.length > 0);
  assert.ok(evidence.hash.length > 0);
});

test("ComplianceGovernanceService listEvidence returns evidence for specific framework", () => {
  const service = new ComplianceGovernanceService([], {}, [], []);

  service.collectEvidence({
    frameworkId: "gdpr",
    controlId: "data_retention",
    source: "CRM",
    artifactRef: "doc_1",
  });

  service.collectEvidence({
    frameworkId: "gdpr",
    controlId: "erasure",
    source: "CRM",
    artifactRef: "doc_2",
  });

  service.collectEvidence({
    frameworkId: "hipaa",
    controlId: "phi_access",
    source: "EHR",
    artifactRef: "log_1",
  });

  const gdprEvidence = service.listEvidence("gdpr");
  assert.strictEqual(gdprEvidence.length, 2);
  assert.ok(gdprEvidence.every((e) => e.frameworkId === "gdpr"));

  const hipaaEvidence = service.listEvidence("hipaa");
  assert.strictEqual(hipaaEvidence.length, 1);
});

test("ComplianceGovernanceService listEvidence returns all evidence when no framework specified", () => {
  const service = new ComplianceGovernanceService([], {}, [], []);

  service.collectEvidence({ frameworkId: "gdpr", controlId: "c1", source: "s1", artifactRef: "a1" });
  service.collectEvidence({ frameworkId: "hipaa", controlId: "c2", source: "s2", artifactRef: "a2" });
  service.collectEvidence({ frameworkId: "sox", controlId: "c3", source: "s3", artifactRef: "a3" });

  const allEvidence = service.listEvidence();
  assert.strictEqual(allEvidence.length, 3);
});

test("ComplianceGovernanceService createExceptionWorkflow creates exception record", () => {
  const service = new ComplianceGovernanceService([], {}, [], []);

  const exception = service.createExceptionWorkflow({
    scope: "read_sensitive_data",
    expiresAt: "2026-12-31T23:59:59Z",
    approver: "compliance_officer_1",
    compensatingControls: ["access_logging", "quarterly_review"],
    auditRef: "AUDIT-2026-001",
  });

  assert.ok(exception.exceptionId.startsWith("compliance_exception:"));
  assert.strictEqual(exception.scope, "read_sensitive_data");
  assert.strictEqual(exception.expiresAt, "2026-12-31T23:59:59Z");
  assert.strictEqual(exception.approver, "compliance_officer_1");
  assert.deepStrictEqual(exception.compensatingControls, ["access_logging", "quarterly_review"]);
  assert.strictEqual(exception.auditRef, "AUDIT-2026-001");
});

test("ComplianceGovernanceService scoreEvidenceQuality calculates score correctly", () => {
  const service = new ComplianceGovernanceService([], {}, [], []);

  service.collectEvidence({ frameworkId: "gdpr", controlId: "c1", source: "s1", artifactRef: "a1" });
  service.collectEvidence({ frameworkId: "gdpr", controlId: "c2", source: "s2", artifactRef: "a2" });
  // This one has empty artifactRef - should be counted as missing
  service.collectEvidence({ frameworkId: "gdpr", controlId: "c3", source: "", artifactRef: "" });

  const score = service.scoreEvidenceQuality("gdpr");

  assert.strictEqual(score.frameworkId, "gdpr");
  assert.strictEqual(score.missingEvidenceIds.length, 1);
  // 2 good out of 3 = 66.67%
  assert.ok(score.score > 66 && score.score <= 67);
});

test("ComplianceGovernanceService scoreEvidenceQuality returns 0 for no evidence", () => {
  const service = new ComplianceGovernanceService([], {}, [], []);

  const score = service.scoreEvidenceQuality("nonexistent");

  assert.strictEqual(score.frameworkId, "nonexistent");
  assert.strictEqual(score.score, 0);
  assert.strictEqual(score.missingEvidenceIds.length, 0);
});

test("ComplianceGovernanceService buildControlCoverageReport returns report for unknown framework", () => {
  const nodes = [createMockOrgNode()];
  const service = new ComplianceGovernanceService(nodes, {});

  const report = service.buildControlCoverageReport("unknown_framework", "org_1");

  assert.strictEqual(report.frameworkId, "unknown_framework");
  assert.deepStrictEqual(report.coveredControlIds, []);
  assert.deepStrictEqual(report.missingControlIds, []);
  assert.strictEqual(report.coverageRatio, 0);
});

test("ComplianceGovernanceService buildControlCoverageReport calculates coverage correctly", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  const framework: ComplianceFramework = {
    frameworkId: "test",
    type: "gdpr",
    displayName: "Test",
    controlIds: ["control_a", "control_b", "control_c"],
    auditRequirements: [],
    reportTemplate: "t",
    minimumPolicies: {},
  };
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [{
      policyId: "p1",
      rules: { control_a: true, control_b: true },
    }],
  };

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId, [framework]);

  const report = service.buildControlCoverageReport("test", "org_1");

  assert.strictEqual(report.frameworkId, "test");
  assert.deepStrictEqual(report.coveredControlIds, ["control_a", "control_b"]);
  assert.deepStrictEqual(report.missingControlIds, ["control_c"]);
  assert.ok(report.coverageRatio > 0.66 && report.coverageRatio <= 0.67);
});

test("ComplianceGovernanceService evaluate returns allowed when no policies required and none missing", () => {
  const nodes = [createMockOrgNode()];
  const service = new ComplianceGovernanceService(nodes, {});

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "read_data",
  });

  assert.strictEqual(result.orgNodeId, "org_1");
  assert.strictEqual(result.allowed, true);
  assert.deepStrictEqual(result.missingKeys, []);
  assert.deepStrictEqual(result.applicableFrameworks, []);
});

test("ComplianceGovernanceService evaluate returns not allowed when required policy keys missing", () => {
  const nodes = [createMockOrgNode()];
  const service = new ComplianceGovernanceService(nodes, {});

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "read_data",
    requiredPolicyKeys: ["encryptionRequired", "auditLogging"],
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.missingKeys.includes("encryptionRequired"));
  assert.ok(result.missingKeys.includes("auditLogging"));
});

test("ComplianceGovernanceService evaluate creates audit record with correct fields", () => {
  const nodes = [createMockOrgNode()];
  const service = new ComplianceGovernanceService(nodes, {});

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "process_data",
    requiredPolicyKeys: ["encryptionRequired"],
  });

  assert.ok(result.auditRecord);
  assert.strictEqual(result.auditRecord.recordId, "audit_org_1_process_data");
  assert.strictEqual(result.auditRecord.actorId, "user_1");
  assert.strictEqual(result.auditRecord.action, "process_data");
  assert.strictEqual(result.auditRecord.orgNodeId, "org_1");
  assert.strictEqual(result.auditRecord.allowed, false);
  assert.ok(result.auditRecord.reasonCodes.length > 0);
  assert.ok(result.auditRecord.occurredAt.length > 0);
});

test("ComplianceGovernanceService evaluate includes applicable frameworks in result", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  const framework: ComplianceFramework = {
    frameworkId: "gdpr",
    type: "gdpr",
    displayName: "GDPR",
    controlIds: ["lawful_basis"],
    auditRequirements: [],
    reportTemplate: "gdpr_report",
    minimumPolicies: {},
  };
  const policiesByNodeId: Record<string, PolicyLayer[]> = {};

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId, [framework]);
  service.attachFrameworks({ bindingId: "b1", orgNodeId: "org_1", frameworkIds: ["gdpr"], attachedAt: "2026-01-01T00:00:00Z", attachedBy: "admin" });

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "process_personal_data",
  });

  assert.strictEqual(result.applicableFrameworks.length, 1);
  assert.strictEqual(result.applicableFrameworks[0]?.frameworkId, "gdpr");
});

test("ComplianceGovernanceService evaluate detects missing controls from applicable frameworks", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  const framework: ComplianceFramework = {
    frameworkId: "hipaa",
    type: "hipaa",
    displayName: "HIPAA",
    controlIds: ["phi_access", "minimum_necessary", "encryption_required"],
    auditRequirements: [],
    reportTemplate: "hipaa_report",
    minimumPolicies: {},
  };
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [{ policyId: "p1", rules: {} }],
  };

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId, [framework]);
  service.attachFrameworks({ bindingId: "b1", orgNodeId: "org_1", frameworkIds: ["hipaa"], attachedAt: "2026-01-01T00:00:00Z", attachedBy: "admin" });

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "process_phi",
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.missingControls.length > 0);
  assert.ok(result.missingControls.includes("phi_access"));
});

test("ComplianceGovernanceService evaluate detects missing framework minimum policies", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  const framework: ComplianceFramework = {
    frameworkId: "sox",
    type: "sox",
    displayName: "SOX",
    controlIds: [],
    auditRequirements: [],
    reportTemplate: "sox_report",
    minimumPolicies: {
      segregationOfDuties: true,
      auditRetentionDays: 2555,
    },
  };
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [{ policyId: "p1", rules: { segregationOfDuties: false } }],
  };

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId, [framework]);
  service.attachFrameworks({ bindingId: "b1", orgNodeId: "org_1", frameworkIds: ["sox"], attachedAt: "2026-01-01T00:00:00Z", attachedBy: "admin" });

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "financial_reporting",
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.missingControls.some((c) => c.includes("segregationOfDuties") || c.includes("auditRetentionDays")));
});

test("ComplianceGovernanceService evaluate resolves parent node lineage for framework attachment", () => {
  const rootOrg = createMockOrgNode({ orgNodeId: "root", nodeType: "company", parentOrgNodeId: null });
  const childOrg = createMockOrgNode({ orgNodeId: "child", nodeType: "division", parentOrgNodeId: "root" });
  const grandchildOrg = createMockOrgNode({ orgNodeId: "grandchild", nodeType: "department", parentOrgNodeId: "child" });

  const nodes = [rootOrg, childOrg, grandchildOrg];
  const framework: ComplianceFramework = {
    frameworkId: "pipl",
    type: "pipl",
    displayName: "PIPL",
    controlIds: [],
    auditRequirements: [],
    reportTemplate: "pipl_report",
    minimumPolicies: {},
  };

  const service = new ComplianceGovernanceService(nodes, {}, [framework]);
  // Attach to root, evaluate at grandchild
  service.attachFrameworks({ bindingId: "b1", orgNodeId: "root", frameworkIds: ["pipl"], attachedAt: "2026-01-01T00:00:00Z", attachedBy: "admin" });

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "grandchild",
    action: "process_data",
  });

  // Grandchild inherits framework from root through lineage
  assert.strictEqual(result.applicableFrameworks.length, 1);
  assert.strictEqual(result.applicableFrameworks[0]?.frameworkId, "pipl");
});

test("ComplianceGovernanceService evaluate uses occurredAt when provided", () => {
  const nodes = [createMockOrgNode()];
  const service = new ComplianceGovernanceService(nodes, {});

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "test",
    occurredAt: "2026-01-15T10:30:00Z",
  });

  assert.strictEqual(result.auditRecord.occurredAt, "2026-01-15T10:30:00Z");
});

test("ComplianceGovernanceService evaluate with default frameworks uses built-in frameworks", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [{ policyId: "p1", rules: {} }],
  };

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId);
  service.attachFrameworks({ bindingId: "b1", orgNodeId: "org_1", frameworkIds: ["sox"], attachedAt: "2026-01-01T00:00:00Z", attachedBy: "admin" });

  const result = service.evaluate({
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "financial_reporting",
  });

  // SOX has minimum policies that won't be satisfied by empty rules
  assert.strictEqual(result.allowed, false);
  assert.ok(result.applicableFrameworks.length >= 1);
});

test("ComplianceGovernanceService listFrameworks returns registered frameworks", () => {
  const framework1: ComplianceFramework = {
    frameworkId: "framework_1",
    type: "gdpr",
    displayName: "Framework 1",
    controlIds: [],
    auditRequirements: [],
    reportTemplate: "t1",
    minimumPolicies: {},
  };
  const framework2: ComplianceFramework = {
    frameworkId: "framework_2",
    type: "hipaa",
    displayName: "Framework 2",
    controlIds: [],
    auditRequirements: [],
    reportTemplate: "t2",
    minimumPolicies: {},
  };

  const service = new ComplianceGovernanceService([], {}, [], []);
  service.registerFramework(framework1);
  service.registerFramework(framework2);

  const frameworks = service.listFrameworks();
  assert.strictEqual(frameworks.length, 2);
  assert.ok(frameworks.some((f) => f.frameworkId === "framework_1"));
  assert.ok(frameworks.some((f) => f.frameworkId === "framework_2"));
});

test("ComplianceGovernanceService constructor with custom frameworks initializes correctly", () => {
  const customFrameworks = DEFAULT_COMPLIANCE_FRAMEWORKS.slice(0, 2);
  const service = new ComplianceGovernanceService([], {}, customFrameworks);

  const frameworks = service.listFrameworks();
  assert.strictEqual(frameworks.length, 2);
});

test("ComplianceGovernanceService buildControlCoverageReport with empty controlIds returns 100% coverage", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  const framework: ComplianceFramework = {
    frameworkId: "empty_test",
    type: "gdpr",
    displayName: "Empty Test",
    controlIds: [],
    auditRequirements: [],
    reportTemplate: "t",
    minimumPolicies: {},
  };

  const service = new ComplianceGovernanceService(nodes, {}, [framework]);

  const report = service.buildControlCoverageReport("empty_test", "org_1");
  assert.strictEqual(report.coverageRatio, 1);
});

test("ComplianceGovernanceService scoreEvidenceQuality handles evidence with missing source", () => {
  const service = new ComplianceGovernanceService([], {}, [], []);

  // Evidence with empty source should be counted as missing
  service.collectEvidence({ frameworkId: "test", controlId: "c1", source: "", artifactRef: "art1" });
  service.collectEvidence({ frameworkId: "test", controlId: "c2", source: "valid", artifactRef: "art2" });

  const score = service.scoreEvidenceQuality("test");
  assert.strictEqual(score.missingEvidenceIds.length, 1);
});

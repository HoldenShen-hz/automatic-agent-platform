/**
 * Unit tests for compliance-engine module
 *
 * @see src/org-governance/compliance-engine/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";
import type { ComplianceFramework, DepartmentComplianceBinding } from "../../../src/org-governance/compliance-engine/framework-catalog.js";
import type { PolicyLayer } from "../../../src/org-governance/compliance-engine/inheritance/index.js";
import type { GovernanceAuditRecord } from "../../../src/org-governance/compliance-engine/audit-enforcer/index.js";
import {
  ComplianceGovernanceService,
  type ComplianceEvaluationInput,
  type ComplianceEvaluationResult,
} from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { ComplianceEvidenceCollector } from "../../../src/org-governance/compliance-engine/evidence-collector.js";
import { DEFAULT_COMPLIANCE_FRAMEWORKS } from "../../../src/org-governance/compliance-engine/framework-catalog.js";
import { resolveCompliancePolicyForNode } from "../../../src/org-governance/compliance-engine/policy-resolver/index.js";
import { inheritPolicyLayers } from "../../../src/org-governance/compliance-engine/inheritance/index.js";
import { buildGovernanceAuditRecord } from "../../../src/org-governance/compliance-engine/audit-enforcer/index.js";

// Mock OrgNode factory
function createMockOrgNode(overrides: Partial<OrgNode> & { orgNodeId: string; nodeType: OrgNode["nodeType"] }): OrgNode {
  return {
    orgNodeId: overrides.orgNodeId,
    nodeType: overrides.nodeType,
    displayName: overrides.displayName ?? `Node ${overrides.orgNodeId}`,
    parentOrgNodeId: overrides.parentOrgNodeId ?? null,
    ownerUserIds: overrides.ownerUserIds ?? [],
    active: overrides.active ?? true,
    costCenter: overrides.costCenter ?? "",
    metadata: overrides.metadata ?? {},
  };
}

const COMPANY = createMockOrgNode({ orgNodeId: "company-1", nodeType: "company" });
const DIVISION = createMockOrgNode({ orgNodeId: "division-1", nodeType: "division", parentOrgNodeId: "company-1" });
const DEPARTMENT = createMockOrgNode({ orgNodeId: "dept-1", nodeType: "department", parentOrgNodeId: "division-1" });
const TEAM = createMockOrgNode({ orgNodeId: "team-1", nodeType: "team", parentOrgNodeId: "dept-1" });
const MEMBER = createMockOrgNode({ orgNodeId: "member-1", nodeType: "member", parentOrgNodeId: "team-1" });

const HIERARCHY: readonly OrgNode[] = [COMPANY, DIVISION, DEPARTMENT, TEAM, MEMBER];

const SOX_FRAMEWORK: ComplianceFramework = {
  frameworkId: "custom_sox",
  displayName: "Custom SOX",
  controlIds: ["access_review", "approval_segregation"],
  minimumPolicies: {
    segregationOfDuties: true,
    auditRetentionDays: 2555,
  },
};

const SOX_BINDING: DepartmentComplianceBinding = {
  bindingId: "binding-1",
  orgNodeId: "dept-1",
  frameworkIds: ["custom_sox"],
  attachedAt: "2024-01-01T00:00:00Z",
  attachedBy: "admin",
};

function createMockPolicyLayer(policyId: string, rules: Record<string, unknown>): PolicyLayer {
  return { policyId, rules: Object.freeze(rules) };
}

test("ComplianceEvidenceCollector.collect creates record with generated id", () => {
  const collector = new ComplianceEvidenceCollector();
  const record = collector.collect({
    frameworkId: "sox",
    controlId: "access_review",
    source: "manual",
    artifactRef: "artifact-1",
  });

  assert.ok(record.evidenceId.startsWith("compliance_evidence_"), "should have generated evidenceId");
  assert.strictEqual(record.frameworkId, "sox");
  assert.strictEqual(record.controlId, "access_review");
  assert.strictEqual(record.collectedAt.length, 24, "should have ISO timestamp");
});

test("ComplianceEvidenceCollector.collect uses provided collectedAt", () => {
  const collector = new ComplianceEvidenceCollector();
  const record = collector.collect({
    frameworkId: "hipaa",
    controlId: "phi_access",
    source: "automated",
    artifactRef: "artifact-2",
    collectedAt: "2024-06-15T10:30:00Z",
  });

  assert.strictEqual(record.collectedAt, "2024-06-15T10:30:00Z");
});

test("ComplianceEvidenceCollector.list returns all records when no frameworkId", () => {
  const collector = new ComplianceEvidenceCollector();
  collector.collect({ frameworkId: "sox", controlId: "c1", source: "s1", artifactRef: "a1" });
  collector.collect({ frameworkId: "hipaa", controlId: "c2", source: "s2", artifactRef: "a2" });

  const records = collector.list();
  assert.strictEqual(records.length, 2);
});

test("ComplianceEvidenceCollector.list filters by frameworkId", () => {
  const collector = new ComplianceEvidenceCollector();
  collector.collect({ frameworkId: "sox", controlId: "c1", source: "s1", artifactRef: "a1" });
  collector.collect({ frameworkId: "hipaa", controlId: "c2", source: "s2", artifactRef: "a2" });
  collector.collect({ frameworkId: "sox", controlId: "c3", source: "s3", artifactRef: "a3" });

  const soxRecords = collector.list("sox");
  assert.strictEqual(soxRecords.length, 2);
  assert.ok(soxRecords.every(r => r.frameworkId === "sox"));
});

test("ComplianceGovernanceService.constructor initializes with default frameworks", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  const frameworks = service.listFrameworks();

  assert.ok(frameworks.length > 0, "should have default frameworks");
  assert.ok(frameworks.some(f => f.frameworkId === "sox"), "should include SOX");
  assert.ok(frameworks.some(f => f.frameworkId === "hipaa"), "should include HIPAA");
});

test("ComplianceGovernanceService.constructor applies custom frameworks", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {}, [SOX_FRAMEWORK]);
  const frameworks = service.listFrameworks();

  assert.ok(frameworks.some(f => f.frameworkId === "custom_sox"), "should include custom framework");
});

test("ComplianceGovernanceService.registerFramework adds new framework", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  const newFramework: ComplianceFramework = {
    frameworkId: "new_framework",
    displayName: "New Framework",
    controlIds: ["control_1"],
    minimumPolicies: {},
  };

  const result = service.registerFramework(newFramework);
  assert.strictEqual(result.frameworkId, "new_framework");
  assert.ok(service.listFrameworks().some(f => f.frameworkId === "new_framework"));
});

test("ComplianceGovernanceService.attachFrameworks binds framework to node", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {}, [SOX_FRAMEWORK]);
  const binding: DepartmentComplianceBinding = {
    bindingId: "binding-2",
    orgNodeId: "division-1",
    frameworkIds: ["custom_sox"],
    attachedAt: "2024-01-15T00:00:00Z",
    attachedBy: "admin",
  };

  const result = service.attachFrameworks(binding);
  assert.strictEqual(result.bindingId, "binding-2");
});

test("ComplianceGovernanceService.collectEvidence delegates to collector", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  const record = service.collectEvidence({
    frameworkId: "gdpr",
    controlId: "lawful_basis",
    source: "policy_doc",
    artifactRef: "gdpr-policy.pdf",
  });

  assert.ok(record.evidenceId.startsWith("compliance_evidence_"));
  assert.strictEqual(record.frameworkId, "gdpr");
});

test("ComplianceGovernanceService.listEvidence returns evidence records", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  service.collectEvidence({ frameworkId: "pci_dss", controlId: "network_segmentation", source: "scan", artifactRef: "scan-report" });
  service.collectEvidence({ frameworkId: "pci_dss", controlId: "key_rotation", source: "scan", artifactRef: "scan-report2" });

  const evidence = service.listEvidence();
  assert.strictEqual(evidence.length, 2);
});

test("ComplianceGovernanceService.listEvidence filters by framework", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  service.collectEvidence({ frameworkId: "pci_dss", controlId: "network_segmentation", source: "scan", artifactRef: "scan-report" });
  service.collectEvidence({ frameworkId: "gdpr", controlId: "lawful_basis", source: "doc", artifactRef: "gdpr-doc" });

  const pciEvidence = service.listEvidence("pci_dss");
  assert.strictEqual(pciEvidence.length, 1);
  assert.strictEqual(pciEvidence[0]?.frameworkId, "pci_dss");
});

test("ComplianceGovernanceService.evaluate allows action when policy satisfied", () => {
  const policies: Record<string, PolicyLayer[]> = {
    "dept-1": [createMockPolicyLayer("sox_policy", {
      segregationOfDuties: true,
      auditRetentionDays: 3000,
      access_review: true,
      approval_segregation: true,
    })],
  };
  const service = new ComplianceGovernanceService(HIERARCHY, policies, [SOX_FRAMEWORK], [SOX_BINDING]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "financial_access",
  });

  assert.strictEqual(result.allowed, true);
  assert.deepStrictEqual(result.missingKeys, []);
  assert.strictEqual(result.orgNodeId, "dept-1");
});

test("ComplianceGovernanceService.evaluate blocks action when required policy missing", () => {
  const policies: Record<string, PolicyLayer[]> = {
    "dept-1": [createMockPolicyLayer("incomplete_policy", { segregationOfDuties: true })],
  };
  const service = new ComplianceGovernanceService(HIERARCHY, policies, [SOX_FRAMEWORK], [SOX_BINDING]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "financial_access",
    requiredPolicyKeys: ["auditRetentionDays"],
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.missingKeys.includes("auditRetentionDays"));
});

test("ComplianceGovernanceService.evaluate checks control requirements", () => {
  const frameworkMissingControl: ComplianceFramework = {
    frameworkId: "minimal",
    displayName: "Minimal Framework",
    controlIds: ["required_control"],
    minimumPolicies: {},
  };
  const binding: DepartmentComplianceBinding = {
    bindingId: "binding-minimal",
    orgNodeId: "team-1",
    frameworkIds: ["minimal"],
    attachedAt: "2024-01-01T00:00:00Z",
    attachedBy: "admin",
  };

  const service = new ComplianceGovernanceService(HIERARCHY, {}, [frameworkMissingControl], [binding]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "team-1",
    action: "test_action",
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.missingControls.includes("required_control"));
});

test("ComplianceGovernanceService.evaluate checks framework minimum policies", () => {
  const policies: Record<string, PolicyLayer[]> = {
    "dept-1": [createMockPolicyLayer("weak_policy", { segregationOfDuties: false })],
  };
  const service = new ComplianceGovernanceService(HIERARCHY, policies, [SOX_FRAMEWORK], [SOX_BINDING]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "financial_access",
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.missingControls.some(c => c.includes("segregationOfDuties") || c.includes("framework_policy")));
});

test("ComplianceGovernanceService.evaluate inherits policies from ancestor nodes", () => {
  const policies: Record<string, PolicyLayer[]> = {
    "company-1": [createMockPolicyLayer("company_policy", { globalSetting: true })],
    "dept-1": [createMockPolicyLayer("dept_policy", {
      segregationOfDuties: true,
      auditRetentionDays: 3000,
      access_review: true,
      approval_segregation: true,
    })],
  };
  const service = new ComplianceGovernanceService(HIERARCHY, policies, [SOX_FRAMEWORK], [SOX_BINDING]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "member-1",
    action: "test_action",
  });

  assert.strictEqual(result.allowed, true);
  assert.ok("globalSetting" in result.effectivePolicy);
  assert.ok("segregationOfDuties" in result.effectivePolicy);
});

test("ComplianceGovernanceService.evaluate generates audit record", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "team-1",
    action: "test_action",
    occurredAt: "2024-07-01T12:00:00Z",
  });

  assert.ok(result.auditRecord.recordId.startsWith("audit_"));
  assert.strictEqual(result.auditRecord.action, "test_action");
  assert.strictEqual(result.auditRecord.actorId, "user-1");
  assert.strictEqual(result.auditRecord.orgNodeId, "team-1");
  assert.strictEqual(result.auditRecord.occurredAt, "2024-07-01T12:00:00Z");
});

test("ComplianceGovernanceService.evaluate audit record has correct reason codes when allowed", () => {
  const policies: Record<string, PolicyLayer[]> = {
    "dept-1": [createMockPolicyLayer("full_policy", {
      segregationOfDuties: true,
      auditRetentionDays: 3000,
      access_review: true,
      approval_segregation: true,
    })],
  };
  const service = new ComplianceGovernanceService(HIERARCHY, policies, [SOX_FRAMEWORK], [SOX_BINDING]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "financial_access",
  });

  assert.strictEqual(result.auditRecord.allowed, true);
  assert.deepStrictEqual(result.auditRecord.reasonCodes, ["compliance.policy_resolved"]);
});

test("ComplianceGovernanceService.evaluate audit record has correct reason codes when denied", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "team-1",
    action: "restricted_action",
    requiredPolicyKeys: ["missing_key"],
  });

  assert.strictEqual(result.auditRecord.allowed, false);
  assert.ok(result.auditRecord.reasonCodes.some(r => r.includes("missing_key")));
});

test("ComplianceGovernanceService.evaluate resolves frameworks through lineage", () => {
  const bindingAtDivision: DepartmentComplianceBinding = {
    bindingId: "binding-div",
    orgNodeId: "division-1",
    frameworkIds: ["sox"],
    attachedAt: "2024-01-01T00:00:00Z",
    attachedBy: "admin",
  };

  const service = new ComplianceGovernanceService(HIERARCHY, {}, DEFAULT_COMPLIANCE_FRAMEWORKS, [bindingAtDivision]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "member-1",
    action: "test_action",
  });

  assert.ok(result.applicableFrameworks.some(f => f.frameworkId === "sox"), "should inherit framework from division");
});

test("ComplianceGovernanceService.evaluate handles boolean merge in policy inheritance", () => {
  const policies: Record<string, PolicyLayer[]> = {
    "division-1": [createMockPolicyLayer("div_policy", { segregationOfDuties: false })],
    "dept-1": [createMockPolicyLayer("dept_policy", { segregationOfDuties: true })],
  };
  const service = new ComplianceGovernanceService(HIERARCHY, policies, [SOX_FRAMEWORK], [SOX_BINDING]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "test_action",
  });

  // Boolean merge uses OR, so true || false = true
  assert.strictEqual(result.effectivePolicy["segregationOfDuties"], true);
});

test("ComplianceGovernanceService.evaluate handles number merge in policy inheritance", () => {
  const policies: Record<string, PolicyLayer[]> = {
    "division-1": [createMockPolicyLayer("div_policy", { auditRetentionDays: 1000 })],
    "dept-1": [createMockPolicyLayer("dept_policy", { auditRetentionDays: 3000 })],
  };
  const service = new ComplianceGovernanceService(HIERARCHY, policies, [SOX_FRAMEWORK], []);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "test_action",
  });

  // Number merge uses max, so max(1000, 3000) = 3000
  assert.strictEqual(result.effectivePolicy["auditRetentionDays"], 3000);
});

test("ComplianceGovernanceService.evaluate handles string merge in policy inheritance", () => {
  const hipaaFramework: ComplianceFramework = {
    frameworkId: "hipaa_custom",
    displayName: "HIPAA Custom",
    controlIds: [],
    minimumPolicies: { dataClassification: "restricted" },
  };
  const binding: DepartmentComplianceBinding = {
    bindingId: "binding-hipaa",
    orgNodeId: "dept-1",
    frameworkIds: ["hipaa_custom"],
    attachedAt: "2024-01-01T00:00:00Z",
    attachedBy: "admin",
  };

  const policies: Record<string, PolicyLayer[]> = {
    "division-1": [createMockPolicyLayer("div_policy", { dataClassification: "public" })],
    "dept-1": [createMockPolicyLayer("dept_policy", { dataClassification: "restricted" })],
  };
  const service = new ComplianceGovernanceService(HIERARCHY, policies, [hipaaFramework], [binding]);

  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "test_action",
  });

  // String merge: if either is "restricted", result is "restricted"
  assert.strictEqual(result.effectivePolicy["dataClassification"], "restricted");
});

test("ComplianceGovernanceService.listFrameworks returns all registered frameworks", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {}, [SOX_FRAMEWORK]);
  service.registerFramework({ frameworkId: "extra", displayName: "Extra", controlIds: [], minimumPolicies: {} });

  const frameworks = service.listFrameworks();
  assert.strictEqual(frameworks.length, 2);
  assert.ok(frameworks.some(f => f.frameworkId === "custom_sox"));
  assert.ok(frameworks.some(f => f.frameworkId === "extra"));
});

test("ComplianceGovernanceService handles node without bindings", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "member-1",
    action: "test_action",
  });

  assert.deepStrictEqual(result.applicableFrameworks, []);
  assert.strictEqual(result.allowed, true);
});

test("ComplianceGovernanceService handles empty policy layers", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {}, [SOX_FRAMEWORK], []);
  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "test_action",
  });

  assert.strictEqual(result.allowed, true);
  assert.deepStrictEqual(result.effectivePolicy, {});
});

test("ComplianceGovernanceService evaluate with multiple required keys missing", () => {
  const service = new ComplianceGovernanceService(HIERARCHY, {});
  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "team-1",
    action: "restricted_action",
    requiredPolicyKeys: ["key1", "key2", "key3"],
  });

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.missingKeys.length, 3);
  assert.ok(result.missingKeys.includes("key1"));
  assert.ok(result.missingKeys.includes("key2"));
  assert.ok(result.missingKeys.includes("key3"));
});

test("ComplianceGovernanceService evaluate deduplicates missing controls", () => {
  const duplicateFramework: ComplianceFramework = {
    frameworkId: "dup_framework",
    displayName: "Duplicate Framework",
    controlIds: ["shared_control"],
    minimumPolicies: { shared_policy: true },
  };
  const binding: DepartmentComplianceBinding = {
    bindingId: "binding-dup",
    orgNodeId: "dept-1",
    frameworkIds: ["dup_framework"],
    attachedAt: "2024-01-01T00:00:00Z",
    attachedBy: "admin",
  };

  const service = new ComplianceGovernanceService(HIERARCHY, {}, [duplicateFramework], [binding]);
  const result = service.evaluate({
    actorId: "user-1",
    orgNodeId: "dept-1",
    action: "test_action",
  });

  // Should deduplicate shared_control and shared_policy
  assert.ok(result.missingControls.length <= 2);
});

test("inheritPolicyLayers merges multiple policy layers", () => {
  const layers: PolicyLayer[] = [
    createMockPolicyLayer("layer1", { boolVal: false, numVal: 100 }),
    createMockPolicyLayer("layer2", { boolVal: true, numVal: 200 }),
  ];

  const result = inheritPolicyLayers(layers);
  assert.strictEqual(result["boolVal"], true);
  assert.strictEqual(result["numVal"], 200);
});

test("inheritPolicyLayers returns empty object for empty layers", () => {
  const result = inheritPolicyLayers([]);
  assert.deepStrictEqual(result, {});
});

test("inheritPolicyLayers prefers restricted string over others", () => {
  const layers: PolicyLayer[] = [
    createMockPolicyLayer("layer1", { classification: "public" }),
    createMockPolicyLayer("layer2", { classification: "restricted" }),
  ];

  const result = inheritPolicyLayers(layers);
  assert.strictEqual(result["classification"], "restricted");
});

test("resolveCompliancePolicyForNode builds lineage correctly", () => {
  const policies: Record<string, PolicyLayer[]> = {
    "company-1": [createMockPolicyLayer("company_policy", { companyLevel: true })],
    "dept-1": [createMockPolicyLayer("dept_policy", { deptLevel: true })],
  };

  const result = resolveCompliancePolicyForNode(HIERARCHY, "dept-1", policies);
  assert.ok("companyLevel" in result);
  assert.ok("deptLevel" in result);
});

test("resolveCompliancePolicyForNode returns empty for node without policies", () => {
  const result = resolveCompliancePolicyForNode(HIERARCHY, "member-1", {});
  assert.deepStrictEqual(result, {});
});

test("buildGovernanceAuditRecord creates valid audit record", () => {
  const record = buildGovernanceAuditRecord({
    recordId: "audit_123",
    action: "test_action",
    actorId: "user_456",
    orgNodeId: "node_789",
    allowed: true,
    reasonCodes: ["compliance.policy_resolved"],
    occurredAt: "2024-07-01T12:00:00Z",
  });

  assert.strictEqual(record.recordId, "audit_123");
  assert.strictEqual(record.action, "test_action");
  assert.strictEqual(record.allowed, true);
});

test("buildGovernanceAuditRecord throws on invalid input", () => {
  assert.throws(() => {
    buildGovernanceAuditRecord({
      recordId: "",
      action: "test",
      actorId: "user",
      orgNodeId: "node",
      allowed: true,
      reasonCodes: [],
      occurredAt: "2024-07-01T12:00:00Z",
    });
  });
});
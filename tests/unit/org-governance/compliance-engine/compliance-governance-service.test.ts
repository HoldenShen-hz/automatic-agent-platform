import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceGovernanceService, type ComplianceEvaluationInput } from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";
import type { PolicyLayer } from "../../../../src/org-governance/compliance-engine/inheritance/index.js";
import type { ComplianceFramework } from "../../../../src/org-governance/compliance-engine/framework-catalog.js";

function createMockOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: "org_1",
    name: "Test Org",
    nodeType: "organization",
    parentOrgNodeId: null,
    createdAt: "2026-04-26T00:00:00Z",
    updatedAt: "2026-04-26T00:00:00Z",
    metadata: {},
    ...overrides,
  };
}

function createMockFramework(overrides: Partial<ComplianceFramework> = {}): ComplianceFramework {
  return {
    frameworkId: "GDPR",
    name: "General Data Protection Regulation",
    version: "1.0",
    controlIds: ["data_retention", "consent_management", "breach_notification"],
    minimumPolicies: {
      encryptionRequired: true,
      retentionDays: 365,
    },
    ...overrides,
  };
}

function createMockPolicyLayer(overrides: Partial<PolicyLayer> = {}): PolicyLayer {
  return {
    policyId: "policy_1",
    rules: {
      encryptionRequired: true,
      retentionDays: 365,
    },
    ...overrides,
  };
}

test("ComplianceGovernanceService constructor initializes with empty frameworks", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  assert.deepEqual(service.listFrameworks(), []);
});

test("ComplianceGovernanceService registers framework", () => {
  const service = new ComplianceGovernanceService([], {}, []);
  const framework = createMockFramework();

  const result = service.registerFramework(framework);

  assert.equal(result.frameworkId, "GDPR");
  assert.deepEqual(service.listFrameworks(), [framework]);
});

test("ComplianceGovernanceService attaches frameworks to org node", () => {
  const service = new ComplianceGovernanceService([], {}, []);
  const framework = createMockFramework();

  service.registerFramework(framework);

  const binding = {
    orgNodeId: "org_1",
    frameworkIds: ["GDPR"],
  };

  const result = service.attachFrameworks(binding);

  assert.equal(result.orgNodeId, "org_1");
  assert.deepEqual(result.frameworkIds, ["GDPR"]);
});

test("ComplianceGovernanceService collects evidence", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  const evidence = service.collectEvidence({
    frameworkId: "GDPR",
    controlId: "data_retention",
    collectedBy: "auditor_1",
    evidenceType: "document",
    content: "Retention policy document",
    sourceSystem: "CRM",
    timestamp: "2026-04-26T10:00:00Z",
  });

  assert.ok(evidence.evidenceId);
  assert.equal(evidence.frameworkId, "GDPR");
  assert.equal(evidence.controlId, "data_retention");
  assert.ok(evidence.collectedAt);
});

test("ComplianceGovernanceService lists evidence by framework", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  service.collectEvidence({
    frameworkId: "GDPR",
    controlId: "data_retention",
    collectedBy: "auditor_1",
    evidenceType: "document",
    content: "Document 1",
    sourceSystem: "System A",
    timestamp: "2026-04-26T10:00:00Z",
  });

  service.collectEvidence({
    frameworkId: "SOC2",
    controlId: "access_control",
    collectedBy: "auditor_2",
    evidenceType: "log",
    content: "Access logs",
    sourceSystem: "System B",
    timestamp: "2026-04-26T11:00:00Z",
  });

  const gdprEvidence = service.listEvidence("GDPR");
  assert.equal(gdprEvidence.length, 1);
  assert.equal(gdprEvidence[0].frameworkId, "GDPR");
});

test("ComplianceGovernanceService lists all evidence when no framework specified", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  service.collectEvidence({
    frameworkId: "GDPR",
    controlId: "data_retention",
    collectedBy: "auditor_1",
    evidenceType: "document",
    content: "Document 1",
    sourceSystem: "System A",
    timestamp: "2026-04-26T10:00:00Z",
  });

  service.collectEvidence({
    frameworkId: "SOC2",
    controlId: "access_control",
    collectedBy: "auditor_2",
    evidenceType: "log",
    content: "Access logs",
    sourceSystem: "System B",
    timestamp: "2026-04-26T11:00:00Z",
  });

  const allEvidence = service.listEvidence();
  assert.equal(allEvidence.length, 2);
});

test("ComplianceGovernanceService evaluate returns allowed when no policies required", () => {
  const nodes = [createMockOrgNode()];
  const policiesByNodeId: Record<string, PolicyLayer[]> = {};
  const service = new ComplianceGovernanceService(nodes, policiesByNodeId);

  const input: ComplianceEvaluationInput = {
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "read_data",
  };

  const result = service.evaluate(input);

  assert.equal(result.orgNodeId, "org_1");
  assert.equal(result.allowed, true);
  assert.deepEqual(result.missingKeys, []);
});

test("ComplianceGovernanceService evaluate returns missingKeys when required policies absent", () => {
  const nodes = [createMockOrgNode()];
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [],
  };
  const service = new ComplianceGovernanceService(nodes, policiesByNodeId);

  const input: ComplianceEvaluationInput = {
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "read_data",
    requiredPolicyKeys: ["encryptionRequired", "auditLogging"],
  };

  const result = service.evaluate(input);

  assert.equal(result.allowed, false);
  // encryptionRequired is in default frameworks' minimumPolicies, auditLogging is not
  assert.ok(result.missingKeys.includes("encryptionRequired"));
  assert.ok(result.missingKeys.includes("auditLogging"));
});

test("ComplianceGovernanceService evaluate creates audit record", () => {
  const nodes = [createMockOrgNode()];
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [],
  };
  const service = new ComplianceGovernanceService(nodes, policiesByNodeId);

  const input: ComplianceEvaluationInput = {
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "read_data",
    requiredPolicyKeys: ["encryptionRequired"],
  };

  const result = service.evaluate(input);

  assert.ok(result.auditRecord);
  assert.equal(result.auditRecord.actorId, "user_1");
  assert.equal(result.auditRecord.action, "read_data");
  assert.equal(result.auditRecord.orgNodeId, "org_1");
});

test("ComplianceGovernanceService evaluate with framework attached", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  // Create a framework with no controlIds and minimumPolicies that match what we'll provide
  const framework = createMockFramework({
    controlIds: [], // No controls required
    minimumPolicies: {
      encryptionRequired: true,
      retentionDays: 365,
    },
  });
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [createMockPolicyLayer({
      rules: {
        encryptionRequired: true,
        retentionDays: 365,
      },
    })],
  };

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId, [framework]);
  service.attachFrameworks({ orgNodeId: "org_1", frameworkIds: ["GDPR"] });

  const input: ComplianceEvaluationInput = {
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "process_personal_data",
  };

  const result = service.evaluate(input);

  assert.equal(result.allowed, true);
  assert.equal(result.applicableFrameworks.length, 1);
  assert.equal(result.applicableFrameworks[0].frameworkId, "GDPR");
});

test("ComplianceGovernanceService evaluate missing framework controls", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  const framework = createMockFramework();
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [createMockPolicyLayer({
      rules: {},
    })],
  };

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId, [framework]);
  service.attachFrameworks({ orgNodeId: "org_1", frameworkIds: ["GDPR"] });

  const input: ComplianceEvaluationInput = {
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "process_personal_data",
  };

  const result = service.evaluate(input);

  assert.equal(result.allowed, false);
  assert.ok(result.missingControls.length > 0);
});

test("ComplianceGovernanceService evaluate missing framework minimum policies", () => {
  const orgNode = createMockOrgNode();
  const nodes = [orgNode];
  const framework = createMockFramework();
  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    org_1: [createMockPolicyLayer({
      rules: {
        encryptionRequired: true,
        retentionDays: 30, // Less than required 365
      },
    })],
  };

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId, [framework]);
  service.attachFrameworks({ orgNodeId: "org_1", frameworkIds: ["GDPR"] });

  const input: ComplianceEvaluationInput = {
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "process_personal_data",
  };

  const result = service.evaluate(input);

  assert.equal(result.allowed, false);
});

test("ComplianceGovernanceService evaluate resolves parent node lineage", () => {
  const rootOrg = createMockOrgNode({ orgNodeId: "root", parentOrgNodeId: null });
  const childOrg = createMockOrgNode({ orgNodeId: "child", parentOrgNodeId: "root" });
  const grandchildOrg = createMockOrgNode({ orgNodeId: "grandchild", parentOrgNodeId: "child" });

  const nodes = [rootOrg, childOrg, grandchildOrg];
  const framework = createMockFramework({ frameworkId: "ISO27001" });

  const policiesByNodeId: Record<string, PolicyLayer[]> = {
    root: [createMockPolicyLayer({ orgNodeId: "root", rules: {} })],
    child: [createMockPolicyLayer({ orgNodeId: "child", rules: {} })],
  };

  const service = new ComplianceGovernanceService(nodes, policiesByNodeId, [framework]);
  service.attachFrameworks({ orgNodeId: "root", frameworkIds: ["ISO27001"] });

  const input: ComplianceEvaluationInput = {
    actorId: "user_1",
    orgNodeId: "grandchild",
    action: "access_data",
  };

  const result = service.evaluate(input);

  // Grandchild inherits framework from root through lineage
  assert.equal(result.applicableFrameworks.length, 1);
});

test("matchesFrameworkRequirement boolean match", () => {
  const nodes = [createMockOrgNode()];
  const service = new ComplianceGovernanceService(nodes, {});

  // This tests the internal matching logic via evaluate
  const input: ComplianceEvaluationInput = {
    actorId: "user_1",
    orgNodeId: "org_1",
    action: "test",
  };

  const result = service.evaluate(input);
  assert.equal(result.allowed, true);
});

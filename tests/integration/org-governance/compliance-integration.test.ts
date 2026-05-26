/**
 * Integration Test: Compliance Governance and Knowledge Boundary
 *
 * Tests integration between compliance evaluation, knowledge boundaries,
 * and policy resolution.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceGovernanceService } from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { KnowledgeBoundaryService } from "../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";
import type { ComplianceEvaluationInput } from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { nowIso, newId } from "../../../src/platform/contracts/types/ids.js";

function createOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: "org_test",
    name: "Test Org",
    nodeType: "department",
    parentOrgNodeId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    metadata: {},
    ...overrides,
  };
}

test("integration: ComplianceGovernanceService and KnowledgeBoundaryService compose for data access", () => {
  const compliance = new ComplianceGovernanceService(
    [
      createOrgNode({ orgNodeId: "finance_dept", nodeType: "department" }),
      createOrgNode({ orgNodeId: "engineering", nodeType: "department", parentOrgNodeId: "finance_dept" }),
    ],
    {
      finance_dept: [{ policyId: "p_finance", rules: { approvalRequired: true } }],
    },
  );

  const knowledge = new KnowledgeBoundaryService();

  // Check compliance
  const complianceResult = compliance.evaluate({
    actorId: "user_1",
    orgNodeId: "finance_dept",
    action: "data.access",
    requiredPolicyKeys: ["approvalRequired"],
  });

  // Check knowledge boundary - engineering is not allowed since boundary is private
  const boundary = {
    boundaryId: "kb_finance_reports",
    ownerOrgNodeId: "finance_dept",
    namespaceIds: ["finance_reports"],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  const knowledgeResult = knowledge.evaluateAccess(
    boundary,
    "user_1",
    "engineering",
    "accessing financial reports",
    [],
  );

  assert.equal(complianceResult.allowed, true);
  assert.equal(knowledgeResult.allowed, false); // Not owner or in allowed list
});

test("integration: ComplianceGovernanceService resolves policies across org hierarchy", () => {
  const orgNodes = [
    createOrgNode({ orgNodeId: "root", nodeType: "company" }),
    createOrgNode({ orgNodeId: "division_a", nodeType: "division", parentOrgNodeId: "root" }),
    createOrgNode({ orgNodeId: "dept_a1", nodeType: "department", parentOrgNodeId: "division_a" }),
    createOrgNode({ orgNodeId: "team_a1", nodeType: "team", parentOrgNodeId: "dept_a1" }),
  ];

  const compliance = new ComplianceGovernanceService(orgNodes, {
    root: [{ policyId: "p_root", rules: { globalRule: true } }],
    division_a: [{ policyId: "p_division", rules: { divisionRule: true } }],
  });

  // Team should inherit policies from parent nodes
  const result = compliance.evaluate({
    actorId: "user_1",
    orgNodeId: "team_a1",
    action: "test.action",
  });

  assert.equal(result.allowed, true);
});

test("integration: KnowledgeBoundaryService evaluates access with Chinese Wall policy", () => {
  const knowledge = new KnowledgeBoundaryService();

  const boundary = {
    boundaryId: "kb_legal",
    ownerOrgNodeId: "legal_dept",
    namespaceIds: ["legal_docs"],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  const chineseWallPolicy = {
    policyId: "cw_legal",
    conflictGroups: {
      legal_conflicts: ["legal_dept", "compliance_dept"],
    },
  };

  const result = knowledge.evaluateAccess(
    boundary,
    "user_1",
    "compliance_dept",
    "legal review",
    [],
    chineseWallPolicy,
  );

  assert.equal(result.allowed, false);
  assert.ok(result.violationCodes !== undefined);
  assert.ok(result.violationCodes!.length > 0);
});

test("integration: DelegatedGovernanceService checkOperation validates role permissions", () => {
  const delegated = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "platform_team",
      granteeId: "division_admin",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_approvals", "manage_agents"],
      guardrails: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  const result = delegated.checkOperation(
    {
      actorId: "div_admin_1",
      actorRole: "division_admin",
      orgNodeId: "dept_1",
      domainId: "ops",
    },
    "create_trigger",
    5000,
  );

  assert.equal(result.allowed, true);
});

test("integration: DelegatedGovernanceService validateInheritanceRule", () => {
  const delegated = new DelegatedGovernanceService([]);

  // Child (higher privilege) cannot loosen restrictions set by parent (lower privilege)
  const loosenChild = delegated.validateInheritanceRule("team_lead", "division_admin", "loosen");
  assert.equal(loosenChild.allowed, false);

  // Parent (lower privilege) cannot loosen restrictions set by child (higher privilege)
  const loosenParent = delegated.validateInheritanceRule("division_admin", "team_lead", "loosen");
  assert.equal(loosenParent.allowed, false);

  // Child (higher privilege) cannot tighten (reserved for parent)
  const tightenChild = delegated.validateInheritanceRule("team_lead", "division_admin", "tighten");
  assert.equal(tightenChild.allowed, false);

  // Parent (lower privilege) can tighten for child (higher privilege)
  const tightenParent = delegated.validateInheritanceRule("division_admin", "team_lead", "tighten");
  assert.equal(tightenParent.allowed, true);

  // Lower privilege role cannot append constraints reserved for higher privilege role
  const appendLower = delegated.validateInheritanceRule("team_lead", "division_admin", "append");
  assert.equal(appendLower.allowed, false);

  // Same role can append
  const appendSame = delegated.validateInheritanceRule("division_admin", "division_admin", "append");
  assert.equal(appendSame.allowed, true);
});

test("integration: ComplianceGovernanceService attaches and resolves frameworks", () => {
  const compliance = new ComplianceGovernanceService(
    [createOrgNode({ orgNodeId: "org_1" })],
    { org_1: [] },
  );

  compliance.registerFramework({
    frameworkId: "GDPR",
    name: "General Data Protection Regulation",
    version: "1.0",
    controlIds: ["data_retention", "consent_management"],
    minimumPolicies: {
      encryptionRequired: true,
      retentionDays: 365,
    },
  });

  compliance.attachFrameworks({
    orgNodeId: "org_1",
    frameworkIds: ["GDPR"],
  });

  const frameworks = compliance.listFrameworks();
  assert.ok(frameworks.some(f => f.frameworkId === "GDPR"), "GDPR framework should be registered");
});

test("integration: ComplianceGovernanceService collects evidence", () => {
  const compliance = new ComplianceGovernanceService([], {});

  const evidence = compliance.collectEvidence({
    frameworkId: "SOC2",
    controlId: "access_control",
    collectedBy: "auditor_1",
    evidenceType: "log",
    content: "Access logs for Q1 2026",
    sourceSystem: "IAM",
    timestamp: nowIso(),
  });

  assert.ok(evidence.evidenceId.length > 0);
  assert.equal(evidence.frameworkId, "SOC2");
  assert.equal(evidence.controlId, "access_control");
});

test("integration: KnowledgeBoundaryService traceBoundaryAccess", () => {
  const knowledge = new KnowledgeBoundaryService();

  const boundary = {
    boundaryId: "kb_trace_test",
    ownerOrgNodeId: "finance",
    namespaceIds: ["reports"],
    defaultVisibility: "public",
    allowedOrgNodeIds: [],
  };

  // Make multiple access requests
  knowledge.evaluateAccess(boundary, "user_1", "engineering", "report review", []);
  knowledge.evaluateAccess(boundary, "user_2", "marketing", "report review", []);
  knowledge.evaluateAccess(boundary, "user_3", "sales", "report review", []);

  const trace = knowledge.traceBoundaryAccess("kb_trace_test");

  assert.equal(trace.length, 3);
});

test("integration: KnowledgeBoundaryService listIsolationViolations", () => {
  const knowledge = new KnowledgeBoundaryService();

  const boundary = {
    boundaryId: "kb_violation_test",
    ownerOrgNodeId: "finance",
    namespaceIds: ["secret_data"],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  const chineseWallPolicy = {
    policyId: "cw_test",
    conflictGroups: {
      conflict_group: ["finance", "legal"],
    },
  };

  // This should be blocked
  knowledge.evaluateAccess(
    boundary,
    "user_blocked",
    "legal",
    "access secret",
    [],
    chineseWallPolicy,
  );

  const violations = knowledge.listIsolationViolations("kb_violation_test");

  assert.ok(violations.length > 0);
  assert.equal(violations[0]!.boundaryId, "kb_violation_test");
});

test("integration: DelegatedGovernanceService getApplicableGuardrails", () => {
  const delegated = new DelegatedGovernanceService([
    {
      delegationId: "del_platform",
      grantorId: "platform_team",
      granteeId: "admin",
      orgNodeIds: [],
      domainIds: [],
      permissions: [],
      guardrails: [
        {
          guardrailId: "platform_guardrail_1",
          type: "max_budget",
          value: 50000,
        },
      ],
      expiresAt: "2027-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  const guardrails = delegated.getApplicableGuardrails("any_org");

  assert.equal(guardrails.length, 1);
  assert.equal(guardrails[0]!.guardrailId, "platform_guardrail_1");
});

test("integration: DelegatedGovernanceService listDelegationsForGrantee", () => {
  const delegated = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "admin_1",
      granteeId: "manager_1",
      orgNodeIds: ["dept_1"],
      domainIds: ["ops"],
      permissions: ["manage_approvals"],
      guardrails: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
    {
      delegationId: "del_2",
      grantorId: "admin_2",
      granteeId: "manager_1",
      orgNodeIds: ["dept_2"],
      domainIds: ["finance"],
      permissions: ["view_audit"],
      guardrails: [],
      expiresAt: "2027-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  const delegations = delegated.listDelegationsForGrantee("manager_1");

  assert.equal(delegations.length, 2);
});

test("integration: ComplianceGovernanceService evaluate with missing required policies", () => {
  const compliance = new ComplianceGovernanceService(
    [createOrgNode({ orgNodeId: "org_missing" })],
    { org_missing: [] },
  );

  const result = compliance.evaluate({
    actorId: "user_1",
    orgNodeId: "org_missing",
    action: "test.action",
    requiredPolicyKeys: ["required_policy_1", "required_policy_2"],
  });

  assert.equal(result.allowed, false);
  assert.equal(result.missingKeys.length, 2);
});

test("integration: KnowledgeBoundaryService dynamic policy evaluation", () => {
  const knowledge = new KnowledgeBoundaryService();

  const boundary = {
    boundaryId: "kb_dynamic_test",
    ownerOrgNodeId: "dept_a",
    namespaceIds: ["data"],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };

  const dynamicPolicy = {
    policyId: "dynamic_block",
    blockedRequesterIds: ["blocked_user"],
    deniedPurposes: ["unauthorized_access"],
  };

  // Blocked user should be denied
  const blockedResult = knowledge.evaluateDynamicAccess({
    boundary,
    requesterId: "blocked_user",
    requesterOrgNodeId: "dept_b",
    purpose: "accessing data",
    grants: [],
    dynamicPolicy,
  });

  assert.equal(blockedResult.allowed, false);

  // Non-blocked user should be allowed (boundary allows owner)
  const allowedResult = knowledge.evaluateDynamicAccess({
    boundary,
    requesterId: "dept_a_owner",
    requesterOrgNodeId: "dept_a",
    purpose: "accessing data",
    grants: [],
    dynamicPolicy,
  });

  assert.equal(allowedResult.allowed, true);
});

test("integration: ComplianceGovernanceService audit record creation", () => {
  const compliance = new ComplianceGovernanceService([], {});

  const input: ComplianceEvaluationInput = {
    actorId: "auditor_1",
    orgNodeId: "org_audit",
    action: "compliance.audit",
    occurredAt: nowIso(),
  };

  const result = compliance.evaluate(input);

  assert.ok(result.auditRecord.recordId.length > 0);
  assert.equal(result.auditRecord.actorId, "auditor_1");
  assert.equal(result.auditRecord.action, "compliance.audit");
});

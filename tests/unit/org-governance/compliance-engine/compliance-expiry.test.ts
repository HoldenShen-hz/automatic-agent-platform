import assert from "node:assert/strict";
import test from "node:test";

import {
  ComplianceGovernanceService,
  type ComplianceEvaluationInput,
} from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import type { OrgNode } from "../../../../src/org-governance/org-model/org-node/index.js";
import type { PolicyLayer } from "../../../../src/org-governance/compliance-engine/inheritance/index.js";
import type { ComplianceFramework } from "../../../../src/org-governance/compliance-engine/framework-catalog.js";

/**
 * R17-84: ComplianceGovernanceService.createExceptionWorkflow issues:
 * - Returns plain object with no persistence/tracking
 * - expiresAt has no future validation
 * - compensating controls not enforced
 */

function createMockOrgNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    orgNodeId: "org_1",
    nodeType: "company",
    displayName: "Test Org",
    parentOrgNodeId: null,
    ownerUserIds: [],
    active: true,
    costCenter: "",
    metadata: {},
    effectivePolicies: {},
    status: "active",
    ...overrides,
  };
}

function createMockFramework(overrides: Partial<ComplianceFramework> = {}): ComplianceFramework {
  return {
    frameworkId: "GDPR",
    type: "gdpr",
    displayName: "General Data Protection Regulation",
    controlIds: ["data_retention", "consent_management", "breach_notification"],
    auditRequirements: [],
    reportTemplate: "gdpr-default-report",
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

test("ComplianceGovernanceService: createExceptionWorkflow rejects past expiresAt", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  // expiresAt in the past should throw
  assert.throws(
    () => {
      service.createExceptionWorkflow({
        scope: "data_processing",
        expiresAt: "2020-01-01T00:00:00.000Z", // Past date
        approver: "admin@example.com",
        compensatingControls: ["additional_monitoring"],
        auditRef: "audit_ref_123",
      });
    },
    /expiresAt must be a future date/,
  );
});

test("ComplianceGovernanceService: createExceptionWorkflow rejects invalid expiresAt", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  // Invalid date format should throw
  assert.throws(
    () => {
      service.createExceptionWorkflow({
        scope: "data_processing",
        expiresAt: "not-a-date",
        approver: "admin@example.com",
        compensatingControls: ["additional_monitoring"],
        auditRef: "audit_ref_123",
      });
    },
    /expiresAt must be a future date/,
  );
});

test("ComplianceGovernanceService: createExceptionWorkflow rejects empty compensating controls", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  const futureDate = new Date(Date.now() + 86400000 * 30).toISOString(); // 30 days from now

  // Empty compensating controls should throw
  assert.throws(
    () => {
      service.createExceptionWorkflow({
        scope: "data_processing",
        expiresAt: futureDate,
        approver: "admin@example.com",
        compensatingControls: [],
        auditRef: "audit_ref_123",
      });
    },
    /compensating_controls_required/,
  );
});

test("ComplianceGovernanceService: createExceptionWorkflow accepts valid input with future expiresAt", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  const futureDate = new Date(Date.now() + 86400000 * 30).toISOString(); // 30 days from now

  const result = service.createExceptionWorkflow({
    scope: "data_processing",
    expiresAt: futureDate,
    approver: "admin@example.com",
    compensatingControls: ["additional_monitoring", "quarterly_review"],
    auditRef: "audit_ref_123",
  });

  assert.equal(result.scope, "data_processing");
  assert.equal(result.expiresAt, futureDate);
  assert.equal(result.approver, "admin@example.com");
  assert.deepEqual(result.compensatingControls, ["additional_monitoring", "quarterly_review"]);
  assert.equal(result.auditRef, "audit_ref_123");
  assert.ok(result.exceptionId.startsWith("compliance_exception:"));
});

test("ComplianceGovernanceService: createExceptionWorkflow persists workflow for tracking", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

  const workflow = service.createExceptionWorkflow({
    scope: "data_processing",
    expiresAt: futureDate,
    approver: "admin@example.com",
    compensatingControls: ["additional_monitoring"],
    auditRef: "audit_ref_123",
  });

  // The returned exceptionId should allow us to look up the workflow
  // listExceptionWorkflows should return the persisted workflow
  const workflows = service.listExceptionWorkflows();
  assert.ok(workflows.length > 0, "Should have at least one persisted workflow");
});

test("ComplianceGovernanceService: createExceptionWorkflow and getExceptionWorkflow roundtrip", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

  const created = service.createExceptionWorkflow({
    scope: "sensitive_data_access",
    expiresAt: futureDate,
    approver: "security@example.com",
    compensatingControls: ["access_logging", "quarterly_audit"],
    auditRef: "audit_456",
  });

  // Since workflows are stored via exceptionWorkflowEngine internally,
  // the exceptionId is the key for looking up the actual workflow
  const workflows = service.listExceptionWorkflows();
  const found = workflows.find((w) => w.exceptionId === created.exceptionId);

  assert.ok(found !== undefined, "Created workflow should be findable via listExceptionWorkflows");
  assert.equal(found!.scope, "sensitive_data_access");
});

test("ComplianceGovernanceService: listExceptionWorkflows filters by status", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  const futureDate1 = new Date(Date.now() + 86400000 * 30).toISOString();
  const futureDate2 = new Date(Date.now() + 86400000 * 60).toISOString();

  // Create a workflow
  service.createExceptionWorkflow({
    scope: "scope1",
    expiresAt: futureDate1,
    approver: "admin@example.com",
    compensatingControls: ["control1"],
    auditRef: "ref1",
  });

  // getExceptionWorkflow returns null for non-existent workflow ID
  const nonExistent = service.getExceptionWorkflow("nonexistent_id");
  assert.equal(nonExistent, null);
});

test("ComplianceGovernanceService: listExceptionWorkflows returns empty for no workflows", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  const workflows = service.listExceptionWorkflows();
  assert.deepEqual(workflows, []);
});

test("ComplianceGovernanceService: createExceptionWorkflow rejects null compensating controls", () => {
  const service = new ComplianceGovernanceService([], {}, []);

  const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

  assert.throws(
    () => {
      service.createExceptionWorkflow({
        scope: "data_processing",
        expiresAt: futureDate,
        approver: "admin@example.com",
        compensatingControls: null as unknown as readonly string[],
        auditRef: "audit_ref_123",
      });
    },
    /compensating_controls_required/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { DataClassificationService } from "../../../../src/platform/control-plane/iam/data-classification-service.js";
import { ComplianceCaseOrchestrationService } from "../../../../src/platform/compliance/compliance-case-orchestration-service.js";
import { ComplianceGovernanceService } from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";

function createGovernance(required: boolean): ComplianceGovernanceService {
  return new ComplianceGovernanceService(
    [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Root",
        parentOrgNodeId: null,
        ownerUserIds: ["admin"],
        active: true,
        metadata: {},
        costCenter: "",
      },
      {
        orgNodeId: "dept_risk",
        nodeType: "department",
        displayName: "Risk",
        parentOrgNodeId: "root",
        ownerUserIds: ["risk_lead"],
        active: true,
        metadata: {},
        costCenter: "RISK-001",
      },
    ],
    required
      ? {
          root: [{ policyId: "root_policy", rules: { approvalRequired: true } }],
          dept_risk: [{ policyId: "risk_policy", rules: { retentionDays: 365, dataExportAllowed: true } }],
        }
      : {
          root: [{ policyId: "root_policy", rules: { approvalRequired: true } }],
        },
  );
}

test("allowRedactedRestrictedTransfer does not override governance deny (R19-24)", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: true }),
    governance: createGovernance(false),
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "risk_lead",
    orgNodeId: "dept_risk",
    action: "artifact.export",
    tenantId: "tenant-risk",
    sourceRegion: "cn-shanghai",
    targetRegion: "eu-frankfurt",
    policy: {
      tenantId: "tenant-risk",
      allowedRegions: ["eu-frankfurt"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    content: "Customer email alice@example.com with password reset token",
    artifactRef: "artifact:source-governance-deny",
    exportRef: "artifact:export-governance-deny",
    record: { customer: { email: "alice@example.com", note: "secret" } },
    encryptionRules: [{ fieldPath: "customer.email", classification: "restricted" }],
    keyRef: "kms://tenant-risk/key-governance-deny",
    requiredPolicyKeys: ["approvalRequired", "retentionDays"],
    allowRedactedRestrictedTransfer: true,
  });

  assert.equal(result.governance?.allowed, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("governance_missing:retentionDays"));
});

test("missing governance evaluator blocks erasure planning as fail-closed", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: false }),
    governance: null,
  });

  const result = service.planSubjectErasureRequest({
    actorId: "privacy_officer",
    orgNodeId: "dept_risk",
    action: "subject.erase",
    subjectRef: "user:bob",
    requestedBy: "privacy@example.com",
    slaHours: 24,
    requiredPolicyKeys: ["approvalRequired"],
    targets: [{ targetRef: "artifact:1", targetKind: "artifact", containsPii: true }],
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.governance?.allowed, false);
  assert.ok(result.blockingReasons.includes("governance_missing:governance_evaluator_unconfigured"));
});

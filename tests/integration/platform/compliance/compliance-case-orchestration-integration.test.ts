import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceGovernanceService } from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { DataClassificationService } from "../../../../src/platform/control-plane/iam/data-classification-service.js";
import { ComplianceCaseOrchestrationService } from "../../../../src/platform/compliance/compliance-case-orchestration-service.js";

test("integration: compliance orchestration aligns export control and subject erasure across governance and lineage", () => {
  const governance = new ComplianceGovernanceService(
    [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Root",
        parentOrgNodeId: null,
        ownerUserIds: ["ceo"],
        active: true,
        metadata: {},
        costCenter: "",
      },
      {
        orgNodeId: "dept_privacy",
        nodeType: "department",
        displayName: "Privacy",
        parentOrgNodeId: "root",
        ownerUserIds: ["privacy_lead"],
        active: true,
        metadata: {},
        costCenter: "PRIV-001",
      },
    ],
    {
      root: [{ policyId: "root_policy", rules: { approvalRequired: true } }],
      dept_privacy: [{ policyId: "privacy_policy", rules: { retentionDays: 90, residencyReview: true } }],
    },
  );
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: true }),
    governance,
  });

  const transfer = service.prepareCrossRegionArtifactTransfer({
    actorId: "privacy_lead",
    orgNodeId: "dept_privacy",
    action: "tenant.export",
    tenantId: "tenant-a",
    sourceRegion: "cn-shanghai",
    targetRegion: "cn-beijing",
    policy: {
      tenantId: "tenant-a",
      allowedRegions: ["cn-beijing"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    content: "employee alice@example.com needs case review",
    artifactRef: "artifact:privacy-1",
    exportRef: "artifact:privacy-export-1",
    record: { payload: { email: "alice@example.com" } },
    encryptionRules: [{ fieldPath: "payload.email", classification: "restricted" }],
    keyRef: "kms://tenant-a/key-privacy",
    requiredPolicyKeys: ["approvalRequired", "retentionDays"],
    allowRedactedRestrictedTransfer: true,
  });

  const erasure = service.planSubjectErasureRequest({
    actorId: "privacy_lead",
    orgNodeId: "dept_privacy",
    action: "tenant.erase_subject",
    subjectRef: "user:alice",
    requestedBy: "privacy@example.com",
    slaHours: 12,
    requiredPolicyKeys: ["approvalRequired"],
    targets: [
      { targetRef: "artifact:privacy-export-1", targetKind: "artifact", containsPii: true },
      { targetRef: "backup:privacy-1", targetKind: "backup", containsPii: true, backupCopy: true },
    ],
  });

  assert.equal(transfer.status, "approved");
  assert.equal(transfer.governance?.allowed, true);
  assert.equal(erasure.status, "ready");
  assert.equal(service.listLineage().length, 5);
});

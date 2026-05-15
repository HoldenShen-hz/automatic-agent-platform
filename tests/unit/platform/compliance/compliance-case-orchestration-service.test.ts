import assert from "node:assert/strict";
import test from "node:test";

import { DataClassificationService } from "../../../../src/platform/five-plane-control-plane/iam/data-classification-service.js";
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

test("ComplianceCaseOrchestrationService approves redacted cross-region transfer with lineage", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: true }),
    governance: createGovernance(true),
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
    artifactRef: "artifact:source-1",
    exportRef: "artifact:export-1",
    record: { customer: { email: "alice@example.com", note: "secret" } },
    encryptionRules: [{ fieldPath: "customer.email", classification: "restricted" }],
    keyRef: "kms://tenant-risk/key-1",
    requiredPolicyKeys: ["approvalRequired", "retentionDays"],
    allowRedactedRestrictedTransfer: true,
  });

  assert.equal(result.status, "approved");
  assert.equal(result.redactionApplied, true);
  assert.equal(result.governance?.allowed, true);
  assert.equal(result.protectedRecord.protectedFields.length, 1);
  assert.equal(result.lineageEdges.length, 3);
  assert.ok(result.exportContent.includes("***@"));
});

test("ComplianceCaseOrchestrationService blocks transfer when governance policy keys are missing", () => {
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
    targetRegion: "cn-beijing",
    policy: {
      tenantId: "tenant-risk",
      allowedRegions: ["cn-beijing"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    content: "Quarterly statement",
    artifactRef: "artifact:source-2",
    exportRef: "artifact:export-2",
    record: { summary: "Quarterly statement" },
    encryptionRules: [],
    keyRef: "kms://tenant-risk/key-2",
    requiredPolicyKeys: ["approvalRequired", "retentionDays"],
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("governance_missing:retentionDays"));
  assert.equal(result.lineageEdges.length, 0);
});

test("ComplianceCaseOrchestrationService plans erasure and records execution lineage", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: true }),
    governance: createGovernance(true),
  });

  const result = service.planSubjectErasureRequest({
    actorId: "privacy_officer",
    orgNodeId: "dept_risk",
    action: "subject.erase",
    subjectRef: "user:alice",
    requestedBy: "privacy@example.com",
    slaHours: 24,
    requiredPolicyKeys: ["approvalRequired"],
    targets: [
      { targetRef: "artifact:1", targetKind: "artifact", containsPii: true },
      { targetRef: "backup:1", targetKind: "backup", containsPii: true, backupCopy: true },
    ],
  });

  assert.equal(result.status, "ready");
  assert.equal(result.plan.steps[0]?.action, "erase");
  assert.equal(result.plan.steps[1]?.action, "redact");
  assert.equal(result.lineageEdges.length, 2);
});

test("ComplianceCaseOrchestrationService handles restricted artifact with summarize action", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: true }),
    governance: createGovernance(true),
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
    content: "This content contains secret key 12345 and highly confidential data",
    artifactRef: "artifact:source-1",
    exportRef: "artifact:export-1",
    record: { data: "secret content" },
    encryptionRules: [],
    keyRef: "kms://tenant-risk/key-1",
  });

  // Content with "secret key" should be classified as restricted
  // For artifact dimension with restricted, action is "summarize"
  // So the status will depend on other factors
  assert.ok(result.artifactDecision);
  assert.equal(result.artifactDecision.action, "summarize");
});

test("ComplianceCaseOrchestrationService with no governance fails closed", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: false }),
    governance: null,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "user:alice",
    orgNodeId: "org:engineering",
    action: "artifact.export",
    tenantId: "tenant-a",
    sourceRegion: "us-east-1",
    targetRegion: "us-west-2",
    policy: {
      tenantId: "tenant-a",
      allowedRegions: ["us-east-1", "us-west-2"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: false,
    },
    content: "public content",
    artifactRef: "artifact:123",
    exportRef: "artifact:456",
    record: { id: 1 },
    encryptionRules: [],
    keyRef: "kms://key-1",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.governance?.allowed, false);
  assert.ok(result.reasons.includes("governance_missing:governance_evaluator_unconfigured"));
});

test("ComplianceCaseOrchestrationService planSubjectErasureRequest with governance blocking", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: true }),
    governance: createGovernance(false),
  });

  const result = service.planSubjectErasureRequest({
    actorId: "privacy_officer",
    orgNodeId: "dept_risk",
    action: "subject.erase",
    subjectRef: "user:alice",
    requestedBy: "privacy@example.com",
    slaHours: 24,
    requiredPolicyKeys: ["approvalRequired", "retentionDays"],
    targets: [
      { targetRef: "memory:1", targetKind: "memory", containsPii: true },
    ],
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.blockingReasons.some((r) => r.includes("governance_missing")));
});

test("ComplianceCaseOrchestrationService preserves non-encrypted fields in record", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: false }),
    governance: null,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "user:alice",
    orgNodeId: "org:engineering",
    action: "artifact.export",
    tenantId: "tenant-a",
    sourceRegion: "us-east-1",
    targetRegion: "us-west-2",
    policy: {
      tenantId: "tenant-a",
      allowedRegions: ["us-east-1", "us-west-2"],
      restrictedClassifications: [],
      allowRedactedTransfer: false,
    },
    content: "public content",
    artifactRef: "artifact:123",
    exportRef: "artifact:456",
    record: { id: 1, name: "test", timestamp: 1704067200000 },
    encryptionRules: [],
    keyRef: "kms://key-1",
  });

  const protectedRecord = result.protectedRecord.protectedRecord as Record<string, unknown>;
  assert.strictEqual(protectedRecord.id, 1);
  assert.strictEqual(protectedRecord.timestamp, 1704067200000);
});

test("ComplianceCaseOrchestrationService includes transfer decision in result", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: false }),
    governance: null,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "user:alice",
    orgNodeId: "org:engineering",
    action: "artifact.export",
    tenantId: "tenant-a",
    sourceRegion: "us-east-1",
    targetRegion: "us-west-2",
    policy: {
      tenantId: "tenant-a",
      allowedRegions: ["us-east-1", "us-west-2"],
      restrictedClassifications: [],
      allowRedactedTransfer: false,
    },
    content: "public content",
    artifactRef: "artifact:123",
    exportRef: "artifact:456",
    record: { id: 1 },
    encryptionRules: [],
    keyRef: "kms://key-1",
  });

  assert.ok(result.transferDecision);
  assert.ok(result.artifactDecision);
  assert.equal(result.transferDecision.action, "allow");
});

test("ComplianceCaseOrchestrationService includes PII annotations when detected", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: false, autoDetectPii: true }),
    governance: null,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "user:alice",
    orgNodeId: "org:engineering",
    action: "artifact.export",
    tenantId: "tenant-a",
    sourceRegion: "us-east-1",
    targetRegion: "us-west-2",
    policy: {
      tenantId: "tenant-a",
      allowedRegions: ["us-east-1", "us-west-2"],
      restrictedClassifications: [],
      allowRedactedTransfer: false,
    },
    content: "Contact user at alice@example.com for details",
    artifactRef: "artifact:123",
    exportRef: "artifact:456",
    record: { id: 1 },
    encryptionRules: [],
    keyRef: "kms://key-1",
  });

  assert.ok(result.annotations.length > 0);
  assert.equal(result.annotations[0]?.type, "email");
});

test("ComplianceCaseOrchestrationService handles audit action for confidential artifact", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: true }),
    governance: createGovernance(true),
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
      restrictedClassifications: [],
      allowRedactedTransfer: false,
    },
    content: "confidential proprietary trade secret information",
    artifactRef: "artifact:source-1",
    exportRef: "artifact:export-1",
    record: { data: "test" },
    encryptionRules: [],
    keyRef: "kms://tenant-risk/key-1",
  });

  // Confidential classification leads to audit action on artifact dimension
  // audit action causes redaction
  assert.equal(result.artifactDecision.action, "audit");
  // With audit action and no PII detected, the content is not redacted but kept as-is for audit
  assert.equal(result.exportContent, "confidential proprietary trade secret information");
});

test("ComplianceCaseOrchestrationService exports content unchanged when allowed", () => {
  const service = new ComplianceCaseOrchestrationService({
    classification: new DataClassificationService({ strictMode: false }),
    governance: null,
  });

  const content = "public information here";
  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "user:alice",
    orgNodeId: "org:engineering",
    action: "artifact.export",
    tenantId: "tenant-a",
    sourceRegion: "us-east-1",
    targetRegion: "us-west-2",
    policy: {
      tenantId: "tenant-a",
      allowedRegions: ["us-east-1", "us-west-2"],
      restrictedClassifications: [],
      allowRedactedTransfer: false,
    },
    content,
    artifactRef: "artifact:123",
    exportRef: "artifact:456",
    record: { id: 1 },
    encryptionRules: [],
    keyRef: "kms://key-1",
  });

  assert.equal(result.exportContent, content);
  assert.equal(result.redactionApplied, false);
});

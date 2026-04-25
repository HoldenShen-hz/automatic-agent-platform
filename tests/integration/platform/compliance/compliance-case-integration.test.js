import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceCaseOrchestrationService } from "../../../../src/platform/compliance/compliance-case-orchestration-service.js";
import { DataClassificationService } from "../../../../src/platform/control-plane/iam/data-classification-service.js";
import { DataResidencyPolicyService } from "../../../../src/platform/compliance/data-residency/index.js";
import { FieldEncryptionService } from "../../../../src/platform/compliance/encryption/index.js";
import { ErasurePlanningService } from "../../../../src/platform/compliance/erasure/index.js";
import { DataLineageService } from "../../../../src/platform/compliance/lineage/index.js";
import { ComplianceGovernanceService } from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";

test("ComplianceCaseOrchestrationService prepares cross-region transfer with public content", () => {
  const classification = new DataClassificationService({ autoDetectPii: false });
  const residency = new DataResidencyPolicyService();
  const lineage = new DataLineageService();
  const encryption = new FieldEncryptionService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    residency,
    lineage,
    encryption,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "actor-001",
    orgNodeId: "dept-001",
    action: "artifact:transfer:cross_region",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1", "us-east-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    content: "This is public announcement content",
    artifactRef: "artifact-001",
    exportRef: "export-001",
    record: { title: "Public Document", body: "Announcement text" },
    encryptionRules: [],
    keyRef: "key-ref-001",
  });

  assert.equal(result.status, "approved");
  assert.equal(result.classification.level, "public");
  assert.equal(result.redactionApplied, false);
  assert.equal(result.residency.decision, "allow");
  assert.ok(result.lineageEdges.length > 0);
});

test("ComplianceCaseOrchestrationService applies redaction for confidential cross-region transfer", () => {
  const classification = new DataClassificationService({ autoDetectPii: true });
  const residency = new DataResidencyPolicyService();
  const lineage = new DataLineageService();
  const encryption = new FieldEncryptionService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    residency,
    lineage,
    encryption,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "actor-002",
    orgNodeId: "dept-001",
    action: "artifact:transfer:cross_region",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    content: "This is confidential proprietary information",
    artifactRef: "artifact-002",
    exportRef: "export-002",
    record: { title: "Proprietary Doc", body: "Secret business data" },
    encryptionRules: [],
    keyRef: "key-ref-002",
  });

  assert.equal(result.status, "requires_redaction");
  assert.equal(result.classification.level, "confidential");
  assert.equal(result.residency.decision, "require_redaction");
  assert.equal(result.redactionApplied, false);
});

test("ComplianceCaseOrchestrationService blocks restricted content cross-region transfer", () => {
  const classification = new DataClassificationService({ autoDetectPii: false });
  const residency = new DataResidencyPolicyService();
  const lineage = new DataLineageService();
  const encryption = new FieldEncryptionService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    residency,
    lineage,
    encryption,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "actor-003",
    orgNodeId: "dept-001",
    action: "artifact:transfer:cross_region",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: false,
    },
    content: "This is top secret classified information",
    artifactRef: "artifact-003",
    exportRef: "export-003",
    record: { title: "Classified Doc", body: "Top secret data" },
    encryptionRules: [],
    keyRef: "key-ref-003",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.classification.level, "restricted");
  assert.ok(result.reasons.includes("residency:restricted_data_residency_block"));
});

test("ComplianceCaseOrchestrationService with PII detection and redaction", () => {
  const classification = new DataClassificationService({ autoDetectPii: true });
  const residency = new DataResidencyPolicyService();
  const lineage = new DataLineageService();
  const encryption = new FieldEncryptionService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    residency,
    lineage,
    encryption,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "actor-004",
    orgNodeId: "dept-001",
    action: "artifact:transfer:cross_region",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    content: "User email is john.doe@example.com and phone is +1-555-123-4567",
    artifactRef: "artifact-004",
    exportRef: "export-004",
    record: { title: "User Data", body: "john.doe@example.com" },
    encryptionRules: [],
    keyRef: "key-ref-004",
  });

  assert.ok(result.annotations.length > 0);
  assert.ok(result.annotations.some((a) => a.type === "email"));
  assert.ok(result.annotations.some((a) => a.type === "phone"));
  assert.notEqual(result.exportContent, result.annotations[0]?.redactedForm ?? "");
});

test("ComplianceCaseOrchestrationService plans subject erasure request", () => {
  const classification = new DataClassificationService({ autoDetectPii: false });
  const erasure = new ErasurePlanningService();
  const lineage = new DataLineageService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    erasure,
    lineage,
  });

  const result = service.planSubjectErasureRequest({
    actorId: "actor-005",
    orgNodeId: "dept-001",
    action: "erasure:request:subject",
    subjectRef: "subject-001",
    requestedBy: "admin-001",
    slaHours: 72,
    targets: [
      { targetRef: "task-001", targetKind: "task", containsPii: true },
      { targetRef: "artifact-001", targetKind: "artifact", containsPii: true },
      { targetRef: "memory-001", targetKind: "memory", containsPii: false },
    ],
  });

  assert.equal(result.status, "ready");
  assert.ok(result.plan.steps.length > 0);
  assert.ok(result.plan.steps.some((s) => s.action === "erase"));
  assert.ok(result.lineageEdges.length > 0);
});

test("ComplianceCaseOrchestrationService blocks erasure on legal hold targets", () => {
  const classification = new DataClassificationService({ autoDetectPii: false });
  const erasure = new ErasurePlanningService();
  const lineage = new DataLineageService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    erasure,
    lineage,
  });

  const result = service.planSubjectErasureRequest({
    actorId: "actor-006",
    orgNodeId: "dept-001",
    action: "erasure:request:subject",
    subjectRef: "subject-002",
    requestedBy: "admin-001",
    slaHours: 72,
    targets: [
      { targetRef: "task-002", targetKind: "task", containsPii: true, legalHold: true },
    ],
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.blockingReasons.includes("plan_blocked_by_legal_hold"));
});

test("ComplianceCaseOrchestrationService with field encryption creates lineage edges", () => {
  const classification = new DataClassificationService({ autoDetectPii: false });
  const residency = new DataResidencyPolicyService();
  const lineage = new DataLineageService();
  const encryption = new FieldEncryptionService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    residency,
    lineage,
    encryption,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "actor-007",
    orgNodeId: "dept-001",
    action: "artifact:transfer:cross_region",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "us-west-1",
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-west-1"],
      restrictedClassifications: [],
      allowRedactedTransfer: true,
    },
    content: "Internal document",
    artifactRef: "artifact-007",
    exportRef: "export-007",
    record: { title: "Internal Doc", body: "Sensitive data" },
    encryptionRules: [{ fieldPath: "body", classification: "internal" }],
    keyRef: "key-ref-007",
  });

  assert.ok(result.protectedRecord.protectedFields.length > 0);
  assert.ok(result.lineageEdges.some((e) => e.kind === "encrypted_from"));
  assert.ok(result.lineageEdges.some((e) => e.kind === "released_as"));
});

test("ComplianceCaseOrchestrationService with governance evaluation blocks on missing policies", () => {
  const classification = new DataClassificationService({ autoDetectPii: false });
  const lineage = new DataLineageService();
  const encryption = new FieldEncryptionService();

  // Create governance service with no policies attached
  const governance = new ComplianceGovernanceService([], {});

  const service = new ComplianceCaseOrchestrationService({
    classification,
    governance,
    lineage,
    encryption,
  });

  const result = service.prepareCrossRegionArtifactTransfer({
    actorId: "actor-008",
    orgNodeId: "dept-001",
    action: "artifact:transfer:cross_region",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: [],
      allowRedactedTransfer: true,
    },
    content: "Public content",
    artifactRef: "artifact-008",
    exportRef: "export-008",
    record: { title: "Doc", body: "Data" },
    encryptionRules: [],
    keyRef: "key-ref-008",
    requiredPolicyKeys: ["data_transfer:cross_region"],
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.governance !== null);
  assert.equal(result.governance.allowed, false);
  assert.ok(result.reasons.some((r) => r.includes("governance_missing")));
});

test("ComplianceCaseOrchestrationService listLineage returns all edges when no sourceRef provided", () => {
  const classification = new DataClassificationService({ autoDetectPii: false });
  const residency = new DataResidencyPolicyService();
  const lineage = new DataLineageService();
  const encryption = new FieldEncryptionService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    residency,
    lineage,
    encryption,
  });

  // Create some lineage edges first
  service.prepareCrossRegionArtifactTransfer({
    actorId: "actor-009",
    orgNodeId: "dept-001",
    action: "artifact:transfer:cross_region",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "us-west-1",
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-west-1"],
      restrictedClassifications: [],
      allowRedactedTransfer: true,
    },
    content: "Public content",
    artifactRef: "artifact-009",
    exportRef: "export-009",
    record: { title: "Doc", body: "Data" },
    encryptionRules: [],
    keyRef: "key-ref-009",
  });

  const edges = service.listLineage();

  assert.ok(edges.length > 0);
  assert.ok(Array.isArray(edges));
});

test("ComplianceCaseOrchestrationService listLineage filters edges by sourceRef", () => {
  const classification = new DataClassificationService({ autoDetectPii: false });
  const residency = new DataResidencyPolicyService();
  const lineage = new DataLineageService();
  const encryption = new FieldEncryptionService();

  const service = new ComplianceCaseOrchestrationService({
    classification,
    residency,
    lineage,
    encryption,
  });

  // Create lineage edges for multiple artifacts
  service.prepareCrossRegionArtifactTransfer({
    actorId: "actor-010",
    orgNodeId: "dept-001",
    action: "artifact:transfer:cross_region",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "us-west-1",
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-west-1"],
      restrictedClassifications: [],
      allowRedactedTransfer: true,
    },
    content: "Public content",
    artifactRef: "artifact-specific-010",
    exportRef: "export-010",
    record: { title: "Doc", body: "Data" },
    encryptionRules: [],
    keyRef: "key-ref-010",
  });

  const edges = service.listLineage("artifact-specific-010");

  assert.ok(edges.length > 0);
  assert.ok(edges.every((e) => e.sourceRef === "artifact-specific-010"));
});

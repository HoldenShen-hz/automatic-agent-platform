/**
 * Integration Tests: Compliance
 *
 * NOTE: These tests validate type definitions and API contracts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  ErasureRequest,
  ErasureRequestInput,
  ErasureStatus,
  ErasureReport,
  GenerateErasureReportInput,
  CryptoShreddingVerificationSummary,
  DataEncryptionKey,
  CreateDekInput,
  DataResidencyRule,
  DataPlacement,
  CheckResidencyInput,
  ResidencyCheckResult,
  Jurisdiction,
  DataRegion,
  DataCategory,
  EvidenceMappingRule,
  ComplianceReportRequest,
  Artifact,
  EvidenceRecord,
  AuditAppendCommand,
} from "../../../../src/platform/five-plane-control-plane/compliance/index.js";

// ============================================================================
// Type Validation Tests
// ============================================================================

test("integration: ErasureRequest type structure", () => {
  const request: ErasureRequest = {
    erasureId: "erasure_001",
    tenantId: "tenant_001",
    subjectType: "user",
    subjectId: "user_001",
    status: "pending",
    requestedBy: "privacy_team",
    reason: "GDPR request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_erasure_001",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  };

  assert.equal(request.erasureId, "erasure_001");
  assert.equal(request.status, "pending");
});

test("integration: ErasureStatus union values", () => {
  const statuses: ErasureStatus[] = ["pending", "processing", "completed", "failed", "cancelled"];
  assert.equal(statuses.length, 5);
});

test("integration: ErasureReport type structure", () => {
  const report: ErasureReport = {
    reportId: "report_001",
    erasureId: "erasure_001",
    tenantId: "tenant_001",
    subjects: [
      {
        subjectType: "user",
        subjectId: "user_001",
        dataCategories: ["personal"],
        erased: true,
      },
    ],
    traceId: "trace_erasure_001",
    verificationStatus: "verified",
    verifiedAt: "2026-04-15T00:00:00.000Z",
    generatedAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
    evidenceRefs: [
      {
        evidenceType: "dek_destruction",
        referenceId: "key_001",
        description: "Destroyed tenant key",
        timestamp: "2026-04-15T00:00:00.000Z",
      },
    ],
    notes: null,
    metadataJson: null,
  };

  assert.equal(report.reportId, "report_001");
  assert.equal(report.verificationStatus, "verified");
});

test("integration: CryptoShreddingVerificationSummary type structure", () => {
  const summary: CryptoShreddingVerificationSummary = {
    totalDekDestroyed: 3,
    verifiedDekDestroyed: 3,
    failedDekDestroyed: 0,
    status: "verified",
    messages: ["All DEK versions successfully destroyed"],
  };

  assert.equal(summary.status, "verified");
  assert.ok(summary.verifiedDekDestroyed > 0);
});

test("integration: DataEncryptionKey type structure", () => {
  const dek: DataEncryptionKey = {
    keyId: "key_001",
    tenantId: "tenant_001",
    version: 1,
    status: "active",
    encryptedKeyMaterial: "encrypted_material_here",
    algorithm: "AES-256-GCM",
    externalKeyId: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    destroyedAt: null,
    createdBy: "system",
    destroyedBy: null,
    destructionReason: null,
    traceId: "trace_dek_001",
    metadataJson: null,
  };

  assert.equal(dek.status, "active");
  assert.equal(dek.algorithm, "AES-256-GCM");
});

test("integration: CreateDekInput type structure", () => {
  const input: CreateDekInput = {
    tenantId: "tenant_001",
    encryptedKeyMaterial: "encrypted_material",
    createdBy: "system",
    algorithm: "AES-256-GCM",
  };

  assert.ok(input.tenantId !== undefined);
  assert.ok(input.encryptedKeyMaterial !== undefined);
});

test("integration: DataResidencyRule type structure", () => {
  const rule: DataResidencyRule = {
    jurisdiction: "EU",
    retentionDays: 365,
    encryptionStandard: "AES-256",
    crossBorderTransfersAllowed: false,
    allowedTransferJurisdictions: [],
    dataLocalizationRequired: true,
    metadataJson: null,
  };

  assert.equal(rule.jurisdiction, "EU");
  assert.equal(rule.dataLocalizationRequired, true);
});

test("integration: Jurisdiction union values", () => {
  const jurisdictions: Jurisdiction[] = ["US", "EU", "APAC", "OTHER"];
  assert.equal(jurisdictions.length, 4);
});

test("integration: DataRegion type", () => {
  const regions: DataRegion[] = ["us-east-1", "eu-west-1", "ap-southeast-1"];
  assert.equal(regions.length, 3);
});

test("integration: DataCategory union values", () => {
  const categories: DataCategory[] = ["personal", "financial", "health", "business"];
  assert.equal(categories.length, 4);
});

test("integration: CheckResidencyInput type structure", () => {
  const input: CheckResidencyInput = {
    tenantId: "tenant_001",
    category: "personal",
    currentRegion: "eu-west-1",
  };

  assert.equal(input.tenantId, "tenant_001");
  assert.equal(input.category, "personal");
});

test("integration: ResidencyCheckResult type structure", () => {
  const result: ResidencyCheckResult = {
    isCompliant: true,
    currentRegion: "eu-west-1",
    currentJurisdiction: "EU",
    targetJurisdiction: "EU",
    rule: null,
    violations: [],
  };

  assert.equal(result.isCompliant, true);
  assert.ok(Array.isArray(result.violations));
});

test("integration: DataPlacement type structure", () => {
  const placement: DataPlacement = {
    placementId: "placement_001",
    tenantId: "tenant_001",
    category: "personal",
    currentRegion: "eu-west-1",
    currentJurisdiction: "EU",
    isCompliant: true,
    recordedAt: "2026-04-01T00:00:00.000Z",
    metadataJson: null,
  };

  assert.equal(placement.placementId, "placement_001");
});

test("integration: ComplianceReportRequest type structure", () => {
  const request: ComplianceReportRequest = {
    requestId: "req_001",
    tenantId: "tenant_001",
    frameworkId: "soc2",
    scope: "tenant",
    scopeId: "tenant_001",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    includeArtifacts: true,
    includeEvidence: true,
    requestedBy: "auditor",
    createdAt: "2026-04-15T09:00:00.000Z",
    metadataJson: null,
  };

  assert.equal(request.frameworkId, "soc2");
  assert.equal(request.scope, "tenant");
});

test("integration: EvidenceMappingRule type structure", () => {
  const rule: EvidenceMappingRule = {
    ruleId: "rule_001",
    frameworkId: "soc2",
    controlId: "A1",
    evidenceType: "audit_log",
    mappingExpression: "tenant_id = :tenant",
    artifactPatterns: ["audit/*.json"],
    requiredFields: ["timestamp", "actor"],
    confidenceThreshold: 0.9,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };

  assert.ok(rule.artifactPatterns.length > 0);
  assert.ok(rule.requiredFields.length > 0);
});

test("integration: Artifact type structure", () => {
  const artifact: Artifact = {
    artifactId: "artifact_001",
    artifactType: "audit_event",
    tenantId: "tenant_001",
    taskId: "task_001",
    executionId: "exec_001",
    artifactRef: "/artifacts/audit/001.json",
    contentHash: "abc123",
    sizeBytes: 1024,
    capturedAt: "2026-04-15T12:00:00.000Z",
    retentionDays: 90,
    expiresAt: null,
    metadataJson: null,
  };

  assert.equal(artifact.artifactType, "audit_event");
  assert.ok(artifact.sizeBytes > 0);
});

test("integration: AuditAppendCommand type structure", () => {
  const cmd: AuditAppendCommand = {
    commandId: "cmd_001",
    tenantId: "tenant_001",
    auditEventType: "data.access",
    actorId: "user_001",
    actorType: "user",
    resourceKind: "task",
    resourceId: "task_001",
    action: "read",
    result: "success",
    metadataJson: null,
    traceId: null,
    occurredAt: "2026-04-15T12:00:00.000Z",
    createdAt: "2026-04-15T12:00:00.000Z",
  };

  assert.equal(cmd.actorType, "user");
  assert.equal(cmd.result, "success");
});

test("integration: evidence record validation status", () => {
  const statuses = ["pending", "validated", "failed", "not_applicable"] as const;
  assert.equal(statuses.length, 4);
});

test("integration: compliance report scope types", () => {
  const scopes = ["tenant", "domain", "execution", "task"] as const;
  assert.equal(scopes.length, 4);
});

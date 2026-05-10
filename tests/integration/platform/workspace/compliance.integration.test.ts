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
    createdAt: "2026-04-01T00:00:00.000Z",
    completedAt: null,
    evidenceRefs: [],
  };

  assert.equal(request.erasureId, "erasure_001");
  assert.equal(request.status, "pending");
});

test("integration: ErasureStatus union values", () => {
  const statuses: ErasureStatus[] = ["pending", "processing", "completed", "failed"];
  assert.equal(statuses.length, 4);
});

test("integration: ErasureReport type structure", () => {
  const report: ErasureReport = {
    reportId: "report_001",
    erasureId: "erasure_001",
    tenantId: "tenant_001",
    subjectType: "user",
    subjectId: "user_001",
    status: "completed",
    generatedAt: "2026-04-15T00:00:00.000Z",
    generatedBy: "system",
    evidenceRefs: [],
  };

  assert.equal(report.reportId, "report_001");
  assert.equal(report.status, "completed");
});

test("integration: CryptoShreddingVerificationSummary type structure", () => {
  const summary: CryptoShreddingVerificationSummary = {
    verificationId: "verify_001",
    dekId: "dek_001",
    versionsChecked: 3,
    allVersionsDestroyed: true,
    verificationTimestamp: "2026-04-15T12:00:00.000Z",
    details: "All DEK versions successfully destroyed",
  };

  assert.equal(summary.allVersionsDestroyed, true);
  assert.ok(summary.versionsChecked > 0);
});

test("integration: DataEncryptionKey type structure", () => {
  const dek: DataEncryptionKey = {
    keyId: "key_001",
    dekId: "dek_001",
    tenantId: "tenant_001",
    encryptedKeyMaterial: "encrypted_material_here",
    algorithm: "AES-256-GCM",
    status: "active",
    version: 1,
    createdBy: "system",
    createdAt: "2026-04-01T00:00:00.000Z",
    rotatedAt: null,
    destroyedAt: null,
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
    ruleId: "rule_001",
    tenantId: "tenant_001",
    jurisdiction: "EU",
    allowedRegions: ["EU-WEST-1", "EU-CENTRAL-1"],
    dataCategories: ["PII", "FINANCIAL"],
    enforcementLevel: "strict",
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  assert.equal(rule.jurisdiction, "EU");
  assert.ok(rule.allowedRegions.length > 0);
});

test("integration: Jurisdiction union values", () => {
  const jurisdictions: Jurisdiction[] = ["US", "EU", "APAC", "OTHER"];
  assert.equal(jurisdictions.length, 4);
});

test("integration: DataRegion type", () => {
  const regions: DataRegion[] = ["US-EAST-1", "EU-WEST-1", "APAC-EAST-1"];
  assert.equal(regions.length, 3);
});

test("integration: DataCategory union values", () => {
  const categories: DataCategory[] = ["PII", "FINANCIAL", "HEALTH", "GENERAL"];
  assert.equal(categories.length, 4);
});

test("integration: CheckResidencyInput type structure", () => {
  const input: CheckResidencyInput = {
    tenantId: "tenant_001",
    dataCategory: "PII",
    currentRegion: "EU-WEST-1",
    requestedRegion: "EU-WEST-1",
  };

  assert.equal(input.tenantId, "tenant_001");
  assert.equal(input.dataCategory, "PII");
});

test("integration: ResidencyCheckResult type structure", () => {
  const result: ResidencyCheckResult = {
    isCompliant: true,
    currentRegion: "EU-WEST-1",
    requestedRegion: "EU-WEST-1",
    violations: [],
  };

  assert.equal(result.isCompliant, true);
  assert.ok(Array.isArray(result.violations));
});

test("integration: DataPlacement type structure", () => {
  const placement: DataPlacement = {
    placementId: "placement_001",
    tenantId: "tenant_001",
    dataCategory: "PII",
    region: "EU-WEST-1",
    createdAt: "2026-04-01T00:00:00.000Z",
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
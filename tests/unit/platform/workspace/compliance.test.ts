/**
 * Unit Tests: Compliance Module
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ErasureRequestService,
  type ErasureRequest,
  type ErasureRequestInput,
  type ErasureStatus,
  type ErasureSubjectType,
} from "../../../../src/platform/five-plane-control-plane/compliance/erasure-request-service.js";

import {
  ErasureReportService,
  type ErasureReport,
  type ErasureSubject,
  type GenerateErasureReportInput,
} from "../../../../src/platform/five-plane-control-plane/compliance/erasure-report-service.js";

import {
  DataEncryptionKeyService,
  type DataEncryptionKey,
  type CreateDekInput,
  type DekStatus,
} from "../../../../src/platform/five-plane-control-plane/compliance/data-encryption-key-service.js";

import {
  DataResidencyService,
  type DataResidencyRule,
  type DataPlacement,
  type ResidencyViolation,
  type CheckResidencyInput,
  type DataRegion,
  type Jurisdiction,
} from "../../../../src/platform/five-plane-control-plane/compliance/data-residency-service.js";

import type { ComplianceStore } from "../../../../src/platform/five-plane-control-plane/compliance/types.js";

// Mock event emitter interface
interface MockEventEmitter {
  insertEvent(event: { id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string; taskId?: string | null; executionId?: string | null; eventTier?: string }): void;
}

// ============================================================================
// Mock Store Factory
// ============================================================================

const erasureRequests = new Map<string, ErasureRequest>();
const erasureReports = new Map<string, ErasureReport>();
const dataEncryptionKeys = new Map<string, DataEncryptionKey>();
const dataPlacements = new Map<string, DataPlacement>();
const residencyViolations = new Map<string, ResidencyViolation>();
const events: Array<{ id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }> = [];

function createMockStore(): ComplianceStore {
  return {
    insertErasureRequest: (request: ErasureRequest) => {
      erasureRequests.set(request.erasureId, request);
    },
    getErasureRequest: (erasureId: string): ErasureRequest | null => {
      return erasureRequests.get(erasureId) ?? null;
    },
    updateErasureRequest: (request: ErasureRequest) => {
      erasureRequests.set(request.erasureId, request);
    },
    listErasureRequestsByTenant: (tenantId: string): ErasureRequest[] => {
      return Array.from(erasureRequests.values())
        .filter((r) => r.tenantId === tenantId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    listErasureRequestsByTraceId: (traceId: string): ErasureRequest[] => {
      return Array.from(erasureRequests.values())
        .filter((r) => r.traceId === traceId);
    },
    insertErasureReport: (report: ErasureReport) => {
      erasureReports.set(report.reportId, report);
    },
    getErasureReport: (reportId: string): ErasureReport | null => {
      return erasureReports.get(reportId) ?? null;
    },
    updateErasureReport: (report: ErasureReport) => {
      erasureReports.set(report.reportId, report);
    },
    listErasureReportsByTenant: (tenantId: string): ErasureReport[] => {
      return Array.from(erasureReports.values())
        .filter((r) => r.tenantId === tenantId)
        .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt));
    },
    listErasureReportsByErasureId: (erasureId: string): ErasureReport[] => {
      return Array.from(erasureReports.values())
        .filter((r) => r.erasureId === erasureId);
    },
    insertDataEncryptionKey: (dek: DataEncryptionKey) => {
      dataEncryptionKeys.set(dek.keyId, dek);
    },
    getDataEncryptionKey: (keyId: string): DataEncryptionKey | null => {
      return dataEncryptionKeys.get(keyId) ?? null;
    },
    updateDataEncryptionKey: (dek: DataEncryptionKey) => {
      dataEncryptionKeys.set(dek.keyId, dek);
    },
    getActiveDataEncryptionKey: (tenantId: string): DataEncryptionKey | null => {
      return Array.from(dataEncryptionKeys.values())
        .filter((k) => k.tenantId === tenantId && k.status === "active")
        .sort((a, b) => b.version - a.version)[0] ?? null;
    },
    listDataEncryptionKeysByTenant: (tenantId: string): DataEncryptionKey[] => {
      return Array.from(dataEncryptionKeys.values())
        .filter((k) => k.tenantId === tenantId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    insertDataPlacement: (placement: DataPlacement) => {
      dataPlacements.set(placement.placementId, placement);
    },
    listDataPlacementsByTenant: (tenantId: string): DataPlacement[] => {
      return Array.from(dataPlacements.values())
        .filter((p) => p.tenantId === tenantId);
    },
    insertResidencyViolation: (violation: ResidencyViolation) => {
      residencyViolations.set(violation.violationId, violation);
    },
    updateResidencyViolation: (violation: ResidencyViolation) => {
      residencyViolations.set(violation.violationId, violation);
    },
    listResidencyViolationsByTenant: (tenantId: string): ResidencyViolation[] => {
      return Array.from(residencyViolations.values())
        .filter((v) => v.tenantId === tenantId);
    },
    listAllResidencyViolations: (): ResidencyViolation[] => {
      return Array.from(residencyViolations.values());
    },
  };
}

function createMockEventEmitter(): MockEventEmitter {
  return {
    insertEvent: (event) => {
      events.push(event);
    },
  };
}

// ============================================================================
// Erasure Request Service Tests
// ============================================================================

test("ErasureRequestService creates erasure request", () => {
  const store = createMockStore();
  const eventEmitter = createMockEventEmitter();
  const service = new ErasureRequestService(store as any, eventEmitter as any);

  const input: ErasureRequestInput = {
    tenantId: "tenant_123",
    subjectType: "user",
    subjectId: "user_456",
    requestedBy: "admin",
    reason: "User requested data deletion",
  };

  const request = service.createRequest(input);

  assert.equal(request.tenantId, "tenant_123");
  assert.equal(request.subjectType, "user");
  assert.equal(request.subjectId, "user_456");
  assert.equal(request.status, "pending");
  assert.ok(request.erasureId.length > 0);
  assert.ok(request.createdAt.length > 0);
});

test("ErasureRequestService rejects invalid subject type", () => {
  const store = createMockStore();
  const eventEmitter = createMockEventEmitter();
  const service = new ErasureRequestService(store as any, eventEmitter as any);

  const input: ErasureRequestInput = {
    tenantId: "tenant_123",
    subjectType: "invalid" as ErasureSubjectType,
    subjectId: "user_456",
    requestedBy: "admin",
    reason: "Test",
  };

  assert.throws(
    () => service.createRequest(input),
    /subjectType/,
  );
});

// ============================================================================
// Erasure Report Service Tests
// ============================================================================

test("ErasureReportService generates erasure report", () => {
  const store = createMockStore();
  const eventEmitter = createMockEventEmitter();
  const service = new ErasureRequestService(store as any, eventEmitter as any);

  // First create an erasure request
  const erasureInput: ErasureRequestInput = {
    tenantId: "tenant_123",
    subjectType: "user",
    subjectId: "user_456",
    requestedBy: "admin",
    reason: "User requested data deletion",
  };
  const erasureRequest = service.createRequest(erasureInput);

  const reportService = new ErasureReportService(store as any, eventEmitter as any);
  const input: GenerateErasureReportInput = {
    erasureId: erasureRequest.erasureId,
    subjects: [{ subjectType: "user", subjectId: "user_456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "dek_destruction", referenceId: "key_001", description: "DEK destroyed", timestamp: new Date().toISOString() }],
    traceId: "trace_123",
  };

  const report = reportService.generateReport(input);

  assert.equal(report.tenantId, "tenant_123");
  assert.equal(report.erasureId, erasureRequest.erasureId);
  assert.ok(report.reportId.length > 0);
  assert.ok(report.generatedAt.length > 0);
});

test("ErasureReportService calculates crypto shredding verification", () => {
  const store = createMockStore();
  const eventEmitter = createMockEventEmitter();

  // Create and store a DEK
  const dek: DataEncryptionKey = {
    keyId: "key_123",
    tenantId: "tenant_123",
    version: 1,
    status: "destroyed",
    encryptedKeyMaterial: null,
    algorithm: "AES-256-GCM",
    externalKeyId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    destroyedAt: new Date().toISOString(),
    createdBy: "admin",
    destroyedBy: "system",
    destructionReason: "erasure",
    traceId: null,
    metadataJson: null,
  };
  store.insertDataEncryptionKey(dek);

  // Create erasure request and report
  const erasureService = new ErasureRequestService(store as any, eventEmitter as any);
  const erasureInput: ErasureRequestInput = {
    tenantId: "tenant_123",
    subjectType: "user",
    subjectId: "user_456",
    requestedBy: "admin",
    reason: "User requested data deletion",
  };
  const erasureRequest = erasureService.createRequest(erasureInput);

  const reportService = new ErasureReportService(store as any, eventEmitter as any);
  const reportInput: GenerateErasureReportInput = {
    erasureId: erasureRequest.erasureId,
    subjects: [{ subjectType: "user", subjectId: "user_456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "dek_destruction", referenceId: "key_123", description: "DEK destroyed", timestamp: new Date().toISOString() }],
    traceId: "trace_123",
  };
  const report = reportService.generateReport(reportInput);

  const summary = reportService.verifyCryptoShredding(report.reportId);

  assert.equal(summary.totalDekDestroyed, 1);
  assert.equal(summary.verifiedDekDestroyed, 1);
  assert.equal(summary.status, "verified");
});

// ============================================================================
// Data Encryption Key Service Tests
// ============================================================================

test("DataEncryptionKeyService creates DEK", () => {
  const store = createMockStore();
  const service = new DataEncryptionKeyService(store as any, store);

  const input: CreateDekInput = {
    tenantId: "tenant_123",
    encryptedKeyMaterial: "enc_key_material_abc123",
    createdBy: "admin",
    algorithm: "AES-256-GCM",
  };

  const dek = service.createDek(input);

  assert.equal(dek.tenantId, "tenant_123");
  assert.equal(dek.algorithm, "AES-256-GCM");
  assert.equal(dek.status, "active");
  assert.ok(dek.keyId.length > 0);
});

test("DataEncryptionKeyService rotates DEK", () => {
  const store = createMockStore();
  const service = new DataEncryptionKeyService(store as any, store);

  const input: CreateDekInput = {
    tenantId: "tenant_123",
    encryptedKeyMaterial: "enc_key_material_abc123",
    createdBy: "admin",
  };

  const dek = service.createDek(input);
  const rotated = service.rotateDek({ tenantId: "tenant_123", newEncryptedKeyMaterial: "new_enc_key_material_xyz", rotatedBy: "admin" });

  assert.ok(rotated.keyId !== dek.keyId);
  assert.equal(rotated.status, "active");
});

test("DataEncryptionKeyService destroys DEK", () => {
  const store = createMockStore();
  const service = new DataEncryptionKeyService(store as any, store);

  const input: CreateDekInput = {
    tenantId: "tenant_123",
    encryptedKeyMaterial: "enc_key_material_abc123",
    createdBy: "admin",
  };

  const dek = service.createDek(input);
  const destroyed = service.destroyDek({ keyId: dek.keyId, destroyedBy: "admin", reason: "erasure_request" });

  assert.equal(destroyed.keyId, dek.keyId);
  assert.equal(destroyed.status, "destroyed");
});

// ============================================================================
// Data Residency Service Tests
// ============================================================================

test("DataResidencyService checks residency compliance", () => {
  const store = createMockStore();
  const service = new DataResidencyService(store as any, store);

  const input: CheckResidencyInput = {
    tenantId: "tenant_123",
    category: "personal",
    currentRegion: "eu-west-1",
  };

  const result = service.checkResidency(input);

  assert.equal(result.isCompliant, true);
});

test("DataResidencyService detects residency violation", () => {
  const store = createMockStore();
  const service = new DataResidencyService(store as any, store);

  // EU requires personal data to stay in EU
  const input: CheckResidencyInput = {
    tenantId: "tenant_123",
    category: "personal",
    currentRegion: "us-east-1",
  };

  const result = service.checkResidency(input);

  assert.equal(result.isCompliant, false);
  assert.ok(result.violations.length > 0);
});

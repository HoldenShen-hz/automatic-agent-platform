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
    insertErasureReport: (report: ErasureReport) => {
      erasureReports.set(report.reportId, report);
    },
    getErasureReport: (reportId: string): ErasureReport | null => {
      return erasureReports.get(reportId) ?? null;
    },
    listErasureReportsByTenant: (tenantId: string): ErasureReport[] => {
      return Array.from(erasureReports.values())
        .filter((r) => r.tenantId === tenantId)
        .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt));
    },
    insertDataEncryptionKey: (dek: DataEncryptionKey) => {
      dataEncryptionKeys.set(dek.dekId, dek);
    },
    getDataEncryptionKey: (dekId: string): DataEncryptionKey | null => {
      return dataEncryptionKeys.get(dekId) ?? null;
    },
    updateDataEncryptionKey: (dek: DataEncryptionKey) => {
      dataEncryptionKeys.set(dek.dekId, dek);
    },
    listDataEncryptionKeysByTenant: (tenantId: string): DataEncryptionKey[] => {
      return Array.from(dataEncryptionKeys.values())
        .filter((k) => k.tenantId === tenantId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    insertDataPlacement: (placement: DataPlacement) => {
      dataPlacements.set(placement.placementId, placement);
    },
    getDataPlacement: (placementId: string): DataPlacement | null => {
      return dataPlacements.get(placementId) ?? null;
    },
    updateDataPlacement: (placement: DataPlacement) => {
      dataPlacements.set(placement.placementId, placement);
    },
    listDataPlacementsByTenant: (tenantId: string): DataPlacement[] => {
      return Array.from(dataPlacements.values())
        .filter((p) => p.tenantId === tenantId);
    },
    insertResidencyViolation: (violation: ResidencyViolation) => {
      residencyViolations.set(violation.violationId, violation);
    },
    listResidencyViolationsByTenant: (tenantId: string): ResidencyViolation[] => {
      return Array.from(residencyViolations.values())
        .filter((v) => v.tenantId === tenantId);
    },
  };
}

function createMockEventEmitter() {
  return {
    insertEvent: (event: { id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }) => {
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

  const request = service.createErasureRequest(input);

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
    () => service.createErasureRequest(input),
    /subjectType/,
  );
});

// ============================================================================
// Erasure Report Service Tests
// ============================================================================

test("ErasureReportService generates erasure report", () => {
  const store = createMockStore();
  const eventEmitter = createMockEventEmitter();
  const service = new ErasureReportService(store as any, eventEmitter as any);

  const input: GenerateErasureReportInput = {
    tenantId: "tenant_123",
    erasureId: "erasure_789",
    subjectType: "user",
    subjectId: "user_456",
    generatedBy: "system",
  };

  const report = service.generateErasureReport(input);

  assert.equal(report.tenantId, "tenant_123");
  assert.equal(report.erasureId, "erasure_789");
  assert.equal(report.subjectType, "user");
  assert.ok(report.reportId.length > 0);
  assert.ok(report.generatedAt.length > 0);
});

test("ErasureReportService calculates crypto shredding verification", () => {
  const store = createMockStore();
  const eventEmitter = createMockEventEmitter();
  const service = new ErasureReportService(store as any, eventEmitter as any);

  const summary = service.verifyCryptoShredding("dek_123", 5);

  assert.equal(summary.dekId, "dek_123");
  assert.equal(summary.keyVersionsDestroyed, 5);
  assert.equal(summary.allVersionsDestroyed, true);
});

// ============================================================================
// Data Encryption Key Service Tests
// ============================================================================

test("DataEncryptionKeyService creates DEK", () => {
  const store = createMockStore();
  const service = new DataEncryptionKeyService(store);

  const input: CreateDekInput = {
    tenantId: "tenant_123",
    createdBy: "admin",
    algorithm: "AES-256-GCM",
  };

  const dek = service.createDek(input);

  assert.equal(dek.tenantId, "tenant_123");
  assert.equal(dek.algorithm, "AES-256-GCM");
  assert.equal(dek.status, "active");
  assert.ok(dek.dekId.length > 0);
  assert.ok(dek.keyId.length > 0);
});

test("DataEncryptionKeyService rotates DEK", () => {
  const store = createMockStore();
  const service = new DataEncryptionKeyService(store);

  const input: CreateDekInput = {
    tenantId: "tenant_123",
    createdBy: "admin",
    algorithm: "AES-256-GCM",
  };

  const dek = service.createDek(input);
  const rotated = service.rotateDek({ dekId: dek.dekId, rotatedBy: "admin" });

  assert.equal(rotated.dekId, dek.dekId);
  assert.ok(rotated.rotatedAt.length > 0);
  assert.notEqual(rotated.keyId, dek.keyId);
});

test("DataEncryptionKeyService destroys DEK", () => {
  const store = createMockStore();
  const service = new DataEncryptionKeyService(store);

  const input: CreateDekInput = {
    tenantId: "tenant_123",
    createdBy: "admin",
    algorithm: "AES-256-GCM",
  };

  const dek = service.createDek(input);
  const destroyed = service.destroyDek({ dekId: dek.dekId, destroyedBy: "admin" });

  assert.equal(destroyed.dekId, dek.dekId);
  assert.equal(destroyed.status, "destroyed");
});

// ============================================================================
// Data Residency Service Tests
// ============================================================================

test("DataResidencyService creates residency rule", () => {
  const store = createMockStore();
  const service = new DataResidencyService(store);

  const rule: DataResidencyRule = {
    ruleId: "rule_001",
    tenantId: "tenant_123",
    jurisdiction: "EU" as Jurisdiction,
    allowedRegions: ["EU-WEST-1", "EU-CENTRAL-1"] as DataRegion[],
    dataCategories: ["PII", "FINANCIAL"],
    enforcementLevel: "strict",
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  const created = service.createResidencyRule(rule);

  assert.equal(created.ruleId, "rule_001");
  assert.equal(created.jurisdiction, "EU");
  assert.deepStrictEqual(created.allowedRegions, ["EU-WEST-1", "EU-CENTRAL-1"]);
});

test("DataResidencyService checks residency compliance", () => {
  const store = createMockStore();
  const service = new DataResidencyService(store);

  const input: CheckResidencyInput = {
    tenantId: "tenant_123",
    dataId: "data_001",
    currentRegion: "EU-WEST-1" as DataRegion,
    dataCategory: "PII",
  };

  const result = service.checkResidency(input);

  assert.equal(result.compliant, true);
  assert.equal(result.dataId, "data_001");
});

test("DataResidencyService detects residency violation", () => {
  const store = createMockStore();
  const service = new DataResidencyService(store);

  const rule: DataResidencyRule = {
    ruleId: "rule_002",
    tenantId: "tenant_123",
    jurisdiction: "EU" as Jurisdiction,
    allowedRegions: ["EU-WEST-1"] as DataRegion[],
    dataCategories: ["PII"],
    enforcementLevel: "strict",
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  service.createResidencyRule(rule);

  const input: CheckResidencyInput = {
    tenantId: "tenant_123",
    dataId: "data_002",
    currentRegion: "US-EAST-1" as DataRegion,
    dataCategory: "PII",
  };

  const result = service.checkResidency(input);

  assert.equal(result.compliant, false);
  assert.ok(result.violation !== null);
});

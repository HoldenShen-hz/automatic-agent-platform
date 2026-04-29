/**
 * Integration Tests: Compliance
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ErasureRequestService,
  type ErasureRequest,
  type ErasureRequestInput,
  type ErasureStatus,
} from "../../../../../src/platform/five-plane-control-plane/compliance/erasure-request-service.js";

import {
  ErasureReportService,
  type ErasureReport,
  type GenerateErasureReportInput,
  type CryptoShreddingVerificationSummary,
} from "../../../../../src/platform/five-plane-control-plane/compliance/erasure-report-service.js";

import {
  DataEncryptionKeyService,
  type DataEncryptionKey,
  type CreateDekInput,
} from "../../../../../src/platform/five-plane-control-plane/compliance/data-encryption-key-service.js";

import {
  DataResidencyService,
  type DataResidencyRule,
  type DataPlacement,
  type CheckResidencyInput,
  type Jurisdiction,
  type DataRegion,
} from "../../../../../src/platform/five-plane-control-plane/compliance/data-residency-service.js";

import type { ComplianceStore } from "../../../../../src/platform/five-plane-control-plane/compliance/types.js";

// ============================================================================
// Mock Store for Integration Tests
// ============================================================================

const erasureRequests = new Map<string, ErasureRequest>();
const erasureReports = new Map<string, ErasureReport>();
const dataEncryptionKeys = new Map<string, DataEncryptionKey>();
const dataPlacements = new Map<string, DataPlacement>();

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
    insertResidencyViolation: () => {},
    listResidencyViolationsByTenant: () => [],
  };
}

function createMockEventEmitter() {
  return {
    insertEvent: () => {},
  };
}

// ============================================================================
// Compliance End-to-End Integration Tests
// ============================================================================

test("integration: full erasure request lifecycle", () => {
  const store = createMockStore();
  const eventEmitter = createMockEventEmitter();
  const requestService = new ErasureRequestService(store as any, eventEmitter as any);
  const reportService = new ErasureReportService(store as any, eventEmitter as any);

  const input: ErasureRequestInput = {
    tenantId: "tenant_compliance_001",
    subjectType: "user",
    subjectId: "user_compliance_001",
    requestedBy: "privacy_team",
    reason: "User exercised GDPR right to erasure",
  };

  const request = requestService.createErasureRequest(input);
  assert.equal(request.status, "pending");

  requestService.updateErasureRequestStatus(request.erasureId, "processing");
  const updated = store.getErasureRequest(request.erasureId);
  assert.equal(updated?.status, "processing");

  requestService.updateErasureRequestStatus(request.erasureId, "completed");
  const completed = store.getErasureRequest(request.erasureId);
  assert.equal(completed?.status, "completed");

  const reportInput: GenerateErasureReportInput = {
    tenantId: "tenant_compliance_001",
    erasureId: request.erasureId,
    subjectType: "user",
    subjectId: "user_compliance_001",
    generatedBy: "system",
  };

  const report = reportService.generateErasureReport(reportInput);
  assert.equal(report.erasureId, request.erasureId);
  assert.equal(report.status, "completed");
});

test("integration: DEK lifecycle with crypto shredding", () => {
  const store = createMockStore();
  const dekService = new DataEncryptionKeyService(store);
  const reportService = new ErasureReportService(store as any, createMockEventEmitter() as any);

  const dekInput: CreateDekInput = {
    tenantId: "tenant_dek_001",
    createdBy: "security_admin",
    algorithm: "AES-256-GCM",
  };

  const dek = dekService.createDek(dekInput);
  assert.equal(dek.status, "active");

  const rotated = dekService.rotateDek({ dekId: dek.dekId, rotatedBy: "security_admin" });
  assert.equal(rotated.status, "active");
  assert.notEqual(rotated.keyId, dek.keyId);

  const destroyed = dekService.destroyDek({ dekId: rotated.dekId, destroyedBy: "security_admin" });
  assert.equal(destroyed.status, "destroyed");

  const cryptoSummary = reportService.verifyCryptoShredding(destroyed.dekId, 2);
  assert.equal(cryptoSummary.allVersionsDestroyed, true);
});

test("integration: data residency compliance workflow", () => {
  const store = createMockStore();
  const residencyService = new DataResidencyService(store);

  const euRule: DataResidencyRule = {
    ruleId: "rule_eu_001",
    tenantId: "tenant_eu_001",
    jurisdiction: "EU" as Jurisdiction,
    allowedRegions: ["EU-WEST-1", "EU-CENTRAL-1"] as DataRegion[],
    dataCategories: ["PII", "FINANCIAL"],
    enforcementLevel: "strict",
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  residencyService.createResidencyRule(euRule);

  const compliantCheck: CheckResidencyInput = {
    tenantId: "tenant_eu_001",
    dataId: "data_eu_001",
    currentRegion: "EU-WEST-1" as DataRegion,
    dataCategory: "PII",
  };

  const compliantResult = residencyService.checkResidency(compliantCheck);
  assert.equal(compliantResult.compliant, true);

  const nonCompliantCheck: CheckResidencyInput = {
    tenantId: "tenant_eu_001",
    dataId: "data_eu_002",
    currentRegion: "US-EAST-1" as DataRegion,
    dataCategory: "PII",
  };

  const nonCompliantResult = residencyService.checkResidency(nonCompliantCheck);
  assert.equal(nonCompliantResult.compliant, false);
  assert.ok(nonCompliantResult.violation !== null);
});

test("integration: GDPR erasure with DEK destruction", () => {
  const store = createMockStore();
  const dekService = new DataEncryptionKeyService(store);
  const requestService = new ErasureRequestService(store as any, createMockEventEmitter() as any);
  const reportService = new ErasureReportService(store as any, createMockEventEmitter() as any);

  const dekInput: CreateDekInput = {
    tenantId: "tenant_gdpr_001",
    createdBy: "system",
    algorithm: "AES-256-GCM",
  };

  const dek = dekService.createDek(dekInput);

  const erasureInput: ErasureRequestInput = {
    tenantId: "tenant_gdpr_001",
    subjectType: "user",
    subjectId: "user_gdpr_001",
    requestedBy: "privacy_officer",
    reason: "GDPR Article 17 request",
  };

  const erasure = requestService.createErasureRequest(erasureInput);

  dekService.destroyDek({ dekId: dek.dekId, destroyedBy: "privacy_officer" });

  const reportInput: GenerateErasureReportInput = {
    tenantId: "tenant_gdpr_001",
    erasureId: erasure.erasureId,
    subjectType: "user",
    subjectId: "user_gdpr_001",
    generatedBy: "system",
  };

  const report = reportService.generateErasureReport(reportInput);
  const cryptoVerify = reportService.verifyCryptoShredding(dek.dekId, 1);

  assert.equal(report.subjectType, "user");
  assert.equal(cryptoVerify.allVersionsDestroyed, true);
});

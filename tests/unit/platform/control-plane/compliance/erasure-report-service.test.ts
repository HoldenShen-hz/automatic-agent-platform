import assert from "node:assert/strict";
import test from "node:test";

import { ErasureReportService } from "../../../../../src/platform/five-plane-control-plane/compliance/erasure-report-service.js";
import type { ErasureReport, ErasureSubject, ReportEvidenceRef } from "../../../../../src/platform/five-plane-control-plane/compliance/erasure-report-service.js";
import type { ErasureRequest } from "../../../../../src/platform/five-plane-control-plane/compliance/erasure-request-service.js";
import type { DataEncryptionKey } from "../../../../../src/platform/five-plane-control-plane/compliance/data-encryption-key-service.js";
import type { ComplianceStore } from "../../../../../src/platform/five-plane-control-plane/compliance/types.js";

// Mock data
const erasureRequests = new Map<string, ErasureRequest>();
const erasureReports = new Map<string, ErasureReport>();
const dataEncryptionKeys = new Map<string, DataEncryptionKey>();
const events: Array<{ id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }> = [];

function createMockStore(): { compliance: ComplianceStore; event: { insertEvent: (event: { id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }) => void } } {
  return {
    compliance: {
      insertErasureRequest: (request: ErasureRequest) => { erasureRequests.set(request.erasureId, request); },
      getErasureRequest: (erasureId: string): ErasureRequest | null => erasureRequests.get(erasureId) ?? null,
      updateErasureRequest: (request: ErasureRequest) => { erasureRequests.set(request.erasureId, request); },
      listErasureRequestsByTenant: (_tenantId: string): ErasureRequest[] => Array.from(erasureRequests.values()),
      listErasureRequestsByTraceId: (_traceId: string): ErasureRequest[] => Array.from(erasureRequests.values()),
      insertErasureReport: (report: ErasureReport) => { erasureReports.set(report.reportId, report); },
      getErasureReport: (reportId: string): ErasureReport | null => erasureReports.get(reportId) ?? null,
      updateErasureReport: (report: ErasureReport) => { erasureReports.set(report.reportId, report); },
      listErasureReportsByTenant: (_tenantId: string): ErasureReport[] => Array.from(erasureReports.values()),
      listErasureReportsByErasureId: (_erasureId: string): ErasureReport[] => Array.from(erasureReports.values()).filter(r => r.erasureId === _erasureId),
      insertDataEncryptionKey: (dek: DataEncryptionKey) => { dataEncryptionKeys.set(dek.keyId, dek); },
      getDataEncryptionKey: (keyId: string): DataEncryptionKey | null => dataEncryptionKeys.get(keyId) ?? null,
      updateDataEncryptionKey: (dek: DataEncryptionKey) => { dataEncryptionKeys.set(dek.keyId, dek); },
      getActiveDataEncryptionKey: (_tenantId: string): DataEncryptionKey | null => {
        return Array.from(dataEncryptionKeys.values()).find(k => k.status === "active") ?? null;
      },
      listDataEncryptionKeysByTenant: (_tenantId: string): DataEncryptionKey[] => Array.from(dataEncryptionKeys.values()),
      insertDataPlacement: () => { throw new Error("not implemented"); },
      listDataPlacementsByTenant: () => [],
      insertResidencyViolation: () => { throw new Error("not implemented"); },
      updateResidencyViolation: () => { throw new Error("not implemented"); },
      listResidencyViolationsByTenant: () => [],
      listAllResidencyViolations: () => [],
    },
    event: {
      insertEvent: (event: { id: string; eventType: string; payloadJson: string; traceId: string | null; createdAt: string }) => {
        events.push(event);
      },
    },
  };
}

function createMockDb() {
  return { transaction: (fn: () => void) => fn() };
}

function resetMocks() {
  erasureRequests.clear();
  erasureReports.clear();
  dataEncryptionKeys.clear();
  events.length = 0;
}

test("ErasureReportService.generateReport creates report with pending status", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  // Create erasure request first
  mockStore.compliance.insertErasureRequest({
    erasureId: "erasure_test_123",
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    status: "completed",
    requestedBy: "admin",
    reason: "User request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_123",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  });

  const subjects: ErasureSubject[] = [
    { subjectType: "user", subjectId: "user-456", dataCategories: ["profile"], erased: true },
  ];
  const evidenceRefs: ReportEvidenceRef[] = [
    { evidenceType: "dek_destruction", referenceId: "key-001", description: "DEK destroyed", timestamp: "2026-04-21T00:00:00.000Z" },
  ];

  const report = service.generateReport({
    erasureId: "erasure_test_123",
    subjects,
    evidenceRefs,
    traceId: "trace_123",
    notes: "Test report",
  });

  assert.ok(report.reportId.startsWith("erasure_rpt_"), "Should have erasure_rpt_ prefix");
  assert.equal(report.erasureId, "erasure_test_123");
  assert.equal(report.tenantId, "tenant-123");
  assert.equal(report.verificationStatus, "pending");
  assert.equal(report.verifiedAt, null);
  assert.equal(report.notes, "Test report");
  assert.equal(report.subjects.length, 1);
  assert.equal(report.evidenceRefs.length, 1);
});

test("ErasureReportService.generateReport throws on missing erasureId", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.generateReport({
        erasureId: "",
        subjects: [{ subjectType: "user", subjectId: "u1", dataCategories: [], erased: true }],
        evidenceRefs: [{ evidenceType: "dek", referenceId: "k1", description: "d", timestamp: "2026-04-21T00:00:00.000Z" }],
        traceId: "trace_123",
      }),
    (err: any) => err.code === "erasure.report.invalid_erasure_id",
  );
});

test("ErasureReportService.generateReport throws on missing traceId", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.generateReport({
        erasureId: "erasure_123",
        subjects: [{ subjectType: "user", subjectId: "u1", dataCategories: [], erased: true }],
        evidenceRefs: [{ evidenceType: "dek", referenceId: "k1", description: "d", timestamp: "2026-04-21T00:00:00.000Z" }],
        traceId: "",
      }),
    (err: any) => err.code === "erasure.report.invalid_trace_id",
  );
});

test("ErasureReportService.generateReport throws on empty subjects", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.generateReport({
        erasureId: "erasure_123",
        subjects: [],
        evidenceRefs: [{ evidenceType: "dek", referenceId: "k1", description: "d", timestamp: "2026-04-21T00:00:00.000Z" }],
        traceId: "trace_123",
      }),
    (err: any) => err.code === "erasure.report.invalid_subjects",
  );
});

test("ErasureReportService.generateReport throws on empty evidenceRefs", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.generateReport({
        erasureId: "erasure_123",
        subjects: [{ subjectType: "user", subjectId: "u1", dataCategories: [], erased: true }],
        evidenceRefs: [],
        traceId: "trace_123",
      }),
    (err: any) => err.code === "erasure.report.invalid_evidence_refs",
  );
});

test("ErasureReportService.generateReport throws when erasure request not found", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  assert.throws(
    () =>
      service.generateReport({
        erasureId: "nonexistent_erasure",
        subjects: [{ subjectType: "user", subjectId: "u1", dataCategories: [], erased: true }],
        evidenceRefs: [{ evidenceType: "dek", referenceId: "k1", description: "d", timestamp: "2026-04-21T00:00:00.000Z" }],
        traceId: "trace_123",
      }),
    (err: any) => err.code.startsWith("erasure.report.erasure_not_found"),
  );
});

test("ErasureReportService.getReport retrieves report", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  // Create erasure request first
  mockStore.compliance.insertErasureRequest({
    erasureId: "erasure_test_123",
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    status: "completed",
    requestedBy: "admin",
    reason: "User request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_123",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  });

  const report = service.generateReport({
    erasureId: "erasure_test_123",
    subjects: [{ subjectType: "user", subjectId: "user-456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "dek_destruction", referenceId: "key-001", description: "DEK destroyed", timestamp: "2026-04-21T00:00:00.000Z" }],
    traceId: "trace_123",
  });

  const retrieved = service.getReport(report.reportId);
  assert.ok(retrieved);
  assert.equal(retrieved!.reportId, report.reportId);
});

test("ErasureReportService.getReport returns null for non-existent", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  const retrieved = service.getReport("nonexistent_report");
  assert.equal(retrieved, null);
});

test("ErasureReportService.verifyCryptoShredding returns verified when DEK is destroyed", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  // Create erasure request
  mockStore.compliance.insertErasureRequest({
    erasureId: "erasure_test_123",
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    status: "completed",
    requestedBy: "admin",
    reason: "User request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_123",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  });

  // Create destroyed DEK
  dataEncryptionKeys.set("key-001", {
    keyId: "key-001",
    tenantId: "tenant-123",
    version: 1,
    status: "destroyed",
    encryptedKeyMaterial: null,
    algorithm: "AES-256-GCM",
    externalKeyId: null,
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:01:00.000Z",
    destroyedAt: "2026-04-21T00:01:00.000Z",
    createdBy: "system",
    destroyedBy: "erasure-service",
    destructionReason: "erasure_request",
    traceId: null,
    metadataJson: null,
  });

  const report = service.generateReport({
    erasureId: "erasure_test_123",
    subjects: [{ subjectType: "user", subjectId: "user-456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "dek_destruction", referenceId: "key-001", description: "DEK destroyed", timestamp: "2026-04-21T00:01:00.000Z" }],
    traceId: "trace_123",
  });

  const verification = service.verifyCryptoShredding(report.reportId);

  assert.equal(verification.status, "verified");
  assert.equal(verification.totalDekDestroyed, 1);
  assert.equal(verification.verifiedDekDestroyed, 1);
  assert.equal(verification.failedDekDestroyed, 0);
});

test("ErasureReportService.verifyCryptoShredding returns failed when DEK is still active", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  // Create erasure request
  mockStore.compliance.insertErasureRequest({
    erasureId: "erasure_test_123",
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    status: "completed",
    requestedBy: "admin",
    reason: "User request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_123",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  });

  // Create active DEK (not destroyed)
  dataEncryptionKeys.set("key-001", {
    keyId: "key-001",
    tenantId: "tenant-123",
    version: 1,
    status: "active",
    encryptedKeyMaterial: "encrypted_key_data",
    algorithm: "AES-256-GCM",
    externalKeyId: null,
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    destroyedAt: null,
    createdBy: "system",
    destroyedBy: null,
    destructionReason: null,
    traceId: null,
    metadataJson: null,
  });

  const report = service.generateReport({
    erasureId: "erasure_test_123",
    subjects: [{ subjectType: "user", subjectId: "user-456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "dek_destruction", referenceId: "key-001", description: "DEK should be destroyed", timestamp: "2026-04-21T00:01:00.000Z" }],
    traceId: "trace_123",
  });

  const verification = service.verifyCryptoShredding(report.reportId);

  assert.equal(verification.status, "failed");
  assert.equal(verification.totalDekDestroyed, 1);
  assert.equal(verification.verifiedDekDestroyed, 0);
  assert.equal(verification.failedDekDestroyed, 1);
});

test("ErasureReportService.verifyCryptoShredding returns partial when no DEK evidence", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  // Create erasure request
  mockStore.compliance.insertErasureRequest({
    erasureId: "erasure_test_123",
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    status: "completed",
    requestedBy: "admin",
    reason: "User request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_123",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  });

  // Report with no dek_destruction evidence
  const report = service.generateReport({
    erasureId: "erasure_test_123",
    subjects: [{ subjectType: "user", subjectId: "user-456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "data_purge", referenceId: "purge-001", description: "Data purged", timestamp: "2026-04-21T00:00:00.000Z" }],
    traceId: "trace_123",
  });

  const verification = service.verifyCryptoShredding(report.reportId);

  assert.equal(verification.status, "partial");
  assert.equal(verification.totalDekDestroyed, 0);
});

test("ErasureReportService.verifyCryptoShredding throws on non-existent report", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  assert.throws(
    () => service.verifyCryptoShredding("nonexistent_report"),
    (err: any) => err.code.startsWith("erasure.report.not_found"),
  );
});

test("ErasureReportService.listReportsByVerificationStatus filters correctly", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  // Create erasure request
  mockStore.compliance.insertErasureRequest({
    erasureId: "erasure_test_123",
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    status: "completed",
    requestedBy: "admin",
    reason: "User request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_123",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  });

  // Report with pending status
  service.generateReport({
    erasureId: "erasure_test_123",
    subjects: [{ subjectType: "user", subjectId: "user-456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "dek_destruction", referenceId: "key-001", description: "DEK destroyed", timestamp: "2026-04-21T00:00:00.000Z" }],
    traceId: "trace_123",
  });

  const pending = service.listReportsByVerificationStatus("tenant-123", "pending");
  const verified = service.listReportsByVerificationStatus("tenant-123", "verified");
  const failed = service.listReportsByVerificationStatus("tenant-123", "failed");

  assert.equal(pending.length, 1);
  assert.equal(verified.length, 0);
  assert.equal(failed.length, 0);
});

test("ErasureReportService.updateReportNotes updates notes", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  // Create erasure request
  mockStore.compliance.insertErasureRequest({
    erasureId: "erasure_test_123",
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    status: "completed",
    requestedBy: "admin",
    reason: "User request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_123",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  });

  const report = service.generateReport({
    erasureId: "erasure_test_123",
    subjects: [{ subjectType: "user", subjectId: "user-456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "dek_destruction", referenceId: "key-001", description: "DEK destroyed", timestamp: "2026-04-21T00:00:00.000Z" }],
    traceId: "trace_123",
    notes: "Initial notes",
  });

  const updated = service.updateReportNotes(report.reportId, "Updated compliance notes");

  assert.equal(updated.notes, "Updated compliance notes");
});

test("ErasureReportService.updateReportNotes throws on non-existent report", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  assert.throws(
    () => service.updateReportNotes("nonexistent_report", "Some notes"),
    (err: any) => err.code.startsWith("erasure.report.not_found"),
  );
});

test("ErasureReportService.getErasureRequestForReport retrieves associated request", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  // Create erasure request
  mockStore.compliance.insertErasureRequest({
    erasureId: "erasure_test_123",
    tenantId: "tenant-123",
    subjectType: "user",
    subjectId: "user-456",
    status: "completed",
    requestedBy: "admin",
    reason: "User request",
    legalBasis: "gdpr_article_17",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    processedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    traceId: "trace_123",
    evidenceRefs: [],
    notes: null,
    metadataJson: null,
  });

  const report = service.generateReport({
    erasureId: "erasure_test_123",
    subjects: [{ subjectType: "user", subjectId: "user-456", dataCategories: ["profile"], erased: true }],
    evidenceRefs: [{ evidenceType: "dek_destruction", referenceId: "key-001", description: "DEK destroyed", timestamp: "2026-04-21T00:00:00.000Z" }],
    traceId: "trace_123",
  });

  const request = service.getErasureRequestForReport(report.reportId);
  assert.ok(request);
  assert.equal(request!.erasureId, "erasure_test_123");
});

test("ErasureReportService.getErasureRequestForReport returns null for non-existent report", () => {
  resetMocks();
  const mockStore = createMockStore();
  const mockDb = createMockDb();
  const service = new ErasureReportService(mockDb as any, mockStore as any);

  const request = service.getErasureRequestForReport("nonexistent_report");
  assert.equal(request, null);
});

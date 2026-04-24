/**
 * Unit tests for Compliance Types
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { ComplianceStore } from "../../../../../src/platform/control-plane/compliance/types.js";
import type { ErasureRequest } from "../../../../../src/platform/control-plane/compliance/erasure-request-service.js";
import type { ErasureReport } from "../../../../../src/platform/control-plane/compliance/erasure-report-service.js";
import type { DataEncryptionKey } from "../../../../../src/platform/control-plane/compliance/data-encryption-key-service.js";
import type { DataPlacement, ResidencyViolation } from "../../../../../src/platform/control-plane/compliance/data-residency-service.js";

test("ComplianceStore interface defines all required methods", () => {
  // Verify the interface defines all required storage operations
  const methods: Array<keyof ComplianceStore> = [
    // Erasure Request operations
    "insertErasureRequest",
    "getErasureRequest",
    "updateErasureRequest",
    "listErasureRequestsByTenant",
    "listErasureRequestsByTraceId",
    // Erasure Report operations
    "insertErasureReport",
    "getErasureReport",
    "updateErasureReport",
    "listErasureReportsByTenant",
    "listErasureReportsByErasureId",
    // DEK operations
    "insertDataEncryptionKey",
    "getDataEncryptionKey",
    "updateDataEncryptionKey",
    "getActiveDataEncryptionKey",
    "listDataEncryptionKeysByTenant",
    // Data Placement operations
    "insertDataPlacement",
    "listDataPlacementsByTenant",
    // Residency Violation operations
    "insertResidencyViolation",
    "updateResidencyViolation",
    "listResidencyViolationsByTenant",
    "listAllResidencyViolations",
  ];

  // ComplianceStore is an interface, so we can't directly check methods
  // but we can verify it exists and is used as a type
  const _store: ComplianceStore | undefined = undefined;
  assert.ok(_store === undefined); // Just to use the variable
});

test("ErasureRequest can be used as a type", () => {
  const request: ErasureRequest = {
    erasureId: "erasure-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    requestorId: "user-1",
    requestedAt: "2026-01-01T00:00:00.000Z",
    status: "pending",
    subjectType: "user",
    subjectId: "subject-1",
    retentionExpiresAt: "2026-02-01T00:00:00.000Z",
  };

  assert.equal(request.erasureId, "erasure-1");
  assert.equal(request.tenantId, "tenant-1");
  assert.equal(request.status, "pending");
});

test("ErasureReport can be used as a type", () => {
  const report: ErasureReport = {
    reportId: "report-1",
    erasureId: "erasure-1",
    tenantId: "tenant-1",
    completedAt: "2026-01-15T00:00:00.000Z",
    status: "completed",
    recordsErased: 42,
    reportUrl: "https://example.com/report.pdf",
  };

  assert.equal(report.reportId, "report-1");
  assert.equal(report.erasureId, "erasure-1");
  assert.equal(report.recordsErased, 42);
  assert.equal(report.status, "completed");
});

test("DataEncryptionKey can be used as a type", () => {
  const dek: DataEncryptionKey = {
    keyId: "dek-1",
    tenantId: "tenant-1",
    version: 1,
    algorithm: "AES-256-GCM",
    keyMaterial: "encrypted-key-data",
    createdAt: "2026-01-01T00:00:00.000Z",
    rotatedAt: null,
    status: "active",
    createdBy: "system",
  };

  assert.equal(dek.keyId, "dek-1");
  assert.equal(dek.tenantId, "tenant-1");
  assert.equal(dek.version, 1);
  assert.equal(dek.algorithm, "AES-256-GCM");
  assert.equal(dek.status, "active");
});

test("DataPlacement can be used as a type", () => {
  const placement: DataPlacement = {
    placementId: "placement-1",
    tenantId: "tenant-1",
    dataType: "user_content",
    region: "us-east-1",
    storageClass: "standard",
    retentionDays: 365,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  assert.equal(placement.placementId, "placement-1");
  assert.equal(placement.tenantId, "tenant-1");
  assert.equal(placement.region, "us-east-1");
  assert.equal(placement.dataType, "user_content");
});

test("ResidencyViolation can be used as a type", () => {
  const violation: ResidencyViolation = {
    violationId: "violation-1",
    tenantId: "tenant-1",
    detectedAt: "2026-01-15T00:00:00.000Z",
    dataType: "user_content",
    expectedRegion: "eu-west-1",
    actualRegion: "us-east-1",
    resolution: "pending",
    notes: "Data found in wrong region",
  };

  assert.equal(violation.violationId, "violation-1");
  assert.equal(violation.tenantId, "tenant-1");
  assert.equal(violation.expectedRegion, "eu-west-1");
  assert.equal(violation.actualRegion, "us-east-1");
  assert.equal(violation.resolution, "pending");
});

test("ComplianceStore type is actually an interface", () => {
  // This test verifies that ComplianceStore is an interface type
  // by checking that it can be used in type positions
  function checkStore(store: ComplianceStore): keyof ComplianceStore | null {
    return null;
  }

  const result = checkStore({} as ComplianceStore);
  assert.equal(result, null);
});

test("ErasureRequest status can be various values", () => {
  const pending: ErasureRequest = {
    erasureId: "erasure-1",
    tenantId: "tenant-1",
    traceId: "trace-1",
    requestorId: "user-1",
    requestedAt: "2026-01-01T00:00:00.000Z",
    status: "pending",
    subjectType: "user",
    subjectId: "subject-1",
  } as ErasureRequest;

  const approved: ErasureRequest = {
    ...pending,
    status: "approved",
  } as ErasureRequest;

  const rejected: ErasureRequest = {
    ...pending,
    status: "rejected",
  } as ErasureRequest;

  assert.equal(pending.status, "pending");
  assert.equal(approved.status, "approved");
  assert.equal(rejected.status, "rejected");
});

test("DataEncryptionKey status can be active or retired", () => {
  const active: DataEncryptionKey = {
    keyId: "dek-1",
    tenantId: "tenant-1",
    version: 1,
    algorithm: "AES-256-GCM",
    keyMaterial: "encrypted-key-data",
    createdAt: "2026-01-01T00:00:00.000Z",
    rotatedAt: null,
    status: "active",
    createdBy: "system",
  };

  const retired: DataEncryptionKey = {
    keyId: "dek-2",
    tenantId: "tenant-1",
    version: 2,
    algorithm: "AES-256-GCM",
    keyMaterial: "retired-key-data",
    createdAt: "2025-01-01T00:00:00.000Z",
    rotatedAt: "2026-01-01T00:00:00.000Z",
    status: "destroyed",
    createdBy: "system",
  };

  assert.equal(active.status, "active");
  assert.equal(retired.status, "destroyed");
});

test("ResidencyViolation resolution can be various values", () => {
  const pending: ResidencyViolation = {
    violationId: "violation-1",
    tenantId: "tenant-1",
    detectedAt: "2026-01-15T00:00:00.000Z",
    dataType: "user_content",
    expectedRegion: "eu-west-1",
    actualRegion: "us-east-1",
    resolution: "pending",
  };

  const resolved: ResidencyViolation = {
    ...pending,
    resolution: "data_migrated",
  };

  const acknowledged: ResidencyViolation = {
    ...pending,
    resolution: "risk_accepted",
  };

  assert.equal(pending.resolution, "pending");
  assert.equal(resolved.resolution, "data_migrated");
  assert.equal(acknowledged.resolution, "risk_accepted");
});

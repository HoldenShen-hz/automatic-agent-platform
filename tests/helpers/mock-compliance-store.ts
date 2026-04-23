/**
 * Mock Compliance Store Helper
 *
 * Provides an in-memory implementation of the ComplianceStore interface
 * for testing purposes. This allows integration tests to run without
 * requiring the full database schema to be implemented.
 */

import type {
  ErasureRequest,
  ErasureReport,
  DataEncryptionKey,
  DataPlacement,
  ResidencyViolation,
} from "../../../src/platform/control-plane/compliance/types.js";
import type { ComplianceStore } from "../../../src/platform/control-plane/compliance/types.js";

export function createMockComplianceStore(): ComplianceStore {
  const erasureRequests = new Map<string, ErasureRequest>();
  const erasureReports = new Map<string, ErasureReport>();
  const dataEncryptionKeys = new Map<string, DataEncryptionKey>();
  const dataPlacements = new Map<string, DataPlacement>();
  const residencyViolations = new Map<string, ResidencyViolation>();

  return {
    // Erasure Request operations
    insertErasureRequest(request: ErasureRequest): void {
      erasureRequests.set(request.erasureId, request);
    },

    getErasureRequest(erasureId: string): ErasureRequest | null {
      return erasureRequests.get(erasureId) ?? null;
    },

    updateErasureRequest(request: ErasureRequest): void {
      erasureRequests.set(request.erasureId, request);
    },

    listErasureRequestsByTenant(tenantId: string): ErasureRequest[] {
      return [...erasureRequests.values()].filter((r) => r.tenantId === tenantId);
    },

    listErasureRequestsByTraceId(traceId: string): ErasureRequest[] {
      return [...erasureRequests.values()].filter((r) => r.traceId === traceId);
    },

    // Erasure Report operations
    insertErasureReport(report: ErasureReport): void {
      erasureReports.set(report.reportId, report);
    },

    getErasureReport(reportId: string): ErasureReport | null {
      return erasureReports.get(reportId) ?? null;
    },

    updateErasureReport(report: ErasureReport): void {
      erasureReports.set(report.reportId, report);
    },

    listErasureReportsByTenant(tenantId: string): ErasureReport[] {
      return [...erasureReports.values()].filter((r) => r.tenantId === tenantId);
    },

    listErasureReportsByErasureId(erasureId: string): ErasureReport[] {
      return [...erasureReports.values()].filter((r) => r.erasureId === erasureId);
    },

    // DEK operations
    insertDataEncryptionKey(dek: DataEncryptionKey): void {
      dataEncryptionKeys.set(dek.keyId, dek);
    },

    getDataEncryptionKey(keyId: string): DataEncryptionKey | null {
      return dataEncryptionKeys.get(keyId) ?? null;
    },

    updateDataEncryptionKey(dek: DataEncryptionKey): void {
      dataEncryptionKeys.set(dek.keyId, dek);
    },

    getActiveDataEncryptionKey(tenantId: string): DataEncryptionKey | null {
      return [...dataEncryptionKeys.values()].find(
        (k) => k.tenantId === tenantId && k.status === "active",
      ) ?? null;
    },

    listDataEncryptionKeysByTenant(tenantId: string): DataEncryptionKey[] {
      return [...dataEncryptionKeys.values()].filter((k) => k.tenantId === tenantId);
    },

    // Data Placement operations
    insertDataPlacement(placement: DataPlacement): void {
      dataPlacements.set(placement.placementId, placement);
    },

    listDataPlacementsByTenant(tenantId: string): DataPlacement[] {
      return [...dataPlacements.values()].filter((p) => p.tenantId === tenantId);
    },

    // Residency Violation operations
    insertResidencyViolation(violation: ResidencyViolation): void {
      residencyViolations.set(violation.violationId, violation);
    },

    updateResidencyViolation(violation: ResidencyViolation): void {
      residencyViolations.set(violation.violationId, violation);
    },

    listResidencyViolationsByTenant(tenantId: string): ResidencyViolation[] {
      return [...residencyViolations.values()].filter((v) => v.tenantId === tenantId);
    },

    listAllResidencyViolations(): ResidencyViolation[] {
      return [...residencyViolations.values()];
    },
  };
}

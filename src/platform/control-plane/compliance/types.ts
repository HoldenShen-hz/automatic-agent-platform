/**
 * @fileoverview Compliance Store Interface - Type definitions for compliance storage
 *
 * This file defines the interface that the compliance module requires from the
 * underlying storage layer. The actual implementation would be added to the
 * AuthoritativeTaskStore as a 'compliance' submodule.
 *
 * @see ErasureRequestService
 * @see ErasureReportService
 * @see DataEncryptionKeyService
 * @see DataResidencyService
 *
 * @packageDocumentation
 */

import type { ErasureRequest } from "./erasure-request-service.js";
import type { ErasureReport } from "./erasure-report-service.js";
import type { DataEncryptionKey } from "./data-encryption-key-service.js";
import type { DataPlacement, ResidencyViolation } from "./data-residency-service.js";

/**
 * Compliance store interface - defines all storage operations required
 * by the compliance module.
 *
 * This interface would be implemented as a submodule on AuthoritativeTaskStore
 * in the actual storage infrastructure.
 */
export interface ComplianceStore {
  // Erasure Request operations
  insertErasureRequest(request: ErasureRequest): void;
  getErasureRequest(erasureId: string): ErasureRequest | null;
  updateErasureRequest(request: ErasureRequest): void;
  listErasureRequestsByTenant(tenantId: string): ErasureRequest[];
  listErasureRequestsByTraceId(traceId: string): ErasureRequest[];

  // Erasure Report operations
  insertErasureReport(report: ErasureReport): void;
  getErasureReport(reportId: string): ErasureReport | null;
  updateErasureReport(report: ErasureReport): void;
  listErasureReportsByTenant(tenantId: string): ErasureReport[];
  listErasureReportsByErasureId(erasureId: string): ErasureReport[];

  // DEK operations
  insertDataEncryptionKey(dek: DataEncryptionKey): void;
  getDataEncryptionKey(keyId: string): DataEncryptionKey | null;
  updateDataEncryptionKey(dek: DataEncryptionKey): void;
  getActiveDataEncryptionKey(tenantId: string): DataEncryptionKey | null;
  listDataEncryptionKeysByTenant(tenantId: string): DataEncryptionKey[];

  // Data Placement operations
  insertDataPlacement(placement: DataPlacement): void;
  listDataPlacementsByTenant(tenantId: string): DataPlacement[];

  // Residency Violation operations
  insertResidencyViolation(violation: ResidencyViolation): void;
  updateResidencyViolation(violation: ResidencyViolation): void;
  listResidencyViolationsByTenant(tenantId: string): ResidencyViolation[];
  listAllResidencyViolations(): ResidencyViolation[];
}

/**
 * Compliance Module - GDPR Right-to-Erasure and Data Residency Enforcement
 *
 * This module provides compliance services for:
 * - ErasureRequestService: GDPR Article 17 Right-to-Erasure request handling
 * - ErasureReportService: Erasure compliance report generation
 * - DataEncryptionKeyService: Per-tenant DEK management for crypto-shredding
 * - DataResidencyService: Data residency enforcement and jurisdiction mapping
 *
 * ## Architecture
 *
 * The compliance module integrates with:
 * - AuthoritativeTaskStore for persistence
 * - Event system for audit trail
 * - DEK management for crypto-shredding
 * - Data residency rules for jurisdiction enforcement
 *
 * @see docs_zh/architecture/00-platform-architecture.md
 * @packageDocumentation
 */

// Erasure Request Service
export {
  ErasureRequestService,
  type ErasureRequest,
  type ErasureRequestInput,
  type ErasureStatus,
  type ErasureSubjectType,
  type EvidenceRef,
} from "./erasure-request-service.js";

// Erasure Report Service
export {
  ErasureReportService,
  type ErasureReport,
  type ErasureSubject,
  type ReportEvidenceRef,
  type ReportSubjectType,
  type GenerateErasureReportInput,
  type CryptoShreddingVerificationSummary,
} from "./erasure-report-service.js";

// Data Encryption Key Service
export {
  DataEncryptionKeyService,
  type DataEncryptionKey,
  type CreateDekInput,
  type RotateDekInput,
  type DestroyDekInput,
  type TenantDekSummary,
  type DekStatus,
} from "./data-encryption-key-service.js";

// Data Residency Service
export {
  DataResidencyService,
  type DataResidencyRule,
  type DataPlacement,
  type ResidencyViolation,
  type CheckResidencyInput,
  type ValidatePlacementInput,
  type ResidencyCheckResult,
  type Jurisdiction,
  type DataRegion,
  type DataCategory,
} from "./data-residency-service.js";

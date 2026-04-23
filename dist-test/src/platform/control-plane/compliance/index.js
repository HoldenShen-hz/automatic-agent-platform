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
export { ErasureRequestService, } from "./erasure-request-service.js";
// Erasure Report Service
export { ErasureReportService, } from "./erasure-report-service.js";
// Data Encryption Key Service
export { DataEncryptionKeyService, } from "./data-encryption-key-service.js";
// Data Residency Service
export { DataResidencyService, } from "./data-residency-service.js";
//# sourceMappingURL=index.js.map
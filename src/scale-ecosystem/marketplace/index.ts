/**
 * Marketplace Core Barrel
 *
 * Re-exports marketplace-specific governance, publication, certification,
 * and catalog surfaces. Operational ecosystem modules now live in dedicated
 * top-level scale-ecosystem submodules.
 */

// Re-export certification exports (excluding SecurityScanResult to avoid conflict with pack-security-service)
export { type SecurityScanResult as CertificationSecurityScanResult } from "./certification/index.js";
export { type CertificationStatus } from "./certification/index.js";

// Certification gate service
export { CertificationGateService, getCertificationGateService, type CertificationResult, type SecurityScanStatus } from "./certification/certification-gate-service.js";

// Re-export pack-security-service exports (excluding SecurityScanResult to avoid conflict)
export { type SecurityScanInput, type SecurityIssue, type DependencyInfo, type DependencyConflict, type DependencyResolutionResult, type PackSecurityService } from "./pack-security-service.js";
export { type SecurityScanResult as PackSecurityScanResult } from "./pack-security-service.js";

export * from "./marketplace-governance-service.js";
export * from "./publisher/index.js";
export {
  MarketplaceCatalogEntrySchema,
  sortMarketplaceCatalog,
} from "./catalog/index.js";
export type { MarketplaceCatalogEntry } from "./catalog/index.js";

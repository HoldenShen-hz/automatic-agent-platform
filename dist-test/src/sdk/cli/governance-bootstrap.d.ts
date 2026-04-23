/**
 * Governance CLI Bootstrap Utilities
 *
 * This module provides shared bootstrap utilities for governance CLI tools
 * (doctor, ops-governance, enterprise-governance, ops-program, diagnostics).
 * It extracts the common service initialization pattern to reduce code duplication
 * across CLI entry points.
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for governance architecture
 */
import type { AuthoritativeStorageContext } from "../../platform/state-evidence/truth/storage-backend-factory.js";
import { DoctorService } from "../../platform/control-plane/incident-control/doctor-service.js";
import { HealthService } from "../../platform/shared/observability/health-service.js";
import { MetricsService } from "../../platform/shared/observability/metrics-service.js";
import { DiagnosticsService } from "../../platform/shared/observability/diagnostics-service.js";
import { ObservabilityRetentionService } from "../../platform/shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { StalledExecutionDetector } from "../../platform/execution/recovery/stalled-execution-detector.js";
import { StartupConsistencyChecker } from "../../platform/execution/startup/startup-consistency-checker.js";
import { type StorageQuotaCategoryConfig } from "../../platform/state-evidence/truth/storage-quota-service.js";
/**
 * Services initialized by bootstrapGovernanceServices.
 * These are returned so callers can use them directly or pass to higher-level services.
 */
export interface GovernanceServices {
    health: HealthService;
    diagnostics: DiagnosticsService;
    doctor: DoctorService;
    checker: StartupConsistencyChecker;
    stalledDetector: StalledExecutionDetector;
    retentionService: ObservabilityRetentionService;
    logger: StructuredLogger;
}
/**
 * Options for bootstrapGovernanceServices.
 */
export interface GovernanceBootstrapOptions {
    /** The storage context (from withCliStorage) */
    storage: AuthoritativeStorageContext;
    /** Database file path (needed for backup path and workspace derivation) */
    dbPath: string;
    /** Optional custom workspace root (defaults to derived from dbPath) */
    workspaceRoot?: string;
    /** Optional storage quota categories */
    storageQuotaCategories?: readonly StorageQuotaCategoryConfig[];
}
/**
 * Bootstrap governance services from a storage context.
 *
 * This factory function extracts the common initialization pattern shared by
 * doctor, ops-governance, enterprise-governance, ops-program, and diagnostics CLIs:
 * - HealthService
 * - ObservabilityRetentionService
 * - StartupConsistencyChecker
 * - StalledExecutionDetector
 * - DiagnosticsService (combining InspectService + HealthService + StructuredLogger + RetentionService)
 * - DoctorService (combining all of the above + RuntimeRecoveryService + SqliteReliabilityService + others)
 *
 * Usage:
 * ```typescript
 * import { withCliStorage } from "./authoritative-storage.js";
 * import { bootstrapGovernanceServices } from "./governance-bootstrap.js";
 *
 * withCliStorage((storage) => {
 *   const { doctor } = bootstrapGovernanceServices({ storage, dbPath });
 *   const result = doctor.run();
 *   process.stdout.write(JSON.stringify(result, null, 2));
 * });
 * ```
 */
export declare function bootstrapGovernanceServices(options: GovernanceBootstrapOptions): GovernanceServices;
/**
 * Options for bootstrapGovernanceServicesWithMetrics.
 * Extends GovernanceBootstrapOptions with metrics service dependency.
 */
export interface GovernanceBootstrapWithMetricsOptions extends GovernanceBootstrapOptions {
    /** Pre-created MetricsService (optional, created if not provided) */
    metrics?: MetricsService;
}
/**
 * Bootstrap governance services including MetricsService.
 * Used by ops-governance and enterprise-governance which need MetricsService
 * for their OperationsGovernanceService.
 */
export declare function bootstrapGovernanceServicesWithMetrics(options: GovernanceBootstrapWithMetricsOptions): GovernanceServices & {
    metrics: MetricsService;
    workspaceRoot: string;
};

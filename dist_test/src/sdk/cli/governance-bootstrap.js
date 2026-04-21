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
import { join } from "node:path";
import { requireCliSqliteDatabase, deriveCliWorkspaceRoot, } from "./authoritative-storage.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
import { DoctorService } from "../../platform/control-plane/incident-control/doctor-service.js";
import { HealthService } from "../../platform/shared/observability/health-service.js";
import { MetricsService } from "../../platform/shared/observability/metrics-service.js";
import { InspectService } from "../../platform/shared/observability/inspect-service.js";
import { DiagnosticsService } from "../../platform/shared/observability/diagnostics-service.js";
import { ObservabilityRetentionService } from "../../platform/shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { ExecutionResourceMonitor } from "../../platform/execution/dispatcher/execution-resource-monitor.js";
import { RuntimeRecoveryService } from "../../platform/execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../../platform/execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../../platform/execution/recovery/stalled-execution-escalation-service.js";
import { createDefaultStartupConsistencyCheckerOptions } from "../../platform/execution/startup/startup-preflight.js";
import { StartupConsistencyChecker } from "../../platform/execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../platform/execution/worker-pool/worker-registry-service.js";
import { ProtectedGovernanceIntegrityService } from "../../platform/control-plane/config-center/protected-governance-integrity-service.js";
import { StorageQuotaService } from "../../platform/state-evidence/truth/storage-quota-service.js";
import { SqliteReliabilityService } from "../../platform/state-evidence/truth/sqlite/sqlite-reliability-service.js";
/**
 * Default storage quota categories for governance CLI tools.
 * Used when workspaceRoot can be derived and no explicit categories are provided.
 */
function defaultGovernanceQuotaCategories(workspaceRoot) {
    return [
        {
            categoryId: "artifact",
            roots: [join(workspaceRoot, "data", "artifacts")],
            maxBytes: 250 * 1024 * 1024,
            cleanupEnabled: true,
        },
        {
            categoryId: "debug",
            roots: [join(workspaceRoot, "data", "stable-evidence"), join(workspaceRoot, "data", "debug")],
            maxBytes: 150 * 1024 * 1024,
            cleanupEnabled: true,
        },
        {
            categoryId: "backup",
            roots: [join(workspaceRoot, "data", "sqlite"), join(workspaceRoot, "data", "backups")],
            maxBytes: 200 * 1024 * 1024,
            cleanupEnabled: true,
        },
    ];
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
export function bootstrapGovernanceServices(options) {
    const { storage } = options;
    const { sql: db, store } = storage;
    const sqlite = requireCliSqliteDatabase(storage);
    const workspaceRoot = options.workspaceRoot ?? deriveCliWorkspaceRoot(options.dbPath);
    const logger = new StructuredLogger();
    const retentionService = new ObservabilityRetentionService(db);
    const health = new HealthService(db, store);
    const checker = new StartupConsistencyChecker(db, store, createDefaultStartupConsistencyCheckerOptions({
        providerSecretResolver: null,
    }));
    const stalledDetector = new StalledExecutionDetector(store);
    const diagnostics = new DiagnosticsService(new InspectService(store), health, logger, retentionService);
    // Build quota service: use explicit categories if provided, otherwise derive from workspace
    const quotaCategories = options.storageQuotaCategories ?? defaultGovernanceQuotaCategories(workspaceRoot);
    const storageQuotaService = new StorageQuotaService({
        sandboxPolicy: createWorkspaceWritePolicy(workspaceRoot),
        categories: quotaCategories,
    });
    const doctor = new DoctorService(health, checker, new RuntimeRecoveryService(store), stalledDetector, new SqliteReliabilityService(sqlite), `${options.dbPath}.backup`, new ProtectedGovernanceIntegrityService(), storageQuotaService, new WorkerRegistryService(store), retentionService, new StalledExecutionEscalationService(stalledDetector, diagnostics), new ExecutionResourceMonitor(store), { store });
    return { health, diagnostics, doctor, checker, stalledDetector, retentionService, logger };
}
/**
 * Bootstrap governance services including MetricsService.
 * Used by ops-governance and enterprise-governance which need MetricsService
 * for their OperationsGovernanceService.
 */
export function bootstrapGovernanceServicesWithMetrics(options) {
    const { storage, dbPath, workspaceRoot, storageQuotaCategories } = options;
    const { sql: db, store } = storage;
    const sqlite = requireCliSqliteDatabase(storage);
    const wsRoot = workspaceRoot ?? deriveCliWorkspaceRoot(dbPath);
    const logger = new StructuredLogger();
    const retentionService = new ObservabilityRetentionService(db);
    const health = new HealthService(db, store);
    const metrics = options.metrics ?? new MetricsService(db, health);
    const checker = new StartupConsistencyChecker(db, store, createDefaultStartupConsistencyCheckerOptions({
        providerSecretResolver: null,
    }));
    const stalledDetector = new StalledExecutionDetector(store);
    const diagnostics = new DiagnosticsService(new InspectService(store), health, logger, retentionService);
    const quotaCategories = storageQuotaCategories ?? defaultGovernanceQuotaCategories(wsRoot);
    const storageQuotaService = new StorageQuotaService({
        sandboxPolicy: createWorkspaceWritePolicy(wsRoot),
        categories: quotaCategories,
    });
    const doctor = new DoctorService(health, checker, new RuntimeRecoveryService(store), stalledDetector, new SqliteReliabilityService(sqlite), `${dbPath}.backup`, new ProtectedGovernanceIntegrityService(), storageQuotaService, new WorkerRegistryService(store), retentionService, new StalledExecutionEscalationService(stalledDetector, diagnostics), new ExecutionResourceMonitor(store), { store });
    return { health, diagnostics, doctor, checker, stalledDetector, retentionService, logger, metrics, workspaceRoot: wsRoot };
}
//# sourceMappingURL=governance-bootstrap.js.map
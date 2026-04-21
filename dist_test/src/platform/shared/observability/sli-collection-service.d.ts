/**
 * @fileoverview SLI Collection Service
 *
 * Wires up HealthService and MetricsService to the SloAlertingService SLI
 * collection pipeline, enabling automatic SLI data collection for the minimum
 * SLO set defined in the SLO Alerting contract.
 *
 * Collected SLIs:
 * - task_success_rate      (platform layer)
 * - approval_delivery_availability  (interaction layer)
 * - recovery_success_rate  (platform layer)
 * - tier1_event_delivery_latency   (system layer)
 * - db_writability        (system layer)
 * - queue_backlog_pressure (system layer)
 * - provider_health_rate   (system layer)
 * - memory_pressure        (system layer)
 *
 * @see docs_zh/contracts/slo_alerting_and_runbook_contract.md
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { HealthService } from "./health-service.js";
import type { MetricsService } from "./metrics-service.js";
import { SloAlertingService, type SliKind, type SloDefinition } from "./slo-alerting-service.js";
export interface SliCollectionServiceOptions {
    /** Interval in ms between automatic SLI collections (default: 60000) */
    collectionIntervalMs?: number;
    /** Whether to auto-start the collection loop (default: false) */
    autoStart?: boolean;
}
export interface SliCollectionSummary {
    collectedAt: string;
    sliCount: number;
    sliKinds: SliKind[];
    errors: string[];
}
/**
 * Default SLO definitions for the minimum SLO set.
 * These map to the SLI kinds collected by this service.
 */
export declare const DEFAULT_SLO_DEFINITIONS: Array<Omit<SloDefinition, "id" | "status" | "createdAt" | "updatedAt">>;
export declare class SliCollectionService {
    private readonly db;
    private readonly healthService;
    private readonly metricsService;
    private readonly sloAlertingService;
    private readonly collectionIntervalMs;
    private intervalHandle;
    private readonly errors;
    constructor(db: AuthoritativeSqlDatabase, healthService: HealthService, metricsService: MetricsService, sloAlertingService: SloAlertingService, options?: SliCollectionServiceOptions);
    /**
     * Initialize default SLO definitions if they don't already exist.
     * Safe to call multiple times - idempotent.
     */
    initializeDefaultSlos(): SloDefinition[];
    /**
     * Start automatic periodic SLI collection.
     */
    start(): void;
    /**
     * Stop automatic periodic SLI collection.
     */
    stop(): void;
    /**
     * Collect all SLIs from HealthService and MetricsService, feeding them
     * into the SloAlertingService for storage and SLO evaluation.
     *
     * This is also called automatically when the collection loop is running.
     * @returns Summary of collected SLIs
     */
    collectAllSlis(): SliCollectionSummary;
    private collectTaskSuccessRate;
    private collectApprovalAvailability;
    private collectRecoverySuccessRate;
    private collectTier1DeliveryLatency;
    private collectDbWritability;
    private collectQueueBacklog;
    private collectProviderHealthRate;
    private collectMemoryPressure;
}

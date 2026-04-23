/**
 * HA Program Service
 *
 * Tracks and reports on the High Availability transition program for moving from
 * single-node SQLite runtime to a distributed, HA-capable architecture. Monitors
 * readiness of key infrastructure components (coordinator, postgres, redis, distributed lock)
 * and produces reports used to determine when environment promotion is safe.
 *
 * The HA transition progresses through phases:
 * - Phase 1: Register HA coordinator readiness and epoch fencing integration
 * - Phase 2: Promote PostgreSQL authoritative store and migration compatibility
 * - Phase 3: Promote Redis queue and distributed locking with failover rehearsals
 *
 * @see docs_zh/architecture/00-platform-architecture.md for HA architecture details
 * @see docs_zh/contracts/release_rollout_and_rollback_contract.md for rollout phases
 */
import { type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { ArtifactRef, EnvironmentName } from "../../platform/contracts/types/domain.js";
/** Input options for building an HA program report */
export interface HaProgramInput {
    /** Target environment name for the HA transition */
    environment: EnvironmentName;
    /** Optional ISO timestamp to use as the report generation time */
    generatedAt?: string;
}
/** Status of a single HA-transitionable component */
export interface HaProgramComponent {
    /** Component identifier (coordinator, postgres, redis_queue, distributed_lock) */
    componentId: "coordinator" | "postgres" | "redis_queue" | "distributed_lock";
    /** Current operational mode of the component */
    currentMode: string;
    /** Target HA mode the component is transitioning to */
    targetMode: string;
    /** Whether the component is ready for HA transition */
    ready: boolean;
    /** List of blocking issues preventing transition (empty if ready) */
    blockers: string[];
}
/** Complete HA program report for an environment */
export interface HaProgramReport {
    /** Unique identifier for this report */
    reportId: string;
    /** ISO timestamp when the report was generated */
    generatedAt: string;
    /** Environment this report covers */
    environment: EnvironmentName;
    /** Overall HA readiness status */
    overallStatus: "warning" | "fail" | "pass";
    /** Count of workers currently active in the environment */
    activeWorkerCount: number;
    /** Count of active execution leases */
    activeLeaseCount: number;
    /** Per-component readiness details */
    components: HaProgramComponent[];
    /** Ordered list of rollout phases for HA transition */
    rolloutPhases: string[];
}
/** Result of exporting an HA program report */
export interface HaProgramExportResult {
    /** The generated HA program report */
    report: HaProgramReport;
    /** Reference to the JSON artifact */
    jsonArtifact: ArtifactRef;
    /** Reference to the Markdown artifact */
    markdownArtifact: ArtifactRef;
}
/** Configuration options for the HAProgramService */
export interface HaProgramServiceOptions {
    /** Options for the artifact store */
    artifactStoreOptions?: ArtifactStoreOptions;
}
/**
 * Service for tracking High Availability transition readiness.
 *
 * This service monitors the readiness of infrastructure components required for
 * HA operation and produces reports that determine when an environment can be
 * safely promoted to HA-capable status. It checks readiness records for each
 * component and produces blocking issues when prerequisites are not met.
 */
export declare class HaProgramService {
    private readonly store;
    private readonly artifactStore;
    constructor(store: AuthoritativeTaskStore, options?: HaProgramServiceOptions);
    /**
     * Builds an HA program report for the specified environment.
     *
     * Collects readiness records for all HA-critical components, determines their
     * current and target modes, and evaluates whether each component is ready for
     * HA transition. The overall status is determined by the readiness of all components:
     * - "pass": All components are ready
     * - "fail": Coordinator or postgres are not ready (critical blockers)
     * - "warning": Other components are not ready but critical components are OK
     *
     * @param input - Environment and optional generation timestamp
     * @returns Complete HA program report with component readiness details
     */
    buildReport(input: HaProgramInput): HaProgramReport;
    /**
     * Exports an HA program report as JSON and Markdown artifacts.
     *
     * @param input - Environment and optional generation timestamp
     * @returns The report plus artifact references
     */
    exportReport(input: HaProgramInput): HaProgramExportResult;
}

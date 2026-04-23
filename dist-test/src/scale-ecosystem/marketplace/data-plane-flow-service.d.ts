/**
 * Data Plane Flow Service
 *
 * Manages data movement and object lifecycle across the data plane. Handles
 * analytics facts, archive bundles, replay datasets, and cross-namespace
 * data movement jobs. Enforces movement policies based on source and target
 * plane types to prevent unauthorized data exfiltration.
 *
 * Supported movement types and their rules:
 * - analytics_etl: transactional/artifact -> analytics only
 * - archive_compaction: memory_archive -> memory_archive only
 * - replay_dataset_build: any non-analytics -> replay
 * - artifact_lifecycle_move: artifact -> artifact only
 *
 * Cross-namespace movement is prohibited at tenant, organization, and workspace boundaries.
 *
 * @see docs_zh/architecture/00-platform-architecture.md for data plane architecture
 */
import { type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AnalyticsFactRecord, ArchiveBundleRecord, ArtifactRef, DataMovementJobRecord, DataNamespacePlane, ReplayDatasetRecord } from "../../platform/contracts/types/domain.js";
/** Input for creating an analytics fact record */
export interface CreateAnalyticsFactInput {
    /** Optional fact ID (auto-generated if not provided) */
    factId?: string;
    /** Namespace where this fact is recorded */
    namespaceId: string;
    /** Name of the metric being recorded */
    metricName: string;
    /** Optional dimensions for the metric */
    dimensions?: Record<string, unknown>;
    /** Numeric value of the fact */
    value: number;
    /** Start of the measurement window */
    windowStart: string;
    /** End of the measurement window */
    windowEnd: string;
    /** Reference to the source of this fact */
    sourceRef: string;
    /** Capture timestamp override */
    capturedAt?: string;
}
/** Input for creating an archive bundle */
export interface CreateArchiveBundleInput {
    /** Optional bundle ID (auto-generated if not provided) */
    bundleId?: string;
    /** Namespace for the archive bundle */
    namespaceId: string;
    /** Type of archive bundle */
    bundleType: string;
    /** References to archived objects */
    sourceRefs: string[];
    /** Reference to the bundle summary */
    summaryRef: string;
    /** Creation timestamp override */
    createdAt?: string;
}
/** Input for creating a replay dataset */
export interface CreateReplayDatasetInput {
    /** Optional dataset ID (auto-generated if not provided) */
    datasetId?: string;
    /** Namespace for the replay dataset */
    namespaceId: string;
    /** Type of replay dataset */
    datasetType: string;
    /** References to sample objects */
    sampleRefs: string[];
    /** References to ground truth objects */
    truthRefs: string[];
    /** Version identifier */
    version: string;
    /** Creation timestamp override */
    createdAt?: string;
}
/** Input for starting a data movement job */
export interface StartDataMovementJobInput {
    /** Optional job ID (auto-generated if not provided) */
    jobId?: string;
    /** Source namespace ID */
    sourceNamespaceId: string;
    /** Target namespace ID */
    targetNamespaceId: string;
    /** Type of movement to perform */
    movementType: DataMovementJobRecord["movementType"];
    /** References to objects being moved */
    inputRefs: string[];
    /** Start timestamp override */
    startedAt?: string;
}
/** Input for completing a data movement job */
export interface CompleteDataMovementJobInput {
    /** Job ID to complete */
    jobId: string;
    /** Final status of the job */
    status?: Extract<DataMovementJobRecord["status"], "completed" | "failed" | "cancelled">;
    /** Optional job report with details */
    report?: Record<string, unknown>;
    /** Completion timestamp override */
    finishedAt?: string;
}
/** Input for building a data plane summary */
export interface DataPlaneSummaryInput {
    /** Optional tenant filter */
    tenantId?: string | null;
    /** Generation timestamp override */
    generatedAt?: string;
}
/** Summary report of data plane state */
export interface DataPlaneSummary {
    /** Unique report identifier */
    reportId: string;
    /** Generation timestamp */
    generatedAt: string;
    /** Tenant scope of the summary (null for global) */
    tenantId: string | null;
    /** Namespace counts by plane type */
    namespacesByPlane: Record<DataNamespacePlane, number>;
    /** Totals of data objects across the plane */
    totals: {
        analyticsFacts: number;
        archiveBundles: number;
        replayDatasets: number;
        movementJobs: number;
    };
    /** Movement job counts by status */
    movementJobsByStatus: Record<DataMovementJobRecord["status"], number>;
    /** Recent movement jobs for review */
    recentJobs: Array<{
        jobId: string;
        movementType: DataMovementJobRecord["movementType"];
        sourcePlane: DataNamespacePlane;
        targetPlane: DataNamespacePlane;
        status: DataMovementJobRecord["status"];
        tenantId: string | null;
        startedAt: string;
        finishedAt: string | null;
    }>;
}
/** Result of exporting a data plane summary */
export interface DataPlaneExportResult {
    /** The generated summary */
    summary: DataPlaneSummary;
    /** Reference to the JSON artifact */
    jsonArtifact: ArtifactRef;
    /** Reference to the Markdown artifact */
    markdownArtifact: ArtifactRef;
}
/** Options for the DataPlaneFlowService */
export interface DataPlaneFlowServiceOptions {
    /** Options for the artifact store */
    artifactStoreOptions?: ArtifactStoreOptions;
}
/**
 * Service for managing data plane flows and object lifecycle.
 *
 * Handles creation of analytics facts, archive bundles, and replay datasets.
 * Manages cross-namespace data movement jobs with policy enforcement that
 * prevents unauthorized data flow between planes and across tenant boundaries.
 */
export declare class DataPlaneFlowService {
    private readonly db;
    private readonly store;
    private readonly artifactStore;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: DataPlaneFlowServiceOptions);
    /**
     * Records an analytics fact in the data plane.
     *
     * @param input - Analytics fact creation parameters
     * @returns The created analytics fact record
     */
    createAnalyticsFact(input: CreateAnalyticsFactInput): AnalyticsFactRecord;
    /**
     * Creates an archive bundle in the memory archive plane.
     *
     * @param input - Archive bundle creation parameters
     * @returns The created archive bundle record
     */
    createArchiveBundle(input: CreateArchiveBundleInput): ArchiveBundleRecord;
    /**
     * Creates a replay dataset in the replay plane.
     *
     * @param input - Replay dataset creation parameters
     * @returns The created replay dataset record
     */
    createReplayDataset(input: CreateReplayDatasetInput): ReplayDatasetRecord;
    /**
     * Starts a data movement job between namespaces.
     *
     * Validates scope compatibility (no cross-tenant/organization/workspace movement)
     * and checks that the movement type is allowed for the source/target plane combination.
     *
     * @param input - Movement job parameters
     * @returns The created movement job record
     * @throws PolicyDeniedError if movement is not allowed by policy
     */
    startMovementJob(input: StartDataMovementJobInput): DataMovementJobRecord;
    /**
     * Completes a data movement job with final status and optional report.
     *
     * @param input - Completion parameters
     * @returns The updated movement job record
     */
    completeMovementJob(input: CompleteDataMovementJobInput): DataMovementJobRecord;
    /**
     * Builds a summary report of the data plane state.
     *
     * @param input - Optional tenant filter and generation timestamp
     * @returns Data plane summary with namespace counts and movement job status
     */
    buildSummary(input?: DataPlaneSummaryInput): DataPlaneSummary;
    /**
     * Exports the data plane summary as JSON and Markdown artifacts.
     *
     * @param input - Optional tenant filter and generation timestamp
     * @returns Summary plus artifact references
     */
    exportSummary(input?: DataPlaneSummaryInput): DataPlaneExportResult;
    /**
     * Validates that a namespace exists and is of the expected plane type.
     *
     * @param namespaceId - Namespace to validate
     * @param plane - Expected plane type
     * @returns The validated namespace record
     * @throws ValidationError if namespace doesn't exist or has wrong plane type
     */
    private requireNamespace;
    /** Validates and returns a namespace by ID, throwing if not found */
    private requireNamespaceById;
    /**
     * Enforces cross-namespace movement boundaries.
     *
     * Prohibits movement between namespaces that have different tenant,
     * organization, or workspace scopes. This prevents data exfiltration
     * across organizational boundaries.
     *
     * @throws TenantBoundaryError if movement crosses a boundary
     */
    private assertScopeCompatibility;
}

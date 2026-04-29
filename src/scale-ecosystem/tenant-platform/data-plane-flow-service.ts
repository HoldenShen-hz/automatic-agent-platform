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

import { ArtifactStore, type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type {
  AnalyticsFactRecord,
  ArchiveBundleRecord,
  ArtifactRef,
  DataMovementJobRecord,
  DataNamespacePlane,
  DataNamespaceRecord,
  ReplayDatasetRecord,
} from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { PolicyDeniedError, StorageError, TenantBoundaryError, ValidationError } from "../../platform/contracts/errors.js";

/**
 * Validates an identifier string against the allowed pattern.
 */
function assertIdentifier(value: string, code: string): string {
  if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(value)) {
    throw new ValidationError(code, code);
  }
  return value;
}

/**
 * Validates a non-empty string after trimming whitespace.
 */
function assertNonEmpty(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(code, code);
  }
  return normalized;
}

/**
 * Validates an ISO timestamp string.
 */
function assertIsoTimestamp(value: string, code: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(code, code);
  }
  return parsed.toISOString();
}

/** Serializes a value to JSON string */
function toJson(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Determines whether a data movement type is allowed between the given planes.
 *
 * Movement policies prevent unauthorized data flow, particularly from analytics
 * or more sensitive planes to less restricted ones.
 *
 * @param movementType - Type of movement to perform
 * @param sourcePlane - Plane where data currently resides
 * @param targetPlane - Plane where data will be moved
 * @returns true if movement is allowed, false otherwise
 */
function isMovementAllowed(
  movementType: DataMovementJobRecord["movementType"],
  sourcePlane: DataNamespacePlane,
  targetPlane: DataNamespacePlane,
): boolean {
  switch (movementType) {
    case "analytics_etl":
      // Analytics ETL can only flow into analytics plane from transactional or artifact
      return targetPlane === "analytics" && (sourcePlane === "transactional" || sourcePlane === "artifact");
    case "archive_compaction":
      // Archive compaction stays within memory_archive
      return sourcePlane === "memory_archive" && targetPlane === "memory_archive";
    case "replay_dataset_build":
      // Replay datasets can be built from any non-analytics source
      return targetPlane === "replay" && sourcePlane !== "analytics";
    case "artifact_lifecycle_move":
      // Artifact moves stay within artifact plane
      return sourcePlane === "artifact" && targetPlane === "artifact";
    default:
      return false;
  }
}

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
 * Builds a Markdown summary of the data plane state.
 */
function buildMarkdownSummary(summary: DataPlaneSummary): string {
  return [
    "# Data Plane Summary",
    "",
    `- Report ID: \`${summary.reportId}\``,
    `- Generated At: \`${summary.generatedAt}\``,
    `- Tenant Scope: \`${summary.tenantId ?? "all"}\``,
    "",
    "## Namespace Counts",
    "",
    `- transactional: ${summary.namespacesByPlane.transactional}`,
    `- artifact: ${summary.namespacesByPlane.artifact}`,
    `- analytics: ${summary.namespacesByPlane.analytics}`,
    `- memory_archive: ${summary.namespacesByPlane.memory_archive}`,
    `- replay: ${summary.namespacesByPlane.replay}`,
    "",
    "## Object Totals",
    "",
    `- analytics facts: ${summary.totals.analyticsFacts}`,
    `- archive bundles: ${summary.totals.archiveBundles}`,
    `- replay datasets: ${summary.totals.replayDatasets}`,
    `- movement jobs: ${summary.totals.movementJobs}`,
    "",
    "## Movement Jobs",
    "",
    ...summary.recentJobs.slice(0, 10).map(
      (job) =>
        `- \`${job.jobId}\` ${job.movementType} ${job.sourcePlane}->${job.targetPlane} status=${job.status} tenant=${job.tenantId ?? "global"}`,
    ),
  ].join("\n");
}

/**
 * Service for managing data plane flows and object lifecycle.
 *
 * Handles creation of analytics facts, archive bundles, and replay datasets.
 * Manages cross-namespace data movement jobs with policy enforcement that
 * prevents unauthorized data flow between planes and across tenant boundaries.
 */
export class DataPlaneFlowService {
  private readonly artifactStore: ArtifactStore;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: DataPlaneFlowServiceOptions = {},
  ) {
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
  }

  /**
   * Records an analytics fact in the data plane.
   *
   * @param input - Analytics fact creation parameters
   * @returns The created analytics fact record
   */
  public createAnalyticsFact(input: CreateAnalyticsFactInput): AnalyticsFactRecord {
    return this.db.transaction(() => {
      const namespace = this.requireNamespace(input.namespaceId, "analytics");
      const record: AnalyticsFactRecord = {
        factId: assertIdentifier(input.factId ?? newId("fact"), "data_plane.invalid_fact_id"),
        namespaceId: namespace.namespaceId,
        tenantId: namespace.tenantId,
        organizationId: namespace.organizationId,
        workspaceId: namespace.workspaceId,
        metricName: assertIdentifier(input.metricName, "data_plane.invalid_metric_name"),
        dimensionJson: toJson(input.dimensions ?? {}),
        value: input.value,
        windowStart: assertIsoTimestamp(input.windowStart, "data_plane.invalid_window_start"),
        windowEnd: assertIsoTimestamp(input.windowEnd, "data_plane.invalid_window_end"),
        sourceRef: assertNonEmpty(input.sourceRef, "data_plane.invalid_source_ref"),
        capturedAt: assertIsoTimestamp(input.capturedAt ?? nowIso(), "data_plane.invalid_captured_at"),
      };
      this.store.operations.insertAnalyticsFactRecord(record);
      return record;
    });
  }

  /**
   * Creates an archive bundle in the memory archive plane.
   *
   * @param input - Archive bundle creation parameters
   * @returns The created archive bundle record
   */
  public createArchiveBundle(input: CreateArchiveBundleInput): ArchiveBundleRecord {
    return this.db.transaction(() => {
      const namespace = this.requireNamespace(input.namespaceId, "memory_archive");
      const record: ArchiveBundleRecord = {
        bundleId: assertIdentifier(input.bundleId ?? newId("archive"), "data_plane.invalid_bundle_id"),
        namespaceId: namespace.namespaceId,
        tenantId: namespace.tenantId,
        organizationId: namespace.organizationId,
        workspaceId: namespace.workspaceId,
        bundleType: assertIdentifier(input.bundleType, "data_plane.invalid_bundle_type"),
        sourceRefsJson: toJson(input.sourceRefs.map((entry) => assertNonEmpty(entry, "data_plane.invalid_source_ref"))),
        summaryRef: assertNonEmpty(input.summaryRef, "data_plane.invalid_summary_ref"),
        createdAt: assertIsoTimestamp(input.createdAt ?? nowIso(), "data_plane.invalid_created_at"),
      };
      this.store.operations.insertArchiveBundleRecord(record);
      return record;
    });
  }

  /**
   * Creates a replay dataset in the replay plane.
   *
   * @param input - Replay dataset creation parameters
   * @returns The created replay dataset record
   */
  public createReplayDataset(input: CreateReplayDatasetInput): ReplayDatasetRecord {
    return this.db.transaction(() => {
      const namespace = this.requireNamespace(input.namespaceId, "replay");
      const record: ReplayDatasetRecord = {
        datasetId: assertIdentifier(input.datasetId ?? newId("dataset"), "data_plane.invalid_dataset_id"),
        namespaceId: namespace.namespaceId,
        tenantId: namespace.tenantId,
        organizationId: namespace.organizationId,
        workspaceId: namespace.workspaceId,
        datasetType: assertIdentifier(input.datasetType, "data_plane.invalid_dataset_type"),
        sampleRefsJson: toJson(input.sampleRefs.map((entry) => assertNonEmpty(entry, "data_plane.invalid_sample_ref"))),
        truthRefsJson: toJson(input.truthRefs.map((entry) => assertNonEmpty(entry, "data_plane.invalid_truth_ref"))),
        version: assertIdentifier(input.version, "data_plane.invalid_dataset_version"),
        createdAt: assertIsoTimestamp(input.createdAt ?? nowIso(), "data_plane.invalid_created_at"),
      };
      this.store.operations.insertReplayDatasetRecord(record);
      return record;
    });
  }

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
  public startMovementJob(input: StartDataMovementJobInput): DataMovementJobRecord {
    return this.db.transaction(() => {
      const sourceNamespace = this.requireNamespaceById(input.sourceNamespaceId);
      const targetNamespace = this.requireNamespaceById(input.targetNamespaceId);

      // Verify scope compatibility (cross-boundary movement prohibited)
      this.assertScopeCompatibility(sourceNamespace, targetNamespace);

      // Check movement policy for source/target plane combination
      if (!isMovementAllowed(input.movementType, sourceNamespace.plane, targetNamespace.plane)) {
        throw new PolicyDeniedError("data_plane.movement_not_allowed", "data_plane.movement_not_allowed", {
          retryable: false,
          details: {
            movementType: input.movementType,
            sourcePlane: sourceNamespace.plane,
            targetPlane: targetNamespace.plane,
          },
        });
      }

      const record: DataMovementJobRecord = {
        jobId: assertIdentifier(input.jobId ?? newId("movement"), "data_plane.invalid_job_id"),
        tenantId: targetNamespace.tenantId ?? sourceNamespace.tenantId,
        organizationId: targetNamespace.organizationId ?? sourceNamespace.organizationId,
        workspaceId: targetNamespace.workspaceId ?? sourceNamespace.workspaceId,
        sourceNamespaceId: sourceNamespace.namespaceId,
        targetNamespaceId: targetNamespace.namespaceId,
        sourcePlane: sourceNamespace.plane,
        targetPlane: targetNamespace.plane,
        movementType: input.movementType,
        inputRefsJson: toJson(input.inputRefs.map((entry) => assertNonEmpty(entry, "data_plane.invalid_input_ref"))),
        status: "pending",
        startedAt: assertIsoTimestamp(input.startedAt ?? nowIso(), "data_plane.invalid_started_at"),
        finishedAt: null,
        reportJson: null,
      };
      this.store.operations.upsertDataMovementJobRecord(record);
      return record;
    });
  }

  /**
   * Completes a data movement job with final status and optional report.
   *
   * @param input - Completion parameters
   * @returns The updated movement job record
   */
  public completeMovementJob(input: CompleteDataMovementJobInput): DataMovementJobRecord {
    return this.db.transaction(() => {
      const job = this.store.operations.getDataMovementJobRecord(assertIdentifier(input.jobId, "data_plane.invalid_job_id"));
      if (job == null) {
        throw new StorageError(`data_plane.movement_job_not_found:${input.jobId}`, `data_plane.movement_job_not_found:${input.jobId}`, {
          statusCode: 404,
          retryable: false,
          details: { jobId: input.jobId },
        });
      }
      const updated: DataMovementJobRecord = {
        ...job,
        status: input.status ?? "completed",
        finishedAt: assertIsoTimestamp(input.finishedAt ?? nowIso(), "data_plane.invalid_finished_at"),
        reportJson: input.report == null ? job.reportJson : toJson(input.report),
      };
      this.store.operations.upsertDataMovementJobRecord(updated);
      return updated;
    });
  }

  /**
   * Builds a summary report of the data plane state.
   *
   * @param input - Optional tenant filter and generation timestamp
   * @returns Data plane summary with namespace counts and movement job status
   */
  public buildSummary(input: DataPlaneSummaryInput = {}): DataPlaneSummary {
    const generatedAt = assertIsoTimestamp(input.generatedAt ?? nowIso(), "data_plane.invalid_generated_at");
    const tenantId = input.tenantId ?? null;

    // Fetch all relevant records within the tenant scope
    const namespaces = this.store.organization.listDataNamespaces({ tenantId, limit: 500 });
    const analyticsFacts = this.store.operations.listAnalyticsFactRecords({ tenantId, limit: 500 });
    const archiveBundles = this.store.operations.listArchiveBundleRecords({ tenantId, limit: 500 });
    const replayDatasets = this.store.operations.listReplayDatasetRecords({ tenantId, limit: 500 });
    const movementJobs = this.store.operations.listDataMovementJobRecords({ tenantId, limit: 500 });

    // Count namespaces by plane type
    const namespacesByPlane: Record<DataNamespacePlane, number> = {
      transactional: 0,
      artifact: 0,
      analytics: 0,
      memory_archive: 0,
      replay: 0,
    };
    for (const namespace of namespaces) {
      namespacesByPlane[namespace.plane] += 1;
    }

    // Count movement jobs by status
    const movementJobsByStatus: Record<DataMovementJobRecord["status"], number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const job of movementJobs) {
      movementJobsByStatus[job.status] += 1;
    }

    return {
      reportId: newId("data_plane_report"),
      generatedAt,
      tenantId,
      namespacesByPlane,
      totals: {
        analyticsFacts: analyticsFacts.length,
        archiveBundles: archiveBundles.length,
        replayDatasets: replayDatasets.length,
        movementJobs: movementJobs.length,
      },
      movementJobsByStatus,
      recentJobs: movementJobs.slice(0, 20).map((job) => ({
        jobId: job.jobId,
        movementType: job.movementType,
        sourcePlane: job.sourcePlane,
        targetPlane: job.targetPlane,
        status: job.status,
        tenantId: job.tenantId,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      })),
    };
  }

  /**
   * Exports the data plane summary as JSON and Markdown artifacts.
   *
   * @param input - Optional tenant filter and generation timestamp
   * @returns Summary plus artifact references
   */
  public exportSummary(input: DataPlaneSummaryInput = {}): DataPlaneExportResult {
    const summary = this.buildSummary(input);
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId: "data-plane-flow",
      executionId: null,
      stepId: "data-plane-summary",
      kind: "data_plane_summary",
      fileName: `data-plane-summary-${summary.reportId}.json`,
      content: summary,
      lineage: {
        service: "DataPlaneFlowService",
        tenantId: summary.tenantId,
      },
    }).ref;
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId: "data-plane-flow",
      executionId: null,
      stepId: "data-plane-summary",
      kind: "data_plane_summary_markdown",
      fileName: `data-plane-summary-${summary.reportId}.md`,
      content: buildMarkdownSummary(summary),
      lineage: {
        service: "DataPlaneFlowService",
        tenantId: summary.tenantId,
      },
    }).ref;

    return {
      summary,
      jsonArtifact,
      markdownArtifact,
    };
  }

  /**
   * Validates that a namespace exists and is of the expected plane type.
   *
   * @param namespaceId - Namespace to validate
   * @param plane - Expected plane type
   * @returns The validated namespace record
   * @throws ValidationError if namespace doesn't exist or has wrong plane type
   */
  private requireNamespace(namespaceId: string, plane: DataNamespacePlane): DataNamespaceRecord {
    const namespace = this.requireNamespaceById(namespaceId);
    if (namespace.plane !== plane) {
      throw new ValidationError(
        `data_plane.namespace_plane_mismatch:${namespaceId}:${namespace.plane}`,
        `data_plane.namespace_plane_mismatch:${namespaceId}:${namespace.plane}`,
        {
          retryable: false,
          details: {
            namespaceId,
            expectedPlane: plane,
            actualPlane: namespace.plane,
          },
        },
      );
    }
    return namespace;
  }

  /** Validates and returns a namespace by ID, throwing if not found */
  private requireNamespaceById(namespaceId: string): DataNamespaceRecord {
    const namespace = this.store.organization.getDataNamespaceRecord(assertIdentifier(namespaceId, "data_plane.invalid_namespace_id"));
    if (namespace == null) {
      throw new StorageError(`data_plane.namespace_not_found:${namespaceId}`, `data_plane.namespace_not_found:${namespaceId}`, {
        statusCode: 404,
        retryable: false,
        details: { namespaceId },
      });
    }
    return namespace;
  }

  /**
   * Enforces cross-namespace movement boundaries.
   *
   * Prohibits movement between namespaces that have different tenant,
   * organization, or workspace scopes. This prevents data exfiltration
   * across organizational boundaries.
   *
   * A namespace with a null scope (global namespace) is incompatible with
   * any namespace that has a non-null scope of the same type. This prevents
   * the global namespace from freely exchanging data with any tenant-scoped,
   * organization-scoped, or workspace-scoped namespace.
   *
   * @throws TenantBoundaryError if movement crosses a boundary
   */
  private assertScopeCompatibility(sourceNamespace: DataNamespaceRecord, targetNamespace: DataNamespaceRecord): void {
    // Check tenant boundary: null (global) is incompatible with any non-null (tenant-scoped)
    // Explicitly handle the null boundary case to prevent bypass when tenantId is null
    const sourceTenantNull = sourceNamespace.tenantId === null;
    const targetTenantNull = targetNamespace.tenantId === null;
    if (sourceTenantNull !== targetTenantNull) {
      // One is global (null) and the other is tenant-scoped (non-null) - this is a boundary violation
      throw new TenantBoundaryError("data_plane.cross_tenant_movement_denied", "data_plane.cross_tenant_movement_denied", {
        retryable: false,
        details: {
          sourceTenantId: sourceNamespace.tenantId,
          targetTenantId: targetNamespace.tenantId,
        },
      });
    }
    // Both null (global-to-global) is allowed; both non-null must match
    if (!sourceTenantNull && sourceNamespace.tenantId !== targetNamespace.tenantId) {
      throw new TenantBoundaryError("data_plane.cross_tenant_movement_denied", "data_plane.cross_tenant_movement_denied", {
        retryable: false,
        details: {
          sourceTenantId: sourceNamespace.tenantId,
          targetTenantId: targetNamespace.tenantId,
        },
      });
    }

    // Check organization boundary: null (global) is incompatible with any non-null (org-scoped)
    const sourceOrgNull = sourceNamespace.organizationId === null;
    const targetOrgNull = targetNamespace.organizationId === null;
    if (sourceOrgNull !== targetOrgNull) {
      throw new TenantBoundaryError("data_plane.cross_organization_movement_denied", "data_plane.cross_organization_movement_denied", {
        retryable: false,
        details: {
          sourceOrganizationId: sourceNamespace.organizationId,
          targetOrganizationId: targetNamespace.organizationId,
        },
      });
    }
    if (!sourceOrgNull && sourceNamespace.organizationId !== targetNamespace.organizationId) {
      throw new TenantBoundaryError("data_plane.cross_organization_movement_denied", "data_plane.cross_organization_movement_denied", {
        retryable: false,
        details: {
          sourceOrganizationId: sourceNamespace.organizationId,
          targetOrganizationId: targetNamespace.organizationId,
        },
      });
    }

    // Check workspace boundary: null (global) is incompatible with any non-null (workspace-scoped)
    const sourceWsNull = sourceNamespace.workspaceId === null;
    const targetWsNull = targetNamespace.workspaceId === null;
    if (sourceWsNull !== targetWsNull) {
      throw new TenantBoundaryError("data_plane.cross_workspace_movement_denied", "data_plane.cross_workspace_movement_denied", {
        retryable: false,
        details: {
          sourceWorkspaceId: sourceNamespace.workspaceId,
          targetWorkspaceId: targetNamespace.workspaceId,
        },
      });
    }
    if (!sourceWsNull && sourceNamespace.workspaceId !== targetNamespace.workspaceId) {
      throw new TenantBoundaryError("data_plane.cross_workspace_movement_denied", "data_plane.cross_workspace_movement_denied", {
        retryable: false,
        details: {
          sourceWorkspaceId: sourceNamespace.workspaceId,
          targetWorkspaceId: targetNamespace.workspaceId,
        },
      });
    }
  }
}

/**
 * Platform Operator Service
 *
 * Monitors and reports on the execution plane health for platform operators.
 * Provides a unified view of workers, execution tickets, leases, readiness,
 * and topology across the entire multi-tenant platform.
 *
 * This service is responsible for:
 * - Worker fleet monitoring: Tracking worker health, staleness, and trust status
 * - Execution plane metrics: Ticket and lease counts by status
 * - Readiness verification: Ensuring all infrastructure components are ready
 * - Promotion eligibility: Determining if an environment can be promoted
 * - Risk identification: Detecting deployment risks before they cause incidents
 *
 * The report aggregates data from multiple sources:
 * - Worker snapshots: Registration and heartbeat status
 * - Execution tickets: Pending/claimed/consumed work items
 * - Execution leases: Active/expired lease state
 * - Environment readiness: Infrastructure component status
 * - Stable release package: Evidence-based promotion criteria
 *
 * @see stable-release-package.ts for the release package that feeds promotion criteria
 * @see docs_zh/contracts/platform_operator_contract.md
 */

import { ArtifactStore, type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { toWorkerSchedulingStatus } from "../../platform/execution/worker-pool/worker-scheduling-status.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import {
  createStableReleasePackage,
  type StableReleasePackageReport,
} from "../../platform/shared/stability/stable-release-package.js";
import type { StableGateTargetStatus } from "../../platform/shared/stability/stable-release-gate.js";
import type {
  ArtifactRef,
  DataNamespaceRecord,
  DeploymentBindingRecord,
  EnvironmentName,
  EnvironmentReadinessComponentType,
  EnvironmentReadinessRecord,
  ExecutionLeaseRecord,
  ExecutionTicketRecord,
  TenantRecord,
  WorkerSchedulingStatus,
  WorkerSnapshotRecord,
} from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { ValidationError } from "../../platform/contracts/errors.js";

/** Logger for platform operator events with limited retention */
const platformOperatorLogger = new StructuredLogger({ retentionLimit: 50 });

/** Input for building a platform operator report */
export interface PlatformOperatorBuildInput {
  environment: EnvironmentName;
  evidenceRootDir: string;
  packageOutputDir: string;
  targetStatus?: StableGateTargetStatus;
  generatedAt?: string;
}

/** Summary of worker fleet status */
export interface PlatformOperatorExecutionPlaneSummary {
  workerCounts: Record<WorkerSchedulingStatus | "untrusted" | "stale", number> & {
    total: number;
    totalAvailableSlots: number;
  };
  ticketCounts: Record<ExecutionTicketRecord["status"], number>;
  leaseCounts: Record<ExecutionLeaseRecord["status"], number>;
  readinessSummary: Array<{
    componentType: EnvironmentReadinessComponentType;
    total: number;
    ready: number;
    notReady: number;
    stale: number;
    allReady: boolean;
  }>;
  topology: {
    organizations: number;
    workspaces: number;
    tenants: number;
    deploymentBindings: number;
    dataNamespaces: number;
  };
  staleWorkerIds: string[];
  untrustedWorkerIds: string[];
  promotionRisks: string[];
}

/** Complete platform operator report */
export interface PlatformOperatorReport {
  reportId: string;
  componentId: "execution_plane";
  generatedAt: string;
  environment: EnvironmentName;
  targetStatus: StableGateTargetStatus;
  currentStatus: StableReleasePackageReport["gate"]["currentStatus"];
  overallVerdict: StableReleasePackageReport["overallVerdict"];
  promoteEligible: boolean;
  executionPlane: PlatformOperatorExecutionPlaneSummary;
  releasePackage: StableReleasePackageReport;
}

/** Export result with artifact references */
export interface PlatformOperatorExportResult {
  report: PlatformOperatorReport;
  jsonArtifact: ArtifactRef;
  markdownArtifact: ArtifactRef;
}

/** Configuration options */
export interface PlatformOperatorServiceOptions {
  artifactStoreOptions?: ArtifactStoreOptions;
  /** Threshold in ms before a worker is considered stale (default: 10 minutes) */
  staleWorkerThresholdMs?: number;
  /** Threshold in ms before readiness is considered stale (default: 24 hours) */
  readinessStaleThresholdMs?: number;
}

/** Required infrastructure components for readiness tracking */
const REQUIRED_READINESS_COMPONENT_TYPES: readonly EnvironmentReadinessComponentType[] = [
  "provider",
  "gateway",
  "sandbox",
  "worker_fleet",
  "artifact_store",
] as const;

/** Validates ISO timestamp format */
function assertIsoTimestamp(value: string, code: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(code, code);
  }
  return parsed.toISOString();
}

/**
 * Safely parses a JSON object from a string, returning an empty object if invalid.
 * Used for parsing component JSON fields that may be malformed.
 */
function parseJsonObject(value: string): Record<string, boolean> {
  const parsed = JSON.parse(value) as unknown;
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const result: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof entry === "boolean") {
      result[key] = entry;
    }
  }
  return result;
}

/** Builds Markdown-formatted platform operator report */
function buildMarkdownReport(report: PlatformOperatorReport): string {
  const lines = [
    "# Platform Operator Report",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Component: \`${report.componentId}\``,
    `- Environment: \`${report.environment}\``,
    `- Target Status: \`${report.targetStatus}\``,
    `- Current Status: \`${report.currentStatus}\``,
    `- Overall Verdict: \`${report.overallVerdict}\``,
    `- Promote Eligible: \`${report.promoteEligible}\``,
    "",
    "## Execution Plane Summary",
    "",
    `- Workers: ${report.executionPlane.workerCounts.total}`,
    `- Available Slots: ${report.executionPlane.workerCounts.totalAvailableSlots}`,
    `- Stale Workers: ${report.executionPlane.staleWorkerIds.length}`,
    `- Untrusted Workers: ${report.executionPlane.untrustedWorkerIds.length}`,
    `- Pending Tickets: ${report.executionPlane.ticketCounts.pending}`,
    `- Claimed Tickets: ${report.executionPlane.ticketCounts.claimed}`,
    `- Active Leases: ${report.executionPlane.leaseCounts.active}`,
    "",
    "## Promotion Risks",
    "",
    ...(report.executionPlane.promotionRisks.length > 0
      ? report.executionPlane.promotionRisks.map((risk) => `- ${risk}`)
      : ["- none"]),
    "",
    "## Readiness Summary",
    "",
    ...report.executionPlane.readinessSummary.map(
      (entry) =>
        `- \`${entry.componentType}\`: ready=${entry.ready}, not_ready=${entry.notReady}, stale=${entry.stale}, total=${entry.total}`,
    ),
    "",
    "## Recommended Commands",
    "",
    ...report.releasePackage.recommendedCommands.map((command) => `- \`${command}\``),
  ];

  return `${lines.join("\n")}\n`;
}

/**
 * Platform Operator Service
 *
 * Provides platform-wide visibility into execution plane health.
 * Used by platform operators to monitor fleet status, identify risks,
 * and determine promotion readiness.
 */
export class PlatformOperatorService {
  private readonly artifactStore: ArtifactStore;
  private readonly staleWorkerThresholdMs: number;
  private readonly readinessStaleThresholdMs: number;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: PlatformOperatorServiceOptions = {},
  ) {
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
    this.staleWorkerThresholdMs = options.staleWorkerThresholdMs ?? 10 * 60 * 1000;
    this.readinessStaleThresholdMs = options.readinessStaleThresholdMs ?? 24 * 60 * 60 * 1000;
  }

  /**
   * Builds a comprehensive platform operator report.
   *
   * Aggregates:
   * - Worker fleet status and counts
   * - Execution ticket and lease state
   * - Infrastructure readiness per component
   * - Tenant topology counts
   * - Stable release package for promotion criteria
   *
   * Determines promotion eligibility based on release package verdict
   * and absence of execution plane risks.
   */
  public buildReport(input: PlatformOperatorBuildInput): PlatformOperatorReport {
    const generatedAt = assertIsoTimestamp(input.generatedAt ?? nowIso(), "platform_operator.invalid_generated_at");
    const targetStatus = input.targetStatus ?? "canary";

    // Build stable release package for promotion criteria
    const packageReport = createStableReleasePackage({
      evidenceRootDir: input.evidenceRootDir,
      outputDir: input.packageOutputDir,
      targetStatus,
    });

    // Collect worker fleet statistics
    const workers = this.store.worker.listWorkerSnapshots();
    const workerCounts: PlatformOperatorExecutionPlaneSummary["workerCounts"] = {
      total: workers.length,
      healthy: 0,
      degraded: 0,
      draining: 0,
      quarantined: 0,
      offline: 0,
      unavailable: 0,
      untrusted: 0,
      stale: 0,
      totalAvailableSlots: 0,
    };

    const staleWorkerIds: string[] = [];
    const untrustedWorkerIds: string[] = [];
    for (const worker of workers) {
      const schedulingStatus = toWorkerSchedulingStatus(worker.status);
      workerCounts[schedulingStatus] += 1;
      const availableSlots = Math.max(
        0,
        worker.maxConcurrency - safeRunningExecutionCount(worker),
      );
      workerCounts.totalAvailableSlots += availableSlots;

      // Track stale workers (no recent heartbeat)
      if (this.isWorkerStale(worker, generatedAt)) {
        staleWorkerIds.push(worker.workerId);
        workerCounts.stale += 1;
      }
      // Track untrusted workers (remote but not verified)
      if (!this.isWorkerTrusted(worker)) {
        untrustedWorkerIds.push(worker.workerId);
        workerCounts.untrusted += 1;
      }
    }

    // Count execution tickets by status
    const ticketCounts: PlatformOperatorExecutionPlaneSummary["ticketCounts"] = {
      pending: this.store.worker.listExecutionTicketsByStatuses(["pending"]).length,
      claimed: this.store.worker.listExecutionTicketsByStatuses(["claimed"]).length,
      consumed: this.store.worker.listExecutionTicketsByStatuses(["consumed"]).length,
      cancelled: this.store.worker.listExecutionTicketsByStatuses(["cancelled"]).length,
      expired: this.store.worker.listExecutionTicketsByStatuses(["expired"]).length,
    };

    // Count execution leases by status
    const leaseCounts: PlatformOperatorExecutionPlaneSummary["leaseCounts"] = {
      active: this.store.worker.listExecutionLeasesByStatuses(["active"]).length,
      expired: this.store.worker.listExecutionLeasesByStatuses(["expired"]).length,
      released: this.store.worker.listExecutionLeasesByStatuses(["released"]).length,
      reclaimed: this.store.worker.listExecutionLeasesByStatuses(["reclaimed"]).length,
      handed_over: this.store.worker.listExecutionLeasesByStatuses(["handed_over"]).length,
    };

    // Build readiness summary per component type
    const readinessRecords = this.store.release.listEnvironmentReadinessRecords(input.environment, { activeOnly: true, limit: 500 });
    const readinessSummary = REQUIRED_READINESS_COMPONENT_TYPES.map((componentType) =>
      this.buildReadinessSummary(componentType, readinessRecords, generatedAt),
    );

    // Collect topology counts
    const organizations = this.store.organization.listOrganizationRecords(500);
    const workspaces = this.store.organization.listWorkspaceRecords({ limit: 500 });
    const tenants = this.store.organization.listTenantRecords({ limit: 500 });
    const deploymentBindings = this.store.organization.listDeploymentBindings({ limit: 500 });
    const dataNamespaces = this.store.organization.listDataNamespaces({ limit: 500 });

    // Collect promotion risks
    const promotionRisks = this.collectPromotionRisks({
      packageReport,
      staleWorkerIds,
      untrustedWorkerIds,
      readinessSummary,
      leaseCounts,
      workers,
      deployments: deploymentBindings,
      tenants,
      dataNamespaces,
    });

    return {
      reportId: newId("platform_operator_report"),
      componentId: "execution_plane",
      generatedAt,
      environment: input.environment,
      targetStatus,
      currentStatus: packageReport.gate.currentStatus,
      overallVerdict: packageReport.overallVerdict,
      promoteEligible: packageReport.overallVerdict === "promote_approved" && promotionRisks.length === 0,
      executionPlane: {
        workerCounts,
        ticketCounts,
        leaseCounts,
        readinessSummary,
        topology: {
          organizations: organizations.length,
          workspaces: workspaces.length,
          tenants: tenants.length,
          deploymentBindings: deploymentBindings.length,
          dataNamespaces: dataNamespaces.length,
        },
        staleWorkerIds,
        untrustedWorkerIds,
        promotionRisks,
      },
      releasePackage: packageReport,
    };
  }

  /**
   * Exports the platform operator report as JSON and Markdown artifacts.
   */
  public exportReport(input: PlatformOperatorBuildInput): PlatformOperatorExportResult {
    const report = this.buildReport(input);
    const taskId = "platform-operator-execution-plane";

    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId,
      kind: "platform_operator_report",
      fileName: "platform-operator-report",
      content: report,
      lineage: {
        componentId: report.componentId,
        targetStatus: report.targetStatus,
        environment: report.environment,
      },
    }).ref;

    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId,
      kind: "platform_operator_summary",
      fileName: "platform-operator-report.md",
      content: buildMarkdownReport(report),
      lineage: {
        componentId: report.componentId,
        targetStatus: report.targetStatus,
        environment: report.environment,
      },
    }).ref;

    return {
      report,
      jsonArtifact,
      markdownArtifact,
    };
  }

  /** Builds readiness summary for a specific component type */
  private buildReadinessSummary(
    componentType: EnvironmentReadinessComponentType,
    readinessRecords: EnvironmentReadinessRecord[],
    generatedAt: string,
  ): PlatformOperatorExecutionPlaneSummary["readinessSummary"][number] {
    const records = readinessRecords.filter((record) => record.componentType === componentType);
    let ready = 0;
    let notReady = 0;
    let stale = 0;

    for (const record of records) {
      if (this.isReadinessStale(record, generatedAt)) {
        stale += 1;
        continue;
      }
      if (!this.isReadinessReady(record)) {
        notReady += 1;
        continue;
      }
      ready += 1;
    }

    return {
      componentType,
      total: records.length,
      ready,
      notReady,
      stale,
      allReady: records.length > 0 && notReady === 0 && stale === 0,
    };
  }

  /**
   * Collects all promotion risks from multiple sources.
   *
   * Checks:
   * - Release package blockers
   * - Stale worker count
   * - Untrusted worker count
   * - Missing or non-ready readiness records
   * - Lease count anomalies
   * - Topology consistency
   */
  private collectPromotionRisks(input: {
    packageReport: StableReleasePackageReport;
    staleWorkerIds: string[];
    untrustedWorkerIds: string[];
    readinessSummary: PlatformOperatorExecutionPlaneSummary["readinessSummary"];
    leaseCounts: PlatformOperatorExecutionPlaneSummary["leaseCounts"];
    workers: WorkerSnapshotRecord[];
    deployments: DeploymentBindingRecord[];
    tenants: TenantRecord[];
    dataNamespaces: DataNamespaceRecord[];
  }): string[] {
    const risks = [...input.packageReport.gate.blockers];

    if (input.staleWorkerIds.length > 0) {
      risks.push(`stale worker snapshots detected: ${input.staleWorkerIds.join(", ")}`);
    }
    if (input.untrustedWorkerIds.length > 0) {
      risks.push(`untrusted workers detected: ${input.untrustedWorkerIds.join(", ")}`);
    }
    for (const entry of input.readinessSummary) {
      if (entry.total === 0) {
        risks.push(`missing readiness records for ${entry.componentType}`);
      } else if (!entry.allReady) {
        risks.push(
          `readiness not fully green for ${entry.componentType} (ready=${entry.ready}, not_ready=${entry.notReady}, stale=${entry.stale})`,
        );
      }
    }
    // Active leases should not exceed worker count (each lease needs a worker)
    if (input.leaseCounts.active > input.workers.length && input.workers.length > 0) {
      risks.push("active lease count exceeds registered worker count");
    }
    // Deployment bindings should map to tenants
    if (input.deployments.length > input.tenants.length && input.tenants.length > 0) {
      risks.push("deployment binding count exceeds tenant count; check tenant-binding ownership");
    }
    // Data namespaces should be created per tenant
    if (input.dataNamespaces.length < input.tenants.length && input.tenants.length > 0) {
      risks.push("tenant-aware data namespaces are incomplete for the current tenant topology");
    }

    return Array.from(new Set(risks));
  }

  /** Checks if a worker is trusted (remote workers must have verified registration) */
  private isWorkerTrusted(worker: WorkerSnapshotRecord): boolean {
    return worker.placement !== "remote" || (worker.registrationVerifiedAt != null && worker.registrationChallengeId != null);
  }

  /** Checks if a worker is stale based on last heartbeat */
  private isWorkerStale(worker: WorkerSnapshotRecord, generatedAt: string): boolean {
    return this.ageMs(worker.lastHeartbeatAt, generatedAt) > this.staleWorkerThresholdMs;
  }

  /** Checks if a readiness record shows the component as ready */
  private isReadinessReady(record: EnvironmentReadinessRecord): boolean {
    if (record.credentialReady !== 1) {
      return false;
    }
    const gates = parseJsonObject(record.secondaryGatesJson);
    return Object.values(gates).every((value) => value === true);
  }

  /** Checks if a readiness record is stale (not verified recently) */
  private isReadinessStale(record: EnvironmentReadinessRecord, generatedAt: string): boolean {
    return this.ageMs(record.lastVerifiedAt, generatedAt) > this.readinessStaleThresholdMs;
  }

  /** Calculates age in milliseconds between two timestamps */
  private ageMs(timestamp: string, generatedAt: string): number {
    return Math.max(0, Date.parse(generatedAt) - Date.parse(timestamp));
  }
}

/**
 * Safely extracts the running execution count from a worker's JSON field.
 * Returns 0 if the JSON is malformed or not an array.
 */
function safeRunningExecutionCount(worker: WorkerSnapshotRecord): number {
  try {
    const parsed = JSON.parse(worker.runningExecutionsJson) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (err) {
    platformOperatorLogger.log({
      level: "debug",
      message: "Failed to parse running execution count",
      data: { workerId: worker.workerId, error: err instanceof Error ? err.message : String(err) },
    });
    return 0;
  }
}

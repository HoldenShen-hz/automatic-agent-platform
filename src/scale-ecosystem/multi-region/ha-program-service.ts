/**
 * HA Program Service - Multi-Region
 *
 * High Availability transition program service for multi-region deployments.
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

import { ArtifactStore, type ArtifactStoreOptions } from "../../platform/five-plane-state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ArtifactRef, EnvironmentName } from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

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
 * Builds a Markdown-formatted version of the HA program report.
 *
 * @param report - The HA program report to format
 * @returns Markdown string containing the formatted report
 */
function buildMarkdown(report: HaProgramReport): string {
  return [
    "# HA Transition Program",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Environment: \`${report.environment}\``,
    `- Overall Status: \`${report.overallStatus}\``,
    `- Active Workers: ${report.activeWorkerCount}`,
    `- Active Leases: ${report.activeLeaseCount}`,
    "",
    "## Components",
    "",
    ...report.components.map(
      (component) =>
        `- \`${component.componentId}\` current=${component.currentMode} target=${component.targetMode} ready=${component.ready} blockers=${component.blockers.join("; ") || "none"}`,
    ),
    "",
    "## Rollout Phases",
    "",
    ...report.rolloutPhases.map((item) => `- ${item}`),
  ].join("\n");
}

/**
 * Service for tracking High Availability transition readiness.
 *
 * This service monitors the readiness of infrastructure components required for
 * HA operation and produces reports that determine when an environment can be
 * safely promoted to HA-capable status. It checks readiness records for each
 * component and produces blocking issues when prerequisites are not met.
 */
export class HaProgramService {
  private readonly artifactStore: ArtifactStore;

  public constructor(
    private readonly store: AuthoritativeTaskStore,
    options: HaProgramServiceOptions = {},
  ) {
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
  }

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
  public buildReport(input: HaProgramInput): HaProgramReport {
    const readiness = this.store.release.listEnvironmentReadinessRecords(input.environment, { activeOnly: true, limit: 500 });
    const workers = this.store.worker.listWorkerSnapshots();
    const activeLeases = this.store.worker.listExecutionLeasesByStatuses(["active"]);

    // Build a set of component keys that have active readiness records
    const readinessIds = new Set(readiness.map((item) => `${item.componentType}:${item.componentId}`));

    // Evaluate each HA component for readiness
    const components: HaProgramComponent[] = [
      {
        componentId: "coordinator",
        currentMode: "single_node_runtime",
        targetMode: "ha_coordinator_epoch",
        ready: readinessIds.has("external_service:ha_coordinator") || readinessIds.has("worker_fleet:ha_coordinator"),
        blockers: readinessIds.has("external_service:ha_coordinator") || readinessIds.has("worker_fleet:ha_coordinator")
          ? []
          : ["leader election readiness missing"],
      },
      {
        componentId: "postgres",
        currentMode: "sqlite_authoritative",
        targetMode: "postgres_authoritative",
        ready: readinessIds.has("external_service:postgres_primary"),
        blockers: readinessIds.has("external_service:postgres_primary") ? [] : ["postgres readiness missing"],
      },
      {
        componentId: "redis_queue",
        currentMode: "sqlite_outbox_queue",
        targetMode: "redis_queue",
        ready: readinessIds.has("external_service:redis_queue"),
        blockers: readinessIds.has("external_service:redis_queue") ? [] : ["redis queue readiness missing"],
      },
      {
        componentId: "distributed_lock",
        currentMode: "sqlite_lease_fencing",
        targetMode: "pg_or_redis_locking",
        ready: readinessIds.has("external_service:distributed_lock"),
        blockers: readinessIds.has("external_service:distributed_lock") ? [] : ["distributed lock readiness missing"],
      },
    ];

    // Determine overall status based on component readiness
    // FIX: The original bug was checking if coordinator/postgres exist at all (always true),
    // instead of checking if they are NOT ready. Added && !component.ready to properly
    // return "fail" only when critical components are not ready, allowing "warning"
    // to be returned when non-critical components (redis_queue, distributed_lock) are not ready.
    const allReady = components.every((component) => component.ready);
    const hasCriticalNotReady = components.some(
      (component) => (component.componentId === "coordinator" || component.componentId === "postgres") && !component.ready,
    );
    const overallStatus = allReady ? "pass" : hasCriticalNotReady ? "fail" : "warning";

    return {
      reportId: newId("ha_program"),
      generatedAt: input.generatedAt ?? nowIso(),
      environment: input.environment,
      overallStatus,
      activeWorkerCount: workers.filter((worker) => worker.status !== "offline").length,
      activeLeaseCount: activeLeases.length,
      components,
      rolloutPhases: [
        "Phase 1: register HA coordinator readiness and epoch fencing integration",
        "Phase 2: promote PostgreSQL authoritative store and migration compatibility",
        "Phase 3: promote Redis queue and distributed locking with failover rehearsals",
      ],
    };
  }

  /**
   * Exports an HA program report as JSON and Markdown artifacts.
   *
   * @param input - Environment and optional generation timestamp
   * @returns The report plus artifact references
   */
  public exportReport(input: HaProgramInput): HaProgramExportResult {
    const report = this.buildReport(input);
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId: "ha_program",
      executionId: null,
      stepId: null,
      kind: "ha_transition_program",
      fileName: `ha-program-${input.environment}.json`,
      content: report,
    }).ref;
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId: "ha_program",
      executionId: null,
      stepId: null,
      kind: "ha_transition_program_markdown",
      fileName: `ha-program-${input.environment}.md`,
      content: buildMarkdown(report),
      mimeType: "text/markdown",
    }).ref;

    return {
      report,
      jsonArtifact,
      markdownArtifact,
    };
  }
}
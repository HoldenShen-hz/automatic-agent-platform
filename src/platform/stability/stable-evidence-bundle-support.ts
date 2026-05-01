/**
 * Stable Evidence Bundle
 *
 * Orchestrates comprehensive stability testing by running multiple rehearsal scenarios
 * and aggregating results into a single evidence bundle. This is the top-level
 * entry point for generating system stability evidence.
 *
 * The bundle runs these rehearsals in sequence:
 * - Chaos smoke tests: Fault injection scenarios
 * - Prompt injection red-team: Security testing
 * - Concurrency rehearsal: Locking and race conditions
 * - Lease rehearsal: Lease lifecycle and fencing
 * - Rollback rehearsal: Runtime repair and manual takeover
 * - Backup/restore rehearsal: Disaster recovery
 * - Rolling upgrade rehearsal: Version-aware dispatch
 * - Maintenance rehearsal: Graceful drain and handover
 * - Gray release rehearsal: Tenant cohort routing
 * - Event replay rehearsal: Failed consumer ack recovery
 * - DB/queue disconnect rehearsal: Fail-closed behavior
 * - DB writability rehearsal: Read-only admission control
 * - Queue delivery rehearsal: Queue replay and deduplication
 * - Migration compatibility rehearsal: PostgreSQL portability
 * - Validation: Golden task execution with integrity checks
 * - Soak: Long-duration execution with continuous validation
 *
 * After all rehearsals, it also:
 * - Runs doctor health checks
 * - Performs startup consistency repairs
 * - Generates diagnostic snapshots
 * - Executes a full human takeover workflow sample
 * - Drains event consumers and verifies backlog clearance
 *
 * @see stable-release-gate.ts for the gate that evaluates bundle results
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for chaos testing
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { DiagnosticsService } from "../shared/observability/diagnostics-service.js";
import { HealthService } from "../shared/observability/health-service.js";
import { InspectService } from "../shared/observability/inspect-service.js";
import { ObservabilityRetentionService } from "../shared/observability/observability-retention-service.js";
import { StructuredLogger } from "../shared/observability/structured-logger.js";
import { DoctorService, type DoctorReport } from "../control-plane/incident-control/doctor-service.js";
import { HumanTakeoverService } from "../control-plane/incident-control/human-takeover-service.js";
import { EventOpsService } from "../state-evidence/events/event-ops-service.js";
import { runSingleTaskExecution } from "../execution/execution-engine/single-task-execution.js";
import { RuntimeRepairService, type RepairExecutionResult } from "../execution/recovery/runtime-repair-service-root.js";
import { RuntimeRecoveryService } from "../execution/recovery/runtime-recovery-service-root.js";
import { StalledExecutionDetector } from "../execution/recovery/stalled-execution-detector.js";
import { StalledExecutionEscalationService } from "../execution/recovery/stalled-execution-escalation-service.js";
import { WorkerRegistryService } from "../execution/worker-pool/worker-registry-service.js";
import {
  StartupConsistencyChecker,
  type StartupConsistencyReport,
} from "../execution/startup/startup-consistency-checker.js";
import { AuthoritativeTaskStore } from "../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../state-evidence/truth/sqlite-database.js";
import { SqliteReliabilityService } from "../state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { newId, nowIso } from "../contracts/types/ids.js";
import {
  runStableBackupRestoreRehearsal,
  writeStableBackupRestoreRehearsalReport,
  type StableBackupRestoreRehearsalReport,
} from "./stable-backup-restore-rehearsal.js";
import {
  runStableEventReplayRehearsal,
  writeStableEventReplayRehearsalReport,
  type StableEventReplayRehearsalReport,
} from "./stable-event-replay-rehearsal.js";
import {
  runStableDbWritabilityRehearsal,
  writeStableDbWritabilityRehearsalReport,
  type StableDbWritabilityRehearsalReport,
} from "./stable-db-writability-rehearsal.js";
import {
  runStableDbQueueDisconnectRehearsal,
  writeStableDbQueueDisconnectRehearsalReport,
  type StableDbQueueDisconnectRehearsalReport,
} from "./stable-db-queue-disconnect-rehearsal.js";
import {
  runStableQueueDeliveryRehearsal,
  writeStableQueueDeliveryRehearsalReport,
  type StableQueueDeliveryRehearsalReport,
} from "./stable-queue-delivery-rehearsal.js";
import {
  runStableMigrationCompatibilityRehearsal,
  writeStableMigrationCompatibilityRehearsalReport,
  type StableMigrationCompatibilityRehearsalReport,
} from "./stable-migration-compatibility-rehearsal.js";
import {
  runStableRollingUpgradeRehearsal,
  writeStableRollingUpgradeRehearsalReport,
  type StableRollingUpgradeRehearsalReport,
} from "./stable-rolling-upgrade-rehearsal.js";
import {
  runStableMaintenanceRehearsal,
  writeStableMaintenanceRehearsalReport,
  type StableMaintenanceRehearsalReport,
} from "./stable-maintenance-rehearsal.js";
import {
  runStableGrayReleaseRehearsal,
  writeStableGrayReleaseRehearsalReport,
  type StableGrayReleaseRehearsalReport,
} from "./stable-gray-release-rehearsal.js";
import {
  runStableChaosSmoke,
  writeStableChaosSmokeReport,
  type StableChaosSmokeReport,
} from "./stable-chaos-smoke.js";
import {
  runStablePromptInjectionRedTeam,
  writeStablePromptInjectionRedTeamReport,
  type StablePromptInjectionRedTeamReport,
} from "./stable-prompt-injection-red-team.js";
import {
  runStableConcurrencyRehearsal,
  writeStableConcurrencyRehearsalReport,
  type StableConcurrencyRehearsalReport,
} from "./stable-concurrency-rehearsal.js";
import {
  runStableLeaseRehearsal,
  writeStableLeaseRehearsalReport,
  type StableLeaseRehearsalReport,
} from "./stable-lease-rehearsal.js";
import {
  runStableRollbackRehearsal,
  writeStableRollbackRehearsalReport,
  type StableRollbackRehearsalReport,
} from "./stable-rollback-rehearsal.js";
import {
  runStableSoak,
  writeStableSoakReport,
  type StableSoakReport,
} from "./stable-runtime-soak-runner.js";
import { runStableValidation, type StableValidationReport } from "./stable-runtime-validator.js";
import {
  buildStableAcceptanceLineReport,
  type StableAcceptanceLineReport,
} from "./stable-acceptance-line.js";

/**
 * Named profiles for evidence collection with different durations and iteration counts.
 * - "smoke": Quick validation (2 iterations, 5s soak) for fast feedback
 * - "24h": Full day soak test with 5 validation iterations
 * - "72h": Extended stress test over 3 days
 */
export type StableEvidenceProfileName = "smoke" | "24h" | "72h";

/**
 * Configuration for an evidence collection profile.
 * Defines how many validation iterations to run and how long to soak the runtime.
 */
export interface StableEvidenceProfile {
  /** Name identifier for this profile */
  name: StableEvidenceProfileName;
  /** Number of validation runs to perform */
  validationIterations: number;
  /** Total duration to run soak testing in milliseconds */
  soakDurationMs: number;
  /** Interval between soak cycle iterations in milliseconds */
  soakIntervalMs: number;
  /** Number of task iterations to run per soak cycle */
  soakIterationsPerCycle: number;
}

/**
 * Options for creating a stable evidence bundle.
 * Allows specifying which profile to use and optionally providing
 * pre-generated validation or soak reports to avoid re-running them.
 */
export interface StableEvidenceBundleOptions {
  /** Directory where all evidence artifacts will be written */
  outputDir: string;
  /** Name of the evidence profile to use (defaults to "smoke") */
  profileName?: StableEvidenceProfileName;
  /** Override specific profile settings while keeping others */
  profileOverrides?: Partial<Omit<StableEvidenceProfile, "name">>;
  /** Pre-generated validation report to include (skips validation run if provided) */
  validationReport?: StableValidationReport;
  /** Pre-generated soak report to include (skips soak run if provided) */
  soakReport?: StableSoakReport;
}

/**
 * Report capturing the state before and after runtime repair operations.
 * Shows what issues were detected, what repairs were applied, and the resulting state.
 */
export interface StableEvidenceRepairReport {
  /** Consistency report from before repairs were applied */
  before: StartupConsistencyReport;
  /** List of repair actions that were executed */
  applied: RepairExecutionResult[];
  /** Consistency report from after repairs were applied */
  after: StartupConsistencyReport;
}

/**
 * Sample data from a complete human takeover workflow execution.
 * Records the task lifecycle through manual operator intervention.
 */
export interface StableEvidenceTakeoverSample {
  /** ID of the task that was taken over */
  taskId: string;
  /** ID of the opened takeover session */
  takeoverSessionId: string;
  /** ID of the associated execution (if any) */
  executionId: string | null;
  /** Final status of the task after takeover (e.g., "done", "failed") */
  finalTaskStatus: string;
  /** Final status of the execution (e.g., "succeeded", "failed") */
  finalExecutionStatus: string | null;
  /** Final status of the operator session */
  finalSessionStatus: string | null;
  /** Number of operator actions performed during the takeover */
  operatorActionCount: number;
}

/**
 * Complete report from a stable evidence bundle collection run.
 * Contains paths to all generated artifacts and a comprehensive summary
 * of pass/fail status for each tested scenario.
 */
export interface StableEvidenceBundleReport {
  /** ISO timestamp when the evidence collection started */
  startedAt: string;
  /** ISO timestamp when the evidence collection finished */
  finishedAt: string;
  /** Directory containing all generated artifacts */
  outputDir: string;
  /** Profile configuration used for this run */
  profile: StableEvidenceProfile;
  /** Paths to all individual report artifacts generated */
  artifacts: {
    /** Path to this main bundle report JSON */
    bundleReportPath: string;
    /** Path to chaos smoke test report */
    chaosReportPath: string;
    /** Path to prompt injection red-team report */
    promptInjectionReportPath: string;
    /** Path to concurrency test report */
    concurrencyReportPath: string;
    /** Path to lease test report */
    leaseReportPath: string;
    /** Path to validation test report */
    validationReportPath: string;
    /** Path to soak test report */
    soakReportPath: string;
    /** Path to doctor health check report */
    doctorReportPath: string;
    /** Path to the QA-64 stable acceptance line report */
    acceptanceReportPath: string;
    /** Path to backup/restore test report */
    backupRestoreReportPath: string;
    /** Path to backup/restore disaster recovery playbook */
    backupRestorePlaybookPath: string;
    /** Path to rolling upgrade rehearsal report */
    rollingUpgradeReportPath: string;
    /** Path to rolling upgrade playbook */
    rollingUpgradePlaybookPath: string;
    /** Path to maintenance rehearsal report */
    maintenanceReportPath: string;
    /** Path to maintenance playbook */
    maintenancePlaybookPath: string;
    /** Path to tenant-gray release rehearsal report */
    grayReleaseReportPath: string;
    /** Path to tenant-gray release playbook */
    grayReleasePlaybookPath: string;
    /** Path to event replay test report */
    eventReplayReportPath: string;
    /** Path to DB/queue disconnect drill report */
    dbQueueDisconnectReportPath: string;
    /** Path to DB writability fail-close rehearsal report */
    dbWritabilityReportPath: string;
    /** Path to queue replay / duplicate delivery rehearsal report */
    queueDeliveryReportPath: string;
    /** Path to PG portability migration compatibility rehearsal report */
    migrationCompatibilityReportPath: string;
    /** Path to repair execution report */
    repairReportPath: string;
    /** Path to event drain report */
    drainEventsReportPath: string;
    /** Path to diagnostic snapshot JSON */
    diagnosticSnapshotPath: string;
    /** Path to debug dump JSON */
    debugDumpPath: string;
    /** Path to takeover sample JSON */
    takeoverSamplePath: string;
    /** Path to rollback test report */
    rollbackReportPath: string;
    /** Path to the SQLite database used for runtime state */
    runtimeDbPath: string;
  };
  /** Machine-readable QA-64 acceptance-line evaluation */
  acceptanceLine: StableAcceptanceLineReport;
  /** Summary of all test outcomes and metrics */
  summary: {
    /** Overall pass/fail status (true if all tests passed) */
    passed: boolean;
    /** Whether chaos smoke tests passed */
    chaosPassed: boolean;
    /** Whether prompt injection red-team tests passed */
    promptInjectionPassed: boolean;
    /** Whether concurrency tests passed */
    concurrencyPassed: boolean;
    /** Whether lease tests passed */
    leasePassed: boolean;
    /** Whether rollback tests passed */
    rollbackPassed: boolean;
    /** Whether backup/restore tests passed */
    backupRestorePassed: boolean;
    /** Whether rolling upgrade tests passed */
    rollingUpgradePassed: boolean;
    /** Whether maintenance drain and handover tests passed */
    maintenancePassed: boolean;
    /** Whether tenant-gray rollout tests passed */
    grayReleasePassed: boolean;
    /** Whether event replay tests passed */
    eventReplayPassed: boolean;
    /** Whether DB/queue disconnect drill tests passed */
    dbQueueDisconnectPassed: boolean;
    /** Whether DB writability fail-close drill tests passed */
    dbWritabilityPassed: boolean;
    /** Whether queue replay / duplicate delivery tests passed */
    queueDeliveryPassed: boolean;
    /** Whether PG portability migration compatibility tests passed */
    migrationCompatibilityPassed: boolean;
    /** Whether validation tests passed */
    validationPassed: boolean;
    /** Whether soak tests passed */
    soakPassed: boolean;
    /** Overall doctor service health status */
    doctorStatus: DoctorReport["status"];
    /** Startup consistency check status before repairs */
    startupConsistencyStatus: StartupConsistencyReport["status"];
    /** Startup consistency check status after repairs */
    repairAfterStatus: StartupConsistencyReport["status"];
    /** Total number of validation runs performed */
    totalValidationRuns: number;
    /** Total number of soak runs performed */
    totalSoakRuns: number;
    /** Total number of chaos scenarios tested */
    totalChaosScenarios: number;
    /** Total number of prompt injection scenarios tested */
    totalPromptInjectionScenarios: number;
    /** Total number of rolling upgrade scenarios tested */
    totalRollingUpgradeScenarios: number;
    /** Total number of maintenance scenarios tested */
    totalMaintenanceScenarios: number;
    /** Total number of tenant-gray rollout scenarios tested */
    totalGrayReleaseScenarios: number;
    /** Total number of DB/queue disconnect scenarios tested */
    totalDbQueueDisconnectScenarios: number;
    /** Total number of DB writability fail-close scenarios tested */
    totalDbWritabilityScenarios: number;
    /** Total number of queue replay / duplicate delivery scenarios tested */
    totalQueueDeliveryScenarios: number;
    /** Total number of migration compatibility scenarios tested */
    totalMigrationCompatibilityScenarios: number;
    /** Total number of rollback scenarios tested */
    totalRollbackScenarios: number;
    /** Number of validation runs that failed */
    failedValidationRuns: number;
    /** Number of soak runs that failed */
    failedSoakRuns: number;
    /** Number of chaos scenarios that failed */
    failedChaosScenarios: number;
    /** Number of prompt injection scenarios that failed */
    failedPromptInjectionScenarios: number;
    /** Number of rolling upgrade scenarios that failed */
    failedRollingUpgradeScenarios: number;
    /** Number of maintenance scenarios that failed */
    failedMaintenanceScenarios: number;
    /** Number of tenant-gray rollout scenarios that failed */
    failedGrayReleaseScenarios: number;
    /** Number of DB/queue disconnect scenarios that failed */
    failedDbQueueDisconnectScenarios: number;
    /** Number of DB writability fail-close scenarios that failed */
    failedDbWritabilityScenarios: number;
    /** Number of queue replay / duplicate delivery scenarios that failed */
    failedQueueDeliveryScenarios: number;
    /** Number of migration compatibility scenarios that failed */
    failedMigrationCompatibilityScenarios: number;
    /** Number of rollback scenarios that failed */
    failedRollbackScenarios: number;
    /** Combined integrity failures from validation and soak */
    integrityFailures: number;
    /** Combined backup failures from validation and soak */
    backupFailures: number;
    /** Count of pending tier1 acks remaining after drain */
    pendingAckBacklogAfterDrain: number;
    /** Whether the takeover sample completed the full closed loop */
    takeoverSampleClosedLoop: boolean;
    /** QA-64 stable acceptance line status */
    acceptanceLineStatus: StableAcceptanceLineReport["status"];
  };
}

/**
 * Predefined evidence collection profiles.
 * Each profile balances test thoroughness against execution time.
 */
export const STABLE_EVIDENCE_PROFILES: Record<StableEvidenceProfileName, StableEvidenceProfile> = {
  /** Quick smoke test: 2 validations, 5 second soak */
  smoke: {
    name: "smoke",
    validationIterations: 2,
    soakDurationMs: 5_000,
    soakIntervalMs: 500,
    soakIterationsPerCycle: 1,
  },
  /** Full day soak test: 5 validations, 24 hour soak */
  "24h": {
    name: "24h",
    validationIterations: 5,
    soakDurationMs: 24 * 60 * 60 * 1000,
    soakIntervalMs: 5 * 60 * 1000,
    soakIterationsPerCycle: 3,
  },
  /** Extended stress test: 8 validations, 72 hour soak */
  "72h": {
    name: "72h",
    validationIterations: 8,
    soakDurationMs: 72 * 60 * 60 * 1000,
    soakIntervalMs: 10 * 60 * 1000,
    soakIterationsPerCycle: 3,
  },
};

/** Writes a value as formatted JSON to a file with cryptographic signature, creating parent directories as needed */
export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  // §58: Cryptographically sign evidence bundles to prevent tampering.
  // Without HMAC/signature/hash chain, attacker can modify config without alert (issue #1953).
  const content = JSON.stringify(value, null, 2);
  const signature = computeHmacSignature(content);
  const signedPayload = { content, signature, signedAt: new Date().toISOString() };
  writeFileSync(path, JSON.stringify(signedPayload, null, 2));
}

/**
 * Computes HMAC-SHA256 signature for evidence bundle integrity.
 * §58: Requires HMAC/signature/hash chain for tamper detection.
 */
function computeHmacSignature(content: string): string {
  // §58: Use HMAC-SHA256 for evidence bundle signature.
  // In production, key should be fetched from secure key management service.
  const { createHmac } = require("node:crypto");
  const hmacKey = process.env.STABLE_EVIDENCE_HMAC_KEY ?? "stable-evidence-default-dev-key";
  return createHmac("sha256", hmacKey).update(content).digest("hex");
}

/**
 * Resolves a stable evidence profile by name, with optional overrides.
 * Merges the base profile with any provided overrides.
 */
export function resolveStableEvidenceProfile(
  profileName: StableEvidenceProfileName = "smoke",
  overrides: StableEvidenceBundleOptions["profileOverrides"] = {},
): StableEvidenceProfile {
  const base = STABLE_EVIDENCE_PROFILES[profileName];
  // Issue #1968 P1 FIX: Preserve base profile name to prevent overrides from
  // changing the resolved profile's identity at runtime. The name should reflect
  // the actual profile being used, not be replaceable by caller.
  return {
    ...base,
    ...overrides,
    name: base.name,
  };
}

/**
 * Creates a minimal task, execution, and session in the database
 * to serve as the basis for a human takeover evidence scenario.
 */
export function seedTakeoverEvidenceScenario(db: SqliteDatabase, store: AuthoritativeTaskStore): {
  taskId: string;
  executionId: string;
  sessionId: string;
} {
  const now = nowIso();
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  db.transaction(() => {
    store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Stable evidence takeover sample",
      status: "in_progress",
      source: "system",
      priority: "normal",
      inputJson: JSON.stringify({ request: "Prepare manual takeover evidence." }),
      normalizedInputJson: JSON.stringify({ request: "Prepare manual takeover evidence." }),
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
    store.workflow.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });
    store.execution.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent_general_executor",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId,
      attempt: 1,
      timeoutMs: 1_000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: JSON.stringify(["analysis"]),
      allowedPathsJson: JSON.stringify([]),
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    store.session.insertSession({
      id: sessionId,
      taskId,
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    taskId,
    executionId,
    sessionId,
  };
}

/**
 * Builds a complete human takeover evidence sample by executing
 * a full takeover workflow.
 */
export function buildTakeoverEvidenceSample(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  logger: StructuredLogger,
): StableEvidenceTakeoverSample {
  const scenario = seedTakeoverEvidenceScenario(db, store);
  const takeover = new HumanTakeoverService(db, store);
  const inspect = new InspectService(store);

  // Open takeover session
  const opened = takeover.openSession({
    taskId: scenario.taskId,
    operatorId: "operator-stable-evidence",
    reasonCode: "stable_evidence.takeover_open",
  });

  // Modify task input
  takeover.modifyInput({
    takeoverSessionId: opened.takeoverSessionId,
    inputJson: JSON.stringify({ request: "Manually adjusted evidence request." }),
    reasonCode: "stable_evidence.modify_input",
  });

  // Switch to manual worker
  takeover.switchWorker({
    takeoverSessionId: opened.takeoverSessionId,
    agentId: "agent_manual_override",
    reasonCode: "stable_evidence.switch_worker",
  });

  // Complete the task
  takeover.completeTask({
    takeoverSessionId: opened.takeoverSessionId,
    terminalStatus: "done",
    reasonCode: "stable_evidence.complete_task",
    outputJson: JSON.stringify({
      summary: "Manual takeover closed the task successfully.",
      result: "Stable evidence bundle recorded a full takeover closure.",
    }),
  });

  const executionTraceId = store.dispatch.getExecution(scenario.executionId)?.traceId;

  logger.log({
    level: "info",
    message: "stable evidence takeover sample completed",
    taskId: scenario.taskId,
    ...(executionTraceId ? { traceId: executionTraceId } : {}),
  });

  const snapshot = inspect.getTaskInspectView(scenario.taskId);
  return {
    taskId: scenario.taskId,
    takeoverSessionId: opened.takeoverSessionId,
    executionId: snapshot.execution?.id ?? null,
    finalTaskStatus: snapshot.task.status,
    finalExecutionStatus: snapshot.execution?.status ?? null,
    finalSessionStatus: snapshot.session?.status ?? null,
    operatorActionCount: snapshot.operatorActions.length,
  };
}

/**
 * Creates a comprehensive stable evidence bundle by running all stability
 * rehearsals and aggregating results into a single report.
 *
 * @param options - Bundle creation options including output directory and profile
 * @returns Complete evidence bundle report with all test results and artifact paths
 */

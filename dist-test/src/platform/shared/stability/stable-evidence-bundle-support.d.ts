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
import { StructuredLogger } from "../observability/structured-logger.js";
import { type DoctorReport } from "../../control-plane/incident-control/doctor-service.js";
import { type RepairExecutionResult } from "../../execution/recovery/runtime-repair-service-root.js";
import { type StartupConsistencyReport } from "../../execution/startup/startup-consistency-checker.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";
import { type StableSoakReport } from "./stable-runtime-soak-runner.js";
import { type StableValidationReport } from "./stable-runtime-validator.js";
import { type StableAcceptanceLineReport } from "./stable-acceptance-line.js";
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
export declare const STABLE_EVIDENCE_PROFILES: Record<StableEvidenceProfileName, StableEvidenceProfile>;
/** Writes a value as formatted JSON to a file, creating parent directories as needed */
export declare function writeJson(path: string, value: unknown): void;
/**
 * Resolves a stable evidence profile by name, with optional overrides.
 * Merges the base profile with any provided overrides.
 */
export declare function resolveStableEvidenceProfile(profileName?: StableEvidenceProfileName, overrides?: StableEvidenceBundleOptions["profileOverrides"]): StableEvidenceProfile;
/**
 * Creates a minimal task, execution, and session in the database
 * to serve as the basis for a human takeover evidence scenario.
 */
export declare function seedTakeoverEvidenceScenario(db: SqliteDatabase, store: AuthoritativeTaskStore): {
    taskId: string;
    executionId: string;
    sessionId: string;
};
/**
 * Builds a complete human takeover evidence sample by executing
 * a full takeover workflow.
 */
export declare function buildTakeoverEvidenceSample(db: SqliteDatabase, store: AuthoritativeTaskStore, logger: StructuredLogger): StableEvidenceTakeoverSample;
/**
 * Creates a comprehensive stable evidence bundle by running all stability
 * rehearsals and aggregating results into a single report.
 *
 * @param options - Bundle creation options including output directory and profile
 * @returns Complete evidence bundle report with all test results and artifact paths
 */

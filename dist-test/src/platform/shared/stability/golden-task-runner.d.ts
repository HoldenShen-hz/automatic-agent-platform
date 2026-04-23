/**
 * Golden Task Runner
 *
 * Provides golden path testing for single-task baseline scenarios. Golden tasks
 * define expected outcomes for complete task execution including task status,
 * workflow status, execution status, session status, event types, and
 * step outputs.
 *
 * These tests serve as regression detection for the core execution path,
 * ensuring that changes to the runtime do not break fundamental successful
 * behavior. The inventory defines which task classes must be covered:
 * - coding, research, content, data: Core workload types
 * - cross_division: Multi-division coordination
 * - high_risk_approval: Tasks requiring approval gates
 * - crash_recovery: Fault tolerance scenarios
 *
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for testing contracts
 * @see docs_zh/architecture/00-platform-architecture.md for single-task execution architecture
 */
/** Task classes that must be covered by golden tasks */
export declare const REQUIRED_GOLDEN_TASK_CLASSES: readonly ["coding", "research", "content", "data", "cross_division", "high_risk_approval", "crash_recovery"];
/** Type representing a required golden task class */
export type GoldenTaskClass = typeof REQUIRED_GOLDEN_TASK_CLASSES[number];
/** Latency expectations for task completion */
export type GoldenTaskLatencyBand = "interactive" | "extended";
/** Whether a task is expected to require approval */
export type GoldenTaskApprovalExpectation = "not_expected" | "supervised_review_expected";
/** Recovery mechanism expected for a task */
export type GoldenTaskRecoveryExpectation = "not_required" | "requeue_supported" | "manual_takeover_supported";
/** Definition of a single golden task test case */
export interface GoldenTaskCase {
    /** Unique identifier for this case */
    id: string;
    /** Human-readable title */
    title: string;
    /** The task request/prompt */
    request: string;
    /** Metadata describing expected behavior */
    metadata: {
        /** Task class this case belongs to */
        expectedClass: GoldenTaskClass;
        /** Success criteria that must be met */
        successCriteria: string[];
        /** Maximum allowed cost in USD */
        costCeilingUsd: number;
        /** Expected latency band */
        latencyBand: GoldenTaskLatencyBand;
        /** Whether approval is expected */
        approvalExpectation: GoldenTaskApprovalExpectation;
        /** Expected recovery mechanism */
        recoveryExpectation: GoldenTaskRecoveryExpectation;
    };
    /** Expected final state after execution */
    expected: {
        taskStatus: "done";
        workflowStatus: "completed";
        executionStatus: "succeeded";
        sessionStatus: "completed";
        eventTypes: readonly string[];
        stepOutputs: number;
    };
}
/** Result of running a golden task case */
export interface GoldenTaskRunResult {
    /** Case identifier that was run */
    caseId: string;
    /** Path to the database created for this run */
    dbPath: string;
    /** Whether the run passed all expectations */
    passed: boolean;
    /** Actual observed values */
    actual: {
        taskStatus: string;
        workflowStatus: string | null;
        executionStatus: string | null;
        sessionStatus: string | null;
        eventTypes: string[];
        stepOutputs: number;
    };
}
/** Summary of a golden task case for inventory purposes */
export interface GoldenTaskInventoryCaseSummary {
    caseId: string;
    title: string;
    expectedClass: GoldenTaskClass;
    successCriteria: string[];
    costCeilingUsd: number;
    latencyBand: GoldenTaskLatencyBand;
    approvalExpectation: GoldenTaskApprovalExpectation;
    recoveryExpectation: GoldenTaskRecoveryExpectation;
}
/** Baseline inventory of golden task coverage */
export interface GoldenTaskInventoryBaseline {
    inventoryVersion: 1;
    totalCases: number;
    coveredClasses: GoldenTaskClass[];
    missingRequiredClasses: GoldenTaskClass[];
    cases: GoldenTaskInventoryCaseSummary[];
}
/**
 * Single-task golden task definitions.
 *
 * These cases represent the minimal happy-path baseline for each
 * required task class. Each case validates that the core execution
 * path completes successfully with expected statuses and outputs.
 */
export declare const SINGLE_TASK_GOLDEN_TASKS: readonly GoldenTaskCase[];
/**
 * Builds an inventory baseline from a set of golden task cases.
 *
 * Computes which required task classes are covered and which are missing.
 *
 * @param cases - Golden task cases to analyze
 * @returns Inventory baseline with coverage analysis
 */
export declare function buildGoldenTaskInventoryBaseline(cases?: readonly GoldenTaskCase[]): GoldenTaskInventoryBaseline;
/**
 * Writes a golden task inventory baseline to a JSON file.
 *
 * @param outputPath - File path to write to
 * @param cases - Golden task cases to include
 */
export declare function writeGoldenTaskInventoryBaseline(outputPath: string, cases?: readonly GoldenTaskCase[]): void;
/**
 * Runs a single golden task case and validates its outcome.
 *
 * Creates a fresh database, runs the task through Phase 1A happy path,
 * and compares the actual outcome against the expected outcome.
 *
 * @param baseDir - Directory for database files
 * @param testCase - Golden task case to run
 * @returns Run result with pass/fail status and actual values
 */
export declare function runGoldenTaskCase(baseDir: string, testCase: GoldenTaskCase): Promise<GoldenTaskRunResult>;

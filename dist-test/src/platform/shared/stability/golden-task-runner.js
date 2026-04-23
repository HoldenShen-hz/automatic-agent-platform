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
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runSingleTaskExecution } from "../../execution/execution-engine/single-task-execution.js";
/** Task classes that must be covered by golden tasks */
export const REQUIRED_GOLDEN_TASK_CLASSES = [
    "coding",
    "research",
    "content",
    "data",
    "cross_division",
    "high_risk_approval",
    "crash_recovery",
];
/** Default expected outcome shared by all single-task golden tasks */
const DEFAULT_EXPECTED_OUTCOME = {
    taskStatus: "done",
    workflowStatus: "completed",
    executionStatus: "succeeded",
    sessionStatus: "completed",
    eventTypes: ["task:status_changed", "workflow:step_completed", "task:status_changed"],
    stepOutputs: 1,
};
/**
 * Single-task golden task definitions.
 *
 * These cases represent the minimal happy-path baseline for each
 * required task class. Each case validates that the core execution
 * path completes successfully with expected statuses and outputs.
 */
export const SINGLE_TASK_GOLDEN_TASKS = [
    {
        id: "coding_minimal_baseline",
        title: "Single-task coding baseline",
        request: "Create the minimal stable single-agent execution baseline.",
        metadata: {
            expectedClass: "coding",
            successCriteria: [
                "task completes in the single-agent minimal workflow",
                "one stable step output is produced",
            ],
            costCeilingUsd: 0.05,
            latencyBand: "interactive",
            approvalExpectation: "not_expected",
            recoveryExpectation: "not_required",
        },
        expected: DEFAULT_EXPECTED_OUTCOME,
    },
    {
        id: "research_summary_minimal",
        title: "Research summary baseline",
        request: "Summarize the task request and finish with a stable single-agent result.",
        metadata: {
            expectedClass: "research",
            successCriteria: [
                "request normalization remains deterministic",
                "workflow finishes without extra recovery actions",
            ],
            costCeilingUsd: 0.05,
            latencyBand: "interactive",
            approvalExpectation: "not_expected",
            recoveryExpectation: "not_required",
        },
        expected: DEFAULT_EXPECTED_OUTCOME,
    },
    {
        id: "content_brief_minimal",
        title: "Content brief baseline",
        request: "Draft a concise content brief and close with a stable single-agent result.",
        metadata: {
            expectedClass: "content",
            successCriteria: [
                "content-style request stays on the minimal workflow",
                "completion remains deterministic across reruns",
            ],
            costCeilingUsd: 0.05,
            latencyBand: "interactive",
            approvalExpectation: "not_expected",
            recoveryExpectation: "not_required",
        },
        expected: DEFAULT_EXPECTED_OUTCOME,
    },
    {
        id: "data_extract_minimal",
        title: "Data extraction baseline",
        request: "Extract the key structured facts from the request and finish with a stable result.",
        metadata: {
            expectedClass: "data",
            successCriteria: [
                "data-oriented request still produces one deterministic output envelope",
                "runtime state stays internally consistent after completion",
            ],
            costCeilingUsd: 0.05,
            latencyBand: "interactive",
            approvalExpectation: "not_expected",
            recoveryExpectation: "not_required",
        },
        expected: DEFAULT_EXPECTED_OUTCOME,
    },
    {
        id: "cross_division_handoff_minimal",
        title: "Cross-division intake baseline",
        request: "Route a cross-division coordination request through the current stable baseline and finish cleanly.",
        metadata: {
            expectedClass: "cross_division",
            successCriteria: [
                "cross-division representative request remains executable in the baseline runtime",
                "request completes with a stable audit trail ready for later routing upgrades",
            ],
            costCeilingUsd: 0.05,
            latencyBand: "interactive",
            approvalExpectation: "not_expected",
            recoveryExpectation: "manual_takeover_supported",
        },
        expected: DEFAULT_EXPECTED_OUTCOME,
    },
    {
        id: "high_risk_approval_minimal",
        title: "High-risk approval representative baseline",
        request: "Simulate a high-risk change request and finish with a stable representative baseline result.",
        metadata: {
            expectedClass: "high_risk_approval",
            successCriteria: [
                "high-risk representative request stays in the fixed golden inventory",
                "task metadata records a supervised review expectation for future policy phases",
            ],
            costCeilingUsd: 0.05,
            latencyBand: "interactive",
            approvalExpectation: "supervised_review_expected",
            recoveryExpectation: "manual_takeover_supported",
        },
        expected: DEFAULT_EXPECTED_OUTCOME,
    },
    {
        id: "crash_recovery_minimal",
        title: "Crash recovery representative baseline",
        request: "Exercise the baseline request path with crash-recovery representative input and finish cleanly.",
        metadata: {
            expectedClass: "crash_recovery",
            successCriteria: [
                "crash-recovery representative request stays in the fixed baseline inventory",
                "task records a requeue-capable recovery expectation for stability rehearsals",
            ],
            costCeilingUsd: 0.05,
            latencyBand: "extended",
            approvalExpectation: "not_expected",
            recoveryExpectation: "requeue_supported",
        },
        expected: DEFAULT_EXPECTED_OUTCOME,
    },
];
/**
 * Converts a golden task case to its inventory summary form.
 */
function toInventoryCaseSummary(testCase) {
    return {
        caseId: testCase.id,
        title: testCase.title,
        expectedClass: testCase.metadata.expectedClass,
        successCriteria: testCase.metadata.successCriteria,
        costCeilingUsd: testCase.metadata.costCeilingUsd,
        latencyBand: testCase.metadata.latencyBand,
        approvalExpectation: testCase.metadata.approvalExpectation,
        recoveryExpectation: testCase.metadata.recoveryExpectation,
    };
}
/**
 * Builds an inventory baseline from a set of golden task cases.
 *
 * Computes which required task classes are covered and which are missing.
 *
 * @param cases - Golden task cases to analyze
 * @returns Inventory baseline with coverage analysis
 */
export function buildGoldenTaskInventoryBaseline(cases = SINGLE_TASK_GOLDEN_TASKS) {
    const coveredClasses = REQUIRED_GOLDEN_TASK_CLASSES.filter((taskClass) => cases.some((testCase) => testCase.metadata.expectedClass === taskClass));
    return {
        inventoryVersion: 1,
        totalCases: cases.length,
        coveredClasses,
        missingRequiredClasses: REQUIRED_GOLDEN_TASK_CLASSES.filter((taskClass) => !coveredClasses.includes(taskClass)),
        cases: cases.map((testCase) => toInventoryCaseSummary(testCase)),
    };
}
/**
 * Writes a golden task inventory baseline to a JSON file.
 *
 * @param outputPath - File path to write to
 * @param cases - Golden task cases to include
 */
export function writeGoldenTaskInventoryBaseline(outputPath, cases = SINGLE_TASK_GOLDEN_TASKS) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(buildGoldenTaskInventoryBaseline(cases), null, 2));
}
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
export async function runGoldenTaskCase(baseDir, testCase) {
    const dbPath = join(baseDir, `${testCase.id}.db`);
    const snapshot = await runSingleTaskExecution({
        dbPath,
        title: testCase.title,
        request: testCase.request,
    });
    // Extract actual observed values
    const actual = {
        taskStatus: snapshot.task.status,
        workflowStatus: snapshot.workflow?.status ?? null,
        executionStatus: snapshot.execution?.status ?? null,
        sessionStatus: snapshot.session?.status ?? null,
        eventTypes: snapshot.events.map((event) => event.eventType),
        stepOutputs: snapshot.stepOutputs.length,
    };
    // Compare actual to expected
    const passed = actual.taskStatus === testCase.expected.taskStatus &&
        actual.workflowStatus === testCase.expected.workflowStatus &&
        actual.executionStatus === testCase.expected.executionStatus &&
        actual.sessionStatus === testCase.expected.sessionStatus &&
        actual.stepOutputs === testCase.expected.stepOutputs &&
        JSON.stringify(actual.eventTypes) === JSON.stringify(testCase.expected.eventTypes);
    return {
        caseId: testCase.id,
        dbPath,
        passed,
        actual,
    };
}
//# sourceMappingURL=golden-task-runner.js.map
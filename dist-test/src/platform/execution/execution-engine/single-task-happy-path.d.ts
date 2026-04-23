/**
 * @fileoverview Single-task execution happy path.
 *
 * This module implements the simplest possible workflow execution scenario where:
 * - A single task is created from user input
 * - A single step (intake_triage) is executed
 * - The workflow completes immediately after that one step
 *
 * This serves as the baseline "happy path" for testing and demonstrating the core
 * runtime infrastructure without the complexity of multi-step orchestration.
 *
 * The happy path validates the entire lifecycle:
 * Task creation → Workflow initialization → Execution → Step completion → Task terminal state
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/runtime_execution_contract.md | Runtime Execution Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/transition_service_contract.md | Transition Service Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/task_and_workflow_contract.md | Task and Workflow Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
import type { WorkflowCrashInjection } from "../recovery/workflow-crash-simulator.js";
import { type AdmissionBackpressureSnapshot, type AdmissionPolicy } from "../dispatcher/admission-controller.js";
/**
 * Input parameters for single-task execution.
 * These values are typically provided by the CLI or API caller.
 */
export interface HappyPathInput {
    /** Absolute path to the SQLite database file for persistence */
    dbPath: string;
    /** Human-readable title for the task */
    title: string;
    /** The user's original request or instruction */
    request: string;
    /** Optional tenant scope for the created task */
    tenantId?: string | null;
    /** Optional admission policy override for runtime backpressure validation */
    admissionPolicy?: AdmissionPolicy;
    /** Optional backpressure snapshot supplier used by the admission controller */
    admissionBackpressureSnapshot?: () => AdmissionBackpressureSnapshot | null;
    /** Optional crash injection used by recovery drills */
    crashInjection?: WorkflowCrashInjection;
    /** Optional override used by tests to force schema validation paths */
    stepOutputOverride?: Record<string, unknown>;
}
/**
 * Executes the single-task workflow.
 *
 * This function orchestrates the complete lifecycle of a simple single-step task:
 * 1. Validates the minimal workflow definition
 * 2. Initializes the authoritative storage backend and repository layers
 * 3. Creates task, workflow, execution, and session records
 * 4. Transitions through all required states (queued → in_progress → executing → done)
 * 5. Produces a synthetic step output representing the "intake_triage" step
 * 6. Writes the step output artifact and completes the task
 *
 * @param input - Configuration for the happy path execution
 * @returns A complete task snapshot containing all records and final state
 */
export declare function runSingleTaskExecution(input: HappyPathInput): Promise<import("../../state-evidence/truth/authoritative-task-store.js").TaskSnapshot>;
export declare const runPhase1AHappyPath: typeof runSingleTaskExecution;

/**
 * @fileoverview RuntimeExecuteBridge — connects OAPEFLIR Execute phase to the real runtime.
 *
 * ## Role
 *
 * This bridge replaces `buildStepOutputs()` in `OapeflirLoopService` with real
 * execution by calling into `runMultiStepOrchestration`.
 *
 * ## How It Works
 *
 * 1. The OAPEFLIR `Plan` (produced by `PlanBuilder`) contains `PlanStep[]` with
 *    the objective broken down into actionable steps.
 * 2. `RuntimeExecuteBridge.executePlan()` converts `PlanStep[]` into the format
 *    expected by `runMultiStepOrchestration` and calls it.
 * 3. The orchestrator handles routing, planning, and step execution internally,
 *    then returns a `MultiStepOrchestrationResult`.
 * 4. The bridge extracts `StepOutputRecord[]` from the result snapshot and maps
 *    them to `DualChannelStepOutput[]` for consumption by Feedback → Learn → Improve.
 *
 * ## Key Mapping Decisions
 *
 * - `PlanStep.action` → `roleId` (used for tool-exposure resolution in supervisor)
 * - `PlanStep.dependsOn` → `dependsOnStepIds` (step ordering preserved)
 * - `PlanStep.timeout` → `timeoutMs` (used for per-step timeout in supervisor)
 * - `StepOutputRecord` → `DualChannelStepOutput` (status, telemetry, summary mapping)
 *
 * ## Re-planning Note
 *
 * The orchestrator's internal `WorkflowPlanner` will re-plan the `request` string,
 * so there is a mild inefficiency where OAPEFLIR's plan and the orchestrator's plan
 * may differ. This is acceptable for the initial implementation. A future optimisation
 * would add a "pre-planned" execution path that bypasses the internal planner.
 *
 * Part of GAP-V2-01.
 */
import type { Plan, PlanStep } from "./types/plan.js";
import type { DualChannelStepOutput } from "./types/dual-channel-step-output.js";
import type { ExecuteBridge, ExecutionContext, StepResult, ExecutionResult } from "./execute-bridge.js";
import type { MultiStepOrchestrationResult } from "../../execution/execution-engine/multi-step-orchestration-types.js";
import type { StepOutputRecord } from "../../contracts/types/domain/task-types.js";
/**
 * Maps a `StepOutputRecord` from the supervisor to an OAPEFLIR `StepResult`.
 */
export declare function mapStepOutputRecord(record: StepOutputRecord): StepResult;
/**
 * Maps a `StepOutputRecord[]` from the orchestrator result to `DualChannelStepOutput[]`
 * for consumption by the OAPEFLIR Feedback stage.
 */
export declare function mapToDualChannelStepOutputs(records: StepOutputRecord[], planId: string): DualChannelStepOutput[];
/**
 * Extracts `StepOutputRecord[]` from a `MultiStepOrchestrationResult`.
 */
export declare function extractStepOutputRecords(result: MultiStepOrchestrationResult): StepOutputRecord[];
/**
 * Converts OAPEFLIR `PlanStep[]` into a minimal serialisable workflow
 * that the orchestrator can accept via the `request` field.
 *
 * The format uses a special prefix `oapeflir://plan JSON` that the bridge
 * decodes — this lets the orchestrator treat an OAPEFLIR plan as an
 * already-planned workflow without re-planning.
 *
 * Note: The orchestrator's IntakeRouter may still run its classification
 * logic on the raw string, but this does not affect the actual execution
 * because `runMultiStepOrchestration` uses the `workflow` parameter directly
 * when provided.
 */
export declare function serialiseOapeflirPlan(steps: PlanStep[]): string;
export declare class RuntimeExecuteBridge implements ExecuteBridge {
    private readonly dbPath;
    private readonly defaultModelId;
    constructor(dbPath: string, defaultModelId?: string);
    /**
     * Execute a single plan step.
     *
     * For single-step execution we call `runMultiStepOrchestration` with just
     * that one step. This is used when the loop needs to re-execute a specific
     * step after a replan.
     */
    executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult>;
    /**
     * Execute a complete OAPEFLIR plan against the runtime.
     *
     * This constructs a `MultiStepToolExecutionInput` and calls the orchestrator.
     * After execution, `StepOutputRecord[]` is extracted from the result snapshot
     * and mapped to `DualChannelStepOutput[]`.
     */
    executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult>;
    /**
     * Convenience: convert an `ExecutionResult` (our internal type) to
     * `DualChannelStepOutput[]` so the OAPEFLIR loop can pass them to Feedback.
     */
    toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[];
}
export declare class MockExecuteBridge implements ExecuteBridge {
    executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult>;
    executePlan(plan: Plan, _context: ExecutionContext): Promise<ExecutionResult>;
    toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[];
}

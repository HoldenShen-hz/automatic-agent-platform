/**
 * @fileoverview ExecuteBridge — interface between OAPEFLIR Execute phase and the runtime.
 *
 * GAP-V2-01: The OAPEFLIR loop's Execute stage previously returned hardcoded mock data
 * via `buildStepOutputs()`. This interface + implementation replaces that with real
 * runtime execution by connecting to the orchestrator / supervisor layer.
 *
 * ## Interface Design
 *
 * The bridge translates OAPEFLIR's `Plan` / `PlanStep` domain objects into the
 * runtime's execution model (`StepOutputRecord[]`) and translates the results back
 * into `DualChannelStepOutput` for consumption by the Feedback stage.
 *
 * ## Two Implementation Strategies
 *
 * - **RuntimeExecuteBridge** (production): calls `runMultiStepOrchestration` with a
 *   serialised representation of the OAPEFLIR plan, then maps `StepOutputRecord[]`
 *   → `DualChannelStepOutput[]`.
 *
 * - **MockExecuteBridge** (testing / demo): returns fabricated `DualChannelStepOutput[]`
 *   without touching any runtime service. This is the existing `buildStepOutputs()`
 *   behaviour retained for cases where full execution is not desirable.
 *
 * Part of GAP-V2-01.
 */

import type { Plan, PlanStep } from "./types/plan.js";
import type { DualChannelStepOutput } from "./types/dual-channel-step-output.js";

/**
 * Execution context passed through the OAPEFLIR loop.
 * Carries runtime metadata needed by the bridge to talk to the execution engine.
 */
export interface ExecutionContext {
  taskId: string;
  sessionId?: string;
  /** Token budget for the entire plan */
  tokenBudget?: number;
  /** Override the default LLM model for this execution */
  modelId?: string;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /**
   * Pre-allocated budget ledger ID for INV-BUDGET-001 compliance.
   * When provided, the orchestrator uses this ledger instead of creating a new one,
   * ensuring budget reservation precedes any cost-bearing execution.
   */
  budgetLedgerId?: string;
}

/**
 * Result of executing a single plan step.
 */
export interface StepResult {
  stepId: string;
  status: "succeeded" | "failed" | "skipped";
  /** Duration in milliseconds measured by the runtime */
  durationMs: number;
  /** Total token cost (input + output) for this step */
  tokenCost: number;
  /** Human-readable summary produced by the runtime */
  summary: string;
  /** Structured outputs emitted by the step (key-value pairs) */
  outputs: Record<string, unknown>;
  /** Artifact refs produced by the step */
  artifacts: string[];
  /** Raw model ID that executed this step (e.g. "claude-opus-4-6") */
  modelId: string;
  /** Number of retries performed by the runtime */
  retryCount: number;
  /** Whether output schema validation passed */
  validationPassed: boolean;
}

/**
 * Aggregated result of executing an entire plan.
 */
export interface ExecutionResult {
  planId: string;
  results: StepResult[];
  /** Total wall-clock time for the entire plan */
  totalDurationMs: number;
  /** Cumulative token cost across all steps */
  totalTokenCost: number;
  /** True only if every step succeeded */
  allSucceeded: boolean;
  /** Step IDs that the runtime chose to skip (e.g. dependency not met) */
  skippedStepIds: string[];
  /** Step IDs that failed */
  failedStepIds: string[];
}

/**
 * Abstraction for executing OAPEFLIR plans against a runtime backend.
 *
 * Implementations:
 * - `RuntimeExecuteBridge`: real execution via `runMultiStepOrchestration`
 * - `MockExecuteBridge`: returns predetermined values (existing behaviour)
 */
export interface ExecuteBridge {
  /**
   * Execute a single plan step in isolation.
   * Used when the OAPEFLIR loop needs to re-execute a single step
   * (e.g. after a replan of one step).
   */
  executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult>;

  /**
   * Execute a complete plan (all steps in dependency order).
   * This is the primary entry point for the OAPEFLIR Execute phase.
   * Returns `ExecutionResult` which the loop maps to `DualChannelStepOutput[]`.
   */
  executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult>;

  /**
   * Convert an `ExecutionResult` to `DualChannelStepOutput[]` for consumption
   * by the OAPEFLIR Feedback stage.
   */
  toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[];

  /**
   * Execute a subgraph of a plan.
   * Used when the OAPEFLIR loop needs to execute a subset of steps
   * (e.g. for parallel branches, conditional paths, or nested workflows).
   */
  executeSubgraph(subgraph: PlanStep[], context: ExecutionContext): Promise<ExecutionResult>;

  /**
   * Execute a child run of a plan.
   * Used for spawning child executions that are attached to a parent task/run,
   * such as for multi-agent scenarios or detached background workflows.
   */
  executeChildRun(
    plan: Plan,
    context: ExecutionContext,
    parentRunId: string,
  ): Promise<ExecutionResult>;
}

export {
  MockExecuteBridge,
  RuntimeExecuteBridge,
  mapStepOutputRecord,
  mapToDualChannelStepOutputs,
  extractStepOutputRecords,
  serialiseOapeflirPlan,
} from "./runtime-execute-bridge.js";

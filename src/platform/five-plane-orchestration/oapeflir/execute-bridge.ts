/**
 * @fileoverview ExecuteBridge — interface between OAPEFLIR Execute phase and the runtime.
 *
 * GAP-V2-01: The OAPEFLIR loop's Execute stage previously returned hardcoded mock data
 * via `buildStepOutputs()`. This interface + implementation replaces that with real
 * runtime execution by connecting to the orchestrator / supervisor layer.
 *
 * ## Interface Design
 *
 * The bridge translates OAPEFLIR's `PlanGraphBundle` (canonical per ADR-060/ADR-109)
 * into the runtime's execution model (`StepOutputRecord[]`) and translates the results
 * back into `DualChannelStepOutput` for consumption by the Feedback stage.
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

import type { PlanStep } from "./types/plan.js";
import type { DualChannelStepOutput } from "./types/dual-channel-step-output.js";
import type { PlanGraphBundle } from "../../../platform/contracts/executable-contracts/index.js";

/**
 * Parent context for subgraph/child-run execution per §13.7.
 * When a plan is being executed as a subgraph of a larger plan,
 * the parent context links the child run to its parent plan/node.
 */
export interface ParentContext {
  /** ID of the parent PlanGraphBundle */
  parentPlanGraphBundleId?: string;
  /** ID of the parent node in the parent plan that spawned this subgraph */
  parentNodeId?: string;
  /** ID of this child run */
  childRunId?: string;
}

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
  /** §13.7: Parent context for subgraph/child-run execution */
  parentContext?: ParentContext;
}

/**
 * Result of executing a single plan step.
 */
export interface StepResult {
  nodeRunId: string;
  /** @deprecated Use nodeRunId for canonical correlation. */
  stepId?: string;
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
  /** NodeRun IDs that the runtime chose to skip (e.g. dependency not met) */
  skippedNodeRunIds: string[];
  /** NodeRun IDs that failed */
  failedNodeRunIds: string[];
}

/**
 * Input for runtime plan execution.
 * R19-43 fix: Defined in P3 (orchestration) to avoid P3→P4 cross-layer import coupling.
 * P4 provides the concrete implementation via dependency injection.
 */
export interface RuntimePlanExecutionInput {
  readonly dbPath: string;
  readonly planGraphBundle: PlanGraphBundle;
  readonly contextBudgetTokens?: number;
  /** §13.7: Parent context for subgraph/child-run execution */
  readonly parentContext?: ParentContext;
}

/**
 * Abstraction for executing OAPEFLIR plans against a runtime backend.
 *
 * R19-43 fix: This interface is now defined in P3 (orchestration layer) to avoid
 * cross-layer direct coupling. P4 provides a concrete implementation that is
 * injected into RuntimeExecuteBridge via constructor.
 *
 * Implementations:
 * - `RuntimeExecuteBridge`: real execution via `runMultiStepOrchestration`
 * - `MockExecuteBridge`: returns predetermined values (existing behaviour)
 */
export interface RuntimePlanExecutor {
  (input: RuntimePlanExecutionInput): Promise<import("../../../platform/five-plane-execution/execution-engine/multi-step-orchestration-types.js").MultiStepOrchestrationResult>;
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
   * Execute a complete PlanGraphBundle (canonical per ADR-060/ADR-109).
   * All steps in dependency order from the PlanGraph's nodes.
   * This is the primary entry point for the OAPEFLIR Execute phase.
   * Returns `ExecutionResult` which the loop maps to `DualChannelStepOutput[]`.
   */
  executePlan(plan: PlanGraphBundle, context: ExecutionContext): Promise<ExecutionResult>;

  /**
   * Convert an `ExecutionResult` to `DualChannelStepOutput[]` for consumption
   * by the OAPEFLIR Feedback stage.
   */
  toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[];
}

export {
  MockExecuteBridge,
  RuntimeExecuteBridge,
  mapStepOutputRecord,
  mapToDualChannelStepOutputs,
  extractStepOutputRecords,
  serialiseOapeflirPlan,
} from "./runtime-execute-bridge.js";

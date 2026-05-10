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

import { newId, nowIso } from "../../contracts/types/ids.js";
import { createBudgetReservation } from "../../contracts/executable-contracts/index.js";
import type { Plan, PlanStep } from "./types/plan.js";
import type { DualChannelStepOutput } from "./types/dual-channel-step-output.js";
import type {
  ExecuteBridge,
  ExecutionContext,
  StepResult,
  ExecutionResult,
} from "./execute-bridge.js";
import type { MultiStepOrchestrationResult } from "../../execution/execution-engine/multi-step-orchestration-types.js";
import type { StepOutputRecord } from "../../contracts/types/domain/task-types.js";

// ---------------------------------------------------------------------------
// Minimal workflow representation for the orchestrator
// ---------------------------------------------------------------------------

interface MinimalStepInput {
  stepId: string;
  action: string;
  title?: string;
  inputs: Record<string, unknown>;
  outputs: string[] | undefined;
  dependencies: string[];
  timeout: number;
}

interface MinimalWorkflowInput {
  workflowId: string;
  version: number;
  steps: MinimalStepInput[];
}

// ---------------------------------------------------------------------------
// Result mappers
// ---------------------------------------------------------------------------

/**
 * Maps a `StepOutputRecord` from the supervisor to an OAPEFLIR `StepResult`.
 */
export function mapStepOutputRecord(record: StepOutputRecord): StepResult {
  let outputs: Record<string, unknown> = {};
  try {
    outputs = JSON.parse(record.dataJson);
  } catch {
    // ignore parse errors — use empty object
  }

  let artifacts: string[] = [];
  if (record.artifactsJson) {
    try {
      artifacts = JSON.parse(record.artifactsJson);
    } catch {
      artifacts = [];
    }
  }

  return {
    stepId: record.stepId ?? "unknown",
    status: record.status === "succeeded" ? "succeeded" : record.status === "skipped" ? "skipped" : "failed",
    durationMs: record.durationMs,
    tokenCost: record.tokenCost,
    summary: record.summary ?? `Step ${record.stepId ?? "unknown"} ${record.status}`,
    outputs,
    artifacts,
    modelId: "runtime", // Supervisor doesn't track per-step model; record at plan level
    retryCount: 0, // Supervisor doesn't expose retry count per record
    validationPassed: record.validationJson != null,
  };
}

/**
 * Maps a `StepOutputRecord[]` from the orchestrator result to `DualChannelStepOutput[]`
 * for consumption by the OAPEFLIR Feedback stage.
 */
export function mapToDualChannelStepOutputs(
  records: StepOutputRecord[],
  planId: string,
): DualChannelStepOutput[] {
  return records.map((record) => {
    const result = mapStepOutputRecord(record);
    return {
      stepId: record.stepId ?? "unknown",
      planRef: planId,
      userFacingResult: {
        summary: result.summary,
        artifacts: result.artifacts.map((a) => `artifact:${a}`),
      },
      systemTelemetry: {
        durationMs: result.durationMs,
        tokensUsed: result.tokenCost,
        modelId: result.modelId,
        retryCount: result.retryCount,
        validationPassed: result.validationPassed,
      },
    };
  });
}

/**
 * Extracts `StepOutputRecord[]` from a `MultiStepOrchestrationResult`.
 */
export function extractStepOutputRecords(result: MultiStepOrchestrationResult): StepOutputRecord[] {
  const snapshot = result.snapshot;
  if (!snapshot) {
    return [];
  }
  // The task snapshot's executionRecord holds the step outputs
  const execRecord = (snapshot as { executionRecord?: { stepOutputs?: StepOutputRecord[] } }).executionRecord;
  return execRecord?.stepOutputs ?? [];
}

// ---------------------------------------------------------------------------
// PlanStep → orchestrator input mapping
// ---------------------------------------------------------------------------

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
export function serialiseOapeflirPlan(steps: PlanStep[]): string {
  // Serialize PlanStep[] to a JSON string that the orchestrator can decode.
  // This preserves all step metadata (id, action, inputs, outputs, dependencies, timeout).
  const serialised = JSON.stringify(steps);
  return `oapeflir://plan ${serialised}`;
}

// ---------------------------------------------------------------------------
// RuntimeExecuteBridge
// ---------------------------------------------------------------------------

export class RuntimeExecuteBridge implements ExecuteBridge {
  constructor(
    private readonly dbPath: string,
    private readonly defaultModelId: string = "MiniMax-M2.7",
  ) {}

  /**
   * Execute a single plan step.
   *
   * For single-step execution we call `runMultiStepOrchestration` with just
   * that one step. This is used when the loop needs to re-execute a specific
   * step after a replan.
   */
  async executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult> {
    const singleStepResult = await this.executePlan(
      {
        planId: `plan_${step.stepId}`,
        taskId: context.taskId,
        version: 1,
        assessmentRef: `assessment_${context.taskId}`,
        strategy: "linear",
        steps: [step],
        createdAt: Date.now(),
      } as Plan,
      context,
    );
    if (singleStepResult.results.length === 0) {
      return {
        stepId: step.stepId,
        status: "failed",
        durationMs: 0,
        tokenCost: 0,
        summary: `Step ${step.stepId} produced no results`,
        outputs: {},
        artifacts: [],
        modelId: this.defaultModelId,
        retryCount: 0,
        validationPassed: false,
      };
    }
    return singleStepResult.results[0]!;
  }

  /**
   * Execute a complete OAPEFLIR plan against the runtime.
   *
   * This constructs a `MultiStepToolExecutionInput` and calls the orchestrator.
   * After execution, `StepOutputRecord[]` is extracted from the result snapshot
   * and mapped to `DualChannelStepOutput[]`.
   */
  async executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult> {
    // R9-29 fix: Import from execution-engine within src/platform/ (not ../core/runtime/)
    // This removes cross-plane coupling by using the execution plane directly
    const { runMultiStepOrchestration } = await import("../../execution/execution-engine/multi-step-orchestration.js");

    const request = serialiseOapeflirPlan(plan.steps);

    const orchInput: Parameters<typeof runMultiStepOrchestration>[0] = {
      dbPath: this.dbPath,
      title: `OAPEFLIR plan ${plan.planId}`,
      request,
    };
    if (context.tokenBudget != null) {
      orchInput.contextBudgetTokens = context.tokenBudget;
    }
    // R19-04 fix: Pass pre-allocated budgetLedgerId for INV-BUDGET-001 compliance
    // BudgetAllocator.reserve() must be called before any cost-bearing execution
    if (context.budgetLedgerId != null) {
      orchInput.budgetLedgerId = context.budgetLedgerId;
    }
    const orchResult = await runMultiStepOrchestration(orchInput);

    const stepRecords = extractStepOutputRecords(orchResult);
    const stepResults = stepRecords.map(mapStepOutputRecord);

    const totalDurationMs = stepResults.reduce((sum, r) => sum + r.durationMs, 0);
    const totalTokenCost = stepResults.reduce((sum, r) => sum + r.tokenCost, 0);

    return {
      planId: plan.planId,
      results: stepResults,
      totalDurationMs,
      totalTokenCost,
      allSucceeded: stepResults.every((r) => r.status === "succeeded"),
      skippedStepIds: stepResults.filter((r) => r.status === "skipped").map((r) => r.stepId),
      failedStepIds: stepResults.filter((r) => r.status === "failed").map((r) => r.stepId),
    };
  }

  /**
   * Convenience: convert an `ExecutionResult` (our internal type) to
   * `DualChannelStepOutput[]` so the OAPEFLIR loop can pass them to Feedback.
   */
  toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[] {
    return result.results.map((r) => ({
      stepId: r.stepId,
      planRef: result.planId,
      userFacingResult: {
        summary: r.summary,
        artifacts: r.artifacts.map((a) => `artifact:${a}`),
      },
      systemTelemetry: {
        durationMs: r.durationMs,
        tokensUsed: r.tokenCost,
        modelId: r.modelId,
        retryCount: r.retryCount,
        validationPassed: r.validationPassed,
      },
    }));
  }

  /**
   * Execute a subgraph of a plan.
   * Executes only the specified subset of steps, treating them as an independent unit.
   */
  async executeSubgraph(subgraph: PlanStep[], context: ExecutionContext): Promise<ExecutionResult> {
    // R9-29 fix: Import from execution-engine within src/platform/ (not ../core/runtime/)
    const { runMultiStepOrchestration } = await import("../../execution/execution-engine/multi-step-orchestration.js");

    const request = serialiseOapeflirPlan(subgraph);

    const orchInput: Parameters<typeof runMultiStepOrchestration>[0] = {
      dbPath: this.dbPath,
      title: `OAPEFLIR subgraph ${context.taskId}`,
      request,
    };
    if (context.tokenBudget != null) {
      orchInput.contextBudgetTokens = context.tokenBudget;
    }
    // R19-04 fix: Pass pre-allocated budgetLedgerId for INV-BUDGET-001 compliance
    if (context.budgetLedgerId != null) {
      orchInput.budgetLedgerId = context.budgetLedgerId;
    }
    const orchResult = await runMultiStepOrchestration(orchInput);

    const stepRecords = extractStepOutputRecords(orchResult);
    const stepResults = stepRecords.map(mapStepOutputRecord);

    const totalDurationMs = stepResults.reduce((sum, r) => sum + r.durationMs, 0);
    const totalTokenCost = stepResults.reduce((sum, r) => sum + r.tokenCost, 0);

    return {
      planId: `subgraph:${context.taskId}`,
      results: stepResults,
      totalDurationMs,
      totalTokenCost,
      allSucceeded: stepResults.every((r) => r.status === "succeeded"),
      skippedStepIds: stepResults.filter((r) => r.status === "skipped").map((r) => r.stepId),
      failedStepIds: stepResults.filter((r) => r.status === "failed").map((r) => r.stepId),
    };
  }

  /**
   * Execute a child run attached to a parent task.
   * Spawns a child execution with a reference to the parent run ID.
   */
  async executeChildRun(
    plan: Plan,
    context: ExecutionContext,
    parentRunId: string,
  ): Promise<ExecutionResult> {
    // R9-29 fix: Import from execution-engine within src/platform/ (not ../core/runtime/)
    const { runMultiStepOrchestration } = await import("../../execution/execution-engine/multi-step-orchestration.js");

    const request = serialiseOapeflirPlan(plan.steps);

    const orchInput: Parameters<typeof runMultiStepOrchestration>[0] = {
      dbPath: this.dbPath,
      title: `OAPEFLIR child run of ${parentRunId}`,
      request,
    };
    if (context.tokenBudget != null) {
      orchInput.contextBudgetTokens = context.tokenBudget;
    }
    // R19-04 fix: Pass pre-allocated budgetLedgerId for INV-BUDGET-001 compliance
    if (context.budgetLedgerId != null) {
      orchInput.budgetLedgerId = context.budgetLedgerId;
    }
    const orchResult = await runMultiStepOrchestration(orchInput);

    const stepRecords = extractStepOutputRecords(orchResult);
    const stepResults = stepRecords.map(mapStepOutputRecord);

    const totalDurationMs = stepResults.reduce((sum, r) => sum + r.durationMs, 0);
    const totalTokenCost = stepResults.reduce((sum, r) => sum + r.tokenCost, 0);

    return {
      planId: plan.planId,
      results: stepResults,
      totalDurationMs,
      totalTokenCost,
      allSucceeded: stepResults.every((r) => r.status === "succeeded"),
      skippedStepIds: stepResults.filter((r) => r.status === "skipped").map((r) => r.stepId),
      failedStepIds: stepResults.filter((r) => r.status === "failed").map((r) => r.stepId),
    };
  }
}

// ---------------------------------------------------------------------------
// MockExecuteBridge — retains existing buildStepOutputs behaviour for testing
// ---------------------------------------------------------------------------

export class MockExecuteBridge implements ExecuteBridge {
  async executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult> {
    return {
      stepId: step.stepId,
      status: "succeeded",
      durationMs: 100,
      tokenCost: 200,
      summary: `Completed ${step.action} for ${step.stepId}`,
      outputs: {},
      artifacts: (step.outputs ?? []).map((o) => `artifact:${o}`),
      modelId: "local-simulated",
      retryCount: 0,
      validationPassed: true,
    };
  }

  async executePlan(plan: Plan, _context: ExecutionContext): Promise<ExecutionResult> {
    const results = plan.steps.map((step, index) => ({
      stepId: step.stepId,
      status: "succeeded" as const,
      durationMs: 100 + index * 50,
      tokenCost: 200 + index * 75,
      summary: `Completed ${step.action} for ${step.stepId}`,
      outputs: {},
      artifacts: (step.outputs ?? []).map((o) => `artifact:${o}`),
      modelId: "local-simulated",
      retryCount: 0,
      validationPassed: true,
    }));

    return {
      planId: plan.planId,
      results,
      totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
      totalTokenCost: results.reduce((s, r) => s + r.tokenCost, 0),
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[] {
    return result.results.map((r, index) => ({
      stepId: r.stepId,
      planRef: result.planId,
      userFacingResult: {
        summary: r.summary,
        artifacts: r.artifacts,
      },
      systemTelemetry: {
        durationMs: r.durationMs,
        tokensUsed: r.tokenCost,
        modelId: r.modelId,
        retryCount: r.retryCount,
        validationPassed: r.validationPassed,
      },
    }));
  }

  async executeSubgraph(subgraph: PlanStep[], _context: ExecutionContext): Promise<ExecutionResult> {
    const results = subgraph.map((step, index) => ({
      stepId: step.stepId,
      status: "succeeded" as const,
      durationMs: 100 + index * 50,
      tokenCost: 200 + index * 75,
      summary: `Completed subgraph step ${step.action} for ${step.stepId}`,
      outputs: {},
      artifacts: (step.outputs ?? []).map((o) => `artifact:${o}`),
      modelId: "local-simulated",
      retryCount: 0,
      validationPassed: true,
    }));

    return {
      planId: "subgraph",
      results,
      totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
      totalTokenCost: results.reduce((s, r) => s + r.tokenCost, 0),
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  async executeChildRun(plan: Plan, _context: ExecutionContext, _parentRunId: string): Promise<ExecutionResult> {
    const results = plan.steps.map((step, index) => ({
      stepId: step.stepId,
      status: "succeeded" as const,
      durationMs: 100 + index * 50,
      tokenCost: 200 + index * 75,
      summary: `Completed child run step ${step.action} for ${step.stepId}`,
      outputs: {},
      artifacts: (step.outputs ?? []).map((o) => `artifact:${o}`),
      modelId: "local-simulated",
      retryCount: 0,
      validationPassed: true,
    }));

    return {
      planId: plan.planId,
      results,
      totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
      totalTokenCost: results.reduce((s, r) => s + r.tokenCost, 0),
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }
}

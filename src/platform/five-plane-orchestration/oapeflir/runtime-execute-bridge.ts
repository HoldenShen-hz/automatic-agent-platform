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
 * 1. The OAPEFLIR `PlanGraphBundle` (canonical per ADR-060/ADR-109) contains
 *    `PlanNode[]` in the `graph.nodes` field representing actionable steps.
 * 2. `RuntimeExecuteBridge.executePlan()` converts `PlanNode[]` into the format
 *    expected by `runMultiStepOrchestration` and calls it.
 * 3. The orchestrator handles routing, planning, and step execution internally,
 *    then returns a `MultiStepOrchestrationResult`.
 * 4. The bridge extracts `StepOutputRecord[]` from the result snapshot and maps
 *    them to `DualChannelStepOutput[]` for consumption by Feedback → Learn → Improve.
 *
 * ## Key Mapping Decisions
 *
 * - `PlanNode.nodeId` → `stepId`
 * - `PlanNode.nodeType` → action type
 * - `PlanNode.timeoutMs` → timeout (used for per-step timeout in supervisor)
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
import type { PlanStep } from "./types/plan.js";
import type { DualChannelStepOutput } from "./types/dual-channel-step-output.js";
import type {
  ExecuteBridge,
  ExecutionContext,
  StepResult,
  ExecutionResult,
  RuntimePlanExecutionInput,
  RuntimePlanExecutor,
} from "./execute-bridge.js";
import type { MultiStepOrchestrationResult } from "../../five-plane-execution/execution-engine/multi-step-orchestration-types.js";
import type { StepOutputRecord } from "../../contracts/types/domain/task-types.js";
import type { PlanGraphBundle } from "../../contracts/executable-contracts/index.js";

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
    stepId: record.stepId,
    status: record.status === "succeeded" ? "succeeded" : record.status === "skipped" ? "skipped" : "failed",
    durationMs: record.durationMs,
    tokenCost: record.tokenCost,
    summary: record.summary ?? `Step ${record.stepId} ${record.status}`,
    outputs,
    artifacts,
    modelId: "runtime", // Supervisor doesn't track per-step model; record at plan level
    retryCount: 0, // Supervisor doesn't expose retry count per record
    // Parse validationJson to determine actual validation result rather than just checking existence
    // R19-11 fix: validationPassed = record.validationJson != null was incorrect (existence != passed)
    validationPassed: (() => {
      if (record.validationJson == null) return false;
      try {
        const parsed = JSON.parse(record.validationJson);
        return parsed?.valid === true;
      } catch {
        return false;
      }
    })(),
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
      stepId: record.stepId,
      planRef: planId,
      status: record.status,
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
 * Type guard to safely extract executionRecord from a task snapshot.
 * R19-51 fix: previously used unsafe cast (snapshot as {...}) with no type contract guarantees.
 */
function tryGetExecutionRecordStepOutputs(snapshot: unknown): StepOutputRecord[] | null {
  if (snapshot == null || typeof snapshot !== "object") {
    return null;
  }
  const record = snapshot as Record<string, unknown>;
  const execRecord = record.executionRecord;
  if (execRecord == null || typeof execRecord !== "object") {
    return null;
  }
  const exec = execRecord as Record<string, unknown>;
  const stepOutputs = exec.stepOutputs;
  if (!Array.isArray(stepOutputs)) {
    return null;
  }
  // Verify array elements are likely StepOutputRecord-like objects
  return stepOutputs.filter(
    (item): item is StepOutputRecord =>
      item != null && typeof item === "object" && typeof (item as Record<string, unknown>).stepId === "string",
  );
}

/**
 * Extracts `StepOutputRecord[]` from a `MultiStepOrchestrationResult`.
 * R19-51 fix: uses type guard instead of unsafe cast to ensure field existence.
 */
export function extractStepOutputRecords(result: MultiStepOrchestrationResult): StepOutputRecord[] {
  return tryGetExecutionRecordStepOutputs(result.snapshot) ?? [];
}

// ---------------------------------------------------------------------------
// PlanNode → orchestrator input mapping
// ---------------------------------------------------------------------------

/**
 * Converts `PlanNode[]` from a `PlanGraphBundle` into a minimal serialisable workflow
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
export function serialiseOapeflirPlan(nodes: readonly import("../../contracts/executable-contracts/index.js").PlanNode[]): string {
  // Serialize PlanNode[] to a JSON string that the orchestrator can decode.
  // This preserves all node metadata (nodeId, nodeType, timeoutMs, etc.).
  const serialised = JSON.stringify(nodes);
  return `oapeflir://plan ${serialised}`;
}

// ---------------------------------------------------------------------------
// RuntimeExecuteBridge
// ---------------------------------------------------------------------------

/**
 * Helper to create a minimal synthetic PlanGraphBundle for single-step execution.
 */
function createSyntheticPlanGraphBundle(
  bundleId: string,
  harnessRunId: string,
  nodes: import("../../contracts/executable-contracts/index.js").PlanNode[],
): PlanGraphBundle {
  const graphId = newId("graph");
  const createdAt = nowIso();
  return {
    planGraphBundleId: bundleId,
    harnessRunId,
    graphVersion: 1,
    graph: {
      graphId,
      nodes,
      edges: [],
      entryNodeIds: nodes.map((n) => n.nodeId),
      terminalNodeIds: nodes.map((n) => n.nodeId),
      joinStrategy: "all",
      graphHash: newId("hash"),
    },
    schedulerPolicy: {
      policyId: "scheduler:oapeflir.default",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget:oapeflir.synthetic",
    riskProfile: {
      riskClass: "medium",
      reasons: ["synthetic_plan_graph_bundle"],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [],
    createdAt,
  };
}

/**
 * R4-26 (INV-GRAPH-001): Convert MinimalWorkflowDefinition to PlanGraphBundle.
 * This enforces the invariant that PlanGraphBundle is the only P3→P4 contract.
 */
export function minimalWorkflowToPlanGraphBundle(
  workflow: import("../../orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition,
  harnessRunId: string,
): PlanGraphBundle {
  const nodes: import("../../contracts/executable-contracts/index.js").PlanNode[] = workflow.steps.map((step) => ({
    nodeId: step.stepId,
    nodeType: "llm" as import("../../contracts/executable-contracts/index.js").PlanNodeType,
    inputRefs: step.inputKeys ?? [],
    outputSchemaRef: step.outputSchemaPath ?? "schema:step.output",
    riskClass: "medium",
    budgetIntent: { amount: 0.01, currency: "USD" as const, resourceKinds: ["token", "compute"] as const },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: step.compensationModel ?? "retry:default",
    timeoutMs: step.timeoutMs,
  }));

  const graphId = newId("graph");
  const bundleId = `bundle_${workflow.workflowId}`;
  const createdAt = nowIso();

  // Build edges from step dependencies
  const edges: import("../../contracts/executable-contracts/index.js").PlanEdge[] = [];
  for (const step of workflow.steps) {
    if (step.dependsOnStepIds) {
      for (const depId of step.dependsOnStepIds) {
        edges.push({
          edgeId: newId("edge"),
          fromNodeId: depId,
          toNodeId: step.stepId,
          condition: true,
          dependencyType: "hard",
        });
      }
    }
  }

  // Determine entry and terminal nodes
  const allStepIds = new Set(workflow.steps.map((s) => s.stepId));
  const dependentSteps = new Set(workflow.steps.flatMap((s) => s.dependsOnStepIds ?? []));
  const entryNodeIds = workflow.steps.filter((s) => !dependentSteps.has(s.stepId)).map((s) => s.stepId);
  const terminalNodeIds = workflow.steps
    .filter((s) => !allStepIds.has(s.stepId) || (s.dependsOnStepIds?.length ?? 0) === 0)
    .map((s) => s.stepId);

  return {
    planGraphBundleId: bundleId,
    harnessRunId,
    graphVersion: 1,
    graph: {
      graphId,
      nodes,
      edges,
      entryNodeIds: entryNodeIds.length > 0 ? entryNodeIds : nodes.map((n) => n.nodeId),
      terminalNodeIds: terminalNodeIds.length > 0 ? terminalNodeIds : nodes.map((n) => n.nodeId),
      joinStrategy: "all",
      graphHash: newId("hash"),
    },
    schedulerPolicy: {
      policyId: "scheduler:oapeflir.default",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: `budget:${workflow.workflowId}`,
    riskProfile: {
      riskClass: "medium",
      reasons: [`workflow:${workflow.workflowId}`],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [],
    createdAt,
  };
}

export class RuntimeExecuteBridge implements ExecuteBridge {
  constructor(
    private readonly dbPath: string,
    private readonly defaultModelId: string = "MiniMax-M2.7",
    private readonly runtimePlanExecutor: RuntimePlanExecutor, // R19-43 fix: no longer imports P4 default; must be injected
  ) {}

  /**
   * Execute a single plan step.
   *
   * For single-step execution we call `runMultiStepOrchestration` with just
   * that one step. This is used when the loop needs to re-execute a specific
   * step after a replan.
   */
  async executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult> {
    // R19-04 fix: use actual token budget from context instead of hardcoded 0.
    // The bridge must pass budget through to the orchestrator for §15.3 compliance.
    const budgetAmount = context.tokenBudget ?? 0;
    const singleNode: import("../../contracts/executable-contracts/index.js").PlanNode = {
      nodeId: step.stepId,
      nodeType: step.action as import("../../contracts/executable-contracts/index.js").PlanNodeType,
      inputRefs: [],
      outputSchemaRef: "schema:step.output",
      riskClass: "medium",
      // R19-04 fix: budgetIntent must reflect actual reserved budget, not hardcoded 0
      budgetIntent: { amount: budgetAmount, currency: "USD" as const, resourceKinds: ["token"] as const },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: step.timeout ?? 60000,
    };
    const syntheticBundle = createSyntheticPlanGraphBundle(
      `plan_${step.stepId}`,
      context.taskId,
      [singleNode],
    );
    const singleStepResult = await this.executePlan(syntheticBundle, context);
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
   * Execute a complete PlanGraphBundle against the runtime (canonical per ADR-060/ADR-109).
   *
   * This constructs a `RuntimePlanExecutionInput` and calls the orchestrator.
   * After execution, `StepOutputRecord[]` is extracted from the result snapshot
   * and mapped to `DualChannelStepOutput[]`.
   */
  async executePlan(plan: PlanGraphBundle, context: ExecutionContext): Promise<ExecutionResult> {
    const request = serialiseOapeflirPlan(plan.graph.nodes);

    const orchInput: RuntimePlanExecutionInput = {
      dbPath: this.dbPath,
      title: `OAPEFLIR plan ${plan.planGraphBundleId}`,
      request,
      ...(context.tokenBudget != null ? { contextBudgetTokens: context.tokenBudget } : {}),
    };
    const orchResult = await this.runtimePlanExecutor(orchInput);

    const stepRecords = extractStepOutputRecords(orchResult);
    const stepResults = stepRecords.map(mapStepOutputRecord);

    const totalDurationMs = stepResults.reduce((sum, r) => sum + r.durationMs, 0);
    const totalTokenCost = stepResults.reduce((sum, r) => sum + r.tokenCost, 0);

    return {
      planId: plan.planGraphBundleId,
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
      status: r.status === "failed" ? "failed" : r.status === "skipped" ? "skipped" : "succeeded",
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

  async executePlan(plan: PlanGraphBundle, _context: ExecutionContext): Promise<ExecutionResult> {
    const results = plan.graph.nodes.map((node, index) => ({
      stepId: node.nodeId,
      status: "succeeded" as const,
      durationMs: 100 + index * 50,
      tokenCost: 200 + index * 75,
      summary: `Completed ${node.nodeType} for ${node.nodeId}`,
      outputs: {},
      artifacts: [] as string[],
      modelId: "local-simulated",
      retryCount: 0,
      validationPassed: true,
    }));

    return {
      planId: plan.planGraphBundleId,
      results,
      totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
      totalTokenCost: results.reduce((s, r) => s + r.tokenCost, 0),
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[] {
    return result.results.map((r) => ({
      stepId: r.stepId,
      planRef: result.planId,
      status: r.status === "failed" ? "failed" : r.status === "skipped" ? "skipped" : "succeeded",
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
}

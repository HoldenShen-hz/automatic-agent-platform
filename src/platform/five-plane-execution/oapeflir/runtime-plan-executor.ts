import { runMultiStepOrchestration } from "../execution-engine/multi-step-orchestration.js";
import type { PlanGraphBundle, PlanNode } from "../../contracts/executable-contracts/index.js";
import type { MultiStepOrchestrationResult } from "../execution-engine/multi-step-orchestration-types.js";

export interface RuntimePlanExecutionInput {
  dbPath: string;
  planGraphBundle: PlanGraphBundle;
  contextBudgetTokens?: number;
}

export type RuntimePlanExecutor = (
  input: RuntimePlanExecutionInput,
) => Promise<MultiStepOrchestrationResult>;

export async function executeOapeflirRuntimePlan(
  input: RuntimePlanExecutionInput,
): Promise<MultiStepOrchestrationResult> {
  return runMultiStepOrchestration({
    dbPath: input.dbPath,
    taskId: input.planGraphBundle.planGraphBundleId,
    harnessRunId: input.planGraphBundle.harnessRunId,
    title: input.planGraphBundle.planGraphBundleId,
    request: serialisePlanGraphBundle(input.planGraphBundle),
    ...(input.contextBudgetTokens == null ? {} : { contextBudgetTokens: input.contextBudgetTokens }),
  });
}

function serialisePlanGraphBundle(bundle: PlanGraphBundle): string {
  return `oapeflir://plan ${JSON.stringify(bundle.graph.nodes.map(planNodeToRuntimeStep))}`;
}

function planNodeToRuntimeStep(node: PlanNode): {
  stepId: string;
  action: string;
  inputs: Record<string, unknown>;
  outputs: string[];
  dependencies: string[];
  status: "pending";
  timeout: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
} {
  return {
    stepId: node.nodeId,
    action: node.nodeType,
    inputs: {},
    outputs: [node.outputSchemaRef],
    dependencies: [...node.inputRefs],
    status: "pending",
    timeout: node.timeoutMs,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
}

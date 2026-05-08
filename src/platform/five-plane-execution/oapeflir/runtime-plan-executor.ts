import { runMultiStepOrchestration } from "../execution-engine/multi-step-orchestration.js";
import type { PlanGraphBundle } from "../../contracts/executable-contracts/index.js";
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
    title: `OAPEFLIR plan ${input.planGraphBundle.planGraphBundleId}`,
    request: "",
    ...(input.contextBudgetTokens == null ? {} : { contextBudgetTokens: input.contextBudgetTokens }),
  });
}

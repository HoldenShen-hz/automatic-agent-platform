import { runMultiStepOrchestration } from "../execution-engine/multi-step-orchestration.js";
import type { MultiStepOrchestrationResult } from "../execution-engine/multi-step-orchestration-types.js";

export interface RuntimePlanExecutionInput {
  dbPath: string;
  title: string;
  request: string;
  contextBudgetTokens?: number;
}

export type RuntimePlanExecutor = (
  input: RuntimePlanExecutionInput,
) => Promise<MultiStepOrchestrationResult>;

export async function executeOapeflirRuntimePlan(
  input: RuntimePlanExecutionInput,
): Promise<MultiStepOrchestrationResult> {
  return runMultiStepOrchestration(input);
}

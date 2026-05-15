import { join } from "node:path";

import { DEFAULT_DIVISIONS_ROOT } from "../../../domains/governance/division-loader-support.js";
import type { PlanStep } from "../../five-plane-orchestration/oapeflir/types/plan.js";
import type { MinimalWorkflowDefinition, MinimalWorkflowStep } from "../../five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";
import type { PlannedExecutionStep, PlannedWorkflow } from "../../five-plane-orchestration/routing/workflow-planner.js";

export const OAPEFLIR_PLAN_PREFIX = "oapeflir://plan ";
const GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH = join(
  DEFAULT_DIVISIONS_ROOT,
  "general_ops",
  "schemas",
  "minimal-output.json",
);

export function isOapeflirPlanRequest(request: string): boolean {
  return request.startsWith(OAPEFLIR_PLAN_PREFIX);
}

export function deserializeOapeflirPlan(request: string): PlanStep[] {
  const json = request.slice(OAPEFLIR_PLAN_PREFIX.length);
  return JSON.parse(json) as PlanStep[];
}

function resolveOapeflirRoleId(_step: PlanStep): string {
  return "general_executor";
}

function oapeflirStepToMinimalStep(step: PlanStep): MinimalWorkflowStep {
  return {
    stepId: step.stepId,
    roleId: resolveOapeflirRoleId(step),
    outputKey: step.outputs?.[0] ?? `output_${step.stepId}`,
    outputSchemaPath: GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
    inputKeys: step.dependencies,
    timeoutMs: step.timeout,
    maxAttempts: Math.max(1, step.retryPolicy.maxRetries + 1),
    dependsOnStepIds: step.dependencies,
  };
}

export function buildOapeflirPlannedWorkflow(
  steps: readonly PlanStep[],
  planId: string,
): PlannedWorkflow {
  const workflowDef: MinimalWorkflowDefinition = {
    workflowId: `oapeflir_${planId}`,
    divisionId: "general_ops",
    steps: steps.map(oapeflirStepToMinimalStep),
  };

  const executionSteps: PlannedExecutionStep[] = workflowDef.steps.map((step) => {
    const stepDeps = step.dependsOnStepIds ?? [];
    return {
      stepId: step.stepId,
      divisionId: step.divisionId ?? workflowDef.divisionId,
      roleId: step.roleId,
      inputKeys: step.inputKeys ?? [],
      agentId: `agent_${step.roleId}`,
      outputKey: step.outputKey,
      outputSchemaPath: step.outputSchemaPath ?? null,
      dependsOnStepIds: stepDeps,
      dependencyTypes: Object.fromEntries(
        stepDeps.map((depId) => [depId, "hard"]),
      ),
      timeoutMs: step.timeoutMs,
      maxAttempts: step.maxAttempts,
      ...(step.compensationModel ? { compensationModel: step.compensationModel } : {}),
    };
  });

  return {
    workflow: workflowDef,
    executionSteps,
    planReason: `oapeflir_bridge: ${planId}`,
    dependencyEdges: [],
  };
}

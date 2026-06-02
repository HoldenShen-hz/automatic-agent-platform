import type { PlanGraphNode, PlanStep } from "../../five-plane-orchestration/oapeflir/types/plan.js";
import {
  GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
  type MinimalWorkflowDefinition,
  type MinimalWorkflowStep,
} from "../../five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";
import type { PlannedExecutionStep, PlannedWorkflow } from "../../five-plane-orchestration/routing/workflow-planner.js";

export const OAPEFLIR_PLAN_PREFIX = "oapeflir://plan ";

export function isOapeflirPlanRequest(request: string): boolean {
  return request.startsWith(OAPEFLIR_PLAN_PREFIX);
}

export function deserializeOapeflirPlan(request: string): PlanStep[] {
  const json = request.slice(OAPEFLIR_PLAN_PREFIX.length);
  return JSON.parse(json) as PlanStep[];
}

type OapeflirPlanInput = PlanStep | PlanGraphNode;

function resolveOapeflirRoleId(_step: OapeflirPlanInput): string {
  return "general_executor";
}

function isLegacyPlanStep(step: OapeflirPlanInput): step is PlanStep {
  return "stepId" in step;
}

function resolvePlanGraphOutputSchemaPath(step: PlanGraphNode): string {
  const outputSchemaRef = "outputSchemaRef" in step ? step.outputSchemaRef : undefined;
  return typeof outputSchemaRef === "string" && outputSchemaRef.length > 0
    ? outputSchemaRef
    : `schema:${step.nodeId}.output`;
}

function oapeflirStepToMinimalStep(step: OapeflirPlanInput): MinimalWorkflowStep {
  if (isLegacyPlanStep(step)) {
    return {
      stepId: step.stepId,
      roleId: resolveOapeflirRoleId(step),
      outputKey: step.outputs?.[0] ?? `output_${step.stepId}`,
      outputSchemaPath: step.outputSchemaPath ?? GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
      inputKeys: step.dependencies,
      timeoutMs: step.timeout,
      maxAttempts: Math.max(1, step.retryPolicy.maxRetries + 1),
      dependsOnStepIds: step.dependencies,
    };
  }

  const stepId = step.nodeId;
  const dependencies = step.inputRefs ?? [];
  return {
    stepId,
    roleId: resolveOapeflirRoleId(step),
    outputKey: stepId,
    // Graph-node plans usually carry schema refs instead of loadable schema paths.
    // Keep a non-empty schema identifier so output validation can fail open when
    // the schema is not locally materialized.
    outputSchemaPath: resolvePlanGraphOutputSchemaPath(step),
    inputKeys: dependencies,
    timeoutMs: step.timeoutMs ?? 30_000,
    maxAttempts: 1,
    dependsOnStepIds: dependencies,
  };
}

export function buildOapeflirPlannedWorkflow(
  steps: readonly OapeflirPlanInput[],
  planId: string,
): PlannedWorkflow {
  const workflowDef: MinimalWorkflowDefinition = {
    workflowId: `oapeflir_${planId}`,
    divisionId: "general-ops",
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

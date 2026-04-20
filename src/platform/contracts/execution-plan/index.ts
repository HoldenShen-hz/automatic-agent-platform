import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export interface ExecutionPlanStep {
  stepId: string;
  title: string;
  actionRef: string;
  dependsOn: string[];
  requiresApproval: boolean;
}

export interface ExecutionPlan {
  planId: string;
  taskId: string;
  tenantId: string | null;
  version: number;
  steps: ExecutionPlanStep[];
  createdAt: string;
}

export function createExecutionPlan(input: Omit<ExecutionPlan, "planId" | "createdAt"> & {
  planId?: string;
  createdAt?: string;
}): ExecutionPlan {
  if (input.steps.length === 0) {
    throw new ValidationError("execution_plan.steps_required", "Execution plan requires at least one step.");
  }
  for (const step of input.steps) {
    if (step.stepId.trim().length === 0 || step.actionRef.trim().length === 0 || step.title.trim().length === 0) {
      throw new ValidationError("execution_plan.invalid_step", "Execution plan step is missing required fields.", {
        details: { step },
      });
    }
  }
  return {
    planId: input.planId ?? newId("plan"),
    taskId: input.taskId,
    tenantId: input.tenantId ?? null,
    version: input.version,
    steps: input.steps.map((step) => ({ ...step, dependsOn: [...step.dependsOn] })),
    createdAt: input.createdAt ?? nowIso(),
  };
}

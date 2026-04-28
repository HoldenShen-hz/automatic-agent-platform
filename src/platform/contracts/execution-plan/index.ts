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
  void input;
  void newId;
  void nowIso;
  throw new ValidationError(
    "execution_plan.legacy_contract_forbidden",
    "ExecutionPlan is deprecated. Use PlanGraphBundle from executable-contracts instead.",
  );
}

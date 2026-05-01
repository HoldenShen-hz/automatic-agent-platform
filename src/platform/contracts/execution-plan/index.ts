import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import type { PlanGraphBundle } from "../executable-contracts/index.js";

// Re-export canonical PlanGraphBundle from executable-contracts for backward compatibility
export {
  type PlanGraphBundle,
  type PlanGraph,
  type PlanNode,
  type PlanEdge,
  type GraphValidationReport,
  type GraphRiskFinding,
  type GraphWorstPathAnalysis,
  type GraphPatch,
  type GraphPatchOperation,
  type ReadyNodeSchedulingPolicy,
  createPlanGraphBundle,
  createGraphPatch,
} from "../executable-contracts/index.js";

/**
 * @deprecated ExecutionPlanStep is deprecated per §4.4. Use PlanGraphBundle/PlanNode from executable-contracts instead.
 * This interface is retained for legacy adapter compatibility only.
 */
export interface ExecutionPlanStep {
  stepId: string;
  title: string;
  actionRef: string;
  dependsOn: string[];
  requiresApproval: boolean;
}

/**
 * @deprecated ExecutionPlan is deprecated per §4.4. Use PlanGraphBundle from executable-contracts instead.
 * This type alias is retained for backward compatibility only. The createExecutionPlan factory
 * throws an error to prevent usage - migrate to PlanGraphBundle.
 *
 * Legacy fields (planId, taskId, tenantId, version, steps, createdAt) are NOT carried forward
 * because the graph-based execution model uses PlanGraphBundle's structure instead.
 *
 * Root cause: Two parallel execution plan contracts existed without proper deprecation.
 * Canonical replacement is PlanGraphBundle which uses graph-based structure (nodes/edges)
 * vs legacy linear steps[] structure.
 */
export type ExecutionPlan = PlanGraphBundle;

/**
 * @deprecated ExecutionPlan factory is deprecated per §4.4.
 * Use PlanGraphBundle from executable-contracts instead.
 */
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

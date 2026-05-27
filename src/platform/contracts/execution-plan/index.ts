import type { PlanGraphBundle } from "../executable-contracts/index.js";
import { ValidationError } from "../errors.js";

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
 * @deprecated ExecutionPlan is deprecated per §4.4. Use PlanGraphBundle from executable-contracts instead.
 * This factory exists only to provide a clear error message when called.
 * All ExecutionPlan usages must be migrated to PlanGraphBundle.
 */
export function createExecutionPlan(_input: {
  taskId: string;
  tenantId: string;
  version: number;
  steps: readonly ExecutionPlanStep[];
}): never {
  throw new ValidationError(
    "execution_plan.legacy_contract_forbidden",
    "ExecutionPlan is deprecated per §4.4. Use PlanGraphBundle from executable-contracts instead.",
  );
}

// Runtime warning for imports from legacy contract path
process.emitWarning(
  "[DEPRECATED] execution-plan/ is deprecated. " +
  "Use PlanGraphBundle from src/platform/contracts/executable-contracts instead. " +
  "See: docs_zh/contracts/README.md",
  { code: "AA_LEGACY_EXECUTION_PLAN" },
);

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

// ExecutionPlan type alias removed per R16-93 — PlanGraphBundle is the canonical type (ADR-109).
// Factory is forbidden per ADR-109 — use createPlanGraphBundle from executable-contracts instead.

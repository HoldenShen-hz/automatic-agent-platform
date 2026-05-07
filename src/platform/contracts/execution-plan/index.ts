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

// Runtime warning for imports from legacy contract path
console.warn(
  "[DEPRECATED] execution-plan/ is deprecated. " +
  "Use PlanGraphBundle from src/platform/contracts/executable-contracts instead. " +
  "See: https://docs.example.com/platform/contracts#execution-plan-migration",
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

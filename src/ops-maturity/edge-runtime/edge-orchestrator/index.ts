import type { PlanGraph } from "../../../platform/contracts/executable-contracts/index.js";

export interface EdgePlanGraphBundle {
  // R6-22 FIX: Use PlanGraph structure instead of linear orderedTaskIds for proper graph semantics
  readonly planGraph: PlanGraph;
  /** @deprecated compatibility alias; use planGraph */
  readonly planGraphBundle?: Readonly<{ readonly graph: PlanGraph }>;
  /** @deprecated compatibility alias; use planGraph.nodes/input ordering */
  readonly orderedTaskIds?: readonly string[];
  readonly syncRequired: boolean;
  readonly priority: "low" | "normal" | "high";
}

/** @deprecated compatibility export; use EdgePlanGraphBundle */
export type EdgeExecutionPlan = EdgePlanGraphBundle;

export function buildEdgeExecutionPlan(
  taskIds: readonly string[],
  priority: EdgePlanGraphBundle["priority"] = "normal",
): EdgePlanGraphBundle {
  // Build a proper PlanGraph structure with sequential edges
  const nodes = taskIds.map((taskId, idx) => ({
    nodeId: `edge_node_${taskId}`,
    nodeType: "tool" as const,
    inputRefs: idx === 0 ? [`task:${taskId}`] : [`edge_node_${taskIds[idx - 1]}`],
    outputSchemaRef: `schema:edge.${taskId}`,
    riskClass: "medium" as const,
    budgetIntent: { amount: 1000, currency: "credits", resourceKinds: ["compute"] as const },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry:edge.default",
    timeoutMs: 60000,
  }));

  const edges = taskIds.slice(1).map((_, idx) => ({
    edgeId: `edge_edge_${idx}`,
    fromNodeId: `edge_node_${taskIds[idx]}`,
    toNodeId: `edge_node_${taskIds[idx + 1]}`,
    condition: { type: "always" as const },
    dependencyType: "hard" as const,
  }));

  const planGraph: PlanGraph = {
    graphId: `edge_graph_${taskIds.join(":")}`,
    nodes,
    edges,
    entryNodeIds: taskIds.length > 0 ? [`edge_node_${taskIds[0]}`] : [],
    terminalNodeIds: taskIds.length > 0 ? [`edge_node_${taskIds[taskIds.length - 1]}`] : [],
    joinStrategy: "first_success",
    graphHash: `edge_hash_${taskIds.join(":")}`,
  };

  return {
    planGraph,
    planGraphBundle: { graph: planGraph },
    orderedTaskIds: [...taskIds],
    syncRequired: true,
    priority,
  };
}

/**
 * @deprecated Use buildEdgeExecutionPlan which returns EdgePlanGraphBundle with proper PlanGraph
 * This function is retained for backward compatibility.
 */
export function buildLegacyEdgeExecutionPlan(
  taskIds: readonly string[],
  priority: EdgePlanGraphBundle["priority"] = "normal",
): { orderedTaskIds: readonly string[]; syncRequired: boolean; priority: EdgePlanGraphBundle["priority"] } {
  return {
    orderedTaskIds: [...taskIds],
    syncRequired: true,
    priority,
  };
}

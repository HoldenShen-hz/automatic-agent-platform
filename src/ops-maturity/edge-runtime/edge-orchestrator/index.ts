import { createHash } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type {
  PlanNode,
  PlanEdge,
  PlanGraph,
  PlanGraphBundle,
  PlanNodeType,
  DependencyType,
  ReadyNodeSchedulingPolicy,
  RiskPreview,
  GraphValidationReport,
  BudgetIntent,
  SideEffectProfile,
} from "../../platform/contracts/executable-contracts/index.js";

/**
 * EdgePlanGraphBundle - Edge runtime execution plan with explicit graph structure.
 *
 * R6-22 FIX: Edge runtime now uses proper PlanGraph structure with nodes and edges.
 * The deprecated linear orderedTaskIds approach has been replaced with canonical
 * PlanGraph that supports DAG-based execution for edge scenarios.
 */
export interface EdgePlanGraphBundle {
  readonly planGraphBundle: PlanGraphBundle;
  readonly syncRequired: boolean;
  readonly priority: "low" | "normal" | "high";
}

/** @deprecated compatibility export; use EdgePlanGraphBundle */
export type EdgeExecutionPlan = EdgePlanGraphBundle;

/**
 * R6-22 FIX: Builds a proper PlanGraph from edge task IDs.
 * Each task becomes a node in the graph, with sequential edges between them.
 * This ensures edge execution uses proper PlanGraph structure per §4.4.
 */
export function buildEdgeExecutionPlan(
  taskIds: readonly string[],
  priority: EdgePlanGraphBundle["priority"] = "normal",
): EdgePlanGraphBundle {
  const planGraphBundleId = newId("edge_plan");
  const harnessRunId = newId("edge_harness");
  const graphVersion = 1;

  // Build nodes from task IDs - each task becomes a node
  const nodes: PlanNode[] = taskIds.map((taskId, index) => ({
    nodeId: `edge_node_${taskId}`,
    nodeType: determineNodeType(taskId),
    inputRefs: index > 0 ? [`edge_node_${taskIds[index - 1]}`] : [],
    outputSchemaRef: `edge_schema_${taskId}`,
    riskClass: determineRiskClass(taskId),
    budgetIntent: { costLimitUsd: null, burstLimitPercent: null },
    sideEffectProfile: { allowsSideEffects: false, requiresRollback: false },
    retryPolicyRef: "edge_default_retry",
    timeoutMs: 300000, // 5 min default
  }));

  // Build edges - sequential dependencies
  const edges: PlanEdge[] = [];
  for (let i = 0; i < taskIds.length - 1; i++) {
    edges.push({
      edgeId: `edge_edge_${taskIds[i]}_to_${taskIds[i + 1]}`,
      sourceNodeId: `edge_node_${taskIds[i]}`,
      targetNodeId: `edge_node_${taskIds[i + 1]}`,
      dependencyType: "hard" as DependencyType,
      condition: null,
    });
  }

  const entryNodeIds = taskIds.length > 0 ? [`edge_node_${taskIds[0]}`] : [];
  const terminalNodeIds = taskIds.length > 0 ? [`edge_node_${taskIds[taskIds.length - 1]}`] : [];

  const graph: PlanGraph = {
    graphId: newId("edge_graph"),
    nodes,
    edges,
    entryNodeIds,
    terminalNodeIds,
    joinStrategy: "first_success",
    graphHash: createHash("sha256")
      .update(JSON.stringify({ nodes, edges }))
      .digest("hex"),
  };

  const schedulerPolicy: ReadyNodeSchedulingPolicy = {
    policyId: "edge_scheduler",
    strategy: priority === "high" ? "priority_then_fifo" : "deterministic_fifo",
  };

  const validationReport: GraphValidationReport = {
    valid: true,
    findings: [],
  };

  const planGraphBundle: PlanGraphBundle = {
    planGraphBundleId,
    harnessRunId,
    graphVersion,
    graph,
    schedulerPolicy,
    budgetPlanRef: "edge_budget",
    riskProfile: {
      overallRiskClass: "low",
      riskLevel: "low",
      detectedAt: nowIso(),
      factors: [],
    },
    validationReport,
    artifactRefs: [],
    createdAt: nowIso(),
  };

  return {
    planGraphBundle,
    syncRequired: true,
    priority,
  };
}

/**
 * Determines the node type based on task ID patterns.
 * R6-22: Edge nodes use task ID heuristics for type determination.
 */
function determineNodeType(taskId: string): PlanNodeType {
  const lower = taskId.toLowerCase();
  if (lower.includes("llm") || lower.includes("model") || lower.includes("inference")) {
    return "llm";
  }
  if (lower.includes("tool") || lower.includes("exec")) {
    return "tool";
  }
  if (lower.includes("router") || lower.includes("route")) {
    return "router";
  }
  if (lower.includes("evaluator") || lower.includes("eval")) {
    return "evaluator";
  }
  if (lower.includes("subgraph") || lower.includes("workflow")) {
    return "subgraph";
  }
  if (lower.includes("hitl") || lower.includes("human") || lower.includes("approve")) {
    return "hitl_wait";
  }
  if (lower.includes("compensate") || lower.includes("rollback")) {
    return "compensation";
  }
  return "tool"; // Default to tool for simple edge tasks
}

/**
 * Determines risk class based on task ID patterns.
 * R6-22: Edge nodes assess risk at the node level.
 */
function determineRiskClass(taskId: string): import("../../platform/contracts/executable-contracts/index.js").RiskClass {
  const lower = taskId.toLowerCase();
  if (lower.includes("critical") || lower.includes("prod") || lower.includes("payment")) {
    return "critical";
  }
  if (lower.includes("high") || lower.includes("admin") || lower.includes("write")) {
    return "high";
  }
  if (lower.includes("medium") || lower.includes("update") || lower.includes("modify")) {
    return "medium";
  }
  return "low"; // Default to low for edge tasks
}

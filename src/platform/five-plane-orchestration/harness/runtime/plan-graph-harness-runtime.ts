import { ValidationError } from "../../../contracts/errors.js";
import { newId } from "../../../contracts/types/ids.js";
import {
  createNodeAttempt,
  createNodeAttemptReceipt,
  createNodeRun,
  createPlatformFactEvent,
  type HarnessRun,
  type GraphRiskFinding,
  type GraphValidationReport,
  type GraphWorstPathAnalysis,
  type NodeAttempt,
  type NodeAttemptReceipt,
  type NodeRun,
  type PlanGraphBundle,
  type PlanGraph,
  type PlanNode,
  type PlanEdge,
  type PlatformFactEvent,
} from "../../../contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../execution/runtime-state-machine.js";

export interface PlanGraphSchedulerInput {
  readonly planGraphBundle: PlanGraphBundle;
  readonly completedNodeIds?: readonly string[];
}

export interface PlanGraphHarnessRuntimeContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly executorRef: string;
}

export interface PlanGraphHarnessRuntimeStepResult {
  readonly nodeRun: NodeRun;
  readonly nodeAttempt: NodeAttempt;
  readonly receipt: NodeAttemptReceipt;
  readonly events: readonly PlatformFactEvent[];
}

const RISK_RANK: Readonly<Record<PlanNode["riskClass"], number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export class PlanGraphAnalyzer {
  public normalize(bundle: PlanGraphBundle): PlanGraphBundle {
    const graph = bundle.graph;
    const nodes = [...graph.nodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    const edges = [...graph.edges].sort((left, right) => left.edgeId.localeCompare(right.edgeId));
    return {
      ...bundle,
      graph: {
        ...graph,
        nodes,
        edges,
        entryNodeIds: [...graph.entryNodeIds].sort(),
        terminalNodeIds: [...graph.terminalNodeIds].sort(),
      },
      validationReport: this.validate({
        ...bundle,
        graph: {
          ...graph,
          nodes,
          edges,
          entryNodeIds: [...graph.entryNodeIds].sort(),
          terminalNodeIds: [...graph.terminalNodeIds].sort(),
        },
      }),
    };
  }

  public validate(bundle: PlanGraphBundle): GraphValidationReport {
    const findings: string[] = [];
    const nodeIds = new Set(bundle.graph.nodes.map((node) => node.nodeId));
    const normalizedNodeIds = [...nodeIds].sort();

    if (nodeIds.size !== bundle.graph.nodes.length) {
      findings.push("duplicate_node_id");
    }
    for (const nodeId of [...bundle.graph.entryNodeIds, ...bundle.graph.terminalNodeIds]) {
      if (!nodeIds.has(nodeId)) {
        findings.push(`missing_declared_node:${nodeId}`);
      }
    }
    for (const edge of bundle.graph.edges) {
      if (!nodeIds.has(edge.fromNodeId)) {
        findings.push(`missing_edge_from:${edge.edgeId}`);
      }
      if (!nodeIds.has(edge.toNodeId)) {
        findings.push(`missing_edge_to:${edge.edgeId}`);
      }
    }

    return {
      valid: findings.length === 0,
      findings,
      normalizedNodeIds,
      riskPropagation: this.propagateRisk(bundle),
      worstPath: this.analyzeWorstPath(bundle),
    };
  }

  public propagateRisk(bundle: PlanGraphBundle): readonly GraphRiskFinding[] {
    return bundle.graph.nodes
      .filter((node) => RISK_RANK[node.riskClass] >= RISK_RANK.high || node.sideEffectProfile.mayCommitExternalEffect)
      .map((node) => ({
        nodeId: node.nodeId,
        inheritedRiskClass: node.riskClass,
        reasons: [
          ...(RISK_RANK[node.riskClass] >= RISK_RANK.high ? ["node_high_risk"] : []),
          ...(node.sideEffectProfile.mayCommitExternalEffect ? ["external_side_effect"] : []),
        ],
      }));
  }

  public analyzeWorstPath(bundle: PlanGraphBundle): GraphWorstPathAnalysis {
    const sorted = [...bundle.graph.nodes].sort((left, right) => {
      const riskDelta = RISK_RANK[right.riskClass] - RISK_RANK[left.riskClass];
      return riskDelta !== 0 ? riskDelta : right.budgetIntent.amount - left.budgetIntent.amount;
    });
    const [highestRisk] = sorted;
    return {
      pathNodeIds: sorted.map((node) => node.nodeId),
      riskClass: highestRisk?.riskClass ?? "low",
      estimatedBudgetAmount: sorted.reduce((sum, node) => sum + node.budgetIntent.amount, 0),
      timeoutMs: sorted.reduce((sum, node) => sum + node.timeoutMs, 0),
    };
  }
}

export interface PlanGraphSchedulerInput {
  readonly planGraphBundle: PlanGraphBundle;
  readonly completedNodeIds?: readonly string[];
}

/**
 * @deprecated PlanGraphScheduler is deprecated per §14.9.
 * Use ReadyNodeSchedulingPolicy with "critical_path_rank" field instead.
 * This scheduler is retained for backward compatibility only.
 */
export class PlanGraphScheduler {
  /**
   * @deprecated Use computeCriticalPathRanks() from plan-graph-analyzer instead.
   * Computes critical path rank for each node based on longest path to terminal nodes.
   * Higher rank = more critical for overall execution time.
   */
  public computeCriticalPathRanks(bundle: PlanGraphBundle): ReadonlyMap<string, number> {
    return computeCriticalPathRanksFromGraph(bundle.graph);
  }

  public decisionEvent(input: PlanGraphSchedulerInput & {
    readonly tenantId: string;
    readonly traceId: string;
    readonly emittedBy: string;
  }): PlatformFactEvent {
    const readyNodes = this.readyNodes(input);
    const criticalPathRanks = this.computeCriticalPathRanks(input.planGraphBundle);
    return createPlatformFactEvent({
      eventType: "platform.graph_scheduler.decision_recorded",
      aggregateType: "PlanGraphBundle",
      aggregateId: input.planGraphBundle.planGraphBundleId,
      aggregateSeq: input.planGraphBundle.graphVersion,
      tenantId: input.tenantId,
      runId: input.traceId,
      traceId: input.traceId,
      payload: {
        schedulerPolicy: input.planGraphBundle.schedulerPolicy.strategy,
        readyNodeIds: readyNodes.map((node) => node.nodeId),
        criticalPathRanks: Object.fromEntries(criticalPathRanks.entries()),
        completedNodeIds: input.completedNodeIds ?? [],
        deterministicSeed: input.planGraphBundle.graph.graphHash,
        emittedBy: input.emittedBy,
      },
      schemaOwner: "graph-scheduler",
      consumerContractTests: ["plan-graph-harness-runtime.test.ts"],
    });
  }

  public readyNodes(input: PlanGraphSchedulerInput): readonly PlanNode[] {
    const completed = new Set(input.completedNodeIds ?? []);
    const graph = input.planGraphBundle.graph;
    const criticalPathRanks = computeCriticalPathRanksFromGraph(graph);
    const sortedNodes = [...graph.nodes].sort((left, right) => {
      // R6-04 FIX: Sort by critical_path_rank descending (most critical first)
      // Then by nodeId ascending for determinism within same rank
      const rankDelta = (criticalPathRanks.get(right.nodeId) ?? 0) - (criticalPathRanks.get(left.nodeId) ?? 0);
      if (rankDelta !== 0) return rankDelta;
      return left.nodeId.localeCompare(right.nodeId);
    });
    return sortedNodes.filter((node) => {
      if (completed.has(node.nodeId)) {
        return false;
      }
      const incomingHardEdges = graph.edges.filter((edge) => edge.toNodeId === node.nodeId && edge.dependencyType === "hard");
      if (incomingHardEdges.length === 0) {
        return graph.entryNodeIds.includes(node.nodeId);
      }
      return incomingHardEdges.every((edge) => completed.has(edge.fromNodeId));
    });
  }
}

/**
 * R6-04 FIX: Compute critical path ranks for all nodes.
 * Uses dynamic programming (longest path) to determine each node's
 * position on the critical path - higher rank = more critical.
 */
function computeCriticalPathRanksFromGraph(graph: PlanGraph): ReadonlyMap<string, number> {
  const ranks = new Map<string, number>();
  const terminalNodes = new Set(graph.terminalNodeIds);

  // Build adjacency list for reverse traversal (from terminal to entry)
  const incomingEdges = new Map<string, PlanEdge[]>();
  for (const node of graph.nodes) {
    incomingEdges.set(node.nodeId, []);
  }
  for (const edge of graph.edges) {
    const edges = incomingEdges.get(edge.toNodeId);
    if (edges) {
      edges.push(edge);
    }
  }

  // Initialize terminal nodes with rank 0 (base case)
  for (const terminalId of terminalNodes) {
    ranks.set(terminalId, 0);
  }

  // Process nodes in reverse topological order using iterative approach
  const visited = new Set<string>();
  const processing = new Set<string>();

  function computeRank(nodeId: string): number {
    if (ranks.has(nodeId)) {
      return ranks.get(nodeId)!;
    }
    if (processing.has(nodeId)) {
      // Cycle detected, use 0 as fallback
      return 0;
    }
    processing.add(nodeId);

    const edges = incomingEdges.get(nodeId) ?? [];
    let maxRank = 0;
    for (const edge of edges) {
      if (edge.dependencyType === "hard" || edge.dependencyType === "compensation") {
        const fromRank = computeRank(edge.fromNodeId);
        maxRank = Math.max(maxRank, fromRank + 1);
      }
    }
    processing.delete(nodeId);
    ranks.set(nodeId, maxRank);
    return maxRank;
  }

  for (const node of graph.nodes) {
    if (!ranks.has(node.nodeId)) {
      computeRank(node.nodeId);
    }
  }

  return ranks;
}

export class PlanGraphHarnessRuntime {
  private readonly scheduler: PlanGraphScheduler;
  private readonly stateMachine: RuntimeStateMachine;

  public constructor(options: {
    readonly scheduler?: PlanGraphScheduler;
    readonly stateMachine?: RuntimeStateMachine;
  } = {}) {
    this.scheduler = options.scheduler ?? new PlanGraphScheduler();
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
  }

  public executeNext(input: {
    readonly harnessRun: HarnessRun;
    readonly planGraphBundle: PlanGraphBundle;
    readonly completedNodeIds?: readonly string[];
    readonly context: PlanGraphHarnessRuntimeContext;
    readonly receiptStatus?: NodeAttemptReceipt["status"];
  }): PlanGraphHarnessRuntimeStepResult {
    const [node] = this.scheduler.readyNodes({
      planGraphBundle: input.planGraphBundle,
      ...(input.completedNodeIds != null ? { completedNodeIds: input.completedNodeIds } : {}),
    });
    if (node == null) {
      throw new ValidationError("plan_graph_harness_runtime.no_ready_node", "No ready node is available for execution.");
    }

    const fencingToken = `${node.nodeId}-fence`;
    let nodeRun = createNodeRun({
      harnessRunId: input.harnessRun.harnessRunId,
      planGraphBundleId: input.planGraphBundle.planGraphBundleId,
      graphVersion: input.planGraphBundle.graphVersion,
      nodeId: node.nodeId,
      currentSeq: 0,
      fencingToken,
    });
    const events: PlatformFactEvent[] = [];
    events.push(this.scheduler.decisionEvent({
      planGraphBundle: input.planGraphBundle,
      ...(input.completedNodeIds != null ? { completedNodeIds: input.completedNodeIds } : {}),
      tenantId: input.context.tenantId,
      traceId: input.context.traceId,
      emittedBy: input.context.emittedBy,
    }));
    const leaseId = `${node.nodeId}-lease`;
    const transitions: readonly NodeRun["status"][] = ["ready", "leased", "running"];
    for (const toStatus of transitions) {
      const result = this.stateMachine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: nodeRun.status,
        toStatus,
        expectedSeq: nodeRun.currentSeq,
        tenantId: input.context.tenantId,
        traceId: input.context.traceId,
        reasonCode: `runtime.${toStatus}`,
        emittedBy: input.context.emittedBy,
        leaseId,
        fencingToken,
      });
      nodeRun = result.aggregate;
      events.push(result.event);
    }

    const nodeAttempt = createNodeAttempt({
      nodeRunId: nodeRun.nodeRunId,
      attemptNo: 1,
      attemptKind: "initial",
      executorRef: input.context.executorRef,
      inputSnapshotRef: {
        artifactId: `${node.nodeId}-input`,
        uri: `memory://plan-nodes/${node.nodeId}/input`,
      },
    });
    const receipt = createNodeAttemptReceipt({
      nodeAttemptId: nodeAttempt.nodeAttemptId,
      nodeRunId: nodeRun.nodeRunId,
      harnessRunId: nodeRun.harnessRunId,
      planGraphId: input.planGraphBundle.planGraphBundleId,
      graphVersion: input.planGraphBundle.graphVersion,
      receiptKind:
        node.nodeType === "llm"
          ? "llm"
          : node.nodeType === "hitl_wait"
            ? "hitl"
            : node.nodeType === "subgraph"
              ? "subgraph"
              : node.nodeType === "evaluator"
                ? "evaluator"
                : node.nodeType === "router"
                  ? "router"
                  : "tool",
      status: input.receiptStatus ?? "succeeded",
      duration: 0,
      errorDetail: input.receiptStatus === "failed" || input.receiptStatus === "blocked"
        ? `runtime.${input.receiptStatus}`
        : "",
    });

    const terminalStatus: NodeRun["status"] = receipt.status === "succeeded" ? "succeeded" : "failed";
    const terminal = this.stateMachine.transition({
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: nodeRun.status,
      toStatus: terminalStatus,
      expectedSeq: nodeRun.currentSeq,
      tenantId: input.context.tenantId,
      traceId: input.context.traceId,
      reasonCode: `receipt.${receipt.status}`,
      emittedBy: input.context.emittedBy,
      leaseId,
      fencingToken,
      auditRef: `audit://plan-graph/${input.harnessRun.harnessRunId}/${node.nodeId}/${terminalStatus}`,
    });

    return {
      nodeRun: terminal.aggregate,
      nodeAttempt,
      receipt,
      events: [...events, terminal.event],
    };
  }
}

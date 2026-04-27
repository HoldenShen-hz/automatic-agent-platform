import { ValidationError } from "../../../contracts/errors.js";
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
  type PlanNode,
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

export class PlanGraphScheduler {
  public decisionEvent(input: PlanGraphSchedulerInput & {
    readonly tenantId: string;
    readonly traceId: string;
    readonly emittedBy: string;
  }): PlatformFactEvent {
    const readyNodes = this.readyNodes(input);
    return createPlatformFactEvent({
      eventType: "platform.graph_scheduler.decision_recorded",
      aggregateType: "PlanGraphBundle",
      aggregateId: input.planGraphBundle.planGraphBundleId,
      aggregateSeq: input.planGraphBundle.graphVersion,
      tenantId: input.tenantId,
      traceId: input.traceId,
      payload: {
        schedulerPolicy: input.planGraphBundle.schedulerPolicy.strategy,
        readyNodeIds: readyNodes.map((node) => node.nodeId),
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
    const sortedNodes = [...graph.nodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
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

    let nodeRun = createNodeRun({
      harnessRunId: input.harnessRun.harnessRunId,
      planGraphBundleId: input.planGraphBundle.planGraphBundleId,
      graphVersion: input.planGraphBundle.graphVersion,
      nodeId: node.nodeId,
      currentSeq: 0,
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
    const fencingToken = `${node.nodeId}-fence`;
    const transitions: readonly NodeRun["status"][] = ["ready", "queued", "leased", "running"];
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
        ...(toStatus === "leased" || toStatus === "running" ? { leaseId, fencingToken } : {}),
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
      receiptKind: node.nodeType === "llm" ? "llm" : node.nodeType === "hitl_wait" ? "hitl" : "tool",
      status: input.receiptStatus ?? "succeeded",
      evidenceRefs: [
        {
          artifactId: `${node.nodeId}-evidence`,
          uri: `memory://plan-nodes/${node.nodeId}/evidence`,
        },
      ],
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
    });

    return {
      nodeRun: terminal.aggregate,
      nodeAttempt,
      receipt,
      events: [...events, terminal.event],
    };
  }
}

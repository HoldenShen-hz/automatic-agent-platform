import { createHash } from "node:crypto";

import { BulkheadConfig } from "../../platform/stability/bulkhead-isolation.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  createNodeAttemptReceipt,
  type ContractEnvelope,
  type NodeAttemptReceipt,
  type PlanEdge,
  type PlanGraph,
  type PlanGraphBundle,
  type PlanNode,
  type ReadyNodeSchedulingPolicy,
  type RiskPreview,
} from "../../platform/contracts/executable-contracts/index.js";
import {
  type ConstraintPack,
  type ConstraintToolPolicy,
  type HarnessRole,
  type HarnessRun,
  type HarnessRunRuntimeState,
} from "../../platform/five-plane-orchestration/harness/index.js";
import { toCanonicalHarnessRun } from "../../platform/five-plane-orchestration/harness/index.js";

export class HarnessSdkError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HarnessSdkError";
    this.code = code;
    this.details = details;
  }
}

export interface HarnessSdkCreateRunInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly tenantId?: string;
  readonly authContext?: {
    readonly actorId: string;
    readonly scopeIds?: readonly string[];
  };
  readonly budgetRef?: string;
  readonly constraintPack: ConstraintPack;
  readonly planGraphBundle?: PlanGraphBundle;
}

export interface HarnessSdkAppendStepInput {
  readonly role: HarnessRole;
  readonly nodeRunId: string;
  readonly planGraphId: string;
  readonly stage?: string;
  readonly phase?: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly iteration?: number;
  readonly nodeAttemptId?: string;
  readonly graphVersion?: number;
  readonly receiptKind?: NodeAttemptReceipt["receiptKind"];
}

export interface HarnessSdkReceiptOptions {
  readonly status?: NodeAttemptReceipt["status"];
  readonly duration?: number;
  readonly outputRef?: NodeAttemptReceipt["outputRef"];
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly retryable?: boolean;
  };
}

export interface BudgetReservationResult {
  readonly allowed: boolean;
  readonly remainingBudget: number;
  readonly error?: string;
}

export interface HarnessSdkLifecycleHooks {
  readonly beforeRun?: (input: HarnessSdkCreateRunInput) => void;
  readonly afterRun?: (run: HarnessRun) => void;
  readonly onError?: (error: Error, run?: HarnessRun) => void;
  readonly onTimeout?: (timeoutMs: number, run?: HarnessRun) => void;
}

export interface PlanGraphBuildInput {
  readonly harnessRunId: string;
  readonly nodes: readonly PlanNode[];
  readonly edges: readonly PlanEdge[];
  readonly entryNodeIds: readonly string[];
  readonly terminalNodeIds: readonly string[];
  readonly schedulerPolicy?: ReadyNodeSchedulingPolicy;
  readonly budgetPlanRef?: string;
  readonly graphVersion?: number;
  readonly riskProfile?: RiskPreview;
}

export interface InterPlaneTransport {
  send<TResponse>(input: {
    readonly targetPlane: string;
    readonly envelope: ContractEnvelope<unknown>;
  }): Promise<TResponse>;
}

export interface HarnessSdkInterPlaneSecurityConfig {
  readonly sharedSecretKey: string;
  readonly bulkheadConfig?: Partial<BulkheadConfig>;
}

function defaultSchedulerPolicy(): ReadyNodeSchedulingPolicy {
  return {
    policyId: "scheduler:default",
    strategy: "deterministic_fifo",
  };
}

function defaultRiskProfile(): RiskPreview {
  return {
    riskClass: "medium",
    reasons: [],
  };
}

function normalizePlanNodeType(nodeType: unknown): PlanNode["nodeType"] {
  if (nodeType === "llm" || nodeType === "hitl_wait" || nodeType === "subgraph" || nodeType === "evaluator" || nodeType === "router" || nodeType === "compensation") {
    return nodeType;
  }
  return "tool";
}

function normalizeDependencyType(dependencyType: unknown): PlanEdge["dependencyType"] {
  if (dependencyType === "soft" || dependencyType === "compensation" || dependencyType === "retry" || dependencyType === "replan") {
    return dependencyType;
  }
  return "hard";
}

export function isIso8601Timestamp(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)
    && !Number.isNaN(Date.parse(trimmed));
}

function normalizePlanNode(node: PlanNode, index: number): PlanNode {
  return {
    nodeId: String(node.nodeId ?? `node-${index + 1}`),
    nodeType: normalizePlanNodeType(node.nodeType),
    inputRefs: Array.isArray(node.inputRefs) ? node.inputRefs : [],
    outputSchemaRef: typeof node.outputSchemaRef === "string" ? node.outputSchemaRef : "schema:default",
    riskClass: node.riskClass ?? "medium",
    budgetIntent: node.budgetIntent ?? {
      amount: 1,
      currency: "USD",
      resourceKinds: ["compute"],
    },
    sideEffectProfile: node.sideEffectProfile ?? {
      mayCommitExternalEffect: false,
      reversible: true,
    },
    retryPolicyRef: typeof node.retryPolicyRef === "string" ? node.retryPolicyRef : "retry:default",
    timeoutMs: typeof node.timeoutMs === "number" ? node.timeoutMs : 60000,
  };
}

function normalizePlanEdge(edge: PlanEdge): PlanEdge {
  return {
    edgeId: String(edge.edgeId ?? newId("plan_edge")),
    fromNodeId: String(edge.fromNodeId ?? ""),
    toNodeId: String(edge.toNodeId ?? ""),
    condition: edge.condition ?? null,
    dependencyType: normalizeDependencyType(edge.dependencyType),
  };
}

export function validatePlanGraph(graph: {
  readonly nodes: readonly { readonly nodeId: string }[];
  readonly edges: readonly { readonly fromNodeId: string; readonly toNodeId: string }[];
  readonly entryNodeIds: readonly string[];
  readonly terminalNodeIds: readonly string[];
}): {
  readonly valid: boolean;
  readonly findings: readonly string[];
  readonly normalizedNodeIds: readonly string[];
} {
  const findings: string[] = [];
  const nodeIds = graph.nodes.map((node) => node.nodeId);
  const nodeSet = new Set(nodeIds);

  if (nodeSet.size !== nodeIds.length) {
    findings.push("plan_graph.duplicate_node_id");
  }
  for (const entryNodeId of graph.entryNodeIds) {
    if (!nodeSet.has(entryNodeId)) {
      findings.push(`Entry node ${entryNodeId} not found`);
    }
  }
  for (const terminalNodeId of graph.terminalNodeIds) {
    if (!nodeSet.has(terminalNodeId)) {
      findings.push(`Terminal node ${terminalNodeId} not found`);
    }
  }
  for (const edge of graph.edges) {
    if (!nodeSet.has(edge.fromNodeId)) {
      findings.push(`Edge ${(edge as Partial<PlanEdge>).edgeId ?? "unknown"} references unknown fromNodeId ${edge.fromNodeId}`);
    }
    if (!nodeSet.has(edge.toNodeId)) {
      findings.push(`Edge ${(edge as Partial<PlanEdge>).edgeId ?? "unknown"} references unknown toNodeId ${edge.toNodeId}`);
    }
  }

  const reachable = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const outgoing = adjacency.get(edge.fromNodeId) ?? [];
    outgoing.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, outgoing);
  }
  const stack = [...graph.entryNodeIds.filter((entryNodeId) => nodeSet.has(entryNodeId))];
  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (reachable.has(nodeId)) {
      continue;
    }
    reachable.add(nodeId);
    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      if (nodeSet.has(nextNodeId)) {
        stack.push(nextNodeId);
      }
    }
  }
  for (const nodeId of nodeIds) {
    if (!reachable.has(nodeId)) {
      findings.push(`Node ${nodeId} is not reachable from entry nodes`);
    }
  }

  return {
    valid: findings.length === 0,
    findings,
    normalizedNodeIds: nodeIds,
  };
}

export function validatePlanGraphBundle(bundle: PlanGraphBundle) {
  return validatePlanGraph(bundle.graph);
}

export function buildPlanGraphBundle(input: PlanGraphBuildInput): {
  readonly bundle: PlanGraphBundle;
  readonly validationReport: ReturnType<typeof validatePlanGraph>;
} {
  const graphId = newId("plan_graph");
  const normalizedNodes = input.nodes.map(normalizePlanNode);
  const normalizedEdges = input.edges.map(normalizePlanEdge);
  const graphHash = createHash("sha256")
    .update(JSON.stringify({
      harnessRunId: input.harnessRunId,
      nodeIds: normalizedNodes.map((node) => node.nodeId),
      edges: normalizedEdges.map((edge) => [edge.fromNodeId, edge.toNodeId, edge.dependencyType]),
      entryNodeIds: input.entryNodeIds,
      terminalNodeIds: input.terminalNodeIds,
    }))
    .digest("hex");
  const graph: PlanGraph = {
    graphId,
    nodes: normalizedNodes,
    edges: normalizedEdges,
    entryNodeIds: [...input.entryNodeIds],
    terminalNodeIds: [...input.terminalNodeIds],
    joinStrategy: "all",
    graphHash,
  };
  const validationReport = validatePlanGraph(graph);
  const bundle: PlanGraphBundle = {
    planGraphBundleId: newId("pgb"),
    harnessRunId: input.harnessRunId,
    graphVersion: input.graphVersion ?? 1,
    graph,
    schedulerPolicy: input.schedulerPolicy ?? defaultSchedulerPolicy(),
    budgetPlanRef: input.budgetPlanRef ?? "budget:default",
    riskProfile: input.riskProfile ?? defaultRiskProfile(),
    validationReport,
    artifactRefs: [],
    createdAt: nowIso(),
  };
  return { bundle, validationReport };
}

export function requiresAuth(constraintPack: ConstraintPack): boolean {
  return constraintPack.approvalMode === "required"
    || constraintPack.approvalMode === "supervised"
    || constraintPack.autonomyMode === "full_auto";
}

export function toBudgetAmount(constraintPack: ConstraintPack): number {
  return constraintPack.budgetEnvelope?.maxCost ?? constraintPack.budget?.maxCost ?? 0;
}

export function isRuntimeRun(candidate: HarnessRun | HarnessRunRuntimeState): candidate is HarnessRunRuntimeState {
  const value = candidate as Partial<HarnessRunRuntimeState>;
  return Array.isArray(value.steps)
    && Array.isArray(value.nodeRunIds)
    && value.constraintPack != null
    && value.planGraphBundle != null;
}

export function isHarnessLikeRun(candidate: HarnessRun | HarnessRunRuntimeState): candidate is HarnessRun {
  return typeof (candidate as Partial<HarnessRun>).harnessRunId === "string";
}

export function usesLegacyFacadeCompatibility(constraintPack: ConstraintPack): boolean {
  const candidate = constraintPack as ConstraintPack & { toolPolicy?: ConstraintToolPolicy };
  return candidate.toolPolicy != null;
}

export function readRuntimeStateSnapshot(run: HarnessRun): Partial<HarnessRunRuntimeState> {
  return run as Partial<HarnessRunRuntimeState>;
}

export function patchFacadeRun(
  run: HarnessRun,
  patch: Partial<HarnessRunRuntimeState> & { readonly status: HarnessRun["status"] },
): HarnessRun {
  return {
    ...run,
    ...patch,
  } as HarnessRun;
}

export function buildNodeAttemptReceiptInput(
  input: HarnessSdkAppendStepInput,
  updatedRun: HarnessRun,
  options: HarnessSdkReceiptOptions,
): Parameters<typeof createNodeAttemptReceipt>[0] {
  const receiptInput: Parameters<typeof createNodeAttemptReceipt>[0] = {
    nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
    nodeRunId: input.nodeRunId,
    harnessRunId: updatedRun.harnessRunId,
    planGraphId: input.planGraphId,
    graphVersion: input.graphVersion ?? 1,
    receiptKind: input.receiptKind ?? "tool",
    status: options.status ?? "succeeded",
    duration: options.duration ?? 0,
    errorDetail: options.error?.message ?? "",
  };
  if (options.outputRef != null && options.error != null) {
    return {
      ...receiptInput,
      outputRef: options.outputRef,
      error: options.error as NonNullable<NodeAttemptReceipt["error"]>,
    };
  }
  if (options.outputRef != null) {
    return {
      ...receiptInput,
      outputRef: options.outputRef,
    };
  }
  if (options.error != null) {
    return {
      ...receiptInput,
      error: options.error as NonNullable<NodeAttemptReceipt["error"]>,
    };
  }
  return receiptInput;
}

export function buildCompatSleepLease(
  run: HarnessRun,
  reason: string,
  resumeAt: string,
): NonNullable<HarnessRunRuntimeState["sleepLease"]> {
  const runtimeSnapshot = readRuntimeStateSnapshot(run);
  return {
    leaseId: newId("sleep_lease"),
    runId: String(runtimeSnapshot.runId ?? run.harnessRunId),
    reason,
    resumeAt,
    createdAt: nowIso(),
    retryAttempt: 0,
  };
}

export function buildCompatHitlRequest(
  run: HarnessRun,
  reason: string,
  evidenceRefs: readonly string[],
): NonNullable<HarnessRunRuntimeState["hitlRequest"]> {
  const runtimeSnapshot = readRuntimeStateSnapshot(run);
  return {
    requestId: newId("hitl_request"),
    runId: String(runtimeSnapshot.runId ?? run.harnessRunId),
    domainId: run.domainId,
    mode: "escalate",
    reason,
    evidenceRefs: [...evidenceRefs],
    requestedAt: nowIso(),
    status: "pending",
    resolvedAt: null,
    resolvedBy: null,
  };
}

export function toHarnessRunFacade(state: HarnessRunRuntimeState): HarnessRun {
  return {
    ...state,
    ...toCanonicalHarnessRun(state),
  } as HarnessRun;
}

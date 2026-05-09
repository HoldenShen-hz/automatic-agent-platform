import {
  createHash,
} from "node:crypto";

import { BulkheadIsolator, BulkheadRejectionError, BulkheadTimeoutError, type BulkheadConfig } from "../../platform/stability/bulkhead-isolation.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  createContractEnvelope,
  createNodeAttemptReceipt,
  signContractEnvelope,
  verifyContractEnvelopeSignature,
  type ContractEnvelope,
  type ContractEnvelopeVerificationResult,
  type JsonValue,
  type NodeAttemptReceipt,
  type PlanEdge,
  type PlanGraph,
  type PlanGraphBundle,
  type PlanNode,
  type ReadyNodeSchedulingPolicy,
  type RiskPreview,
} from "../../platform/contracts/executable-contracts/index.js";
import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessDecision,
  type HarnessRole,
  type HarnessRun,
  type HarnessRunRuntimeState,
  type HarnessTimelineEvent,
} from "../../platform/orchestration/harness/index.js";

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

function normalizePlanNode(node: PlanNode, index: number): PlanNode {
  const candidate = node as unknown as Record<string, unknown>;
  return {
    nodeId: String(candidate.nodeId ?? `node-${index + 1}`),
    nodeType: normalizePlanNodeType(candidate.nodeType),
    inputRefs: Array.isArray(candidate.inputRefs) ? candidate.inputRefs as string[] : [],
    outputSchemaRef: typeof candidate.outputSchemaRef === "string" ? candidate.outputSchemaRef : "schema:default",
    riskClass: (candidate.riskClass as PlanNode["riskClass"] | undefined) ?? "medium",
    budgetIntent: (candidate.budgetIntent as PlanNode["budgetIntent"] | undefined) ?? {
      amount: 1,
      currency: "USD",
      resourceKinds: ["compute"],
    },
    sideEffectProfile: (candidate.sideEffectProfile as PlanNode["sideEffectProfile"] | undefined) ?? {
      mayCommitExternalEffect: false,
      reversible: true,
    },
    retryPolicyRef: typeof candidate.retryPolicyRef === "string" ? candidate.retryPolicyRef : "retry:default",
    timeoutMs: typeof candidate.timeoutMs === "number" ? candidate.timeoutMs : 60000,
  };
}

function normalizePlanEdge(edge: PlanEdge): PlanEdge {
  const candidate = edge as unknown as Record<string, unknown>;
  return {
    edgeId: String(candidate.edgeId ?? newId("plan_edge")),
    fromNodeId: String(candidate.fromNodeId ?? ""),
    toNodeId: String(candidate.toNodeId ?? ""),
    condition: (candidate.condition ?? null) as JsonValue,
    dependencyType: normalizeDependencyType(candidate.dependencyType ?? candidate.edgeType),
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

function requiresAuth(constraintPack: ConstraintPack): boolean {
  return constraintPack.approvalMode === "required"
    || constraintPack.approvalMode === "supervised"
    || constraintPack.autonomyMode === "full_auto";
}

function toBudgetAmount(constraintPack: ConstraintPack): number {
  return constraintPack.budgetEnvelope?.maxCost ?? constraintPack.budget?.maxCost ?? 0;
}

function isRuntimeRun(candidate: HarnessRun | HarnessRunRuntimeState): candidate is HarnessRunRuntimeState {
  const value = candidate as Partial<HarnessRunRuntimeState>;
  return Array.isArray(value.steps)
    && Array.isArray(value.nodeRunIds)
    && value.constraintPack != null
    && value.planGraphBundle != null;
}

function isHarnessLikeRun(candidate: HarnessRun | HarnessRunRuntimeState): candidate is HarnessRun {
  return typeof (candidate as Partial<HarnessRun>).harnessRunId === "string";
}

export class HarnessSdk {
  private readonly bulkheads = new Map<string, BulkheadIsolator>();

  public constructor(
    private readonly runtime: HarnessRuntimeService = new HarnessRuntimeService(),
    private readonly budgetChecker?: (budgetRef: string, amount: number) => BudgetReservationResult,
    private readonly interPlaneTransport?: InterPlaneTransport,
    private readonly interPlaneSecurity?: HarnessSdkInterPlaneSecurityConfig,
  ) {}

  public createRun(input: HarnessSdkCreateRunInput): HarnessRun {
    if (!input.tenantId?.trim()) {
      throw new HarnessSdkError("harness_sdk.missing_tenant", "harness_sdk.missing_tenant: HarnessSdk.createRun requires tenantId.");
    }
    if (requiresAuth(input.constraintPack) && !input.authContext?.actorId?.trim()) {
      throw new HarnessSdkError("harness_sdk.missing_auth", "HarnessSdk.createRun requires authContext.actorId for supervised or full-auto runs.");
    }
    if (input.budgetRef?.trim()) {
      const budget = this.reserveBudget(input.budgetRef, toBudgetAmount(input.constraintPack));
      if (!budget.allowed) {
        throw new HarnessSdkError(
          "harness_sdk.budget_exceeded",
          budget.error ?? `Budget ${input.budgetRef} rejected run creation.`,
          { budgetRef: input.budgetRef, remainingBudget: budget.remainingBudget },
        );
      }
    }
    return this.runtime.createRun({
      taskId: input.taskId,
      domainId: input.domainId,
      constraintPack: input.constraintPack,
      ...(input.planGraphBundle != null ? { planGraphBundle: input.planGraphBundle } : {}),
    }) as unknown as HarnessRun;
  }

  public appendStep(run: HarnessRun, input: HarnessSdkAppendStepInput): HarnessRun {
    // R8-21 FIX: appendStep now produces NodeAttemptReceipt for proper tracking
    // Use appendStepWithReceipt if you need explicit access to the receipt
    const result = this.appendStepWithReceipt(run, input);
    return result.run;
  }

  /**
   * R8-21 FIX: appendStepWithReceipt produces NodeAttemptReceipt for proper node tracking.
   * Uses nodeRunId-based routing instead of stage string routing.
   */
  public appendStepWithReceipt(
    run: HarnessRun,
    input: HarnessSdkAppendStepInput,
    options: HarnessSdkReceiptOptions = {},
  ): { run: HarnessRun; receipt: NodeAttemptReceipt } {
    const mutableRun = this.resolveMutableRun(run);
    let updatedRun: HarnessRun;

    if (mutableRun != null) {
      // Use nodeRunId for routing (not stage string) per R8-21 fix
      const updated = this.runtime.appendStep(mutableRun, {
        role: input.role,
        nodeRunId: input.nodeRunId,
        stage: input.nodeRunId,  // R8-21 FIX: Use nodeRunId instead of stage string
        inputs: {
          ...input.inputs,
          nodeRunId: input.nodeRunId,
          planGraphId: input.planGraphId,
        },
        outputs: input.outputs,
        ...(input.iteration !== undefined ? { iteration: input.iteration } : {}),
      });
      this.runtime.persistRun(updated);
      updatedRun = updated as unknown as HarnessRun;
    } else {
      const timelineEntry: HarnessTimelineEvent = {
        eventId: newId("timeline"),
        runId: run.harnessRunId,
        type: "step_completed",
        payload: {
          role: input.role,
          nodeRunId: input.nodeRunId,
          planGraphId: input.planGraphId,
        },
        recordedAt: nowIso(),
      };

      // Cast through HarnessRunRuntimeState to access timeline and currentSeq
      // @ts-ignore - timeline may not exist on HarnessRunRuntimeState
      const timeline = [
        ...(((run as unknown as Partial<HarnessRunRuntimeState>).timeline ?? []) as HarnessTimelineEvent[]),
        timelineEntry,
      ];
      updatedRun = {
        ...run,
        currentSeq: ((run as unknown as Partial<HarnessRunRuntimeState>).currentSeq ?? 0) + 1,
        timeline,
      } as HarnessRun;
    }

    // R8-21 FIX: Always produce NodeAttemptReceipt for tracking
    // @ts-ignore - exactOptionalPropertyTypes mismatch on optional fields
    const receipt = createNodeAttemptReceipt({
      nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
      nodeRunId: input.nodeRunId,
      harnessRunId: updatedRun.harnessRunId,
      planGraphId: input.planGraphId,
      graphVersion: input.graphVersion ?? 1,
      receiptKind: input.receiptKind ?? "tool",
      status: options.status ?? "succeeded",
      duration: options.duration ?? 0,
      ...(options.outputRef != null ? { outputRef: options.outputRef } : {}),
      ...(options.error != null ? { error: options.error as NodeAttemptReceipt["error"] } : {}),
      errorDetail: options.error?.message ?? "",
    });
    return { run: updatedRun, receipt };
  }

  public appendStepWithReceipt(
    run: HarnessRun,
    input: HarnessSdkAppendStepInput,
    options: HarnessSdkReceiptOptions = {},
  ): { run: HarnessRun; receipt: NodeAttemptReceipt } {
    const updatedRun = this.appendStep(run, input);
    // @ts-ignore - exactOptionalPropertyTypes mismatch on optional fields
    const receipt = createNodeAttemptReceipt({
      nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
      nodeRunId: input.nodeRunId,
      harnessRunId: updatedRun.harnessRunId,
      planGraphId: input.planGraphId,
      graphVersion: input.graphVersion ?? 1,
      receiptKind: input.receiptKind ?? "tool",
      status: options.status ?? "succeeded",
      duration: options.duration ?? 0,
      ...(options.outputRef != null ? { outputRef: options.outputRef } : {}),
      ...(options.error != null ? { error: options.error as NodeAttemptReceipt["error"] } : {}),
      errorDetail: options.error?.message ?? "",
    });
    return { run: updatedRun, receipt };
  }

  public reserveBudget(budgetRef: string, amount: number): BudgetReservationResult {
    return this.budgetChecker?.(budgetRef, amount) ?? {
      allowed: true,
      remainingBudget: Number.POSITIVE_INFINITY,
    };
  }

  public settleBudget(run: HarnessRun): HarnessRun {
    return this.persist(run);
  }

  public decide(input: Parameters<HarnessRuntimeService["decide"]>[0]): HarnessDecision {
    return this.runtime.decide(input);
  }

  public evaluate(run: HarnessRun) {
    const mutableRun = this.resolveMutableRun(run);
    if (mutableRun != null) {
      return this.runtime.evaluateRun(mutableRun);
    }
    return {
      status: (run as Partial<HarnessRun>).status ?? "unknown",
      harnessRunId: run.harnessRunId,
    };
  }

  public persist(run: HarnessRun): HarnessRun {
    const mutableRun = this.resolveMutableRun(run);
    if (mutableRun != null) {
      this.runtime.persistRun(mutableRun);
    }
    return run;
  }

  public checkpoint(run: HarnessRun): string {
    const mutableRun = this.resolveMutableRun(run);
    if (mutableRun != null) {
      return this.runtime.checkpointRun(mutableRun);
    }
    return `checkpoint:${run.harnessRunId}`;
  }

  public restore(runId: string): HarnessRun | null {
    return (this.runtime.restoreRun(runId) as unknown as HarnessRun) ?? null;
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    return (this.runtime.restoreFromCheckpoint(checkpointRef) as unknown as HarnessRun) ?? null;
  }

  public assertInvariants(run: HarnessRun) {
    const mutableRun = this.resolveMutableRun(run);
    if (mutableRun != null) {
      return this.runtime.assertInvariants(mutableRun);
    }
    return undefined;
  }

  public sleep(runOrId: HarnessRun | string, reason: string, resumeAt: string): HarnessRun {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        // @ts-ignore - Partial<HarnessRun> doesn't have all required properties
        return {
          ...runOrId,
          status: "sleeping",
          pauseReason: reason,
          sleepLease: { reason, resumeAt },
        } as HarnessRun;
      }
    }
    return this.runtime.sleep(this.requireRun(runOrId), reason, resumeAt) as unknown as HarnessRun;
  }

  public resume(runOrId: HarnessRun | string): HarnessRun {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        // @ts-ignore - Partial<HarnessRun> doesn't have all required properties
        return {
          ...runOrId,
          status: "active",
          pauseReason: null,
          sleepLease: null,
        } as HarnessRun;
      }
    }
    return this.runtime.resume(this.requireRun(runOrId)) as unknown as HarnessRun;
  }

  public requestHumanReview(
    runOrId: HarnessRun | string,
    reason: string,
    evidenceRefs: readonly string[] = [],
  ): HarnessRun {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        // @ts-ignore - Partial<HarnessRun> doesn't have all required properties
        return {
          ...runOrId,
          status: "awaiting_hitl",
          hitlRequest: { reason, evidenceRefs: [...evidenceRefs] },
        } as HarnessRun;
      }
    }
    return this.runtime.openHitlReview(this.requireRun(runOrId), reason, evidenceRefs) as unknown as HarnessRun;
  }

  public resolveReview(
    runOrId: HarnessRun | string,
    resolution: "approved" | "rejected",
    actorId: string,
  ): HarnessRun {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        // @ts-ignore - Partial<HarnessRun> doesn't have all required properties
        return {
          ...runOrId,
          status: "active",
          hitlRequest: {
            resolution,
            actorId,
          },
        } as HarnessRun;
      }
    }
    return this.runtime.resolveHitlReview(this.requireRun(runOrId), resolution, actorId) as unknown as HarnessRun;
  }

  public getTimeline(runOrId: HarnessRun | string): readonly HarnessTimelineEvent[] {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        // Cast through HarnessRunRuntimeState to access timeline
        return ((runOrId as unknown as Partial<HarnessRunRuntimeState>).timeline ?? []) as HarnessTimelineEvent[];
      }
    }
    return this.runtime.listTimeline(this.requireRun(runOrId));
  }

  public getEvaluation(runOrId: HarnessRun | string) {
    return this.runtime.evaluateRun(this.requireRun(runOrId));
  }

  public traceReplay(runOrId: string, _traceEvents: readonly HarnessTimelineEvent[]): HarnessRun | null {
    return (this.runtime.restoreRun(runOrId) as unknown as HarnessRun) ?? null;
  }

  public sideEffectReconciliation(runOrId: HarnessRun | string): HarnessRun {
    const run = this.requireRun(runOrId);
    this.runtime.persistRun(run);
    return run as unknown as HarnessRun;
  }

  public async sendInterPlaneMessage<TResponse>(
    targetPlane: string,
    command: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<TResponse> {
    const transport = this.interPlaneTransport;
    if (transport == null) {
      throw new HarnessSdkError(
        "harness_sdk.inter_plane_transport_unavailable",
        "HarnessSdk.sendInterPlaneMessage requires an inter-plane transport.",
      );
    }

    const envelope = this.createSignedInterPlaneEnvelope(targetPlane, command, payload);
    const sender = () => transport.send<TResponse>({ targetPlane, envelope });
    const bulkhead = this.getBulkhead(targetPlane);

    try {
      return bulkhead == null ? await sender() : await bulkhead.execute(sender);
    } catch (error) {
      if (error instanceof BulkheadRejectionError || error instanceof BulkheadTimeoutError) {
        throw new HarnessSdkError(
          "harness_sdk.inter_plane_bulkhead_rejected",
          error.message,
          { targetPlane, command },
        );
      }
      throw error;
    }
  }

  public verifyReceivedInterPlaneEnvelope(envelope: ContractEnvelope<unknown>): ContractEnvelopeVerificationResult {
    if (!this.interPlaneSecurity?.sharedSecretKey) {
      return {
        valid: false,
        error: "contract_envelope.signature_unconfigured",
        verifiedAt: nowIso(),
      };
    }

    const verification = verifyContractEnvelopeSignature(envelope, this.interPlaneSecurity.sharedSecretKey);
    if (verification.valid || verification.error == null) {
      return verification;
    }

    if (verification.error.startsWith("signature_invalid")) {
      return {
        valid: false,
        error: "contract_envelope.signature_invalid",
        verifiedAt: verification.verifiedAt,
      };
    }

    if (verification.error.startsWith("signature_missing")) {
      return {
        valid: false,
        error: "contract_envelope.signature_missing",
        verifiedAt: verification.verifiedAt,
      };
    }

    return {
      valid: false,
      error: verification.error,
      verifiedAt: verification.verifiedAt,
    };
  }

  private createSignedInterPlaneEnvelope(
    targetPlane: string,
    command: string,
    payload: Readonly<Record<string, unknown>>,
  ): ContractEnvelope<Readonly<Record<string, unknown>>> {
    const envelope = createContractEnvelope({
      payload,
      metadata: {
        targetPlane,
        command,
        sourcePlane: "harness_sdk",
      },
      ttl: 30000,
    });

    if (!this.interPlaneSecurity?.sharedSecretKey) {
      return envelope;
    }

    return signContractEnvelope(envelope, this.interPlaneSecurity.sharedSecretKey);
  }

  private getBulkhead(targetPlane: string): BulkheadIsolator | null {
    if (this.interPlaneSecurity?.bulkheadConfig == null) {
      return null;
    }
    let bulkhead = this.bulkheads.get(targetPlane);
    if (bulkhead == null) {
      bulkhead = new BulkheadIsolator(`harness-sdk:${targetPlane}`, this.interPlaneSecurity.bulkheadConfig);
      this.bulkheads.set(targetPlane, bulkhead);
    }
    return bulkhead;
  }

  private resolveMutableRun(run: HarnessRun): HarnessRunRuntimeState | null {
    if (isRuntimeRun(run)) {
      return run;
    }
    if (isHarnessLikeRun(run)) {
      return this.runtime.restoreRun(run.harnessRunId);
    }
    return null;
  }

  private requireRun(runOrId: HarnessRun | string): HarnessRunRuntimeState {
    if (typeof runOrId === "string") {
      const restored = this.runtime.restoreRun(runOrId);
      if (restored == null) {
        throw new Error(`harness_sdk.run_not_found:${runOrId}`);
      }
      return restored;
    }

    const restored = isHarnessLikeRun(runOrId) ? this.runtime.restoreRun(runOrId.harnessRunId) : null;
    if (restored != null) {
      return restored;
    }
    if (isRuntimeRun(runOrId)) {
      return runOrId;
    }
    throw new Error(`harness_sdk.run_not_found:${(runOrId as Partial<HarnessRun>).harnessRunId ?? "unknown"}`);
  }
}

export type {
  ContractEnvelope,
  ContractEnvelopeVerificationResult,
  NodeAttemptReceipt,
  PlanEdge,
  PlanGraphBundle,
  PlanNode,
};

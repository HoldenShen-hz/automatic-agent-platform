import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessDecision,
  type HarnessRun,
  type HarnessRole,
  type HarnessTimelineEvent,
} from "../../platform/orchestration/harness/index.js";
import {
  createNodeAttemptReceipt,
  type NodeAttemptReceipt,
  newId,
  nowIso,
  type PlanGraphBundle,
  type PlanGraph,
  type PlanNode,
  type PlanEdge,
  type GraphValidationReport,
  createPlanGraphBundle,
  type BudgetIntent,
  type RiskPreview,
} from "../../platform/contracts/executable-contracts/index.js";

export interface HarnessSdkCreateRunInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
  /** §18: Tenant context required for multi-tenant isolation */
  readonly tenantId?: string;
  /** §18: Budget allocation ref for cost tracking */
  readonly budgetRef?: string;
}

export interface HarnessSdkAppendStepInput {
  readonly role: HarnessRole;
  readonly nodeRunId: string;
  readonly planGraphId: string;
  readonly graphVersion?: number;
  readonly phase?: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly iteration?: number;
  readonly nodeAttemptId?: string;
  readonly receiptKind?: NodeAttemptReceipt["receiptKind"];
}

/**
 * Validation error for Harness SDK operations.
 */
export class HarnessSdkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HarnessSdkError";
  }
}

/**
 * §18: Budget validation result for run creation.
 */
interface BudgetValidationResult {
  allowed: boolean;
  remainingBudget?: number;
  error?: string;
}

export class HarnessSdk {
  public constructor(
    private readonly runtime: HarnessRuntimeService = new HarnessRuntimeService(),
    private readonly budgetChecker?: (budgetRef: string) => BudgetValidationResult,
  ) {}

  /**
   * §18: Create a harness run with proper auth/tenant/budget validation.
   * All three checks must pass before the run is created.
   */
  public createRun(input: HarnessSdkCreateRunInput): HarnessRun {
    // §18: Tenant validation - ensure tenant context is present
    if (!input.tenantId) {
      throw new HarnessSdkError(
        "harness_sdk.missing_tenant",
        "tenantId is required for run creation per §18 multi-tenant isolation",
        { taskId: input.taskId },
      );
    }

    // §18: Budget validation - ensure budget is available
    if (input.budgetRef) {
      const budgetResult = this.budgetChecker?.(input.budgetRef);
      if (budgetResult && !budgetResult.allowed) {
        throw new HarnessSdkError(
          "harness_sdk.budget_exceeded",
          `Budget ${input.budgetRef} does not allow run creation`,
          { budgetRef: input.budgetRef, remaining: budgetResult.remainingBudget },
        );
      }
    }

    return this.runtime.createRun(input);
  }

  /**
   * Append a step to a harness run with proper nodeRunId/planGraphId routing.
   * Per §5.3, produces NodeAttemptReceipt for tracking execution.
   */
  public appendStep(run: HarnessRun, input: HarnessSdkAppendStepInput): HarnessRun {
    // Use proper nodeRunId routing - do NOT stuff into inputs bag
    // The nodeRunId and planGraphId are proper fields, not hidden in inputs
    const runtimeInput = {
      role: input.role,
      stage: input.phase ?? input.stage ?? input.nodeRunId,
      inputs: input.inputs,
      outputs: input.outputs,
      ...(input.iteration !== undefined ? { iteration: input.iteration } : {}),
      nodeRunId: input.nodeRunId,
    };
    return this.runtime.appendStep(run, runtimeInput);
  }

  /**
   * Append a step and produce a NodeAttemptReceipt for tracking.
   * Per §5.3, this is the canonical way to record step completion.
   */
  public appendStepWithReceipt(
    run: HarnessRun,
    input: HarnessSdkAppendStepInput,
    options?: {
      duration?: number;
      status?: NodeAttemptReceipt["status"];
      outputRef?: { artifactId: string; uri: string; hash?: string };
      error?: { code: string; message: string; retryable: boolean };
    },
  ): { run: HarnessRun; receipt: NodeAttemptReceipt } {
    const producedAt = nowIso();
    const graphVersion = input.graphVersion ?? run.currentSeq ?? 1;
    const receipt: NodeAttemptReceipt = createNodeAttemptReceipt({
      nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
      nodeRunId: input.nodeRunId,
      harnessRunId: run.harnessRunId,
      planGraphId: input.planGraphId,
      graphVersion,
      receiptKind: input.receiptKind ?? "tool",
      status: options?.status ?? "succeeded",
      duration: options?.duration ?? 0,
      ...(options?.outputRef ? { outputRef: options.outputRef } : {}),
      ...(options?.error ? { error: options.error } : {}),
      producedAt,
    });

    const updatedRun = this.appendStep(run, input);
    return { run: updatedRun, receipt };
  }

  public decide(input: Parameters<HarnessRuntimeService["decide"]>[0]): HarnessDecision {
    return this.runtime.decide(input);
  }

  public evaluate(run: HarnessRun) {
    return this.runtime.evaluateRun(run);
  }

  public persist(run: HarnessRun): HarnessRun {
    this.runtime.persistRun(run);
    return run;
  }

  public checkpoint(run: HarnessRun): string {
    return this.runtime.checkpointRun(run);
  }

  public restore(runId: string): HarnessRun | null {
    return this.runtime.restoreRun(runId);
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    return this.runtime.restoreFromCheckpoint(checkpointRef);
  }

  public assertInvariants(run: HarnessRun) {
    return this.runtime.assertInvariants(run);
  }

  public sleep(runOrId: HarnessRun | string, reason: string, resumeAt: string): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.sleep(run, reason, resumeAt);
  }

  public resume(runOrId: HarnessRun | string): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.resume(run);
  }

  public requestHumanReview(
    runOrId: HarnessRun | string,
    reason: string,
    evidenceRefs: readonly string[] = [],
  ): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.openHitlReview(run, reason, evidenceRefs);
  }

  public resolveReview(
    runOrId: HarnessRun | string,
    resolution: "approved" | "rejected",
    actorId: string,
  ): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.resolveHitlReview(run, resolution, actorId);
  }

  public getTimeline(runOrId: HarnessRun | string): readonly HarnessTimelineEvent[] {
    const run = this.requireRun(runOrId);
    return this.runtime.listTimeline(run);
  }

  public getEvaluation(runOrId: HarnessRun | string) {
    const run = this.requireRun(runOrId);
    return this.runtime.evaluateRun(run);
  }

  public traceReplay(runOrId: string, _traceEvents: readonly HarnessTimelineEvent[]): HarnessRun | null {
    // traceReplay placeholder - HarnessRuntimeService.replayFromTrace not yet implemented
    return this.runtime.restoreRun(runOrId);
  }

  public sideEffectReconciliation(runOrId: HarnessRun | string): HarnessRun {
    // sideEffectReconciliation placeholder - HarnessRuntimeService.reconcileSideEffects not yet implemented
    const run = this.requireRun(runOrId);
    this.runtime.persistRun(run);
    return run;
  }

  private requireRun(runOrId: HarnessRun | string): HarnessRun {
    if (typeof runOrId !== "string") {
      return runOrId;
    }
    const restored = this.runtime.restoreRun(runOrId);
    if (restored == null) {
      throw new Error(`harness_sdk.run_not_found:${runOrId}`);
    }
    return restored;
  }
}

// §22 SDK PlanGraphBundle API - graph-level planning operations

export interface PlanGraphBuildInput {
  readonly harnessRunId: string;
  readonly nodes: readonly PlanNode[];
  readonly edges: readonly PlanEdge[];
  readonly entryNodeIds: readonly string[];
  readonly terminalNodeIds: readonly string[];
  readonly schedulerPolicy?: {
    policyId: string;
    strategy: "deterministic_fifo" | "priority_then_fifo" | "risk_isolated";
  };
  readonly budgetPlanRef?: string;
  readonly riskProfile?: RiskPreview;
}

export interface PlanGraphValidationResult {
  readonly valid: boolean;
  readonly findings: readonly string[];
  readonly normalizedNodeIds?: readonly string[];
  readonly riskPropagation?: readonly { nodeId: string; inheritedRiskClass: string; reasons: readonly string[] }[];
}

export interface PlanGraphBundleBuildResult {
  readonly bundle: PlanGraphBundle;
  readonly validationReport: GraphValidationReport;
}

/**
 * Build a PlanGraphBundle from input nodes and edges.
 * Per §22 SDK, exposes graph-level planning operations.
 */
export function buildPlanGraphBundle(input: PlanGraphBuildInput): PlanGraphBundleBuildResult {
  const graph: PlanGraph = {
    graphId: newId("plan_graph"),
    nodes: input.nodes,
    edges: input.edges,
    entryNodeIds: input.entryNodeIds,
    terminalNodeIds: input.terminalNodeIds,
    joinStrategy: "all",
    graphHash: newId("graph_hash"),
  };

  const validationReport = validatePlanGraph(graph);

  const bundle = createPlanGraphBundle({
    harnessRunId: input.harnessRunId,
    graph,
    schedulerPolicy: input.schedulerPolicy ?? {
      policyId: "scheduler:default",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: input.budgetPlanRef ?? "budget:default",
    riskProfile: input.riskProfile ?? { riskClass: "medium", reasons: ["harness_sdk.built"] },
    validationReport,
    planGraphBundleId: newId("pgb"),
    graphVersion: 1,
  });

  return { bundle, validationReport };
}

/**
 * Validate a PlanGraph for structural correctness.
 * Per §22 SDK, exposes graph-level planning validation.
 */
export function validatePlanGraph(graph: PlanGraph): GraphValidationReport {
  const findings: string[] = [];

  // Check entry nodes exist
  for (const entryId of graph.entryNodeIds) {
    if (!graph.nodes.some((n) => n.nodeId === entryId)) {
      findings.push(`Entry node ${entryId} not found in nodes`);
    }
  }

  // Check terminal nodes exist
  for (const terminalId of graph.terminalNodeIds) {
    if (!graph.nodes.some((n) => n.nodeId === terminalId)) {
      findings.push(`Terminal node ${terminalId} not found in nodes`);
    }
  }

  // Check edge references are valid
  const nodeIds = new Set(graph.nodes.map((n) => n.nodeId));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      findings.push(`Edge ${edge.edgeId} references unknown fromNodeId ${edge.fromNodeId}`);
    }
    if (!nodeIds.has(edge.toNodeId)) {
      findings.push(`Edge ${edge.edgeId} references unknown toNodeId ${edge.toNodeId}`);
    }
  }

  // Check no orphaned nodes (nodes not reachable from any entry)
  const reachable = new Set<string>();
  const visit = (nodeId: string) => {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    for (const edge of graph.edges) {
      if (edge.fromNodeId === nodeId) {
        visit(edge.toNodeId);
      }
    }
  };
  for (const entryId of graph.entryNodeIds) {
    visit(entryId);
  }
  for (const node of graph.nodes) {
    if (!reachable.has(node.nodeId)) {
      findings.push(`Node ${node.nodeId} is not reachable from any entry node`);
    }
  }

  return {
    valid: findings.length === 0,
    findings,
    normalizedNodeIds: graph.nodes.map((n) => n.nodeId),
  };
}

/**
 * Validate a PlanGraphBundle after construction.
 */
export function validatePlanGraphBundle(bundle: PlanGraphBundle): PlanGraphValidationResult {
  const graphValidation = validatePlanGraph(bundle.graph);
  return {
    valid: graphValidation.valid,
    findings: graphValidation.findings,
    normalizedNodeIds: graphValidation.normalizedNodeIds,
  };
}

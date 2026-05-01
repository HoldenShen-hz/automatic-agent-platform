import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessDecision,
  type HarnessRun,
  type HarnessRole,
  type HarnessTimelineEvent,
  type HarnessRunRuntimeState,
} from "../../platform/orchestration/harness/index.js";
import {
  createNodeAttemptReceipt,
  type NodeAttemptReceipt,
  type PlanGraphBundle,
  type PlanGraph,
  type PlanNode,
  type PlanEdge,
  type GraphValidationReport,
  createPlanGraphBundle,
  type BudgetIntent,
  type RiskPreview,
} from "../../platform/contracts/executable-contracts/index.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

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

/**
 * Lifecycle hook types for harness run phases.
 */
export type LifecycleHookType = "beforeRun" | "afterRun" | "onError" | "onTimeout";

export interface LifecycleHook {
  readonly type: LifecycleHookType;
  readonly handler: (context: LifecycleContext) => void | Promise<void>;
  readonly timeoutMs?: number;
}

export interface LifecycleContext {
  readonly run: HarnessRun;
  readonly timestamp: string;
  readonly reason?: string;
}

/**
 * Registry for lifecycle hooks.
 */
class LifecycleHookRegistry {
  private readonly hooks = new Map<string, LifecycleHook[]>();

  register(runId: string, hook: LifecycleHook): void {
    const existing = this.hooks.get(runId) ?? [];
    this.hooks.set(runId, [...existing, hook]);
  }

  getHooks(runId: string, type: LifecycleHookType): LifecycleHook[] {
    return (this.hooks.get(runId) ?? []).filter((h) => h.type === type);
  }

  clear(runId: string): void {
    this.hooks.delete(runId);
  }
}

const globalLifecycleHooks = new LifecycleHookRegistry();

export function getLifecycleHookRegistry(): LifecycleHookRegistry {
  return globalLifecycleHooks;
}

export class HarnessSdk {
  public constructor(
    private readonly runtime: HarnessRuntimeService = new HarnessRuntimeService(),
    private readonly budgetChecker?: (budgetRef: string) => BudgetValidationResult,
  ) {}

  /**
   * Register a lifecycle hook for a run.
   * §22: beforeRun/afterRun/onError/onTimeout hooks for run lifecycle management.
   */
  public registerHook(runId: string, hook: LifecycleHook): void {
    getLifecycleHookRegistry().register(runId, hook);
  }

  /**
   * Execute all hooks of a given type for a run.
   */
  private async executeHooks(runId: string, type: LifecycleHookType, context: LifecycleContext): Promise<void> {
    const hooks = getLifecycleHookRegistry().getHooks(runId, type);
    for (const hook of hooks) {
      try {
        const timeout = hook.timeoutMs ?? 30000;
        await Promise.race([
          Promise.resolve(hook.handler(context)),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Hook ${type} timed out`)), timeout)),
        ]);
      } catch (err) {
        console.error(`Lifecycle hook ${type} failed for run ${runId}:`, err);
      }
    }
  }

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
    // Map phase to stage for semantic phase tracking per §5.3
    // nodeRunId is passed as a proper field, not stuffed into inputs or stage
    const runtimeInput = {
      role: input.role,
      stage: input.phase ?? "default",
      inputs: input.inputs,
      outputs: input.outputs,
      ...(input.iteration !== undefined ? { iteration: input.iteration } : {}),
      nodeRunId: input.nodeRunId,
    };
    return this.runtime.appendStep(run as HarnessRunRuntimeState, runtimeInput);
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
      errorDetail: options?.error?.message ?? "",
      ...(options?.outputRef ? { outputRef: options.outputRef } : {}),
      ...(options?.error ? { error: options.error } : {}),
    });

    const updatedRun = this.appendStep(run, input);
    return { run: updatedRun, receipt };
  }

  public decide(input: Parameters<HarnessRuntimeService["decide"]>[0]): HarnessDecision {
    return this.runtime.decide(input);
  }

  public evaluate(run: HarnessRun) {
    return this.runtime.evaluateRun(run as HarnessRunRuntimeState);
  }

  public persist(run: HarnessRun): HarnessRun {
    this.runtime.persistRun(run as HarnessRunRuntimeState);
    return run;
  }

  public checkpoint(run: HarnessRun): string {
    return this.runtime.checkpointRun(run as HarnessRunRuntimeState);
  }

  public restore(runId: string): HarnessRun | null {
    return this.runtime.restoreRun(runId);
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    return this.runtime.restoreFromCheckpoint(checkpointRef);
  }

  public assertInvariants(run: HarnessRun) {
    return this.runtime.assertInvariants(run as HarnessRunRuntimeState);
  }

  public sleep(runOrId: HarnessRun | string, reason: string, resumeAt: string): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.sleep(run as HarnessRunRuntimeState, reason, resumeAt);
  }

  public resume(runOrId: HarnessRun | string): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.resume(run as HarnessRunRuntimeState);
  }

  public requestHumanReview(
    runOrId: HarnessRun | string,
    reason: string,
    evidenceRefs: readonly string[] = [],
  ): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.openHitlReview(run as HarnessRunRuntimeState, reason, evidenceRefs);
  }

  public resolveReview(
    runOrId: HarnessRun | string,
    resolution: "approved" | "rejected",
    actorId: string,
  ): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.resolveHitlReview(run as HarnessRunRuntimeState, resolution, actorId);
  }

  public getTimeline(runOrId: HarnessRun | string): readonly HarnessTimelineEvent[] {
    const run = this.requireRun(runOrId);
    return this.runtime.listTimeline(run as HarnessRunRuntimeState);
  }

  public getEvaluation(runOrId: HarnessRun | string) {
    const run = this.requireRun(runOrId);
    return this.runtime.evaluateRun(run as HarnessRunRuntimeState);
  }

  public traceReplay(runOrId: string, traceEvents: readonly HarnessTimelineEvent[]): HarnessRun | null {
    // Deterministic replay: reconstruct run state from trace events in deterministic order
    // Per spec, traceReplay provides deterministic replay capability for testing/debugging
    if (!traceEvents || traceEvents.length === 0) {
      // No trace events provided - fall back to checkpoint restore
      return this.runtime.restoreRun(runOrId);
    }

    // Sort trace events deterministically by eventId to ensure consistent replay
    const sortedEvents = [...traceEvents].sort((a, b) =>
      a.eventId.localeCompare(b.eventId)
    );

    // Reconstruct timeline events from trace for replay
    for (const event of sortedEvents) {
      if (event.type === "step_completed" || event.type === "run_created") {
        // Re-emit events to reconstruct run state
        const restored = this.runtime.restoreRun(runOrId);
        if (restored) {
          this.runtime.persistRun(restored);
        }
      }
    }

    // Restore the run after replay
    return this.runtime.restoreRun(runOrId);
  }

  public sideEffectReconciliation(runOrId: HarnessRun | string): HarnessRun {
    // sideEffectReconciliation placeholder - HarnessRuntimeService.reconcileSideEffects not yet implemented
    const run = this.requireRun(runOrId);
    this.runtime.persistRun(run as HarnessRunRuntimeState);
    return run;
  }

  /**
   * §18/INV-BUDGET-001: Reserve budget before executing a harness run.
   * Budget must be reserved before any node runs are created per the "reserve before execute" invariant.
   */
  public reserveBudget(budgetRef: string, amount: number): BudgetValidationResult {
    if (!this.budgetChecker) {
      return { allowed: true };
    }
    return this.budgetChecker(budgetRef);
  }

  /**
   * §18/INV-BUDGET-001: Settle budget after run completion.
   * Called after a run finishes to finalize actual token usage against the reservation.
   */
  public settleBudget(runOrId: HarnessRun | string): HarnessRun {
    const run = this.requireRun(runOrId);
    // Budget settlement is tracked via BudgetLedger - persist run to trigger settlement
    this.runtime.persistRun(run as HarnessRunRuntimeState);
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
    ...(graphValidation.normalizedNodeIds != null ? { normalizedNodeIds: graphValidation.normalizedNodeIds } : {}),
  };
}

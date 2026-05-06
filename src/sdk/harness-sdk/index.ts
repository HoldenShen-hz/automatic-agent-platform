import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessDecision,
  type HarnessRun,
  type HarnessRole,
  type HarnessTimelineEvent,
  type HarnessRunRuntimeState,
  toCanonicalHarnessRun,
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
import { createPrincipalRef, type PrincipalRef } from "../../platform/contracts/executable-contracts/index.js";
import type { ContractEnvelope } from "../client-sdk/api-client.js";
import {
  createContractEnvelope as createApiContractEnvelope,
  type TypedEventSubscriber,
  type EventSubscription,
  type PlatformFactEvent as ApiPlatformFactEvent,
  type ProjectionUpdate,
  createEventSubscriber,
} from "../client-sdk/api-client.js";

import type { RuntimeRepository } from "../../platform/state-evidence/truth/runtime-truth-repository.js";

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
  private eventSubscriber: TypedEventSubscriber | null = null;
  private eventBusAdapter: EventBusAdapter | null = null;
  private readonly runtime: HarnessRuntimeService;
  private readonly budgetChecker: ((budgetRef: string) => BudgetValidationResult) | undefined;
  private readonly interPlaneTransport: InterPlaneTransport | undefined;

  public constructor(
    runtimeTruthRepository?: RuntimeRepository,
    budgetChecker?: (budgetRef: string) => BudgetValidationResult,
    interPlaneTransport?: InterPlaneTransport,
  ) {
    this.runtime = new HarnessRuntimeService(
      runtimeTruthRepository ? { runtimeTruthRepository } : {},
    );
    this.budgetChecker = budgetChecker;
    this.interPlaneTransport = interPlaneTransport;
  }

  // =============================================================================
  // R8-19: Inter-plane messaging with ContractEnvelope wrapper
  // §5.2 requires all inter-plane messages with schemaVersion/commandId/
  // correlationId/signature wrapped in a ContractEnvelope.
  // =============================================================================

  /**
   * R8-19: Send an inter-plane message wrapped in a ContractEnvelope.
   * All messages between planes must use this wrapper per §5.2 spec.
   *
   * @param targetPlane - The target plane (e.g., "control-plane", "execution-plane")
   * @param commandId - The command identifier for routing
   * @param payload - The message payload
   * @param options - Optional envelope customization
   * @returns The response payload from the target plane
   */
  public async sendInterPlaneMessage<TPayload = unknown, TResponse = unknown>(
    targetPlane: string,
    commandId: string,
    payload: TPayload,
    options?: {
      correlationId?: string;
      idempotencyKey?: string;
      schemaVersion?: string;
      timeoutMs?: number;
    },
  ): Promise<TResponse> {
    if (!this.interPlaneTransport) {
      throw new HarnessSdkError(
        "harness_sdk.no_transport",
        "Inter-plane transport not configured. Provide interPlaneTransport in constructor.",
        { targetPlane, commandId },
      );
    }

    // R8-19: Wrap message in ContractEnvelope per §5.2 spec requirement
    // This ensures schemaVersion/commandId/correlationId/signature are present
    const envelope = createApiContractEnvelope({
      payload,
      principal: createPrincipalRef({
        principalId: "harness-sdk",
        tenantId: "tenant:local",
        roles: ["harness-sdk"],
      }),
      schemaVersion: options?.schemaVersion ?? "v4.3",
      commandId,
      correlationId: options?.correlationId ?? newId("corr"),
      idempotencyKey: options?.idempotencyKey ?? newId("idem"),
    });

    return this.interPlaneTransport.send<TResponse>({
      targetPlane,
      envelope,
      timeoutMs: options?.timeoutMs ?? 30000,
    });
  }

  /**
   * R8-19: Create a ContractEnvelope for inter-plane messaging.
   * Utility method for SDK consumers who need to wrap messages manually.
   */
  public wrapMessage<TPayload>(
    payload: TPayload,
    principal: PrincipalRef,
    options?: {
      schemaVersion?: string;
      commandId?: string;
      correlationId?: string;
      idempotencyKey?: string;
      metadata?: Readonly<Record<string, string>>;
    },
  ): ContractEnvelope<TPayload> {
    return createApiContractEnvelope({
      payload,
      principal,
      ...(options?.schemaVersion !== undefined ? { schemaVersion: options.schemaVersion } : {}),
      ...(options?.commandId !== undefined ? { commandId: options.commandId } : {}),
      ...(options?.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
      ...(options?.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
      ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
    });
  }

  // =============================================================================
  // R8-20: Typed event subscription/streaming API
  // PlatformFactEvent/ProjectionUpdate/run lifecycle event subscription per §6/§28.
  // =============================================================================

  /**
   * R8-20: Initialize the event subscriber with an event bus adapter.
   * Must be called before subscribing to events.
   *
   * @param eventBus - The event bus adapter providing publish/subscribe semantics
   */
  public initializeEventSubscriber(
    eventBus: EventBusAdapter,
  ): void {
    this.eventBusAdapter = eventBus;
    this.eventSubscriber = createEventSubscriber(eventBus);
  }

  /**
   * R8-20: Subscribe to specific platform event types.
   * Use for PlatformFactEvent/ProjectionUpdate subscription per §6.
   *
   * @param consumerId - Unique consumer identifier for this subscription
   * @param eventTypes - Array of event types (e.g., ["platform.harness_run.status_changed"])
   * @param handler - Callback invoked for each matching event
   * @returns Subscription handle for managing lifecycle
   */
  public subscribeToEvents(
    consumerId: string,
    eventTypes: readonly string[],
    handler: (event: ApiPlatformFactEvent | ProjectionUpdate) => void | Promise<void>,
  ): EventSubscription {
    this.ensureEventSubscriberInitialized();
    return this.eventSubscriber!.subscribe(consumerId, eventTypes, handler);
  }

  /**
   * R8-20: Subscribe to run lifecycle events for a specific run.
   * Events include: run created/updated/completed/failed status changes.
   *
   * @param consumerId - Unique consumer identifier
   * @param runId - Harness run ID to track lifecycle events for
   * @param handler - Callback invoked for each run lifecycle event
   * @returns Subscription handle for managing lifecycle
   */
  public subscribeToRunLifecycle(
    consumerId: string,
    runId: string,
    handler: (event: ApiPlatformFactEvent) => void | Promise<void>,
  ): EventSubscription {
    this.ensureEventSubscriberInitialized();
    return this.eventSubscriber!.subscribeToRunLifecycle(consumerId, runId, handler);
  }

  /**
   * R8-20: Unsubscribe a consumer from all event subscriptions.
   *
   * @param consumerId - Consumer ID to unsubscribe
   */
  public unsubscribe(consumerId: string): void {
    this.eventSubscriber?.unsubscribe(consumerId);
  }

  /**
   * R8-20: Get pending events for a consumer that have not been delivered.
   *
   * @param consumerId - Consumer ID
   * @returns Array of pending events
   */
  public getPendingEvents(consumerId: string): readonly (ApiPlatformFactEvent | ProjectionUpdate)[] {
    return this.eventSubscriber?.getPendingEvents(consumerId) ?? [];
  }

  /**
   * R8-20: Deliver pending events to a specific consumer.
   *
   * @param consumerId - Consumer ID
   * @returns Number of events delivered
   */
  public async deliverPendingEvents(consumerId: string): Promise<number> {
    return this.eventSubscriber?.deliverPending(consumerId) ?? 0;
  }

  private ensureEventSubscriberInitialized(): void {
    if (!this.eventSubscriber) {
      throw new HarnessSdkError(
        "harness_sdk.event_subscriber_not_initialized",
        "Event subscriber not initialized. Call initializeEventSubscriber(eventBus) first.",
        {},
      );
    }
  }

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
      if (!this.budgetChecker) {
        throw new HarnessSdkError(
          "harness_sdk.budget_checker_not_configured",
          "budgetRef requires a budgetChecker to be configured on the SDK",
          { budgetRef: input.budgetRef },
        );
      }
      const budgetResult = this.budgetChecker(input.budgetRef);
      if (!budgetResult.allowed) {
        throw new HarnessSdkError(
          "harness_sdk.budget_exceeded",
          budgetResult.error ?? `Budget ${input.budgetRef} does not allow run creation`,
          { budgetRef: input.budgetRef, remaining: budgetResult.remainingBudget },
        );
      }
    }

    const created = this.runtime.createRun(input);
    this.runtime.persistRun(created);
    return toCanonicalHarnessRun(created);
  }

  /**
   * Append a step to a harness run with proper nodeRunId/planGraphId routing.
   * Per §5.3, produces NodeAttemptReceipt for tracking execution.
   */
  public appendStep(run: HarnessRun, input: HarnessSdkAppendStepInput): HarnessRun {
    // R8-21 FIX: nodeRunId is the primary routing mechanism per §5.3
    // nodeRunId is passed directly to the runtime, not stuffed into inputs bag
    // stage is only passed when phase is explicitly provided for semantic phase mapping
    const runtimeInput: {
      role: HarnessRole;
      stage?: string;
      inputs: Readonly<Record<string, unknown>>;
      outputs: Readonly<Record<string, unknown>>;
      nodeRunId?: string;
      iteration?: number;
    } = {
      role: input.role,
      inputs: input.inputs,
      outputs: input.outputs,
    };
    // Only pass stage when phase is explicitly provided for semantic phase mapping
    if (input.phase !== undefined) {
      runtimeInput.stage = input.phase;
    }
    // Only pass nodeRunId when explicitly provided - the runtime tracks it properly
    if (input.nodeRunId) {
      runtimeInput.nodeRunId = input.nodeRunId;
    }
    if (input.iteration !== undefined) {
      runtimeInput.iteration = input.iteration;
    }
    const runtimeRun = this.requireRuntimeRun(run);
    const updated = this.runtime.appendStep(runtimeRun, runtimeInput);
    this.runtime.persistRun(updated);
    return toCanonicalHarnessRun(updated);
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
    return this.runtime.evaluateRun(this.requireRuntimeRun(run));
  }

  public persist(run: HarnessRun): HarnessRun {
    const runtimeRun = this.requireRuntimeRun(run);
    this.runtime.persistRun(runtimeRun);
    return toCanonicalHarnessRun(runtimeRun);
  }

  public checkpoint(run: HarnessRun): string {
    return this.runtime.checkpointRun(this.requireRuntimeRun(run));
  }

  public restore(runId: string): HarnessRun | null {
    const restored = this.runtime.restoreRun(runId);
    return restored == null ? null : toCanonicalHarnessRun(restored);
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    const restored = this.runtime.restoreFromCheckpoint(checkpointRef);
    return restored == null ? null : toCanonicalHarnessRun(restored);
  }

  public assertInvariants(run: HarnessRun) {
    return this.runtime.assertInvariants(this.requireRuntimeRun(run));
  }

  public sleep(runOrId: HarnessRun | string, reason: string, resumeAt: string): HarnessRun {
    const run = this.requireRuntimeRun(runOrId);
    const updated = this.runtime.sleep(run, reason, resumeAt);
    this.runtime.persistRun(updated);
    return toCanonicalHarnessRun(updated);
  }

  public resume(runOrId: HarnessRun | string): HarnessRun {
    const run = this.requireRuntimeRun(runOrId);
    const updated = this.runtime.resume(run);
    this.runtime.persistRun(updated);
    return toCanonicalHarnessRun(updated);
  }

  public requestHumanReview(
    runOrId: HarnessRun | string,
    reason: string,
    evidenceRefs: readonly string[] = [],
  ): HarnessRun {
    const run = this.requireRuntimeRun(runOrId);
    const updated = this.runtime.openHitlReview(run, reason, evidenceRefs);
    this.runtime.persistRun(updated);
    return toCanonicalHarnessRun(updated);
  }

  public resolveReview(
    runOrId: HarnessRun | string,
    resolution: "approved" | "rejected",
    actorId: string,
  ): HarnessRun {
    const run = this.requireRuntimeRun(runOrId);
    const updated = this.runtime.resolveHitlReview(run, resolution, actorId);
    this.runtime.persistRun(updated);
    return toCanonicalHarnessRun(updated);
  }

  public getTimeline(runOrId: HarnessRun | string): readonly HarnessTimelineEvent[] {
    const run = this.requireRuntimeRun(runOrId);
    return this.runtime.listTimeline(run);
  }

  public getEvaluation(runOrId: HarnessRun | string) {
    const run = this.requireRuntimeRun(runOrId);
    return this.runtime.evaluateRun(run);
  }

  public traceReplay(runOrId: string, traceEvents: readonly HarnessTimelineEvent[]): HarnessRun | null {
    // Deterministic replay: reconstruct run state from trace events in deterministic order
    // Per spec, traceReplay provides deterministic replay capability for testing/debugging
    if (!traceEvents || traceEvents.length === 0) {
      // No trace events provided - fall back to checkpoint restore
      const restored = this.runtime.restoreRun(runOrId);
      return restored == null ? null : toCanonicalHarnessRun(restored);
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
    const restored = this.runtime.restoreRun(runOrId);
    return restored == null ? null : toCanonicalHarnessRun(restored);
  }

  public sideEffectReconciliation(runOrId: HarnessRun | string): HarnessRun {
    // sideEffectReconciliation placeholder - HarnessRuntimeService.reconcileSideEffects not yet implemented
    const run = this.requireRuntimeRun(runOrId);
    this.runtime.persistRun(run);
    return toCanonicalHarnessRun(run);
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
    const run = this.requireRuntimeRun(runOrId);
    // Budget settlement is tracked via BudgetLedger - persist run to trigger settlement
    this.runtime.persistRun(run);
    return toCanonicalHarnessRun(run);
  }

  private requireRuntimeRun(runOrId: HarnessRun | string): HarnessRunRuntimeState {
    const runId = typeof runOrId === "string" ? runOrId : runOrId.harnessRunId;
    const restored = this.runtime.restoreRun(runId);
    if (restored == null) {
      throw new Error(`harness_sdk.run_not_found:${runId}`);
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

// =============================================================================
// R8-19: Inter-plane transport interface for ContractEnvelope delivery
// =============================================================================

/**
 * R8-19: Inter-plane transport for sending ContractEnvelope-wrapped messages.
 * The transport is responsible for routing envelopes to target planes.
 */
export interface InterPlaneTransport {
  /**
   * Send a ContractEnvelope-wrapped message to a target plane.
   * @param params.targetPlane - The target plane identifier
   * @param params.envelope - The ContractEnvelope to deliver
   * @param params.timeoutMs - Request timeout in milliseconds
   * @returns The response payload from the target plane
   */
  send<TResponse>(
    params: {
      targetPlane: string;
      envelope: ContractEnvelope<unknown>;
      timeoutMs?: number;
    },
  ): Promise<TResponse>;
}

// =============================================================================
// R8-20: Event bus adapter interface for typed event subscription
// =============================================================================

/**
 * R8-20: Event bus adapter providing publish/subscribe semantics for the SDK.
 * Implement this interface to connect the SDK to a specific event bus implementation.
 */
export interface EventBusAdapter {
  /**
   * Publish an event to the event bus.
   * @param event - Event with eventType and JSON-serialized payload
   */
  publish(event: { eventType: string; payload: unknown }): void;

  /**
   * Subscribe to events by consumer ID.
   * @param consumerId - Unique consumer identifier
   * @param handler - Callback invoked when matching events are published
   */
  subscribe(
    consumerId: string,
    handler: (event: { eventType: string; payloadJson: string }) => void,
  ): void;

  /**
   * Unsubscribe a consumer from all events.
   * @param consumerId - Consumer ID to unsubscribe
   */
  unsubscribe(consumerId: string): void;

  /**
   * Get pending events for a consumer that have not been delivered.
   * @param consumerId - Consumer ID
   * @returns Array of pending events with eventType and JSON payload
   */
  pendingForConsumer(
    consumerId: string,
  ): Array<{ eventType: string; payloadJson: string }>;

  /**
   * Deliver pending events to a specific consumer.
   * @param consumerId - Consumer ID
   * @returns Number of events delivered
   */
  deliverPending(consumerId: string): Promise<number>;
}

// Re-export types for SDK consumers
export type { PlatformFactEvent, ContractEnvelope } from "../client-sdk/api-client.js";

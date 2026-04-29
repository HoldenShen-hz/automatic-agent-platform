/**
 * Agent Delegation - Delegation Manager Service
 *
 * Main service for managing agent delegation including:
 * - Delegation creation with topology validation
 * - Permission narrowing
 * - Context isolation
 * - Delegation chain tracking
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */

import { nowIso, newId } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
import { normalizeSandboxMode } from "../../control-plane/iam/sandbox-policy.js";
import {
  TopologyValidator,
  createTopologyValidator,
  DEFAULT_MAX_DEPTH,
  type TopologyValidatorConfig,
} from "./topology-validator.js";
import { CollaborationProtocolService, type ACPMessage, type InvariantContext } from "./collaboration-protocol/index.js";
import { CallDepthBudget } from "./call-depth-budget.js";
import type {
  AgentContext,
  DelegationSpec,
  DelegationResult,
  DelegationHandle,
  AwaitableDelegationHandle,
  DelegationChain,
  DelegationChainNode,
  DelegationOptions,
  PermissionSet,
  DelegationCreatedEvent,
  DelegationStatus,
} from "./delegation-types.js";

export interface DelegationExpirationConfig {
  checkIntervalMs?: number;
  batchSize?: number;
}

export interface ExpirationScanResult {
  scanned: number;
  expired: number;
  errors: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Manager Service
// ─────────────────────────────────────────────────────────────────────────────

export class DelegationManagerService {
  private static readonly ALLOWED_STATUS_TRANSITIONS: Readonly<Record<DelegationStatus, readonly DelegationStatus[]>> = {
    pending: ["active", "completed", "failed", "cancelled", "expired", "timed_out"],
    pending_approval: ["active", "cancelled", "expired", "timed_out"],
    discovery: ["bid", "awarded", "cancelled"],
    bid: ["awarded", "cancelled"],
    awarded: ["active", "cancelled"],
    active: ["completed", "failed", "cancelled", "expired", "timed_out"],
    completed: [],
    failed: [],
    cancelled: [],
    expired: [],
    timed_out: [],
  };

  private readonly topologyValidator: TopologyValidator;
  private readonly collaborationProtocol: CollaborationProtocolService;
  private readonly callDepthBudget: CallDepthBudget;
  private readonly defaultTimeout: number;
  private readonly delegationStore: Map<string, DelegationResult>;
  private readonly chainStore: Map<string, DelegationChain>;
  private readonly delegationRootStore: Map<string, string>;
  // C-11: TTL-based eviction to prevent memory leaks
  private readonly MAX_ENTRIES = 1000;
  private readonly ENTRY_TTL_MS = 60 * 60 * 1000; // 1 hour
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

  public constructor(options: DelegationOptions = {}) {
    const config: TopologyValidatorConfig = {
      maxDepth: options.maxDepth ?? options.maxDelegationDepth ?? DEFAULT_MAX_DEPTH,
      maxFanout: options.maxFanout ?? 10,
      ...(options.allowedPackIds ? { allowedPackIds: options.allowedPackIds } : {}),
    };
    this.topologyValidator = createTopologyValidator(config);
    this.collaborationProtocol = new CollaborationProtocolService();
    this.callDepthBudget = new CallDepthBudget();
    this.defaultTimeout = options.defaultTimeout ?? options.defaultTimeoutMs ?? 300000; // 5 minutes
    this.delegationStore = new Map();
    this.chainStore = new Map();
    this.delegationRootStore = new Map();
  }

  /**
   * C-11: Evict expired delegation entries to prevent memory leaks.
   */
  private evictExpired(): void {
    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.ENTRY_TTL_MS;
    const entriesToDelete: string[] = [];

    // Find expired delegation store entries
    for (const [key, delegation] of this.delegationStore) {
      const createdAt = new Date(delegation.createdAt).getTime();
      if (createdAt < expiryThreshold && (delegation.status === "completed" || delegation.status === "failed" || delegation.status === "expired" || delegation.status === "cancelled")) {
        entriesToDelete.push(key);
      }
    }

    for (const key of entriesToDelete) {
      this.delegationStore.delete(key);
    }

    // If still over capacity, remove oldest completed/failed entries
    if (this.delegationStore.size > this.MAX_ENTRIES) {
      const sortedEntries = [...this.delegationStore.entries()].sort((a, b) => {
        const aTime = new Date(a[1].createdAt).getTime();
        const bTime = new Date(b[1].createdAt).getTime();
        return aTime - bTime;
      });

      const toRemove = this.delegationStore.size - this.MAX_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        const key = sortedEntries[i]![0];
        this.delegationStore.delete(key);
      }
    }
  }

  // ── Main Delegation API ─────────────────────────────────────────────────────

  /**
   * Creates a new delegation from parent agent to child agent.
   *
   * @param parent - Parent agent context
   * @param spec - Delegation specification
   * @returns DelegationHandle for tracking the delegation
   * @throws DelegationDepthExceededError | DelegationFanoutExceededError | DelegationCycleDetectedError
   */
  public delegate(
    parent: AgentContext,
    spec: DelegationSpec,
  ): AwaitableDelegationHandle {
    // Step 0: Call depth budget evaluation - each dimension is distinct.
    // A plain delegation adds one new delegation frame; it does not triple-count
    // the current delegation depth as goal decomposition or global call depth.
    const depthDecision = this.callDepthBudget.evaluate({
      currentCallDepth: parent.currentCallDepth ?? parent.delegationDepth,
      goalDecompositionDepth: parent.goalDecompositionDepth ?? 0,
      delegationDepth: 1,
    });
    if (!depthDecision.allowed) {
      throw new ValidationError(
        "delegation.call_depth_exceeded",
        `Call depth ${depthDecision.effectiveCallDepth} exceeds maximum ${depthDecision.maxCallDepth}`,
        { details: { effectiveCallDepth: depthDecision.effectiveCallDepth, maxCallDepth: depthDecision.maxCallDepth } },
      );
    }

    // Step 1: Topology validation
    this.validateTopology(parent, spec);

    // Step 2: Permission narrowing
    const narrowedPermissions = this.narrowPermissions(
      parent.permissions,
      spec.requiredPermissions,
    );

    // Step 3: Create isolated child context
    this.createIsolatedContext(parent, narrowedPermissions, spec);

    // Step 4: Create delegation record
    const delegationResult = this.createDelegationRecord(parent, spec, narrowedPermissions);

    // Step 5: Update delegation chain
    const rootAgentId = this.resolveRootAgentId(parent);
    this.updateDelegationChain(rootAgentId, parent, spec, delegationResult);
    this.delegationRootStore.set(delegationResult.delegationId, rootAgentId);

    // Step 6: Return handle (actual dispatch would be handled by caller/dispatch engine)
    return this.createHandle(delegationResult, parent.correlationId);
  }

  /**
   * Cancels an active delegation.
   *
   * @param delegationId - Delegation to cancel
   */
  public cancel(delegationId: string): void {
    const delegation = this.delegationStore.get(delegationId);
    if (!delegation) {
      throw new ValidationError(
        "delegation.not_found",
        `Delegation ${delegationId} not found`,
        { details: { delegationId } },
      );
    }

    if (delegation.status !== "pending" && delegation.status !== "pending_approval" && delegation.status !== "active") {
      throw new ValidationError(
        "delegation.cannot_cancel",
        `Delegation ${delegationId} cannot be cancelled (status: ${delegation.status})`,
        { details: { delegationId, status: delegation.status } },
      );
    }

    this.transitionDelegationStatus(delegation, "cancelled");
  }

  public cancelDelegation(delegationId: string): void {
    this.cancel(delegationId);
  }

  /**
   * Marks a delegation as completed.
   *
   * @param delegationId - Delegation to complete
   * @param outputRef - Optional reference to output artifact
   */
  public complete(delegationId: string, _outputRef?: string): void {
    const delegation = this.requireDelegation(delegationId);
    this.transitionDelegationStatus(delegation, "completed");
  }

  public completeDelegation(delegationId: string, outputRef?: string): void {
    this.complete(delegationId, outputRef);
  }

  public async completeWithEvidence(delegationId: string, evidence: readonly string[], outputRef?: string): Promise<void> {
    const delegation = this.requireDelegation(delegationId);
    const capabilityIntersection = this.buildAcpCapabilityIntersection(delegation.permissions);
    const validation = this.collaborationProtocol.validateAndSend(
      this.collaborationProtocol.createMessage("completion_report", {
        correlation_id: delegationId,
        parent_run_id: delegationId,
        delegationId: delegation.delegationId,
        childRunId: delegation.childAgentId,
        capabilityIntersection,
        budgetCap: delegation.permissions.constraints.maxTokens ?? delegation.permissions.constraints.maxDurationMs ?? 0,
        dataBoundary: delegation.data_class ?? "delegation",
        deadline: delegation.expiresAt,
        depth: delegation.depth,
        sender_agent_id: delegation.childAgentId,
        receiver_agent_id: delegation.parentAgentId,
        domain_id: "delegation",
        risk_level: 0,
        budget_remaining: 0,
        trace_id: delegationId,
        payload: {
          evidence: [...evidence],
          result_summary: outputRef ?? "delegation completed",
          artifacts: outputRef ? [outputRef] : [],
        },
      }),
      {
        parentPermissions: delegation.permissions,
        parentRiskMode: 100,
        parentConstraints: delegation.permissions.constraints as unknown as Record<string, unknown>,
        parentBudgetRemaining: Number.MAX_SAFE_INTEGER,
        globalCallDepth: delegation.depth,
      },
    );
    if (!validation.accepted) {
      throw new ValidationError("delegation.invalid_completion_report", "Completion report failed ACP validation", {
        details: { delegationId, violations: validation.violations },
      });
    }
    this.complete(delegationId, outputRef);
  }

  /**
   * Marks a delegation as failed.
   *
   * @param delegationId - Delegation to fail
   * @param error - Error message
   */
  public fail(delegationId: string, _error: string): void {
    const delegation = this.requireDelegation(delegationId);
    this.transitionDelegationStatus(delegation, "failed");
  }

  public handleDelegationTimeout(delegationId: string): void {
    const delegation = this.requireDelegation(delegationId);
    this.transitionDelegationStatus(delegation, "timed_out");
  }

  public createDelegationContext(
    delegationId: string,
    overrides: Partial<AgentContext> = {},
  ): AgentContext {
    const delegation = this.requireDelegation(delegationId);
    const activeDelegations = [
      ...new Set([
        delegationId,
        ...(overrides.activeDelegations ?? []),
      ]),
    ];

    return {
      ...overrides,
      agentId: overrides.agentId ?? delegation.childAgentId,
      agentType: overrides.agentType ?? "worker",
      packId: overrides.packId ?? delegation.childAgentId,
      delegationDepth: overrides.delegationDepth ?? delegation.depth,
      currentCallDepth: overrides.currentCallDepth ?? delegation.depth,
      goalDecompositionDepth: overrides.goalDecompositionDepth ?? 0,
      activeDelegations,
      permissions: delegation.permissions,
      sandboxTier: overrides.sandboxTier ?? "workspace_write",
      correlationId: overrides.correlationId ?? delegation.correlationId,
      tenantId: overrides.tenantId ?? null,
    };
  }

  /**
   * Gets the delegation chain for an agent.
   *
   * @param agentId - Root agent ID
   * @returns DelegationChain or null if not found
   */
  public getDelegationChain(agentId: string): DelegationChain | null {
    const direct = this.chainStore.get(agentId);
    if (direct) {
      return direct;
    }

    for (const chain of this.chainStore.values()) {
      const parentIndex = chain.nodes.findIndex((node) => node.agentId === agentId);
      if (parentIndex >= 0) {
        const nodes = chain.nodes.slice(parentIndex + 1);
        return {
          rootAgentId: chain.rootAgentId,
          nodes,
          maxDepthReached: nodes.reduce((maxDepth, node) => Math.max(maxDepth, node.depth), 0),
          totalDelegations: nodes.length,
        };
      }
    }

    return null;
  }

  /**
   * Gets a delegation by ID.
   *
   * @param delegationId - Delegation ID
   */
  public getDelegation(delegationId: string): DelegationResult | null {
    return this.delegationStore.get(delegationId) ?? null;
  }

  /**
   * Gets all active delegations for an agent.
   *
   * @param agentId - Agent ID
   */
  public getActiveDelegations(agentId: string): DelegationResult[] {
    return [...this.delegationStore.values()].filter(
      (d) =>
        (d.parentAgentId === agentId || d.childAgentId === agentId) &&
        (d.status === "pending" || d.status === "pending_approval" || d.status === "active"),
    );
  }

  /**
   * §49: Scans all delegations and expires those past their expiresAt time.
   * Returns the count of expired delegations.
   */
  public revokeExpiredDelegations(): ExpirationScanResult {
    const now = nowIso();
    const errors: string[] = [];
    let expired = 0;

    for (const delegation of this.delegationStore.values()) {
      if (delegation.status === "pending" || delegation.status === "pending_approval" || delegation.status === "active") {
        if (delegation.expiresAt < now) {
          try {
            this.transitionDelegationStatus(delegation, "expired");
            expired++;
          } catch (err) {
            errors.push(`Failed to expire delegation ${delegation.delegationId}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    return {
      scanned: this.delegationStore.size,
      expired,
      errors,
    };
  }

  /**
   * §49: Gets all expired delegations that haven't been marked as expired yet.
   * Useful for auditing or cleanup verification.
   */
  public getExpiredDelegations(): DelegationResult[] {
    const now = nowIso();
    return [...this.delegationStore.values()].filter(
      (d) =>
        (d.status === "pending" || d.status === "pending_approval" || d.status === "active") &&
        d.expiresAt < now,
    );
  }

  /**
   * §49: Gets the count of pending expirations (delegations past expiresAt but not yet processed).
   */
  public getPendingExpirationCount(): number {
    return this.getExpiredDelegations().length;
  }

  public validateCollaborationMessage(message: ACPMessage, context: InvariantContext): { accepted: boolean; violations: string[] } {
    return this.collaborationProtocol.validateAndSend(message, context);
  }

  public recordTakeoverNotice(message: ACPMessage, context: InvariantContext): { accepted: boolean; violations: string[] } {
    return this.collaborationProtocol.handleIncoming(message, context);
  }

  // ── Private Methods ───────────────────────────────────────────────────────

  private validateTopology(parent: AgentContext, spec: DelegationSpec): void {
    // Get the delegation chain for cycle detection
    const chain = this.getDelegationChain(parent.agentId);
    const chainPackIds = [
      parent.packId,
      ...(parent.delegationDepth > 0 ? chain?.nodes.map((n) => n.packId) ?? [] : []),
    ].filter((packId): packId is string => typeof packId === "string");

    this.topologyValidator.validate({
      currentDepth: parent.delegationDepth,
      activeDelegations: parent.activeDelegations.length,
      targetPackId: spec.targetPackId,
      delegationChain: chainPackIds,
    });
  }

  private narrowPermissions(
    parentPermissions: PermissionSet,
    requiredPermissions: PermissionSet,
  ): PermissionSet {
    // §19: Permissions must be narrowed via intersection, not replacement
    // Child can only request resources that parent already has
    const allowedResources = requiredPermissions.resources.length > 0
      ? parentPermissions.resources.filter((resource) => requiredPermissions.resources.includes(resource))
      : parentPermissions.resources;
    return {
      resources: allowedResources,
      actions: this.intersectActions(parentPermissions.actions, requiredPermissions.actions),
      constraints: {
        ...parentPermissions.constraints,
        ...requiredPermissions.constraints,
        // Take more restrictive values
        maxDurationMs: Math.min(
          parentPermissions.constraints.maxDurationMs ?? Infinity,
          requiredPermissions.constraints.maxDurationMs ?? Infinity,
        ),
        maxTokens: Math.min(
          parentPermissions.constraints.maxTokens ?? Infinity,
          requiredPermissions.constraints.maxTokens ?? Infinity,
        ),
      },
    };
  }

  private intersectActions(parentActions: readonly string[], childActions: readonly string[]): string[] {
    if (childActions.length === 0) {
      return [...parentActions];
    }
    return parentActions.filter((action) => childActions.includes(action));
  }

  private buildAcpCapabilityIntersection(permissions: PermissionSet): string[] {
    const intersection = [...permissions.actions, ...permissions.resources].filter(
      (value, index, array) => array.indexOf(value) === index,
    );
    return intersection.length > 0 ? intersection : ["delegation"];
  }

  private createIsolatedContext(
    parent: AgentContext,
    permissions: PermissionSet,
    spec: DelegationSpec,
  ): AgentContext {
    return {
      agentId: spec.targetAgentId,
      agentType: spec.targetAgentType,
      packId: spec.targetPackId,
      delegationDepth: parent.delegationDepth + 1,
      activeDelegations: [], // New context starts with no active delegations
      permissions,
      sandboxTier: normalizeSandboxMode(parent.sandboxTier),
      correlationId: `${parent.correlationId}:${newId("dlg")}`,
      tenantId: parent.tenantId,
    };
  }

  private createDelegationRecord(
    parent: AgentContext,
    spec: DelegationSpec,
    permissions: PermissionSet,
  ): DelegationResult {
    // C-11: Evict expired entries before creating new one
    this.evictExpired();

    const delegationId = newId("dlg");
    const now = nowIso();
    const timeout = spec.timeout > 0 ? spec.timeout : this.defaultTimeout;
    const expiresAt = new Date(Date.now() + timeout).toISOString();

    const delegation: DelegationResult = {
      delegationId,
      parentAgentId: parent.agentId,
      childAgentId: spec.targetAgentId,
      depth: parent.delegationDepth + 1,
      permissions,
      grantedPermissions: permissions,
      createdAt: now,
      expiresAt,
      correlationId: parent.correlationId,
      ...(spec.requiresApproval ? { requiresApproval: true } : {}),
      status: spec.requiresApproval ? "pending_approval" : "pending",
    };

    this.delegationStore.set(delegationId, delegation);
    return delegation;
  }

  private requireDelegation(delegationId: string): DelegationResult {
    const delegation = this.delegationStore.get(delegationId);
    if (!delegation) {
      throw new ValidationError(
        "delegation.not_found",
        `Delegation ${delegationId} not found`,
        { details: { delegationId } },
      );
    }
    return delegation;
  }

  private transitionDelegationStatus(
    delegation: DelegationResult,
    nextStatus: DelegationStatus,
  ): void {
    const allowedStatuses = DelegationManagerService.ALLOWED_STATUS_TRANSITIONS[delegation.status];
    if (!allowedStatuses.includes(nextStatus)) {
      throw new ValidationError(
        "delegation.invalid_status_transition",
        `Delegation ${delegation.delegationId} cannot transition from ${delegation.status} to ${nextStatus}`,
        {
          details: {
            delegationId: delegation.delegationId,
            fromStatus: delegation.status,
            toStatus: nextStatus,
          },
        },
      );
    }
    delegation.status = nextStatus;
    if (nextStatus === "completed") {
      delegation.completedAt = nowIso();
    }
  }

  private resolveRootAgentId(parent: AgentContext): string {
    const parentDelegationId = parent.activeDelegations.at(-1);
    return parentDelegationId ? this.delegationRootStore.get(parentDelegationId) ?? parent.agentId : parent.agentId;
  }

  private updateDelegationChain(rootAgentId: string, parent: AgentContext, spec: DelegationSpec, delegation: DelegationResult): void {
    // C-11: Evict expired entries before updating chain
    this.evictExpired();

    let chain = this.chainStore.get(rootAgentId);

    if (!chain) {
      chain = {
        rootAgentId,
        nodes: [],
        maxDepthReached: 0,
        totalDelegations: 0,
      };
    }

    const node: DelegationChainNode = {
      delegationId: delegation.delegationId,
      agentId: delegation.childAgentId,
      packId: spec.targetPackId,
      agentType: spec.targetAgentType,
      depth: delegation.depth,
      createdAt: delegation.createdAt,
      parentDelegationId: parent.activeDelegations.at(-1) ?? null,
    };

    chain.nodes = [...chain.nodes, node];
    chain.maxDepthReached = Math.max(chain.maxDepthReached, delegation.depth);
    chain.totalDelegations++;

    this.chainStore.set(rootAgentId, chain);
  }

  private createHandle(delegation: DelegationResult, correlationId: string): AwaitableDelegationHandle {
    const handle: DelegationHandle = {
      delegationId: delegation.delegationId,
      parentAgentId: delegation.parentAgentId,
      childAgentId: delegation.childAgentId,
      depth: delegation.depth,
      status: delegation.status,
      createdAt: delegation.createdAt,
      timeout: new Date(delegation.expiresAt).getTime() - Date.now(),
      correlationId: `${correlationId}:${delegation.delegationId}`,
      ...(delegation.requiresApproval ? { requiresApproval: true } : {}),
    };
    return this.makeAwaitableHandle(handle);
  }

  private makeAwaitableHandle(handle: DelegationHandle): AwaitableDelegationHandle {
    Object.defineProperty(handle, "then", {
      enumerable: false,
      configurable: true,
      value: (
        onFulfilled?: ((value: DelegationHandle) => DelegationHandle | PromiseLike<DelegationHandle>) | null,
        onRejected?: ((reason: unknown) => DelegationHandle | PromiseLike<DelegationHandle>) | null,
      ) => Promise.resolve({ ...handle }).then(onFulfilled ?? undefined, onRejected ?? undefined),
    });
    return handle as AwaitableDelegationHandle;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createDelegationManager(
  options?: DelegationOptions,
): DelegationManagerService {
  return new DelegationManagerService(options);
}

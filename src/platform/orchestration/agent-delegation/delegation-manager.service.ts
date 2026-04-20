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
import {
  TopologyValidator,
  createTopologyValidator,
  type TopologyValidatorConfig,
} from "./topology-validator.js";
import type {
  AgentContext,
  DelegationSpec,
  DelegationResult,
  DelegationHandle,
  DelegationChain,
  DelegationChainNode,
  DelegationOptions,
  PermissionSet,
  DelegationCreatedEvent,
} from "./delegation-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Manager Service
// ─────────────────────────────────────────────────────────────────────────────

export class DelegationManagerService {
  private readonly topologyValidator: TopologyValidator;
  private readonly defaultTimeout: number;
  private readonly delegationStore: Map<string, DelegationResult>;
  private readonly chainStore: Map<string, DelegationChain>;

  public constructor(options: DelegationOptions = {}) {
    const config: TopologyValidatorConfig = {
      maxDepth: options.maxDepth ?? 5,
      maxFanout: options.maxFanout ?? 10,
      ...(options.allowedPackIds ? { allowedPackIds: options.allowedPackIds } : {}),
    };
    this.topologyValidator = createTopologyValidator(config);
    this.defaultTimeout = options.defaultTimeout ?? 300000; // 5 minutes
    this.delegationStore = new Map();
    this.chainStore = new Map();
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
  public async delegate(
    parent: AgentContext,
    spec: DelegationSpec,
  ): Promise<DelegationHandle> {
    // Step 1: Topology validation
    this.validateTopology(parent, spec);

    // Step 2: Permission narrowing
    const narrowedPermissions = this.narrowPermissions(
      parent.permissions,
      spec.requiredPermissions,
    );

    // Step 3: Create isolated child context
    const childContext = this.createIsolatedContext(parent, narrowedPermissions, spec);

    // Step 4: Create delegation record
    const delegationResult = await this.createDelegationRecord(parent, spec, narrowedPermissions);

    // Step 5: Update delegation chain
    this.updateDelegationChain(parent.agentId, delegationResult);

    // Step 6: Return handle (actual dispatch would be handled by caller/dispatch engine)
    return this.createHandle(delegationResult, parent.correlationId);
  }

  /**
   * Cancels an active delegation.
   *
   * @param delegationId - Delegation to cancel
   */
  public async cancel(delegationId: string): Promise<void> {
    const delegation = this.delegationStore.get(delegationId);
    if (!delegation) {
      throw new ValidationError(
        "delegation.not_found",
        `Delegation ${delegationId} not found`,
        { details: { delegationId } },
      );
    }

    if (delegation.status !== "pending" && delegation.status !== "active") {
      throw new ValidationError(
        "delegation.cannot_cancel",
        `Delegation ${delegationId} cannot be cancelled (status: ${delegation.status})`,
        { details: { delegationId, status: delegation.status } },
      );
    }

    delegation.status = "cancelled";
  }

  /**
   * Marks a delegation as completed.
   *
   * @param delegationId - Delegation to complete
   * @param outputRef - Optional reference to output artifact
   */
  public async complete(delegationId: string, _outputRef?: string): Promise<void> {
    const delegation = this.delegationStore.get(delegationId);
    if (!delegation) {
      throw new ValidationError(
        "delegation.not_found",
        `Delegation ${delegationId} not found`,
        { details: { delegationId } },
      );
    }

    delegation.status = "completed";
  }

  /**
   * Marks a delegation as failed.
   *
   * @param delegationId - Delegation to fail
   * @param error - Error message
   */
  public async fail(delegationId: string, _error: string): Promise<void> {
    const delegation = this.delegationStore.get(delegationId);
    if (!delegation) {
      throw new ValidationError(
        "delegation.not_found",
        `Delegation ${delegationId} not found`,
        { details: { delegationId } },
      );
    }

    delegation.status = "failed";
  }

  /**
   * Gets the delegation chain for an agent.
   *
   * @param agentId - Root agent ID
   * @returns DelegationChain or null if not found
   */
  public getDelegationChain(agentId: string): DelegationChain | null {
    return this.chainStore.get(agentId) ?? null;
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
        d.status === "active",
    );
  }

  // ── Private Methods ───────────────────────────────────────────────────────

  private validateTopology(parent: AgentContext, spec: DelegationSpec): void {
    // Get the delegation chain for cycle detection
    const chain = this.getDelegationChain(parent.agentId);
    const chainPackIds = chain?.nodes.map((n) => n.agentId) ?? [];

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
    return {
      resources: requiredPermissions.resources.length > 0
        ? requiredPermissions.resources
        : parentPermissions.resources,
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
      sandboxTier: parent.sandboxTier, // Inherit sandbox tier from parent
      correlationId: `${parent.correlationId}:${newId("dlg")}`,
      tenantId: parent.tenantId,
    };
  }

  private async createDelegationRecord(
    parent: AgentContext,
    spec: DelegationSpec,
    permissions: PermissionSet,
  ): Promise<DelegationResult> {
    const delegationId = newId("dlg");
    const now = nowIso();
    const timeout = spec.timeout ?? this.defaultTimeout;
    const expiresAt = new Date(Date.now() + timeout).toISOString();

    const delegation: DelegationResult = {
      delegationId,
      parentAgentId: parent.agentId,
      childAgentId: spec.targetAgentId,
      depth: parent.delegationDepth + 1,
      permissions,
      createdAt: now,
      expiresAt,
      status: "pending",
    };

    this.delegationStore.set(delegationId, delegation);
    return delegation;
  }

  private updateDelegationChain(rootAgentId: string, delegation: DelegationResult): void {
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
      agentType: "", // Would be filled from spec
      depth: delegation.depth,
      createdAt: delegation.createdAt,
      parentDelegationId: null, // Would be set from parent context
    };

    chain.nodes = [...chain.nodes, node];
    chain.maxDepthReached = Math.max(chain.maxDepthReached, delegation.depth);
    chain.totalDelegations++;

    this.chainStore.set(rootAgentId, chain);
  }

  private createHandle(delegation: DelegationResult, correlationId: string): DelegationHandle {
    return {
      delegationId: delegation.delegationId,
      parentAgentId: delegation.parentAgentId,
      childAgentId: delegation.childAgentId,
      depth: delegation.depth,
      status: delegation.status,
      createdAt: delegation.createdAt,
      timeout: new Date(delegation.expiresAt).getTime() - Date.now(),
      correlationId: `${correlationId}:${delegation.delegationId}`,
    };
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
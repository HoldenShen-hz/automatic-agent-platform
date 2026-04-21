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
  DEFAULT_MAX_DEPTH,
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
  private readonly topologyValidator: TopologyValidator;
  private readonly defaultTimeout: number;
  private readonly delegationStore: Map<string, DelegationResult>;
  private readonly chainStore: Map<string, DelegationChain>;
  // C-11: TTL-based eviction to prevent memory leaks
  private readonly MAX_ENTRIES = 1000;
  private readonly ENTRY_TTL_MS = 60 * 60 * 1000; // 1 hour
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

  public constructor(options: DelegationOptions = {}) {
    const config: TopologyValidatorConfig = {
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      maxFanout: options.maxFanout ?? 10,
      ...(options.allowedPackIds ? { allowedPackIds: options.allowedPackIds } : {}),
    };
    this.topologyValidator = createTopologyValidator(config);
    this.defaultTimeout = options.defaultTimeout ?? 300000; // 5 minutes
    this.delegationStore = new Map();
    this.chainStore = new Map();
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

  /**
   * §49: Scans all delegations and expires those past their expiresAt time.
   * Returns the count of expired delegations.
   */
  public revokeExpiredDelegations(): ExpirationScanResult {
    const now = nowIso();
    const errors: string[] = [];
    let expired = 0;

    for (const delegation of this.delegationStore.values()) {
      if (delegation.status === "pending" || delegation.status === "active") {
        if (delegation.expiresAt < now) {
          try {
            delegation.status = "expired";
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
        (d.status === "pending" || d.status === "active") &&
        d.expiresAt < now,
    );
  }

  /**
   * §49: Gets the count of pending expirations (delegations past expiresAt but not yet processed).
   */
  public getPendingExpirationCount(): number {
    return this.getExpiredDelegations().length;
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
    // C-11: Evict expired entries before creating new one
    this.evictExpired();

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
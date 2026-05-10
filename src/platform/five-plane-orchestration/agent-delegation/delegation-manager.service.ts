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
  type DelegationTopologyEdge,
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
import type { DelegationRepository, DelegationEventRepository, DelegationRecord } from "../../five-plane-state-evidence/truth/sqlite/repositories/delegation-repository.js";
import {
  DelegationGovernanceService,
  defaultDelegationGovernanceService,
  type DelegationGovernanceRequest,
  type DelegationGovernanceDecision,
} from "./delegation-governance-service.js";
import {
  DelegationAuditService,
  delegationAuditService,
} from "./delegation-audit-service.js";

// Extended options interface that includes service dependencies
interface DelegationManagerOptions extends DelegationOptions {
  governanceService?: DelegationGovernanceService;
  auditService?: DelegationAuditService;
}

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
  private readonly governanceService: DelegationGovernanceService;
  private readonly auditService: DelegationAuditService;
  private readonly defaultTimeout: number;
  // R9-06: Cache maps populated from repository - repository is the authoritative store
  // These are caches only, populated on init from repository and kept in sync
  private readonly delegationStore: Map<string, DelegationResult>;
  private readonly chainStore: Map<string, DelegationChain>;
  private readonly delegationRootStore: Map<string, string>;
  // R9-06: Injected delegation repository - the authoritative persistent store
  private readonly delegationRepository: DelegationRepository;
  private readonly eventRepository: DelegationEventRepository | null;
  // R9-06: Always use repository when available (injected repositories are always truthy)
  private readonly useRepositoryAsPrimaryStore: boolean = true;
  // C-11: TTL-based eviction to prevent memory leaks (only used when no repository)
  private readonly MAX_ENTRIES = 1000;
  private readonly ENTRY_TTL_MS = 60 * 60 * 1000; // 1 hour
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

  public constructor(options: DelegationManagerOptions = {}, delegationRepository?: DelegationRepository, eventRepository?: DelegationEventRepository) {
    const config: TopologyValidatorConfig = {
      maxDepth: options.maxDepth ?? options.maxDelegationDepth ?? DEFAULT_MAX_DEPTH,
      maxFanout: options.maxFanout ?? 10,
      ...(options.allowedPackIds ? { allowedPackIds: options.allowedPackIds } : {}),
    };
    this.topologyValidator = createTopologyValidator(config);
    this.collaborationProtocol = new CollaborationProtocolService();
    this.callDepthBudget = new CallDepthBudget();
    this.governanceService = options.governanceService ?? defaultDelegationGovernanceService;
    this.auditService = options.auditService ?? delegationAuditService;
    this.defaultTimeout = options.defaultTimeout ?? options.defaultTimeoutMs ?? 300000; // 5 minutes

    // R9-06: Repository is the authoritative store when provided
    // If not provided, fall back to in-memory mode (for backward compatibility)
    this.delegationRepository = delegationRepository!;
    this.eventRepository = eventRepository ?? null;
    this.useRepositoryAsPrimaryStore = this.delegationRepository !== null;

    // R9-06: Initialize in-memory caches - populated from repository on init
    this.delegationStore = new Map();
    this.chainStore = new Map();
    this.delegationRootStore = new Map();

    // R9-06: Hydrate active delegations from repository to survive process restarts
    // This MUST complete before the service is ready to handle requests
    if (this.delegationRepository) {
      this.hydrateFromRepository().catch((err) => {
        // Log but don't fail startup - in-memory mode still works as fallback
        console.error("Failed to hydrate delegations from repository:", err);
      });
    }
  }

  /**
   * C-11: Evict expired delegation entries to prevent memory leaks.
   * §186-2183: Only evict terminal-state delegations - never evict active delegations.
   * R9-06: Skip eviction when repository is primary store - repository manages its own lifecycle.
   */
  private evictExpired(): void {
    // R9-06: When repository is primary store, delegation lifecycle is managed by repository
    if (this.useRepositoryAsPrimaryStore) {
      return;
    }

    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.ENTRY_TTL_MS;
    const entriesToDelete: string[] = [];

    // Find expired delegation store entries - only terminal states are eligible for eviction
    for (const [key, delegation] of this.delegationStore) {
      const createdAt = new Date(delegation.createdAt).getTime();
      // Root cause: eviction was removing active delegations that happened to exceed TTL
      // Fix: Only evict delegations in terminal states (completed/failed/cancelled/expired)
      const isTerminalState = delegation.status === "completed" || delegation.status === "failed" ||
        delegation.status === "expired" || delegation.status === "cancelled";
      if (createdAt < expiryThreshold && isTerminalState) {
        entriesToDelete.push(key);
      }
    }

    for (const key of entriesToDelete) {
      this.delegationStore.delete(key);
    }

    // If still over capacity, remove oldest terminal-state entries only
    if (this.delegationStore.size > this.MAX_ENTRIES) {
      const sortedEntries = [...this.delegationStore.entries()].sort((a, b) => {
        const aTime = new Date(a[1].createdAt).getTime();
        const bTime = new Date(b[1].createdAt).getTime();
        return aTime - bTime;
      });

      const toRemove = this.delegationStore.size - this.MAX_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        const key = sortedEntries[i]![0];
        // Only remove terminal-state delegations when doing capacity eviction
        const delegation = this.delegationStore.get(key);
        if (delegation) {
          const isTerminalState = delegation.status === "completed" || delegation.status === "failed" ||
            delegation.status === "expired" || delegation.status === "cancelled";
          if (isTerminalState) {
            this.delegationStore.delete(key);
          }
        }
      }
    }
  }

  /**
   * R9-06: Hydrates in-memory stores from repository on startup.
   * This ensures active delegation chains survive process restarts.
   */
  private async hydrateFromRepository(): Promise<void> {
    if (!this.delegationRepository) {
      return;
    }

    // Load all non-terminal delegations from repository
    const activeStatuses: DelegationStatus[] = ["pending", "pending_approval", "active", "discovery", "bid", "awarded"];
    let hydratedCount = 0;

    for (const status of activeStatuses) {
      const delegations = await this.delegationRepository.findByStatus(status);
      for (const record of delegations) {
        // R9-06: Reconstruct partial DelegationResult from repository record
        // Note: Full permissions and other runtime fields are not persisted,
        // so we create a minimal reconstruction sufficient for chain tracking.
        const delegationResult: DelegationResult = {
          delegationId: record.delegationId,
          parentAgentId: record.parentAgentId,
          childAgentId: record.childAgentId,
          depth: record.depth,
          status: record.status,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt ?? nowIso(), // Fallback if expiresAt was null
          permissions: { resources: [], actions: [], constraints: {} }, // Reconstructed
          grantedPermissions: { resources: [], actions: [], constraints: {} }, // Reconstructed
          correlationId: record.delegationId, // Use delegationId as correlationId fallback
          artifact_refs: [],
          trust_level: 0,
          taint_labels: [],
          evidence_refs: [],
          policy_outcome: "delegation.hydrated_from_repository",
          data_class: "delegation",
          summary: `Hydrated delegation from repository: ${record.delegationId}`,
        };

        this.delegationStore.set(record.delegationId, delegationResult);

        // R9-06: Reconstruct chain tracking
        const rootAgentId = record.delegationChain[0] ?? record.parentAgentId;
        this.delegationRootStore.set(record.delegationId, rootAgentId);

        // R9-06: Rebuild chain nodes for active delegations
        let chain = this.chainStore.get(rootAgentId);
        if (!chain) {
          chain = {
            rootAgentId,
            nodes: [],
            maxDepthReached: 0,
            totalDelegations: 0,
          };
          this.chainStore.set(rootAgentId, chain);
        }

        const existingNode = chain.nodes.find((n) => n.delegationId === record.delegationId);
        if (!existingNode) {
          const node: DelegationChainNode = {
            delegationId: record.delegationId,
            agentId: record.childAgentId,
            packId: record.childAgentId, // Use childAgentId as packId fallback
            agentType: "worker",
            depth: record.depth,
            createdAt: record.createdAt,
            parentDelegationId: null,
            status: "active",
          };
          chain.nodes = [...chain.nodes, node];
          chain.maxDepthReached = Math.max(chain.maxDepthReached, record.depth);
          chain.totalDelegations++;
        }

        hydratedCount++;
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
  ): Promise<AwaitableDelegationHandle> {
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

    // Step 0b: Governance evaluation - §51 delegation governance rules must be evaluated
    // Note: DelegationSpec does not carry riskLevel; governance evaluates based on
    // parentContext.delegationDepth and other context factors.
    const governanceRequest: DelegationGovernanceRequest = {
      parentContext: parent,
      delegationSpec: spec,
    };
    const governanceDecision = this.governanceService.evaluate(governanceRequest);
    // §51: Record governance decision in audit trail
    this.auditService.recordGovernanceEvaluation({
      delegationId: null,
      parentAgentId: parent.agentId,
      childAgentId: spec.targetAgentId ?? null,
      depth: parent.delegationDepth + 1,
      reasonCode: governanceDecision.reasonCode,
      decision: governanceDecision.decision,
      evaluatedRules: governanceDecision.evaluatedRules,
      actorId: parent.agentId,
      actorType: "agent",
    });
    // §51: Deny if governance denied
    if (governanceDecision.decision === "deny") {
      throw new ValidationError(
        "delegation.governance_denied",
        `Delegation denied by governance: ${governanceDecision.reasonCode}`,
        { details: { reasonCode: governanceDecision.reasonCode, evaluatedRules: governanceDecision.evaluatedRules } },
      );
    }
    // §51: Require approval if governance requires it - for now, block until approval flow is implemented
    if (governanceDecision.decision === "require_approval") {
      throw new ValidationError(
        "delegation.requires_approval",
        `Delegation requires approval: ${governanceDecision.reasonCode}`,
        { details: { reasonCode: governanceDecision.reasonCode, evaluatedRules: governanceDecision.evaluatedRules } },
      );
    }

    // Step 1: Topology validation
    await this.validateTopology(parent, spec);

    // Step 2: Permission narrowing
    const narrowedPermissions = this.narrowPermissions(
      parent.permissions,
      spec.requiredPermissions,
    );

    // Step 3: Create isolated child context
    this.createIsolatedContext(parent, narrowedPermissions, spec);

    // Step 4: Create delegation record (await persistence)
    const delegationResult = await this.createDelegationRecord(parent, spec, narrowedPermissions);

    // Step 5: Update delegation chain
    const rootAgentId = this.resolveRootAgentId(parent);
    await this.updateDelegationChain(rootAgentId, parent, spec, delegationResult);
    this.delegationRootStore.set(delegationResult.delegationId, rootAgentId);

    // Step 5b: Record delegation creation in audit trail
    this.auditService.recordDelegationCreated({
      delegationId: delegationResult.delegationId,
      parentAgentId: parent.agentId,
      childAgentId: delegationResult.childAgentId,
      depth: delegationResult.depth,
      reasonCode: governanceDecision.reasonCode,
      actorId: parent.agentId,
      actorType: "agent",
    });

    // Step 6: Return handle (actual dispatch would be handled by caller/dispatch engine)
    return this.createHandle(delegationResult, parent.correlationId);
  }

  /**
   * Cancels an active delegation.
   * R9-06: When repository is available, fetch from repository if not in memory.
   *
   * @param delegationId - Delegation to cancel
   */
  public async cancel(delegationId: string): Promise<void> {
    const delegation = this.delegationStore.get(delegationId) ?? await this.getDelegation(delegationId);
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

    // R17-02: Capture initial status as fencing token to prevent race conditions.
    // The status was validated above, but between this read and the transition call,
    // another concurrent operation could modify the delegation. Passing the initial
    // status ensures CAS check in transitionDelegationStatus() uses this validated value.
    const initialStatus = delegation.status;
    this.transitionDelegationStatus(delegation, "cancelled", initialStatus);
  }

  public cancelDelegation(delegationId: string): Promise<void> {
    return this.cancel(delegationId);
  }

  /**
   * Marks a delegation as completed.
   * R9-06: When repository is available, fetch from repository if not in memory.
   *
   * @param delegationId - Delegation to complete
   * @param outputRef - Optional reference to output artifact
   */
  public async complete(delegationId: string, _outputRef?: string): Promise<void> {
    const delegation = this.requireDelegation(delegationId) ?? await this.getDelegation(delegationId);
    if (!delegation) {
      throw new ValidationError("delegation.not_found", `Delegation ${delegationId} not found`, { details: { delegationId } });
    }
    this.transitionDelegationStatus(delegation, "completed");
  }

  public completeDelegation(delegationId: string, outputRef?: string): Promise<void> {
    return this.complete(delegationId, outputRef);
  }

  public async completeWithEvidence(delegationId: string, evidence: readonly string[], outputRef?: string): Promise<void> {
    const delegation = this.requireDelegation(delegationId);
    const validation = this.collaborationProtocol.validateAndSend(
      this.collaborationProtocol.createMessage("completion_report", {
        correlation_id: delegationId,
        parent_run_id: delegationId,
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
        // Completion reports are validated against the platform delegation depth budget,
        // not against the child delegation's current depth as an exact ceiling.
        globalCallDepth: DEFAULT_MAX_DEPTH,
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
   * R9-06: When repository is available, fetch from repository if not in memory.
   *
   * @param delegationId - Delegation to fail
   * @param error - Error message
   */
  public async fail(delegationId: string, error: string): Promise<void> {
    const delegation = this.requireDelegation(delegationId) ?? await this.getDelegation(delegationId);
    if (!delegation) {
      throw new ValidationError("delegation.not_found", `Delegation ${delegationId} not found`, { details: { delegationId } });
    }
    this.transitionDelegationStatus(delegation, "failed");
    // R31-55 fix: Record failure in audit trail with error reason
    this.auditService.recordDelegationFailed({
      delegationId,
      parentAgentId: delegation.parentAgentId,
      childAgentId: delegation.childAgentId,
      error,
      actorId: delegation.parentAgentId,
      actorType: "agent",
    });
  }

  public async handleDelegationTimeout(delegationId: string): Promise<void> {
    const delegation = this.requireDelegation(delegationId) ?? await this.getDelegation(delegationId);
    if (!delegation) {
      throw new ValidationError("delegation.not_found", `Delegation ${delegationId} not found`, { details: { delegationId } });
    }
    this.transitionDelegationStatus(delegation, "timed_out");
  }

  public createDelegationContext(
    delegationId: string,
    overrides: Partial<AgentContext> = {},
  ): AgentContext {
    const delegation = this.requireDelegation(delegationId);

    // R17-05 fix: Re-verify parent permissions have not been revoked by checking expiration.
    // If the delegation has expired, permissions are stale and must not be used.
    const now = nowIso();
    if (delegation.expiresAt < now) {
      throw new ValidationError(
        "delegation.permissions_revoked",
        `Delegation ${delegationId} expired at ${delegation.expiresAt} - parent permissions have been revoked`,
        { details: { delegationId, expiredAt: delegation.expiresAt, currentTime: now } },
      );
    }

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
   * R9-06: When repository is available, query from repository instead of in-memory store.
   *
   * @param agentId - Root agent ID
   * @returns DelegationChain or null if not found
   */
  public async getDelegationChain(agentId: string): Promise<DelegationChain | null> {
    // R9-06: When repository is available, use it as the source of truth for chain data
    if (this.delegationRepository) {
      // R9-06: Find all delegations where this agent is the root (first in chain) or involved
      const activeStatuses: DelegationStatus[] = ["pending", "pending_approval", "active", "discovery", "bid", "awarded"];
      const allRecords: DelegationRecord[] = [];

      // Query by each active status and filter for chains containing this agent
      for (const status of activeStatuses) {
        const records = await this.delegationRepository.findByStatus(status);
        for (const record of records) {
          if (record.delegationChain.includes(agentId)) {
            allRecords.push(record);
          }
        }
      }

      if (allRecords.length > 0) {
        // R9-06: Reconstruct chain from repository records
        const chain: DelegationChain = {
          rootAgentId: agentId,
          nodes: [],
          maxDepthReached: 0,
          totalDelegations: 0,
        };
        for (const record of allRecords) {
          const node: DelegationChainNode = {
            delegationId: record.delegationId,
            agentId: record.childAgentId,
            packId: record.childAgentId,
            agentType: "worker",
            depth: record.depth,
            createdAt: record.createdAt,
            parentDelegationId: null,
            status: "active",
          };
          chain.nodes = [...chain.nodes, node];
          chain.maxDepthReached = Math.max(chain.maxDepthReached, record.depth);
          chain.totalDelegations++;
        }
        // R9-06: Cache in-memory for subsequent in-memory lookups
        this.chainStore.set(agentId, chain);
        return chain;
      }
      return null;
    }

    // Fallback to in-memory store when no repository available
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
   * R9-06: Falls back to repository if not found in memory (handles post-restart case).
   *
   * @param delegationId - Delegation ID
   */
  public async getDelegation(delegationId: string): Promise<DelegationResult | null> {
    // First check in-memory store
    const cached = this.delegationStore.get(delegationId);
    if (cached) {
      return cached;
    }

    // R9-06: Fall back to repository for delegations that survived restart
    if (this.delegationRepository) {
      const record = await this.delegationRepository.findById(delegationId);
      if (record) {
        // Reconstruct partial result from repository record
        const delegationResult: DelegationResult = {
          delegationId: record.delegationId,
          parentAgentId: record.parentAgentId,
          childAgentId: record.childAgentId,
          depth: record.depth,
          status: record.status,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt ?? nowIso(),
          permissions: { resources: [], actions: [], constraints: {} },
          grantedPermissions: { resources: [], actions: [], constraints: {} },
          correlationId: record.delegationId,
          artifact_refs: [],
          trust_level: 0,
          taint_labels: [],
          evidence_refs: [],
          policy_outcome: "delegation.from_repository",
          data_class: "delegation",
          summary: `Retrieved from repository: ${record.delegationId}`,
        };

        // Cache in memory for subsequent lookups
        this.delegationStore.set(delegationId, delegationResult);
        return delegationResult;
      }
    }

    return null;
  }

  /**
   * Gets all active delegations for an agent.
   * R9-06: Includes delegations from repository that may have survived restart.
   *
   * @param agentId - Agent ID
   */
  public async getActiveDelegations(agentId: string): Promise<DelegationResult[]> {
    const activeStatuses: DelegationStatus[] = ["pending", "pending_approval", "active"];

    // Get from in-memory store
    const inMemoryResults = [...this.delegationStore.values()].filter(
      (d) =>
        (d.parentAgentId === agentId || d.childAgentId === agentId) &&
        activeStatuses.includes(d.status),
    );

    // R9-06: Also fetch from repository and merge
    if (this.delegationRepository) {
      const repoDelegations = await this.delegationRepository.findByParentAgentId(agentId);
      for (const record of repoDelegations) {
        if (activeStatuses.includes(record.status)) {
          // Skip if already in memory
          if (this.delegationStore.has(record.delegationId)) {
            continue;
          }
          // Reconstruct and cache
          const delegationResult: DelegationResult = {
            delegationId: record.delegationId,
            parentAgentId: record.parentAgentId,
            childAgentId: record.childAgentId,
            depth: record.depth,
            status: record.status,
            createdAt: record.createdAt,
            expiresAt: record.expiresAt ?? nowIso(),
            permissions: { resources: [], actions: [], constraints: {} },
            grantedPermissions: { resources: [], actions: [], constraints: {} },
            correlationId: record.delegationId,
            artifact_refs: [],
            trust_level: 0,
            taint_labels: [],
            evidence_refs: [],
            policy_outcome: "delegation.from_repository",
            data_class: "delegation",
            summary: `Retrieved from repository: ${record.delegationId}`,
          };
          this.delegationStore.set(record.delegationId, delegationResult);
          inMemoryResults.push(delegationResult);
        }
      }
    }

    return inMemoryResults;
  }

  /**
   * §49: Scans all delegations and expires those past their expiresAt time.
   * Returns the count of expired delegations.
   * R9-06: When repository is available, query from repository for comprehensive scan.
   */
  public async revokeExpiredDelegations(): Promise<ExpirationScanResult> {
    const now = nowIso();
    const errors: string[] = [];
    let expired = 0;
    let scanned = 0;

    // R9-06: When repository is available, query all active delegations from repository
    // to ensure we catch all delegations including those not yet cached in memory
    if (this.delegationRepository) {
      const activeStatuses: DelegationStatus[] = ["pending", "pending_approval", "active"];

      // Query by each active status
      for (const status of activeStatuses) {
        const records = await this.delegationRepository.findByStatus(status);
        for (const record of records) {
          scanned++;
          if (record.expiresAt && record.expiresAt < now) {
            // R9-06: Try to get from in-memory store first, or reconstruct from record
            const delegation = this.delegationStore.get(record.delegationId);
            if (delegation) {
              try {
                this.transitionDelegationStatus(delegation, "expired");
                expired++;
              } catch (err) {
                errors.push(`Failed to expire delegation ${delegation.delegationId}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
          }
        }
      }
    } else {
      // Fallback to in-memory only when no repository
      for (const delegation of this.delegationStore.values()) {
        scanned++;
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
    }

    return {
      scanned,
      expired,
      errors,
    };
  }

  /**
   * §49: Gets all expired delegations that haven't been marked as expired yet.
   * Useful for auditing or cleanup verification.
   * R9-06: When repository is available, query from repository for comprehensive results.
   */
  public async getExpiredDelegations(): Promise<DelegationResult[]> {
    const now = nowIso();

    // R9-06: When repository is available, query from repository for comprehensive results
    if (this.delegationRepository) {
      const activeStatuses: DelegationStatus[] = ["pending", "pending_approval", "active"];
      const results: DelegationResult[] = [];

      // Query by each active status
      for (const status of activeStatuses) {
        const records = await this.delegationRepository.findByStatus(status);
        for (const record of records) {
          if (record.expiresAt && record.expiresAt < now) {
            // Try in-memory first
            const delegation = this.delegationStore.get(record.delegationId);
            if (delegation) {
              results.push(delegation);
            }
          }
        }
      }
      return results;
    }

    // Fallback to in-memory only when no repository
    return [...this.delegationStore.values()].filter(
      (d) =>
        (d.status === "pending" || d.status === "pending_approval" || d.status === "active") &&
        d.expiresAt < now,
    );
  }

  /**
   * §49: Gets the count of pending expirations (delegations past expiresAt but not yet processed).
   */
  public async getPendingExpirationCount(): Promise<number> {
    const expired = await this.getExpiredDelegations();
    return expired.length;
  }

  public validateCollaborationMessage(message: ACPMessage, context: InvariantContext): { accepted: boolean; violations: string[] } {
    return this.collaborationProtocol.validateAndSend(message, context);
  }

  public recordTakeoverNotice(message: ACPMessage, context: InvariantContext): { accepted: boolean; violations: string[] } {
    return this.collaborationProtocol.handleIncoming(message, context);
  }

  // ── Private Methods ───────────────────────────────────────────────────────

  private async validateTopology(parent: AgentContext, spec: DelegationSpec): Promise<void> {
    const rootAgentId = this.resolveRootAgentId(parent);
    const packEdges = await this.collectPackTopologyEdges(rootAgentId);
    const agentEdges = await this.collectAgentTopologyEdges(rootAgentId);
    const chainPackIds = [
      parent.packId,
      ...packEdges.flatMap((edge) => [edge.fromId, edge.toId]),
    ].filter((packId, index, items): packId is string => typeof packId === "string" && items.indexOf(packId) === index);
    const chainAgentIds = [
      parent.agentId,
      ...agentEdges.flatMap((edge) => [edge.fromId, edge.toId]),
    ].filter((agentId, index, items): agentId is string => typeof agentId === "string" && items.indexOf(agentId) === index);

    this.topologyValidator.validate({
      currentDepth: parent.delegationDepth,
      activeDelegations: parent.activeDelegations.length,
      targetPackId: spec.targetPackId,
      delegationChain: chainPackIds,
      sourcePackId: parent.packId,
      existingEdges: packEdges,
    });
    this.topologyValidator.validate({
      currentDepth: parent.delegationDepth,
      activeDelegations: parent.activeDelegations.length,
      targetPackId: spec.targetAgentId,
      delegationChain: chainAgentIds,
      sourcePackId: parent.agentId,
      existingEdges: agentEdges,
    });
  }

  private async collectPackTopologyEdges(rootAgentId: string): Promise<DelegationTopologyEdge[]> {
    const chain = this.chainStore.get(rootAgentId);
    if (chain && chain.nodes.length > 0) {
      const rootDelegation = chain.nodes.find((node) => node.parentDelegationId === null);
      const fallbackRootPackId = rootDelegation?.packId ?? rootAgentId;
      const nodeByDelegationId = new Map(chain.nodes.map((node) => [node.delegationId, node]));
      return chain.nodes
        .map((node) => {
          const parentPackId = node.parentDelegationId
            ? nodeByDelegationId.get(node.parentDelegationId)?.packId
            : fallbackRootPackId;
          if (parentPackId == null || node.packId == null) {
            return null;
          }
          return { fromId: parentPackId, toId: node.packId };
        })
        .filter((edge): edge is DelegationTopologyEdge => edge != null);
    }

    if (!this.delegationRepository) {
      return [];
    }

    const records = await this.getRepositoryActiveDelegationsForRoot(rootAgentId);
    return records.flatMap((record) => {
      const edges: DelegationTopologyEdge[] = [];
      for (let index = 0; index < record.delegationChain.length - 1; index += 1) {
        const fromId = record.delegationChain[index];
        const toId = record.delegationChain[index + 1];
        if (fromId && toId) {
          edges.push({ fromId, toId });
        }
      }
      return edges;
    });
  }

  private async collectAgentTopologyEdges(rootAgentId: string): Promise<DelegationTopologyEdge[]> {
    if (this.delegationRepository) {
      const records = await this.getRepositoryActiveDelegationsForRoot(rootAgentId);
      return records.map((record) => ({
        fromId: record.parentAgentId,
        toId: record.childAgentId,
      }));
    }

    const chain = this.chainStore.get(rootAgentId);
    if (!chain) {
      return [];
    }
    const nodeByDelegationId = new Map(chain.nodes.map((node) => [node.delegationId, node]));
    return chain.nodes
      .map((node) => {
        const parentAgentId = node.parentDelegationId
          ? nodeByDelegationId.get(node.parentDelegationId)?.agentId
          : rootAgentId;
        if (!parentAgentId) {
          return null;
        }
        return { fromId: parentAgentId, toId: node.agentId };
      })
      .filter((edge): edge is DelegationTopologyEdge => edge != null);
  }

  private async getRepositoryActiveDelegationsForRoot(rootAgentId: string): Promise<DelegationRecord[]> {
    if (!this.delegationRepository) {
      return [];
    }
    const activeStatuses: DelegationStatus[] = ["pending", "pending_approval", "active", "discovery", "bid", "awarded"];
    const recordsById = new Map<string, DelegationRecord>();
    for (const status of activeStatuses) {
      const records = await this.delegationRepository.findByStatus(status);
      for (const record of records) {
        if (record.delegationChain.includes(rootAgentId)) {
          recordsById.set(record.delegationId, record);
        }
      }
    }
    return [...recordsById.values()];
  }

  private narrowPermissions(
    parentPermissions: PermissionSet,
    requiredPermissions: PermissionSet,
  ): PermissionSet {
    // R9-07 fix: Always intersect child and parent permissions - child should never
    // receive more permissions than parent holds. This is true intersection logic.
    const allowedResources = parentPermissions.resources.filter((resource) =>
      requiredPermissions.resources.includes(resource),
    );
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
    // R9-07 fix: Always intersect - child should never get more actions than parent
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

  private async createDelegationRecord(
    parent: AgentContext,
    spec: DelegationSpec,
    permissions: PermissionSet,
  ): Promise<DelegationResult> {
    // C-11: Evict expired entries before creating new one
    this.evictExpired();

    const delegationId = newId("dlg");
    const now = nowIso();
    // R17-15: Enforce upper bound on timeout to prevent immortal delegations
    const MAX_DELEGATION_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const requestedTimeout = spec.timeout > 0 ? spec.timeout : this.defaultTimeout;
    const timeout = Math.min(requestedTimeout, MAX_DELEGATION_TIMEOUT_MS);
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
      summary: `Delegated ${spec.targetAgentType} work from ${parent.agentId} to ${spec.targetAgentId}`,
      artifact_refs: [],
      trust_level: Math.max(0, Number((1 - Math.min(parent.delegationDepth + 1, DEFAULT_MAX_DEPTH) / (DEFAULT_MAX_DEPTH + 1)).toFixed(2))),
      taint_labels: permissions.constraints.allowedDomains ?? [],
      evidence_refs: [],
      policy_outcome: "delegation.permissions_narrowed",
      data_class: spec.dataClass ?? "delegation",
    };

    // R9-06: Build the full delegation chain from root to this delegation
    // delegationChain stores [rootAgentId, ..., parentAgentId, childAgentId]
    // This enables getDelegationChain to find all delegations in a chain
    let delegationChain: readonly string[] = [delegation.parentAgentId, delegation.childAgentId];
    if (this.delegationRepository && parent.activeDelegations.length > 0) {
      // Find the parent's delegation to extend its chain
      const parentDelegationId = parent.activeDelegations.at(-1);
      if (parentDelegationId) {
        const parentDelegation = await this.delegationRepository.findById(parentDelegationId);
        if (parentDelegation && parentDelegation.delegationChain.length > 0) {
          // Extend parent's chain with new child
          delegationChain = [...parentDelegation.delegationChain, delegation.childAgentId];
        }
      }
    }

    // R9-06: When repository is available as primary store, write to repository first
    // then update in-memory cache. When no repository, use in-memory as primary store.
    if (this.delegationRepository) {
      await this.delegationRepository.create({
        delegationId: delegation.delegationId,
        parentAgentId: delegation.parentAgentId,
        childAgentId: delegation.childAgentId,
        delegationChain,
        depth: delegation.depth,
        expiresAt: delegation.expiresAt,
        status: delegation.status,
      });
    }

    // Always update in-memory cache after repository write (or as primary if no repository)
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
    fencingToken?: DelegationStatus,
  ): void {
    // R17-02: Use CAS (compare-and-swap) to prevent race conditions between
    // concurrent status transitions (e.g., cancel() + complete() racing).
    // Read current status and determine allowed transitions atomically.
    const currentStatus = fencingToken ?? delegation.status;
    const allowedStatuses = DelegationManagerService.ALLOWED_STATUS_TRANSITIONS[currentStatus];
    if (!allowedStatuses.includes(nextStatus)) {
      throw new ValidationError(
        "delegation.invalid_status_transition",
        `Delegation ${delegation.delegationId} cannot transition from ${currentStatus} to ${nextStatus}`,
        {
          details: {
            delegationId: delegation.delegationId,
            fromStatus: currentStatus,
            toStatus: nextStatus,
          },
        },
      );
    }
    // Re-check with the actual current status before writing (fencing)
    if (delegation.status !== currentStatus) {
      throw new ValidationError(
        "delegation.concurrent_modification",
        `Delegation ${delegation.delegationId} status changed during transition (expected ${currentStatus}, found ${delegation.status})`,
        {
          details: {
            delegationId: delegation.delegationId,
            expectedStatus: currentStatus,
            actualStatus: delegation.status,
          },
        },
      );
    }
    delegation.status = nextStatus;
    if (nextStatus === "completed") {
      delegation.completedAt = nowIso();
    }
    // R9-06: Update BOTH repository AND in-memory cache to keep them in sync
    // Repository is authoritative for persistence; in-memory cache must reflect current state
    if (this.delegationRepository) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.delegationRepository.updateStatus(delegation.delegationId, nextStatus);
    }
    // R9-06: For terminal states, remove from in-memory cache to prevent memory leaks.
    // Terminal delegations (completed/failed/cancelled/expired/timed_out) are persisted in repository
    // and can be fetched from repository if needed. This ensures the in-memory cache only holds active delegations.
    // IMPORTANT: Only delete from cache when repository is available as backup. Without repository,
    // in-memory delegations must be kept to prevent loss of delegation state.
    const terminalStatuses: readonly DelegationStatus[] = ["completed", "failed", "cancelled", "expired", "timed_out"];
    // R9-06: Always update cache with current state - cache is kept in sync with repository
    // for state queries. Delegations remain accessible in cache even after terminal state.
    this.delegationStore.set(delegation.delegationId, delegation);
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
      status: "active",
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
  options?: DelegationManagerOptions,
  delegationRepository?: DelegationRepository,
  eventRepository?: DelegationEventRepository,
): DelegationManagerService {
  return new DelegationManagerService(options, delegationRepository, eventRepository);
}

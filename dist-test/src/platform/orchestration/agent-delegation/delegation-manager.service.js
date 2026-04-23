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
import { createTopologyValidator, DEFAULT_MAX_DEPTH, } from "./topology-validator.js";
import { CollaborationProtocolService } from "./collaboration-protocol/index.js";
// ─────────────────────────────────────────────────────────────────────────────
// Delegation Manager Service
// ─────────────────────────────────────────────────────────────────────────────
export class DelegationManagerService {
    topologyValidator;
    collaborationProtocol;
    defaultTimeout;
    delegationStore;
    chainStore;
    // C-11: TTL-based eviction to prevent memory leaks
    MAX_ENTRIES = 1000;
    ENTRY_TTL_MS = 60 * 60 * 1000; // 1 hour
    lastEvictionTime = 0;
    EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute
    constructor(options = {}) {
        const config = {
            maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
            maxFanout: options.maxFanout ?? 10,
            ...(options.allowedPackIds ? { allowedPackIds: options.allowedPackIds } : {}),
        };
        this.topologyValidator = createTopologyValidator(config);
        this.collaborationProtocol = new CollaborationProtocolService();
        this.defaultTimeout = options.defaultTimeout ?? 300000; // 5 minutes
        this.delegationStore = new Map();
        this.chainStore = new Map();
    }
    /**
     * C-11: Evict expired delegation entries to prevent memory leaks.
     */
    evictExpired() {
        const now = Date.now();
        if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
            return;
        }
        this.lastEvictionTime = now;
        const expiryThreshold = now - this.ENTRY_TTL_MS;
        const entriesToDelete = [];
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
                const key = sortedEntries[i][0];
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
    async delegate(parent, spec) {
        // Step 1: Topology validation
        this.validateTopology(parent, spec);
        // Step 2: Permission narrowing
        const narrowedPermissions = this.narrowPermissions(parent.permissions, spec.requiredPermissions);
        // Step 3: Create isolated child context
        const childContext = this.createIsolatedContext(parent, narrowedPermissions, spec);
        // Step 4: Create delegation record
        const delegationResult = await this.createDelegationRecord(parent, spec, narrowedPermissions);
        // Step 5: Update delegation chain
        this.updateDelegationChain(parent.agentId, spec, delegationResult);
        // Step 6: Return handle (actual dispatch would be handled by caller/dispatch engine)
        return this.createHandle(delegationResult, parent.correlationId);
    }
    /**
     * Cancels an active delegation.
     *
     * @param delegationId - Delegation to cancel
     */
    async cancel(delegationId) {
        const delegation = this.delegationStore.get(delegationId);
        if (!delegation) {
            throw new ValidationError("delegation.not_found", `Delegation ${delegationId} not found`, { details: { delegationId } });
        }
        if (delegation.status !== "pending" && delegation.status !== "active") {
            throw new ValidationError("delegation.cannot_cancel", `Delegation ${delegationId} cannot be cancelled (status: ${delegation.status})`, { details: { delegationId, status: delegation.status } });
        }
        delegation.status = "cancelled";
    }
    /**
     * Marks a delegation as completed.
     *
     * @param delegationId - Delegation to complete
     * @param outputRef - Optional reference to output artifact
     */
    async complete(delegationId, _outputRef) {
        const delegation = this.requireDelegation(delegationId);
        delegation.status = "completed";
    }
    async completeWithEvidence(delegationId, evidence, outputRef) {
        const delegation = this.requireDelegation(delegationId);
        const validation = this.collaborationProtocol.validateAndSend(this.collaborationProtocol.createMessage("completion_report", {
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
        }), {
            parentPermissions: delegation.permissions,
            parentRiskMode: 100,
            parentConstraints: delegation.permissions.constraints,
            parentBudgetRemaining: Number.MAX_SAFE_INTEGER,
            globalCallDepth: delegation.depth,
        });
        if (!validation.accepted) {
            throw new ValidationError("delegation.invalid_completion_report", "Completion report failed ACP validation", {
                details: { delegationId, violations: validation.violations },
            });
        }
        await this.complete(delegationId, outputRef);
    }
    /**
     * Marks a delegation as failed.
     *
     * @param delegationId - Delegation to fail
     * @param error - Error message
     */
    async fail(delegationId, _error) {
        const delegation = this.requireDelegation(delegationId);
        delegation.status = "failed";
    }
    /**
     * Gets the delegation chain for an agent.
     *
     * @param agentId - Root agent ID
     * @returns DelegationChain or null if not found
     */
    getDelegationChain(agentId) {
        return this.chainStore.get(agentId) ?? null;
    }
    /**
     * Gets a delegation by ID.
     *
     * @param delegationId - Delegation ID
     */
    getDelegation(delegationId) {
        return this.delegationStore.get(delegationId) ?? null;
    }
    /**
     * Gets all active delegations for an agent.
     *
     * @param agentId - Agent ID
     */
    getActiveDelegations(agentId) {
        return [...this.delegationStore.values()].filter((d) => (d.parentAgentId === agentId || d.childAgentId === agentId) &&
            (d.status === "pending" || d.status === "active"));
    }
    /**
     * §49: Scans all delegations and expires those past their expiresAt time.
     * Returns the count of expired delegations.
     */
    revokeExpiredDelegations() {
        const now = nowIso();
        const errors = [];
        let expired = 0;
        for (const delegation of this.delegationStore.values()) {
            if (delegation.status === "pending" || delegation.status === "active") {
                if (delegation.expiresAt < now) {
                    try {
                        delegation.status = "expired";
                        expired++;
                    }
                    catch (err) {
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
    getExpiredDelegations() {
        const now = nowIso();
        return [...this.delegationStore.values()].filter((d) => (d.status === "pending" || d.status === "active") &&
            d.expiresAt < now);
    }
    /**
     * §49: Gets the count of pending expirations (delegations past expiresAt but not yet processed).
     */
    getPendingExpirationCount() {
        return this.getExpiredDelegations().length;
    }
    validateCollaborationMessage(message, context) {
        return this.collaborationProtocol.validateAndSend(message, context);
    }
    recordTakeoverNotice(message, context) {
        return this.collaborationProtocol.handleIncoming(message, context);
    }
    // ── Private Methods ───────────────────────────────────────────────────────
    validateTopology(parent, spec) {
        // Get the delegation chain for cycle detection
        const chain = this.getDelegationChain(parent.agentId);
        const chainPackIds = [
            parent.packId,
            ...(chain?.nodes.map((n) => n.packId) ?? []),
        ].filter((packId) => typeof packId === "string");
        this.topologyValidator.validate({
            currentDepth: parent.delegationDepth,
            activeDelegations: parent.activeDelegations.length,
            targetPackId: spec.targetPackId,
            delegationChain: chainPackIds,
        });
    }
    narrowPermissions(parentPermissions, requiredPermissions) {
        return {
            resources: requiredPermissions.resources.length > 0
                ? requiredPermissions.resources
                : parentPermissions.resources,
            actions: this.intersectActions(parentPermissions.actions, requiredPermissions.actions),
            constraints: {
                ...parentPermissions.constraints,
                ...requiredPermissions.constraints,
                // Take more restrictive values
                maxDurationMs: Math.min(parentPermissions.constraints.maxDurationMs ?? Infinity, requiredPermissions.constraints.maxDurationMs ?? Infinity),
                maxTokens: Math.min(parentPermissions.constraints.maxTokens ?? Infinity, requiredPermissions.constraints.maxTokens ?? Infinity),
            },
        };
    }
    intersectActions(parentActions, childActions) {
        if (childActions.length === 0) {
            return [...parentActions];
        }
        return parentActions.filter((action) => childActions.includes(action));
    }
    createIsolatedContext(parent, permissions, spec) {
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
    async createDelegationRecord(parent, spec, permissions) {
        // C-11: Evict expired entries before creating new one
        this.evictExpired();
        const delegationId = newId("dlg");
        const now = nowIso();
        const timeout = spec.timeout > 0 ? spec.timeout : this.defaultTimeout;
        const expiresAt = new Date(Date.now() + timeout).toISOString();
        const delegation = {
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
    requireDelegation(delegationId) {
        const delegation = this.delegationStore.get(delegationId);
        if (!delegation) {
            throw new ValidationError("delegation.not_found", `Delegation ${delegationId} not found`, { details: { delegationId } });
        }
        return delegation;
    }
    updateDelegationChain(rootAgentId, spec, delegation) {
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
        const node = {
            delegationId: delegation.delegationId,
            agentId: delegation.childAgentId,
            packId: spec.targetPackId,
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
    createHandle(delegation, correlationId) {
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
export function createDelegationManager(options) {
    return new DelegationManagerService(options);
}
//# sourceMappingURL=delegation-manager.service.js.map
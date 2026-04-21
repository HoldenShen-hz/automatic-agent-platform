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
import type { AgentContext, DelegationSpec, DelegationResult, DelegationHandle, DelegationChain, DelegationOptions } from "./delegation-types.js";
export interface DelegationExpirationConfig {
    checkIntervalMs?: number;
    batchSize?: number;
}
export interface ExpirationScanResult {
    scanned: number;
    expired: number;
    errors: readonly string[];
}
export declare class DelegationManagerService {
    private readonly topologyValidator;
    private readonly defaultTimeout;
    private readonly delegationStore;
    private readonly chainStore;
    constructor(options?: DelegationOptions);
    /**
     * Creates a new delegation from parent agent to child agent.
     *
     * @param parent - Parent agent context
     * @param spec - Delegation specification
     * @returns DelegationHandle for tracking the delegation
     * @throws DelegationDepthExceededError | DelegationFanoutExceededError | DelegationCycleDetectedError
     */
    delegate(parent: AgentContext, spec: DelegationSpec): Promise<DelegationHandle>;
    /**
     * Cancels an active delegation.
     *
     * @param delegationId - Delegation to cancel
     */
    cancel(delegationId: string): Promise<void>;
    /**
     * Marks a delegation as completed.
     *
     * @param delegationId - Delegation to complete
     * @param outputRef - Optional reference to output artifact
     */
    complete(delegationId: string, _outputRef?: string): Promise<void>;
    /**
     * Marks a delegation as failed.
     *
     * @param delegationId - Delegation to fail
     * @param error - Error message
     */
    fail(delegationId: string, _error: string): Promise<void>;
    /**
     * Gets the delegation chain for an agent.
     *
     * @param agentId - Root agent ID
     * @returns DelegationChain or null if not found
     */
    getDelegationChain(agentId: string): DelegationChain | null;
    /**
     * Gets a delegation by ID.
     *
     * @param delegationId - Delegation ID
     */
    getDelegation(delegationId: string): DelegationResult | null;
    /**
     * Gets all active delegations for an agent.
     *
     * @param agentId - Agent ID
     */
    getActiveDelegations(agentId: string): DelegationResult[];
    /**
     * §49: Scans all delegations and expires those past their expiresAt time.
     * Returns the count of expired delegations.
     */
    revokeExpiredDelegations(): ExpirationScanResult;
    /**
     * §49: Gets all expired delegations that haven't been marked as expired yet.
     * Useful for auditing or cleanup verification.
     */
    getExpiredDelegations(): DelegationResult[];
    /**
     * §49: Gets the count of pending expirations (delegations past expiresAt but not yet processed).
     */
    getPendingExpirationCount(): number;
    private validateTopology;
    private narrowPermissions;
    private intersectActions;
    private createIsolatedContext;
    private createDelegationRecord;
    private updateDelegationChain;
    private createHandle;
}
export declare function createDelegationManager(options?: DelegationOptions): DelegationManagerService;

/**
 * Agent Delegation - Delegation Tracker
 *
 * Tracks delegation chains and provides visualization data structures.
 * Maintains parent-child relationships and provides queries for
 * delegation chain analysis.
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */
import type { DelegationChain, DelegationResult, DelegationEvent } from "./delegation-types.js";
export interface DelegationTreeNode {
    delegationId: string;
    agentId: string;
    agentType: string;
    depth: number;
    status: string;
    createdAt: string;
    children: DelegationTreeNode[];
    metrics: DelegationMetrics;
}
export interface DelegationMetrics {
    totalDelegations: number;
    maxDepth: number;
    activeCount: number;
    completedCount: number;
    failedCount: number;
    averageDurationMs: number;
}
export declare class DelegationTracker {
    private readonly rootToChain;
    private readonly delegationToParent;
    private readonly delegationEvents;
    private readonly MAX_ENTRIES;
    private readonly ENTRY_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    /**
     * C-11: Evict expired delegation entries to prevent memory leaks.
     */
    private evictExpired;
    /**
     * Records a new delegation in the tracker.
     *
     * @param delegation - The delegation result
     * @param parentAgentId - Parent agent ID for chain building
     */
    recordDelegation(delegation: DelegationResult, parentAgentId: string): void;
    /**
     * Records a delegation event.
     *
     * @param delegationId - Delegation ID
     * @param event - Event to record
     */
    recordEvent(delegationId: string, event: DelegationEvent): void;
    /**
     * Gets the delegation chain for a root agent.
     *
     * @param rootAgentId - Root agent ID
     * @returns Delegation chain or null
     */
    getChain(rootAgentId: string): DelegationChain | null;
    /**
     * Gets the delegation chain as a tree structure for visualization.
     *
     * @param rootAgentId - Root agent ID
     * @returns Tree structure or null
     */
    getTree(rootAgentId: string): DelegationTreeNode | null;
    /**
     * Gets all events for a delegation.
     *
     * @param delegationId - Delegation ID
     * @returns List of events
     */
    getEvents(delegationId: string): DelegationEvent[];
    /**
     * Gets the parent delegation ID for a given delegation.
     *
     * @param delegationId - Delegation ID
     * @returns Parent delegation ID or null
     */
    getParentDelegationId(delegationId: string): string | null;
    /**
     * Gets metrics for a root agent's delegation chain.
     *
     * @param rootAgentId - Root agent ID
     * @returns Delegation metrics
     */
    getMetrics(rootAgentId: string): DelegationMetrics;
    /**
     * Finds the parent delegation ID based on depth.
     */
    private findParentDelegationId;
}
export declare function createDelegationTracker(): DelegationTracker;

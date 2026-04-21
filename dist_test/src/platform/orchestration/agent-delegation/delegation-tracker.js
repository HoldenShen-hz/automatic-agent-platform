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
// ─────────────────────────────────────────────────────────────────────────────
// Delegation Tracker
// ─────────────────────────────────────────────────────────────────────────────
export class DelegationTracker {
    rootToChain = new Map();
    delegationToParent = new Map();
    delegationEvents = new Map();
    /**
     * Records a new delegation in the tracker.
     *
     * @param delegation - The delegation result
     * @param parentAgentId - Parent agent ID for chain building
     */
    recordDelegation(delegation, parentAgentId) {
        // Build chain for root agent
        let chain = this.rootToChain.get(parentAgentId);
        if (!chain) {
            chain = {
                rootAgentId: parentAgentId,
                nodes: [],
                maxDepthReached: 0,
                totalDelegations: 0,
            };
            this.rootToChain.set(parentAgentId, chain);
        }
        // Add node to chain
        const node = {
            delegationId: delegation.delegationId,
            agentId: delegation.childAgentId,
            agentType: "", // Would be filled from delegation spec
            depth: delegation.depth,
            createdAt: delegation.createdAt,
            parentDelegationId: this.findParentDelegationId(parentAgentId, delegation.depth),
        };
        chain.nodes = [...chain.nodes, node];
        chain.maxDepthReached = Math.max(chain.maxDepthReached, delegation.depth);
        chain.totalDelegations++;
        // Record parent relationship
        this.delegationToParent.set(delegation.delegationId, parentAgentId);
    }
    /**
     * Records a delegation event.
     *
     * @param delegationId - Delegation ID
     * @param event - Event to record
     */
    recordEvent(delegationId, event) {
        const events = this.delegationEvents.get(delegationId) ?? [];
        this.delegationEvents.set(delegationId, [...events, event]);
    }
    /**
     * Gets the delegation chain for a root agent.
     *
     * @param rootAgentId - Root agent ID
     * @returns Delegation chain or null
     */
    getChain(rootAgentId) {
        return this.rootToChain.get(rootAgentId) ?? null;
    }
    /**
     * Gets the delegation chain as a tree structure for visualization.
     *
     * @param rootAgentId - Root agent ID
     * @returns Tree structure or null
     */
    getTree(rootAgentId) {
        const chain = this.rootToChain.get(rootAgentId);
        if (!chain)
            return null;
        const nodeMap = new Map();
        // First pass: create nodes
        for (const node of chain.nodes) {
            nodeMap.set(node.delegationId, {
                delegationId: node.delegationId,
                agentId: node.agentId,
                agentType: node.agentType,
                depth: node.depth,
                status: "active", // Would be from delegation status
                createdAt: node.createdAt,
                children: [],
                metrics: { totalDelegations: 0, maxDepth: 0, activeCount: 0, completedCount: 0, failedCount: 0, averageDurationMs: 0 },
            });
        }
        // Second pass: build tree
        for (const node of chain.nodes) {
            const treeNode = nodeMap.get(node.delegationId);
            if (node.parentDelegationId) {
                const parent = nodeMap.get(node.parentDelegationId);
                if (parent) {
                    parent.children.push(treeNode);
                }
            }
        }
        // Return root node (first node in chain)
        if (chain.nodes.length === 0)
            return null;
        const firstNode = chain.nodes[0];
        if (!firstNode)
            return null;
        return nodeMap.get(firstNode.delegationId) ?? null;
    }
    /**
     * Gets all events for a delegation.
     *
     * @param delegationId - Delegation ID
     * @returns List of events
     */
    getEvents(delegationId) {
        return this.delegationEvents.get(delegationId) ?? [];
    }
    /**
     * Gets the parent delegation ID for a given delegation.
     *
     * @param delegationId - Delegation ID
     * @returns Parent delegation ID or null
     */
    getParentDelegationId(delegationId) {
        // Walk up the chain
        let current = delegationId;
        const visited = new Set();
        while (current && !visited.has(current)) {
            visited.add(current);
            const parent = this.delegationToParent.get(current);
            if (parent) {
                // Find the delegation that has this as child
                for (const [dlgId, parentId] of this.delegationToParent.entries()) {
                    if (parentId === parent && dlgId !== delegationId) {
                        return dlgId;
                    }
                }
            }
            current = parent;
        }
        return null;
    }
    /**
     * Gets metrics for a root agent's delegation chain.
     *
     * @param rootAgentId - Root agent ID
     * @returns Delegation metrics
     */
    getMetrics(rootAgentId) {
        const chain = this.rootToChain.get(rootAgentId);
        if (!chain) {
            return {
                totalDelegations: 0,
                maxDepth: 0,
                activeCount: 0,
                completedCount: 0,
                failedCount: 0,
                averageDurationMs: 0,
            };
        }
        let activeCount = 0;
        let completedCount = 0;
        let failedCount = 0;
        let totalDuration = 0;
        let durationCount = 0;
        // This would normally come from delegation store
        // For now, return derived metrics from chain
        for (const node of chain.nodes) {
            // Would query delegation store for status
            // Using placeholder counts
            activeCount++;
        }
        return {
            totalDelegations: chain.totalDelegations,
            maxDepth: chain.maxDepthReached,
            activeCount,
            completedCount,
            failedCount,
            averageDurationMs: durationCount > 0 ? totalDuration / durationCount : 0,
        };
    }
    /**
     * Finds the parent delegation ID based on depth.
     */
    findParentDelegationId(rootAgentId, childDepth) {
        const chain = this.rootToChain.get(rootAgentId);
        if (!chain || childDepth <= 1)
            return null;
        // Find delegation at depth - 1
        for (const node of chain.nodes) {
            if (node.depth === childDepth - 1) {
                return node.delegationId;
            }
        }
        return null;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createDelegationTracker() {
    return new DelegationTracker();
}
//# sourceMappingURL=delegation-tracker.js.map
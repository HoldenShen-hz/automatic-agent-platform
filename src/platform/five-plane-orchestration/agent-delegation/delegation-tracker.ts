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

import type {
  DelegationChain,
  DelegationChainNode,
  DelegationResult,
  DelegationEvent,
} from "./delegation-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Tree Node (for visualization)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Tracker
// ─────────────────────────────────────────────────────────────────────────────

export class DelegationTracker {
  private readonly rootToChain: Map<string, DelegationChain> = new Map();
  private readonly delegationToParent: Map<string, string> = new Map();
  private readonly delegationEvents: Map<string, DelegationEvent[]> = new Map();
  // C-11: TTL-based eviction to prevent memory leaks
  private readonly MAX_ENTRIES = 1000;
  private readonly ENTRY_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

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

    // Find expired rootToChain entries
    for (const [key, chain] of this.rootToChain) {
      if (chain.nodes.length > 0) {
        const lastNodeTime = new Date(chain.nodes[chain.nodes.length - 1]!.createdAt).getTime();
        if (lastNodeTime < expiryThreshold) {
          entriesToDelete.push(key);
        }
      }
    }

    for (const key of entriesToDelete) {
      this.rootToChain.delete(key);
      this.delegationToParent.delete(key);
      this.delegationEvents.delete(key);
    }

    // If still over capacity, remove oldest entries
    if (this.rootToChain.size > this.MAX_ENTRIES) {
      const sortedEntries = [...this.rootToChain.entries()].sort((a, b) => {
        const aTime = a[1].nodes.length > 0
          ? new Date(a[1].nodes[a[1].nodes.length - 1]!.createdAt).getTime()
          : 0;
        const bTime = b[1].nodes.length > 0
          ? new Date(b[1].nodes[b[1].nodes.length - 1]!.createdAt).getTime()
          : 0;
        return aTime - bTime;
      });

      const toRemove = this.rootToChain.size - this.MAX_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        const key = sortedEntries[i]![0];
        this.rootToChain.delete(key);
        this.delegationToParent.delete(key);
        this.delegationEvents.delete(key);
      }
    }
  }

  /**
   * Records a new delegation in the tracker.
   *
   * @param delegation - The delegation result
   * @param parentAgentId - Parent agent ID for chain building
   */
  public recordDelegation(delegation: DelegationResult, parentAgentId: string): void {
    // C-11: Evict expired entries before recording new one
    this.evictExpired();

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
    const node: DelegationChainNode = {
      delegationId: delegation.delegationId,
      agentId: delegation.childAgentId,
      agentType: "", // Would be filled from delegation spec
      depth: delegation.depth,
      createdAt: delegation.createdAt,
      parentDelegationId: this.findParentDelegationId(parentAgentId, delegation.depth),
      status: delegation.status,
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
  public recordEvent(delegationId: string, event: DelegationEvent): void {
    // C-11: Evict expired entries before recording new event
    this.evictExpired();

    const events = this.delegationEvents.get(delegationId) ?? [];
    this.delegationEvents.set(delegationId, [...events, event]);
  }

  /**
   * Gets the delegation chain for a root agent.
   *
   * @param rootAgentId - Root agent ID
   * @returns Delegation chain or null
   */
  public getChain(rootAgentId: string): DelegationChain | null {
    return this.rootToChain.get(rootAgentId) ?? null;
  }

  /**
   * Gets the delegation chain as a tree structure for visualization.
   *
   * @param rootAgentId - Root agent ID
   * @returns Tree structure or null
   */
  public getTree(rootAgentId: string): DelegationTreeNode | null {
    const chain = this.rootToChain.get(rootAgentId);
    if (!chain) return null;

    const nodeMap = new Map<string, DelegationTreeNode>();

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
      const treeNode = nodeMap.get(node.delegationId)!;
      if (node.parentDelegationId) {
        const parent = nodeMap.get(node.parentDelegationId);
        if (parent) {
          parent.children.push(treeNode);
        }
      }
    }

    // Return root node (first node in chain)
    if (chain.nodes.length === 0) return null;
    const firstNode = chain.nodes[0];
    if (!firstNode) return null;
    return nodeMap.get(firstNode.delegationId) ?? null;
  }

  /**
   * Gets all events for a delegation.
   *
   * @param delegationId - Delegation ID
   * @returns List of events
   */
  public getEvents(delegationId: string): DelegationEvent[] {
    return this.delegationEvents.get(delegationId) ?? [];
  }

  /**
   * Gets the parent delegation ID for a given delegation.
   *
   * @param delegationId - Delegation ID
   * @returns Parent delegation ID or null
   */
  public getParentDelegationId(delegationId: string): string | null {
    // Walk up the chain
    let current: string | undefined = delegationId;
    const visited = new Set<string>();

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
  public getMetrics(rootAgentId: string): DelegationMetrics {
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

    // Count nodes by status
    for (const node of chain.nodes) {
      switch (node.status) {
        case "completed":
          completedCount++;
          break;
        case "failed":
        case "cancelled":
        case "expired":
        case "timed_out":
          failedCount++;
          break;
        default:
          activeCount++;
          break;
      }
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
  private findParentDelegationId(rootAgentId: string, childDepth: number): string | null {
    const chain = this.rootToChain.get(rootAgentId);
    if (!chain || childDepth <= 1) return null;

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

export function createDelegationTracker(): DelegationTracker {
  return new DelegationTracker();
}

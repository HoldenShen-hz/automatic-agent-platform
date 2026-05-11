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

export interface RecordDelegationOptions {
  rootAgentId?: string;
  parentDelegationId?: string | null;
  agentType?: string;
  packId?: string;
  status?: DelegationChainNode["status"];
}

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Tracker
// ─────────────────────────────────────────────────────────────────────────────

export class DelegationTracker {
  private readonly rootToChain: Map<string, DelegationChain> = new Map();
  private readonly delegationToRoot: Map<string, string> = new Map();
  private readonly delegationToParentDelegation: Map<string, string | null> = new Map();
  private readonly delegationNodeIndex: Map<string, DelegationChainNode> = new Map();
  private readonly delegationDurations: Map<string, number> = new Map();
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
      const chain = this.rootToChain.get(key);
      if (chain) {
        for (const node of chain.nodes) {
          this.delegationToRoot.delete(node.delegationId);
          this.delegationToParentDelegation.delete(node.delegationId);
          this.delegationNodeIndex.delete(node.delegationId);
          this.delegationDurations.delete(node.delegationId);
          this.delegationEvents.delete(node.delegationId);
        }
      }
      this.rootToChain.delete(key);
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
        const chain = this.rootToChain.get(key);
        if (chain) {
          for (const node of chain.nodes) {
            this.delegationToRoot.delete(node.delegationId);
            this.delegationToParentDelegation.delete(node.delegationId);
            this.delegationNodeIndex.delete(node.delegationId);
            this.delegationDurations.delete(node.delegationId);
            this.delegationEvents.delete(node.delegationId);
          }
        }
        this.rootToChain.delete(key);
      }
    }
  }

  /**
   * Records a new delegation in the tracker.
   *
   * @param delegation - The delegation result
   * @param parentAgentId - Parent agent ID for chain building
   */
  public recordDelegation(
    delegation: DelegationResult,
    parentAgentId: string,
    options: RecordDelegationOptions = {},
  ): void {
    // C-11: Evict expired entries before recording new one
    this.evictExpired();

    // Build chain for root agent
    const rootAgentId = options.rootAgentId ?? parentAgentId;
    let chain = this.rootToChain.get(rootAgentId);
    if (!chain) {
      chain = {
        rootAgentId,
        nodes: [],
        maxDepthReached: 0,
        totalDelegations: 0,
      };
      this.rootToChain.set(rootAgentId, chain);
    }

    // Add node to chain
    const node: DelegationChainNode = {
      delegationId: delegation.delegationId,
      agentId: delegation.childAgentId,
      packId: options.packId,
      agentType: options.agentType ?? "agent",
      depth: delegation.depth,
      createdAt: delegation.createdAt,
      parentDelegationId: options.parentDelegationId ?? this.findParentDelegationId(rootAgentId, delegation.depth),
      status: options.status ?? delegation.status,
    };

    const existingIndex = chain.nodes.findIndex((existingNode) => existingNode.delegationId === delegation.delegationId);
    if (existingIndex >= 0) {
      chain.nodes = chain.nodes.map((existingNode) =>
        existingNode.delegationId === delegation.delegationId ? node : existingNode
      );
    } else {
      chain.nodes = [...chain.nodes, node];
      chain.totalDelegations++;
    }
    chain.maxDepthReached = Math.max(chain.maxDepthReached, delegation.depth);
    this.rootToChain.set(rootAgentId, chain);

    this.delegationToRoot.set(delegation.delegationId, rootAgentId);
    this.delegationToParentDelegation.set(delegation.delegationId, node.parentDelegationId);
    this.delegationNodeIndex.set(delegation.delegationId, node);
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

    if (event.eventType === "delegation.completed") {
      this.delegationDurations.set(delegationId, event.durationMs);
      this.updateStatus(delegationId, "completed", event.timestamp);
      return;
    }

    if (event.eventType === "delegation.failed") {
      this.updateStatus(delegationId, "failed", event.timestamp);
    }
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
        status: node.status ?? "active",
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
    return this.delegationToParentDelegation.get(delegationId) ?? null;
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

    for (const node of chain.nodes) {
      const status = node.status ?? "active";
      if (status === "completed") {
        completedCount++;
      } else if (status === "failed" || status === "cancelled" || status === "expired" || status === "timed_out") {
        failedCount++;
      } else {
        activeCount++;
      }

      const duration = this.delegationDurations.get(node.delegationId);
      if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0) {
        totalDuration += duration;
        durationCount++;
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

    for (let i = chain.nodes.length - 1; i >= 0; i -= 1) {
      const node = chain.nodes[i];
      if (node && node.depth === childDepth - 1) {
        return node.delegationId;
      }
    }

    return null;
  }

  public updateStatus(
    delegationId: string,
    status: NonNullable<DelegationChainNode["status"]>,
    transitionedAt?: string,
  ): void {
    const rootAgentId = this.delegationToRoot.get(delegationId);
    const chain = rootAgentId ? this.rootToChain.get(rootAgentId) : null;
    if (!rootAgentId || !chain) {
      return;
    }

    chain.nodes = chain.nodes.map((node) => {
      if (node.delegationId !== delegationId) {
        return node;
      }

      const updatedNode: DelegationChainNode = {
        ...node,
        status,
      };
      this.delegationNodeIndex.set(delegationId, updatedNode);

      if (!this.delegationDurations.has(delegationId) && transitionedAt) {
        const startedAtMs = Date.parse(node.createdAt);
        const endedAtMs = Date.parse(transitionedAt);
        if (Number.isFinite(startedAtMs) && Number.isFinite(endedAtMs) && endedAtMs >= startedAtMs) {
          this.delegationDurations.set(delegationId, endedAtMs - startedAtMs);
        }
      }

      return updatedNode;
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createDelegationTracker(): DelegationTracker {
  return new DelegationTracker();
}

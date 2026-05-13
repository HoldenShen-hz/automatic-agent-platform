/**
 * Read Replica Service
 *
 * Implements read/write splitting, read replica routing, and read-after-write consistency
 * for multi-region deployments. Based on §52.3 partition leader / follower model.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52.3
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";

const replicaLogger = new StructuredLogger({ retentionLimit: 200 });

/**
 * Read replica routing modes
 */
export type ReadRoutingMode = "nearest" | "any_healthy" | "primary_only";

/**
 * Read consistency levels
 */
export type ReadConsistencyLevel = "eventual" | "session" | "strong";

/**
 * Replica health status
 */
export type ReplicaHealthStatus = "healthy" | "lagging" | "unhealthy" | "unknown";

/**
 * Read replica descriptor
 */
export interface ReadReplica {
  readonly replicaId: string;
  readonly regionId: string;
  readonly endpoint: string;
  readonly isPrimary: boolean;
  readonly latencyMs: number;
  readonly healthStatus: ReplicaHealthStatus;
  readonly lagMs: number | null;
  readonly lastHealthCheck: string;
}

/**
 * Read replica configuration
 */
export interface ReadReplicaConfig {
  readonly replicaId: string;
  readonly regionId: string;
  readonly endpoint: string;
  readonly isPrimary: boolean;
  readonly priority: number;
  readonly maxLagMs: number;
  readonly healthCheckIntervalMs: number;
}

/**
 * Read routing request
 */
export interface ReadRoutingRequest {
  readonly operationId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly consistencyLevel: ReadConsistencyLevel;
  readonly routingMode: ReadRoutingMode;
  readonly preferredRegionId?: string | null;
  readonly bypassCache?: boolean;
}

/**
 * Read routing decision
 */
export interface ReadRoutingDecision {
  readonly operationId: string;
  readonly selectedReplicaId: string | null;
  readonly selectedRegionId: string | null;
  readonly isPrimaryRoute: boolean;
  readonly consistencyLevel: ReadConsistencyLevel;
  readonly estimatedLatencyMs: number | null;
  readonly waitForReplication: boolean;
  readonly auditTrail: readonly string[];
}

/**
 * Read-after-write tracking entry
 */
interface PendingReadEntry {
  readonly operationId: string;
  readonly aggregateId: string;
  readonly writeSequence: number;
  readonly targetRegionIds: readonly string[];
  readonly createdAt: string;
  readonly expiresAt: string;
}

/**
 * Read Replica Service
 *
 * Handles:
 * - Read/write splitting: writes go to primary, reads can go to replicas
 * - Read replica routing: selects best replica based on latency/health/lag
 * - Read-after-write consistency: waits for replication before serving reads
 */
export class ReadReplicaService {
  private readonly configs = new Map<string, ReadReplicaConfig>();
  private readonly replicas = new Map<string, ReadReplica>();
  private readonly primaryRegionId: string;
  private readonly pendingReads = new Map<string, PendingReadEntry>();

  public constructor(primaryRegionId: string) {
    this.primaryRegionId = primaryRegionId;
  }

  /**
   * Register a replica (primary or follower)
   */
  public registerReplica(config: ReadReplicaConfig): void {
    this.configs.set(config.replicaId, config);
    this.replicas.set(config.replicaId, {
      replicaId: config.replicaId,
      regionId: config.regionId,
      endpoint: config.endpoint,
      isPrimary: config.isPrimary,
      latencyMs: 0,
      healthStatus: "unknown",
      lagMs: null,
      lastHealthCheck: nowIso(),
    });
  }

  /**
   * Unregister a replica
   */
  public unregisterReplica(replicaId: string): void {
    this.configs.delete(replicaId);
    this.replicas.delete(replicaId);
  }

  /**
   * Get all registered replicas
   */
  public getReplicas(): readonly ReadReplica[] {
    return [...this.replicas.values()];
  }

  /**
   * Get primary replica
   */
  public getPrimaryReplica(): ReadReplica | null {
    for (const replica of this.replicas.values()) {
      if (replica.isPrimary) {
        return replica;
      }
    }
    return null;
  }

  /**
   * Get follower (read) replicas only
   */
  public getFollowerReplicas(): readonly ReadReplica[] {
    return [...this.replicas.values()].filter((r) => !r.isPrimary);
  }

  /**
   * Update replica health and lag metrics
   */
  public updateReplicaMetrics(
    replicaId: string,
    metrics: { latencyMs?: number; lagMs?: number | null; healthStatus?: ReplicaHealthStatus },
  ): void {
    const replica = this.replicas.get(replicaId);
    if (!replica) return;

    this.replicas.set(replicaId, {
      ...replica,
      latencyMs: metrics.latencyMs ?? replica.latencyMs,
      lagMs: metrics.lagMs ?? replica.lagMs,
      healthStatus: metrics.healthStatus ?? replica.healthStatus,
      lastHealthCheck: nowIso(),
    });
  }

  /**
   * Route a read operation to the appropriate replica
   *
   * Per §52.3:
   * - Strong consistency: route to primary only
   * - Session consistency: route to primary or replica that has received the write
   * - Eventual consistency: route to any healthy replica with acceptable lag
   */
  public routeRead(request: ReadRoutingRequest): ReadRoutingDecision {
    const auditTrail: string[] = [];
    const consistencyLevel = request.consistencyLevel;
    const routingMode = request.routingMode;

    auditTrail.push(`consistency:${consistencyLevel}`);
    auditTrail.push(`mode:${routingMode}`);

    // For strong consistency, always route to primary
    if (consistencyLevel === "strong") {
      const primary = this.getPrimaryReplica();
      auditTrail.push(`route:primary_only`);
      return {
        operationId: request.operationId,
        selectedReplicaId: primary?.replicaId ?? null,
        selectedRegionId: primary?.regionId ?? null,
        isPrimaryRoute: true,
        consistencyLevel,
        estimatedLatencyMs: primary?.latencyMs ?? null,
        waitForReplication: false,
        auditTrail,
      };
    }

    // Get candidate replicas based on routing mode
    const candidates = this.getCandidateReplicas(request);
    if (candidates.length === 0) {
      replicaLogger.warn(`No healthy replicas for read operation ${request.operationId}`, {
        aggregateId: request.aggregateId,
      });
      auditTrail.push(`route:no_candidates`);

      // Fallback to primary if no candidates
      const primary = this.getPrimaryReplica();
      return {
        operationId: request.operationId,
        selectedReplicaId: primary?.replicaId ?? null,
        selectedRegionId: primary?.regionId ?? null,
        isPrimaryRoute: true,
        consistencyLevel,
        estimatedLatencyMs: primary?.latencyMs ?? null,
        waitForReplication: false,
        auditTrail,
      };
    }

    // Select best replica based on latency
    const selected = this.selectBestReplica(candidates, request.preferredRegionId);
    if (!selected) {
      auditTrail.push(`route:selection_failed`);
      const primary = this.getPrimaryReplica();
      return {
        operationId: request.operationId,
        selectedReplicaId: primary?.replicaId ?? null,
        selectedRegionId: primary?.regionId ?? null,
        isPrimaryRoute: true,
        consistencyLevel,
        estimatedLatencyMs: primary?.latencyMs ?? null,
        waitForReplication: false,
        auditTrail,
      };
    }

    auditTrail.push(`route:replica:${selected.replicaId}`);
    auditTrail.push(`latency:${selected.latencyMs}ms`);

    // For session consistency, may need to wait for replication
    const waitForReplication = consistencyLevel === "session" && !selected.isPrimary;

    return {
      operationId: request.operationId,
      selectedReplicaId: selected.replicaId,
      selectedRegionId: selected.regionId,
      isPrimaryRoute: selected.isPrimary,
      consistencyLevel,
      estimatedLatencyMs: selected.latencyMs,
      waitForReplication,
      auditTrail,
    };
  }

  /**
   * Record a write operation for read-after-write consistency tracking
   *
   * When a write is committed, we track which replicas need to receive it
   * before serving reads with session consistency.
   */
  public recordWriteForReadAfterWrite(
    operationId: string,
    aggregateId: string,
    writeSequence: number,
    targetRegionIds: readonly string[],
    ttlMs: number = 30000,
  ): void {
    const entry: PendingReadEntry = {
      operationId,
      aggregateId,
      writeSequence,
      targetRegionIds,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };
    this.pendingReads.set(`${aggregateId}:${operationId}`, entry);

    // Clean up expired entries
    this.cleanupExpiredPendingReads();
  }

  /**
   * Wait for read-after-write replication if needed
   *
   * Returns a promise that resolves when all required replicas have received the write.
   */
  public async waitForReadAfterWrite(
    aggregateId: string,
    targetRegionIds: readonly string[],
    timeoutMs: number = 10000,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const allReplicated = targetRegionIds.every((regionId) => {
        const replica = [...this.replicas.values()].find(
          (r) => r.regionId === regionId && !r.isPrimary,
        );
        if (!replica) return true; // No follower for this region, consider it OK
        return replica.lagMs !== null && replica.lagMs < 1000; // Replica is caught up
      });

      if (allReplicated) {
        return true;
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    replicaLogger.warn(`Read-after-write timeout for aggregate ${aggregateId}`, {
      targetRegionIds,
      timeoutMs,
    });
    return false;
  }

  /**
   * Check if a replica is healthy and has acceptable lag
   */
  public isReplicaHealthyForRead(replicaId: string, maxLagMs: number): boolean {
    const replica = this.replicas.get(replicaId);
    if (!replica) return false;
    if (replica.healthStatus === "unhealthy") return false;
    if (replica.isPrimary) return true;
    if (replica.lagMs !== null && replica.lagMs > maxLagMs) return false;
    return true;
  }

  /**
   * Get candidate replicas based on routing mode
   */
  private getCandidateReplicas(request: ReadRoutingRequest): readonly ReadReplica[] {
    const mode = request.routingMode;
    const allReplicas = [...this.replicas.values()];

    switch (mode) {
      case "primary_only":
        return allReplicas.filter((r) => r.isPrimary);

      case "any_healthy":
        return allReplicas.filter((r) => {
          if (r.isPrimary) return false;
          const config = this.configs.get(r.replicaId);
          const maxLag = config?.maxLagMs ?? 5000;
          return this.isReplicaHealthyForRead(r.replicaId, maxLag);
        });

      case "nearest":
      default:
        return allReplicas
          .filter((r) => {
            if (r.isPrimary) return false;
            const config = this.configs.get(r.replicaId);
            const maxLag = config?.maxLagMs ?? 5000;
            return this.isReplicaHealthyForRead(r.replicaId, maxLag);
          })
          .sort((a, b) => a.latencyMs - b.latencyMs);
    }
  }

  /**
   * Select the best replica from candidates
   */
  private selectBestReplica(
    candidates: readonly ReadReplica[],
    preferredRegionId: string | null | undefined,
  ): ReadReplica | null {
    // Prefer preferred region if specified and available
    if (preferredRegionId != null) {
      const preferred = candidates.find((r) => r.regionId === preferredRegionId);
      if (preferred) {
        return preferred;
      }
    }

    // Otherwise select by lowest latency (nearest)
    return candidates[0] ?? null;
  }

  /**
   * Clean up expired pending read entries
   */
  private cleanupExpiredPendingReads(): void {
    const now = nowIso();
    for (const [key, entry] of this.pendingReads.entries()) {
      if (entry.expiresAt < now) {
        this.pendingReads.delete(key);
      }
    }
  }
}

/**
 * Read/Write Splitting Router
 *
 * Combines read replica routing with write routing to provide
 * unified multi-region data access.
 */
export class ReadWriteSplitRouter {
  private readonly readReplicaService: ReadReplicaService;
  private readonly primaryRegionId: string;

  public constructor(primaryRegionId: string, readReplicaService?: ReadReplicaService) {
    this.primaryRegionId = primaryRegionId;
    this.readReplicaService = readReplicaService ?? new ReadReplicaService(primaryRegionId);
  }

  /**
   * Route a read operation
   */
  public routeRead(request: ReadRoutingRequest): ReadRoutingDecision {
    return this.readReplicaService.routeRead(request);
  }

  /**
   * Route a write operation (always to primary)
   */
  public routeWrite(
    operationId: string,
    aggregateType: string,
    aggregateId: string,
  ): { primaryReplicaId: string; primaryRegionId: string } {
    const primary = this.readReplicaService.getPrimaryReplica();
    if (!primary) {
      throw new Error(`No primary replica available for write operation ${operationId}`);
    }
    return {
      primaryReplicaId: primary.replicaId,
      primaryRegionId: primary.regionId,
    };
  }

  /**
   * Get the read replica service
   */
  public getReadReplicaService(): ReadReplicaService {
    return this.readReplicaService;
  }
}

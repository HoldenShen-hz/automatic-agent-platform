/**
 * Split-Brain Protection Service
 *
 * Implements split-brain detection and resolution for multi-region deployments.
 * Split-brain occurs when two or more regions simultaneously believe they
 * are the primary/leader, which can lead to data corruption.
 *
 * Key behaviors:
 * - Monitors heartbeat between regions for split-brain detection
 * - Tracks fencing epoch conflicts via EpochManager
 * - Validates fencing tokens via FencingTokenService during failover
 * - Resolves conflicts through quorum or fencing token invalidation
 *
 * @see docs_zh/architecture/00-platform-architecture.md §52.3
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { getFencingTokenService, type FencingToken } from "./fencing-token-service.js";
import { getGlobalEpochManager } from "./failover-controller/index.js";

/**
 * Split-brain detection status
 */
export type SplitBrainStatus = "clear" | "suspected" | "confirmed" | "resolved";

/**
 * Split-brain incident record
 */
export interface SplitBrainIncident {
  readonly incidentId: string;
  readonly detectedAt: string;
  readonly affectedRegions: readonly string[];
  readonly conflictingLeaders: readonly string[];
  readonly status: SplitBrainStatus;
  readonly resolution: SplitBrainResolution | null;
  readonly fencingTokensInvalidated: readonly string[];
}

/**
 * Resolution strategy for split-brain
 */
export type SplitBrainResolution =
  | "fencing_token_invalidation"
  | "leader_abdication"
  | "external_arbitration"
  | "force_failover";

/**
 * Split-brain detection result
 */
export interface SplitBrainDetectionResult {
  readonly hasSplitBrain: boolean;
  readonly confidence: number;
  readonly evidence: readonly SplitBrainEvidence[];
  readonly conflictingRegions: readonly string[];
}

/**
 * Evidence of split-brain condition
 */
export interface SplitBrainEvidence {
  readonly type: "heartbeat_timeout" | "fencing_epoch_conflict" | "write_conflict" | "leader_claim_conflict";
  readonly regionId: string;
  readonly timestamp: string;
  readonly description: string;
}

/**
 * Quorum state for split-brain resolution
 */
export interface QuorumState {
  readonly regionId: string;
  readonly lastHeartbeatAt: string;
  readonly isConnected: boolean;
  readonly weight: number;
}

/**
 * Split-Brain Protection Service
 *
 * Detects and resolves split-brain conditions by:
 * 1. Monitoring heartbeat between regions
 * 2. Tracking fencing token epochs
 * 3. Detecting write conflicts
 * 4. Resolving conflicts through quorum or fencing invalidation
 */
export class SplitBrainProtectionService {
  private static readonly MAX_TRACKED_QUORUM_STATES = 256;
  private readonly heartbeatTimers = new Map<string, string>();
  private readonly fencingEpochByRegion = new Map<string, number>();
  private readonly incidents: SplitBrainIncident[] = [];
  private readonly quorumStates = new Map<string, QuorumState>();

  /**
   * Record a heartbeat from a region
   */
  public recordHeartbeat(regionId: string): void {
    this.evictStaleQuorumStateIfNeeded(regionId);
    this.heartbeatTimers.set(regionId, nowIso());
    const existing = this.quorumStates.get(regionId);
    if (existing) {
      this.quorumStates.set(regionId, {
        ...existing,
        lastHeartbeatAt: nowIso(),
        isConnected: true,
      });
    } else {
      this.quorumStates.set(regionId, {
        regionId,
        lastHeartbeatAt: nowIso(),
        isConnected: true,
        weight: 1,
      });
    }
  }

  /**
   * Record a fencing epoch from a region
   */
  public recordFencingEpoch(regionId: string, epoch: number): void {
    const existingEpoch = this.fencingEpochByRegion.get(regionId);
    if (existingEpoch !== undefined && epoch < existingEpoch) {
      // Lower epoch received - potential split-brain
      return;
    }
    this.fencingEpochByRegion.set(regionId, epoch);
  }

  /**
   * Detect split-brain condition
   */
  public detectSplitBrain(heartbeatTimeoutMs: number = 30000): SplitBrainDetectionResult {
    const now = Date.now();
    const evidence: SplitBrainEvidence[] = [];
    const activeRegions: string[] = [];

    // Check heartbeat timeouts
    for (const [regionId, lastHeartbeat] of this.heartbeatTimers.entries()) {
      const elapsed = now - new Date(lastHeartbeat).getTime();
        if (elapsed >= heartbeatTimeoutMs) {
        evidence.push({
          type: "heartbeat_timeout",
          regionId,
          timestamp: lastHeartbeat,
          description: `No heartbeat for ${elapsed}ms (timeout: ${heartbeatTimeoutMs}ms)`,
        });
      } else {
        activeRegions.push(regionId);
      }
    }

    // Check for fencing epoch conflicts
    const epochs = [...this.fencingEpochByRegion.entries()];
    for (let i = 0; i < epochs.length; i++) {
      for (let j = i + 1; j < epochs.length; j++) {
        const [regionA, epochA] = epochs[i]!;
        const [regionB, epochB] = epochs[j]!;
        // Equal epochs across different active regions indicate concurrent leadership.
        if (epochA === epochB) {
          evidence.push({
            type: "fencing_epoch_conflict",
            regionId: regionA,
            timestamp: nowIso(),
            description: `Epoch conflict: ${regionA}=${epochA}, ${regionB}=${epochB}`,
          });
        }
      }
    }

    // Calculate confidence based on evidence
    const confidence = Math.min(1, evidence.length * 0.3);

    return {
      hasSplitBrain: evidence.length > 0,
      confidence,
      evidence,
      conflictingRegions: [...new Set(evidence.map((e) => e.regionId))],
    };
  }

  /**
   * Resolve split-brain through quorum-based leader selection
   */
  public resolveViaQuorum(
    affectedRegions: readonly string[],
    requiredQuorumWeight: number = 0.5,
  ): SplitBrainResolution {
    let totalWeight = 0;
    let connectedWeight = 0;

    for (const regionId of affectedRegions) {
      const state = this.quorumStates.get(regionId);
      if (state) {
        totalWeight += state.weight;
        if (state.isConnected) {
          connectedWeight += state.weight;
        }
      }
    }

    if (totalWeight === 0) {
      return "fencing_token_invalidation";
    }
    if (connectedWeight >= totalWeight * requiredQuorumWeight) {
      return "leader_abdication";
    }
    return "fencing_token_invalidation";
  }

  /**
   * Invalidate fencing tokens for a region (part of split-brain resolution)
   */
  public invalidateFencingTokens(regionId: string): readonly string[] {
    const currentEpoch = this.fencingEpochByRegion.get(regionId);
    if (currentEpoch !== undefined) {
      // Bump epoch to invalidate old tokens
      this.fencingEpochByRegion.set(regionId, currentEpoch + 1000);
    }
    return [`fence:${regionId}:${currentEpoch ?? 0}:invalidated`];
  }

  /**
   * Record a split-brain incident
   */
  public recordIncident(
    affectedRegions: readonly string[],
    conflictingLeaders: readonly string[],
    evidence: readonly SplitBrainEvidence[],
  ): SplitBrainIncident {
    const resolution = evidence.length >= 3 ? this.resolveViaQuorum(affectedRegions) : null;
    const invalidatedTokens = resolution === "fencing_token_invalidation"
      ? affectedRegions.flatMap((r) => this.invalidateFencingTokens(r))
      : [];

    const incident: SplitBrainIncident = {
      incidentId: newId("splitbrain"),
      detectedAt: nowIso(),
      affectedRegions,
      conflictingLeaders,
      status: "confirmed",
      resolution,
      fencingTokensInvalidated: invalidatedTokens,
    };

    this.incidents.push(incident);
    return incident;
  }

  /**
   * Get the most recent split-brain incident
   */
  public getLastIncident(): SplitBrainIncident | null {
    return this.incidents[this.incidents.length - 1] ?? null;
  }

  /**
   * Get all split-brain incidents
   */
  public getIncidents(): readonly SplitBrainIncident[] {
    return [...this.incidents];
  }

  /**
   * Check if a region is considered healthy (has recent heartbeat)
   */
  public isRegionHealthy(regionId: string, heartbeatTimeoutMs: number = 30000): boolean {
    const lastHeartbeat = this.heartbeatTimers.get(regionId);
    if (!lastHeartbeat) {
      return false;
    }
    return Date.now() - new Date(lastHeartbeat).getTime() <= heartbeatTimeoutMs;
  }

  /**
   * Get quorum state for a region
   */
  public getQuorumState(regionId: string): QuorumState | null {
    return this.quorumStates.get(regionId) ?? null;
  }

  /**
   * Update quorum weights
   */
  public setQuorumWeight(regionId: string, weight: number): void {
    const existing = this.quorumStates.get(regionId);
    if (existing) {
      this.quorumStates.set(regionId, { ...existing, weight });
    }
  }

  /**
   * R21-02: Validate fencing token during split-brain or failover.
   * Uses FencingTokenService to validate tokens before allowing writes.
   * This ensures failover has proper isolation tokens.
   */
  public validateFencingTokenForRegion(regionId: string, token: FencingToken): boolean {
    const fencingService = getFencingTokenService();
    const validation = fencingService.validateFencingToken(regionId, token);
    return validation.valid;
  }

  /**
   * R21-02: Acquire leadership with fencing token for a region.
   * Used during failover when a region needs to acquire leadership.
   */
  public acquireLeadershipWithFencing(regionId: string, entityId: string | null = null): FencingToken | null {
    if (entityId == null || entityId.trim().length === 0) {
      throw new Error("split_brain_protection.entity_id_required");
    }
    const fencingService = getFencingTokenService();
    return fencingService.acquireLeadership(regionId, entityId);
  }

  /**
   * R21-02: Release leadership and invalidate fencing token.
   * Used when a region loses leadership during split-brain resolution.
   */
  public releaseLeadership(regionId: string, entityId: string | null = null): boolean {
    const fencingService = getFencingTokenService();
    return fencingService.releaseLeadership(regionId, entityId);
  }

  /**
   * R21-02: Check if a region was demoted and is trying to rejoin with stale epoch.
   * Uses EpochManager to detect stale demoted leaders during split-brain.
   */
  public isStaleDemotedLeader(partitionKey: string, regionId: string, offeredEpoch: number): boolean {
    const epochManager = getGlobalEpochManager();
    return epochManager.isStaleDemotedLeader(partitionKey, regionId, offeredEpoch);
  }

  /**
   * R21-02: Get current fencing epoch for a partition.
   * Used to validate that rejoin attempts have current epoch.
   */
  public getCurrentFencingEpoch(partitionKey: string): number {
    const epochManager = getGlobalEpochManager();
    return epochManager.getCurrentEpoch(partitionKey);
  }

  /**
   * R21-02: Record fencing epoch from EpochManager for cross-region tracking.
   * Syncs epoch state for split-brain detection.
   */
  public syncFencingEpochFromFailover(partitionKey: string, epoch: number, leaderRegionId: string): void {
    this.fencingEpochByRegion.set(leaderRegionId, epoch);
  }

  private evictStaleQuorumStateIfNeeded(regionId: string): void {
    if (this.quorumStates.has(regionId) || this.quorumStates.size < SplitBrainProtectionService.MAX_TRACKED_QUORUM_STATES) {
      return;
    }
    let oldestRegionId: string | null = null;
    let oldestHeartbeatAt = Number.POSITIVE_INFINITY;
    for (const [trackedRegionId, state] of this.quorumStates.entries()) {
      const heartbeatAt = Date.parse(state.lastHeartbeatAt);
      if (heartbeatAt < oldestHeartbeatAt) {
        oldestHeartbeatAt = heartbeatAt;
        oldestRegionId = trackedRegionId;
      }
    }
    if (oldestRegionId != null) {
      this.quorumStates.delete(oldestRegionId);
    }
  }
}

/**
 * Singleton instance for global access
 */
let GLOBAL_SPLIT_BRAIN_SERVICE: SplitBrainProtectionService | null = null;

export function getSplitBrainProtectionService(): SplitBrainProtectionService {
  if (!GLOBAL_SPLIT_BRAIN_SERVICE) {
    GLOBAL_SPLIT_BRAIN_SERVICE = new SplitBrainProtectionService();
  }
  return GLOBAL_SPLIT_BRAIN_SERVICE;
}

export function resetSplitBrainProtectionService(): void {
  GLOBAL_SPLIT_BRAIN_SERVICE = null;
}

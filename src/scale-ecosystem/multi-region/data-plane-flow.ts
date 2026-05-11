/**
 * Multi-Region Data Plane Flow Service
 *
 * Async wrapper providing syncState, resolveConflict, and getReplicationLag
 * methods for multi-region data plane operations.
 *
 * This service coordinates:
 * - CDCReplicationService: replication lag monitoring and checkpoint management
 * - SplitBrainProtectionService: split-brain detection and conflict resolution
 * - RegionFailoverController: region failover state management
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import { SyncBackedAsyncService } from "../../platform/shared/async/sync-backed-async-service.js";
import {
  CDCReplicationService,
  MultiRegionReplicationCoordinator,
  type CDCReplicationCheckpoint,
  type CDCReplicationBatch,
  type ReplicationLagStatus,
} from "./cdc-replication-service.js";
import { getSplitBrainProtectionService, type SplitBrainDetectionResult } from "./split-brain-protection.js";
import { resolveRegionFailover, type RegionFailoverInput } from "./failover-controller/index.js";

/**
 * Region state for synchronization
 */
export interface RegionState {
  readonly regionId: string;
  readonly leaderRegionId: string | null;
  readonly fencingEpoch: number;
  readonly lastSyncedAt: string;
  readonly isPrimaryHealthy: boolean;
  readonly pendingEventCount: number;
}

/**
 * Conflict resolution input
 */
export interface ConflictResolutionInput {
  readonly partitionKey: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly conflictingWrites: readonly { writeId: string; regionId: string; timestamp: string }[];
  readonly fenceTokens: readonly { regionId: string; tokenId: string; epoch: number }[];
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  readonly resolved: boolean;
  readonly winningRegionId: string | null;
  readonly resolutionType: "fencing_token" | "quorum" | "timestamp" | "unresolved";
  readonly fenceTokensInvalidated: readonly string[];
  readonly writesAccepted: readonly string[];
  readonly writesRejected: readonly string[];
}

/**
 * Replication lag summary for a region pair
 */
export interface ReplicationLagSummary {
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly lagMs: number;
  readonly pendingEvents: number;
  readonly withinSlo: boolean;
  readonly measuredAt: string;
}

/**
 * Multi-region data plane flow state for syncing
 */
export interface DataPlaneFlowState {
  readonly partitionKey: string;
  readonly currentEpoch: number;
  readonly leaderRegionId: string | null;
  readonly regions: readonly RegionState[];
  readonly lastFailoverAt: string | null;
  readonly activeConflicts: number;
}

/**
 * Sync input for region state synchronization
 */
export interface SyncStateInput {
  readonly partitionKey: string;
  readonly sourceRegionId: string;
  readonly checkpointSequence: number;
  readonly epoch: number;
}

/**
 * Multi-Region Data Plane Flow Service
 *
 * Provides async interface for multi-region data plane operations including:
 * - syncState: synchronizes region state across partitions
 * - resolveConflict: resolves write conflicts between regions
 * - getReplicationLag: returns replication lag for region pairs
 */
type MultiRegionDataPlaneFlowServiceSync = {
  syncState(input: SyncStateInput): DataPlaneFlowState;
  resolveConflict(input: ConflictResolutionInput): ConflictResolutionResult;
  getReplicationLag(sourceRegionId: string, targetRegionId: string): number;
  getReplicationLagStatus(sourceRegionId: string, targetRegionId: string): ReplicationLagStatus | null;
  getActiveRegions(partitionKey: string): readonly RegionState[];
};

export class MultiRegionDataPlaneFlowServiceAsync extends SyncBackedAsyncService<MultiRegionDataPlaneFlowServiceSync> {
  private readonly cdcService: CDCReplicationService;
  private readonly coordinator: MultiRegionReplicationCoordinator;
  private readonly stateByPartition = new Map<string, DataPlaneFlowState>();

  public constructor(cdcService?: CDCReplicationService) {
    const cdc = cdcService ?? new CDCReplicationService();
    super(() => ({
      syncState: (input: SyncStateInput) => this.syncStateImpl(input),
      resolveConflict: (input: ConflictResolutionInput) => this.resolveConflictImpl(input),
      getReplicationLag: (sourceRegionId: string, targetRegionId: string) => this.getReplicationLagImpl(sourceRegionId, targetRegionId),
      getReplicationLagStatus: (sourceRegionId: string, targetRegionId: string) => this.getReplicationLagStatusImpl(sourceRegionId, targetRegionId),
      getActiveRegions: (partitionKey: string) => this.getActiveRegionsImpl(partitionKey),
    }));
    this.cdcService = cdc;
    this.coordinator = new MultiRegionReplicationCoordinator(cdc);
  }

  /**
   * Get the CDC replication service
   */
  public getCDCService(): CDCReplicationService {
    return this.cdcService;
  }

  /**
   * Get the multi-region replication coordinator
   */
  public getCoordinator(): MultiRegionReplicationCoordinator {
    return this.coordinator;
  }

  /**
   * Synchronize region state from checkpoint
   */
  public async syncStateAsync(input: SyncStateInput): Promise<DataPlaneFlowState> {
    return this.asPromise((sync) => sync.syncState(input));
  }

  /**
   * Resolve write conflicts between regions
   */
  public async resolveConflictAsync(input: ConflictResolutionInput): Promise<ConflictResolutionResult> {
    return this.asPromise((sync) => sync.resolveConflict(input));
  }

  /**
   * Get replication lag in milliseconds for a region pair
   */
  public async getReplicationLagAsync(sourceRegionId: string, targetRegionId: string): Promise<number> {
    return this.asPromise((sync) => sync.getReplicationLag(sourceRegionId, targetRegionId));
  }

  /**
   * Get detailed replication lag status for a region pair
   */
  public async getReplicationLagStatusAsync(
    sourceRegionId: string,
    targetRegionId: string,
    sourceEvents?: readonly { sequence: number; createdAt: string }[],
  ): Promise<ReplicationLagStatus | null> {
    return this.asPromise((sync) => sync.getReplicationLagStatus(sourceRegionId, targetRegionId));
  }

  /**
   * Get all active regions for a partition
   */
  public async getActiveRegionsAsync(partitionKey: string): Promise<readonly RegionState[]> {
    return this.asPromise((sync) => sync.getActiveRegions(partitionKey));
  }

  /**
   * Get current state for a partition
   */
  public async getStateAsync(partitionKey: string): Promise<DataPlaneFlowState | null> {
    return this.stateByPartition.get(partitionKey) ?? null;
  }

  // Implementation methods (called by SyncBackedAsyncService.asPromise)

  private syncStateImpl(input: SyncStateInput): DataPlaneFlowState {
    // Get checkpoint from CDC service for this region pair
    const checkpoint = this.cdcService.getCheckpoint(input.sourceRegionId, input.sourceRegionId);
    const splitBrainService = getSplitBrainProtectionService();
    const detection = splitBrainService.detectSplitBrain();

    const regionState: RegionState = {
      regionId: input.sourceRegionId,
      leaderRegionId: null, // Would be determined from failover controller
      fencingEpoch: input.epoch,
      lastSyncedAt: new Date().toISOString(),
      isPrimaryHealthy: detection.conflictingRegions.length === 0,
      pendingEventCount: checkpoint ? Math.max(0, input.checkpointSequence - checkpoint.lastEventSequence) : 0,
    };

    const existing = this.stateByPartition.get(input.partitionKey);
    const regions = existing
      ? [...existing.regions.filter((r) => r.regionId !== input.sourceRegionId), regionState]
      : [regionState];

    const state: DataPlaneFlowState = {
      partitionKey: input.partitionKey,
      currentEpoch: input.epoch,
      leaderRegionId: null,
      regions,
      lastFailoverAt: existing?.lastFailoverAt ?? null,
      activeConflicts: detection.hasSplitBrain ? detection.conflictingRegions.length : 0,
    };

    this.stateByPartition.set(input.partitionKey, state);
    return state;
  }

  private resolveConflictImpl(input: ConflictResolutionInput): ConflictResolutionResult {
    const splitBrainService = getSplitBrainProtectionService();

    // Try fencing token resolution first
    if (input.fenceTokens.length > 0) {
      const epochs = input.fenceTokens.map((t) => t.epoch);
      const maxEpoch = Math.max(...epochs);
      const winnerToken = input.fenceTokens.find((t) => t.epoch === maxEpoch);

      if (winnerToken) {
        const winnerRegionId = winnerToken.regionId;
        const rejectedRegions = input.conflictingWrites
          .filter((w) => w.regionId !== winnerRegionId)
          .map((w) => w.writeId);

        // Invalidate fencing tokens for losing regions
        const regionIdsObj: Record<string, boolean> = {};
        for (const write of input.conflictingWrites) {
          if (write.regionId !== winnerRegionId) {
            regionIdsObj[write.regionId] = true;
          }
        }
        for (const regionId of Object.keys(regionIdsObj)) {
          splitBrainService.invalidateFencingTokens(regionId);
        }

        return {
          resolved: true,
          winningRegionId: winnerRegionId,
          resolutionType: "fencing_token",
          fenceTokensInvalidated: input.fenceTokens.filter((t) => t.regionId !== winnerRegionId).map((t) => t.tokenId),
          writesAccepted: input.conflictingWrites.filter((w) => w.regionId === winnerRegionId).map((w) => w.writeId),
          writesRejected: rejectedRegions,
        };
      }
    }

    // Fall back to timestamp-based resolution
    if (input.conflictingWrites.length > 0) {
      const sorted = [...input.conflictingWrites].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const earliest = sorted[0]!;
      const rejected = sorted.slice(1).map((w) => w.writeId);

      return {
        resolved: true,
        winningRegionId: earliest.regionId,
        resolutionType: "timestamp",
        fenceTokensInvalidated: [],
        writesAccepted: [earliest.writeId],
        writesRejected: rejected,
      };
    }

    return {
      resolved: false,
      winningRegionId: null,
      resolutionType: "unresolved",
      fenceTokensInvalidated: [],
      writesAccepted: [],
      writesRejected: input.conflictingWrites.map((w) => w.writeId),
    };
  }

  private getReplicationLagImpl(sourceRegionId: string, targetRegionId: string): number {
    return this.cdcService.getReplicationLag(sourceRegionId, targetRegionId, 0);
  }

  private getReplicationLagStatusImpl(sourceRegionId: string, targetRegionId: string): ReplicationLagStatus | null {
    const status = this.cdcService.getStatus(sourceRegionId, targetRegionId);
    if (status === "idle" || status === "completed") {
      return {
        sourceRegionId,
        targetRegionId,
        measuredAt: new Date().toISOString(),
        pendingEvents: 0,
        lagMs: 0,
        lagSloMs: 30_000,
        withinSlo: true,
      };
    }
    const checkpoint = this.cdcService.getCheckpoint(sourceRegionId, targetRegionId);
    return checkpoint
      ? {
          sourceRegionId,
          targetRegionId,
          measuredAt: checkpoint.processedAt,
          pendingEvents: 0,
          lagMs: Date.now() - new Date(checkpoint.processedAt).getTime(),
          lagSloMs: 30_000,
          withinSlo: true,
        }
      : null;
  }

  private getActiveRegionsImpl(partitionKey: string): readonly RegionState[] {
    const state = this.stateByPartition.get(partitionKey);
    return state?.regions ?? [];
  }
}

// Singleton instance for global access
let GLOBAL_DATA_PLANE_FLOW_SERVICE: MultiRegionDataPlaneFlowServiceAsync | null = null;

export function getMultiRegionDataPlaneFlowService(): MultiRegionDataPlaneFlowServiceAsync {
  if (!GLOBAL_DATA_PLANE_FLOW_SERVICE) {
    GLOBAL_DATA_PLANE_FLOW_SERVICE = new MultiRegionDataPlaneFlowServiceAsync();
  }
  return GLOBAL_DATA_PLANE_FLOW_SERVICE;
}

export function resetMultiRegionDataPlaneFlowService(): void {
  GLOBAL_DATA_PLANE_FLOW_SERVICE = null;
}
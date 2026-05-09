/**
 * Multi-Region Topology Declaration
 *
 * Implements active-active and active-passive topology declarations
 * for multi-region deployments.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §52.3
 */

/**
 * Topology type: active-active or active-passive
 */
export type TopologyType = "active-active" | "active-passive";

/**
 * Region role in the topology
 */
export type RegionRole = "primary" | "secondary" | "witness" | "read-replica";

/**
 * Replication mode for a region pair
 */
export type ReplicationMode =
  | "synchronous"
  | "asynchronous"
  | "semi-synchronous"
  | "eventual";

/**
 * Conflict resolution strategy for active-active
 */
export type ConflictResolutionStrategy =
  | "last-write-wins"
  | "crdt"
  | "manual-merge"
  | "source-region-wins"
  | "quorum-wins";

/**
 * Region descriptor in topology
 */
export interface TopologyRegion {
  readonly regionId: string;
  readonly role: RegionRole;
  readonly isWritable: boolean;
  readonly isReadable: boolean;
  readonly priority: number;
  readonly jurisdiction: string;
  readonly capabilities: readonly string[];
}

/**
 * Region pair configuration
 */
export interface RegionPairConfig {
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly replicationMode: ReplicationMode;
  readonly conflictResolution?: ConflictResolutionStrategy;
  readonly replicationEnabled: boolean;
}

/**
 * Topology declaration for a multi-region deployment
 */
export interface MultiRegionTopology {
  readonly topologyId: string;
  readonly topologyType: TopologyType;
  readonly regions: readonly TopologyRegion[];
  readonly regionPairs: readonly RegionPairConfig[];
  readonly defaultReplicationMode: ReplicationMode;
  readonly conflictResolutionStrategy: ConflictResolutionStrategy;
  readonly supportsFailover: boolean;
  readonly supportsReadReplicas: boolean;
  readonly notes: string | null;
}

/**
 * Validate a topology declaration
 */
export function validateTopology(topology: MultiRegionTopology): {
  valid: boolean;
  errors: readonly string[];
} {
  const errors: string[] = [];

  // Must have at least one region
  if (topology.regions.length === 0) {
    errors.push("Topology must have at least one region");
  }

  // Active-passive must have exactly one primary
  if (topology.topologyType === "active-passive") {
    const primaries = topology.regions.filter((r) => r.role === "primary");
    if (primaries.length !== 1) {
      errors.push(`Active-passive topology must have exactly one primary, found ${primaries.length}`);
    }
  }

  // Active-active should have multiple writable regions
  if (topology.topologyType === "active-active") {
    const writableRegions = topology.regions.filter((r) => r.isWritable);
    if (writableRegions.length < 2) {
      errors.push("Active-active topology should have at least two writable regions");
    }
  }

  // All region pairs must reference valid regions
  const regionIds = new Set(topology.regions.map((r) => r.regionId));
  for (const pair of topology.regionPairs) {
    if (!regionIds.has(pair.sourceRegionId)) {
      errors.push(`Region pair references unknown source region: ${pair.sourceRegionId}`);
    }
    if (!regionIds.has(pair.targetRegionId)) {
      errors.push(`Region pair references unknown target region: ${pair.targetRegionId}`);
    }
  }

  // Validate conflict resolution for active-active
  if (topology.topologyType === "active-active") {
    const needsConflictResolution = topology.regionPairs.some(
      (pair) => pair.replicationMode !== "synchronous" && pair.replicationMode !== "semi-synchronous",
    );
    if (needsConflictResolution && !topology.conflictResolutionStrategy) {
      errors.push("Active-active with async replication requires a conflict resolution strategy");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the primary region from a topology
 */
export function getPrimaryRegion(topology: MultiRegionTopology): TopologyRegion | null {
  return topology.regions.find((r) => r.role === "primary") ?? null;
}

/**
 * Get secondary regions from a topology
 */
export function getSecondaryRegions(topology: MultiRegionTopology): readonly TopologyRegion[] {
  return topology.regions.filter((r) => r.role === "secondary");
}

/**
 * Get read-replica regions from a topology
 */
export function getReadReplicaRegions(topology: MultiRegionTopology): readonly TopologyRegion[] {
  return topology.regions.filter((r) => r.role === "read-replica");
}

/**
 * Get writable regions from a topology
 */
export function getWritableRegions(topology: MultiRegionTopology): readonly TopologyRegion[] {
  return topology.regions.filter((r) => r.isWritable);
}

/**
 * Check if topology supports automatic failover
 */
export function supportsAutomaticFailover(topology: MultiRegionTopology): boolean {
  return topology.supportsFailover
    && topology.topologyType === "active-passive"
    && topology.regions.some((r) => r.role === "witness");
}

/**
 * Check if a region can be a failover target
 */
export function canFailoverTo(
  topology: MultiRegionTopology,
  sourceRegionId: string,
  targetRegionId: string,
): boolean {
  const source = topology.regions.find((r) => r.regionId === sourceRegionId);
  const target = topology.regions.find((r) => r.regionId === targetRegionId);

  if (!source || !target) {
    return false;
  }

  // Primary can failover to secondary or witness
  if (source.role === "primary") {
    return target.role === "secondary" || target.role === "witness";
  }

  // Secondary can failover to another secondary or witness
  if (source.role === "secondary") {
    return target.role === "secondary" || target.role === "witness";
  }

  return false;
}

/**
 * Build an active-passive topology declaration
 */
export function buildActivePassiveTopology(
  primaryRegion: TopologyRegion,
  secondaryRegions: readonly TopologyRegion[],
  options?: {
    replicationMode?: ReplicationMode;
    regionPairs?: readonly RegionPairConfig[];
    notes?: string;
  },
): MultiRegionTopology {
  return {
    topologyId: `topology:${primaryRegion.regionId}->${secondaryRegions.map((r) => r.regionId).join(",")}`,
    topologyType: "active-passive",
    regions: [primaryRegion, ...secondaryRegions],
    regionPairs: options?.regionPairs ?? secondaryRegions.map((secondary) => ({
      sourceRegionId: primaryRegion.regionId,
      targetRegionId: secondary.regionId,
      replicationMode: options?.replicationMode ?? "asynchronous",
      replicationEnabled: true,
    })),
    defaultReplicationMode: options?.replicationMode ?? "asynchronous",
    conflictResolutionStrategy: "last-write-wins",
    supportsFailover: true,
    supportsReadReplicas: secondaryRegions.some((r) => r.role === "read-replica"),
    notes: options?.notes ?? null,
  };
}

/**
 * Build an active-active topology declaration
 */
export function buildActiveActiveTopology(
  regions: readonly TopologyRegion[],
  options?: {
    defaultReplicationMode?: ReplicationMode;
    conflictResolutionStrategy?: ConflictResolutionStrategy;
    regionPairs?: readonly RegionPairConfig[];
    notes?: string;
  },
): MultiRegionTopology {
  const writableRegions = regions.filter((r) => r.isWritable);

  // Generate region pairs for all writable combinations
  const defaultPairs: RegionPairConfig[] = [];
  for (let i = 0; i < writableRegions.length; i++) {
    for (let j = i + 1; j < writableRegions.length; j++) {
      defaultPairs.push({
        sourceRegionId: writableRegions[i]!.regionId,
        targetRegionId: writableRegions[j]!.regionId,
        replicationMode: options?.defaultReplicationMode ?? "asynchronous",
        ...(options?.conflictResolutionStrategy !== undefined ? { conflictResolution: options.conflictResolutionStrategy } : {}),
        replicationEnabled: true,
      });
    }
  }

  return {
    topologyId: `topology:active-active:${regions.map((r) => r.regionId).join(",")}`,
    topologyType: "active-active",
    regions,
    regionPairs: options?.regionPairs ?? defaultPairs,
    defaultReplicationMode: options?.defaultReplicationMode ?? "asynchronous",
    conflictResolutionStrategy: options?.conflictResolutionStrategy ?? "last-write-wins",
    supportsFailover: false,
    supportsReadReplicas: regions.some((r) => r.role === "read-replica"),
    notes: options?.notes ?? null,
  };
}

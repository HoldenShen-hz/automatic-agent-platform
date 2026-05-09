/**
 * Unit tests for Multi-Region Topology Declaration
 *
 * R13-24: Verifies topology type declarations per §52 requirements:
 * - Explicit active-active vs active-passive mode
 * - Conflict resolution strategies
 * - Region role declarations
 * - Promotion/demotion protocols
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  TopologyType,
  RegionRole,
  ReplicationMode,
  ConflictResolutionStrategy,
  TopologyRegion,
  RegionPairConfig,
  MultiRegionTopology,
  validateTopology,
  getPrimaryRegion,
  getSecondaryRegions,
  getReadReplicaRegions,
  getWritableRegions,
  supportsAutomaticFailover,
  canFailoverTo,
  buildActivePassiveTopology,
  buildActiveActiveTopology,
} from "../../../src/scale-ecosystem/multi-region/topology-declaration.js";

// ─────────────────────────────────────────────────────────────────────────────
// TopologyRegion Factory
// ─────────────────────────────────────────────────────────────────────────────

function makeRegion(overrides: Partial<TopologyRegion> = {}): TopologyRegion {
  return {
    regionId: overrides.regionId ?? "us-east",
    role: overrides.role ?? "primary",
    isWritable: overrides.isWritable ?? true,
    isReadable: overrides.isReadable ?? true,
    priority: overrides.priority ?? 1,
    jurisdiction: overrides.jurisdiction ?? "US",
    capabilities: overrides.capabilities ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// validateTopology Tests
// ─────────────────────────────────────────────────────────────────────────────

test("validateTopology rejects empty topology", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-passive",
    regions: [],
    regionPairs: [],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "last-write-wins",
    supportsFailover: false,
    supportsReadReplicas: false,
    notes: null,
  };

  const result = validateTopology(topology);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("at least one region")));
});

test("validateTopology validates active-passive has exactly one primary", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-passive",
    regions: [
      makeRegion({ regionId: "us-east", role: "primary" }),
      makeRegion({ regionId: "eu-west", role: "secondary" }),
    ],
    regionPairs: [],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "last-write-wins",
    supportsFailover: false,
    supportsReadReplicas: false,
    notes: null,
  };

  const result = validateTopology(topology);
  assert.equal(result.valid, true);
});

test("validateTopology rejects active-passive with multiple primaries", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-passive",
    regions: [
      makeRegion({ regionId: "us-east", role: "primary" }),
      makeRegion({ regionId: "eu-west", role: "primary" }),
    ],
    regionPairs: [],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "last-write-wins",
    supportsFailover: false,
    supportsReadReplicas: false,
    notes: null,
  };

  const result = validateTopology(topology);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("exactly one primary")));
});

test("validateTopology validates active-active has multiple writable regions", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-active",
    regions: [
      makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
      makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
    ],
    regionPairs: [],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "last-write-wins",
    supportsFailover: false,
    supportsReadReplicas: false,
    notes: null,
  };

  const result = validateTopology(topology);
  assert.equal(result.valid, true);
});

test("validateTopology rejects active-active with single writable region", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-active",
    regions: [
      makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
      makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
    ],
    regionPairs: [],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "last-write-wins",
    supportsFailover: false,
    supportsReadReplicas: false,
    notes: null,
  };

  const result = validateTopology(topology);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("at least two writable regions")));
});

test("validateTopology validates region pair references", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-passive",
    regions: [
      makeRegion({ regionId: "us-east", role: "primary" }),
    ],
    regionPairs: [{
      sourceRegionId: "us-east",
      targetRegionId: "unknown-region",
      replicationMode: "asynchronous",
      replicationEnabled: true,
    }],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "last-write-wins",
    supportsFailover: false,
    supportsReadReplicas: false,
    notes: null,
  };

  const result = validateTopology(topology);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("unknown source region")));
});

test("validateTopology requires conflict resolution for active-active async", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-active",
    regions: [
      makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
      makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
    ],
    regionPairs: [{
      sourceRegionId: "us-east",
      targetRegionId: "eu-west",
      replicationMode: "asynchronous", // Async requires conflict resolution
      replicationEnabled: true,
    }],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "last-write-wins", // This should be enough
    supportsFailover: false,
    supportsReadReplicas: false,
    notes: null,
  };

  const result = validateTopology(topology);
  assert.equal(result.valid, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Active-Passive Topology Builder Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildActivePassiveTopology creates valid topology", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);

  assert.equal(topology.topologyType, "active-passive");
  assert.equal(topology.regions.length, 2);
  assert.equal(topology.supportsFailover, true);
  assert.equal(topology.conflictResolutionStrategy, "last-write-wins");
});

test("buildActivePassiveTopology creates correct region pairs", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
    makeRegion({ regionId: "ap-south", role: "secondary", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);

  assert.equal(topology.regionPairs.length, 2);
  assert.equal(topology.regionPairs[0]?.sourceRegionId, "us-east");
  assert.equal(topology.regionPairs[0]?.targetRegionId, "eu-west");
  assert.equal(topology.regionPairs[1]?.sourceRegionId, "us-east");
  assert.equal(topology.regionPairs[1]?.targetRegionId, "ap-south");
});

test("buildActivePassiveTopology supports read replicas", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
    makeRegion({ regionId: "read-1", role: "read-replica", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);

  assert.equal(topology.supportsReadReplicas, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Active-Active Topology Builder Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildActiveActiveTopology creates valid topology", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
  ];

  const topology = buildActiveActiveTopology(regions);

  assert.equal(topology.topologyType, "active-active");
  assert.equal(topology.regions.length, 2);
  assert.equal(topology.supportsFailover, false); // Active-active typically doesn't auto-failover
});

test("buildActiveActiveTopology creates symmetric region pairs", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
    makeRegion({ regionId: "ap-south", role: "primary", isWritable: true }),
  ];

  const topology = buildActiveActiveTopology(regions);

  // us-east->eu-west, us-east->ap-south, eu-west->ap-south
  assert.equal(topology.regionPairs.length, 3);

  // us-east <-> eu-west
  const pair1 = topology.regionPairs.find((p) => p.sourceRegionId === "us-east" && p.targetRegionId === "eu-west");
  const pair2 = topology.regionPairs.find((p) => p.sourceRegionId === "eu-west" && p.targetRegionId === "us-east");
  assert.ok(pair1 !== undefined);
  assert.ok(pair2 !== undefined);
});

test("buildActiveActiveTopology with custom conflict resolution", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
  ];

  const topology = buildActiveActiveTopology(regions, {
    conflictResolutionStrategy: "crdt",
  });

  assert.equal(topology.conflictResolutionStrategy, "crdt");
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper Function Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getPrimaryRegion returns primary from active-passive", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);
  const found = getPrimaryRegion(topology);

  assert.ok(found !== null);
  assert.equal(found?.regionId, "us-east");
});

test("getPrimaryRegion returns null from active-active", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
  ];

  const topology = buildActiveActiveTopology(regions);
  const found = getPrimaryRegion(topology);

  assert.ok(found === null); // Active-active has no single primary
});

test("getSecondaryRegions returns secondary regions", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
    makeRegion({ regionId: "ap-south", role: "secondary", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);
  const found = getSecondaryRegions(topology);

  assert.equal(found.length, 2);
});

test("getReadReplicaRegions returns read replicas", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
    makeRegion({ regionId: "read-1", role: "read-replica", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);
  const found = getReadReplicaRegions(topology);

  assert.equal(found.length, 1);
  assert.equal(found[0]?.regionId, "read-1");
});

test("getWritableRegions returns all writable regions", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
    makeRegion({ regionId: "read-1", role: "read-replica", isWritable: false }),
  ];

  const topology = buildActiveActiveTopology(regions);
  const found = getWritableRegions(topology);

  assert.equal(found.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Failover Support Tests
// ─────────────────────────────────────────────────────────────────────────────

test("supportsAutomaticFailover returns true for active-passive with witness", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
    makeRegion({ regionId: "witness", role: "witness", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);
  assert.equal(supportsAutomaticFailover(topology), true);
});

test("supportsAutomaticFailover returns false for active-active", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
  ];

  const topology = buildActiveActiveTopology(regions);
  assert.equal(supportsAutomaticFailover(topology), false);
});

test("canFailoverTo validates failover targets", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);

  // Primary can failover to secondary
  assert.equal(canFailoverTo(topology, "us-east", "eu-west"), true);

  // Primary cannot failover to itself
  assert.equal(canFailoverTo(topology, "us-east", "us-east"), false);

  // Secondary can failover to another secondary or witness
  // (but we only have one secondary here)
  assert.equal(canFailoverTo(topology, "eu-west", "us-east"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// R13-24: Explicit Topology Mode Declaration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("topology declares explicit mode as active-active", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
  ];

  const topology = buildActiveActiveTopology(regions);

  assert.equal(topology.topologyType, "active-active");
});

test("topology declares explicit mode as active-passive", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);

  assert.equal(topology.topologyType, "active-passive");
});

test("active-active topology handles conflict resolution for concurrent writes", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
    makeRegion({ regionId: "ap-south", role: "primary", isWritable: true }),
  ];

  // CRDT-based conflict resolution for concurrent writes
  const topology = buildActiveActiveTopology(regions, {
    conflictResolutionStrategy: "crdt",
  });

  assert.equal(topology.conflictResolutionStrategy, "crdt");

  // Each region pair should be configured
  for (const pair of topology.regionPairs) {
    assert.equal(pair.replicationEnabled, true);
  }
});

test("active-passive topology uses last-write-wins by default", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);

  // Active-passive uses last-write-wins since writes only go to primary
  assert.equal(topology.conflictResolutionStrategy, "last-write-wins");
});

test("active-active topology sets supportsFailover to false", () => {
  const regions = [
    makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
    makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
  ];

  const topology = buildActiveActiveTopology(regions);

  assert.equal(topology.supportsFailover, false);
  // In active-active, all regions are peers - no single failover target
});

test("active-passive topology sets supportsFailover to true", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondaries = [
    makeRegion({ regionId: "eu-west", role: "secondary", isWritable: false }),
  ];

  const topology = buildActivePassiveTopology(primary, secondaries);

  assert.equal(topology.supportsFailover, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// R13-24: Region Role Declaration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("region declares role explicitly", () => {
  const primary = makeRegion({ regionId: "us-east", role: "primary" });
  const secondary = makeRegion({ regionId: "eu-west", role: "secondary" });
  const witness = makeRegion({ regionId: "witness", role: "witness" });

  assert.equal(primary.role, "primary");
  assert.equal(secondary.role, "secondary");
  assert.equal(witness.role, "witness");
});

test("region declares writability explicitly", () => {
  const writable = makeRegion({ regionId: "us-east", isWritable: true });
  const readOnly = makeRegion({ regionId: "eu-west", isWritable: false });

  assert.equal(writable.isWritable, true);
  assert.equal(readOnly.isWritable, false);
});

test("region declares priority for routing/failover order", () => {
  const highPriority = makeRegion({ regionId: "us-east", priority: 100 });
  const lowPriority = makeRegion({ regionId: "eu-west", priority: 50 });

  assert.ok(highPriority.priority > lowPriority.priority);
});

// ─────────────────────────────────────────────────────────────────────────────
// R13-24: Region Pair Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("region pair declares replication mode explicitly", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-passive",
    regions: [
      makeRegion({ regionId: "us-east", role: "primary" }),
      makeRegion({ regionId: "eu-west", role: "secondary" }),
    ],
    regionPairs: [{
      sourceRegionId: "us-east",
      targetRegionId: "eu-west",
      replicationMode: "synchronous", // Explicit sync mode
      replicationEnabled: true,
    }],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "last-write-wins",
    supportsFailover: true,
    supportsReadReplicas: false,
    notes: null,
  };

  const pair = topology.regionPairs[0];
  assert.equal(pair?.replicationMode, "synchronous");
});

test("region pair declares conflict resolution for async replication", () => {
  const topology: MultiRegionTopology = {
    topologyId: "test",
    topologyType: "active-active",
    regions: [
      makeRegion({ regionId: "us-east", role: "primary", isWritable: true }),
      makeRegion({ regionId: "eu-west", role: "primary", isWritable: true }),
    ],
    regionPairs: [{
      sourceRegionId: "us-east",
      targetRegionId: "eu-west",
      replicationMode: "asynchronous",
      conflictResolution: "crdt", // Explicit conflict resolution
      replicationEnabled: true,
    }],
    defaultReplicationMode: "asynchronous",
    conflictResolutionStrategy: "crdt",
    supportsFailover: false,
    supportsReadReplicas: false,
    notes: null,
  };

  const pair = topology.regionPairs[0];
  assert.equal(pair?.conflictResolution, "crdt");
});

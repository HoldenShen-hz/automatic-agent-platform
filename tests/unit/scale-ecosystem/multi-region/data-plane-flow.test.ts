/**
 * Issue #1925 Tests: Multi-Region Data Plane Flow Service
 *
 * Tests for syncState, resolveConflict, and getReplicationLag methods
 * that were missing from the async wrapper.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { MultiRegionDataPlaneFlowServiceAsync, getMultiRegionDataPlaneFlowService } from "../../../../src/scale-ecosystem/multi-region/data-plane-flow.js";
import { CDCReplicationService } from "../../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1925: syncState method
// ─────────────────────────────────────────────────────────────────────────────

test("data-plane-flow-1925: MultiRegionDataPlaneFlowServiceAsync is exported and is a class", () => {
  assert.equal(typeof MultiRegionDataPlaneFlowServiceAsync, "function");
});

test("data-plane-flow-1925: constructor creates CDC service internally when not provided", () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  assert.ok(service.getCDCService() instanceof CDCReplicationService);
});

test("data-plane-flow-1925: constructor accepts CDC service as parameter", () => {
  const cdcService = new CDCReplicationService();
  const service = new MultiRegionDataPlaneFlowServiceAsync(cdcService);
  assert.equal(service.getCDCService(), cdcService);
});

test("data-plane-flow-1925: syncStateAsync returns DataPlaneFlowState", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  const result = await service.syncStateAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-east",
    checkpointSequence: 100,
    epoch: 1,
  });

  assert.ok(result != null);
  assert.equal(result.partitionKey, "global");
  assert.equal(result.currentEpoch, 1);
  assert.ok(Array.isArray(result.regions));
  assert.ok(result.lastFailoverAt === null || typeof result.lastFailoverAt === "string");
  assert.ok(typeof result.activeConflicts === "number");
});

test("data-plane-flow-1925: syncState tracks region state", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();

  // Sync first region
  const state1 = await service.syncStateAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-east",
    checkpointSequence: 100,
    epoch: 1,
  });
  assert.equal(state1.regions.length, 1);
  assert.equal(state1.regions[0]?.regionId, "region-us-east");

  // Sync second region
  const state2 = await service.syncStateAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-west",
    checkpointSequence: 50,
    epoch: 1,
  });
  assert.equal(state2.regions.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1925: resolveConflict method
// ─────────────────────────────────────────────────────────────────────────────

test("data-plane-flow-1925: resolveConflictAsync returns ConflictResolutionResult", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  const result = await service.resolveConflictAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-east",
    targetRegionId: "region-us-west",
    conflictingWrites: [
      { writeId: "write-1", regionId: "region-us-east", timestamp: "2026-05-12T10:00:00Z" },
      { writeId: "write-2", regionId: "region-us-west", timestamp: "2026-05-12T10:00:01Z" },
    ],
    fenceTokens: [
      { regionId: "region-us-east", tokenId: "token-1", epoch: 5 },
      { regionId: "region-us-west", tokenId: "token-2", epoch: 3 },
    ],
  });

  assert.ok(result != null);
  assert.equal(typeof result.resolved, "boolean");
  assert.ok(result.winningRegionId === null || typeof result.winningRegionId === "string");
  assert.ok(["fencing_token", "quorum", "timestamp", "unresolved"].includes(result.resolutionType));
  assert.ok(Array.isArray(result.fenceTokensInvalidated));
  assert.ok(Array.isArray(result.writesAccepted));
  assert.ok(Array.isArray(result.writesRejected));
});

test("data-plane-flow-1925: resolveConflict uses fencing token when available", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  const result = await service.resolveConflictAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-east",
    targetRegionId: "region-us-west",
    conflictingWrites: [
      { writeId: "write-1", regionId: "region-us-east", timestamp: "2026-05-12T10:00:00Z" },
      { writeId: "write-2", regionId: "region-us-west", timestamp: "2026-05-12T10:00:01Z" },
    ],
    fenceTokens: [
      { regionId: "region-us-east", tokenId: "token-1", epoch: 10 },
      { regionId: "region-us-west", tokenId: "token-2", epoch: 5 },
    ],
  });

  assert.equal(result.resolved, true);
  assert.equal(result.winningRegionId, "region-us-east");
  assert.equal(result.resolutionType, "fencing_token");
  assert.ok(result.writesAccepted.includes("write-1"));
  assert.ok(result.writesRejected.includes("write-2"));
});

test("data-plane-flow-1925: resolveConflict falls back to timestamp when no fencing tokens", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  const result = await service.resolveConflictAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-east",
    targetRegionId: "region-us-west",
    conflictingWrites: [
      { writeId: "write-1", regionId: "region-us-east", timestamp: "2026-05-12T10:00:00Z" },
      { writeId: "write-2", regionId: "region-us-west", timestamp: "2026-05-12T10:00:01Z" },
    ],
    fenceTokens: [],
  });

  assert.equal(result.resolved, true);
  assert.equal(result.resolutionType, "timestamp");
  assert.equal(result.winningRegionId, "region-us-east"); // earliest timestamp
});

test("data-plane-flow-1925: resolveConflict returns unresolved when no conflict data", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  const result = await service.resolveConflictAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-east",
    targetRegionId: "region-us-west",
    conflictingWrites: [],
    fenceTokens: [],
  });

  assert.equal(result.resolved, false);
  assert.equal(result.resolutionType, "unresolved");
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1925: getReplicationLag method
// ─────────────────────────────────────────────────────────────────────────────

test("data-plane-flow-1925: getReplicationLagAsync returns number", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  const lag = await service.getReplicationLagAsync("region-us-east", "region-us-west");
  assert.equal(typeof lag, "number");
  assert.ok(lag >= 0);
});

test("data-plane-flow-1925: getReplicationLagStatusAsync returns ReplicationLagStatus or null", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  const status = await service.getReplicationLagStatusAsync("region-us-east", "region-us-west");

  if (status != null) {
    assert.equal(status.sourceRegionId, "region-us-east");
    assert.equal(status.targetRegionId, "region-us-west");
    assert.equal(typeof status.lagMs, "number");
    assert.equal(typeof status.pendingEvents, "number");
    assert.equal(typeof status.withinSlo, "boolean");
    assert.ok(typeof status.measuredAt === "string");
    assert.ok(typeof status.lagSloMs === "number");
  }
});

test("data-plane-flow-1925: getReplicationLag returns 0 for idle status", async () => {
  const cdcService = new CDCReplicationService();
  const service = new MultiRegionDataPlaneFlowServiceAsync(cdcService);

  // Without any replication configured, getReplicationLag should return 0
  const lag = await service.getReplicationLagAsync("region-a", "region-b");
  assert.equal(lag, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1925: getActiveRegions method
// ─────────────────────────────────────────────────────────────────────────────

test("data-plane-flow-1925: getActiveRegionsAsync returns array of RegionState", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();

  // Sync some regions first
  await service.syncStateAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-east",
    checkpointSequence: 100,
    epoch: 1,
  });

  const regions = await service.getActiveRegionsAsync("global");
  assert.ok(Array.isArray(regions));
  if (regions.length > 0) {
    const region = regions[0];
    assert.ok(typeof region.regionId === "string");
    assert.ok(region.leaderRegionId === null || typeof region.leaderRegionId === "string");
    assert.ok(typeof region.fencingEpoch === "number");
    assert.ok(typeof region.lastSyncedAt === "string");
    assert.ok(typeof region.isPrimaryHealthy === "boolean");
    assert.ok(typeof region.pendingEventCount === "number");
  }
});

test("data-plane-flow-1925: getActiveRegions returns empty array for unknown partition", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();
  const regions = await service.getActiveRegionsAsync("unknown-partition");
  assert.ok(Array.isArray(regions));
  assert.equal(regions.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1925: getState method
// ─────────────────────────────────────────────────────────────────────────────

test("data-plane-flow-1925: getStateAsync returns state or null", async () => {
  const service = new MultiRegionDataPlaneFlowServiceAsync();

  // Initially no state
  const state1 = await service.getStateAsync("global");
  // State could be null if never synced

  // After sync, state should exist
  await service.syncStateAsync({
    partitionKey: "global",
    sourceRegionId: "region-us-east",
    checkpointSequence: 100,
    epoch: 1,
  });

  const state2 = await service.getStateAsync("global");
  assert.ok(state2 != null);
  assert.equal(state2.partitionKey, "global");
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1925: Singleton behavior
// ─────────────────────────────────────────────────────────────────────────────

test("data-plane-flow-1925: getMultiRegionDataPlaneFlowService returns singleton", () => {
  const service1 = getMultiRegionDataPlaneFlowService();
  const service2 = getMultiRegionDataPlaneFlowService();
  assert.equal(service1, service2);
});

test("data-plane-flow-1925: getMultiRegionDataPlaneFlowService returns MultiRegionDataPlaneFlowServiceAsync", () => {
  const service = getMultiRegionDataPlaneFlowService();
  assert.ok(service instanceof MultiRegionDataPlaneFlowServiceAsync);
});
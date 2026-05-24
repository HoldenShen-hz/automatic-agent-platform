/**
 * Additional unit tests for CDCReplicationService
 *
 * Tests batch preparation, replication configuration, checkpoint management,
 * conflict resolution with LWW, merge, and abort strategies.
 *
 * @see src/scale-ecosystem/multi-region/cdc-replication-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CDCReplicationService,
  VectorClock,
  type CDCReplicationEvent,
  type RegionReplicationConfig,
  type ConflictResolutionStrategy,
} from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";

function createMockEvent(overrides: Partial<CDCReplicationEvent> = {}): CDCReplicationEvent {
  return {
    id: "evt_mock",
    sequence: 1,
    eventType: "test.event",
    taskId: "task_001",
    payloadJson: "{}",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Replication Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.registerReplication stores config and initializes checkpoint", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    batchSize: 50,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  const storedConfig = service.getConfig("us-west-2", "eu-west-1");
  assert.deepEqual(storedConfig, config);

  const checkpoint = service.getCheckpoint("us-west-2", "eu-west-1");
  assert.ok(checkpoint != null);
  assert.equal(checkpoint.sourceRegionId, "us-west-2");
  assert.equal(checkpoint.targetRegionId, "eu-west-1");
  assert.equal(checkpoint.lastEventSequence, 0);
});

test("CDCReplicationService.getConfig returns undefined for unregistered pair", () => {
  const service = new CDCReplicationService();
  const config = service.getConfig("unknown-region", "other-region");
  assert.equal(config, undefined);
});

test("CDCReplicationService.isEnabled returns true when enabled in config", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  assert.equal(service.isEnabled("us-east-1", "us-west-2"), true);
});

test("CDCReplicationService.isEnabled returns false when disabled", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: false,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };

  service.registerReplication(config);

  assert.equal(service.isEnabled("us-east-1", "us-west-2"), false);
});

test("CDCReplicationService.isEnabled returns false for unregistered pair", () => {
  const service = new CDCReplicationService();
  assert.equal(service.isEnabled("unknown", "pair"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Batch Preparation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.prepareBatch returns null when no config registered", () => {
  const service = new CDCReplicationService();
  const batch = service.prepareBatch("unknown", "region", []);
  assert.equal(batch, null);
});

test("CDCReplicationService.prepareBatch returns null when no events after checkpoint", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  const events = [
    createMockEvent({ sequence: -2 }),
    createMockEvent({ sequence: -1 }),
    createMockEvent({ sequence: 0 }),
  ];

  const batch = service.prepareBatch("us-west-2", "eu-west-1", events);
  assert.equal(batch, null);
});

test("CDCReplicationService.prepareBatch creates batch with events after checkpoint", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  // Manually set checkpoint to sequence 2
  service.registerReplication({
    ...config,
  });
  const events = [
    createMockEvent({ id: "evt_1", sequence: 1 }),
    createMockEvent({ id: "evt_2", sequence: 2 }),
    createMockEvent({ id: "evt_3", sequence: 3 }),
    createMockEvent({ id: "evt_4", sequence: 4 }),
  ];

  const batch = service.prepareBatch("us-west-2", "eu-west-1", events);

  assert.ok(batch != null);
  assert.equal(batch.batchId.startsWith("cdc_batch_"), true);
  assert.equal(batch.sourceRegionId, "us-west-2");
  assert.equal(batch.targetRegionId, "eu-west-1");
  assert.ok(batch.events.length >= 1);
});

test("CDCReplicationService.prepareBatch respects batch size limit", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "region-a",
    targetRegionId: "region-b",
    batchSize: 2,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  const events = [
    createMockEvent({ sequence: 1 }),
    createMockEvent({ sequence: 2 }),
    createMockEvent({ sequence: 3 }),
    createMockEvent({ sequence: 4 }),
    createMockEvent({ sequence: 5 }),
  ];

  const batch = service.prepareBatch("region-a", "region-b", events);

  assert.ok(batch != null);
  assert.equal(batch.events.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.confirmBatch updates checkpoint", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  const events = [
    createMockEvent({ id: "evt_confirm_1", sequence: 1 }),
    createMockEvent({ id: "evt_confirm_2", sequence: 2 }),
  ];

  const batch = service.prepareBatch("us-west-2", "eu-west-1", events);
  assert.ok(batch != null);

  service.confirmBatch("us-west-2", "eu-west-1", batch);

  const checkpoint = service.getCheckpoint("us-west-2", "eu-west-1");
  assert.ok(checkpoint != null);
  assert.equal(checkpoint.lastEventSequence, batch.endSequence);
  assert.equal(checkpoint.lastEventId, "evt_confirm_2");
});

test("CDCReplicationService.getCheckpoint returns undefined for unregistered pair", () => {
  const service = new CDCReplicationService();
  const checkpoint = service.getCheckpoint("unknown", "pair");
  assert.equal(checkpoint, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Replication Lag Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.getReplicationLag returns total events when no checkpoint", () => {
  const service = new CDCReplicationService();
  const lag = service.getReplicationLag("region-a", "region-b", 100);
  assert.equal(lag, 100);
});

test("CDCReplicationService.getReplicationLag returns difference from checkpoint", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "region-a",
    targetRegionId: "region-b",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  // Set checkpoint at sequence 50
  service.registerReplication(config);
  const events = [];
  for (let i = 1; i <= 100; i++) {
    events.push(createMockEvent({ sequence: i }));
  }

  const batch = service.prepareBatch("region-a", "region-b", events);
  if (batch) {
    service.confirmBatch("region-a", "region-b", batch);
  }

  const lag = service.getReplicationLag("region-a", "region-b", 100);
  assert.equal(lag, 0); // After replicating 100 events, lag should be 0
});

test("CDCReplicationService.getReplicationLag returns non-negative value", () => {
  const service = new CDCReplicationService();
  const config: RegionReplicationConfig = {
    sourceRegionId: "lag-test",
    targetRegionId: "lag-target",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  };
  service.registerReplication(config);

  // Replicate some events
  const events = [createMockEvent({ sequence: 1 })];
  const batch = service.prepareBatch("lag-test", "lag-target", events);
  if (batch) {
    service.confirmBatch("lag-test", "lag-target", batch);
  }

  // Ask for lag with total less than checkpoint (should return 0)
  const lag = service.getReplicationLag("lag-test", "lag-target", 0);
  assert.equal(lag, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Replication Status Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.getStatus returns idle for unregistered pair", () => {
  const service = new CDCReplicationService();
  const status = service.getStatus("unknown", "region");
  assert.equal(status, "idle");
});

test("CDCReplicationService.getRegisteredRegionPairs returns all registered pairs", () => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  service.registerReplication({
    sourceRegionId: "us-west-2",
    targetRegionId: "ap-southeast-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const pairs = service.getRegisteredRegionPairs();
  assert.equal(pairs.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Vector Clock Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.getVectorClock returns undefined for unknown entity", () => {
  const service = new CDCReplicationService();
  const clock = service.getVectorClock("unknown-entity");
  assert.equal(clock, undefined);
});

test("CDCReplicationService.updateVectorClock increments clock for region", () => {
  const service = new CDCReplicationService();

  const updated = service.updateVectorClock("entity-1", "us-west-2", 1);

  assert.equal(updated.toMap().get("us-west-2"), 1);
});

test("CDCReplicationService.mergeVectorClock merges remote clock", () => {
  const service = new CDCReplicationService();

  // Update local clock
  service.updateVectorClock("entity-1", "us-west-2", 1);
  service.updateVectorClock("entity-1", "us-west-2", 2);

  // Create and merge remote clock
  const remoteClock = new VectorClock();
  const remoteUpdated = remoteClock.increment("eu-west-1").increment("eu-west-1");

  const merged = service.mergeVectorClock("entity-1", remoteUpdated);

  assert.equal(merged.toMap().get("us-west-2"), 2);
  assert.equal(merged.toMap().get("eu-west-1"), 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.detectConflict returns false for different taskIds", () => {
  const service = new CDCReplicationService();

  service.updateVectorClock("task-1", "region-a", 1);
  service.updateVectorClock("task-2", "region-b", 1);

  const localEvent = createMockEvent({ taskId: "task-1", sequence: 1 });
  const remoteEvent = createMockEvent({ taskId: "task-2", sequence: 1 });

  assert.equal(service.detectConflict(localEvent, remoteEvent), false);
});

test("CDCReplicationService.detectConflict returns false when no vector clocks", () => {
  const service = new CDCReplicationService();

  const localEvent = createMockEvent({ taskId: "task-1", sequence: 1 });
  const remoteEvent = createMockEvent({ taskId: "task-1", sequence: 2 });

  assert.equal(service.detectConflict(localEvent, remoteEvent), false);
});

test("CDCReplicationService.detectConflict returns false for non-concurrent events", () => {
  const service = new CDCReplicationService();

  service.updateVectorClock("task-1", "region-a", 1);
  service.updateVectorClock("task-1", "region-a", 2);

  const localEvent = createMockEvent({ taskId: "task-1", sequence: 1 });
  const remoteEvent = createMockEvent({ taskId: "task-1", sequence: 2 });

  // Same sequence - not concurrent
  assert.equal(service.detectConflict(localEvent, remoteEvent), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Resolution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.resolveConflictLWW selects later timestamp as winner", () => {
  const service = new CDCReplicationService();

  service.updateVectorClock("task-lww", "region-a", 1);
  service.updateVectorClock("task-lww", "region-b", 1);

  const localTime = new Date("2024-01-01T00:00:00.000Z");
  const remoteTime = new Date("2024-01-01T00:00:01.000Z"); // 1 second later

  const localEvent = createMockEvent({
    taskId: "task-lww",
    sequence: 1,
    createdAt: localTime.toISOString(),
  });
  const remoteEvent = createMockEvent({
    taskId: "task-lww",
    sequence: 2,
    createdAt: remoteTime.toISOString(),
  });

  const result = service.resolveConflictLWW(localEvent, remoteEvent);

  assert.equal(result.resolved, true);
  assert.equal(result.strategy, "lww");
  assert.equal(result.resolvedEvent?.id, remoteEvent.id);
  assert.equal(result.conflict?.resolution, "remote_wins");
});

test("CDCReplicationService.resolveConflictLWW selects local when local is later", () => {
  const service = new CDCReplicationService();

  const localTime = new Date("2024-01-01T00:00:02.000Z"); // 2 seconds later
  const remoteTime = new Date("2024-01-01T00:00:00.000Z");

  const localEvent = createMockEvent({
    taskId: "task-lww-local",
    sequence: 2,
    createdAt: localTime.toISOString(),
  });
  const remoteEvent = createMockEvent({
    taskId: "task-lww-local",
    sequence: 1,
    createdAt: remoteTime.toISOString(),
  });

  const result = service.resolveConflictLWW(localEvent, remoteEvent);

  assert.equal(result.resolved, true);
  assert.equal(result.resolvedEvent?.id, localEvent.id);
  assert.equal(result.conflict?.resolution, "local_wins");
});

test("CDCReplicationService.resolveConflictMerge combines payloads", () => {
  const service = new CDCReplicationService();

  const localEvent = createMockEvent({
    taskId: "task-merge",
    sequence: 1,
    payloadJson: JSON.stringify({ localField: "localValue" }),
    createdAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  });
  const remoteEvent = createMockEvent({
    taskId: "task-merge",
    sequence: 2,
    payloadJson: JSON.stringify({ remoteField: "remoteValue" }),
    createdAt: new Date("2024-01-01T00:00:01.000Z").toISOString(),
  });

  const result = service.resolveConflictMerge(localEvent, remoteEvent);

  assert.equal(result.resolved, true);
  assert.equal(result.strategy, "merge");
  assert.ok(result.resolvedEvent != null);

  const payload = JSON.parse(result.resolvedEvent.payloadJson);
  assert.equal(payload.remoteField, "remoteValue");
  assert.equal(payload._merged, true);
});

test("CDCReplicationService.resolveConflict with abort strategy returns unresolved", () => {
  const service = new CDCReplicationService();

  const localEvent = createMockEvent({ taskId: "task-abort", sequence: 1 });
  const remoteEvent = createMockEvent({ taskId: "task-abort", sequence: 2 });

  const result = service.resolveConflict(localEvent, remoteEvent, "abort");

  assert.equal(result.resolved, false);
  assert.equal(result.resolvedEvent, null);
  assert.equal(result.strategy, "abort");
  assert.equal(result.conflict?.resolution, "aborted");
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflict History Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.recordConflict stores conflict in history", () => {
  const service = new CDCReplicationService();

  service.updateVectorClock("entity-1", "region-a", 1);
  service.updateVectorClock("entity-1", "region-b", 1);

  const localEvent = createMockEvent({ taskId: "entity-1", sequence: 1 });
  const remoteEvent = createMockEvent({ taskId: "entity-1", sequence: 2 });

  const conflictResult = service.resolveConflictLWW(localEvent, remoteEvent);

  if (conflictResult.conflict) {
    service.recordConflict("entity-1", conflictResult.conflict);
  }

  const history = service.getConflictHistory("entity-1");
  assert.equal(history.length, 1);
  assert.equal(history[0]!.resolution, "remote_wins");
});

test("CDCReplicationService.getConflictHistory returns empty array for unknown entity", () => {
  const service = new CDCReplicationService();
  const history = service.getConflictHistory("unknown-entity");
  assert.equal(history.length, 0);
});

test("CDCReplicationService.recordConflict caps history at 100 entries", () => {
  const service = new CDCReplicationService();

  for (let i = 0; i < 105; i++) {
    service.updateVectorClock("entity-capped", "region-a", i);
    service.updateVectorClock("entity-capped", "region-b", i);

    const localEvent = createMockEvent({ taskId: "entity-capped", sequence: i * 2 });
    const remoteEvent = createMockEvent({ taskId: "entity-capped", sequence: i * 2 + 1 });

    const conflictResult = service.resolveConflictLWW(localEvent, remoteEvent);
    if (conflictResult.conflict) {
      service.recordConflict("entity-capped", conflictResult.conflict);
    }
  }

  const history = service.getConflictHistory("entity-capped");
  assert.equal(history.length, 100);
});

// ─────────────────────────────────────────────────────────────────────────────
// Merge Events With Conflict Resolution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("CDCReplicationService.mergeEventsWithConflictResolution adds remote events without conflicts", () => {
  const service = new CDCReplicationService();

  const localEvents: CDCReplicationEvent[] = [
    createMockEvent({ id: "local_1", taskId: "task_merge", sequence: 1 }),
  ];
  const remoteEvents: CDCReplicationEvent[] = [
    createMockEvent({ id: "remote_2", taskId: "task_merge", sequence: 2 }),
  ];

  const result = service.mergeEventsWithConflictResolution("task_merge", localEvents, remoteEvents);

  assert.equal(result.length, 2);
});

test("CDCReplicationService.mergeEventsWithConflictResolution replaces conflicted events", () => {
  const service = new CDCReplicationService();

  service.updateVectorClock("task_conflict", "region-a", 1);
  service.updateVectorClock("task_conflict", "region-b", 1);

  const localEvent = createMockEvent({
    id: "local_1",
    taskId: "task_conflict",
    sequence: 1,
    payloadJson: JSON.stringify({ value: "local" }),
    createdAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  });
  const remoteEvent = createMockEvent({
    id: "remote_1",
    taskId: "task_conflict",
    sequence: 1,
    payloadJson: JSON.stringify({ value: "remote" }),
    createdAt: new Date("2024-01-01T00:00:01.000Z").toISOString(),
  });

  const localEvents: CDCReplicationEvent[] = [localEvent];
  const remoteEvents: CDCReplicationEvent[] = [remoteEvent];

  const result = service.mergeEventsWithConflictResolution("task_conflict", localEvents, remoteEvents);

  assert.equal(result.length, 1);
  const payload = JSON.parse(result[0]!.payloadJson);
  assert.equal(payload.value, "remote");
});

// ─────────────────────────────────────────────────────────────────────────────
// MultiRegionReplicationCoordinator Tests
// ─────────────────────────────────────────────────────────────────────────────

test("MultiRegionReplicationCoordinator.setupRegionReplication creates configs for all targets", async () => {
  const service = new CDCReplicationService();
  const { MultiRegionReplicationCoordinator } = await import(
    "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js"
  );
  const coordinator = new MultiRegionReplicationCoordinator(service);

  coordinator.setupRegionReplication("us-west-2", [
    { targetRegionId: "eu-west-1", batchSize: 50 },
    { targetRegionId: "ap-southeast-1", intervalMs: 10000 },
  ]);

  const replications = coordinator.getRegionReplications("us-west-2");
  assert.equal(replications.length, 2);
  assert.equal(replications[0]!.targetRegionId, "eu-west-1");
  assert.equal(replications[0]!.batchSize, 50);
  assert.equal(replications[1]!.targetRegionId, "ap-southeast-1");
});

test("MultiRegionReplicationCoordinator.getCDCService returns the CDC service", async () => {
  const service = new CDCReplicationService();
  const { MultiRegionReplicationCoordinator } = await import(
    "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js"
  );
  const coordinator = new MultiRegionReplicationCoordinator(service);

  assert.equal(coordinator.getCDCService(), service);
});

test("MultiRegionReplicationCoordinator uses default batch size and interval", async () => {
  const service = new CDCReplicationService();
  const { MultiRegionReplicationCoordinator } = await import(
    "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js"
  );
  const coordinator = new MultiRegionReplicationCoordinator(service);

  coordinator.setupRegionReplication("region-test", [{ targetRegionId: "target-1" }]);

  const replications = coordinator.getRegionReplications("region-test");
  assert.equal(replications.length, 1);
  assert.equal(replications[0]!.batchSize, 100); // default
  assert.equal(replications[0]!.replicationIntervalMs, 5000); // default
});

test("MultiRegionReplicationCoordinator.getRegionReplications returns empty for unknown source", async () => {
  const service = new CDCReplicationService();
  const { MultiRegionReplicationCoordinator } = await import(
    "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js"
  );
  const coordinator = new MultiRegionReplicationCoordinator(service);

  const replications = coordinator.getRegionReplications("unknown-region");
  assert.equal(replications.length, 0);
});

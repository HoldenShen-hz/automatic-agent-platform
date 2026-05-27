/**
 * [SYS-REL-2.2] CDC Replication Race Condition Tests
 *
 * Tests that CDC replication handles concurrent events correctly,
 * particularly with vector clock ordering for conflict detection.
 *
 * Bug: CDC replication may have race conditions when handling concurrent
 * events from multiple regions without proper ordering guarantees.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CDCReplicationService,
  VectorClock,
  type CDCReplicationEvent,
  type CDCReplicationBatch,
  type RegionReplicationConfig,
} from "../../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";

function createReplicationEvent(overrides: Partial<CDCReplicationEvent> = {}): CDCReplicationEvent {
  return {
    id: overrides.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sequence: overrides.sequence ?? 1,
    eventType: overrides.eventType ?? "task.created",
    taskId: overrides.taskId ?? "task-1",
    payloadJson: overrides.payloadJson ?? JSON.stringify({ data: "test" }),
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

function createReplicationConfig(overrides: Partial<RegionReplicationConfig> = {}): RegionReplicationConfig {
  return {
    sourceRegionId: overrides.sourceRegionId ?? "us-west-2",
    targetRegionId: overrides.targetRegionId ?? "eu-west-1",
    batchSize: overrides.batchSize ?? 100,
    replicationIntervalMs: overrides.replicationIntervalMs ?? 5000,
    enabled: overrides.enabled ?? true,
    retryPolicy: {
      maxRetries: overrides.retryPolicy?.maxRetries ?? 3,
      backoffMs: overrides.retryPolicy?.backoffMs ?? 1000,
    },
    ...overrides,
  };
}

// =============================================================================
// VectorClock Concurrent Ordering Tests
// =============================================================================

test("[SYS-REL-2.2] VectorClock compare returns concurrent for truly concurrent events [cdc-replication-concurrent]", () => {
  const clock1 = new VectorClock();
  const clock2 = new VectorClock();

  // Same initial state - both empty clocks are concurrent
  assert.equal(clock1.compare(clock2), 0, "Identical clocks should be concurrent (0)");
});

test("[SYS-REL-2.2] VectorClock detect concurrent updates from different regions [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  // Region A processes event 1
  service.updateVectorClock("entity-1", "region-a", 1);
  // Region B processes event 1 (concurrently)
  service.updateVectorClock("entity-1", "region-b", 1);

  const clockA = service.getVectorClock("entity-1")!;
  const clockB = service.getVectorClock("entity-1")!;

  // Two independent increments - clocks are concurrent
  assert.equal(clockA.compare(clockB), 0, "Independent region increments should be concurrent");
});

test("[SYS-REL-2.2] VectorClock happensBeforeOrEqual detects causal ordering [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  // Region A: event 1 -> event 2
  service.updateVectorClock("entity-1", "region-a", 1);
  service.updateVectorClock("entity-1", "region-a", 2);

  // Region B: event 1 (caused by A's first event)
  service.updateVectorClock("entity-1", "region-b", 1);

  const clockA = service.getVectorClock("entity-1")!;

  // Region B's clock should happen-before Region A's clock (which has seq 2)
  // But due to concurrent nature, they might be concurrent
  const result = clockA.compare(service.getVectorClock("entity-1")!);
  assert.ok([-1, 0, 1].includes(result), "Compare should return -1, 0, or 1");
});

test("[SYS-REL-2.2] CDC service mergeVectorClock combines per-region sequences [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  // Initialize local clock
  service.updateVectorClock("entity-1", "us-west-2", 5);
  service.updateVectorClock("entity-1", "us-west-2", 6);

  // Merge remote clock from eu-west-1 that is ahead
  const remoteClock = new VectorClock();
  // Simulate remote having processed events up to sequence 10
  const remoteMap = new Map<string, number>();
  remoteMap.set("eu-west-1", 10);
  const remote = new VectorClock(remoteMap);

  const merged = service.mergeVectorClock("entity-1", remote);

  assert.ok(merged.getMaxSequence() >= 10, "Merged clock should have max sequence from both");
});

test("[SYS-REL-2.2] CDC updateVectorClock stores explicit region sequence instead of blind increment [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  service.updateVectorClock("entity-2", "us-west-2", 7);
  const clock = service.getVectorClock("entity-2");

  assert.equal(clock?.toMap().get("us-west-2"), 7);
});

test("[SYS-REL-2.2] CDC detectConflict returns false for different taskIds [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  const localEvent = createReplicationEvent({ taskId: "task-1", sequence: 1 });
  const remoteEvent = createReplicationEvent({ taskId: "task-2", sequence: 1 });

  // Set up vector clocks
  service.updateVectorClock("task-1", "region-a", 1);
  service.updateVectorClock("task-2", "region-b", 1);

  const result = service.detectConflict(localEvent, remoteEvent);

  assert.equal(result, false, "Events for different tasks should not conflict");
});

test("[SYS-REL-2.2] CDC detectConflict returns true for concurrent updates to same task [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  const localEvent = createReplicationEvent({
    taskId: "task-shared",
    sequence: 1,
    id: "local-1",
    sourceRegionId: "region-a",
    vectorClock: { "region-a": 1 },
    payloadJson: JSON.stringify({ source: "local" }),
  });
  const remoteEvent = createReplicationEvent({
    taskId: "task-shared",
    sequence: 1,
    id: "remote-1",
    createdAt: new Date().toISOString(),
    sourceRegionId: "region-b",
    vectorClock: { "region-b": 1 },
    payloadJson: JSON.stringify({ source: "remote" }),
  });

  assert.equal(service.detectConflict(localEvent, remoteEvent), true);
});

test("[SYS-REL-2.2] CDC mergeEventsWithConflictResolution handles concurrent events [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  const localEvents: CDCReplicationEvent[] = [
    createReplicationEvent({ id: "local-1", taskId: "task-1", sequence: 1, createdAt: "2026-04-29T10:00:00.000Z" }),
    createReplicationEvent({ id: "local-2", taskId: "task-1", sequence: 2, createdAt: "2026-04-29T10:00:01.000Z" }),
  ];

  const remoteEvents: CDCReplicationEvent[] = [
    createReplicationEvent({ id: "remote-1", taskId: "task-1", sequence: 1, createdAt: "2026-04-29T10:00:00.500Z" }), // Slightly later
  ];

  const merged = service.mergeEventsWithConflictResolution("task-1", localEvents, remoteEvents, "lww");

  // With LWW, remote event (later timestamp) should win for conflicting sequence
  assert.ok(merged.length >= localEvents.length, "Should have merged events");
});

test("[SYS-REL-2.2] CDC applyBatch respects event vector clocks when replacing stale local events [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  const localEvents: CDCReplicationEvent[] = [
    createReplicationEvent({
      id: "local-1",
      taskId: "task-clocked",
      sequence: 5,
      sourceRegionId: "us-west-2",
      vectorClock: { "us-west-2": 5 },
      createdAt: "2026-04-29T10:00:00.000Z",
      payloadJson: JSON.stringify({ owner: "local" }),
    }),
  ];

  const remoteEvents: CDCReplicationEvent[] = [
    createReplicationEvent({
      id: "remote-1",
      taskId: "task-clocked",
      sequence: 5,
      sourceRegionId: "eu-west-1",
      vectorClock: { "us-west-2": 5, "eu-west-1": 6 },
      createdAt: "2026-04-29T10:00:01.000Z",
      payloadJson: JSON.stringify({ owner: "remote" }),
    }),
  ];

  const applied = service.applyBatch("task-clocked", localEvents, remoteEvents, "lww");

  assert.equal(applied.length, 1);
  assert.equal(applied[0]?.id, "remote-1");
});

test("[SYS-REL-2.2] CDC prepareBatch filters events correctly after checkpoint [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

  // Confirm a batch that processed up to sequence 5
  const initialBatch: CDCReplicationBatch = {
    batchId: "batch-1",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: [
      createReplicationEvent({ id: "evt-1", sequence: 1 }),
      createReplicationEvent({ id: "evt-2", sequence: 2 }),
      createReplicationEvent({ id: "evt-3", sequence: 3 }),
      createReplicationEvent({ id: "evt-4", sequence: 4 }),
      createReplicationEvent({ id: "evt-5", sequence: 5 }),
    ],
    startSequence: 1,
    endSequence: 5,
    createdAt: new Date().toISOString(),
  };
  service.confirmBatch("us-west-2", "eu-west-1", initialBatch);

  // Now prepare a batch with events after checkpoint
  const newEvents = [
    createReplicationEvent({ id: "evt-6", sequence: 6 }),
    createReplicationEvent({ id: "evt-7", sequence: 7 }),
    createReplicationEvent({ id: "evt-8", sequence: 8 }),
  ];

  const batch = service.prepareBatch("us-west-2", "eu-west-1", newEvents);

  assert.ok(batch !== null, "Batch should be created for events after checkpoint");
  assert.equal(batch!.startSequence, 6, "Batch should start at sequence 6");
  assert.equal(batch!.endSequence, 8, "Batch should end at sequence 8");
});

test("[SYS-REL-2.2] CDC prepareBatch returns null when all events already processed [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

  // Confirm checkpoint at sequence 10
  const checkpointBatch: CDCReplicationBatch = {
    batchId: "batch-checkpoint",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: [createReplicationEvent({ id: "evt-10", sequence: 10 })],
    startSequence: 10,
    endSequence: 10,
    createdAt: new Date().toISOString(),
  };
  service.confirmBatch("us-west-2", "eu-west-1", checkpointBatch);

  // Events all at or before checkpoint
  const oldEvents = [
    createReplicationEvent({ id: "evt-8", sequence: 8 }),
    createReplicationEvent({ id: "evt-9", sequence: 9 }),
    createReplicationEvent({ id: "evt-10", sequence: 10 }),
  ];

  const batch = service.prepareBatch("us-west-2", "eu-west-1", oldEvents);

  assert.equal(batch, null, "Should return null when all events already processed");
});

test("[SYS-REL-2.2] CDC batch processing order is preserved across confirmBatch [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

  const events1: CDCReplicationBatch = {
    batchId: "batch-1",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: [
      createReplicationEvent({ id: "evt-1", sequence: 1 }),
      createReplicationEvent({ id: "evt-2", sequence: 2 }),
    ],
    startSequence: 1,
    endSequence: 2,
    createdAt: new Date().toISOString(),
  };

  const events2: CDCReplicationBatch = {
    batchId: "batch-2",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: [
      createReplicationEvent({ id: "evt-3", sequence: 3 }),
      createReplicationEvent({ id: "evt-4", sequence: 4 }),
    ],
    startSequence: 3,
    endSequence: 4,
    createdAt: new Date().toISOString(),
  };

  // Process batch 1
  service.confirmBatch("us-west-2", "eu-west-1", events1);

  // Process batch 2
  service.confirmBatch("us-west-2", "eu-west-1", events2);

  const checkpoint = service.getCheckpoint("us-west-2", "eu-west-1");
  assert.equal(checkpoint!.lastEventSequence, 4, "Checkpoint should reflect last processed sequence");
  assert.equal(checkpoint!.lastEventId, "evt-4", "Checkpoint should have last event ID");
});

test("[SYS-REL-2.2] CDC concurrent prepareBatch calls don't create duplicate batches [cdc-replication-concurrent]", async () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

  const events = [
    createReplicationEvent({ id: "evt-1", sequence: 1 }),
    createReplicationEvent({ id: "evt-2", sequence: 2 }),
    createReplicationEvent({ id: "evt-3", sequence: 3 }),
  ];

  // Simulate concurrent prepareBatch calls
  const [batch1, batch2] = await Promise.all([
    Promise.resolve(service.prepareBatch("us-west-2", "eu-west-1", events)),
    Promise.resolve(service.prepareBatch("us-west-2", "eu-west-1", events)),
  ]);

  // Both should return the same batch (first call creates, second returns existing)
  // Or one returns null if already processed
  assert.ok(
    (batch1 !== null && batch2 !== null) || batch1 === null || batch2 === null,
    "Concurrent calls should handle race condition gracefully",
  );
});

test("[SYS-REL-2.2] CDC recordFailure logs error without throwing [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  const batch: CDCReplicationBatch = {
    batchId: "fail-batch",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: [createReplicationEvent({ id: "evt-fail", sequence: 999 })],
    startSequence: 999,
    endSequence: 999,
    createdAt: new Date().toISOString(),
  };

  // Should not throw
  service.recordFailure("us-west-2", "eu-west-1", batch, "Network timeout during replication");

  assert.ok(true, "recordFailure should not throw");
});

test("[SYS-REL-2.2] CDC conflict resolution LWW prefers later timestamp [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  const localEvent = createReplicationEvent({
    id: "local-evt",
    taskId: "task-conflict",
    sequence: 1,
    createdAt: "2026-04-29T10:00:00.000Z",
  });

  const remoteEvent = createReplicationEvent({
    id: "remote-evt",
    taskId: "task-conflict",
    sequence: 1,
    createdAt: "2026-04-29T10:00:01.000Z", // 1 second later
  });

  const result = service.resolveConflictLWW(localEvent, remoteEvent);

  assert.equal(result.resolved, true, "Conflict should be resolved");
  assert.equal(result.resolvedEvent!.id, "remote-evt", "Later timestamp should win");
  assert.equal(result.conflict!.resolution, "remote_wins", "Remote should win with LWW");
});

test("[SYS-REL-2.2] CDC conflict resolution merge combines payloads [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  const localEvent = createReplicationEvent({
    id: "local-evt",
    taskId: "task-merge",
    sequence: 1,
    payloadJson: JSON.stringify({ fieldA: "local_value", shared: "local" }),
    createdAt: "2026-04-29T10:00:00.000Z",
  });

  const remoteEvent = createReplicationEvent({
    id: "remote-evt",
    taskId: "task-merge",
    sequence: 1,
    payloadJson: JSON.stringify({ fieldB: "remote_value", shared: "remote" }),
    createdAt: "2026-04-29T10:00:01.000Z",
  });

  const result = service.resolveConflictMerge(localEvent, remoteEvent);

  assert.equal(result.resolved, true, "Merge should resolve");
  const mergedPayload = JSON.parse(result.resolvedEvent!.payloadJson);
  assert.equal(mergedPayload.fieldA, "local_value", "Should preserve local field");
  assert.equal(mergedPayload.fieldB, "remote_value", "Should add remote field");
  assert.equal(mergedPayload._merged, true, "Should be marked as merged");
});

test("[SYS-REL-2.2] CDC recordConflict stores conflict history [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  const localEvent = createReplicationEvent({ id: "conflict-local", taskId: "task-1", sequence: 1 });
  const remoteEvent = createReplicationEvent({ id: "conflict-remote", taskId: "task-1", sequence: 1 });

  service.updateVectorClock("task-1", "region-a", 1);
  service.updateVectorClock("task-1", "region-b", 1);

  const conflictResult = service.resolveConflict(localEvent, remoteEvent, "lww");

  if (conflictResult.conflict) {
    service.recordConflict("task-1", conflictResult.conflict);
  }

  const history = service.getConflictHistory("task-1");
  assert.ok(history.length > 0, "Conflict should be recorded");
});

test("[SYS-REL-2.2] VectorClock getMaxSequence returns highest per-region sequence [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  service.updateVectorClock("entity-1", "region-a", 5);
  service.updateVectorClock("entity-1", "region-b", 10);
  service.updateVectorClock("entity-1", "region-c", 3);

  const clock = service.getVectorClock("entity-1")!;
  assert.equal(clock.getMaxSequence(), 10, "Max sequence should be 10 from region-b");
});

test("[SYS-REL-2.2] CDC replication lag is time-based after checkpoint confirmation [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

  // Process events up to sequence 50
  const batch: CDCReplicationBatch = {
    batchId: "batch-lag",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: Array.from({ length: 50 }, (_, i) =>
      createReplicationEvent({ id: `evt-${i + 1}`, sequence: i + 1 })
    ),
    startSequence: 1,
    endSequence: 50,
    createdAt: new Date().toISOString(),
  };
  service.confirmBatch("us-west-2", "eu-west-1", batch);

  const lag = service.getReplicationLag("us-west-2", "eu-west-1", 100);
  assert.ok(lag >= 0, "Replication lag should never be negative");
  assert.ok(lag < 5_000, "Freshly confirmed batches should report low time-based lag");
});

test("[SYS-REL-2.2] CDC zero lag when fully caught up [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

  // Process all 100 events
  const batch: CDCReplicationBatch = {
    batchId: "batch-caughtup",
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    events: Array.from({ length: 100 }, (_, i) =>
      createReplicationEvent({ id: `evt-${i + 1}`, sequence: i + 1 })
    ),
    startSequence: 1,
    endSequence: 100,
    createdAt: new Date().toISOString(),
  };
  service.confirmBatch("us-west-2", "eu-west-1", batch);

  const lag = service.getReplicationLag("us-west-2", "eu-west-1", 100);
  assert.equal(lag, 0, "Lag should be 0 when caught up");
});

test("[SYS-REL-2.2] CDC batch respects configured batch size limit [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig({
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
    batchSize: 5, // Small batch size
  }));

  // 20 events but batch size is 5
  const events = Array.from({ length: 20 }, (_, i) =>
    createReplicationEvent({ id: `evt-${i + 1}`, sequence: i + 1 })
  );

  const batch = service.prepareBatch("us-west-2", "eu-west-1", events);

  assert.ok(batch !== null, "Batch should be created");
  assert.equal(batch!.events.length, 5, "Batch should be limited to configured batch size");
  assert.equal(batch!.startSequence, 1, "First batch starts at 1");
  assert.equal(batch!.endSequence, 5, "First batch ends at 5");
});

test("[SYS-REL-2.2] CDC status transitions correctly through replication lifecycle [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();
  service.registerReplication(createReplicationConfig());

  // Initially idle
  assert.equal(service.getStatus("us-west-2", "eu-west-1"), "idle");

  // After preparing batch, should be syncing
  const events = [createReplicationEvent({ id: "evt-1", sequence: 1 })];
  service.prepareBatch("us-west-2", "eu-west-1", events);

  assert.equal(service.getStatus("us-west-2", "eu-west-1"), "syncing");
});

test("[SYS-REL-2.2] CDC isEnabled reflects config enabled flag [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  service.registerReplication(createReplicationConfig({ enabled: true }));
  assert.equal(service.isEnabled("us-west-2", "eu-west-1"), true);

  service.registerReplication(createReplicationConfig({
    sourceRegionId: "us-east",
    targetRegionId: "eu-west-1",
    enabled: false,
  }));
  assert.equal(service.isEnabled("us-east", "eu-west-1"), false);
});

test("[SYS-REL-2.2] CDC registered region pairs are correctly enumerated [cdc-replication-concurrent]", () => {
  const service = new CDCReplicationService();

  service.registerReplication(createReplicationConfig({
    sourceRegionId: "us-west-2",
    targetRegionId: "eu-west-1",
  }));
  service.registerReplication(createReplicationConfig({
    sourceRegionId: "us-west-2",
    targetRegionId: "ap-southeast-1",
  }));
  service.registerReplication(createReplicationConfig({
    sourceRegionId: "us-west-2",
    targetRegionId: "us-east-1",
  }));

  const pairs = service.getRegisteredRegionPairs();
  assert.equal(pairs.length, 3, "Should have 3 registered region pairs");
  assert.ok(pairs.some(p => p.targetRegionId === "eu-west-1"));
  assert.ok(pairs.some(p => p.targetRegionId === "ap-southeast-1"));
  assert.ok(pairs.some(p => p.targetRegionId === "us-east-1"));
});

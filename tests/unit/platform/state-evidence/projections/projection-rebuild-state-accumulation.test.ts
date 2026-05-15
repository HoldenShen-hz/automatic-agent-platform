import test from "node:test";
import assert from "node:assert/strict";

import {
  ProjectionRebuildService,
  ProjectionHandlerRegistry,
  type ProjectionHandler,
  type ProjectionInputEvent,
} from "../../../../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";

/**
 * R16-28 CRITICAL Audit Fix Test
 *
 * Requirement: §25.4 requires rebuildProjection() to accumulate state across events.
 *
 * Issue: rebuildProjection() passes null state for each event. Does not accumulate
 * state, rebuild produces empty/single-event projection.
 *
 * Root cause: The projection rebuild service passes null state to each event handler,
 * so state is never accumulated across events. The rebuild produces incorrect
 * projections because it can't build up the full state.
 *
 * Fix: The rebuildProjection() must maintain state across events. Initialize with
 * the current projection state and pass it through each event handler, accumulating
 * changes. Use proper state accumulation instead of passing null.
 */
test("R16-28: rebuildProjection() accumulates state across multiple events", () => {
  // Create a handler that tracks how state is accumulated
  let stateHistory: Array<Record<string, unknown> | null> = [];

  const handler: ProjectionHandler = (state, event) => {
    // Record the state passed to each event handler call
    stateHistory.push(state);

    const newState = state ? { ...state } : {};
    newState.lastEventId = event.eventId;
    newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;

    // Track accumulated values
    if (event.eventType === "task:created") {
      newState.taskId = event.taskId;
      newState.created = true;
    } else if (event.eventType === "task:status_changed") {
      newState.statusChanged = true;
    }

    return newState;
  };

  // Mock event repository with multiple events
  const mockEventRepo = {
    listAllEvents: () => [
      {
        id: "evt_1",
        taskId: "task_1",
        eventType: "task:created",
        payloadJson: '{"status":"created"}',
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "evt_2",
        taskId: "task_1",
        eventType: "task:status_changed",
        payloadJson: '{"toStatus":"in_progress"}',
        createdAt: "2024-01-01T00:01:00Z",
      },
      {
        id: "evt_3",
        taskId: "task_1",
        eventType: "task:completed",
        payloadJson: '{"status":"completed"}',
        createdAt: "2024-01-01T00:02:00Z",
      },
    ],
  };

  const service = new ProjectionRebuildService(mockEventRepo as any);
  service.registerHandler("accumulation_test", handler);

  // Clear history before rebuild
  stateHistory = [];

  const result = service.rebuildProjection("accumulation_test");
  const snapshot = service.getProjectionSnapshotStatus("accumulation_test").active;

  // R16-28 CRITICAL FIX: All 3 events should be processed
  assert.equal(result.eventsProcessed, 3, "Should process all 3 events");

  // R16-28 CRITICAL FIX: State should accumulate across events
  // First event gets null state (initialization)
  // Second event gets state after first event
  // Third event gets state after second event
  assert.equal(stateHistory.length, 3, "Should call handler 3 times");
  assert.equal(stateHistory[0], null, "First call should receive null state");
  assert.ok(stateHistory[1] !== null, "Second call should receive accumulated state");
  assert.ok(stateHistory[2] !== null, "Third call should receive accumulated state");

  // R16-28 CRITICAL FIX: Snapshot should reflect accumulated state
  assert.ok(snapshot, "Snapshot should be created");
  assert.equal(snapshot?.state.eventCount, 3, "Should accumulate event count to 3");
  assert.equal(snapshot?.state.lastEventId, "evt_3", "Should track last event ID");
  assert.equal(snapshot?.state.created, true, "Should have 'created' flag from first event");
  assert.equal(snapshot?.state.statusChanged, true, "Should have 'statusChanged' flag from second event");
});

test("R16-28: rebuildProjection() uses batched state accumulation", () => {
  // Handler that adds a unique marker per event to verify state isn't reset between batches
  let batchCounter = 0;

  const handler: ProjectionHandler = (state, event) => {
    const newState = state ? { ...state } : {};
    newState.lastEventId = event.eventId;
    newState.eventCount = ((state?.eventCount as number) ?? 0) + 1;
    newState.batch = batchCounter;
    return newState;
  };

  // Mock event repository with multiple events that will be batched
  // Default batch size is 1000, but we test with small batches
  const events = [
    { id: "evt_batch_1", taskId: "task_batch", eventType: "task:created", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    { id: "evt_batch_2", taskId: "task_batch", eventType: "task:status_changed", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
  ];

  const mockEventRepo = {
    listAllEvents: (limit: number, offset: number) => {
      return events.slice(offset, offset + limit);
    },
  };

  const service = new ProjectionRebuildService(mockEventRepo as any);
  service.registerHandler("batched_test", handler);

  const result = service.rebuildProjection("batched_test", { batchSize: 1 });
  const snapshot = service.getProjectionSnapshotStatus("batched_test").active;

  // R16-28 CRITICAL FIX: Should process all events and accumulate state across batches
  assert.equal(result.eventsProcessed, 2, "Should process all 2 events");
  assert.equal(result.projectionsUpdated, 2, "Should update projection for each event");

  // R16-28 CRITICAL FIX: Final state should reflect both events
  assert.ok(snapshot, "Snapshot should be created");
  assert.equal(snapshot?.state.eventCount, 2, "Should accumulate to 2 events");
  assert.equal(snapshot?.state.lastEventId, "evt_batch_2", "Last event should be evt_batch_2");
});

test("R16-28: rebuildProjection() handles handler that returns null incorrectly", () => {
  // Handler that might return null (malformed handler)
  const fragileHandler: ProjectionHandler = (state, event) => {
    if (event.eventId === "evt_malformed") {
      // This simulates a bug where handler returns null
      return null as unknown as Record<string, unknown>;
    }
    return {
      ...(state ?? {}),
      lastEventId: event.eventId,
      eventCount: ((state?.eventCount as number) ?? 0) + 1,
    };
  };

  const mockEventRepo = {
    listAllEvents: () => [
      { id: "evt_normal_1", taskId: "task_fragile", eventType: "task:created", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
      { id: "evt_malformed", taskId: "task_fragile", eventType: "task:status_changed", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
      { id: "evt_normal_2", taskId: "task_fragile", eventType: "task:completed", payloadJson: "{}", createdAt: "2024-01-01T00:02:00Z" },
    ],
  };

  const service = new ProjectionRebuildService(mockEventRepo as any);
  service.registerHandler("fragile_test", fragileHandler);

  // This should handle gracefully - the rebuild should still work
  const result = service.rebuildProjection("fragile_test");
  const snapshot = service.getProjectionSnapshotStatus("fragile_test").active;

  // The rebuild service should handle this case - either by not calling with null
  // or by properly initializing state when handler returns null
  assert.ok(result, "Rebuild should complete without throwing");
});

test("R16-28: rebuildProjection() correctly initializes empty state", () => {
  const handler: ProjectionHandler = (state, event) => {
    // Verify state is properly initialized when null
    const initialState = state ?? {};
    return {
      ...initialState,
      initialized: state !== null,
      lastEventId: event.eventId,
      eventCount: ((state?.eventCount as number) ?? 0) + 1,
    };
  };

  const mockEventRepo = {
    listAllEvents: () => [
      { id: "evt_init_1", taskId: "task_init", eventType: "task:created", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    ],
  };

  const service = new ProjectionRebuildService(mockEventRepo as any);
  service.registerHandler("init_test", handler);

  const result = service.rebuildProjection("init_test");
  const snapshot = service.getProjectionSnapshotStatus("init_test").active;

  // R16-28 CRITICAL FIX: Should properly initialize and accumulate
  assert.equal(result.eventsProcessed, 1, "Should process 1 event");
  assert.ok(snapshot, "Snapshot should be created");
  assert.equal(snapshot?.state.eventCount, 1, "Should have event count of 1");
});

test("R16-28: shadow build also accumulates state correctly", () => {
  const handler: ProjectionHandler = (state, event) => {
    return {
      ...(state ?? {}),
      lastEventId: event.eventId,
      eventCount: ((state?.eventCount as number) ?? 0) + 1,
    };
  };

  const mockEventRepo = {
    listAllEvents: () => [
      { id: "evt_shadow_1", taskId: "task_shadow", eventType: "task:created", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
      { id: "evt_shadow_2", taskId: "task_shadow", eventType: "task:status_changed", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
    ],
  };

  const service = new ProjectionRebuildService(mockEventRepo as any);
  service.registerHandler("shadow_test", handler);

  // Do shadow build
  const result = service.shadowBuildProjection("shadow_test");
  const shadowSnapshot = service.getProjectionSnapshotStatus("shadow_test").shadow;

  // R16-28 CRITICAL FIX: Shadow build should also accumulate state correctly
  assert.equal(result.eventsProcessed, 2, "Should process 2 events");
  assert.ok(shadowSnapshot, "Shadow snapshot should be created");
  assert.equal(shadowSnapshot?.state.eventCount, 2, "Should accumulate event count to 2");
  assert.equal(shadowSnapshot?.state.lastEventId, "evt_shadow_2", "Should track last event ID");
});

test("R16-28: compareShadowProjection works when both builds accumulate correctly", () => {
  const handler: ProjectionHandler = (state, event) => {
    return {
      ...(state ?? {}),
      lastEventId: event.eventId,
      eventCount: ((state?.eventCount as number) ?? 0) + 1,
      eventTypes: [...(state?.eventTypes as string[] ?? []), event.eventType],
    };
  };

  const mockEventRepo = {
    listAllEvents: () => [
      { id: "evt_compare_1", taskId: "task_compare", eventType: "task:created", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
      { id: "evt_compare_2", taskId: "task_compare", eventType: "task:status_changed", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
    ],
  };

  const service = new ProjectionRebuildService(mockEventRepo as any);
  service.registerHandler("compare_test", handler);

  // Build both active and shadow from same events
  service.rebuildProjection("compare_test");
  service.shadowBuildProjection("compare_test");

  const comparison = service.compareShadowProjection("compare_test");

  // R16-28 CRITICAL FIX: Both builds should produce same state when given same events
  assert.equal(comparison.matches, true, "Active and shadow builds should match");
  assert.ok(comparison.activeHash, "Should have active hash");
  assert.ok(comparison.shadowHash, "Should have shadow hash");
  assert.equal(comparison.activeHash, comparison.shadowHash, "Hashes should be equal");
});

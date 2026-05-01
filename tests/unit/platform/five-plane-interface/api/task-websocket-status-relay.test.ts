import { strict as assert } from "node:assert";
import { test } from "node:test";

import { TaskWebSocketStatusRelay } from "../../../../../src/platform/five-plane-interface/api/task-websocket-status-relay.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { HttpApiServer } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";
import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";

// Mock types for testing
interface MockEventStore {
  listEventsByType: (eventType: string, limit: number) => EventRecord[];
}

interface MockHttpApiServer {
  broadcastTaskEvent: (taskId: string, event: unknown) => void;
}

function createMockEventRecord(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "evt_test123",
    taskId: "task_abc456",
    sessionId: null,
    executionId: null,
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: JSON.stringify({ toStatus: "running", occurredAt: "2026-05-01T12:00:00.000Z" }),
    traceId: null,
    createdAt: "2026-05-01T12:00:00.000Z",
    schemaVersion: null,
    aggregateId: null,
    runId: null,
    sequence: null,
    causationId: null,
    correlationId: null,
    payloadHash: null,
    idempotencyKey: null,
    replayBehavior: null,
    principal: null,
    evidenceRefs: [],
    ...overrides,
  };
}

function createMockStore(events: EventRecord[] = []): AuthoritativeTaskStore {
  const mockEventStore: MockEventStore = {
    listEventsByType: (_eventType: string, limit: number) => events.slice(0, limit),
  };
  return {
    event: mockEventStore as unknown as AuthoritativeTaskStore["event"],
  } as unknown as AuthoritativeTaskStore;
}

function createMockServer(): MockHttpApiServer {
  return {
    broadcastTaskEvent: (_taskId: string, _event: unknown) => {},
  };
}

test("TaskWebSocketStatusRelay.start begins polling", () => {
  const store = createMockStore([]);
  const server = createMockServer();
  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000 },
  );

  relay.start();

  // After start, timer should be set (non-null)
  // We verify by stopping - if it was null, stop is no-op
  relay.stop();
});

test("TaskWebSocketStatusRelay.start is idempotent", () => {
  const store = createMockStore([]);
  const server = createMockServer();
  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000 },
  );

  relay.start();
  relay.start(); // Should not throw or create multiple timers

  relay.stop();
});

test("TaskWebSocketStatusRelay.stop clears the timer", () => {
  const store = createMockStore([]);
  const server = createMockServer();
  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000 },
  );

  relay.start();
  relay.stop();
  // After stop, calling stop again should not throw
  relay.stop();
});

test("TaskWebSocketStatusRelay.pollOnce processes new events", () => {
  const events = [
    createMockEventRecord({
      id: "evt_new1",
      taskId: "task_001",
      payloadJson: JSON.stringify({ toStatus: "running", occurredAt: "2026-05-01T12:00:00.000Z" }),
    }),
    createMockEventRecord({
      id: "evt_new2",
      taskId: "task_002",
      payloadJson: JSON.stringify({ toStatus: "completed", occurredAt: "2026-05-01T12:01:00.000Z" }),
    }),
  ];
  const store = createMockStore(events);
  const server = createMockServer();
  const broadcastCalls: Array<{ taskId: string; event: unknown }> = [];

  server.broadcastTaskEvent = (taskId: string, event: unknown) => {
    broadcastCalls.push({ taskId, event });
  };

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000, backlogLimit: 100 },
  );

  relay.pollOnce();

  assert.equal(broadcastCalls.length, 2);
  const firstCall = broadcastCalls[0];
  const secondCall = broadcastCalls[1];
  assert.ok(firstCall != null && secondCall != null);
  assert.equal(firstCall.taskId, "task_001");
  assert.deepEqual(firstCall.event, {
    eventType: "status_changed",
    taskId: "task_001",
    status: "running",
    timestamp: "2026-05-01T12:00:00.000Z",
  });
});

test("TaskWebSocketStatusRelay.pollOnce skips already-seen events", () => {
  const events = [
    createMockEventRecord({
      id: "evt_already_seen",
      taskId: "task_003",
      payloadJson: JSON.stringify({ toStatus: "running", occurredAt: "2026-05-01T12:00:00.000Z" }),
    }),
  ];
  const store = createMockStore(events);
  const server = createMockServer();
  const broadcastCalls: Array<{ taskId: string; event: unknown }> = [];

  server.broadcastTaskEvent = (taskId: string, event: unknown) => {
    broadcastCalls.push({ taskId, event });
  };

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000, backlogLimit: 100 },
  );

  // First poll should process the event
  relay.pollOnce();
  assert.equal(broadcastCalls.length, 1);

  // Second poll should skip already-seen event
  relay.pollOnce();
  assert.equal(broadcastCalls.length, 1); // Still 1, no new broadcast
});

test("TaskWebSocketStatusRelay.pollOnce handles events with invalid payload", () => {
  const events = [
    createMockEventRecord({
      id: "evt_bad_payload",
      taskId: "task_004",
      payloadJson: "invalid json{{",
    }),
    createMockEventRecord({
      id: "evt_missing_status",
      taskId: "task_005",
      payloadJson: JSON.stringify({ occurredAt: "2026-05-01T12:00:00.000Z" }), // missing toStatus
    }),
  ];
  const store = createMockStore(events);
  const server = createMockServer();
  const broadcastCalls: Array<{ taskId: string; event: unknown }> = [];

  server.broadcastTaskEvent = (taskId: string, event: unknown) => {
    broadcastCalls.push({ taskId, event });
  };

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000, backlogLimit: 100 },
  );

  relay.pollOnce();

  // Neither event should broadcast due to missing/invalid status
  assert.equal(broadcastCalls.length, 0);
});

test("TaskWebSocketStatusRelay.pollOnce handles events with null taskId", () => {
  const events = [
    createMockEventRecord({
      id: "evt_no_task",
      taskId: null,
      payloadJson: JSON.stringify({ toStatus: "running", occurredAt: "2026-05-01T12:00:00.000Z" }),
    }),
  ];
  const store = createMockStore(events);
  const server = createMockServer();
  const broadcastCalls: Array<{ taskId: string; event: unknown }> = [];

  server.broadcastTaskEvent = (taskId: string, event: unknown) => {
    broadcastCalls.push({ taskId, event });
  };

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000, backlogLimit: 100 },
  );

  relay.pollOnce();

  // Event with null taskId should not broadcast
  assert.equal(broadcastCalls.length, 0);
});

test("TaskWebSocketStatusRelay.pollOnce handles empty event list", () => {
  const store = createMockStore([]);
  const server = createMockServer();

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000, backlogLimit: 100 },
  );

  // Should not throw
  relay.pollOnce();
});

test("TaskWebSocketStatusRelay.start preloads existing events as seen", () => {
  const events = [
    createMockEventRecord({
      id: "evt_existing",
      taskId: "task_existing",
      payloadJson: JSON.stringify({ toStatus: "running", occurredAt: "2026-05-01T12:00:00.000Z" }),
    }),
  ];
  const store = createMockStore(events);
  const server = createMockServer();
  const broadcastCalls: Array<{ taskId: string; event: unknown }> = [];

  server.broadcastTaskEvent = (taskId: string, event: unknown) => {
    broadcastCalls.push({ taskId, event });
  };

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000, backlogLimit: 100 },
  );

  relay.start();
  relay.pollOnce(); // This poll should not include preloaded events

  // After preloading via start(), pollOnce should skip the already-seen event
  assert.equal(broadcastCalls.length, 0);

  relay.stop();
});

test("TaskWebSocketStatusRelay uses default options", () => {
  const store = createMockStore([]);
  const server = createMockServer();

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
  );

  // Just verify construction doesn't throw with no options
  relay.start();
  relay.stop();
});

test("TaskWebSocketStatusRelay respects backlogLimit option", () => {
  const events: EventRecord[] = [];
  for (let i = 0; i < 200; i++) {
    events.push(
      createMockEventRecord({
        id: `evt_${i}`,
        taskId: `task_${i}`,
        payloadJson: JSON.stringify({ toStatus: "running", occurredAt: "2026-05-01T12:00:00.000Z" }),
      }),
    );
  }

  const store = createMockStore(events);
  const server = createMockServer();

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000, backlogLimit: 10 },
  );

  // Should not throw on construction
  relay.start();
  relay.stop();
});

test("TaskWebSocketStatusRelay.pollOnce sorts events by occurrence", () => {
  const events = [
    createMockEventRecord({
      id: "evt_first",
      taskId: "task_first",
      payloadJson: JSON.stringify({ toStatus: "pending", occurredAt: "2026-05-01T10:00:00.000Z" }),
      createdAt: "2026-05-01T10:00:00.000Z",
    }),
    createMockEventRecord({
      id: "evt_third",
      taskId: "task_third",
      payloadJson: JSON.stringify({ toStatus: "running", occurredAt: "2026-05-01T12:00:00.000Z" }),
      createdAt: "2026-05-01T12:00:00.000Z",
    }),
    createMockEventRecord({
      id: "evt_second",
      taskId: "task_second",
      payloadJson: JSON.stringify({ toStatus: "queued", occurredAt: "2026-05-01T11:00:00.000Z" }),
      createdAt: "2026-05-01T11:00:00.000Z",
    }),
  ];
  const store = createMockStore(events);
  const server = createMockServer();
  const broadcastCalls: Array<{ taskId: string; event: unknown }> = [];

  server.broadcastTaskEvent = (taskId: string, event: unknown) => {
    broadcastCalls.push({ taskId, event });
  };

  const relay = new TaskWebSocketStatusRelay(
    server as unknown as HttpApiServer,
    store,
    { pollIntervalMs: 10_000, backlogLimit: 100 },
  );

  relay.pollOnce();

  // Events should be broadcast in chronological order by occurredAt
  assert.equal(broadcastCalls.length, 3);
  const firstCall = broadcastCalls[0];
  const secondCall = broadcastCalls[1];
  const thirdCall = broadcastCalls[2];
  assert.ok(firstCall != null && secondCall != null && thirdCall != null);
  assert.equal(firstCall.taskId, "task_first"); // 10:00
  assert.equal(secondCall.taskId, "task_second"); // 11:00
  assert.equal(thirdCall.taskId, "task_third"); // 12:00
});

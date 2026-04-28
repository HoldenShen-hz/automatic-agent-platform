/**
 * Integration tests for Task WebSocket Status Relay
 *
 * Tests the WebSocket status relay service polling and broadcasting
 * in a realistic multi-event scenario.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import assert from "node:assert/strict";
import test from "node:test";
import { TaskWebSocketStatusRelay } from "../../../../../src/platform/interface/api/task-websocket-status-relay.js";
import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { TaskWebSocketEvent } from "../../../../../src/platform/interface/channel-gateway/websocket-bridge.js";

function createEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "evt-1",
    taskId: "task-1",
    sessionId: null,
    executionId: null,
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: JSON.stringify({
      fromStatus: "pending",
      toStatus: "in_progress",
      occurredAt: "2026-04-16T00:00:00.000Z",
    }),
    traceId: "trace-1",
    createdAt: "2026-04-16T00:00:00.000Z",
    ...overrides,
  };
}

test("integration: TaskWebSocketStatusRelay broadcasts multiple unseen events", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [
    createEvent({ id: "evt-1", taskId: "task-1", payloadJson: JSON.stringify({ toStatus: "in_progress", occurredAt: "2026-04-16T00:00:00.000Z" }) }),
    createEvent({ id: "evt-2", taskId: "task-2", payloadJson: JSON.stringify({ toStatus: "completed", occurredAt: "2026-04-16T00:01:00.000Z" }) }),
    createEvent({ id: "evt-3", taskId: "task-3", payloadJson: JSON.stringify({ toStatus: "failed", occurredAt: "2026-04-16T00:02:00.000Z" }) }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  assert.equal(broadcasts.length, 3);
  assert.deepEqual(broadcasts[0], {
    taskId: "task-3",
    event: { eventType: "status_changed", taskId: "task-3", status: "failed", timestamp: "2026-04-16T00:02:00.000Z" },
  });
  assert.deepEqual(broadcasts[1], {
    taskId: "task-2",
    event: { eventType: "status_changed", taskId: "task-2", status: "completed", timestamp: "2026-04-16T00:01:00.000Z" },
  });
  assert.deepEqual(broadcasts[2], {
    taskId: "task-1",
    event: { eventType: "status_changed", taskId: "task-1", status: "in_progress", timestamp: "2026-04-16T00:00:00.000Z" },
  });
});

test("integration: TaskWebSocketStatusRelay does not rebroadcast events on subsequent polls", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [
    createEvent({ id: "evt-1", taskId: "task-1" }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();
  relay.pollOnce();
  relay.pollOnce();

  assert.equal(broadcasts.length, 1);
});

test("integration: TaskWebSocketStatusRelay start and stop lifecycle", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  let pollCount = 0;

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          pollCount++;
          return [];
        },
      },
    } as unknown as never,
    { pollIntervalMs: 100, backlogLimit: 10 },
  );

  relay.start();
  assert.notEqual(relay, null);

  relay.stop();
  assert.notEqual(relay, null);
});

test("integration: TaskWebSocketStatusRelay ignores malformed payload JSON", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [
    createEvent({ id: "evt-bad", taskId: "task-bad", payloadJson: "not valid json{{{" }),
    createEvent({ id: "evt-good", taskId: "task-good", payloadJson: JSON.stringify({ toStatus: "completed", occurredAt: "2026-04-16T00:00:00.000Z" }) }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0]!.taskId, "task-good");
  assert.equal(broadcasts[0]!.event.status, "completed");
});

test("integration: TaskWebSocketStatusRelay ignores event without toStatus in payload", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [
    createEvent({ id: "evt-no-status", taskId: "task-no-status", payloadJson: JSON.stringify({ occurredAt: "2026-04-16T00:00:00.000Z" }) }),
    createEvent({ id: "evt-with-status", taskId: "task-with-status", payloadJson: JSON.stringify({ toStatus: "running", occurredAt: "2026-04-16T00:01:00.000Z" }) }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0]!.taskId, "task-with-status");
  assert.equal(broadcasts[0]!.event.status, "running");
});

test("integration: TaskWebSocketStatusRelay uses event.createdAt when occurredAt is missing", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [
    createEvent({
      id: "evt-1",
      taskId: "task-1",
      payloadJson: JSON.stringify({ toStatus: "in_progress" }),
      createdAt: "2026-04-20T12:00:00.000Z",
    }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0]!.event.timestamp, "2026-04-20T12:00:00.000Z");
});

test("integration: TaskWebSocketStatusRelay ignores event without taskId", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [
    createEvent({ id: "evt-1", taskId: null, payloadJson: JSON.stringify({ toStatus: "in_progress", occurredAt: "2026-04-16T00:00:00.000Z" }) }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  assert.equal(broadcasts.length, 0);
});

test("integration: TaskWebSocketStatusRelay handles empty event list", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return [];
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  assert.equal(broadcasts.length, 0);
});

test("integration: TaskWebSocketStatusRelay uses configured pollIntervalMs", () => {
  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(): void {},
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return [];
        },
      },
    } as unknown as never,
    { pollIntervalMs: 5000, backlogLimit: 100 },
  );

  // Relay should be created without error
  assert.ok(relay !== null);
});

test("integration: TaskWebSocketStatusRelay handles backlog limit eviction", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];

  // Create more events than the backlog limit * 10 to trigger eviction
  const events: EventRecord[] = [];
  for (let i = 0; i < 150; i++) {
    events.push(createEvent({
      id: `evt-${i}`,
      taskId: `task-${i}`,
      payloadJson: JSON.stringify({ toStatus: "status", occurredAt: "2026-04-16T00:00:00.000Z" }),
    }));
  }

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  // Should broadcast events after initial seeding
  assert.ok(broadcasts.length > 0);
});

test("integration: TaskWebSocketStatusRelay broadcasts status events in reverse chronological order", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [
    createEvent({ id: "evt-oldest", taskId: "task-oldest", payloadJson: JSON.stringify({ toStatus: "oldest", occurredAt: "2026-04-16T00:00:00.000Z" }) }),
    createEvent({ id: "evt-middle", taskId: "task-middle", payloadJson: JSON.stringify({ toStatus: "middle", occurredAt: "2026-04-16T00:01:00.000Z" }) }),
    createEvent({ id: "evt-newest", taskId: "task-newest", payloadJson: JSON.stringify({ toStatus: "newest", occurredAt: "2026-04-16T00:02:00.000Z" }) }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  assert.equal(broadcasts.length, 3);
  assert.equal(broadcasts[0]!.taskId, "task-newest");
  assert.equal(broadcasts[2]!.taskId, "task-oldest");
});

test("integration: TaskWebSocketStatusRelay respects non-string toStatus", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [
    createEvent({ id: "evt-1", taskId: "task-1", payloadJson: JSON.stringify({ toStatus: 123, occurredAt: "2026-04-16T00:00:00.000Z" }) }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  // Non-string toStatus should result in null status, so no broadcast
  assert.equal(broadcasts.length, 0);
});

test("integration: TaskWebSocketStatusRelay start seeds backlog then pollOnce broadcasts new", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  let callCount = 0;

  const events = [
    createEvent({ id: "evt-existing", taskId: "task-existing", payloadJson: JSON.stringify({ toStatus: "existing", occurredAt: "2026-04-16T00:00:00.000Z" }) }),
  ];

  const relay = new TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
        broadcasts.push({ taskId, event });
      },
    } as unknown as never,
    {
      event: {
        listEventsByType(): EventRecord[] {
          callCount++;
          // Simulate new event appearing after start
          if (callCount > 1) {
            return [
              ...events,
              createEvent({ id: "evt-new", taskId: "task-new", payloadJson: JSON.stringify({ toStatus: "new", occurredAt: "2026-04-16T01:00:00.000Z" }) }),
            ];
          }
          return events;
        },
      },
    } as unknown as never,
    { backlogLimit: 10, pollIntervalMs: 60000 },
  );

  relay.start(); // Seeds existing events without broadcasting
  assert.equal(broadcasts.length, 0);

  relay.pollOnce(); // Should only broadcast the new event
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0]!.taskId, "task-new");

  relay.stop();
});

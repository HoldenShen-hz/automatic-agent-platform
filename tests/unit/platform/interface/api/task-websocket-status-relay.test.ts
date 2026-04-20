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

test("TaskWebSocketStatusRelay broadcasts unseen task status events", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [createEvent()];
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
  assert.deepEqual(broadcasts[0], {
    taskId: "task-1",
    event: {
      eventType: "status_changed",
      taskId: "task-1",
      status: "in_progress",
      timestamp: "2026-04-16T00:00:00.000Z",
    },
  });
});

test("TaskWebSocketStatusRelay does not rebroadcast already seen events", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [createEvent()];
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

  assert.equal(broadcasts.length, 1);
});

test("TaskWebSocketStatusRelay start primes existing backlog without replaying it", () => {
  const broadcasts: Array<{ taskId: string; event: TaskWebSocketEvent }> = [];
  const events = [createEvent()];
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
    { backlogLimit: 10, pollIntervalMs: 60_000 },
  );

  relay.start();
  relay.pollOnce();
  relay.stop();

  assert.equal(broadcasts.length, 0);
});

test("TaskWebSocketStatusRelay ignores malformed payloads", () => {
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
          return [
            createEvent({
              id: "evt-bad",
              payloadJson: "{\"oops\":",
            }),
          ];
        },
      },
    } as unknown as never,
    { backlogLimit: 10 },
  );

  relay.pollOnce();

  assert.equal(broadcasts.length, 0);
});

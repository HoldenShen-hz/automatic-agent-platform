/**
 * Unit tests for EventRepository with mocks.
 *
 * Tests the EventRepository event storage and consumer acknowledgement operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EventRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/event-repository.js";
import type { SqliteConnection } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";
import type { EventRecord, EventConsumerAckRecord, EventDeadLetterRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function createMockConnection(): { exec: () => void; prepare: (sql: string) => { run: (...params: unknown[]) => { changes: number }; all: () => unknown[]; get: () => unknown } } {
  return {
    exec: () => {},
    prepare: (sql: string) => ({
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    }),
  } as unknown as SqliteConnection;
}

test("EventRepository constructor works with connection", () => {
  const conn = createMockConnection();
  const repo = new EventRepository(conn);
  assert.ok(repo instanceof EventRepository, "Should create EventRepository instance");
});

test("EventRepository insertCostEvent calls prepare with correct SQL", () => {
  let capturedSql = "";

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  repo.insertCostEvent({
    id: "cost-001",
    taskId: "task-001",
    provider: "anthropic",
    costUsd: 0.05,
  });

  assert.ok(capturedSql.includes("INSERT INTO cost_events"), "Should insert into cost_events");
  assert.ok(capturedSql.includes("id, task_id"), "Should include id and task_id columns");
  assert.ok(capturedSql.includes("cost_usd"), "Should include cost_usd column");
});

test("EventRepository insertCostEvent handles optional fields", () => {
  let capturedParams: unknown[] = [];

  const mockPrepare = () => ({
    run: (...params: unknown[]) => {
      capturedParams = params;
      return { changes: 1 };
    },
    all: () => [],
    get: () => undefined,
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  repo.insertCostEvent({
    id: "cost-002",
    taskId: "task-001",
    sessionId: "session-001",
    executionId: "exec-001",
    agentId: "agent-001",
    provider: "openai",
    model: "gpt-4o",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.03,
    budgetScope: "task_execution",
    providerRequestId: "req-123",
    pricingVersion: "v1",
  });

  assert.equal(capturedParams[2], "session-001", "Session id should be present");
  assert.equal(capturedParams[3], "exec-001", "Execution id should be present");
  assert.equal(capturedParams[4], "agent-001", "Agent id should be present");
  assert.equal(capturedParams[6], "gpt-4o", "Model should be gpt-4o");
  assert.equal(capturedParams[7], 1000, "Input tokens should be 1000");
  assert.equal(capturedParams[8], 500, "Output tokens should be 500");
});

test("EventRepository getEvent returns mapped event record", () => {
  const mockEventResult = {
    id: "evt-001",
    taskId: "task-001",
    sessionId: null,
    executionId: "exec-001",
    eventType: "execution.started",
    eventTier: "tier_2",
    payloadJson: '{"message":"test"}',
    traceId: "trace-001",
    createdAt: "2026-05-18T10:00:00.000Z",
  };

  const mockPrepare = () => ({
    get: () => mockEventResult,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const result = repo.getEvent("evt-001");

  assert.ok(result !== undefined, "Should return an event");
  assert.equal(result.id, "evt-001");
  assert.equal(result.taskId, "task-001");
  assert.equal(result.eventType, "execution.started");
  assert.equal(result.eventTier, "tier_2");
});

test("EventRepository getEvent returns undefined for missing event", () => {
  const mockPrepare = () => ({
    get: () => undefined,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const result = repo.getEvent("nonexistent");
  assert.strictEqual(result, undefined, "Should return undefined for missing event");
});

test("EventRepository listEventsByType returns events filtered by type", () => {
  const mockEvents = [
    { id: "evt-001", taskId: "task-001", sessionId: null, executionId: "exec-001", eventType: "execution.started", eventTier: "tier_2", payloadJson: "{}", traceId: "trace-001", createdAt: "2026-05-18T10:00:00.000Z" },
    { id: "evt-002", taskId: "task-001", sessionId: null, executionId: "exec-001", eventType: "execution.started", eventTier: "tier_2", payloadJson: "{}", traceId: "trace-002", createdAt: "2026-05-18T10:01:00.000Z" },
  ];

  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      all: () => mockEvents,
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const results = repo.listEventsByType("execution.started");

  assert.ok(capturedSql.includes("event_type = ?"), "Should filter by event_type");
  assert.equal(results.length, 2, "Should return 2 events");
  assert.equal(results[0].eventType, "execution.started");
});

test("EventRepository listEventsByType respects limit", () => {
  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      all: () => [],
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  repo.listEventsByType("execution.started", 10);

  assert.ok(capturedSql.includes("LIMIT ?"), "Should include LIMIT clause");
});

test("EventRepository listAllEvents returns events with pagination", () => {
  const mockPrepare = (sql: string) => ({
    all: () => [],
    get: () => undefined,
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  // Just verify the method works and returns an array
  const result = repo.listAllEvents(100, 50);
  assert.ok(Array.isArray(result), "Should return an array");
});

test("EventRepository insertEventConsumerAck calls prepare with correct SQL", () => {
  let capturedParams: unknown[] = [];

  const mockPrepare = () => ({
    run: (...params: unknown[]) => {
      capturedParams = params;
      return { changes: 1 };
    },
    all: () => [],
    get: () => undefined,
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const ack: EventConsumerAckRecord = {
    id: "ack-001",
    eventId: "evt-001",
    consumerId: "dispatcher",
    status: "pending",
    lastAttemptAt: null,
    ackedAt: null,
    errorCode: null,
    attemptCount: 0,
  };

  repo.insertEventConsumerAck(ack);

  assert.ok(capturedParams.includes("ack-001"), "Should include ack id");
  assert.ok(capturedParams.includes("evt-001"), "Should include event id");
  assert.ok(capturedParams.includes("dispatcher"), "Should include consumer id");
  assert.ok(capturedParams.includes("pending"), "Should include pending status");
});

test("EventRepository getEventConsumerAck returns mapped ack record", () => {
  const mockAckResult = {
    id: "ack-001",
    eventId: "evt-001",
    consumerId: "dispatcher",
    status: "acked",
    lastAttemptAt: "2026-05-18T10:05:00.000Z",
    ackedAt: "2026-05-18T10:05:00.000Z",
    errorCode: null,
    attemptCount: 1,
  };

  const mockPrepare = () => ({
    get: () => mockAckResult,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const result = repo.getEventConsumerAck("evt-001", "dispatcher");

  assert.ok(result !== undefined, "Should return an ack");
  assert.equal(result.eventId, "evt-001");
  assert.equal(result.consumerId, "dispatcher");
  assert.equal(result.status, "acked");
});

test("EventRepository getEventConsumerAck returns undefined for missing ack", () => {
  const mockPrepare = () => ({
    get: () => undefined,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const result = repo.getEventConsumerAck("nonexistent", "dispatcher");
  assert.strictEqual(result, undefined, "Should return undefined for missing ack");
});

test("EventRepository insertEventDeadLetter calls prepare with correct SQL", () => {
  let capturedParams: unknown[] = [];

  const mockPrepare = () => ({
    run: (...params: unknown[]) => {
      capturedParams = params;
      return { changes: 1 };
    },
    all: () => [],
    get: () => undefined,
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const deadLetter: EventDeadLetterRecord = {
    id: "dl-001",
    originalEventId: "evt-001",
    eventType: "execution.completed",
    payloadJson: '{"error":"failed"}',
    consumerId: "dispatcher",
    failureCount: 3,
    lastError: "Processing timeout",
    deadLetteredAt: "2026-05-18T10:10:00.000Z",
    reprocessedAt: null,
    reprocessResult: null,
  };

  repo.insertEventDeadLetter(deadLetter);

  assert.ok(capturedParams.includes("dl-001"), "Should include dead letter id");
  assert.ok(capturedParams.includes("evt-001"), "Should include original event id");
  assert.ok(capturedParams.includes("dispatcher"), "Should include consumer id");
  assert.equal(capturedParams[5], 3, "Should include failure count");
});

test("EventRepository listEventDeadLetters returns dead letter records with limit", () => {
  const mockDeadLetters = [
    {
      id: "dl-001",
      originalEventId: "evt-001",
      eventType: "execution.completed",
      payloadJson: "{}",
      consumerId: "dispatcher",
      failureCount: 3,
      lastError: "Timeout",
      deadLetteredAt: "2026-05-18T10:10:00.000Z",
      reprocessedAt: null,
      reprocessResult: null,
    },
  ];

  const mockPrepare = (sql: string) => ({
    all: () => mockDeadLetters,
    get: () => undefined,
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const results = repo.listEventDeadLetters(50);

  assert.equal(results.length, 1, "Should return 1 dead letter");
  assert.equal(results[0].id, "dl-001");
  assert.equal(results[0].failureCount, 3);
});

test("EventRepository listEventsForExecution returns events for execution", () => {
  const mockEvents = [
    { id: "evt-001", taskId: "task-001", sessionId: null, executionId: "exec-001", eventType: "execution.started", eventTier: "tier_2", payloadJson: "{}", traceId: "trace-001", createdAt: "2026-05-18T10:00:00.000Z" },
    { id: "evt-002", taskId: "task-001", sessionId: null, executionId: "exec-001", eventType: "execution.completed", eventTier: "tier_2", payloadJson: "{}", traceId: "trace-002", createdAt: "2026-05-18T10:05:00.000Z" },
  ];

  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      all: () => mockEvents,
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const results = repo.listEventsForExecution("exec-001");

  assert.ok(capturedSql.includes("execution_id = ?"), "Should filter by execution_id");
  assert.equal(results.length, 2, "Should return 2 events");
});

test("EventRepository getRequiredConsumerIds returns consumer IDs for event", () => {
  const mockConsumerIds = [{ consumerId: "dispatcher" }, { consumerId: "executor" }];

  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      all: () => mockConsumerIds,
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  const results = repo.getRequiredConsumerIds("evt-001");

  assert.ok(capturedSql.includes("event_id = ?"), "Should filter by event_id");
  assert.equal(results.length, 2, "Should return 2 consumer IDs");
  assert.ok(results.includes("dispatcher"), "Should include dispatcher");
  assert.ok(results.includes("executor"), "Should include executor");
});

test("EventRepository ackAllConsumersForEvent updates pending acks", () => {
  let capturedSql = "";
  let capturedParams: unknown[] = [];

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: (...params: unknown[]) => {
        capturedParams = params;
        return { changes: 3 };
      },
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  repo.ackAllConsumersForEvent("evt-001", "2026-05-18T10:05:00.000Z");

  assert.ok(capturedSql.includes("UPDATE event_consumer_acks"), "Should update event_consumer_acks");
  assert.ok(capturedSql.includes("status = 'acked'"), "Should set status to acked");
  assert.ok(capturedSql.includes("event_id = ?"), "Should filter by event_id");
  assert.equal(capturedParams[2], "evt-001", "Should pass eventId");
});

test("EventRepository markEventAck overload - simple signature", () => {
  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  repo.markEventAck("evt-001", "dispatcher");

  assert.ok(capturedSql.includes("UPDATE event_consumer_acks"), "Should update event_consumer_acks");
  assert.ok(capturedSql.includes("event_id = ?"), "Should filter by event_id");
  assert.ok(capturedSql.includes("consumer_id = ?"), "Should filter by consumer_id");
});

test("EventRepository markEventAck overload - object signature", () => {
  let capturedParams: unknown[] = [];
  const mockPrepare = (sql: string) => ({
    run: (...params: unknown[]) => {
      capturedParams = params;
      return { changes: 1 };
    },
    all: () => [],
    get: () => undefined,
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  repo.markEventAck({
    eventId: "evt-001",
    consumerId: "dispatcher",
    status: "failed",
    occurredAt: "2026-05-18T10:05:00.000Z",
    errorCode: "PROCESSING_ERROR",
  });

  assert.equal(capturedParams[0], "failed", "First param should be status");
  assert.equal(capturedParams[5], "evt-001", "Event id should be at position 5");
  assert.equal(capturedParams[6], "dispatcher", "Consumer id should be at position 6");
});

test("EventRepository ensureEventConsumerAckPending inserts or ignores", () => {
  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  repo.ensureEventConsumerAckPending("evt-001", "dispatcher");

  assert.ok(capturedSql.includes("INSERT OR IGNORE"), "Should use INSERT OR IGNORE");
  assert.ok(capturedSql.includes("event_consumer_acks"), "Should insert into event_consumer_acks");
});

test("EventRepository markEventDeadLettered updates ack to dead_lettered", () => {
  let capturedSql = "";
  let capturedParams: unknown[] = [];

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: (...params: unknown[]) => {
        capturedParams = params;
        return { changes: 1 };
      },
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new EventRepository(conn);

  repo.markEventDeadLettered({
    eventId: "evt-001",
    consumerId: "dispatcher",
    occurredAt: "2026-05-18T10:10:00.000Z",
    errorCode: "DEAD_LETTERED",
  });

  assert.ok(capturedSql.includes("status = 'dead_lettered'"), "Should set status to dead_lettered");
  assert.equal(capturedParams[2], "evt-001", "Event id should be at position 2");
  assert.equal(capturedParams[3], "dispatcher", "Consumer id should be at position 3");
});
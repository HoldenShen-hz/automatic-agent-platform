/**
 * Data Integrity Test: Event Column Mapping
 *
 * Verifies that event records are correctly stored and retrieved
 * with proper column mapping (snake_case DB -> camelCase domain).
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EventRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/event-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { EventRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";
import type { ExecutionRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function createExecution(now: string, taskId: string, executionId: string, traceId: string, attempt: number = 1): ExecutionRecord {
  return {
    id: executionId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    harnessRunId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId,
    attempt,
    timeoutMs: 60000,
    budgetUsdLimit: 1,
    budgetReservationId: null,
    budgetLedgerId: null,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createEvent(overrides: Partial<EventRecord> & Pick<EventRecord, "id" | "eventType" | "payloadJson" | "createdAt">): EventRecord {
  return {
    taskId: null,
    sessionId: null,
    executionId: null,
    eventTier: "tier_1",
    traceId: null,
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

test("data integrity: event insert and retrieval preserves all fields", () => {
  const workspace = createTempWorkspace("aa-event-integrity-");
  try {
    const db = new SqliteDatabase(join(workspace, "event-integrity.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Create parent task and execution first
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertExecution(createExecution(now, taskId, executionId, "trace-event"));
    });

    const event: EventRecord = createEvent({
      id: newId("evt"),
      taskId,
      executionId,
      eventType: "task.created",
      payloadJson: JSON.stringify({ key: "value" }),
      traceId: "trace-123",
      createdAt: "2026-04-15T10:00:00.000Z",
    });

    repo.insertEvent(event);

    const retrieved = repo.getEvent(event.id);
    assert.ok(retrieved, "Should retrieve the inserted event");
    assert.equal(retrieved!.id, event.id, "ID should match");
    assert.equal(retrieved!.taskId, event.taskId, "taskId should match");
    assert.equal(retrieved!.executionId, event.executionId, "executionId should match");
    assert.equal(retrieved!.eventType, event.eventType, "eventType should match");
    assert.equal(retrieved!.eventTier, event.eventTier, "eventTier should match");
    assert.equal(retrieved!.payloadJson, event.payloadJson, "payloadJson should match");
    assert.equal(retrieved!.traceId, event.traceId, "traceId should match");
    assert.equal(retrieved!.createdAt, event.createdAt, "createdAt should match");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: event payload JSON is preserved exactly", () => {
  const workspace = createTempWorkspace("aa-event-payload-");
  try {
    const db = new SqliteDatabase(join(workspace, "event-payload.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Create parent task and execution first
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event payload test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertExecution(createExecution(now, taskId, executionId, "trace-payload"));
    });

    const complexPayload = {
      nested: { deep: { value: 42 } },
      array: [1, 2, 3],
      string: "test with special chars: !@#$%",
      unicode: "中文测试",
    };

    const event: EventRecord = createEvent({
      id: newId("evt"),
      taskId,
      executionId,
      eventType: "task.output",
      payloadJson: JSON.stringify(complexPayload),
      traceId: "trace-payload",
      createdAt: "2026-04-15T10:00:00.000Z",
    });

    repo.insertEvent(event);

    const retrieved = repo.getEvent(event.id);
    const retrievedPayload = JSON.parse(retrieved!.payloadJson);

    assert.deepEqual(retrievedPayload, complexPayload, "Complex payload should be preserved");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: multiple events for same task are all retrievable", () => {
  const workspace = createTempWorkspace("aa-event-multi-");
  try {
    const db = new SqliteDatabase(join(workspace, "event-multi.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const execId1 = newId("exec");
    const execId2 = newId("exec");
    const execId3 = newId("exec");
    const now = nowIso();

    // Create parent task and executions first
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Multi event test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      const attempts = [1, 2, 3];
      for (let i = 0; i < 3; i++) {
        const execId = [execId1, execId2, execId3][i]!;
        store.insertExecution(createExecution(now, taskId, execId, "trace-multi", attempts[i]!));
      }
    });

    const events: EventRecord[] = [
      createEvent({ id: newId("evt"), taskId, executionId: execId1, eventType: "task.created", payloadJson: "{}", traceId: "trace-1", createdAt: "2026-04-15T10:00:00.000Z" }),
      createEvent({ id: newId("evt"), taskId, executionId: execId2, eventType: "task.started", payloadJson: "{}", traceId: "trace-2", createdAt: "2026-04-15T10:01:00.000Z" }),
      createEvent({ id: newId("evt"), taskId, executionId: execId3, eventType: "task.completed", payloadJson: "{}", traceId: "trace-3", createdAt: "2026-04-15T10:02:00.000Z" }),
    ];

    for (const event of events) {
      repo.insertEvent(event);
    }

    const taskEvents = repo.listEventsForTask(taskId);
    assert.equal(taskEvents.length, 3, "Should retrieve all 3 events");

    // Verify all event types are present
    const eventTypes = taskEvents.map((e) => e.eventType);
    assert.ok(eventTypes.includes("task.created"));
    assert.ok(eventTypes.includes("task.started"));
    assert.ok(eventTypes.includes("task.completed"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: listEventsByType returns correct events", () => {
  const workspace = createTempWorkspace("aa-event-type-");
  try {
    const db = new SqliteDatabase(join(workspace, "event-type.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const execId = newId("exec");
    const now = nowIso();

    // Create parent task and execution first
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event type test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertExecution(createExecution(now, taskId, execId, "trace-type"));
    });

    const events: EventRecord[] = [
      createEvent({ id: newId("evt"), taskId, executionId: execId, eventType: "task.created", payloadJson: "{}", traceId: "t1", createdAt: "2026-04-15T10:00:00.000Z" }),
      createEvent({ id: newId("evt"), taskId, executionId: execId, eventType: "task.created", payloadJson: "{}", traceId: "t2", createdAt: "2026-04-15T10:01:00.000Z" }),
      createEvent({ id: newId("evt"), taskId, executionId: execId, eventType: "task.started", payloadJson: "{}", traceId: "t3", createdAt: "2026-04-15T10:02:00.000Z" }),
    ];

    for (const event of events) {
      repo.insertEvent(event);
    }

    const createdEvents = repo.listEventsByType("task.created");
    assert.equal(createdEvents.length, 2, "Should find 2 task.created events");

    const startedEvents = repo.listEventsByType("task.started");
    assert.equal(startedEvents.length, 1, "Should find 1 task.started event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: events with null optional fields are handled", () => {
  const workspace = createTempWorkspace("aa-event-null-");
  try {
    const db = new SqliteDatabase(join(workspace, "event-null.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const now = nowIso();

    // Create parent task first for this event
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event null test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const event: EventRecord = createEvent({
      id: newId("evt"),
      taskId,
      executionId: null,
      eventType: "task.created",
      payloadJson: "{}",
      traceId: null,
      createdAt: "2026-04-15T10:00:00.000Z",
    });

    repo.insertEvent(event);

    const retrieved = repo.getEvent(event.id);
    assert.ok(retrieved, "Should retrieve event with null fields");
    assert.equal(retrieved!.executionId, null);
    assert.equal(retrieved!.traceId, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

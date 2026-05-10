/**
 * Contract Test: Event Payload Consumer Contract
 *
 * Verifies that event payloads conform to their schemas and that
 * consumers can correctly parse and validate events from the event bus.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { EventRepository } from "../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import type { EventRecord } from "../../../../src/platform/contracts/types/domain.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

test("contract: event payload JSON is valid and parseable", () => {
  const workspace = createTempWorkspace("aa-event-payload-contract-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-payload-contract.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const execId = newId("exec");
    const now = nowIso();

    // Create parent task and execution
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event payload contract test",
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

      store.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-contract",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
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
      });
    });

    // Test various payload types
    const payloads = [
      { type: "task.created", data: { taskId, title: "Test task" } },
      { type: "task.started", data: { taskId, executionId: execId } },
      { type: "task.completed", data: { taskId, output: { result: "success" } } },
      { type: "execution.failed", data: { taskId, error: "test error", code: "TEST_ERROR" } },
      { type: "tool.called", data: { taskId, tool: "read_file", args: { path: "/test.txt" } } },
    ];

    for (const payload of payloads) {
      const event: EventRecord = {
        id: newId("evt"),
        taskId,
        sessionId: null,
        executionId: execId,
        eventType: payload.type,
        eventTier: "tier_1",
        payloadJson: JSON.stringify(payload.data),
        traceId: "trace-contract",
        createdAt: now,
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
      };

      repo.insertEvent(event);

      // Retrieve and verify payload is parseable
      const retrieved = repo.getEvent(event.id);
      assert.ok(retrieved, `Event ${payload.type} should be retrievable`);

      const parsed = JSON.parse(retrieved!.payloadJson);
      assert.ok(
        typeof parsed === "object" && parsed !== null,
        `Payload for ${payload.type} should be a valid JSON object`,
      );
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: event record has all required fields", () => {
  const workspace = createTempWorkspace("aa-event-required-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-required.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const execId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Required fields test",
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

      store.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-required",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
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
      });
    });

    const event: EventRecord = {
      id: newId("evt"),
      taskId,
      sessionId: null,
      executionId: execId,
      eventType: "task.created",
      eventTier: "tier_1",
      payloadJson: '{"key": "value"}',
      traceId: "trace-required",
      createdAt: now,
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
    };

    repo.insertEvent(event);

    const retrieved = repo.getEvent(event.id);
    assert.ok(retrieved, "Event should be retrievable");

    // Verify all required fields are present
    assert.ok(retrieved!.id, "id should be present");
    assert.ok(retrieved!.taskId, "taskId should be present");
    assert.equal(retrieved!.eventType, "task.created", "eventType should match");
    assert.equal(retrieved!.eventTier, "tier_1", "eventTier should match");
    assert.ok(retrieved!.payloadJson, "payloadJson should be present");
    assert.ok(retrieved!.createdAt, "createdAt should be present");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: event tier values are valid", () => {
  const workspace = createTempWorkspace("aa-event-tier-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-tier.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const execId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event tier test",
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

      store.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-tier",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
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
      });
    });

    // Test all valid tier values
    const tiers = ["tier_1", "tier_2", "tier_3"];

    for (const tier of tiers) {
      const event: EventRecord = {
        id: newId("evt"),
        taskId,
        sessionId: null,
        executionId: execId,
        eventType: `test.${tier}`,
        eventTier: tier as EventRecord["eventTier"],
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
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
      };

      repo.insertEvent(event);

      const retrieved = repo.getEvent(event.id);
      assert.ok(retrieved, `Event with tier ${tier} should be retrievable`);
      assert.equal(
        retrieved!.eventTier,
        tier,
        `Event tier should be ${tier}`,
      );
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: events can be filtered by type", () => {
  const workspace = createTempWorkspace("aa-event-type-filter-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-type-filter.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const execId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event type filter test",
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

      store.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-filter",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
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
      });
    });

    // Insert multiple event types
    const eventTypes = ["task.created", "task.started", "task.completed", "task.created"];

    for (const eventType of eventTypes) {
      const event: EventRecord = {
        id: newId("evt"),
        taskId,
        sessionId: null,
        executionId: execId,
        eventType,
        eventTier: "tier_1",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
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
      };

      repo.insertEvent(event);
    }

    // Filter by type
    const createdEvents = repo.listEventsByType("task.created");
    assert.equal(createdEvents.length, 2, "Should find 2 task.created events");

    const startedEvents = repo.listEventsByType("task.started");
    assert.equal(startedEvents.length, 1, "Should find 1 task.started event");

    const completedEvents = repo.listEventsByType("task.completed");
    assert.equal(completedEvents.length, 1, "Should find 1 task.completed event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: events can be listed for a specific task", () => {
  const workspace = createTempWorkspace("aa-event-task-list-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-task-list.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const execId = newId("exec");
    const otherTaskId = newId("task");
    const otherExecId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      for (const tid of [taskId, otherTaskId]) {
        store.insertTask({
          id: tid,
          parentId: null,
          rootId: tid,
          divisionId: "general_ops",
          title: "Task event list test",
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
      }

      // Insert executions - first with taskId, second with otherTaskId
      store.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-list",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
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
      });

      store.insertExecution({
        id: otherExecId,
        taskId: otherTaskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-list",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
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
      });
    });

    // Insert events for both tasks
    // Events for primary task
    for (let i = 0; i < 3; i++) {
      const event: EventRecord = {
        id: newId("evt"),
        taskId,
        sessionId: null,
        executionId: execId,
        eventType: "task.created",
        eventTier: "tier_1",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
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
      };
      repo.insertEvent(event);
    }

    // Events for other task
    for (let i = 0; i < 3; i++) {
      const event: EventRecord = {
        id: newId("evt"),
        taskId: otherTaskId,
        sessionId: null,
        executionId: otherExecId,
        eventType: "task.created",
        eventTier: "tier_1",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
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
      };
      repo.insertEvent(event);
    }

    // List events for specific task
    const taskEvents = repo.listEventsForTask(taskId);
    assert.equal(taskEvents.length, 3, "Should find 3 events for primary task");

    const otherTaskEvents = repo.listEventsForTask(otherTaskId);
    assert.equal(otherTaskEvents.length, 3, "Should find 3 events for other task");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("contract: event with null optional fields is handled correctly", () => {
  const workspace = createTempWorkspace("aa-event-null-fields-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-null-fields.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = new EventRepository(db.connection);

    const taskId = newId("task");
    const now = nowIso();

    // Create parent task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Null fields test",
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

    // Event with null optional fields
    const event: EventRecord = {
      id: newId("evt"),
      taskId,
      sessionId: null,
      executionId: null as unknown as string,
      eventType: "task.created",
      eventTier: "tier_1",
      payloadJson: "{}",
      traceId: null as unknown as string,
      createdAt: now,
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
    };

    repo.insertEvent(event);

    const retrieved = repo.getEvent(event.id);
    assert.ok(retrieved, "Event with null fields should be retrievable");
    // SQLite returns null as undefined, so check for either
    assert.ok(retrieved!.sessionId === null || retrieved!.sessionId === undefined, "sessionId should be null or undefined");
    assert.ok(retrieved!.executionId === null || retrieved!.executionId === undefined, "executionId should be null or undefined");
    assert.ok(retrieved!.traceId === null || retrieved!.traceId === undefined, "traceId should be null or undefined");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

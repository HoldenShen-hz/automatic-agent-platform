/**
 * Unit Tests: Execution Dispatch Service
 *
 * Tests for the ExecutionDispatchService class which handles
 * execution ticket creation and dispatch to workers.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { CreateExecutionTicketInput } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-support.js";

function createDispatchHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "dispatch.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function createTaskAndExecution(harness: ReturnType<typeof createDispatchHarness>, taskId: string, executionId: string, priority = "normal") {
  const now = nowIso();
  harness.db.transaction(() => {
    harness.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: `Task ${taskId}`,
      status: "in_progress",
      source: "user",
      priority,
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

    harness.store.insertExecution({
      id: executionId,
      taskId,
      traceId: newId("trace"),
      workflowId: newId("wf"),
      roleId: "agent",
      runKind: "task",
      attempt: 1,
      status: "in_progress",
      inputJson: "{}",
      outputJson: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
  });
}

test("ExecutionDispatchService createTicket creates a new ticket for execution", () => {
  const harness = createDispatchHarness("aa-dispatch-create-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const taskId = "task_create_001";
    const executionId = "exec_create_001";
    createTaskAndExecution(harness, taskId, executionId);

    const input: CreateExecutionTicketInput = {
      executionId,
      priority: "high",
      queueName: "high-priority",
    };

    const result = service.createTicket(input);

    assert.equal(result.outcome, "created");
    assert.ok(result.ticket);
    assert.equal(result.ticket.executionId, executionId);
    assert.equal(result.ticket.taskId, taskId);
    assert.equal(result.ticket.priority, "high");
    assert.equal(result.ticket.queueName, "high-priority");
    assert.equal(result.ticket.status, "pending");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService createTicket returns existing ticket if one already exists", () => {
  const harness = createDispatchHarness("aa-dispatch-exists-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const taskId = "task_exists_001";
    const executionId = "exec_exists_001";
    createTaskAndExecution(harness, taskId, executionId);

    const input: CreateExecutionTicketInput = {
      executionId,
    };

    const first = service.createTicket(input);
    assert.equal(first.outcome, "created");

    const second = service.createTicket(input);
    assert.equal(second.outcome, "exists");
    assert.equal(second.ticket.id, first.ticket.id);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService createTicket uses task priority when not specified", () => {
  const harness = createDispatchHarness("aa-dispatch-priority-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const taskId = "task_priority_001";
    const executionId = "exec_priority_001";
    createTaskAndExecution(harness, taskId, executionId, "urgent");

    const input: CreateExecutionTicketInput = {
      executionId,
    };

    const result = service.createTicket(input);

    assert.equal(result.outcome, "created");
    assert.equal(result.ticket.priority, "urgent");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService createTicket throws when execution not found", () => {
  const harness = createDispatchHarness("aa-dispatch-missing-exec-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);

    const input: CreateExecutionTicketInput = {
      executionId: "nonexistent-exec",
    };

    assert.throws(
      () => service.createTicket(input),
      (err: any) => err.code === "storage.execution_not_found",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService dispatchNext returns no_ticket when no tickets available", () => {
  const harness = createDispatchHarness("aa-dispatch-no-ticket-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);

    const result = service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(result.outcome, "no_ticket");
    assert.equal(result.ticket, null);
    assert.equal(result.worker, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService dispatchNext returns blocked when queue unavailable", () => {
  const harness = createDispatchHarness("aa-dispatch-blocked-");
  try {
    const service = new ExecutionDispatchService(
      harness.db,
      harness.store,
      null, // backpressureSnapshot
      () => ({ state: "unavailable" as const, reasonCode: "maintenance" }), // queueAvailabilitySnapshot
    );

    const taskId = "task_blocked_001";
    const executionId = "exec_blocked_001";
    createTaskAndExecution(harness, taskId, executionId);

    service.createTicket({ executionId });

    const result = service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(result.outcome, "blocked");
    assert.equal(result.reasonCode, "maintenance");
    assert.ok(result.ticket);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService createTicket accepts all dispatch target options", () => {
  const harness = createDispatchHarness("aa-dispatch-targets-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);

    const targets = ["any", "local_only", "prefer_remote", "require_remote"] as const;

    for (const target of targets) {
      const taskId = `task_target_${target}_001`;
      const executionId = `exec_target_${target}_001`;
      createTaskAndExecution(harness, taskId, executionId);

      const result = service.createTicket({
        executionId,
        dispatchTarget: target,
      });

      assert.equal(result.outcome, "created");
      assert.equal(result.ticket.dispatchTarget, target);
    }
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService createTicket accepts isolation level options", () => {
  const harness = createDispatchHarness("aa-dispatch-isolation-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);

    const levels = ["standard", "hardened", "strict"] as const;

    for (const level of levels) {
      const taskId = `task_isolation_${level}_001`;
      const executionId = `exec_isolation_${level}_001`;
      createTaskAndExecution(harness, taskId, executionId);

      const result = service.createTicket({
        executionId,
        requiredIsolationLevel: level,
      });

      assert.equal(result.outcome, "created");
      assert.equal(result.ticket.requiredIsolationLevel, level);
    }
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService createTicket with required capabilities", () => {
  const harness = createDispatchHarness("aa-dispatch-caps-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const taskId = "task_caps_001";
    const executionId = "exec_caps_001";
    createTaskAndExecution(harness, taskId, executionId);

    const result = service.createTicket({
      executionId,
      requiredCapabilities: ["gpu", "large-memory"],
    });

    assert.equal(result.outcome, "created");
    const caps = JSON.parse(result.ticket.requiredCapabilitiesJson);
    assert.deepEqual(caps.sort(), ["gpu", "large-memory"]);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService createTicket with dispatchAfter timestamp", () => {
  const harness = createDispatchHarness("aa-dispatch-after-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const taskId = "task_after_001";
    const executionId = "exec_after_001";
    createTaskAndExecution(harness, taskId, executionId);

    const dispatchAfter = "2099-01-01T00:00:00.000Z";

    const result = service.createTicket({
      executionId,
      dispatchAfter,
    });

    assert.equal(result.outcome, "created");
    assert.equal(result.ticket.dispatchAfter, dispatchAfter);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("ExecutionDispatchService createTicket with required repo version", () => {
  const harness = createDispatchHarness("aa-dispatch-repo-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const taskId = "task_repo_001";
    const executionId = "exec_repo_001";
    createTaskAndExecution(harness, taskId, executionId);

    const result = service.createTicket({
      executionId,
      requiredRepoVersion: "v2.0.0",
    });

    assert.equal(result.outcome, "created");
    assert.equal(result.ticket.requiredRepoVersion, "v2.0.0");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

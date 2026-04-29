/**
 * Integration tests for seed helpers
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../helpers/integration-context.js";
import { seedTaskAndExecution, seedQueuedTasks } from "../../helpers/seed.js";

test("seedTaskAndExecution creates task and execution", () => {
  const ctx = createIntegrationContext("test-seed-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "seed-task-001",
      executionId: "seed-exec-001",
    });

    const tasks = ctx.store.listTasks(10);
    const task = tasks.find((t) => t.id === "seed-task-001");

    assert.ok(task, "task should be created");
    assert.equal(task?.title, "Seed task");
    assert.equal(task?.status, "in_progress");

    const executions = ctx.store.listExecutionsByTask("seed-task-001");
    assert.ok(executions.length >= 1, "execution should be created");

    const exec = executions.find((e) => e.id === "seed-exec-001");
    assert.ok(exec, "specific execution should exist");
    assert.equal(exec?.status, "executing");
    assert.equal(exec?.workflowId, "single_agent_minimal");
  } finally {
    ctx.cleanup();
  }
});

test("seedTaskAndExecution with traceId", () => {
  const ctx = createIntegrationContext("test-seed-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "seed-trace-task",
      executionId: "seed-trace-exec",
      traceId: "custom-trace-123",
    });

    const executions = ctx.store.listExecutionsByTask("seed-trace-task");
    const exec = executions.find((e) => e.id === "seed-trace-exec");

    assert.equal(exec?.traceId, "custom-trace-123");
  } finally {
    ctx.cleanup();
  }
});

test("seedQueuedTasks creates multiple queued tasks", () => {
  const ctx = createIntegrationContext("test-seed-");
  try {
    seedQueuedTasks(ctx.db, ctx.store, { count: 5, prefix: "queued-test" });

    const tasks = ctx.store.listTasks(10);
    const queuedTasks = tasks.filter((t) => t.title.startsWith("Seed queued task"));

    assert.equal(queuedTasks.length, 5, "should have 5 queued tasks");
    queuedTasks.forEach((task) => {
      assert.equal(task.status, "queued", "all tasks should be queued");
    });
  } finally {
    ctx.cleanup();
  }
});

test("seedQueuedTasks uses custom prefix", () => {
  const ctx = createIntegrationContext("test-seed-");
  try {
    seedQueuedTasks(ctx.db, ctx.store, { count: 3, prefix: "my-custom-prefix" });

    const tasks = ctx.store.listTasks(10);
    const customTasks = tasks.filter((t) => t.id.startsWith("my-custom-prefix"));

    assert.equal(customTasks.length, 3, "should have 3 tasks with custom prefix");
    customTasks.forEach((task) => {
      assert.ok(task.id.match(/^my-custom-prefix-\d+$/), "ID should match prefix-N pattern");
    });
  } finally {
    ctx.cleanup();
  }
});

test("seedQueuedTasks handles count of 0", () => {
  const ctx = createIntegrationContext("test-seed-");
  try {
    seedQueuedTasks(ctx.db, ctx.store, { count: 0, prefix: "zero-test" });

    const tasks = ctx.store.listTasks(10);
    const zeroTasks = tasks.filter((t) => t.title.startsWith("Seed queued task"));

    assert.equal(zeroTasks.length, 0, "should have no tasks");
  } finally {
    ctx.cleanup();
  }
});

test("seedTaskAndExecution and seedQueuedTasks can coexist", () => {
  const ctx = createIntegrationContext("test-seed-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "mixed-task-001",
      executionId: "mixed-exec-001",
    });
    seedQueuedTasks(ctx.db, ctx.store, { count: 2, prefix: "mixed-queued" });

    const tasks = ctx.store.listTasks(10);
    const hasSeedTask = tasks.some((t) => t.id === "mixed-task-001");
    const hasQueuedTasks = tasks.some((t) => t.id.startsWith("mixed-queued-"));

    assert.ok(hasSeedTask, "seeded task should exist");
    assert.ok(hasQueuedTasks, "queued tasks should exist");
  } finally {
    ctx.cleanup();
  }
});
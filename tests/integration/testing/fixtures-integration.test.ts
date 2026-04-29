/**
 * Integration tests for fixture combinations
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../helpers/integration-context.js";
import { createMinimalTask, createMinimalExecution, createMinimalApproval } from "../../helpers/fixtures/base.js";

test("fixtures work with integration context", () => {
  const ctx = createIntegrationContext("test-fix-");
  try {
    const task = createMinimalTask({ id: "fixture-task-1" });
    const exec = createMinimalExecution("fixture-task-1", { id: "fixture-exec-1" });
    const approval = createMinimalApproval({ id: "fixture-approval-1" });

    ctx.store.insertTask(task);
    ctx.store.insertExecution(exec);

    const tasks = ctx.store.listTasks(10);
    const foundTask = tasks.find((t) => t.id === "fixture-task-1");
    assert.ok(foundTask, "task should be found");

    const executions = ctx.store.listExecutionsByTask("fixture-task-1");
    const foundExec = executions.find((e) => e.id === "fixture-exec-1");
    assert.ok(foundExec, "execution should be found");
  } finally {
    ctx.cleanup();
  }
});

test("fixtures with various statuses", () => {
  const ctx = createIntegrationContext("test-fix-");
  try {
    const statuses = ["queued", "in_progress", "done", "failed", "cancelled"] as const;

    for (const status of statuses) {
      const taskId = `status-task-${status}`;
      const execId = `status-exec-${status}`;

      ctx.store.insertTask(createMinimalTask({ id: taskId, status }));
      ctx.store.insertExecution(createMinimalExecution(taskId, { id: execId, status: status === "queued" ? "executing" : status }));
    }

    const tasks = ctx.store.listTasks(10);
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    for (const status of statuses) {
      const task = taskMap.get(`status-task-${status}`);
      assert.ok(task, `task for status ${status} should exist`);
      assert.equal(task?.status, status, `task status should be ${status}`);
    }
  } finally {
    ctx.cleanup();
  }
});

test("fixtures preserve overrides correctly", () => {
  const ctx = createIntegrationContext("test-fix-");
  try {
    const customTask = createMinimalTask({
      id: "custom-override-task",
      title: "My Custom Title",
      priority: "high",
      tenantId: "tenant-custom",
    });

    ctx.store.insertTask(customTask);

    const tasks = ctx.store.listTasks(10);
    const task = tasks.find((t) => t.id === "custom-override-task");

    assert.ok(task, "custom task should exist");
    assert.equal(task?.title, "My Custom Title");
    assert.equal(task?.priority, "high");
    assert.equal(task?.tenantId, "tenant-custom");
  } finally {
    ctx.cleanup();
  }
});
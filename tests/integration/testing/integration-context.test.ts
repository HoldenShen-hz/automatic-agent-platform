/**
 * Integration tests for integration-context helper
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";

import {
  createIntegrationContext,
  createSeededIntegrationContext,
} from "../../helpers/integration-context.js";

test("createIntegrationContext creates workspace and db", () => {
  const ctx = createIntegrationContext("test-int-");
  try {
    assert.ok(existsSync(ctx.workspace), "workspace should exist");
    assert.ok(existsSync(ctx.dbPath), "dbPath should exist");
    assert.ok(ctx.db, "db should be connected");
    assert.ok(ctx.store, "store should be initialized");
  } finally {
    ctx.cleanup();
  }
});

test("createIntegrationContext cleanup removes workspace", () => {
  const ctx = createIntegrationContext("test-int-cleanup-");
  const workspace = ctx.workspace;
  ctx.cleanup();

  assert.ok(!existsSync(workspace), "workspace should be removed after cleanup");
});

test("createIntegrationContext db is migrated", () => {
  const ctx = createIntegrationContext("test-int-");
  try {
    // Query should work without error
    const tasks = ctx.store.listTasks(1);
    assert.ok(Array.isArray(tasks), "should be able to query tasks");
  } finally {
    ctx.cleanup();
  }
});

test("createSeededIntegrationContext creates valid task and execution", () => {
  const ctx = createSeededIntegrationContext("test-seeded-");
  try {
    const tasks = ctx.store.listTasks(10);
    assert.ok(tasks.length >= 1, "should have at least one task");

    const task = tasks[0];
    assert.equal(task.id, "task-seeded-001");
    assert.equal(task.title, "Seeded task");

    const executions = ctx.store.listExecutionsByTask(task.id);
    assert.ok(executions.length >= 1, "should have at least one execution");

    const exec = executions[0];
    assert.equal(exec.id, "exec-seeded-001");
    assert.equal(exec.taskId, task.id);
    assert.equal(exec.status, "executing");
  } finally {
    ctx.cleanup();
  }
});

test("createSeededIntegrationContext respects custom IDs", () => {
  const ctx = createSeededIntegrationContext("test-seeded-", {
    taskId: "custom-task-id",
    executionId: "custom-exec-id",
  });
  try {
    const tasks = ctx.store.listTasks(10);
    const task = tasks.find((t) => t.id === "custom-task-id");

    assert.ok(task, "custom task ID should exist");

    const executions = ctx.store.listExecutionsByTask("custom-task-id");
    assert.ok(executions.some((e) => e.id === "custom-exec-id"), "custom exec ID should exist");
  } finally {
    ctx.cleanup();
  }
});

test("createSeededIntegrationContext cleanup removes workspace", () => {
  const ctx = createSeededIntegrationContext("test-seeded-cleanup-");
  const workspace = ctx.workspace;
  ctx.cleanup();

  assert.ok(!existsSync(workspace), "workspace should be removed after cleanup");
});

test("multiple contexts do not interfere", () => {
  const ctx1 = createIntegrationContext("test-multi-a-");
  const ctx2 = createIntegrationContext("test-multi-b-");
  try {
    // Insert different data in each context
    ctx1.store.insertTask({
      id: "task-ctx1",
      parentId: null,
      rootId: "task-ctx1",
      divisionId: "general_ops",
      tenantId: null,
      title: "Context 1 Task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    });

    ctx2.store.insertTask({
      id: "task-ctx2",
      parentId: null,
      rootId: "task-ctx2",
      divisionId: "general_ops",
      tenantId: null,
      title: "Context 2 Task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    });

    // Each context should only see its own data
    const tasks1 = ctx1.store.listTasks(10);
    const tasks2 = ctx2.store.listTasks(10);

    assert.ok(tasks1.some((t) => t.id === "task-ctx1"), "ctx1 should see its task");
    assert.ok(!tasks1.some((t) => t.id === "task-ctx2"), "ctx1 should not see ctx2 task");
    assert.ok(tasks2.some((t) => t.id === "task-ctx2"), "ctx2 should see its task");
    assert.ok(!tasks2.some((t) => t.id === "task-ctx1"), "ctx2 should not see ctx1 task");
  } finally {
    ctx1.cleanup();
    ctx2.cleanup();
  }
});
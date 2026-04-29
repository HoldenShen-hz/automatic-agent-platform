/**
 * InspectService Integration Tests
 *
 * Tests for InspectService integration with real database,
 * task inspection, execution inspection, and approval views.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { InspectService } from "../../../../src/platform/shared/observability/inspect-service.js";

// =============================================================================
// InspectService with seeded database
// =============================================================================

test("InspectService getTaskInspectView returns complete task view", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-task-");

  try {
    const inspectService = new InspectService(ctx.store);
    const view = inspectService.getTaskInspectView(ctx.store.task.getTask("task-seeded-001")!.id);

    assert.ok(view != null, "Should return a task inspect view");
    assert.equal(view.task.id, "task-seeded-001");
    assert.equal(view.task.status, "in_progress");
    assert.ok(view.task.workflowState == null, "Task has no workflow yet");
    assert.ok(view.execution != null, "Task has an execution");
    assert.equal(view.execution!.id, "exec-seeded-001");
    assert.ok(Array.isArray(view.approvals), "Approvals should be an array");
    assert.ok(Array.isArray(view.recentEvents), "Recent events should be an array");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService getTaskInspectView throws for nonexistent task", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-task-nonexistent-");

  try {
    const inspectService = new InspectService(ctx.store);

    assert.throws(
      () => inspectService.getTaskInspectView("nonexistent-task-id"),
      /Task not found/,
      "Should throw for nonexistent task",
    );
  } finally {
    ctx.cleanup();
  }
});

test("InspectService getExecutionInspectView returns execution with related records", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-exec-");

  try {
    const inspectService = new InspectService(ctx.store);
    const view = inspectService.getExecutionInspectView("exec-seeded-001");

    assert.ok(view != null, "Should return an execution inspect view");
    assert.equal(view.execution!.id, "exec-seeded-001");
    assert.equal(view.task!.id, "task-seeded-001");
    assert.ok(Array.isArray(view.executions), "Should have all executions for task");
    assert.ok(view.executions.length >= 1, "Should have at least one execution");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService getExecutionInspectView throws for nonexistent execution", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-exec-nonexistent-");

  try {
    const inspectService = new InspectService(ctx.store);

    assert.throws(
      () => inspectService.getExecutionInspectView("nonexistent-exec-id"),
      /Execution not found/,
      "Should throw for nonexistent execution",
    );
  } finally {
    ctx.cleanup();
  }
});

test("InspectService listSessionMessages returns messages for task's session", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-messages-");

  try {
    const inspectService = new InspectService(ctx.store);
    const messages = inspectService.listSessionMessages("task-seeded-001");

    assert.ok(Array.isArray(messages), "Should return an array");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService listSessionCompactionRecords returns compactions for task's session", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-compaction-");

  try {
    const inspectService = new InspectService(ctx.store);
    const compactions = inspectService.listSessionCompactionRecords("task-seeded-001");

    assert.ok(Array.isArray(compactions), "Should return an array");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService listFileLocksByTask returns file locks held by task", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-locks-");

  try {
    const inspectService = new InspectService(ctx.store);
    const locks = inspectService.listFileLocksByTask("task-seeded-001");

    assert.ok(Array.isArray(locks), "Should return an array");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService queryTaskInspectSummaries returns filtered task summaries", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-query-task-");

  try {
    const inspectService = new InspectService(ctx.store);

    // Query all task summaries
    const allSummaries = inspectService.queryTaskInspectSummaries();
    assert.ok(allSummaries.length >= 1, "Should have at least one task summary");

    // Query by task status
    const inProgressTasks = inspectService.queryTaskInspectSummaries({ taskStatus: "in_progress" });
    assert.ok(inProgressTasks.length >= 1, "Should find in_progress tasks");

    // Query by nonexistent status returns empty
    const noTasks = inspectService.queryTaskInspectSummaries({ taskStatus: "nonexistent" });
    assert.equal(noTasks.length, 0, "Should return empty for nonexistent status");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService queryTaskInspectSummaries respects limit parameter", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-limit-");

  try {
    const inspectService = new InspectService(ctx.store);

    // Query with limit
    const summaries = inspectService.queryTaskInspectSummaries({ limit: 1 });
    assert.ok(summaries.length <= 1, "Should respect limit");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService queryWorkflowInspectSummaries returns workflow summaries", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-query-workflow-");

  try {
    const inspectService = new InspectService(ctx.store);
    const summaries = inspectService.queryWorkflowInspectSummaries();

    assert.ok(Array.isArray(summaries), "Should return an array");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService queryDecisionInspectSummaries returns decision summaries", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-query-decision-");

  try {
    const inspectService = new InspectService(ctx.store);
    const summaries = inspectService.queryDecisionInspectSummaries();

    assert.ok(Array.isArray(summaries), "Should return an array");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService queryWorkerInspectSummaries returns worker summaries", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-query-worker-");

  try {
    const inspectService = new InspectService(ctx.store);
    const summaries = inspectService.queryWorkerInspectSummaries();

    assert.ok(Array.isArray(summaries), "Should return an array");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService getTaskInspectView includes runtimeRecovery information", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-recovery-");

  try {
    const inspectService = new InspectService(ctx.store);
    const view = inspectService.getTaskInspectView("task-seeded-001");

    assert.ok(view.runtimeRecovery != null, "Should have runtime recovery view");
    assert.ok("activeExecutionId" in view.recoverySummary, "Should have recovery summary");
  } finally {
    ctx.cleanup();
  }
});

test("InspectService listRemoteLogsByTask returns remote logs for task", () => {
  const ctx = createSeededIntegrationContext("aa-inspect-remote-logs-");

  try {
    const inspectService = new InspectService(ctx.store);
    const remoteLogs = inspectService.listRemoteLogsByTask("task-seeded-001");

    assert.ok(Array.isArray(remoteLogs), "Should return an array");
  } finally {
    ctx.cleanup();
  }
});

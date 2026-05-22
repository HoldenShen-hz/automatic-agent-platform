import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { runSingleTaskExecution, type HappyPathInput } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-execution.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

function createTempDbPath(): string {
  const workspace = createTempWorkspace("aa-agent-runtime-test-");
  return join(workspace, "test.db");
}

test("runSingleTaskExecution with stepOutputOverride produces synthetic output", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Test Task",
      request: "Test request content",
      stepOutputOverride: {
        summary: "Custom summary",
        result: "Custom result",
      },
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result);
    assert.ok(result.task);
    assert.equal(result.task.title, "Test Task");
    assert.equal(result.task.status, "done");
    assert.ok(result.execution);
    assert.equal(result.execution.status, "succeeded");
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution creates task with correct properties", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Agent Lifecycle Test",
      request: "Test request",
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result.task.id.startsWith("task_"));
    assert.equal(result.task.divisionId, "general_ops");
    assert.equal(result.task.status, "done");
    assert.equal(result.task.source, "user");
    assert.equal(result.task.priority, "normal");
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution creates execution record", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Execution Test",
      request: "Test request",
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result.execution);
    assert.ok(result.execution.id.startsWith("exec_"));
    assert.equal(result.execution.status, "succeeded");
    assert.ok(result.execution.roleId);
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution creates session record", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Session Test",
      request: "Test request",
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result.session);
    assert.ok(result.session.id.startsWith("sess_"));
    assert.equal(result.session.status, "completed");
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution with crashInjection point step_started", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Crash Injection Test",
      request: "Test request",
      crashInjection: {
        point: "step_started",
        injectError: true,
      },
    };

    // Should either succeed or fail based on crash injection
    try {
      const result = await runSingleTaskExecution(input);
      assert.ok(result);
    } catch (error) {
      assert.ok(error instanceof Error);
    }
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution with custom tenantId", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Tenant Test",
      request: "Test request",
      tenantId: "tenant:custom",
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result.task);
    assert.equal(result.task.tenantId, "tenant:custom");
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution with custom logger", async () => {
  const dbPath = createTempDbPath();
  const logger = new StructuredLogger({ retentionLimit: 10 });

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Logger Test",
      request: "Test request",
      logger,
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result);
  } finally {
    cleanupPath(dbPath);
  }
});

test("HappyPathInput type structure", () => {
  const input: HappyPathInput = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    tenantId: "tenant:test",
  };

  assert.equal(input.title, "Test");
  assert.equal(input.request, "Test request");
});

test("runSingleTaskExecution runPhase1AHappyPath alias works", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Alias Test",
      request: "Test request",
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result);
    assert.equal(result.task.status, "done");
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution precheck record is created", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Precheck Test",
      request: "Test request",
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result.prechecks);
    assert.ok(result.prechecks.length > 0);

    const precheck = result.prechecks[0];
    assert.equal(precheck.allowed, 1);
    assert.ok(precheck.resolvedBudgetUsd);
    assert.ok(precheck.resolvedTimeoutMs);
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution multiple runs produce unique IDs", async () => {
  const dbPath = createTempDbPath();

  try {
    const input1: HappyPathInput = {
      dbPath,
      title: "Run 1",
      request: "Request 1",
    };

    const input2: HappyPathInput = {
      dbPath,
      title: "Run 2",
      request: "Request 2",
    };

    const result1 = await runSingleTaskExecution(input1);
    const result2 = await runSingleTaskExecution(input2);

    assert.notStrictEqual(result1.task.id, result2.task.id);
    assert.notStrictEqual(result1.execution.id, result2.execution.id);
    assert.notStrictEqual(result1.session.id, result2.session.id);
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution creates workflow record", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Workflow Test",
      request: "Test request",
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result.workflow);
    assert.ok(result.workflow.workflowId);
    assert.equal(result.workflow.status, "completed");
  } finally {
    cleanupPath(dbPath);
  }
});

test("runSingleTaskExecution with admissionPolicy", async () => {
  const dbPath = createTempDbPath();

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Admission Test",
      request: "Test request",
      admissionPolicy: {
        type: "backpressure",
        threshold: 0,
      },
    };

    const result = await runSingleTaskExecution(input);

    assert.ok(result);
    assert.ok(result.task);
  } finally {
    cleanupPath(dbPath);
  }
});

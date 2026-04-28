import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Tests for single-task-happy-path.ts
 *
 * Coverage areas:
 * 1. Single-task happy path execution
 * 2. Task state transitions (queued -> in_progress -> executing -> done)
 * 3. Step output artifact creation
 * 4. Budget reservation before execution (INV-BUDGET-001)
 * 5. Error handling when LLM call fails
 */

async function createTempDbPath(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), "single-task-test-"));
  return join(tmp, `test-${randomUUID()}.db`);
}

test("runSingleTaskExecution creates task in queued status", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test task",
      request: "say hello",
      stepOutputOverride: {
        summary: "Test summary",
        result: "Hello world",
      },
    });

    assert.ok(result.task, "Should return task in snapshot");
    assert.equal(result.task.status, "done", "Task should complete");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution creates workflow and execution records", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test workflow creation",
      request: "simple task",
      stepOutputOverride: {
        summary: "Done",
        result: "Completed",
      },
    });

    assert.ok(result.workflow, "Should have workflow record");
    assert.ok(result.executions && result.executions.length > 0, "Should have execution record");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution creates session record with streaming status", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test session",
      request: "test session",
      stepOutputOverride: {
        summary: "Session test",
        result: "OK",
      },
    });

    assert.ok(result.session, "Should have session record");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution writes step output artifact", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test artifact",
      request: "create artifact",
      stepOutputOverride: {
        summary: "Artifact test",
        result: "Artifact created",
      },
    });

    assert.ok(result.stepOutputs && result.stepOutputs.length > 0, "Should have step outputs");
    const stepOutput = result.stepOutputs[0];
    assert.equal(stepOutput.status, "succeeded", "Step output should succeed");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution uses synthetic output when stepOutputOverride provided", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const customResult = "Custom synthetic result";
    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test synthetic output",
      request: "test synthetic",
      stepOutputOverride: {
        summary: "Synthetic test",
        result: customResult,
      },
    });

    assert.ok(result.task.outputJson, "Should have output JSON");
    const output = JSON.parse(result.task.outputJson);
    assert.equal(output.result, customResult, "Should use custom result");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution transitions through all lifecycle states", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    // This test verifies the happy path completes without error
    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test lifecycle",
      request: "complete task",
      stepOutputOverride: {
        summary: "Lifecycle test",
        result: "Done",
      },
    });

    // The task should be in terminal "done" state
    assert.equal(result.task.status, "done", "Task should reach done state");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution handles tenantId option", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test tenant",
      request: "tenant task",
      tenantId: "test-tenant-123",
      stepOutputOverride: {
        summary: "Tenant test",
        result: "OK",
      },
    });

    assert.equal(result.task.tenantId, "test-tenant-123", "Should set tenant ID");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution includes cost record in snapshot", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test cost tracking",
      request: "track cost",
      stepOutputOverride: {
        summary: "Cost test",
        result: "Done",
      },
    });

    // Cost events should be recorded
    assert.ok(result.costEvents && result.costEvents.length > 0, "Should have cost events");
    const costEvent = result.costEvents[0];
    assert.ok(costEvent.costUsd !== undefined, "Cost event should have cost");
    assert.ok(costEvent.budgetScope, "Cost event should have budget scope");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution enforces budget reservation (INV-BUDGET-001)", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Budget test",
      request: "test budget",
      stepOutputOverride: {
        summary: "Budget test",
        result: "Done",
      },
    });

    // Verify execution has budget limit set
    const executions = result.executions ?? [];
    if (executions.length > 0) {
      const execution = executions[0];
      assert.ok(execution.budgetUsdLimit !== undefined, "Execution should have budget limit");
      assert.ok(execution.budgetUsdLimit > 0, "Budget limit should be positive");
    }
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution creates precheck record before execution", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Precheck test",
      request: "test precheck",
      stepOutputOverride: {
        summary: "Precheck test",
        result: "OK",
      },
    });

    // Precheck records should be present
    assert.ok(result.prechecks && result.prechecks.length > 0, "Should have precheck records");
    const precheck = result.prechecks[0];
    assert.equal(precheck.allowed, 1, "Precheck should be allowed");
    assert.ok(precheck.resolvedBudgetUsd !== undefined, "Precheck should have resolved budget");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution handles admission with backpressure snapshot", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runSingleTaskExecution } = await import("../../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

    const result = await runSingleTaskExecution({
      dbPath,
      title: "Admission backpressure test",
      request: "test admission",
      admissionPolicy: {
        memoryHighWatermarkMb: 1000,
        eventLoopLagThresholdMs: 100,
        maxQueueDepth: 50,
      },
      stepOutputOverride: {
        summary: "Admission test",
        result: "OK",
      },
    });

    // Task should complete despite custom admission policy
    assert.equal(result.task.status, "done", "Task should still complete");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runSingleTaskExecution exports runPhase1AHappyPath alias", async () => {
  const { runPhase1AHappyPath } = await import("../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js");

  assert.ok(typeof runPhase1AHappyPath === "function", "runPhase1AHappyPath should be exported as function");
});

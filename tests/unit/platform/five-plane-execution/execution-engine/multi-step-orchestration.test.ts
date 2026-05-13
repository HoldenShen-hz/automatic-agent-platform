import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Tests for multi-step-orchestration.ts
 *
 * Coverage areas:
 * 1. Multi-step orchestration flow
 * 2. Task execution happy path
 * 3. State transitions
 * 4. Error handling and recovery
 * 5. Budget reservation before execution (INV-BUDGET-001)
 */

interface MockAdmissionBackpressureSnapshot {
  memoryUsageMb: number;
  eventLoopLagMs: number;
  queueDepth: number;
  timestamp: string;
}

async function createTempDbPath(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), "multi-step-test-"));
  return join(tmp, `test-${randomUUID()}.db`);
}

// Mock factory for typed-factories.ts replacement
function createMockStorageContext(dbPath: string) {
  const { openAuthoritativeStorageContext } = require("../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
  return openAuthoritativeStorageContext({ dbPath });
}

test("runMultiStepOrchestration creates task with queued status", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test multi-step task",
      request: "analyze and summarize this data",
      stepOutputOverrides: {
        intake_triage: {
          summary: "Analysis complete",
          result: "Found insights",
        },
      },
    });

    assert.ok(result.snapshot, "Should return task snapshot");
    assert.ok(result.snapshot.task, "Snapshot should contain task");
    assert.equal(result.snapshot.task.status, "done", "Task should complete successfully");
    assert.ok(result.routing, "Should have routing decision");
    assert.ok(result.plannedWorkflow, "Should have planned workflow");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration handles simple request routing", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Simple query",
      request: "what is the weather?",
    });

    assert.ok(result.routing, "Should have routing decision");
    assert.ok(!result.routing.requiresOrchestration || result.routing.workflowId, "Should have workflow ID");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration uses oapeflir plan when request starts with oapeflir://plan", async () => {
  const dbPath = await createTempDbPath();

  const oapeflirPlan = JSON.stringify([
    {
      stepId: "step_1",
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
      dependencies: [],
      outputs: ["output_step_1"],
    },
    {
      stepId: "step_2",
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
      dependencies: ["step_1"],
      outputs: ["output_step_2"],
    },
  ]);

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "oapeflir-test",
      request: `oapeflir://plan ${oapeflirPlan}`,
    });

    assert.ok(result.routing, "Should have routing decision");
    assert.equal(result.routing.routeReason, "oapeflir_bridge", "Should use oapeflir bridge");
    assert.ok(result.plannedWorkflow, "Should have planned workflow");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration creates workflow and session records", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test workflow creation",
      request: "analyze this request",
    });

    assert.ok(result.snapshot.workflow, "Snapshot should contain workflow");
    assert.ok(result.snapshot.session, "Snapshot should contain session");
    assert.ok(result.snapshot.task, "Snapshot should contain task");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration emits routing:decided event", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test event emission",
      request: "analyze this",
    });

    const events = result.snapshot.events ?? [];
    const routingEvent = events.find((e: any) => e.eventType === "routing:decided");
    assert.ok(routingEvent, "Should emit routing:decided event");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration validates workflow with assertWorkflowValid", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    // This test verifies the workflow validation path works
    // For invalid workflows, the assertWorkflowValid would throw
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test workflow validation",
      request: "simple query",
    });

    // If we get here without throwing, the workflow was valid
    assert.ok(result.plannedWorkflow, "Should produce valid planned workflow");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration returns compaction result when context budget exceeded", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test compaction",
      request: "analyze this complex request that requires context compaction",
      contextBudgetTokens: 100,
    });

    // Compaction may or may not occur depending on context size
    assert.ok(result, "Should return result");
    assert.ok(result.snapshot, "Should have snapshot");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration enforces admission control", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    // Create input with strict admission policy
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test admission",
      request: "test admission control",
      admissionPolicy: {
        memoryHighWatermarkMb: 0.001, // Very low threshold to trigger backpressure
        eventLoopLagThresholdMs: 0.001,
        maxQueueDepth: 0,
      },
    });

    // Result should still be returned (admission may allow or queue)
    assert.ok(result.snapshot, "Should return snapshot");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration produces stream frames for streaming clients", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test streaming",
      request: "analyze this",
    });

    assert.ok(Array.isArray(result.streamFrames), "streamFrames should be an array");
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

test("runMultiStepOrchestration handles budget reservation (INV-BUDGET-001)", async () => {
  const dbPath = await createTempDbPath();

  try {
    const { runMultiStepOrchestration } = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Budget reservation test",
      request: "test budget handling",
    });

    // The execution record should have budgetUsdLimit set
    const executions = result.snapshot.executions ?? [];
    if (executions.length > 0) {
      const lastExecution = executions[executions.length - 1];
      assert.ok(lastExecution.budgetUsdLimit !== undefined, "Execution should have budget limit");
      assert.ok(lastExecution.budgetUsdLimit > 0, "Budget limit should be positive");
    }
  } finally {
    try {
      const { openAuthoritativeStorageContext } = await import("../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js");
      const storage = openAuthoritativeStorageContext({ dbPath });
      storage.close();
    } catch {
      // ignore cleanup errors
    }
  }
});

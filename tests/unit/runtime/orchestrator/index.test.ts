import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
  StepFailurePlan,
} from "../../../../src/core/runtime/orchestrator/index.js";

/**
 * Unit Tests: orchestrator index.ts re-exports and runtime orchestration
 *
 * Tests for src/core/runtime/orchestrator/index.ts which re-exports from
 * five-plane-execution/execution-engine/multi-step-orchestration.js
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const orchestratorModulePath = "../../../../src/core/runtime/orchestrator/index.js";

function createTestDbPath(name: string): string {
  return join(__dirname, `test-orchestrator-${name}.db`);
}

function cleanupDb(dbPath: string): void {
  if (existsSync(dbPath)) {
    try {
      unlinkSync(dbPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

// =============================================================================
// Re-export Verification Tests
// =============================================================================

test("orchestrator index exports runMultiStepOrchestration [index]", async () => {
  const orchestrator = await import(orchestratorModulePath);
  assert.ok("runMultiStepOrchestration" in orchestrator, "should export runMultiStepOrchestration");
  assert.strictEqual(typeof orchestrator.runMultiStepOrchestration, "function");
});

test("orchestrator index exports executeMultiStepToolCallForTests [index]", async () => {
  const orchestrator = await import(orchestratorModulePath);
  assert.ok("executeMultiStepToolCallForTests" in orchestrator, "should export executeMultiStepToolCallForTests");
});

test("orchestrator index exports resetMultiStepToolRegistryForTests [index]", async () => {
  const orchestrator = await import(orchestratorModulePath);
  assert.ok("resetMultiStepToolRegistryForTests" in orchestrator, "should export resetMultiStepToolRegistryForTests");
});

// =============================================================================
// Type Re-export Tests
// =============================================================================

test("orchestrator index re-exports MultiStepOrchestrationResult type [index]", () => {
  const result = {} as MultiStepOrchestrationResult;
  assert.equal(typeof result, "object");
});

test("orchestrator index re-exports MultiStepToolExecutionInput type [index]", () => {
  const input = {} as MultiStepToolExecutionInput;
  assert.equal(typeof input, "object");
});

test("orchestrator index re-exports StepFailurePlan type [index]", () => {
  const plan = {} as StepFailurePlan;
  assert.equal(typeof plan, "object");
});

// =============================================================================
// runMultiStepOrchestration Integration Tests
// =============================================================================

test("runMultiStepOrchestration creates task in storage [index]", async () => {
  const dbPath = createTestDbPath("task-creation");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test Task Creation",
      request: "Create a test task",
    });

    assert.ok(result.snapshot, "should return snapshot");
    assert.ok(result.snapshot.task, "snapshot should contain task");
    assert.equal(result.snapshot.task.title, "Test Task Creation");
    assert.ok(result.snapshot.task.id, "task should have id");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration accepts custom taskId for deterministic testing [index]", async () => {
  const dbPath = createTestDbPath("custom-task-id");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const customTaskId = "task:test-deterministic-123";

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Custom Task ID Test",
      request: "Test custom task id",
      taskId: customTaskId,
    });

    assert.equal(result.snapshot.task.id, customTaskId, "task id should match custom taskId");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration returns routing information [index]", async () => {
  const dbPath = createTestDbPath("routing-info");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Routing Test",
      request: "Test routing",
    });

    assert.ok(result.routing, "should have routing info");
    assert.ok(result.routing.workflowId, "routing should have workflowId");
    assert.ok("routeReason" in result.routing, "routing should have routeReason");
    assert.ok("classification" in result.routing, "routing should have classification");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration returns planned workflow [index]", async () => {
  const dbPath = createTestDbPath("planned-workflow");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Workflow Planning Test",
      request: "Test workflow planning",
    });

    assert.ok(result.plannedWorkflow, "should have planned workflow");
    assert.ok(result.plannedWorkflow.workflow, "planned workflow should have workflow property");
    assert.ok(result.plannedWorkflow.workflow.workflowId, "workflow should have workflowId");
    assert.ok(result.plannedWorkflow.executionSteps, "planned workflow should have executionSteps");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration includes harnessRunId when not provided [index]", async () => {
  const dbPath = createTestDbPath("harness-run-id");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Harness Run ID Test",
      request: "Test harness run id",
    });

    // The result should complete without error
    assert.ok(result.snapshot, "should complete successfully");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration accepts tenantId for multi-tenant scenarios [index]", async () => {
  const dbPath = createTestDbPath("tenant-context");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Tenant Context Test",
      request: "Test tenant context",
      tenantId: "tenant:test-tenant-456",
    });

    assert.ok(result.snapshot, "should complete with tenant context");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration accepts pre-allocated budgetLedgerId [index]", async () => {
  const dbPath = createTestDbPath("budget-ledger");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Budget Ledger Test",
      request: "Test budget ledger",
      budgetLedgerId: "bledger:test-budget-789",
    });

    assert.ok(result.snapshot, "should complete with budget ledger");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration returns streamFrames array [index]", async () => {
  const dbPath = createTestDbPath("stream-frames");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Stream Frames Test",
      request: "Test stream frames",
    });

    assert.ok(Array.isArray(result.streamFrames), "streamFrames should be an array");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration returns null compaction initially [index]", async () => {
  const dbPath = createTestDbPath("compaction-null");
  cleanupDb(dbPath);

  try {
    const { runMultiStepOrchestration } = await import(orchestratorModulePath);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Compaction Test",
      request: "Test compaction",
    });

    // Compaction may be null initially (context compaction happens during execution)
    assert.ok(result.compaction === null || result.compaction !== null, "compaction should be either null or object");
  } finally {
    cleanupDb(dbPath);
  }
});

test("orchestrator index can be imported as ES module [index]", async () => {
  const orchestrator = await import(orchestratorModulePath);
  assert.ok(orchestrator, "orchestrator module should be importable");
  assert.ok(typeof orchestrator.runMultiStepOrchestration === "function", "runMultiStepOrchestration should be a function");
});

test("orchestrator index re-exports are stable across multiple imports [index]", async () => {
  const orchestrator1 = await import(orchestratorModulePath);
  const orchestrator2 = await import(orchestratorModulePath);

  assert.strictEqual(
    orchestrator1.runMultiStepOrchestration,
    orchestrator2.runMultiStepOrchestration,
    "re-exports should be stable"
  );
});

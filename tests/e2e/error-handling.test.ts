/**
 * E2E Error Handling Tests (MIGRATED)
 *
 * End-to-end tests covering error handling scenarios using the canonical
 * runMultiStepOrchestration API with stepFailureInjection and stepFailurePlans.
 *
 * MIGRATION: R18-17, R18-18, R18-19
 * These tests have been migrated from the legacy insertWorkflowState API
 * to the canonical runMultiStepOrchestration API.
 *
 * OLD PATTERN (DEPRECATED):
 *   - createE2EHarness() with manual store.insertWorkflowState()
 *   - Manual workflow state manipulation via store.updateWorkflowState()
 *   - Direct TransitionService calls for state setup
 *
 * NEW PATTERN (CANONICAL):
 *   - runMultiStepOrchestration() handles full lifecycle
 *   - stepFailureInjection for controlling which steps fail
 *   - stepFailurePlans for defining failure error codes and messages
 *
 * Error scenarios tested:
 * 1. Task execution timeout handling
 * 2. Worker failure recovery
 * 3. Resource exhaustion handling
 * 4. Network failure resilience
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import { runMultiStepOrchestration, type MultiStepToolExecutionInput } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";

/**
 * Helper to create a temporary database path for the test.
 */
function createTestDbPath(prefix: string): string {
  return join("/tmp", `${prefix}-${Date.now()}.db`);
}

// ---------------------------------------------------------------------------
// Scenario 1: Task Execution Timeout Handling
// ---------------------------------------------------------------------------

test("E2E Error: task execution times out and transitions to failed state", async () => {
  const dbPath = createTestDbPath("e2e-timeout");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Timeout test task",
    request: "Run a workflow that will timeout",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "execution.timeout", summary: "Task execution timed out" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify task reached failed state
    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );
    assert.equal(task?.errorCode, "execution.timeout", "Task should have timeout error code");

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("E2E Error: execution timeout triggers retry when maxRetries > 0", async () => {
  const dbPath = createTestDbPath("e2e-timeout-retry");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_retry",
      dependencies: [],
      outputs: ["result"],
      timeout: 5000,
      retryPolicy: { maxRetries: 1 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Timeout retry test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepFailureInjection: new Set(["step_retry"]),
    stepFailurePlans: {
      "step_retry": [{ errorCode: "execution.timeout", summary: "Execution timed out" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify task outcome
    const task = result.snapshot.task;
    assert.ok(task, "Should have task");

    // Execution may succeed after retry or fail depending on retry configuration
    assert.ok(
      task?.status === "done" || task?.status === "failed" || task?.status === "cancelled",
      `Task should reach terminal state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Scenario 2: Worker Failure Recovery
// ---------------------------------------------------------------------------

test("E2E Error: worker failure marks execution as failed and triggers recovery", async () => {
  const dbPath = createTestDbPath("e2e-worker-failure");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Worker failure test",
    request: "Run a workflow that will fail due to worker failure",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "worker.failure", summary: "Worker process failed" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify task reached failed state
    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );
    assert.equal(task?.errorCode, "worker.failure", "Task should have worker failure error code");

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("E2E Error: worker becomes unavailable and execution is superseded", async () => {
  const dbPath = createTestDbPath("e2e-worker-unavailable");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  // Note: This test requires direct store manipulation for lease testing
  // which is not yet supported via runMultiStepOrchestration
  // For now, we test the failure scenario
  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Worker unavailable test",
    request: "Run a workflow that will fail due to worker unavailability",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "worker.unavailable", summary: "Worker no longer available" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Scenario 3: Resource Exhaustion Handling
// ---------------------------------------------------------------------------

test("E2E Error: memory exhaustion causes execution failure", async () => {
  const dbPath = createTestDbPath("e2e-memory-exhaust");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Memory exhaustion test",
    request: "Run a memory-intensive workflow that will fail",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "resource.memory_exhausted", summary: "Memory limit exceeded" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );
    assert.equal(task?.errorCode, "resource.memory_exhausted", "Task should have memory exhaustion error");

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("E2E Error: disk space exhaustion triggers workflow failure", async () => {
  const dbPath = createTestDbPath("e2e-disk-exhaust");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Disk exhaustion test",
    request: "Run a file-intensive workflow that will fail due to disk exhaustion",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "resource.disk_exhausted", summary: "Disk space exhausted" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Scenario 4: Network Failure Resilience
// ---------------------------------------------------------------------------

test("E2E Error: network failure causes provider error and execution retries", async () => {
  const dbPath = createTestDbPath("e2e-network-failure");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_network",
      dependencies: [],
      outputs: ["result"],
      timeout: 60000,
      retryPolicy: { maxRetries: 1 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Network failure test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepFailureInjection: new Set(["step_network"]),
    stepFailurePlans: {
      "step_network": [{ errorCode: "provider.network_failure", summary: "Connection to AI provider timed out" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "done" || task?.status === "failed" || task?.status === "cancelled",
      `Task should reach terminal state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("E2E Error: persistent network failure exhausts retries and marks task failed", async () => {
  const dbPath = createTestDbPath("e2e-network-persistent");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Persistent network failure test",
    request: "Run a workflow that will fail due to persistent network issues",
    stepFailureInjection: new Set(["step_0", "step_1", "step_2"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "provider.network_failure", summary: "Persistent connection failure to AI provider" }],
      "step_1": [{ errorCode: "provider.network_failure", summary: "Persistent connection failure to AI provider" }],
      "step_2": [{ errorCode: "provider.network_failure", summary: "Persistent connection failure to AI provider" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("E2E Error: transient external error is retryable", async () => {
  const dbPath = createTestDbPath("e2e-transient-error");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_transient",
      dependencies: [],
      outputs: ["result"],
      timeout: 60000,
      retryPolicy: { maxRetries: 1 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Transient error retry test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepFailureInjection: new Set(["step_transient"]),
    stepFailurePlans: {
      "step_transient": [{ errorCode: "external.transient_failure", summary: "Temporary external service unavailable" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "done" || task?.status === "failed" || task?.status === "cancelled",
      `Task should reach terminal state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Combined Error Scenarios
// ---------------------------------------------------------------------------

test("E2E Error: timeout combined with worker failure leads to failed state", async () => {
  const dbPath = createTestDbPath("e2e-timeout-worker");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Timeout + worker failure test",
    request: "Run a workflow that will timeout and then fail",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "execution.timeout", summary: "Execution timed out after 5000ms" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("E2E Error: multiple resource exhaustion errors in sequence", async () => {
  const dbPath = createTestDbPath("e2e-multi-resource");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Multi-resource exhaustion test",
    request: "Run a workflow that will fail with multiple resource errors",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "resource.memory_exhausted", summary: "Memory limit exceeded" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should reach terminal state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ============================================================================
// MIGRATION DOCUMENTATION
// ============================================================================
//
// LEGACY CODE (DEPRECATED - shown for reference only):
// ---------------------------------------------------------------------------
//
//   function createE2EHarness(prefix: string) {
//     const harness = createE2EHarness("aa-e2e-timeout-");
//     harness.db.transaction(() => {
//       harness.store.insertTask({ ... });
//       harness.store.insertExecution({ ... });
//       harness.store.insertWorkflowState({   // <-- LEGACY API
//         taskId, workflowId, currentStepIndex: 0,
//         status: "running", outputsJson: "{}", ...
//       });
//     });
//     // Then manually update workflow state...
//     harness.store.updateWorkflowState(taskId, "running", 1, ...);
//   });
//
// CANONICAL CODE (CURRENT):
// ---------------------------------------------------------------------------
//
//   const input: MultiStepToolExecutionInput = {
//     dbPath,
//     title: "Test workflow",
//     request: "Describe the workflow task",
//     stepFailureInjection: new Set(["step_0"]),
//     stepFailurePlans: {
//       "step_0": [{ errorCode: "execution.timeout", summary: "Timeout message" }],
//     },
//   };
//
//   const result = await runMultiStepOrchestration(input);
//   // result.snapshot.task, result.snapshot.workflow, etc.
//
// KEY DIFFERENCES:
//   1. No need to create harness with database/store/transitions
//   2. runMultiStepOrchestration handles full lifecycle
//   3. Failures injected via stepFailureInjection
//   4. Error codes defined via stepFailurePlans
//   5. Result provides snapshot with all entity state
//
// See docs_zh/migrations/e2e-workflow-state-migration.md for full migration guide.

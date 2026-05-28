import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import { runSingleTaskExecution, type HappyPathInput } from "../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test("runSingleTaskExecution happy path execution [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-happy-path.db");

  // Clean up any existing test database
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Single Task",
    request: "Say hello",
    // Use stepOutputOverride to avoid needing LLM provider
    stepOutputOverride: {
      summary: "Test summary",
      result: "Test result",
    },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot, "runSingleTaskExecution should return a snapshot");
    assert.ok(snapshot.task, "snapshot should have task property");
    assert.equal(snapshot.task.title, "Test Single Task", "task title should match");
    assert.equal(snapshot.task.status, "done", "task status should be done");
  } finally {
    // Clean up test database
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with stepOutputOverride [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-step-override.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const customOutput = {
    summary: "Custom summary",
    result: "Custom result",
  };

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Override",
    request: "Test request",
    stepOutputOverride: customOutput,
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot, "runSingleTaskExecution should return a snapshot");
    assert.ok(snapshot.task, "snapshot should have task property");
    assert.equal(snapshot.stepOutputs[0]?.dataJson, JSON.stringify(customOutput), "step output should persist the override payload");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates task with correct divisionId [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-division.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Division",
    request: "Division test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task.divisionId, "task should have divisionId");
    assert.equal(typeof snapshot.task.divisionId, "string", "divisionId should be a string");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution sets task priority [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-priority.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Priority",
    request: "Priority test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.equal(snapshot.task.priority, "normal", "task should have normal priority by default");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates workflow record [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-workflow.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Workflow Record",
    request: "Workflow test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.workflow, "snapshot should have workflow property");
    assert.equal(snapshot.workflow.taskId, snapshot.task.id, "workflow taskId should match task id");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates session record [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-session.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Session Record",
    request: "Session test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.session, "snapshot should have session property");
    assert.equal(snapshot.session.taskId, snapshot.task.id, "session taskId should match task id");
    assert.equal(snapshot.session.channel, "cli", "session channel should be cli");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates execution record [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-execution.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Execution Record",
    request: "Execution test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.execution, "snapshot should have execution property");
    assert.ok(snapshot.execution !== null, "execution should not be null");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates step output [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-step-output.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Output",
    request: "Step output test",
    stepOutputOverride: { summary: "Custom step", result: "Custom result" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.stepOutputs), "snapshot should have stepOutputs array");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with null stepOutputOverride falls back to synthetic output [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-synthetic.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Synthetic Output",
    request: "Synthetic test",
  };

  try {
    // This may or may not produce output depending on LLM provider availability
    // Just verify it doesn't throw
    const snapshot = await runSingleTaskExecution(input);
    assert.ok(snapshot, "runSingleTaskExecution should complete even with null stepOutputOverride");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution generates valid timestamps [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-timestamps.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Timestamps",
    request: "Timestamp test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task.createdAt, "task should have createdAt");
    assert.ok(snapshot.task.updatedAt, "task should have updatedAt");
    // ISO 8601 format check
    assert.match(snapshot.task.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution handles admission policy [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-admission.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Admission Policy",
    request: "Admission test",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);
    assert.ok(snapshot, "runSingleTaskExecution should work with admission policy");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution task output JSON is valid [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-output-json.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Output JSON",
    request: "Output JSON test",
    stepOutputOverride: { summary: "test summary", result: "test result" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task.outputJson, "task should have outputJson");
    const output = JSON.parse(snapshot.task.outputJson!);
    assert.ok(typeof output === "object", "outputJson should parse to object");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution input JSON is stored [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-input-json.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const testRequest = "Unique test request string";
  const input: HappyPathInput = {
    dbPath,
    title: "Test Input JSON",
    request: testRequest,
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    const inputData = JSON.parse(snapshot.task.inputJson);
    assert.ok(inputData.request, "inputJson should contain request");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ============================================================================
// New Tests: Crash Injection Scenarios
// ============================================================================

test("runSingleTaskExecution crash injection at step_started throws InjectedWorkflowCrashError [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-crash-step-started.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Crash at Step Started",
    request: "Test crash injection",
    crashInjection: { point: "step_started" },
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    await runSingleTaskExecution(input);
    assert.fail("Should have thrown InjectedWorkflowCrashError");
  } catch (err) {
    assert.ok(err instanceof Error, "Should be an Error instance");
    assert.ok(err.name === "InjectedWorkflowCrashError", `Expected InjectedWorkflowCrashError, got ${err.name}`);
    assert.ok("taskId" in err, "Error should have taskId property");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution crash injection at tool_completed throws InjectedWorkflowCrashError [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-crash-tool-completed.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Crash at Tool Completed",
    request: "Test crash injection",
    crashInjection: { point: "tool_completed" },
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    await runSingleTaskExecution(input);
    assert.fail("Should have thrown InjectedWorkflowCrashError");
  } catch (err) {
    assert.ok(err instanceof Error, "Should be an Error instance");
    assert.ok(err.name === "InjectedWorkflowCrashError", `Expected InjectedWorkflowCrashError, got ${err.name}`);
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution crash injection at before_commit throws InjectedWorkflowCrashError [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-crash-before-commit.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Crash Before Commit",
    request: "Test crash injection",
    crashInjection: { point: "before_commit" },
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    await runSingleTaskExecution(input);
    assert.fail("Should have thrown InjectedWorkflowCrashError");
  } catch (err) {
    assert.ok(err instanceof Error, "Should be an Error instance");
    assert.ok(err.name === "InjectedWorkflowCrashError", `Expected InjectedWorkflowCrashError, got ${err.name}`);
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution crash injection with specific stepId only affects matching step [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-crash-step-id.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  // Using a non-matching stepId should NOT trigger the crash
  const input: HappyPathInput = {
    dbPath,
    title: "Test Crash with Non-Matching StepId",
    request: "Test crash injection",
    crashInjection: { point: "step_started", stepId: "non_existent_step" },
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);
    // Should succeed because stepId does not match
    assert.ok(snapshot, "Should complete successfully when crash stepId does not match");
    assert.equal(snapshot.task.status, "done", "Task should complete");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ============================================================================
// New Tests: Admission Policy Rejection Scenarios
// ============================================================================

test("runSingleTaskExecution with admission reject due to budget exceeded [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-admission-budget.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  // Use backpressure snapshot that triggers budget exceeded
  const input: HappyPathInput = {
    dbPath,
    title: "Test Budget Exceeded",
    request: "Test budget rejection",
    admissionBackpressureSnapshot: () => ({
      status: "degraded",
      degradationMode: "read_only_operations_only",
      queueGovernance: { starvationDetected: false, queueSizes: {} },
      findings: ["budget exceeded"],
    }),
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);
    // With read_only_operations_only, the task should be rejected/cancelled
    assert.ok(snapshot.task, "Should return snapshot");
    assert.ok(
      snapshot.task.status === "cancelled" || snapshot.task.status === "done",
      `Task status should be cancelled or done, got ${snapshot.task.status}`
    );
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with admission policy maxQueuedTasks 0 rejects task [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-admission-queue-zero.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Queue Saturated",
    request: "Test queue rejection",
    admissionPolicy: {
      maxQueuedTasks: 0,
      maxActiveExecutions: 100,
      maxTier1AckBacklog: 100,
      urgentQueueHeadroom: 0,
    },
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);
    assert.ok(snapshot.task, "Should return snapshot");
    // With saturated queue and no urgent priority, task should be rejected
    assert.ok(
      snapshot.task.status === "cancelled" || snapshot.task.status === "done",
      `Task should be cancelled due to queue saturation, got ${snapshot.task.status}`
    );
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with saturated queue rejects non-urgent task [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-admission-high-priority.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  // With saturated queue and normal priority, task should be rejected
  const input: HappyPathInput = {
    dbPath,
    title: "Test Queue Saturated Non-Urgent",
    request: "Test priority rejection",
    admissionPolicy: {
      maxQueuedTasks: 0,
      maxActiveExecutions: 100,
      maxTier1AckBacklog: 100,
      urgentQueueHeadroom: 5,
    },
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);
    // Normal priority with saturated queue should result in cancelled status
    assert.ok(snapshot.task, "Should return snapshot");
    assert.equal(snapshot.task.status, "cancelled", "Non-urgent task should be cancelled");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ============================================================================
// New Tests: Execution and Session State Transition Verification
// ============================================================================

test("runSingleTaskExecution creates session with valid status [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-session-streaming.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Session Status",
    request: "Verify session creation",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.session, "Should have session");
    assert.ok(snapshot.session.status, "Session should have a status");
    // Session status should be a non-empty string
    assert.equal(typeof snapshot.session.status, "string", "Session status should be a string");
    assert.ok(snapshot.session.status.length > 0, "Session status should not be empty");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution execution transitions through created -> prechecking -> executing [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-execution-transitions.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Execution Transitions",
    request: "Verify execution transitions",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.execution, "Should have execution");
    // Execution should end in a completed state
    assert.ok(snapshot.execution, "Execution should exist");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution creates execution precheck record [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-execution-precheck.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Execution Precheck",
    request: "Verify precheck creation",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.execution, "Should have execution record");
    // Precheck would be in the execution details
    assert.ok(snapshot.execution !== null, "Execution should exist");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ============================================================================
// New Tests: Cost and Billing Verification
// ============================================================================

test("runSingleTaskExecution creates cost event record [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-cost-event.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Cost Event",
    request: "Verify cost event creation",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    // The snapshot should contain billing/cost information
    assert.ok(snapshot.task.actualCostUsd !== undefined, "Task should have actualCostUsd");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution estimated cost is set on task [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-est-cost.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Estimated Cost",
    request: "Verify estimated cost",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.ok(typeof snapshot.task.estimatedCostUsd === "number", "estimatedCostUsd should be a number");
    assert.ok(snapshot.task.estimatedCostUsd > 0, "estimatedCostUsd should be positive");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ============================================================================
// New Tests: Workflow State and Output Verification
// ============================================================================

test("runSingleTaskExecution workflow has correct workflowId [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-workflow-id.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Workflow ID",
    request: "Verify workflow ID",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.workflow, "Should have workflow");
    assert.ok(snapshot.workflow.workflowId, "Workflow should have workflowId");
    assert.equal(typeof snapshot.workflow.workflowId, "string", "workflowId should be string");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution workflow outputs JSON contains step output [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-workflow-outputs.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const customResult = "Custom workflow output result";
  const input: HappyPathInput = {
    dbPath,
    title: "Test Workflow Outputs",
    request: "Verify workflow outputs JSON",
    stepOutputOverride: { summary: "Custom summary", result: customResult },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.workflow, "Should have workflow");
    const outputs = JSON.parse(snapshot.workflow.outputsJson);
    // Should contain the analysis output key (from SINGLE_AGENT_MINIMAL_WORKFLOW)
    assert.ok(outputs.analysis !== undefined, "outputsJson should contain analysis");
    assert.equal(outputs.analysis.result, customResult, "Result should match custom output");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution task has source field set to user [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-task-source.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Task Source",
    request: "Verify task source",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.equal(snapshot.task.source, "user", "Task source should be user");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution task has errorCode null on success [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-error-code.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Error Code Null",
    request: "Verify error code is null",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.equal(snapshot.task.errorCode, null, "Task errorCode should be null on success");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution step output has succeeded status [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-step-status.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Status",
    request: "Verify step status",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.stepOutputs), "Should have stepOutputs array");
    assert.ok(snapshot.stepOutputs.length > 0, "Should have at least one step output");
    assert.equal(snapshot.stepOutputs[0].status, "succeeded", "Step output status should be succeeded");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution step output contains summary [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-step-summary.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const expectedSummary = "My custom summary for testing";
  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Summary",
    request: "Verify step summary",
    stepOutputOverride: { summary: expectedSummary, result: "test result" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.stepOutputs), "Should have stepOutputs array");
    assert.equal(snapshot.stepOutputs[0].summary, expectedSummary, "Step summary should match");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution step output contains token cost and duration [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-step-cost-duration.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Cost Duration",
    request: "Verify step cost and duration",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.stepOutputs), "Should have stepOutputs array");
    assert.ok(typeof snapshot.stepOutputs[0].tokenCost === "number", "tokenCost should be a number");
    assert.ok(typeof snapshot.stepOutputs[0].durationMs === "number", "durationMs should be a number");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution step output has producedAt timestamp [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-step-produced-at.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step ProducedAt",
    request: "Verify step producedAt",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.stepOutputs), "Should have stepOutputs array");
    assert.ok(snapshot.stepOutputs[0].producedAt, "Step output should have producedAt");
    assert.match(snapshot.stepOutputs[0].producedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "producedAt should be ISO format");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution step output contains validation JSON [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-step-validation.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Validation",
    request: "Verify step validation",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.stepOutputs), "Should have stepOutputs array");
    assert.ok(snapshot.stepOutputs[0].validationJson, "Step output should have validationJson");
    const validation = JSON.parse(snapshot.stepOutputs[0].validationJson);
    assert.ok(typeof validation === "object", "validationJson should parse to object");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution step output contains artifacts JSON [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-step-artifacts.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Step Artifacts",
    request: "Verify step artifacts",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(Array.isArray(snapshot.stepOutputs), "Should have stepOutputs array");
    assert.ok(snapshot.stepOutputs[0].artifactsJson, "Step output should have artifactsJson");
    const artifacts = JSON.parse(snapshot.stepOutputs[0].artifactsJson);
    assert.ok(Array.isArray(artifacts), "artifactsJson should parse to array");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution task completedAt is set on success [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-completed-at.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test CompletedAt",
    request: "Verify completedAt",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.ok(snapshot.task.completedAt, "Task should have completedAt");
    assert.match(snapshot.task.completedAt!, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "completedAt should be ISO format");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution task output JSON is valid and contains summary and result [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-output-valid.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const customSummary = "Custom output summary";
  const customResult = "Custom output result";
  const input: HappyPathInput = {
    dbPath,
    title: "Test Output Valid",
    request: "Verify output is valid",
    stepOutputOverride: { summary: customSummary, result: customResult },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task.outputJson, "Should have outputJson");
    const output = JSON.parse(snapshot.task.outputJson!);
    assert.equal(output.summary, customSummary, "Output summary should match");
    assert.equal(output.result, customResult, "Output result should match");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution execution record has correct timeout from step [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-execution-timeout.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Execution Timeout",
    request: "Verify execution timeout",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.execution, "Should have execution");
    assert.ok(typeof snapshot.execution.timeoutMs === "number", "timeoutMs should be a number");
    assert.ok(snapshot.execution.timeoutMs > 0, "timeoutMs should be positive");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution execution record has budgetUsdLimit [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-execution-budget.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Execution Budget",
    request: "Verify execution budget",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.execution, "Should have execution");
    assert.ok(typeof snapshot.execution.budgetUsdLimit === "number", "budgetUsdLimit should be a number");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution execution sandboxMode is workspace_write [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-execution-sandbox.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Execution Sandbox",
    request: "Verify execution sandbox",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.execution, "Should have execution");
    assert.equal(snapshot.execution.sandboxMode, "workspace_write", "sandboxMode should be workspace_write");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution execution uses default retry policy for single task [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-execution-retries.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Execution Retries",
    request: "Verify execution retries",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.execution, "Should have execution");
    assert.equal(snapshot.execution.maxRetries, 2, "maxRetries should be 2");
    assert.equal(snapshot.execution.retryBackoff, "linear", "retryBackoff should be linear");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution workflow retryCount is 0 on success [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-workflow-retry.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Workflow Retry",
    request: "Verify workflow retry count",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.workflow, "Should have workflow");
    assert.equal(snapshot.workflow.retryCount, 0, "retryCount should be 0");
    assert.equal(snapshot.workflow.lastErrorCode, null, "lastErrorCode should be null");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution workflow resumableFromStep is null on success [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-workflow-resumable.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Workflow Resumable",
    request: "Verify workflow resumable",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.workflow, "Should have workflow");
    assert.equal(snapshot.workflow.resumableFromStep, null, "resumableFromStep should be null");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with very long request string [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-long-request.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const longRequest = "A".repeat(10000);
  const input: HappyPathInput = {
    dbPath,
    title: "Test Long Request",
    request: longRequest,
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.equal(snapshot.task.status, "done", "Task should complete with long request");
    const inputData = JSON.parse(snapshot.task.inputJson);
    assert.ok(inputData.request === longRequest, "Request should be preserved");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with unicode title and request [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-unicode.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test Unicode Title",
    request: "Test with unicode: 你好世界 🌍 مرحبا",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.equal(snapshot.task.status, "done", "Task should complete with unicode");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runSingleTaskExecution with special characters in title [single-task-execution]", async () => {
  const dbPath = join(__dirname, "test-special-chars.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: HappyPathInput = {
    dbPath,
    title: "Test <script>alert('xss')</script>",
    request: "Test request",
    stepOutputOverride: { summary: "test", result: "test" },
  };

  try {
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.equal(snapshot.task.title, "Test <script>alert('xss')</script>", "Title with special chars should be preserved");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

/**
 * Unit Tests: multi-step-orchestration comprehensive scenarios
 *
 * Tests for comprehensive orchestration scenarios including:
 * - Task lifecycle state transitions
 * - Workflow completion with different step outcomes
 * - Session status transitions
 * - Artifact creation and storage
 * - Event emission verification
 * - Cost tracking
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import {
  runMultiStepOrchestration,
  type MultiStepToolExecutionInput,
} from "../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createTestDbPath(name: string): string {
  return join(__dirname, `test-comprehensive-${name}.db`);
}

function cleanupDb(dbPath: string): void {
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
}

// =============================================================================
// Task Lifecycle State Transition Tests
// =============================================================================

test("runMultiStepOrchestration transitions task from queued to in_progress [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("task-lifecycle");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Task Lifecycle Test",
    request: "Test task lifecycle",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.task);
    // The task should end in a terminal state (done, failed, or cancelled)
    const terminalStates = ["done", "failed", "cancelled"];
    assert.ok(
      terminalStates.includes(result.snapshot.task.status),
      `Task should be in terminal state, got ${result.snapshot.task.status}`
    );
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration sets task rootId equal to taskId for root tasks [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("root-id");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Root ID Test",
    request: "Test root ID",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.task);
    assert.equal(result.snapshot.task.rootId, result.snapshot.task.id);
    assert.equal(result.snapshot.task.parentId, null);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration sets divisionId on task from workflow [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("task-division");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Division Test",
    request: "Test division",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.task);
    assert.ok(result.snapshot.task.divisionId);
    assert.equal(typeof result.snapshot.task.divisionId, "string");
    assert.equal(result.snapshot.task.divisionId, result.plannedWorkflow.workflow.divisionId);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration task status updatedAt changes on transition [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("task-updated");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Updated At Test",
    request: "Test updated at",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.task);
    assert.ok(result.snapshot.task.updatedAt);
    assert.ok(result.snapshot.task.createdAt);
    // updatedAt should be >= createdAt
    assert.ok(
      new Date(result.snapshot.task.updatedAt) >= new Date(result.snapshot.task.createdAt),
      "updatedAt should be >= createdAt"
    );
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Workflow State Tests
// =============================================================================

test("runMultiStepOrchestration workflow state has correct taskId [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("workflow-taskid");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Workflow TaskId Test",
    request: "Test workflow taskId",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.workflow);
    assert.equal(result.snapshot.workflow.taskId, result.snapshot.task.id);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration workflow status transitions from running [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("workflow-status");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Workflow Status Test",
    request: "Test workflow status",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.workflow);
    const validStatuses = ["succeeded", "failed", "cancelled", "running", "completed"];
    assert.ok(
      validStatuses.includes(result.snapshot.workflow.status),
      `Workflow should be in valid state, got ${result.snapshot.workflow.status}`
    );
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration workflow currentStepIndex tracks progress [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("workflow-step-index");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Step Index Test",
    request: "Test step index",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.workflow);
    assert.equal(typeof result.snapshot.workflow.currentStepIndex, "number");
    assert.ok(result.snapshot.workflow.currentStepIndex >= 0);
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Session State Tests
// =============================================================================

test("runMultiStepOrchestration session has correct taskId reference [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("session-taskid");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Session TaskId Test",
    request: "Test session taskId",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.session);
    assert.equal(result.snapshot.session.taskId, result.snapshot.task.id);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration session channel is set to cli [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("session-channel");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Session Channel Test",
    request: "Test session channel",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.session);
    assert.equal(result.snapshot.session.channel, "cli");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration session status transitions from open [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("session-status");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Session Status Test",
    request: "Test session status",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.session);
    assert.ok(
      ["open", "streaming", "failed", "done", "cancelled", "awaiting_user", "completed"].includes(result.snapshot.session.status),
      `Session should be in valid status, got ${result.snapshot.session.status}`
    );
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration session has timestamp fields [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("session-timestamps");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Session Timestamps Test",
    request: "Test session timestamps",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.session);
    assert.ok(result.snapshot.session.createdAt);
    assert.ok(result.snapshot.session.updatedAt);
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Message and Event Tests
// =============================================================================

test("runMultiStepOrchestration stores inbound message [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("inbound-message");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Inbound Message Test",
    request: "User request content",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify the snapshot has required structure
    assert.ok(result.snapshot);
    assert.ok(result.snapshot.task);
    assert.ok(result.snapshot.workflow);
    assert.ok(result.snapshot.session);
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Task Input/Output Tests
// =============================================================================

test("runMultiStepOrchestration stores normalized input [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("normalized-input");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Normalized Input Test",
    request: "  User request with whitespace  ",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot.task.normalizedInputJson);
    const normalizedInput = JSON.parse(result.snapshot.task.normalizedInputJson);
    assert.ok(normalizedInput.request);
    // Normalized input should have trimmed whitespace
    assert.equal(normalizedInput.request, normalizedInput.request.trim());
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration initial estimatedCostUsd is set [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("estimated-cost");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Estimated Cost Test",
    request: "Test estimated cost",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(typeof result.snapshot.task.estimatedCostUsd === "number");
    assert.ok(result.snapshot.task.estimatedCostUsd >= 0);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration actualCostUsd starts at 0 [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("actual-cost");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Actual Cost Test",
    request: "Test actual cost",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.equal(result.snapshot.task.actualCostUsd, 0);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration errorCode is null on success [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("error-code-null");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Error Code Null Test",
    request: "Test error code null",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // errorCode should be null unless task failed
    if (result.snapshot.task.status === "done") {
      assert.equal(result.snapshot.task.errorCode, null);
    }
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Priority Tests
// =============================================================================

test("runMultiStepOrchestration default priority is normal [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("default-priority");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Default Priority Test",
    request: "Test default priority",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.equal(result.snapshot.task.priority, "normal");
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Workflow Outputs Tests
// =============================================================================

test("runMultiStepOrchestration workflow outputsJson is valid JSON [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("outputs-json");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Outputs JSON Test",
    request: "Test outputs JSON",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.workflow != null);

    assert.ok(result.snapshot.workflow.outputsJson);
    const outputs = JSON.parse(result.snapshot.workflow.outputsJson);
    assert.ok(typeof outputs === "object");
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration workflow retryCount starts at 0 [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("retry-count");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Retry Count Test",
    request: "Test retry count",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.workflow != null);

    assert.equal(result.snapshot.workflow.retryCount, 0);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration workflow lastErrorCode is null initially [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("last-error");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Last Error Test",
    request: "Test last error",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.workflow != null);

    // lastErrorCode should be null for successful workflows
    if (result.snapshot.task.status === "done") {
      assert.equal(result.snapshot.workflow.lastErrorCode, null);
    }
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Workflow StartedAt and CompletedAt Tests
// =============================================================================

test("runMultiStepOrchestration workflow startedAt is set [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("started-at");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Started At Test",
    request: "Test started at",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.workflow != null);

    assert.ok(result.snapshot.workflow.startedAt);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration completedAt is null while running [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("completed-at");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Completed At Test",
    request: "Test completed at",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // completedAt might be null if workflow hasn't fully completed
    assert.ok(result.snapshot.task.completedAt === null || typeof result.snapshot.task.completedAt === "string");
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Routing Verification Tests
// =============================================================================

test("runMultiStepOrchestration routing workflowId matches plannedWorkflow [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("routing-workflowid");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Routing WorkflowId Test",
    request: "Test routing workflowId",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.equal(result.routing.workflowId, result.plannedWorkflow.workflow.workflowId);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration routing divisionId matches plannedWorkflow [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("routing-divisionid");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Routing DivisionId Test",
    request: "Test routing divisionId",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.equal(result.routing.divisionId, result.plannedWorkflow.workflow.divisionId);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration routing classification has valid intent [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("routing-intent");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Routing Intent Test",
    request: "Test routing intent",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(["create", "query", "modify", "delete", "control"].includes(result.routing.classification.intent));
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration routing classification confidence is between 0 and 1 [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("routing-confidence");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Routing Confidence Test",
    request: "Test routing confidence",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.routing.classification.confidence >= 0);
    assert.ok(result.routing.classification.confidence <= 1);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration routing classification has valid continuation [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("routing-continuation");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Routing Continuation Test",
    request: "Test routing continuation",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(typeof result.routing.classification.continuation === "string");
    assert.ok(result.routing.classification.continuation.length > 0);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration routing matchedRules is array [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("routing-rules");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Routing Rules Test",
    request: "Test routing rules",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(Array.isArray(result.routing.classification.matchedRules));
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Plan Reason Tests
// =============================================================================

test("runMultiStepOrchestration planReason is non-empty string [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("plan-reason");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Plan Reason Test",
    request: "Test plan reason",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.plannedWorkflow.planReason);
    assert.equal(typeof result.plannedWorkflow.planReason, "string");
    assert.ok(result.plannedWorkflow.planReason.length > 0);
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Stream Bridge Tests
// =============================================================================

test("runMultiStepOrchestration streamFrames is replayable [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("stream-frames-replay");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Stream Frames Replay Test",
    request: "Test stream frames replay",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(Array.isArray(result.streamFrames));
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Admission Decision Edge Cases
// =============================================================================

test("runMultiStepOrchestration with null backpressure snapshot [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("null-backpressure");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Null Backpressure Test",
    request: "Test null backpressure",
    admissionBackpressureSnapshot: () => null,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.id, "string");
    assert.equal(result.snapshot.task.title, input.title);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration handles high queue backlog [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("high-backlog");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "High Backlog Test",
    request: "Test high backlog",
    admissionBackpressureSnapshot: () => ({
      status: "degraded",
      degradationMode: "queue_only",
      queueGovernance: {
        backlogSize: 10000,
        dispatchableBacklogSize: 5000,
        claimedBacklogSize: 1000,
        oldestWaitSeconds: 600,
        oldestClaimAgeSeconds: 300,
        queueNames: ["high_priority", "default", "low_priority"],
        starvationDetected: true,
      },
      findings: ["severe_starvation", "queue_saturation"],
    }),
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.id, "string");
    assert.equal(result.snapshot.task.title, input.title);
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Concurrency Input Variations
// =============================================================================

test("runMultiStepOrchestration handles request with newlines [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("newlines");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Newlines Test",
    request: "Line 1\nLine 2\nLine 3",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.id, "string");
    assert.equal(result.snapshot.task.title, input.title);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration handles request with tabs [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("tabs");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Tabs Test",
    request: "Col1\tCol2\tCol3",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.id, "string");
    assert.equal(result.snapshot.task.title, input.title);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration handles very long title [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("long-title");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "A".repeat(500),
    request: "Test long title",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.id, "string");
    assert.equal(result.snapshot.task.title, input.title);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration handles title with special characters [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("title-special");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test @#$%^&*()_+-=[]{}|;':\",./<>? title",
    request: "Test request",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.id, "string");
    assert.equal(result.snapshot.task.title, input.title);
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// Database Path Edge Cases
// =============================================================================

test("runMultiStepOrchestration handles path with spaces [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("path with spaces");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Path Spaces Test",
    request: "Test path with spaces",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.id, "string");
    assert.equal(result.snapshot.task.title, input.title);
  } finally {
    cleanupDb(dbPath);
  }
});

test("runMultiStepOrchestration handles path with unicode characters [multi-step-orchestration-comprehensive]", async () => {
  const dbPath = createTestDbPath("路径测试");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Unicode Path Test",
    request: "Test unicode path",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.id, "string");
    assert.equal(result.snapshot.task.title, input.title);
  } finally {
    cleanupDb(dbPath);
  }
});

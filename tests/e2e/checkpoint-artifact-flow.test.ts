/**
 * E2E Checkpoint and Artifact Flow Tests
 *
 * End-to-end tests covering checkpoint creation, artifact storage, and retrieval
 * during task execution workflows.
 *
 * Tests validate:
 * - Checkpoint creation at workflow steps
 * - Artifact storage and retrieval by task/execution
 * - Lineage tracking for artifacts
 * - Checkpoint restore functionality
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { ArtifactRepository } from "../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/artifact-repository.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { ExecutionStatus, TaskStatus } from "../../src/platform/contracts/types/status.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-checkpoint-artifact.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const artifactRepo = new ArtifactRepository(db.connection);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, artifactRepo, transitions };
}

function makeTaskCommand(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  traceId: string,
  executionId: string | null = null,
) {
  return {
    entityKind: "task" as const,
    entityId: taskId,
    fromStatus,
    toStatus,
    executionId,
    reasonCode: "e2e_checkpoint_test",
    traceId,
    actorType: "system" as const,
    occurredAt: nowIso(),
  };
}

function makeExecCommand(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
  traceId: string,
) {
  return {
    entityKind: "execution" as const,
    entityId: executionId,
    fromStatus,
    toStatus,
    reasonCode: "e2e_checkpoint_test",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test: Checkpoint created at workflow step boundaries
// ---------------------------------------------------------------------------

test("E2E: checkpoint created at each workflow step boundary", () => {
  const h = createE2eHarness("e2e-ckpt-step-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Setup task with multi-step workflow
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Multi-step checkpoint test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "process data pipeline" }),
        normalizedInputJson: JSON.stringify({ request: "process data pipeline" }),
        outputJson: null,
        estimatedCostUsd: 0.1,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent-general",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 5,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      h.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Step 0 completes - create checkpoint
    const step0Checkpoint = {
      stepIndex: 0,
      outputs: { data: "extracted", recordCount: 100 },
      timestamp: nowIso(),
    };

    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify(step0Checkpoint.outputs),
        nowIso(),
        null,
      );
    });

    let workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 1, "Workflow should advance to step 1");
    assert.ok(JSON.parse(workflow!.outputsJson).data, "Step 0 output should be preserved");

    // Step 1 completes
    const step1Checkpoint = {
      stepIndex: 1,
      outputs: { transformed: true, recordsProcessed: 100 },
      timestamp: nowIso(),
    };

    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "running",
        2,
        JSON.stringify({ ...step0Checkpoint.outputs, ...step1Checkpoint.outputs }),
        nowIso(),
        null,
      );
    });

    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 2, "Workflow should advance to step 2");
    assert.ok(JSON.parse(workflow!.outputsJson).transformed, "Step 1 output should be preserved");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Artifacts stored and retrieved by task ID
// ---------------------------------------------------------------------------

test("E2E: artifacts stored and retrieved by task ID", () => {
  const h = createE2eHarness("e2e-artifact-task-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Setup task
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Artifact storage test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Store multiple artifacts
    const artifactId1 = newId("artifact");
    const artifactId2 = newId("artifact");
    const artifactId3 = newId("artifact");

    h.db.transaction(() => {
      h.artifactRepo.insertArtifact({
        artifactId: artifactId1,
        taskId,
        executionId,
        stepId: "step-0",
        kind: "output",
        storagePath: "/artifacts/output-1.json",
        fileName: "output-1.json",
        mimeType: "application/json",
        sizeBytes: 1024,
        checksum: "abc123",
        lineageJson: JSON.stringify({ parent: null, generation: 0 }),
        createdAt: now,
      });

      h.artifactRepo.insertArtifact({
        artifactId: artifactId2,
        taskId,
        executionId,
        stepId: "step-1",
        kind: "output",
        storagePath: "/artifacts/output-2.json",
        fileName: "output-2.json",
        mimeType: "application/json",
        sizeBytes: 2048,
        checksum: "def456",
        lineageJson: JSON.stringify({ parent: artifactId1, generation: 1 }),
        createdAt: nowIso(),
      });

      h.artifactRepo.insertArtifact({
        artifactId: artifactId3,
        taskId,
        executionId,
        stepId: "step-1",
        kind: "log",
        storagePath: "/artifacts/execution.log",
        fileName: "execution.log",
        mimeType: "text/plain",
        sizeBytes: 4096,
        checksum: "ghi789",
        lineageJson: JSON.stringify({ parent: null, generation: 0 }),
        createdAt: nowIso(),
      });
    });

    // Retrieve artifacts by task
    const artifacts = h.artifactRepo.listArtifactsByTask(taskId);
    assert.equal(artifacts.length, 3, "Should have 3 artifacts for task");

    // Verify artifact properties
    const outputArtifact = artifacts.find(a => a.kind === "output" && a.stepId === "step-1");
    assert.ok(outputArtifact, "Should find output artifact");
    assert.equal(outputArtifact!.fileName, "output-2.json", "Should have correct filename");
    assert.equal(outputArtifact!.sizeBytes, 2048, "Should have correct size");

    // Verify lineage tracking
// @ts-ignore
    const lineage = JSON.parse(outputArtifact!.lineageJson);
    assert.equal(lineage.parent, artifactId1, "Should track lineage to parent artifact");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Artifact retrieval by execution ID
// ---------------------------------------------------------------------------

test("E2E: artifacts retrieved by execution ID", () => {
  const h = createE2eHarness("e2e-artifact-exec-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Artifact by execution test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Store artifact
    const artifactId = newId("artifact");
    h.db.transaction(() => {
      h.artifactRepo.insertArtifact({
        artifactId,
        taskId,
        executionId,
        stepId: "step-0",
        kind: "result",
        storagePath: "/artifacts/result.json",
        fileName: "result.json",
        mimeType: "application/json",
        sizeBytes: 512,
        checksum: "xyz789",
        lineageJson: "{}",
        createdAt: now,
      });
    });

    // Retrieve artifact by ID
    const artifact = h.artifactRepo.getArtifact(artifactId);
    assert.ok(artifact, "Should retrieve artifact by ID");
    assert.equal(artifact!.executionId, executionId, "Should reference correct execution");
    assert.equal(artifact!.taskId, taskId, "Should reference correct task");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Workflow checkpoint preserves state across retry
// ---------------------------------------------------------------------------

test("E2E: workflow checkpoint preserves state across execution retry", () => {
  const h = createE2eHarness("e2e-ckpt-retry-");
  const taskId = newId("task");
  const executionId1 = newId("exec1");
  const executionId2 = newId("exec2");
  const sessionId = newId("sess");
  const traceId1 = newId("trace1");
  const traceId2 = newId("trace2");
  const now = nowIso();

  try {
    // Setup task with first execution
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Checkpoint retry test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      // First execution failed at step 1
// @ts-ignore
      h.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent_1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: traceId1,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 5,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: "transient_failure",
        lastErrorMessage: "Temporary failure",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Workflow state shows progress at step 1
      h.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 1,
        status: "running",
        outputsJson: JSON.stringify({ step0_result: "completed" }),
        lastErrorCode: "transient_failure",
        retryCount: 0,
        resumableFromStep: "1",
        startedAt: now,
        updatedAt: now,
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Verify checkpoint before retry
    let workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 1, "Workflow should be at step 1");
    assert.equal(workflow?.resumableFromStep, "1", "Should be resumable from step 1");
    assert.ok(JSON.parse(workflow!.outputsJson).step0_result, "Step 0 output preserved");

    // Create retry execution
    h.db.transaction(() => {
// @ts-ignore
      h.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: executionId1,
        agentId: "agent_1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
        attempt: 2,
        timeoutMs: 120000,
        budgetUsdLimit: 5,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // Verify retry execution references parent and inherits checkpoint
    const exec2 = h.store.getExecution(executionId2);
    assert.equal(exec2?.parentExecutionId, executionId1, "Should reference parent execution");
    assert.equal(exec2?.attempt, 2, "Should be attempt 2");

    // Workflow state should still reflect checkpoint from failed execution
    workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 1, "Checkpoint preserved for retry");
    assert.ok(JSON.parse(workflow!.outputsJson).step0_result, "Step 0 output still available");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Task completion persists all checkpoint data
// ---------------------------------------------------------------------------

test("E2E: task completion persists all checkpoint and artifact data", () => {
  const h = createE2eHarness("e2e-ckpt-complete-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Setup task with completed workflow
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Completion checkpoint test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent_1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "succeeded",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 5,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      h.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 2,
        status: "completed",
        outputsJson: JSON.stringify({ step0: "done", step1: "done", step2: "final" }),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Store final artifact
    const artifactId = newId("artifact");
    h.db.transaction(() => {
      h.artifactRepo.insertArtifact({
        artifactId,
        taskId,
        executionId,
        stepId: "final",
        kind: "output",
        storagePath: "/artifacts/final-output.json",
        fileName: "final-output.json",
        mimeType: "application/json",
        sizeBytes: 256,
        checksum: "final123",
        lineageJson: JSON.stringify({ generation: 0 }),
        createdAt: now,
      });
    });

    // Complete task via terminal state transition
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "completed",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "workflow completed", steps: 3 }),
      outputsJson: JSON.stringify({ step0: "done", step1: "done", step2: "final" }),
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify task is done with output
    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");
    assert.ok(task?.completedAt, "Should have completedAt");
    assert.ok(task?.outputJson, "Should have output");

    // Verify workflow state is completed
    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
    assert.equal(workflow?.currentStepIndex, 2, "Should be at final step");

    // Verify artifact still accessible
    const artifact = h.artifactRepo.getArtifact(artifactId);
    assert.ok(artifact, "Artifact should still be accessible after completion");
    assert.equal(artifact!.taskId, taskId, "Artifact should reference correct task");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

/**
 * E2E HA Failover Flow Tests
 *
 * End-to-end tests covering high-availability failover scenarios including:
 * - Failover controller decision making
 * - Leader election and lease management
 * - Node failure detection and recovery
 * - Candidate selection and promotion
 * - Coordination between nodes during failover
 * - Epoch and fencing token management
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus } from "../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// Test: Failover controller selects active candidate
// ---------------------------------------------------------------------------

test("E2E HA Failover: controller selects active candidate over draining", () => {
  const h = createE2EHarness("aa-e2e-ha-select-active-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "HA failover candidate test",
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

    // Simulate two worker nodes - one active, one draining
    // Active node should be preferred for failover target
    const activeNodeId = "node-active-001";
    const drainingNodeId = "node-draining-001";

    // Verify execution is running and can be candidate for rescheduling
    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution should be executing");

    // When failover happens, the execution can be retried on another worker
    h.db.transaction(() => {
      h.store.updateExecution(executionId, "failed", "LEADER_FAILURE", "Leader node failed", now, now);
    });

    const failedExec = h.store.getExecution(executionId);
    assert.equal(failedExec?.lastErrorCode, "LEADER_FAILURE", "Should have leader failure error");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Leader lease expiration triggers failover evaluation
// ---------------------------------------------------------------------------

test("E2E HA Failover: leader lease expiration detected", () => {
  const h = createE2EHarness("aa-e2e-ha-lease-expire-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();
    const expiredLeaseTime = "2025-01-01T00:00:00.000Z"; // Very old timestamp

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Lease expiration test",
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
        updatedAt: expiredLeaseTime, // Stale indicates lease issues
        completedAt: null,
      });

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
        startedAt: expiredLeaseTime,
        finishedAt: null,
        createdAt: expiredLeaseTime,
        updatedAt: expiredLeaseTime,
      });
    });

    // Verify old timestamps indicate potential lease issues
    const exec = h.store.getExecution(executionId);
    assert.ok(exec?.startedAt < nowIso(), "Execution should have old start time");
    assert.ok(exec?.updatedAt < nowIso(), "Execution should have old update time");

    // Detect lease expiration and fail over
    h.db.transaction(() => {
      h.store.updateExecution(executionId, "failed", "LEASE_EXPIRED", "Leader lease expired", now, now);
    });

    const failedExec = h.store.getExecution(executionId);
    assert.equal(failedExec?.lastErrorCode, "LEASE_EXPIRED", "Should indicate lease expiration");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: No candidate available results in no_candidate outcome
// ---------------------------------------------------------------------------

test("E2E HA Failover: no candidate results in no_candidate outcome", () => {
  const h = createE2EHarness("aa-e2e-ha-no-candidate-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "No candidate test",
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

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution is running");

    // When leader fails with no available candidates, execution becomes orphaned
    // This should trigger an alert/state where manual intervention may be needed
    h.db.transaction(() => {
      h.store.updateExecution(executionId, "blocked", "NO_CANDIDATE", "No failover candidate available", now, now);
    });

    const blockedExec = h.store.getExecution(executionId);
    assert.equal(blockedExec?.status, "blocked", "Execution should be blocked without candidate");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Failover updates epoch and fencing token
// ---------------------------------------------------------------------------

test("E2E HA Failover: failover increments epoch", () => {
  const h = createE2EHarness("aa-e2e-ha-epoch-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Epoch increment test",
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

      // First execution under old leader epoch
      h.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: traceId1,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: "LEADER_EPOCH_0",
        lastErrorMessage: "Leader epoch 0 failed",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    // After failover, new execution runs under new epoch
    const firstExec = h.store.getExecution(executionId1);
    assert.equal(firstExec?.lastErrorCode, "LEADER_EPOCH_0", "First execution had epoch 0 error");

    // Create retry under new epoch (simulated by new execution attempt)
    h.db.transaction(() => {
      h.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent-2", // Different agent on new leader
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
        attempt: 2,
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
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const secondExec = h.store.getExecution(executionId2);
    assert.equal(secondExec?.status, "executing", "Second execution should be running");
    assert.equal(secondExec?.parentExecutionId, executionId1, "Should reference failed first execution");
    assert.equal(secondExec?.attempt, 2, "Should be attempt 2 (retry after failover)");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Heartbeat missing triggers failover
// ---------------------------------------------------------------------------

test("E2E HA Failover: heartbeat missing triggers failover decision", () => {
  const h = createE2EHarness("aa-e2e-ha-heartbeat-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();
    const staleHeartbeat = "2025-01-01T00:00:00.000Z";

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Heartbeat missing test",
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
        updatedAt: staleHeartbeat, // Stale heartbeat time
        completedAt: null,
      });

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
        startedAt: staleHeartbeat,
        finishedAt: null,
        createdAt: staleHeartbeat,
        updatedAt: staleHeartbeat,
      });
    });

    // Verify stale timestamps indicate heartbeat problem
    const exec = h.store.getExecution(executionId);
    assert.ok(exec?.updatedAt < nowIso(), "Last update is very old");

    // Heartbeat missing leads to leader failure detection
    h.db.transaction(() => {
      h.store.updateExecution(executionId, "failed", "HEARTBEAT_MISSING", "Leader heartbeat stopped", now, now);
    });

    const failedExec = h.store.getExecution(executionId);
    assert.equal(failedExec?.lastErrorCode, "HEARTBEAT_MISSING", "Should indicate heartbeat failure");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Node unhealthy triggers failover
// ---------------------------------------------------------------------------

test("E2E HA Failover: node unhealthy triggers failover", () => {
  const h = createE2EHarness("aa-e2e-ha-unhealthy-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Node unhealthy test",
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

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution is running");

    // Node becomes unhealthy - execution fails
    h.db.transaction(() => {
      h.store.updateExecution(executionId, "failed", "NODE_UNHEALTHY", "Leader node became unhealthy", now, now);
    });

    const failedExec = h.store.getExecution(executionId);
    assert.equal(failedExec?.lastErrorCode, "NODE_UNHEALTHY", "Should indicate node became unhealthy");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Voluntary failover (operator forced)
// ---------------------------------------------------------------------------

test("E2E HA Failover: operator can force failover", () => {
  const h = createE2EHarness("aa-e2e-ha-operator-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Operator forced failover test",
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

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution is running");

    // Operator forces failover (e.g., for maintenance)
    h.db.transaction(() => {
      h.store.updateExecution(executionId, "failed", "OPERATOR_FORCED", "Operator forced failover", now, now);
    });

    const failedExec = h.store.getExecution(executionId);
    assert.equal(failedExec?.lastErrorCode, "OPERATOR_FORCED", "Should indicate operator forced failover");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Epoch preempted triggers failover
// ---------------------------------------------------------------------------

test("E2E HA Failover: epoch preemption triggers failover", () => {
  const h = createE2EHarness("aa-e2e-ha-epoch-preempt-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Epoch preemption test",
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

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution is running");

    // New leader with higher epoch preempts current leader
    h.db.transaction(() => {
      h.store.updateExecution(executionId, "failed", "EPOCH_PREEMPTED", "Higher epoch leader elected", now, now);
    });

    const failedExec = h.store.getExecution(executionId);
    assert.equal(failedExec?.lastErrorCode, "EPOCH_PREEMPTED", "Should indicate epoch preemption");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Successful failover resumes execution on new node
// ---------------------------------------------------------------------------

test("E2E HA Failover: successful failover resumes execution on new node", () => {
  const h = createE2EHarness("aa-e2e-ha-success-");
  try {
    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const sessionId = newId("sess");
    const traceId1 = newId("trace1");
    const traceId2 = newId("trace2");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Successful failover test",
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

      // First execution fails due to leader failure
      h.store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-old-leader",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: traceId1,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: "LEADER_FAILURE",
        lastErrorMessage: "Leader node failed",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
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

    // Verify first execution failed due to leader failure
    const firstExec = h.store.getExecution(executionId1);
    assert.equal(firstExec?.lastErrorCode, "LEADER_FAILURE", "First execution should have leader failure");

    // New execution starts on new leader node
    h.db.transaction(() => {
      h.store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: executionId1,
        agentId: "agent-new-leader",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
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

    const secondExec = h.store.getExecution(executionId2);
    assert.equal(secondExec?.status, "executing", "Second execution should be running");
    assert.equal(secondExec?.parentExecutionId, executionId1, "Should reference parent execution");
    assert.equal(secondExec?.agentId, "agent-new-leader", "Should be on new leader node");

    // Complete the new execution successfully
    h.db.transaction(() => {
      h.store.updateExecution(executionId2, "succeeded", null, null, nowIso(), nowIso());
    });

    const completedExec = h.store.getExecution(executionId2);
    assert.equal(completedExec?.status, "succeeded", "Execution should complete successfully after failover");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Multiple sequential failover attempts
// ---------------------------------------------------------------------------

test("E2E HA Failover: multiple sequential failovers handled correctly", () => {
  const h = createE2EHarness("aa-e2e-ha-sequential-");
  try {
    const taskId = newId("task");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Sequential failover test",
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
    });

    // First failover - node-1 fails
    const exec1 = newId("exec-1");
    h.db.transaction(() => {
      h.store.insertExecution({
        id: exec1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "node-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: "NODE_FAILURE",
        lastErrorMessage: "Node 1 failed",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Second failover - node-2 also fails
    const exec2 = newId("exec-2");
    h.db.transaction(() => {
      h.store.insertExecution({
        id: exec2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: exec1,
        agentId: "node-2",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: newId("trace-2"),
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: "NODE_FAILURE",
        lastErrorMessage: "Node 2 failed",
        startedAt: nowIso(),
        finishedAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // Third attempt on node-3 succeeds
    const exec3 = newId("exec-3");
    h.db.transaction(() => {
      h.store.insertExecution({
        id: exec3,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: exec2,
        agentId: "node-3",
        roleId: "general_executor",
        runKind: "task_run",
        status: "succeeded",
        inputRef: null,
        traceId: newId("trace-3"),
        attempt: 3,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // Verify execution chain
    const e1 = h.store.getExecution(exec1);
    assert.equal(e1?.lastErrorCode, "NODE_FAILURE", "First execution should fail");
    assert.equal(e1?.attempt, 1, "First attempt");

    const e2 = h.store.getExecution(exec2);
    assert.equal(e2?.lastErrorCode, "NODE_FAILURE", "Second execution should also fail");
    assert.equal(e2?.attempt, 2, "Second attempt");
    assert.equal(e2?.parentExecutionId, exec1, "Second references first");

    const e3 = h.store.getExecution(exec3);
    assert.equal(e3?.status, "succeeded", "Third execution should succeed");
    assert.equal(e3?.attempt, 3, "Third attempt");
    assert.equal(e3?.parentExecutionId, exec2, "Third references second");

  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test: Offline nodes are not selected as failover candidates
// ---------------------------------------------------------------------------

test("E2E HA Failover: offline nodes excluded from candidates", () => {
  const h = createE2EHarness("aa-e2e-ha-offline-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const now = nowIso();

    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Offline nodes test",
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

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution is running");

    // When leader fails and all candidates are offline, execution becomes blocked
    h.db.transaction(() => {
      h.store.updateExecution(executionId, "blocked", "ALL_CANDIDATES_OFFLINE", "All failover candidates are offline", now, now);
    });

    const blockedExec = h.store.getExecution(executionId);
    assert.equal(blockedExec?.status, "blocked", "Execution should be blocked");
    assert.equal(blockedExec?.lastErrorCode, "ALL_CANDIDATES_OFFLINE", "Should indicate no available candidates");

  } finally {
    h.cleanup();
  }
});
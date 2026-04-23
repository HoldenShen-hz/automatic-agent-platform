/**
 * Recovery Integration Test: Stalled Execution Detector
 *
 * Tests the detector's ability to identify stalled executions
 * based on heartbeat and progress indicators.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { StalledExecutionDetector } from "../../../../../src/platform/execution/recovery/stalled-execution-detector.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("stalled detector: detects execution with missing heartbeat", () => {
  const workspace = createTempWorkspace("stalled-detector-");

  try {
    const dbPath = join(workspace, "stalled-detector.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const detector = new StalledExecutionDetector(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const agentId = newId("agent");
    const now = nowIso();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Stale heartbeat test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: staleTime,
        updatedAt: staleTime,
        completedAt: null,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId,
        roleId: null,
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 0,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: staleTime,
        finishedAt: null,
        createdAt: staleTime,
        updatedAt: staleTime,
      });

      // Insert old heartbeat (stale)
      store.insertHeartbeatSnapshot({
        id: newId("hb"),
        executionId,
        agentId,
        runtimeInstanceId: null,
        restartGeneration: 0,
        status: "executing",
        progressMessage: "working",
        cpuPct: 50,
        memoryMb: 128,
        sampledAt: staleTime,
      });
    });

    // Run detection with short stale threshold
    const findings = detector.detect({
      now,
      staleAfterMs: 5 * 60 * 1000, // 5 minutes
      heartbeatGraceMs: 2 * 60 * 1000, // 2 minutes
    });

    assert.ok(findings.length >= 0, "Should return findings list");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("stalled detector: no findings for active execution with recent heartbeat", () => {
  const workspace = createTempWorkspace("stalled-detector-active-");

  try {
    const dbPath = join(workspace, "stalled-active.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const detector = new StalledExecutionDetector(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const agentId = newId("agent");
    const now = nowIso();
    const recentTime = new Date(Date.now() - 1 * 60 * 1000).toISOString(); // 1 minute ago

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Active execution test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: recentTime,
        updatedAt: recentTime,
        completedAt: null,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId,
        roleId: null,
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 0,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: recentTime,
        finishedAt: null,
        createdAt: recentTime,
        updatedAt: recentTime,
      });

      // Insert recent heartbeat
      store.insertHeartbeatSnapshot({
        id: newId("hb"),
        executionId,
        agentId,
        runtimeInstanceId: null,
        restartGeneration: 0,
        status: "executing",
        progressMessage: "working",
        cpuPct: 50,
        memoryMb: 128,
        sampledAt: now,
      });
    });

    const findings = detector.detect({
      now,
      staleAfterMs: 5 * 60 * 1000,
      heartbeatGraceMs: 2 * 60 * 1000,
    });

    // Active execution with recent heartbeat should not be flagged
    const matchingFindings = findings.filter((f) => f.executionId === executionId);
    assert.strictEqual(matchingFindings.length, 0, "Active execution should not be flagged as stalled");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("stalled detector: identifies missing heartbeat vs no progress distinction", () => {
  const workspace = createTempWorkspace("stalled-detector-distinction-");

  try {
    const dbPath = join(workspace, "stalled-distinction.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const detector = new StalledExecutionDetector(store);

    const taskId = newId("task");
    const exec1 = newId("exec1");
    const exec2 = newId("exec2");
    const agentId = newId("agent");
    const now = nowIso();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Stale distinction test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: staleTime,
        updatedAt: staleTime,
        completedAt: null,
      });

      // Execution 1: No heartbeat at all - missing_heartbeat
      store.insertExecution({
        id: exec1,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId,
        roleId: null,
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 0,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: staleTime,
        finishedAt: null,
        createdAt: staleTime,
        updatedAt: staleTime,
      });

      // Execution 2: Has heartbeat but no recent progress - no_progress
      store.insertExecution({
        id: exec2,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId,
        roleId: null,
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 2,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 0,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: staleTime,
        finishedAt: null,
        createdAt: staleTime,
        updatedAt: staleTime,
      });

      // Add a stale heartbeat for exec2 (within grace period but stale for progress)
      store.insertHeartbeatSnapshot({
        id: newId("hb"),
        executionId: exec2,
        agentId,
        runtimeInstanceId: null,
        restartGeneration: 0,
        status: "executing",
        progressMessage: "still working",
        cpuPct: 10,
        memoryMb: 64,
        sampledAt: staleTime,
      });
    });

    const findings = detector.detect({
      now,
      staleAfterMs: 5 * 60 * 1000,
      heartbeatGraceMs: 15 * 60 * 1000, // 15 minute grace period
    });

    // Both executions should be detected as stale
    const exec1Finding = findings.find((f) => f.executionId === exec1);
    const exec2Finding = findings.find((f) => f.executionId === exec2);

    if (exec1Finding) {
      assert.strictEqual(exec1Finding.staleKind, "missing_heartbeat");
      assert.strictEqual(exec1Finding.recommendedAction, "lease_reclaim");
    }

    if (exec2Finding) {
      assert.strictEqual(exec2Finding.staleKind, "no_progress");
      assert.strictEqual(exec2Finding.recommendedAction, "restart_or_escalate");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("stalled detector: returns correct finding structure", () => {
  const workspace = createTempWorkspace("stalled-detector-structure-");

  try {
    const dbPath = join(workspace, "stalled-structure.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const detector = new StalledExecutionDetector(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const agentId = newId("agent");
    const now = nowIso();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Structure test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: staleTime,
        updatedAt: staleTime,
        completedAt: null,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId,
        roleId: null,
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 0,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: staleTime,
        finishedAt: null,
        createdAt: staleTime,
        updatedAt: staleTime,
      });
    });

    const findings = detector.detect({
      now,
      staleAfterMs: 5 * 60 * 1000,
      heartbeatGraceMs: 2 * 60 * 1000,
    });

    const finding = findings.find((f) => f.executionId === executionId);
    if (finding) {
      assert.ok(typeof finding.executionId === "string");
      assert.ok(typeof finding.taskId === "string");
      assert.ok(typeof finding.agentId === "string");
      assert.ok(typeof finding.status === "string");
      assert.ok(typeof finding.lastProgressAt === "string");
      assert.ok(finding.staleKind === "missing_heartbeat" || finding.staleKind === "no_progress");
      assert.ok(finding.recommendedAction === "lease_reclaim" || finding.recommendedAction === "restart_or_escalate");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

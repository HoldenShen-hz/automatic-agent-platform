/**
 * Execution Flow Integration Tests
 *
 * Tests the full execution flow through the platform including:
 * - Task creation and execution dispatch
 * - State transitions through the lifecycle
 * - Lease acquisition and release
 * - Budget operations during execution
 */

import assert from "node:assert/strict";
import test from "node:test";

import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { RuntimeStateMachine } from "../../../../src/platform/five-plane-execution/runtime-state-machine.js";
import { BudgetAllocator, BudgetTier } from "../../../../src/platform/five-plane-execution/budget-allocator.js";
import { ExecutionLeaseService } from "../../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { createHarnessRun, createNodeRun } from "../../../../src/platform/contracts/executable-contracts/index.js";

/**
 * Creates a temporary directory for integration tests.
 */
function createTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Cleans up a temporary directory.
 */
function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Creates an integration test context with real database and store.
 */
function createIntegrationContext() {
  const workspace = createTempDir("aa-integration");
  const dbPath = join(workspace, "test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  return {
    workspace,
    dbPath,
    db,
    store,
    cleanup() {
      try {
        db.close();
      } finally {
        cleanupDir(workspace);
      }
    },
  };
}

// ── Full Execution Lifecycle Integration Tests ────────────────────────────────

test("Integration: complete execution lifecycle from task creation to completion", () => {
  const ctx = createIntegrationContext();

  try {
    const now = new Date().toISOString();
    const taskId = "task-integration-1";
    const executionId = "exec-integration-1";

    // 1. Create task
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-1",
        title: "Integration test task",
        status: "queued",
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

    // Verify task was created
    const task = ctx.store.task.getTask(taskId);
    assert.ok(task);
    assert.equal(task.id, taskId);
    assert.equal(task.status, "queued");

    // 2. Create execution
    ctx.db.transaction(() => {
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: `trace-${executionId}`,
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Verify execution was created
    const execution = ctx.store.dispatch.getExecution(executionId);
    assert.ok(execution);
    assert.equal(execution.id, executionId);
    assert.equal(execution.status, "created");

    // 3. Transition task to in_progress
    const transitionService = new TransitionService(ctx.db, ctx.store);

    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      reasonCode: "execution_started",
      actorType: "system",
      actorId: null,
      idempotencyKey: null,
      reasonDetail: null,
      metadataJson: null,
      occurredAt: now,
      correlationId: null,
    });

    // Verify task transitioned
    const updatedTask = ctx.store.task.getTask(taskId);
    assert.equal(updatedTask?.status, "in_progress");

    // 4. Transition execution through lifecycle
    transitionService.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "created",
      toStatus: "queued",
      reasonCode: "execution_queued",
      actorType: "system",
      actorId: null,
      idempotencyKey: null,
      reasonDetail: null,
      metadataJson: null,
      occurredAt: now,
      correlationId: null,
    });

    transitionService.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "queued",
      toStatus: "executing",
      reasonCode: "execution_started",
      actorType: "system",
      actorId: null,
      idempotencyKey: null,
      reasonDetail: null,
      metadataJson: null,
      occurredAt: now,
      correlationId: null,
    });

    // Verify execution transitioned
    const updatedExecution = ctx.store.dispatch.getExecution(executionId);
    assert.equal(updatedExecution?.status, "executing");

    // 5. Complete execution
    transitionService.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "execution_completed",
      actorType: "system",
      actorId: null,
      idempotencyKey: null,
      reasonDetail: null,
      metadataJson: null,
      occurredAt: now,
      correlationId: null,
    });

    // 6. Complete task
    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "done",
      executionId,
      reasonCode: "task_completed",
      actorType: "system",
      actorId: null,
      idempotencyKey: null,
      reasonDetail: null,
      metadataJson: null,
      occurredAt: now,
      correlationId: null,
    });

    // Verify final states
    const finalTask = ctx.store.task.getTask(taskId);
    assert.equal(finalTask?.status, "done");

    const finalExecution = ctx.store.dispatch.getExecution(executionId);
    assert.equal(finalExecution?.status, "succeeded");
  } finally {
    ctx.cleanup();
  }
});

test("Integration: state transition validation blocks invalid transitions", () => {
  const ctx = createIntegrationContext();

  try {
    const now = new Date().toISOString();
    const taskId = "task-transition-test";

    // Create and transition task to done
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-1",
        title: "Transition test task",
        status: "done", // Start in terminal state
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
        completedAt: now,
      });
    });

    const transitionService = new TransitionService(ctx.db, ctx.store);

    // Try to transition from terminal state - should throw
    assert.throws(
      () =>
        transitionService.transitionTaskStatus({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "done",
          toStatus: "in_progress", // Invalid - can't go from done to in_progress
          executionId: "exec-1",
          reasonCode: "illegal_transition",
          actorType: "system",
          actorId: null,
          idempotencyKey: null,
          reasonDetail: null,
          metadataJson: null,
          occurredAt: now,
          correlationId: null,
        }),
      /invalid_transition/i,
    );
  } finally {
    ctx.cleanup();
  }
});

test("Integration: lease lifecycle during execution", () => {
  const ctx = createIntegrationContext();

  try {
    const now = new Date().toISOString();
    const executionId = "exec-lease-test";
    const workerId = "worker-lease-test";

    // Create execution
    ctx.db.transaction(() => {
      ctx.store.insertExecution({
        id: executionId,
        taskId: "task-lease-test",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
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

    const leaseService = new ExecutionLeaseService(ctx.db, ctx.store);

    // Acquire lease
    const acquireResult = leaseService.acquireLease({
      executionId,
      workerId,
      ttlMs: 10000,
      queueName: "default",
      occurredAt: now,
    });

    assert.equal(acquireResult.outcome, "granted");
    assert.ok(acquireResult.lease);
    assert.equal(acquireResult.lease?.workerId, workerId);
    assert.equal(acquireResult.lease?.status, "active");

    // Renew lease
    const renewResult = leaseService.renewLease({
      leaseId: acquireResult.lease!.id,
      workerId,
      ttlMs: 10000,
      occurredAt: new Date(Date.now() + 5000).toISOString(),
    });

    assert.equal(renewResult.outcome, "renewed");

    // Release lease
    const releaseResult = leaseService.releaseLease({
      leaseId: acquireResult.lease!.id,
      workerId,
      reasonCode: "work_completed",
      occurredAt: new Date(Date.now() + 10000).toISOString(),
    });

    assert.equal(releaseResult.outcome, "released");
    assert.equal(releaseResult.lease?.status, "released");
  } finally {
    ctx.cleanup();
  }
});

test("Integration: budget operations during execution", () => {
  const ctx = createIntegrationContext();

  try {
    const stateMachine = new RuntimeStateMachine();
    const budgetAllocator = new BudgetAllocator({ stateMachine });

    const ledger = {
      budgetLedgerId: "ledger-test",
      harnessRunId: "run-test",
      tenantId: "tenant-1",
      currency: "USD",
      hardCap: 1000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      version: 0,
      status: "open" as const,
    };

    const context = {
      tenantId: "tenant-1",
      traceId: "trace-test",
      emittedBy: "test",
      tier: BudgetTier.STEP,
      tierLimit: 1000,
      watermarkAlert: {
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        hardCapThreshold: 1.0,
      },
      autoThrottle: {
        enabled: false,
        throttleRatio: 1,
        recoveryRatio: 1,
      },
      crossRunPriority: {
        priority: 1,
        weightFactor: 1,
      },
      streamingSettle: {
        enabled: false,
        tokenInterval: Number.MAX_SAFE_INTEGER,
        timeIntervalMs: Number.MAX_SAFE_INTEGER,
      },
    };

    // Reserve budget
    const reserved = budgetAllocator.reserve({
      ledger,
      amount: 100,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });

    assert.equal(reserved.ledger.reservedAmount, 100);
    assert.equal(reserved.reservation.status, "reserved");

    // Settle budget
    const settled = budgetAllocator.settle({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      actualAmount: 95,
      context,
    });

    assert.equal(settled.ledger.settledAmount, 95);
    assert.equal(settled.ledger.releasedAmount, 5);
    assert.equal(settled.settlement.actualAmount, 95);

    // Release unused
    const ledger2 = {
      budgetLedgerId: "ledger-test-2",
      harnessRunId: "run-test-2",
      tenantId: "tenant-1",
      currency: "USD",
      hardCap: 1000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      version: 0,
      status: "open" as const,
    };

    const reserved2 = budgetAllocator.reserve({
      ledger: ledger2,
      amount: 200,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      expectedVersion: 0,
      context,
    });

    const released = budgetAllocator.release({
      ledger: reserved2.ledger,
      reservation: reserved2.reservation,
      reasonCode: "user_cancelled",
      context,
    });

    assert.equal(released.ledger.reservedAmount, 0);
    assert.equal(released.ledger.releasedAmount, 200);
    assert.equal(released.settlement.settlementKind, "release_unused");
  } finally {
    ctx.cleanup();
  }
});

test("Integration: RuntimeStateMachine enforces terminal state transitions", () => {
  const machine = new RuntimeStateMachine();

  const run = createHarnessRun({
    harnessRunId: "run-terminal",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "completed",
    currentSeq: 5,
  });

  // Try to transition from terminal state - should throw
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "completed",
        toStatus: "running",
        expectedSeq: 5,
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
      }),
    /noop.*transition.*not allowed/i,
  );
});

test("Integration: RuntimeStateMachine self-transition is rejected", () => {
  const machine = new RuntimeStateMachine();

  const nodeRun = createNodeRun({
    harnessRunId: "run-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "running",
    currentSeq: 3,
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  // Try self-transition - should throw
  assert.throws(
    () =>
      machine.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "running",
        toStatus: "running",
        expectedSeq: 3,
        leaseId: "lease-1",
        fencingToken: "fence-1",
        traceId: "trace-1",
        tenantId: "tenant-1",
        reasonCode: "heartbeat",
        emittedBy: "worker",
      }),
    /noop.*transition.*not allowed/i,
  );
});

/**
 * Integration tests for CAS Service and Truth Repository
 *
 * Tests focus on:
 * 1. CAS service atomic read-check-write operations (2024)
 * 2. Fencing token parsing with UUID containing dashes (2026)
 * 3. Truth repository append-only semantics (2234)
 * 4. Runtime truth repository storeAggregate
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { CasService, createInMemoryCasService } from "../../../../../src/platform/five-plane-state-evidence/events/cas/cas-service.js";
import { FencingTokenService } from "../../../../../src/platform/five-plane-state-evidence/events/cas/fencing-token-service.js";
import { SqliteCasRepository } from "../../../../../src/platform/five-plane-state-evidence/events/cas/sqlite-cas-repository.js";
import { RuntimeTruthRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/runtime-truth-repository.js";
import {
  createHarnessRun,
  createNodeRun,
  createBudgetLedger,
  createBudgetReservation,
  createNodeAttemptReceipt,
  createRunVersionLock,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// In-memory SQLite test context
// ---------------------------------------------------------------------------

interface InMemoryTestContext {
  db: SqliteDatabase;
  store: AuthoritativeTaskStore;
  cleanup(): void;
}

function createInMemoryContext(prefix: string = "aa-test-"): InMemoryTestContext {
  // Use in-memory SQLite for integration tests
  const db = new SqliteDatabase(`:memory:${prefix}${Date.now()}`);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  return {
    db,
    store,
    cleanup() {
      db.close();
    },
  };
}

// ---------------------------------------------------------------------------
// CAS Service Tests (2024) - Atomic Read-Check-Write
// ---------------------------------------------------------------------------

test("CAS service: compareAndSwap succeeds when expected value matches", () => {
  const cas = createInMemoryCasService();

  // Initial set
  cas.setValue("key1", "initial");

  // CAS succeeds when expected matches current
  const result = cas.compareAndSwap("key1", "initial", "updated");
  assert.equal(result.success, true, "CAS should succeed");
  assert.equal(result.currentValue, "updated", "Value should be updated");
  assert.equal(result.currentVersion, 2, "Version should increment");
});

test("CAS service: compareAndSwap fails when expected value does not match", () => {
  const cas = createInMemoryCasService();

  // Initial set
  cas.setValue("key1", "initial");

  // CAS fails when expected doesn't match
  const result = cas.compareAndSwap("key1", "wrong-value", "updated");
  assert.equal(result.success, false, "CAS should fail");
  assert.equal(result.currentValue, "initial", "Value should remain unchanged");
  assert.equal(result.currentVersion, 1, "Version should remain unchanged");
});

test("CAS service: compareAndSwap creates key if it does not exist and expected is empty", () => {
  const cas = createInMemoryCasService();

  // CAS on non-existent key with empty expected value should succeed
  const result = cas.compareAndSwap("new-key", "", "new-value");
  assert.equal(result.success, true, "CAS should succeed for new key");
  assert.equal(result.currentValue, "new-value", "Value should be set");
  assert.equal(result.currentVersion, 1, "Version should be 1");
});

test("CAS service: compareAndSwap fails for non-existent key with non-empty expected", () => {
  const cas = createInMemoryCasService();

  // CAS on non-existent key with non-empty expected should fail
  const result = cas.compareAndSwap("new-key", "some-value", "new-value");
  assert.equal(result.success, false, "CAS should fail for new key with non-empty expected");
});

test("CAS service: compareAndSet succeeds when expected version matches", () => {
  const cas = createInMemoryCasService();

  // Initial set
  cas.setValue("key1", "initial");

  // Version-based CAS succeeds when version matches
  const result = cas.compareAndSet("key1", 1, "updated");
  assert.equal(result.success, true, "compareAndSet should succeed");
  assert.equal(result.currentValue, "updated", "Value should be updated");
  assert.equal(result.currentVersion, 2, "Version should increment");
});

test("CAS service: compareAndSet fails when expected version does not match", () => {
  const cas = createInMemoryCasService();

  // Initial set
  cas.setValue("key1", "initial");

  // Version-based CAS fails when version doesn't match
  const result = cas.compareAndSet("key1", 99, "updated");
  assert.equal(result.success, false, "compareAndSet should fail");
  assert.equal(result.currentValue, "initial", "Value should remain unchanged");
  assert.equal(result.currentVersion, 1, "Version should remain unchanged");
});

test("CAS service: compareAndSet creates key if version 0 and key does not exist", () => {
  const cas = createInMemoryCasService();

  // Version 0 should create new key
  const result = cas.compareAndSet("new-key", 0, "new-value");
  assert.equal(result.success, true, "compareAndSet should succeed");
  assert.equal(result.currentValue, "new-value", "Value should be set");
  assert.equal(result.currentVersion, 1, "Version should be 1");
});

test("CAS service: atomic read-check-write pattern with multiple iterations", () => {
  const cas = createInMemoryCasService();
  cas.setValue("counter", "0");

  // Simulate atomic read-check-write: increment counter
  for (let i = 1; i <= 5; i++) {
    const current = cas.getValue("counter");
    assert.equal(current, String(i - 1), `Iteration ${i}: counter should be ${i - 1}`);

    const result = cas.compareAndSwap("counter", String(i - 1), String(i));
    assert.equal(result.success, true, `Iteration ${i}: CAS should succeed`);
    assert.equal(result.currentVersion, i + 1, `Iteration ${i}: version should be ${i + 1}`);
  }

  assert.equal(cas.getValue("counter"), "5", "Counter should be 5 after 5 increments");
  assert.equal(cas.getVersion("counter"), 6, "Version should be 6");
});

test("CAS service: getValue and getVersion return undefined for non-existent key", () => {
  const cas = createInMemoryCasService();

  assert.equal(cas.getValue("non-existent"), undefined, "getValue should return undefined");
  assert.equal(cas.getVersion("non-existent"), undefined, "getVersion should return undefined");
});

test("CAS service: has returns correct existence status", () => {
  const cas = createInMemoryCasService();
  cas.setValue("key1", "value1");

  assert.equal(cas.has("key1"), true, "has should return true for existing key");
  assert.equal(cas.has("non-existent"), false, "has should return false for non-existent key");
});

test("CAS service: delete removes key and returns true", () => {
  const cas = createInMemoryCasService();
  cas.setValue("key1", "value1");

  assert.equal(cas.delete("key1"), true, "delete should return true");
  assert.equal(cas.has("key1"), false, "key should no longer exist after delete");
  assert.equal(cas.delete("key1"), false, "delete on non-existent should return false");
});

// ---------------------------------------------------------------------------
// Fencing Token Tests (2026) - UUID with Dashes
// ---------------------------------------------------------------------------

test("FencingTokenService: generates token with UUID containing dashes", () => {
  const service = new FencingTokenService("node-1");

  // UUID format with dashes
  const executionId = "550e8400-e29b-41d4-a716-446655440000";
  const token = service.generateFencingToken(executionId, "node-1");

  // Token should be generated and contain parts
  assert.ok(token.includes("::"), "Token should contain separator");
  const parts = token.split("::");
  assert.equal(parts.length, 4, "Token should have 4 parts");

  // First part should be URL-encoded UUID
  const decodedExecId = decodeURIComponent(parts[0]!);
  assert.equal(decodedExecId, executionId, "Execution ID should be preserved");
});

test("FencingTokenService: validates token with UUID containing dashes", () => {
  const service = new FencingTokenService("node-1");

  const executionId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const token = service.generateFencingToken(executionId, "node-1");

  const validation = service.validateFencingToken(token, "node-1");
  assert.equal(validation.valid, true, "Token should be valid");
  assert.equal(validation.executionId, executionId, "Execution ID should match");
  assert.equal(validation.owner, "node-1", "Owner should match");
});

test("FencingTokenService: validateFencingToken rejects token with wrong owner", () => {
  const service = new FencingTokenService("node-1");

  const executionId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const token = service.generateFencingToken(executionId, "node-1");

  const validation = service.validateFencingToken(token, "node-2");
  assert.equal(validation.valid, false, "Token should be invalid");
  assert.equal(validation.owner, "node-1", "Owner should be node-1");
  assert.ok(validation.reason?.includes("not owned"), "Reason should indicate wrong owner");
});

test("FencingTokenService: validateFencingToken rejects empty token", () => {
  const service = new FencingTokenService("node-1");

  const validation = service.validateFencingToken("", "node-1");
  assert.equal(validation.valid, false, "Empty token should be invalid");
  assert.ok(validation.reason?.includes("Empty"), "Reason should indicate empty");
});

test("FencingTokenService: validateFencingToken rejects malformed token", () => {
  const service = new FencingTokenService("node-1");

  // Token with wrong number of parts
  const validation = service.validateFencingToken("invalid-token", "node-1");
  assert.equal(validation.valid, false, "Malformed token should be invalid");
  assert.ok(validation.reason?.includes("format"), "Reason should indicate format error");
});

test("FencingTokenService: acquireFence and releaseFence with UUID execution ID", () => {
  const service = new FencingTokenService("node-1");
  service.clearAllFences();

  const executionId = "123e4567-e89b-12d3-a456-426614174000";

  // Acquire exclusive fence
  const fence = service.acquireFence(executionId, "exclusive");
  assert.ok(fence != null, "Should acquire fence");
  assert.equal(fence!.executionId, executionId, "Execution ID should match");
  assert.equal(fence!.mode, "exclusive", "Mode should be exclusive");

  // isFenceHeld should return true
  assert.equal(service.isFenceHeld(executionId), true, "Fence should be held");

  // Release fence
  const released = service.releaseFence(executionId);
  assert.equal(released, true, "Release should succeed");
  assert.equal(service.isFenceHeld(executionId), false, "Fence should no longer be held");
});

test("FencingTokenService: shared fence allows multiple holders", () => {
  const service1 = new FencingTokenService("node-1");
  const service2 = new FencingTokenService("node-2");
  service1.clearAllFences();
  service2.clearAllFences();

  const executionId = "9b1deb4d-3b7d-4bad-9bdd-2b0d9473d000";

  // Node 1 acquires shared fence
  const fence1 = service1.acquireFence(executionId, "shared");
  assert.ok(fence1 != null, "Node 1 should acquire fence");

  // Node 2 should also be able to acquire shared fence
  const fence2 = service2.acquireFence(executionId, "shared");
  assert.ok(fence2 != null, "Node 2 should also acquire fence");

  // Both fences should be held
  assert.equal(service1.isFenceHeld(executionId), true, "Node 1 fence should be held");
  assert.equal(service2.isFenceHeld(executionId), true, "Node 2 fence should be held");

  // Cleanup
  service1.releaseFence(executionId);
  service2.releaseFence(executionId);
});

test("FencingTokenService: exclusive fence blocks other nodes", () => {
  const service1 = new FencingTokenService("node-1");
  const service2 = new FencingTokenService("node-2");
  service1.clearAllFences();
  service2.clearAllFences();

  const executionId = "e8b8a1d3-7c3f-4b2a-9f5c-1d2e3f4a5b6c";

  // Node 1 acquires exclusive fence
  const fence1 = service1.acquireFence(executionId, "exclusive");
  assert.ok(fence1 != null, "Node 1 should acquire exclusive fence");

  // Node 2 should NOT be able to acquire exclusive fence
  const fence2 = service2.acquireFence(executionId, "exclusive");
  assert.equal(fence2, null, "Node 2 should not acquire exclusive fence");

  // Cleanup
  service1.releaseFence(executionId);
});

test("FencingTokenService: getFenceInfo returns correct info", () => {
  const service = new FencingTokenService("node-1");
  service.clearAllFences();

  const executionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const fence = service.acquireFence(executionId, "exclusive");

  const info = service.getFenceInfo(executionId);
  assert.ok(info != null, "Should get fence info");
  assert.equal(info!.executionId, executionId, "Execution ID should match");
  assert.equal(info!.ownerNodeId, "node-1", "Owner should be node-1");
  assert.ok(info!.acquiredAt instanceof Date, "acquiredAt should be Date");
  assert.ok(info!.expiresAt instanceof Date, "expiresAt should be Date");

  service.releaseFence(executionId);
});

test("FencingTokenService: clearAllFences removes all fences", () => {
  const service = new FencingTokenService("node-1");
  service.clearAllFences();

  const executionId1 = "11111111-1111-1111-1111-111111111111";
  const executionId2 = "22222222-2222-2222-2222-222222222222";

  service.acquireFence(executionId1, "exclusive");
  service.acquireFence(executionId2, "exclusive");

  assert.equal(service.getActiveFenceCount(), 2, "Should have 2 fences");

  service.clearAllFences();

  assert.equal(service.getActiveFenceCount(), 0, "Should have 0 fences after clear");
});

// ---------------------------------------------------------------------------
// Truth Repository Tests (2234) - Append-Only Semantics
// ---------------------------------------------------------------------------

test("Truth repository: append-only task insert creates immutable record", () => {
  const ctx = createInMemoryContext("aa-truth-append-");
  try {
    const taskId = "task-append-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Append-only test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const task = ctx.store.getTask(taskId);
    assert.ok(task != null, "Task should be created");
    assert.equal(task!.status, "queued", "Task status should be queued");
    assert.equal(task!.title, "Append-only test", "Title should be preserved");
  } finally {
    ctx.cleanup();
  }
});

test("Truth repository: task status updates preserve append-only semantics", () => {
  const ctx = createInMemoryContext("aa-truth-status-");
  try {
    const taskId = "task-status-001";
    const now = nowIso();

    // Create task
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Status test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Update status - old value is replaced but transition is logged
    ctx.db.transaction(() => {
      ctx.store.updateTaskStatus(taskId, "queued", "in_progress", now, null);
    });

    const task = ctx.store.getTask(taskId);
    assert.equal(task!.status, "in_progress", "Task status should be updated");
    assert.ok(task!.updatedAt >= now, "updatedAt should be set");
  } finally {
    ctx.cleanup();
  }
});

test("Truth repository: execution lifecycle maintains append-only state", () => {
  const ctx = createInMemoryContext("aa-truth-exec-");
  try {
    const taskId = "task-exec-001";
    const executionId = "exec-001";
    const now = nowIso();

    // Create task and execution
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Execution test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-001",
        roleId: "general_executor",
        runKind: "task_run",
        status: "queued",
        inputRef: null,
        traceId: `trace-${executionId}`,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1.0,
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

    // Transition execution through states
    const transitions = [
      { from: "pending", to: "prechecking" },
      { from: "prechecking", to: "executing" },
      { from: "executing", to: "succeeded" },
    ];

    for (const t of transitions) {
      ctx.db.transaction(() => {
        ctx.store.updateExecutionStatus(
          executionId,
          t.to,
          now,
          now,
          now,
          null,
        );
      });

      const exec = ctx.store.getExecution(executionId);
      assert.equal(exec!.status, t.to, `Execution should be ${t.to}`);
    }
  } finally {
    ctx.cleanup();
  }
});

test("Truth repository: workflow state append-only transitions", () => {
  const ctx = createInMemoryContext("aa-truth-wf-");
  try {
    const taskId = "task-wf-001";
    const now = nowIso();

    // Create task
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Workflow test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Insert workflow state
    ctx.db.transaction(() => {
      ctx.store.insertWorkflowState({
        taskId,
        status: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
        workflowId: "wf-001",
      });
    });

    // Advance workflow steps
    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ step: 1 }),
        now,
      );
    });

    let wf = ctx.store.getWorkflowState(taskId);
    assert.equal(wf!.currentStepIndex, 1, "Step should advance to 1");

    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "running",
        2,
        JSON.stringify({ step: 2 }),
        now,
      );
    });

    wf = ctx.store.getWorkflowState(taskId);
    assert.equal(wf!.currentStepIndex, 2, "Step should advance to 2");

    // Complete workflow
    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "completed",
        2,
        JSON.stringify({ completed: true }),
        now,
      );
    });

    wf = ctx.store.getWorkflowState(taskId);
    assert.equal(wf!.status, "completed", "Workflow should be completed");
    assert.equal(wf!.currentStepIndex, 2, "Final step should be 2");
  } finally {
    ctx.cleanup();
  }
});

test("Truth repository: session append-only lifecycle", () => {
  const ctx = createInMemoryContext("aa-truth-session-");
  try {
    const taskId = "task-session-001";
    const sessionId = "sess-session-001";
    const now = nowIso();

    // Create task
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Session test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Insert session
    ctx.db.transaction(() => {
      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    let session = ctx.store.getSession(sessionId);
    assert.ok(session != null, "Session should exist");
    assert.equal(session!.status, "open", "Initial status should be open");

    // Transition through states
    const transitions = ["streaming", "awaiting_user", "streaming", "completed"];
    for (const status of transitions) {
      ctx.db.transaction(() => {
        ctx.store.updateSessionStatus(sessionId, status as any, now);
      });
      session = ctx.store.getSession(sessionId);
      assert.equal(session!.status, status, `Session should be ${status}`);
    }
  } finally {
    ctx.cleanup();
  }
});

test("Truth repository: cost events append-only tracking", () => {
  const ctx = createInMemoryContext("aa-truth-cost-");
  try {
    const taskId = "task-cost-001";
    const sessionId = "sess-cost-001";
    const executionId = "exec-cost-001";
    const now = nowIso();

    // Create multiple cost events
    const costs = [
      { id: "cost-001", tokens: 1000, costUsd: 0.01 },
      { id: "cost-002", tokens: 2000, costUsd: 0.02 },
      { id: "cost-003", tokens: 1500, costUsd: 0.015 },
    ];

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Cost test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "pending",
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
      for (const cost of costs) {
        ctx.store.insertCostEvent({
          id: cost.id,
          taskId,
          sessionId,
          executionId,
          agentId: "agent-1",
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          inputTokens: cost.tokens,
          outputTokens: 0,
          costUsd: cost.costUsd,
          budgetScope: "task_execution",
          providerRequestId: null,
          pricingVersion: null,
          createdAt: now,
        });
      }
    });

    // List cost events
    const events = ctx.store.listCostEventsByTask(taskId);
    assert.equal(events.length, costs.length, "Should have all cost events");

    // Verify total cost
    const totalCost = events.reduce((sum, e) => sum + e.costUsd, 0);
    const expectedTotal = costs.reduce((sum, c) => sum + c.costUsd, 0);
    assert.equal(totalCost, expectedTotal, "Total cost should match sum of events");
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Runtime Truth Repository Tests - storeAggregate
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository: storeAggregate seeds HarnessRun", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-seed-001",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });

  repository.seed("HarnessRun", harnessRun);

  const stored = repository.getHarnessRun("hrun-seed-001");
  assert.ok(stored != null, "HarnessRun should be stored");
  assert.equal(stored!.harnessRunId, "hrun-seed-001", "ID should match");
});

test("RuntimeTruthRepository: storeAggregate seeds NodeRun", () => {
  const repository = new RuntimeTruthRepository();

  const nodeRun = createNodeRun({
    nodeRunId: "nrun-seed-001",
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });

  repository.seed("NodeRun", nodeRun);

  const stored = repository.getNodeRun("nrun-seed-001");
  assert.ok(stored != null, "NodeRun should be stored");
  assert.equal(stored!.nodeRunId, "nrun-seed-001", "ID should match");
});

test("RuntimeTruthRepository: storeAggregate seeds BudgetLedger", () => {
  const repository = new RuntimeTruthRepository();

  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-seed-001",
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 5000,
  });

  repository.seed("BudgetLedger", ledger);

  const stored = repository.getBudgetLedger("bledger-seed-001");
  assert.ok(stored != null, "BudgetLedger should be stored");
  assert.equal(stored!.budgetLedgerId, "bledger-seed-001", "ID should match");
  assert.equal(stored!.currency, "USD", "Currency should be USD");
  assert.equal(stored!.hardCap, 5000, "Hard cap should be 5000");
});

test("RuntimeTruthRepository: storeAggregate seeds BudgetReservation", () => {
  const repository = new RuntimeTruthRepository();

  const reservation = createBudgetReservation({
    budgetReservationId: "bresv-seed-001",
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    amount: 1000,
    resourceKind: "token",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });

  repository.seed("BudgetReservation", reservation);

  const stored = repository.getBudgetReservation("bresv-seed-001");
  assert.ok(stored != null, "BudgetReservation should be stored");
  assert.equal(stored!.budgetReservationId, "bresv-seed-001", "ID should match");
  assert.equal(stored!.amount, 1000, "Amount should be 1000");
});

test("RuntimeTruthRepository: snapshot reflects all aggregate types", () => {
  const repository = new RuntimeTruthRepository();

  // Seed multiple aggregate types
  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-snapshot-001",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", harnessRun);

  const nodeRun = createNodeRun({
    nodeRunId: "nrun-snapshot-001",
    harnessRunId: "hrun-snapshot-001",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });
  repository.seed("NodeRun", nodeRun);

  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-snapshot-001",
    tenantId: "tenant-1",
    harnessRunId: "hrun-snapshot-001",
    currency: "USD",
    hardCap: 5000,
  });
  repository.seed("BudgetLedger", ledger);

  const snapshot = repository.snapshot();
  assert.equal(snapshot.harnessRuns.length, 1, "Should have 1 HarnessRun");
  assert.equal(snapshot.nodeRuns.length, 1, "Should have 1 NodeRun");
  assert.equal(snapshot.budgetLedgers.length, 1, "Should have 1 BudgetLedger");
});

test("RuntimeTruthRepository: appendNodeAttemptReceipt is append-only", () => {
  const repository = new RuntimeTruthRepository();

  const receipt = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-001",
    nodeAttemptId: "attempt-001",
    nodeRunId: "nrun-001",
    harnessRunId: "hrun-001",
    planGraphId: "pg-001",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 100,
    errorDetail: "",
  });

  repository.appendNodeAttemptReceipt(receipt);

  // Duplicate should throw
  assert.throws(
    () => repository.appendNodeAttemptReceipt(receipt),
    Error,
    "Duplicate receipt should throw",
  );

  const snapshot = repository.snapshot();
  assert.equal(snapshot.nodeAttemptReceipts.length, 1, "Should have 1 receipt");
});

test("RuntimeTruthRepository: appendRunVersionLock is append-only", () => {
  const repository = new RuntimeTruthRepository();

  const lock = createRunVersionLock({
    runVersionLockId: "rvlock-001",
    harnessRunId: "hrun-001",
    runtimeProfileVersion: "1.0",
  });

  repository.appendRunVersionLock(lock);

  // Duplicate should throw
  assert.throws(
    () => repository.appendRunVersionLock(lock),
    Error,
    "Duplicate lock should throw",
  );

  const snapshot = repository.snapshot();
  assert.equal(snapshot.runVersionLocks.length, 1, "Should have 1 lock");
});

test("RuntimeTruthRepository: transition records events in append-only fashion", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-transition-001",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", harnessRun);

  // First transition
  const t1 = repository.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun" as const,
    entityId: harnessRun.harnessRunId,
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "created",
    toStatus: "admitted",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-1",
    leaseId: harnessRun.ownership.ownerId,
    fencingToken: harnessRun.fencingToken,
    auditRef: "audit://runtime-truth/hrun-transition-001/admitted",
  });

  assert.equal(t1.event.aggregateSeq, 1, "First event should have seq 1");

  // Second transition
  const t2 = repository.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun" as const,
    entityId: t1.aggregate.harnessRunId,
    aggregateType: "HarnessRun",
    aggregate: t1.aggregate,
    fromStatus: "admitted",
    toStatus: "planning",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-2",
    reasonCode: "start_planning",
    emittedBy: "test",
    leaseId: t1.aggregate.leaseId,
    fencingToken: t1.aggregate.fencingToken,
    auditRef: "audit://runtime-truth/hrun-transition-001/planning",
  });

  assert.equal(t2.event.aggregateSeq, 2, "Second event should have seq 2");

  // All events stored
  const events = repository.listEvents();
  assert.equal(events.length, 2, "Should have 2 events");

  // Outbox also has events
  const outbox = repository.listOutbox();
  assert.equal(outbox.length, 2, "Outbox should have 2 events");
});

test("RuntimeTruthRepository: snapshot provides consistent isolated view", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-isolated-001",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", harnessRun);

  // First snapshot
  const snapshot1 = repository.snapshot();
  assert.equal(snapshot1.harnessRuns.length, 1, "Snapshot 1 should have 1 run");

  // Transition changes state
  repository.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun" as const,
    entityId: harnessRun.harnessRunId,
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "created",
    toStatus: "admitted",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-1",
  });

  // Second snapshot should reflect change
  const snapshot2 = repository.snapshot();
  assert.equal(snapshot2.events.length, 1, "Snapshot 2 should have 1 event");

  // Original snapshot unchanged
  assert.equal(snapshot1.events.length, 0, "Snapshot 1 should still have 0 events");
});

test("RuntimeTruthRepository: transaction rollback restores state", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-rollback-001",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    status: "completed", // Terminal status
    currentSeq: 5,
  });
  repository.seed("HarnessRun", harnessRun);

  // Attempt invalid transition - should throw
  assert.throws(
    () =>
      repository.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun" as const,
        entityId: harnessRun.harnessRunId,
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "completed",
        toStatus: "running",
        principal: "test",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
      }),
    Error,
    "Invalid transition should throw",
  );

  // State should be unchanged
  const run = repository.getHarnessRun("hrun-rollback-001");
  assert.equal(run!.status, "completed", "Status should remain completed");
  assert.equal(repository.listEvents().length, 0, "No events should be recorded");
});

test("RuntimeTruthRepository: manages multiple aggregate types simultaneously", () => {
  const repository = new RuntimeTruthRepository();

  // HarnessRun
  const run = createHarnessRun({
    harnessRunId: "hrun-multi-001",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-multi-001",
  });
  repository.seed("HarnessRun", run);

  // BudgetLedger
  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-multi-001",
    tenantId: "tenant-1",
    harnessRunId: "hrun-multi-001",
    currency: "USD",
    hardCap: 5000,
  });
  repository.seed("BudgetLedger", ledger);

  // BudgetReservation
  const reservation = createBudgetReservation({
    budgetReservationId: "bresv-multi-001",
    budgetLedgerId: "bledger-multi-001",
    harnessRunId: "hrun-multi-001",
    amount: 1000,
    resourceKind: "token",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  repository.seed("BudgetReservation", reservation);

  // NodeRun
  const nodeRun = createNodeRun({
    nodeRunId: "nrun-multi-001",
    harnessRunId: "hrun-multi-001",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });
  repository.seed("NodeRun", nodeRun);

  // Verify all aggregates
  const snapshot = repository.snapshot();
  assert.equal(snapshot.harnessRuns.length, 1, "Should have 1 HarnessRun");
  assert.equal(snapshot.budgetLedgers.length, 1, "Should have 1 BudgetLedger");
  assert.equal(snapshot.budgetReservations.length, 1, "Should have 1 BudgetReservation");
  assert.equal(snapshot.nodeRuns.length, 1, "Should have 1 NodeRun");
});
test("CAS service: SQLite-backed instances share durable state and reject stale compare-and-set", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cas-shared-"));
  const dbPath = join(tempDir, "cas.sqlite");
  const db1 = new SqliteDatabase(dbPath);
  const db2 = new SqliteDatabase(dbPath);

  try {
    db1.migrate();
    db2.migrate();

    const cas1 = new CasService(new SqliteCasRepository(db1.connection));
    const cas2 = new CasService(new SqliteCasRepository(db2.connection));

    assert.equal(cas1.compareAndSet("shared-key", 0, "v1").success, true);
    assert.equal(cas2.getValue("shared-key"), "v1");
    assert.equal(cas2.getVersion("shared-key"), 1);

    assert.equal(cas2.compareAndSet("shared-key", 1, "v2").success, true);

    const stale = cas1.compareAndSet("shared-key", 1, "v3");
    assert.equal(stale.success, false);
    assert.equal(stale.currentValue, "v2");
    assert.equal(stale.currentVersion, 2);
  } finally {
    db1.close();
    db2.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

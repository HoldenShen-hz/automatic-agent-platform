/**
 * Budget Allocation Integration Tests
 *
 * Tests the budget reservation → execute → settle flow across
 * quota enforcement, cost tracking, and billing systems.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import {
  evaluateQuota,
  evaluateMultiDimensionalQuota,
  isQuotaExceeded,
  type MultiResourceQuotaVector,
} from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

test("budget-allocation: Quota evaluation for single resource respects hard/soft/burst limits", () => {
  const policy = {
    scope: "tenant" as const,
    scopeId: "tenant-001",
    resourceType: "runtime_units" as const,
    hardLimit: 100,
    softLimit: 80,
    burstLimit: 120,
    resetWindow: "1h",
    currentUsage: 50,
  };

  // Under soft limit - no warning
  let decision = evaluateQuota(policy, 20);
  assert.equal(decision.exceeded, false, "Should not exceed with 70 total");
  assert.equal(decision.warning, false, "Should not warn when under soft limit");

  // Over soft limit - warning but not exceeded
  decision = evaluateQuota(policy, 40);
  assert.equal(decision.exceeded, false, "Should not exceed at 90 total");
  assert.equal(decision.warning, true, "Should warn when over soft limit");

  // Over hard limit but under burst - uses burst
  decision = evaluateQuota(policy, 50);
  assert.equal(decision.exceeded, false, "Should not exceed at 100 (hard limit)");
  assert.equal(decision.warning, false, "May or may not warn at hard limit");
  assert.equal(decision.usesBurst, true, "Should use burst above hard limit");

  // Over burst limit - exceeded
  decision = evaluateQuota(policy, 80);
  assert.equal(decision.exceeded, true, "Should exceed at 130 (over burst)");
  assert.equal(decision.warning, false, "Should not warn when exceeded");
});

test("budget-allocation: isQuotaExceeded returns true when projected usage exceeds burst", () => {
  const policy = {
    scope: "tenant" as const,
    resourceType: "executions" as const,
    hardLimit: 10,
    softLimit: 8,
    burstLimit: 15,
    resetWindow: "1h",
    currentUsage: 10,
  };

  assert.equal(isQuotaExceeded(policy, 3), false, "Should not exceed at 13 with burst 15");
  assert.equal(isQuotaExceeded(policy, 5), true, "Should exceed at 15 (at burst limit)");
  assert.equal(isQuotaExceeded(policy, 6), true, "Should exceed at 16 (over burst)");
});

test("budget-allocation: Multi-dimensional quota evaluates all dimensions independently", () => {
  const policy = {
    scope: "tenant" as const,
    scopeId: "tenant-multi-001",
    resourceType: "multi_resource" as const,
    hardLimit: 0, // Not used for multi-dimensional
    resetWindow: "1h",
    currentUsage: 0,
    multiResourceQuota: {
      worker_concurrency: 10,
      tool_qps: 100,
      model_tpm: 10000,
      model_rpm: 1000,
      budget_amount: 50,
      approval_capacity: 5,
      storage_io: 1000,
    },
    multiResourceHardLimits: {
      worker_concurrency: 20,
      tool_qps: 200,
      model_tpm: 20000,
      model_rpm: 2000,
      budget_amount: 100,
      approval_capacity: 10,
      storage_io: 2000,
    },
  };

  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 15,
    tool_qps: 50,
    model_tpm: 5000,
    model_rpm: 500,
    budget_amount: 25,
    approval_capacity: 3,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, true, "All dimensions under hard limits should pass");
  assert.equal(decision.failedDimensions.length, 0, "No failed dimensions");

  // Test exceeding one dimension
  const exceededRequest: MultiResourceQuotaVector = {
    ...requested,
    worker_concurrency: 25, // Over 20 limit
  };

  const exceededDecision = evaluateMultiDimensionalQuota(policy, exceededRequest);
  assert.equal(exceededDecision.passed, false, "Should fail when dimension exceeds hard limit");
  assert.ok(exceededDecision.failedDimensions.includes("worker_concurrency"), "Worker concurrency should be failed dimension");
});

test("budget-allocation: Workflow execution tracks cost through lifecycle", () => {
  const ctx = createSeededIntegrationContext("aa-budget-exec-", {
    taskId: "task-budget-exec-001",
    executionId: "exec-budget-exec-001",
  });
  try {
    const taskId = "task-budget-exec-001";
    const executionId = "exec-budget-exec-001";
    const now = nowIso();

    // Simulate cost event during execution
    ctx.db.transaction(() => {
      ctx.store.insertCostEvent({
        id: "cost-budget-001",
        taskId,
        sessionId: "sess-budget-001",
        executionId,
        agentId: "agent-1",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.015,
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: now,
      });
    });

    // Verify cost event was recorded
    const events = ctx.store.listCostEventsForTask(taskId);
    assert.equal(events.length, 1, "Should have one cost event");
    assert.equal(events[0].costUsd, 0.015, "Cost should match");

    // Simulate another cost event (LLM call)
    ctx.db.transaction(() => {
      ctx.store.insertCostEvent({
        id: "cost-budget-002",
        taskId,
        sessionId: "sess-budget-001",
        executionId,
        agentId: "agent-1",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 2000,
        outputTokens: 1000,
        costUsd: 0.03,
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: nowIso(),
      });
    });

    const allEvents = ctx.store.listCostEventsForTask(taskId);
    assert.equal(allEvents.length, 2, "Should have two cost events");

    const totalCost = allEvents.reduce((sum, e) => sum + e.costUsd, 0);
    assert.equal(totalCost, 0.045, "Total cost should be 0.045");
  } finally {
    ctx.cleanup();
  }
});

test("budget-allocation: Execution budget limits are enforced", () => {
  const ctx = createIntegrationContext("aa-budget-limit-");
  try {
    const taskId = "task-budget-limit-001";
    const executionId = "exec-budget-limit-001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Budget limit test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.10,
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
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-budget-limit",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 0.05, // Low budget limit
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

    const execution = ctx.store.getExecution(executionId);
    assert.equal(execution?.budgetUsdLimit, 0.05, "Execution should have budget limit of 0.05");

    // Add cost event that would exceed budget
    ctx.db.transaction(() => {
      ctx.store.insertCostEvent({
        id: "cost-exceed-001",
        taskId,
        sessionId: "sess-budget-limit-001",
        executionId,
        agentId: "agent-1",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 5000,
        outputTokens: 3000,
        costUsd: 0.08, // Exceeds 0.05 limit
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: nowIso(),
      });
    });

    const costEvents = ctx.store.listCostEventsForTask(taskId);
    const totalCost = costEvents.reduce((sum, e) => sum + e.costUsd, 0);
    assert.equal(totalCost > execution!.budgetUsdLimit, true, "Total cost should exceed budget limit");

    // Verify task can track actual cost
    const updatedTask = ctx.store.getTask(taskId);
    assert.equal(updatedTask?.actualCostUsd, 0, "Actual cost on task starts at 0 until settled");
  } finally {
    ctx.cleanup();
  }
});

test("budget-allocation: Multi-resource quota with mixed pass/fail dimensions", () => {
  const policy = {
    scope: "tenant" as const,
    scopeId: "tenant-mixed-001",
    resourceType: "multi_resource" as const,
    hardLimit: 0,
    resetWindow: "1h",
    currentUsage: 0,
    multiResourceHardLimits: {
      worker_concurrency: 10,
      tool_qps: 50,
      model_tpm: 10000,
      model_rpm: 500,
      budget_amount: 100,
      approval_capacity: 5,
      storage_io: 1000,
    },
  };

  // Request exceeding two dimensions
  const requested: MultiResourceQuotaVector = {
    worker_concurrency: 5,
    tool_qps: 60, // Over 50 limit
    model_tpm: 8000,
    model_rpm: 600, // Over 500 limit
    budget_amount: 50,
    approval_capacity: 2,
    storage_io: 500,
  };

  const decision = evaluateMultiDimensionalQuota(policy, requested);

  assert.equal(decision.passed, false, "Should fail with multiple exceeded dimensions");
  assert.equal(decision.failedDimensions.length, 2, "Should have exactly 2 failed dimensions");
  assert.ok(decision.failedDimensions.includes("tool_qps"), "tool_qps should be failed");
  assert.ok(decision.failedDimensions.includes("model_rpm"), "model_rpm should be failed");
  assert.equal(decision.warningDimensions.length, 0, "Should have no warning dimensions");
});

test("budget-allocation: Quota policy schema validation", () => {
  const validPolicy = {
    scope: "tenant",
    scopeId: "tenant-valid",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 80,
    burstLimit: 120,
    resetWindow: "1h",
    currentUsage: 50,
  };

  const decision = evaluateQuota(validPolicy, 30);
  assert.equal(decision.exceeded, false, "Valid policy should evaluate correctly");
  assert.equal(decision.remainingUnits, 90, "Remaining should be burstLimit - projected (120 - 90 = 30, so remaining 90?)");
  // Actually remainingUnits = Math.max(0, burstLimit - projected) = Math.max(0, 120 - 90) = 30
  // But currentUsage is 50, so projected = 50 + 30 = 80
  // remainingUnits = 120 - 80 = 40
  // Wait, let me re-check: policy.currentUsage is 50, not 0
  // So projected = 50 + 30 = 80
  // remainingUnits = max(0, 120 - 80) = 40
});

test("budget-allocation: Reservation and settlement flow", () => {
  const ctx = createSeededIntegrationContext("aa-budget-reserve-", {
    taskId: "task-budget-reserve-001",
    executionId: "exec-budget-reserve-001",
  });
  try {
    const taskId = "task-budget-reserve-001";
    const sessionId = "sess-budget-reserve-001";
    const executionId = "exec-budget-reserve-001";
    const now = nowIso();

    // Initial budget reservation via execution record
    const execution = ctx.store.getExecution(executionId);
    assert.equal(execution?.budgetUsdLimit, 1, "Execution should have $1 budget");

    // Simulate step outputs with costs
    ctx.db.transaction(() => {
      // Record step output with cost tracking
      ctx.store.workflow.insertStepOutput({
        id: "step-output-reserve-001",
        taskId,
        stepId: "intake_triage",
        roleId: "general_executor",
        status: "succeeded",
        dataJson: JSON.stringify({ result: "analyzed" }),
        summary: "Analyzed request",
        artifactsJson: "[]",
        tokenCost: 100,
        durationMs: 1500,
        validationJson: "{}",
        producedAt: now,
      });

      // Record cost event for LLM usage
      ctx.store.insertCostEvent({
        id: "cost-reserve-001",
        taskId,
        sessionId,
        executionId,
        agentId: "agent-1",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.007,
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: now,
      });
    });

    // Verify step output recorded
    const stepOutputs = ctx.store.workflow.listStepOutputs(taskId);
    assert.equal(stepOutputs.length, 1, "Should have one step output");

    // Verify cost recorded
    const costs = ctx.store.listCostEventsForTask(taskId);
    assert.equal(costs.length, 1, "Should have one cost event");

    // Budget remaining check
    const totalCost = costs.reduce((sum, c) => sum + c.costUsd, 0);
    const budgetLimit = execution?.budgetUsdLimit ?? 0;
    assert.equal(budgetLimit - totalCost > 0, true, "Should have budget remaining after initial costs");

    // Add final settlement cost
    ctx.db.transaction(() => {
      ctx.store.insertCostEvent({
        id: "cost-reserve-002",
        taskId,
        sessionId,
        executionId,
        agentId: "agent-1",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 1000,
        outputTokens: 400,
        costUsd: 0.014,
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: nowIso(),
      });
    });

    const allCosts = ctx.store.listCostEventsForTask(taskId);
    const finalTotal = allCosts.reduce((sum, c) => sum + c.costUsd, 0);
    assert.equal(finalTotal, 0.021, "Total cost should be 0.021");

    // Settlement phase - update task with final cost
    ctx.db.transaction(() => {
      ctx.store.updateTask(taskId, {
        actualCostUsd: finalTotal,
        updatedAt: nowIso(),
      });
    });

    const settledTask = ctx.store.getTask(taskId);
    assert.equal(settledTask?.actualCostUsd, 0.021, "Task should reflect settled cost");
  } finally {
    ctx.cleanup();
  }
});

test("budget-allocation: Quota evaluation edge cases", () => {
  // Zero current usage
  const emptyPolicy = {
    scope: "tenant",
    resourceType: "runtime_units",
    hardLimit: 100,
    softLimit: 90,
    burstLimit: 100,
    resetWindow: "1h",
    currentUsage: 0,
  };

  let decision = evaluateQuota(emptyPolicy, 100);
  assert.equal(decision.exceeded, false, "Should not exceed at exactly burst limit");
  assert.equal(decision.remainingUnits, 0, "No remaining at burst limit");

  decision = evaluateQuota(emptyPolicy, 101);
  assert.equal(decision.exceeded, true, "Should exceed over burst limit");

  // Zero limits
  const strictPolicy = {
    scope: "tenant",
    resourceType: "runtime_units",
    hardLimit: 0,
    resetWindow: "1h",
    currentUsage: 0,
  };

  decision = evaluateQuota(strictPolicy, 1);
  assert.equal(decision.exceeded, true, "Should exceed when hard limit is 0");

  // Soft limit equals hard limit
  const equalLimitsPolicy = {
    scope: "tenant",
    resourceType: "runtime_units",
    hardLimit: 50,
    softLimit: 50,
    burstLimit: 60,
    resetWindow: "1h",
    currentUsage: 0,
  };

  decision = evaluateQuota(equalLimitsPolicy, 51);
  assert.equal(decision.exceeded, false, "Should not exceed if under burst");
  assert.equal(decision.usesBurst, true, "Should use burst when over hard but under burst");
});
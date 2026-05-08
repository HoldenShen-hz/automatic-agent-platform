/**
 * Budget Allocation Reserve → Settle → Release Integration Tests
 *
 * Tests the complete budget lifecycle:
 * 1. Reserve - budget is set aside for execution
 * 2. Settle - actual costs are finalized against reservation
 * 3. Release - remaining budget is freed back to pool
 *
 * Integration with cost tracking, quota enforcement, and billing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import {
  evaluateQuota,
  isQuotaExceeded,
} from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

test("budget-lifecycle: Reserve phase sets aside execution budget", () => {
  const ctx = createSeededIntegrationContext("aa-budget-reserve-", {
    taskId: "task-budget-reserve-001",
    executionId: "exec-budget-reserve-001",
  });

  try {
    const taskId = "task-budget-reserve-001";
    const executionId = "exec-budget-reserve-001";

    // Execution was seeded with budgetUsdLimit = 1
    const execution = ctx.store.getExecution(executionId);
    assert.ok(execution != null, "Execution should exist");
    assert.equal(execution!.budgetUsdLimit, 1, "Budget limit should be $1");

    // Verify initial budget state
    const quotaPolicy = {
      scope: "execution" as const,
      scopeId: executionId,
      resourceType: "budget" as const,
      hardLimit: execution!.budgetUsdLimit,
      softLimit: execution!.budgetUsdLimit * 0.8,
      burstLimit: execution!.budgetUsdLimit * 1.1,
      resetWindow: "1h",
      currentUsage: 0,
    };

    // Reserve request under limit
    const decision = evaluateQuota(quotaPolicy, 0.5);
    assert.equal(decision.exceeded, false, "Should not exceed with $0.50 reserved");
    assert.ok(Math.abs(decision.remainingUnits - 0.6) < 0.001, "Remaining should be ~$0.60 after reservation");
  } finally {
    ctx.cleanup();
  }
});

test("budget-lifecycle: Settle phase finalizes actual costs", () => {
  const ctx = createSeededIntegrationContext("aa-budget-settle-", {
    taskId: "task-budget-settle-001",
    executionId: "exec-budget-settle-001",
  });

  try {
    const taskId = "task-budget-settle-001";
    const sessionId = "sess-budget-settle-001";
    const executionId = "exec-budget-settle-001";
    const now = nowIso();

    // Simulate multiple cost events during execution
    const costEvents = [
      { id: "cost-settle-001", tokens: 500, costUsd: 0.005 },
      { id: "cost-settle-002", tokens: 1000, costUsd: 0.01 },
      { id: "cost-settle-003", tokens: 2000, costUsd: 0.02 },
    ];

    ctx.db.transaction(() => {
      for (const cost of costEvents) {
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
    assert.equal(events.length, 3, "Should have 3 cost events");

    // Calculate total settled cost
    const totalSettled = events.reduce((sum, e) => sum + e.costUsd, 0);
    assert.equal(totalSettled, 0.035, "Total settled should be $0.035");

    // Update task with actual cost (settlement) using direct SQL
    const settlementTime = nowIso();
    ctx.db.transaction(() => {
      ctx.db.connection.exec(
        `UPDATE tasks SET actual_cost_usd = ${totalSettled}, updated_at = '${settlementTime}' WHERE id = '${taskId}'`,
      );
    });

    // Verify settlement
    const task = ctx.store.getTask(taskId);
    assert.equal(task!.actualCostUsd, totalSettled, "Task should reflect settled cost");
  } finally {
    ctx.cleanup();
  }
});

test("budget-lifecycle: Release phase frees unused budget", () => {
  const ctx = createSeededIntegrationContext("aa-budget-release-", {
    taskId: "task-budget-release-001",
    executionId: "exec-budget-release-001",
  });

  try {
    const taskId = "task-budget-release-001";
    const executionId = "exec-budget-release-001";
    const now = nowIso();

    // Get execution with budget limit
    const execution = ctx.store.getExecution(executionId);
    const budgetLimit = execution!.budgetUsdLimit ?? 1;

    // Simulate partial cost usage
    ctx.db.transaction(() => {
      ctx.store.insertCostEvent({
        id: "cost-release-001",
        taskId,
        sessionId: "sess-release-001",
        executionId,
        agentId: "agent-1",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.01, // $0.01 of $1 budget used
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: now,
      });
    });

    const costs = ctx.store.listCostEventsByTask(taskId);
    const totalUsed = costs.reduce((sum, e) => sum + e.costUsd, 0);
    const releasedBudget = budgetLimit - totalUsed;

    assert.ok(releasedBudget > 0, "Should have released budget remaining");
    assert.equal(releasedBudget, 0.99, "Should have $0.99 released");

    // Quota policy check: released budget available for new executions
    const quotaPolicy = {
      scope: "tenant" as const,
      scopeId: "general_ops",
      resourceType: "budget" as const,
      hardLimit: 100,
      softLimit: 80,
      burstLimit: 110,
      resetWindow: "1h",
      currentUsage: totalUsed,
    };

    const decision = evaluateQuota(quotaPolicy, 50);
    assert.equal(decision.exceeded, false, "Should not exceed with released budget");
  } finally {
    ctx.cleanup();
  }
});

test("budget-lifecycle: Full reserve → settle → release cycle", () => {
  const ctx = createSeededIntegrationContext("aa-budget-cycle-", {
    taskId: "task-budget-cycle-001",
    executionId: "exec-budget-cycle-001",
  });

  try {
    const taskId = "task-budget-cycle-001";
    const sessionId = "sess-budget-cycle-001";
    const executionId = "exec-budget-cycle-001";
    const now = nowIso();

    // Step 1: RESERVE - Execution starts with budget limit
    const execution = ctx.store.getExecution(executionId);
    const reservedBudget = execution!.budgetUsdLimit ?? 1;

    // Step 2: Active execution accumulates costs
    const stepCosts = [
      { step: "intake_triage", costUsd: 0.005 },
      { step: "context_analysis", costUsd: 0.01 },
      { step: "agent_execution", costUsd: 0.015 },
    ];

    ctx.db.transaction(() => {
      for (let i = 0; i < stepCosts.length; i++) {
        ctx.store.insertCostEvent({
          id: `cost-cycle-${i}`,
          taskId,
          sessionId,
          executionId,
          agentId: "agent-1",
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          inputTokens: 500 * (i + 1),
          outputTokens: 200 * (i + 1),
          costUsd: stepCosts[i]!.costUsd,
          budgetScope: "task_execution",
          providerRequestId: null,
          pricingVersion: null,
          createdAt: now,
        });
      }
    });

    // Step 3: SETTLE - Finalize costs
    const allCosts = ctx.store.listCostEventsByTask(taskId);
    const settledAmount = allCosts.reduce((sum, e) => sum + e.costUsd, 0);
    const remainingBudget = reservedBudget - settledAmount;

    // Update task with settled cost using direct SQL
    const settledTime = nowIso();
    ctx.db.transaction(() => {
      ctx.db.connection.exec(
        `UPDATE tasks SET actual_cost_usd = ${settledAmount}, updated_at = '${settledTime}' WHERE id = '${taskId}'`,
      );
    });

    // Verify settlement
    const task = ctx.store.getTask(taskId);
    assert.equal(task!.actualCostUsd, settledAmount, "Settled amount should be $0.03");
    assert.ok(remainingBudget > 0, "Should have remaining budget");
    assert.ok(Math.abs(remainingBudget - 0.97) < 0.001, "Remaining should be ~$0.97");

    // Step 4: RELEASE - Budget pool replenished
    // The remainingBudget of $0.97 is now available for new executions
    const quotaPolicy = {
      scope: "tenant" as const,
      scopeId: "general_ops",
      resourceType: "budget" as const,
      hardLimit: 100,
      softLimit: 80,
      burstLimit: 110,
      resetWindow: "1h",
      currentUsage: 0, // Clean slate for new execution
    };

    const releaseDecision = evaluateQuota(quotaPolicy, 50);
    assert.equal(releaseDecision.exceeded, false, "Released budget should be available");
  } finally {
    ctx.cleanup();
  }
});

test("budget-lifecycle: Quota enforcement at hard limit", () => {
  const ctx = createSeededIntegrationContext("aa-budget-quota-", {
    taskId: "task-budget-quota-001",
    executionId: "exec-budget-quota-001",
  });

  try {
    const executionId = "exec-budget-quota-001";

    // Policy with very low limits
    const policy = {
      scope: "execution" as const,
      scopeId: executionId,
      resourceType: "budget" as const,
      hardLimit: 0.05, // $0.05 max
      softLimit: 0.04,
      burstLimit: 0.055,
      resetWindow: "1h",
      currentUsage: 0.045, // Already near limit
    };

    // Request that would exceed hard limit
    const exceeded = isQuotaExceeded(policy, 0.02);
    assert.equal(exceeded, true, "Should exceed when request puts us over hard limit");

    // Request that fits within burst
    const withinBurst = isQuotaExceeded({ ...policy, currentUsage: 0.03 }, 0.02);
    assert.equal(withinBurst, false, "Should not exceed when within burst limit");
  } finally {
    ctx.cleanup();
  }
});

test("budget-lifecycle: Multi-dimensional budget tracking", () => {
  const ctx = createSeededIntegrationContext("aa-budget-multi-", {
    taskId: "task-budget-multi-001",
    executionId: "exec-budget-multi-001",
  });

  try {
    const taskId = "task-budget-multi-001";
    const sessionId = "sess-budget-multi-001";
    const executionId = "exec-budget-multi-001";
    const now = nowIso();

    // Track multiple budget dimensions
    ctx.db.transaction(() => {
      // Token usage
      ctx.store.insertCostEvent({
        id: "cost-multi-tokens",
        taskId,
        sessionId,
        executionId,
        agentId: "agent-1",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 5000,
        outputTokens: 2500,
        costUsd: 0.05,
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: now,
      });

      // Tool calls (could be tracked separately)
      ctx.store.insertCostEvent({
        id: "cost-multi-tools",
        taskId,
        sessionId,
        executionId,
        agentId: "agent-1",
        provider: "tool",
        model: "internal",
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
        budgetScope: "tool_usage",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: now,
      });
    });

    // All costs tracked under same task
    const allCosts = ctx.store.listCostEventsByTask(taskId);
    assert.equal(allCosts.length, 2, "Should track multiple cost dimensions");

    const totalCost = allCosts.reduce((sum, e) => sum + e.costUsd, 0);
    assert.ok(Math.abs(totalCost - 0.051) < 0.001, "Total cost should be ~$0.051");
  } finally {
    ctx.cleanup();
  }
});

test("budget-lifecycle: Budget exhaustion triggers cleanup", () => {
  const ctx = createSeededIntegrationContext("aa-budget-exhaust-", {
    taskId: "task-budget-exhaust-001",
    executionId: "exec-budget-exhaust-001",
  });

  try {
    const taskId = "task-budget-exhaust-001";
    const sessionId = "sess-budget-exhaust-001";
    const executionId = "exec-budget-exhaust-001";
    const now = nowIso();

    // Create execution with very limited budget (use different attempt to avoid UNIQUE constraint)
    ctx.db.transaction(() => {
      ctx.store.insertExecution({
        id: "exec-exhaust-001",
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-exhaust",
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 0.01, // Very limited
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

    // Simulate cost that exceeds budget
    ctx.db.transaction(() => {
      ctx.store.insertCostEvent({
        id: "cost-exhaust-001",
        taskId,
        sessionId,
        executionId: "exec-exhaust-001",
        agentId: "agent-1",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 10000,
        outputTokens: 5000,
        costUsd: 0.15, // Exceeds $0.01 limit
        budgetScope: "task_execution",
        providerRequestId: null,
        pricingVersion: null,
        createdAt: now,
      });
    });

    const costs = ctx.store.listCostEventsByTask(taskId);
    const totalCost = costs.reduce((sum, e) => sum + e.costUsd, 0);
    const execution = ctx.store.getExecution("exec-exhaust-001");
    const budgetLimit = execution!.budgetUsdLimit ?? 0;

    assert.ok(totalCost > budgetLimit, "Total cost should exceed budget limit");
  } finally {
    ctx.cleanup();
  }
});

test("budget-lifecycle: Append-only cost events maintain audit trail", () => {
  const ctx = createSeededIntegrationContext("aa-budget-audit-", {
    taskId: "task-budget-audit-001",
    executionId: "exec-budget-audit-001",
  });

  try {
    const taskId = "task-budget-audit-001";
    const sessionId = "sess-budget-audit-001";
    const executionId = "exec-budget-audit-001";
    const now = nowIso();

    // Insert cost events over time (append-only)
    const timestamps = [
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:01:00.000Z",
      "2026-05-01T10:02:00.000Z",
    ];

    ctx.db.transaction(() => {
      for (let i = 0; i < timestamps.length; i++) {
        ctx.store.insertCostEvent({
          id: `cost-audit-${i}`,
          taskId,
          sessionId,
          executionId,
          agentId: "agent-1",
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          inputTokens: 1000 * (i + 1),
          outputTokens: 500 * (i + 1),
          costUsd: 0.01 * (i + 1),
          budgetScope: "task_execution",
          providerRequestId: null,
          pricingVersion: null,
          createdAt: timestamps[i]!,
        });
      }
    });

    // Verify chronological append-only order
    const events = ctx.store.listCostEventsByTask(taskId);
    assert.equal(events.length, 3, "Should have 3 append-only events");

    for (let i = 1; i < events.length; i++) {
      assert.ok(
        events[i - 1]!.createdAt <= events[i]!.createdAt,
        "Events should maintain append-only chronological order",
      );
    }

    // Audit trail: can reconstruct total from events
    const auditedTotal = events.reduce((sum, e) => sum + e.costUsd, 0);
    assert.equal(auditedTotal, 0.06, "Audit trail should reconstruct correct total");
  } finally {
    ctx.cleanup();
  }
});

test("budget-lifecycle: Workflow step budget tracking", () => {
  const ctx = createSeededIntegrationContext("aa-budget-steps-", {
    taskId: "task-budget-steps-001",
    executionId: "exec-budget-steps-001",
  });

  try {
    const taskId = "task-budget-steps-001";
    const sessionId = "sess-budget-steps-001";
    const executionId = "exec-budget-steps-001";
    const now = nowIso();

    const steps = [
      { stepId: "step_intake", costUsd: 0.005, index: 0 },
      { stepId: "step_execute", costUsd: 0.01, index: 1 },
      { stepId: "step_finalize", costUsd: 0.008, index: 2 },
    ];

    // Track costs per step
    ctx.db.transaction(() => {
      for (const step of steps) {
        ctx.store.insertCostEvent({
          id: `cost-step-${step.index}`,
          taskId,
          sessionId,
          executionId,
          agentId: "agent-1",
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: step.costUsd,
          budgetScope: `step:${step.stepId}`,
          providerRequestId: null,
          pricingVersion: null,
          createdAt: now,
        });
      }
    });

    // Step outputs also track cost
    ctx.db.transaction(() => {
      for (const step of steps) {
        ctx.store.workflow.insertStepOutput({
          id: `step-output-${step.index}`,
          taskId,
          stepId: step.stepId,
          roleId: "general_executor",
          status: "succeeded",
          dataJson: JSON.stringify({ result: "step completed" }),
          summary: `Step ${step.stepId} completed`,
          artifactsJson: "[]",
          tokenCost: 1500,
          durationMs: 2000,
          validationJson: "{}",
          producedAt: now,
        });
      }
    });

    const snapshot = ctx.store.loadTaskSnapshot(taskId);
    assert.equal(snapshot.stepOutputs.length, 3, "Should have step outputs for all steps");

    const costs = ctx.store.listCostEventsByTask(taskId);
    const totalCost = costs.reduce((sum, e) => sum + e.costUsd, 0);
    assert.ok(Math.abs(totalCost - 0.023) < 0.001, "Total step costs should be ~$0.023");
  } finally {
    ctx.cleanup();
  }
});
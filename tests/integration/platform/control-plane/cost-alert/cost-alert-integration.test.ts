/**
 * Integration Test: Cost Alert Service
 *
 * Tests the CostAlertService for real-time cost alerting:
 * - Cost evaluation against budget policies
 * - Cost recording and accumulator management
 * - Threshold exceeded event emission
 * - Platform, tenant, and step-level budget enforcement
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { CostAlertService } from "../../../../../src/platform/control-plane/cost-alert/cost-alert-service.js";
import type { BudgetPolicy, CostThresholdExceededEvent } from "../../../../../src/platform/control-plane/cost-alert/cost-alert-types.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("cost-alert: evaluate cost within budget", () => {
  const workspace = createTempWorkspace("cost-eval-");

  try {
    const dbPath = join(workspace, "cost-eval.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const platformPolicy: BudgetPolicy = {
      scope: "platform",
      scopeId: "platform",
      period: "monthly",
      limitCostUsd: 1000,
      limitTokens: 100000,
      warningThreshold: 0.8,
      actionsOnWarning: ["sev2_alert"],
      actionsOnBreach: ["sev1_alert", "workflow_pause"],
    };

    const costService = new CostAlertService(db, store, {
      enabled: true,
      platformBudgetPolicy: platformPolicy,
    });

    // Evaluate cost well within budget
    const result = costService.evaluateCost({
      scope: "platform",
      scopeId: "platform",
      projectedCostUsd: 100,
      tenantId: null,
      taskId: null,
    });

    assert.strictEqual(result.allowed, true, "Cost should be allowed");
    assert.strictEqual(result.alertLevel, "ok", "Alert level should be ok");
    assert.strictEqual(result.reasonCode, "cost.ok");
    assert.ok(result.remainingBudgetUsd !== null, "Should have remaining budget");
    assert.strictEqual(result.remainingBudgetUsd, 900, "Remaining budget should be 900");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost-alert: evaluate cost approaching warning threshold", () => {
  const workspace = createTempWorkspace("cost-warning-");

  try {
    const dbPath = join(workspace, "cost-warning.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const tenantPolicy: BudgetPolicy = {
      scope: "tenant",
      scopeId: "tenant-warning-1",
      period: "monthly",
      limitCostUsd: 100,
      warningThreshold: 0.8,
      actionsOnWarning: ["sev2_alert"],
      actionsOnBreach: ["sev1_alert", "workflow_pause"],
    };

    const costService = new CostAlertService(db, store, {
      enabled: true,
      tenantBudgetPolicies: { "tenant-warning-1": tenantPolicy },
    });

    // Project cost at 85% of limit (above warning threshold)
    const result = costService.evaluateCost({
      scope: "tenant",
      scopeId: "tenant-warning-1",
      projectedCostUsd: 85,
      tenantId: "tenant-warning-1",
    });

    assert.strictEqual(result.allowed, true, "Cost should still be allowed");
    assert.strictEqual(result.alertLevel, "warning", "Alert level should be warning");
    assert.strictEqual(result.reasonCode, "cost.approaching_limit");
    assert.ok(result.thresholdRatio >= 0.8, "Threshold ratio should be >= 0.8");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost-alert: evaluate cost exceeding budget", () => {
  const workspace = createTempWorkspace("cost-exceed-");

  try {
    const dbPath = join(workspace, "cost-exceed.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const platformPolicy: BudgetPolicy = {
      scope: "platform",
      scopeId: "platform",
      period: "monthly",
      limitCostUsd: 100,
      warningThreshold: 0.8,
      actionsOnWarning: ["sev2_alert"],
      actionsOnBreach: ["sev1_alert", "workflow_pause"],
    };

    const costService = new CostAlertService(db, store, {
      enabled: true,
      platformBudgetPolicy: platformPolicy,
    });

    // Project cost exceeding limit
    const result = costService.evaluateCost({
      scope: "platform",
      scopeId: "platform",
      projectedCostUsd: 150,
    });

    assert.strictEqual(result.allowed, false, "Cost should be denied");
    assert.strictEqual(result.alertLevel, "exceeded", "Alert level should be exceeded");
    assert.ok(result.reasonCode.includes("exceeded"), "Reason code should indicate exceeded");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost-alert: record cost and update accumulator", () => {
  const workspace = createTempWorkspace("cost-record-");

  try {
    const dbPath = join(workspace, "cost-record.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const tenantPolicy: BudgetPolicy = {
      scope: "tenant",
      scopeId: "tenant-record-1",
      period: "monthly",
      limitCostUsd: 500,
      warningThreshold: 0.8,
      actionsOnWarning: ["sev2_alert"],
      actionsOnBreach: ["sev1_alert"],
    };

    const costService = new CostAlertService(db, store, {
      enabled: true,
      tenantBudgetPolicies: { "tenant-record-1": tenantPolicy },
    });

    // Record first cost
    costService.recordCost({
      scope: "tenant",
      scopeId: "tenant-record-1",
      actualCostUsd: 50,
      tokens: 5000,
      tenantId: "tenant-record-1",
      taskId: "task-1",
      stepId: "step-1",
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      promptTokens: 3000,
      completionTokens: 2000,
    });

    const accumulator = costService.getAccumulator("tenant", "tenant-record-1");
    assert.ok(accumulator, "Accumulator should exist");
    assert.strictEqual(accumulator!.accumulatedCostUsd, 50, "Accumulated cost should be 50");
    assert.strictEqual(accumulator!.accumulatedTokens, 5000, "Accumulated tokens should be 5000");

    // Record second cost
    costService.recordCost({
      scope: "tenant",
      scopeId: "tenant-record-1",
      actualCostUsd: 30,
      tokens: 3000,
      tenantId: "tenant-record-1",
      taskId: "task-1",
      stepId: "step-2",
    });

    const accumulator2 = costService.getAccumulator("tenant", "tenant-record-1");
    assert.strictEqual(accumulator2!.accumulatedCostUsd, 80, "Accumulated cost should be 80");
    assert.strictEqual(accumulator2!.accumulatedTokens, 8000, "Accumulated tokens should be 8000");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost-alert: threshold exceeded event emission", () => {
  const workspace = createTempWorkspace("cost-event-");

  try {
    const dbPath = join(workspace, "cost-event.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const tenantPolicy: BudgetPolicy = {
      scope: "tenant",
      scopeId: "tenant-event-1",
      period: "monthly",
      limitCostUsd: 100,
      warningThreshold: 0.8,
      actionsOnWarning: ["sev2_alert"],
      actionsOnBreach: ["sev1_alert", "workflow_pause"],
    };

    const costService = new CostAlertService(db, store, {
      enabled: true,
      tenantBudgetPolicies: { "tenant-event-1": tenantPolicy },
    });

    let eventFired: CostThresholdExceededEvent | null = null;
    costService.on("cost.threshold.exceeded", (event: CostThresholdExceededEvent) => {
      eventFired = event;
    });

    // Record cost that exceeds the budget (crossing from ok to exceeded)
    costService.recordCost({
      scope: "tenant",
      scopeId: "tenant-event-1",
      actualCostUsd: 120, // Exceeds limit of 100
      tenantId: "tenant-event-1",
    });

    assert.ok(eventFired !== null, "Event should have been fired");
    assert.strictEqual(eventFired!.alertLevel, "exceeded");
    assert.strictEqual(eventFired!.scope, "tenant");
    assert.strictEqual(eventFired!.scopeId, "tenant-event-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost-alert: disabled cost alert allows all", () => {
  const workspace = createTempWorkspace("cost-disabled-");

  try {
    const dbPath = join(workspace, "cost-disabled.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const platformPolicy: BudgetPolicy = {
      scope: "platform",
      scopeId: "platform",
      period: "monthly",
      limitCostUsd: 10,
      warningThreshold: 0.8,
      actionsOnWarning: ["sev2_alert"],
      actionsOnBreach: ["sev1_alert"],
    };

    const costService = new CostAlertService(db, store, {
      enabled: false, // Disabled
      platformBudgetPolicy: platformPolicy,
    });

    const result = costService.evaluateCost({
      scope: "platform",
      scopeId: "platform",
      projectedCostUsd: 1000, // Way over budget
    });

    assert.strictEqual(result.allowed, true, "Disabled cost alert should allow all");
    assert.strictEqual(result.alertLevel, "ok");
    assert.strictEqual(result.reasonCode, "cost.ok");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost-alert: reset accumulator", () => {
  const workspace = createTempWorkspace("cost-reset-");

  try {
    const dbPath = join(workspace, "cost-reset.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const platformPolicy: BudgetPolicy = {
      scope: "platform",
      scopeId: "platform",
      period: "per_run",
      limitCostUsd: 1000,
      warningThreshold: 0.8,
      actionsOnWarning: ["sev2_alert"],
      actionsOnBreach: ["sev1_alert"],
    };

    const costService = new CostAlertService(db, store, {
      enabled: true,
      platformBudgetPolicy: platformPolicy,
    });

    // Record some cost
    costService.recordCost({
      scope: "platform",
      scopeId: "platform",
      actualCostUsd: 250,
      tenantId: "tenant-reset",
    });

    const accumulatorBefore = costService.getAccumulator("platform", "platform");
    assert.strictEqual(accumulatorBefore!.accumulatedCostUsd, 250);

    // Reset accumulator
    costService.resetAccumulator("platform", "platform");

    const accumulatorAfter = costService.getAccumulator("platform", "platform");
    assert.strictEqual(accumulatorAfter!.accumulatedCostUsd, 0, "Accumulator should be reset");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cost-alert: critical threshold detection", () => {
  const workspace = createTempWorkspace("cost-critical-");

  try {
    const dbPath = join(workspace, "cost-critical.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const tenantPolicy: BudgetPolicy = {
      scope: "tenant",
      scopeId: "tenant-critical-1",
      period: "monthly",
      limitCostUsd: 100,
      warningThreshold: 0.8,
      actionsOnWarning: ["sev2_alert"],
      actionsOnBreach: ["sev1_alert"],
    };

    const costService = new CostAlertService(db, store, {
      enabled: true,
      tenantBudgetPolicies: { "tenant-critical-1": tenantPolicy },
    });

    let eventFired: CostThresholdExceededEvent | null = null;
    costService.on("cost.threshold.exceeded", (event: CostThresholdExceededEvent) => {
      eventFired = event;
    });

    // Record cost that crosses into critical (>= 95% of limit)
    costService.recordCost({
      scope: "tenant",
      scopeId: "tenant-critical-1",
      actualCostUsd: 96, // 96% of 100
      tenantId: "tenant-critical-1",
    });

    assert.ok(eventFired !== null, "Event should have been fired");
    assert.strictEqual(eventFired!.alertLevel, "critical");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

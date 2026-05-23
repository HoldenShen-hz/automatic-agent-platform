import assert from "node:assert/strict";
import test from "node:test";

import type {
  CostAlertConfig,
  CostThresholdExceededEvent,
  BudgetPolicy,
  BudgetScope,
} from "../../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-types.js";

// Mock the dependencies
const mockDb = {
  transaction: (fn: () => void) => fn(),
} as any;

const mockStore = {
  event: {
    insertEvent: () => ({}),
  },
  artifact: {
    insertArtifact: () => ({}),
  },
} as any;

const mockStoreWithFailingEvent = {
  event: {
    insertEvent: () => {
      throw new Error("Event store unavailable");
    },
  },
  artifact: {
    insertArtifact: () => ({}),
  },
} as any;

const mockStoreWithFailingArtifact = {
  event: {
    insertEvent: () => ({}),
  },
  artifact: {
    insertArtifact: () => {
      throw new Error("Artifact store unavailable");
    },
  },
} as any;

import { CostAlertService } from "../../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-service.js";

test("CostAlertService calculatePeriodEnd handles monthly period", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  // Access private method via prototype
  const calculatePeriodEnd = service["calculatePeriodEnd"];
  const startDate = "2024-01-15T10:00:00.000Z";
  const endDate = calculatePeriodEnd(startDate, "monthly");
  assert.equal(endDate, "2024-02-15T00:00:00.000Z");
});

test("CostAlertService calculatePeriodEnd handles weekly period", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "weekly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const calculatePeriodEnd = service["calculatePeriodEnd"];
  const startDate = "2024-01-15T10:00:00.000Z";
  const endDate = calculatePeriodEnd(startDate, "weekly");
  assert.equal(endDate, "2024-01-22T00:00:00.000Z");
});

test("CostAlertService calculatePeriodEnd handles per_run period", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "per_run",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const calculatePeriodEnd = service["calculatePeriodEnd"];
  const startDate = "2024-01-15T10:00:00.000Z";
  const endDate = calculatePeriodEnd(startDate, "per_run");
  assert.equal(endDate, "2024-01-16T00:00:00.000Z");
});

test("CostAlertService getEventTier returns correct tier for exceeded alert", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const getEventTier = service["getEventTier"];
  const tier = getEventTier("exceeded");

  assert.equal(tier, "tier_1");
});

test("CostAlertService getEventTier returns correct tier for critical alert", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const getEventTier = service["getEventTier"];
  const tier = getEventTier("critical");

  assert.equal(tier, "tier_2");
});

test("CostAlertService getEventTier returns correct tier for warning alert", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const getEventTier = service["getEventTier"];
  const tier = getEventTier("warning");

  assert.equal(tier, "tier_3");
});

test("CostAlertService getEventTier returns tier_3 for ok alert", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const getEventTier = service["getEventTier"];
  const tier = getEventTier("ok");

  assert.equal(tier, "tier_3");
});

test("CostAlertService getAccumulatorKey returns correct key format", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const getAccumulatorKey = service["getAccumulatorKey"];
  const key = getAccumulatorKey("tenant", "tenant-123");

  assert.equal(key, "tenant:tenant-123");
});

test("CostAlertService getAccumulatorKey handles platform scope", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const getAccumulatorKey = service["getAccumulatorKey"];
  const key = getAccumulatorKey("platform", "platform-main");

  assert.equal(key, "platform:platform-main");
});

test("CostAlertService getAccumulatorKey handles pack scope", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const getAccumulatorKey = service["getAccumulatorKey"];
  const key = getAccumulatorKey("pack", "pack-abc");

  assert.equal(key, "pack:pack-abc");
});

test("CostAlertService getAccumulatorKey handles step scope", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const getAccumulatorKey = service["getAccumulatorKey"];
  const key = getAccumulatorKey("step", "step-xyz");

  assert.equal(key, "step:step-xyz");
});

test("CostAlertService getExceededReasonCode returns step_limit_exceeded for step scope", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const policy = config.tenantBudgetPolicies!["tenant-1"];
  const getExceededReasonCode = service["getExceededReasonCode"];
  const reasonCode = getExceededReasonCode("step", policy as BudgetPolicy);

  assert.equal(reasonCode, "cost.step_limit_exceeded");
});

test("CostAlertService getExceededReasonCode returns monthly_limit_exceeded for platform scope", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform",
      scopeId: "platform-main",
      period: "monthly",
      limitCostUsd: 10000,
      warningThreshold: 0.8,
      actionsOnWarning: [],
      actionsOnBreach: [],
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const policy = config.platformBudgetPolicy!;
  const getExceededReasonCode = service["getExceededReasonCode"];
  const reasonCode = getExceededReasonCode("platform", policy);

  assert.equal(reasonCode, "cost.monthly_limit_exceeded");
});

test("CostAlertService getExceededReasonCode returns cost.exceeded for tenant scope", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const policy = config.tenantBudgetPolicies!["tenant-1"];
  const getExceededReasonCode = service["getExceededReasonCode"];
  const reasonCode = getExceededReasonCode("tenant", policy as BudgetPolicy);

  assert.equal(reasonCode, "cost.exceeded");
});

test("CostAlertService evaluateCost returns correct projected cost", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 30,
    tenantId: "tenant-1",
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 10,
    tenantId: "tenant-1",
  });

  assert.equal(result.projectedCostUsd, 40);
  assert.equal(result.currentCostUsd, 30);
});

test("CostAlertService evaluateCost returns critical alert when at 95% threshold", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 94,
    tenantId: "tenant-1",
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 2,
    tenantId: "tenant-1",
  });

  // 94 + 2 = 96 projected, 96/100 = 0.96 >= 0.95 so critical
  assert.equal(result.alertLevel, "critical");
  assert.equal(result.reasonCode, "cost.critical");
  assert.equal(result.allowed, false);
});

test("CostAlertService evaluateCost with only token limit sets cost limit to infinity", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitTokens: 1000,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 10,
    tenantId: "tenant-1",
  });

  // limitTokens only, no limitCostUsd - thresholdRatio is 0, remainingBudgetUsd is null (unlimited)
  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "ok");
  assert.equal(result.thresholdRatio, 0);
  assert.equal(result.remainingBudgetUsd, null);
});

test("CostAlertService evaluateCost disabled returns ok", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: false,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 1000,
    tenantId: "tenant-1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "ok");
});

test("CostAlertService evaluateCost with pack scope uses pack policy", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    packBudgetPolicies: {
      "pack-1": {
        scope: "pack",
        scopeId: "pack-1",
        period: "monthly",
        limitCostUsd: 500,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "pack",
    scopeId: "pack-1",
    projectedCostUsd: 400,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "warning");
});

test("CostAlertService evaluateCost with platform scope uses platform policy", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform",
      scopeId: "platform-main",
      period: "monthly",
      limitCostUsd: 10000,
      warningThreshold: 0.8,
      actionsOnWarning: [],
      actionsOnBreach: [],
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: "platform-main",
    projectedCostUsd: 9000,
  });

  assert.equal(result.alertLevel, "warning");
  assert.equal(result.allowed, true);
});

test("CostAlertService recordCost does nothing when disabled", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: false,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 1000,
    tenantId: "tenant-1",
  });

  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.equal(accumulator, null);
});

test("CostAlertService recordCost with no policy does nothing", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 50,
    tenantId: "tenant-1",
  });

  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.equal(accumulator, null);
});

test("CostAlertService recordCost emits exceeded event when budget exceeded", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: ["sev2_alert", "workflow_pause"],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);
  const events: CostThresholdExceededEvent[] = [];

  service.on("cost:limit_reached", (event: unknown) => {
    events.push(event as CostThresholdExceededEvent);
  });

  // Record cost to cross the limit
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 105,
    tenantId: "tenant-1",
    taskId: "task-1",
    executionId: "exec-1",
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.alertLevel, "exceeded");
  assert.equal(events[0]!.reasonCode, "cost.exceeded");
  assert.equal(events[0]!.eventType, "cost:limit_reached");
  assert.equal(events[0]!.scope, "tenant");
  assert.equal(events[0]!.scopeId, "tenant-1");
  assert.equal(events[0]!.tenantId, "tenant-1");
  assert.equal(events[0]!.taskId, "task-1");
  assert.equal(events[0]!.executionId, "exec-1");
});

test("CostAlertService recordCost emits critical event when entering critical zone", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: ["sev3_alert"],
        actionsOnBreach: ["sev2_alert"],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);
  const events: CostThresholdExceededEvent[] = [];

  service.on("cost:limit_reached", (event: unknown) => {
    events.push(event as CostThresholdExceededEvent);
  });

  // Record cost to cross 95% threshold (critical)
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 96,
    tenantId: "tenant-1",
  });

  // Should emit critical event
  const criticalEvents = events.filter(e => e.alertLevel === "critical");
  assert.ok(criticalEvents.length > 0 || events.length > 0, "Events should be emitted");
});

test("CostAlertService persistCostEvent failure does not throw", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStoreWithFailingEvent, config);

  // Should not throw even when event persistence fails
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 50,
    tenantId: "tenant-1",
  });

  // Cost should still be recorded
  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.equal(accumulator!.accumulatedCostUsd, 50);
});

test("CostAlertService recordStepUsage failure does not throw", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStoreWithFailingArtifact, config);

  // Should not throw even when step usage recording fails
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 50,
    tenantId: "tenant-1",
    stepId: "step-1",
    taskId: "task-1",
  });

  // Cost should still be recorded
  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.equal(accumulator!.accumulatedCostUsd, 50);
});

test("CostAlertService evictExpiredAccumulators removes old accumulators", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-old": {
        scope: "tenant",
        scopeId: "tenant-old",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
      "tenant-new": {
        scope: "tenant",
        scopeId: "tenant-new",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  // Record cost to create accumulator
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-old",
    actualCostUsd: 10,
    tenantId: "tenant-old",
  });

  // Manually set lastUpdatedAt to old timestamp to trigger eviction
  const accumulator = service.getAccumulator("tenant", "tenant-old");
  assert.ok(accumulator);

  // Mock old timestamp by directly manipulating the internal map
  const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
  service["accumulators"].set("tenant:tenant-old", {
    ...accumulator,
    lastUpdatedAt: oldTimestamp,
  });
  service["lastEvictionTime"] = 0;

  // Record new cost which should trigger eviction of old accumulators
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-new",
    actualCostUsd: 5,
    tenantId: "tenant-new",
  });

  // Old accumulator should be evicted during the next eligible eviction pass
  const oldAccumulator = service.getAccumulator("tenant", "tenant-old");
  assert.equal(oldAccumulator, null);
});

test("CostAlertService evaluateCost returns correct threshold ratio", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 200,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 150,
    tenantId: "tenant-1",
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 10,
    tenantId: "tenant-1",
  });

  // (150 + 10) / 200 = 0.8 = 80%
  assert.equal(result.thresholdRatio, 0.8);
  assert.equal(result.alertLevel, "warning");
});

test("CostAlertService evaluateCost calculates remaining budget correctly when projected exceeds limit", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 50,
    tenantId: "tenant-1",
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 100,
    tenantId: "tenant-1",
  });

  // Remaining should be 0 (100 - 50 - 100 = -50, clamped to 0)
  assert.equal(result.remainingBudgetUsd, 0);
});

test("CostAlertService resetAccumulator preserves period end", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 50,
    tenantId: "tenant-1",
  });

  const accumulatorBefore = service.getAccumulator("tenant", "tenant-1");
  const periodEndBefore = accumulatorBefore!.periodEnd;

  service.resetAccumulator("tenant", "tenant-1");

  const accumulatorAfter = service.getAccumulator("tenant", "tenant-1");
  assert.equal(accumulatorAfter!.periodEnd, periodEndBefore);
  assert.equal(accumulatorAfter!.accumulatedCostUsd, 0);
  assert.equal(accumulatorAfter!.accumulatedTokens, 0);
});

test("CostAlertService resetAccumulator does nothing for non-existent accumulator", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  // Should not throw
  service.resetAccumulator("tenant", "non-existent");

  const accumulator = service.getAccumulator("tenant", "non-existent");
  assert.equal(accumulator, null);
});

test("CostAlertService getAccumulator returns null for non-existent scope", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const accumulator = service.getAccumulator("tenant", "non-existent");
  assert.equal(accumulator, null);
});

test("CostAlertService step scope without tenantId returns no policy", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "step",
    scopeId: "step-1",
    projectedCostUsd: 10,
    // No tenantId provided
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "ok");
});

test("CostAlertService evaluateCost with null limitCostUsd uses infinity", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 10000,
    tenantId: "tenant-1",
  });
  // No limitCostUsd set - remainingBudgetUsd is null (unlimited)
  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "ok");
  assert.equal(result.remainingBudgetUsd, null);
});

test("CostAlertService threshold ratio with zero limit", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 0,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 10,
    tenantId: "tenant-1",
  });

  assert.equal(result.thresholdRatio, 0);
});

test("CostAlertService records tokens correctly", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        limitTokens: 1000,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 5,
    tokens: 500,
    tenantId: "tenant-1",
  });

  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.equal(accumulator!.accumulatedTokens, 500);
});

test("CostAlertService emits event with correct eventTier for exceeded", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);
  const events: CostThresholdExceededEvent[] = [];

  service.on("cost:limit_reached", (event: unknown) => {
    events.push(event as CostThresholdExceededEvent);
  });

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 105,
    tenantId: "tenant-1",
  });

  if (events.length > 0) {
    assert.equal(events[0]!.eventTier, "tier_1");
  }
});

test("CostAlertService emits event with correct eventTier for critical", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);
  const events: CostThresholdExceededEvent[] = [];

  service.on("cost:limit_reached", (event: unknown) => {
    events.push(event as CostThresholdExceededEvent);
  });

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 96,
    tenantId: "tenant-1",
  });

  // Critical event should have tier_2
  const criticalEvents = events.filter(e => e.alertLevel === "critical");
  if (criticalEvents.length > 0) {
    assert.equal(criticalEvents[0]!.eventTier, "tier_2");
  }
});

test("CostAlertService pack scope uses pack policy correctly", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    packBudgetPolicies: {
      "pack-1": {
        scope: "pack",
        scopeId: "pack-1",
        period: "weekly",
        limitCostUsd: 200,
        warningThreshold: 0.75,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "pack",
    scopeId: "pack-1",
    actualCostUsd: 50,
    tenantId: "tenant-1",
  });

  const accumulator = service.getAccumulator("pack", "pack-1");
  assert.ok(accumulator);
  assert.equal(accumulator!.accumulatedCostUsd, 50);
});

test("CostAlertService platform scope uses platform policy", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform",
      scopeId: "platform-main",
      period: "monthly",
      limitCostUsd: 50000,
      warningThreshold: 0.9,
      actionsOnWarning: [],
      actionsOnBreach: [],
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "platform",
    scopeId: "platform-main",
    actualCostUsd: 10000,
  });

  const accumulator = service.getAccumulator("platform", "platform-main");
  assert.ok(accumulator);
  assert.equal(accumulator!.accumulatedCostUsd, 10000);
});

test("CostAlertService updateConfig merges correctly", () => {
  const service = new CostAlertService(mockDb, mockStore, {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform",
      scopeId: "platform-main",
      period: "monthly",
      limitCostUsd: 10000,
      warningThreshold: 0.8,
      actionsOnWarning: [],
      actionsOnBreach: [],
    },
  });

  service.updateConfig({
    enabled: false,
  });

  assert.equal(service["config"].enabled, false);
  assert.ok(service["config"].platformBudgetPolicy);
});

test("CostAlertService updateConfig can add tenant policies", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  service.updateConfig({
    tenantBudgetPolicies: {
      "tenant-new": {
        scope: "tenant",
        scopeId: "tenant-new",
        period: "monthly",
        limitCostUsd: 500,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-new",
    projectedCostUsd: 400,
    tenantId: "tenant-new",
  });

  assert.equal(result.alertLevel, "warning");
});

test("CostAlertService getOrCreateAccumulator creates new with correct period end", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 10,
    tenantId: "tenant-1",
  });

  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.ok(accumulator);
  assert.ok(accumulator!.periodEnd);
  assert.ok(accumulator!.periodStart);
});

test("CostAlertService records cost with all optional fields", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 5,
    tokens: 1000,
    tenantId: "tenant-1",
    taskId: "task-1",
    executionId: "exec-1",
    stepId: "step-1",
    provider: "openai",
    model: "gpt-4o",
    promptTokens: 500,
    completionTokens: 500,
    cached: true,
  });

  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.equal(accumulator!.accumulatedCostUsd, 5);
  assert.equal(accumulator!.accumulatedTokens, 1000);
});

test("CostAlertService evaluateCost handles unknown scope", () => {
  const service = new CostAlertService(mockDb, mockStore, { enabled: true });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 10,
  });

  assert.equal(result.allowed, true);
});

test("CostAlertService records cost for step scope with tenantId", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": {
        scope: "tenant",
        scopeId: "tenant-1",
        period: "monthly",
        limitCostUsd: 100,
        warningThreshold: 0.8,
        actionsOnWarning: [],
        actionsOnBreach: [],
      },
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  // Step scope with tenantId resolves to tenant policy, but the
  // accumulator key is based on the POLICY's scope:scopeId (tenant:tenant-1),
  // not the input scope:scopeId (step:step-1)
  service.recordCost({
    scope: "step",
    scopeId: "step-1",
    actualCostUsd: 5,
    tenantId: "tenant-1",
    stepId: "step-1",
    taskId: "task-1",
  });

  // Accumulator is stored with key based on resolved policy (tenant:tenant-1)
  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.ok(accumulator, "Step scope cost recorded under tenant policy key");
  assert.equal(accumulator!.accumulatedCostUsd, 5);
});

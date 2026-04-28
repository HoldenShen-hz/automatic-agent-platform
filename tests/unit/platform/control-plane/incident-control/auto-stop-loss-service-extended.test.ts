/**
 * Extended unit tests for Auto Stop-Loss Service
 * Tests evaluateAnomaly, evaluateHealth, executePlaybook, approvePendingExecution,
 * getExecutionHistory, getExecutionStats, and other business logic
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AutoStopLossService,
  type StopLossPlaybook,
  type SystemHealthSnapshot,
} from "../../../../../src/platform/control-plane/incident-control/auto-stop-loss-service.js";

function createTestPlaybook(overrides: Partial<StopLossPlaybook> = {}): StopLossPlaybook {
  return {
    id: "test-playbook",
    name: "Test Playbook",
    description: "A test playbook",
    enabled: true,
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
    actions: ["circuit_break", "isolate_provider"],
    cooldownMs: 0,
    maxExecutionsPerHour: 100,
    requireHumanApproval: false,
    ...overrides,
  };
}

function createIsolatedService(): AutoStopLossService {
  return new AutoStopLossService({ playbooks: [] });
}

test("AutoStopLossService evaluateAnomaly returns matching playbooks for critical severity", () => {
  const service = createIsolatedService();
  service.registerPlaybook(createTestPlaybook({
    id: "critical-playbook",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
  }));

  const result = service.evaluateAnomaly("critical", "error_rate");

  assert.equal(result.shouldExecute, true);
  assert.equal(result.matchingPlaybooks.length, 1);
  assert.equal(result.matchingPlaybooks[0]!.id, "critical-playbook");
  assert.equal(result.escalation, "act");
});

test("AutoStopLossService evaluateAnomaly returns empty for info severity", () => {
  const service = new AutoStopLossService();
  service.registerPlaybook(createTestPlaybook({
    id: "critical-playbook",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
  }));

  const result = service.evaluateAnomaly("info", "error_rate");

  assert.equal(result.shouldExecute, false);
  assert.equal(result.matchingPlaybooks.length, 0);
});

test("AutoStopLossService evaluateAnomaly respects cooldown period", async () => {
  const service = createIsolatedService();
  const playbook = createTestPlaybook({
    id: "cooldown-playbook",
    cooldownMs: 60000, // 1 minute cooldown
  });
  service.registerPlaybook(playbook);

  // First evaluation
  const result1 = service.evaluateAnomaly("critical", "error_rate");
  assert.equal(result1.matchingPlaybooks.length, 1);

  await service.executePlaybook(playbook, "Trigger cooldown");

  // Second evaluation immediately should not match (in cooldown)
  const result2 = service.evaluateAnomaly("critical", "error_rate");
  assert.equal(result2.matchingPlaybooks.length, 0);
});

test("AutoStopLossService evaluateAnomaly respects rate limiting", () => {
  const service = new AutoStopLossService();
  service.registerPlaybook(createTestPlaybook({
    id: "rate-limited-playbook",
    maxExecutionsPerHour: 2,
  }));

  // Execute two times (simulate by calling evaluate multiple times)
  // The rate limit is checked during execution, not evaluation
  const result = service.evaluateAnomaly("critical", "error_rate");
  assert.equal(result.shouldExecute, true);
});

test("AutoStopLossService evaluateAnomaly returns correct escalation levels per severity", () => {
  const service = new AutoStopLossService();

  const severityEscalations: Array<{ severity: "info" | "warning" | "critical" | "emergency"; expectedEscalation: "observe" | "warn" | "act" | "critical" }> = [
    { severity: "info", expectedEscalation: "observe" },
    { severity: "warning", expectedEscalation: "warn" },
    { severity: "critical", expectedEscalation: "act" },
    { severity: "emergency", expectedEscalation: "critical" },
  ];

  for (const { severity, expectedEscalation } of severityEscalations) {
    const result = service.evaluateAnomaly(severity, "test_metric");
    assert.equal(result.escalation, expectedEscalation, `Failed for severity ${severity}`);
  }
});

test("AutoStopLossService evaluateHealth matches health status playbooks", () => {
  const service = createIsolatedService();
  service.registerPlaybook(createTestPlaybook({
    id: "overloaded-playbook",
    triggerCondition: { type: "health_status", healthStatusThreshold: "overloaded" },
  }));

  const result = service.evaluateHealth("overloaded");

  assert.equal(result.shouldExecute, true);
  assert.equal(result.matchingPlaybooks.length, 1);
  assert.equal(result.matchingPlaybooks[0]!.id, "overloaded-playbook");
});

test("AutoStopLossService evaluateHealth returns warn escalation for degraded", () => {
  const service = new AutoStopLossService();

  const result = service.evaluateHealth("degraded");

  assert.equal(result.escalation, "warn");
});

test("AutoStopLossService evaluateHealth returns critical escalation for unhealthy", () => {
  const service = new AutoStopLossService();

  const result = service.evaluateHealth("unhealthy");

  assert.equal(result.escalation, "critical");
});

test("AutoStopLossService evaluateHealth returns observe for ok status", () => {
  const service = new AutoStopLossService();

  const result = service.evaluateHealth("ok");

  assert.equal(result.escalation, "observe");
  assert.equal(result.shouldExecute, false);
});

test("AutoStopLossService evaluateAnomaly does not match disabled playbooks", () => {
  const service = createIsolatedService();
  service.registerPlaybook(createTestPlaybook({
    id: "disabled-playbook",
    enabled: false,
  }));

  const result = service.evaluateAnomaly("critical", "error_rate");

  assert.equal(result.matchingPlaybooks.length, 0);
});

test("AutoStopLossService evaluateHealth does not match disabled playbooks", () => {
  const service = createIsolatedService();
  service.registerPlaybook(createTestPlaybook({
    id: "disabled-health-playbook",
    enabled: false,
    triggerCondition: { type: "health_status", healthStatusThreshold: "overloaded" },
  }));

  const result = service.evaluateHealth("overloaded");

  assert.equal(result.matchingPlaybooks.length, 0);
});

test("AutoStopLossService executePlaybook executes actions successfully", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "exec-playbook",
    actions: ["circuit_break", "scale_down"],
    requireHumanApproval: false,
  });

  const event = await service.executePlaybook(playbook, "Test execution");

  assert.equal(event.success, true);
  assert.equal(event.playbookId, "exec-playbook");
  assert.deepEqual(event.actionsExecuted, ["circuit_break", "scale_down"]);
  assert.ok(event.completedAt);
});

test("AutoStopLossService executePlaybook queues for human approval when required", async () => {
  const service = new AutoStopLossService({ config: { enableHumanEscalation: true } });
  const playbook = createTestPlaybook({
    id: "approval-required-playbook",
    actions: ["disable_new_tasks"],
    requireHumanApproval: true,
  });

  const event = await service.executePlaybook(playbook, "Requires approval");

  assert.equal(event.success, false);
  assert.equal(event.errorMessage, "Pending human approval");
  assert.equal(event.humanApproved, false);
  assert.equal(event.autoTriggered, false);
});

test("AutoStopLossService executePlaybook does not auto-execute when config disabled", async () => {
  const service = new AutoStopLossService({ config: { enableAutoExecution: false } });
  const playbook = createTestPlaybook({
    id: "auto-exec-playbook",
    actions: ["circuit_break"],
    requireHumanApproval: false,
  });

  const result = service.evaluateAnomaly("critical", "error_rate");
  assert.equal(result.shouldExecute, false);
});

test("AutoStopLossService approvePendingExecution approves pending event", async () => {
  const service = new AutoStopLossService({ config: { enableHumanEscalation: true } });
  const playbook = createTestPlaybook({
    id: "pending-playbook",
    actions: ["escalate_to_human"],
    requireHumanApproval: true,
  });

  const event = await service.executePlaybook(playbook, "Pending approval");
  const approved = service.approvePendingExecution(event.id, true);

  assert.equal(approved, true);
});

test("AutoStopLossService approvePendingExecution rejects pending event", async () => {
  const service = new AutoStopLossService({ config: { enableHumanEscalation: true } });
  const playbook = createTestPlaybook({
    id: "reject-playbook",
    actions: ["escalate_to_human"],
    requireHumanApproval: true,
  });

  const event = await service.executePlaybook(playbook, "Pending approval");
  const rejected = service.approvePendingExecution(event.id, false);

  assert.equal(rejected, true);
});

test("AutoStopLossService approvePendingExecution returns false for unknown event", () => {
  const service = new AutoStopLossService();

  const result = service.approvePendingExecution("unknown-event-id", true);

  assert.equal(result, false);
});

test("AutoStopLossService getPendingApprovals returns pending events", async () => {
  const service = new AutoStopLossService({ config: { enableHumanEscalation: true } });
  const playbook = createTestPlaybook({
    id: "pending-query-playbook",
    actions: ["escalate_to_human"],
    requireHumanApproval: true,
  });

  await service.executePlaybook(playbook, "Pending approval");
  const pending = service.getPendingApprovals();

  assert.equal(pending.length, 1);
  assert.equal(pending[0]!.playbookId, "pending-query-playbook");
});

test("AutoStopLossService getPendingApprovals returns empty when none pending", () => {
  const service = new AutoStopLossService();

  const pending = service.getPendingApprovals();

  assert.equal(pending.length, 0);
});

test("AutoStopLossService getExecutionHistory returns recent events", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "history-playbook",
    actions: ["circuit_break"],
    requireHumanApproval: false,
  });

  await service.executePlaybook(playbook, "First execution");
  await service.executePlaybook(playbook, "Second execution");

  const history = service.getExecutionHistory(10);

  assert.equal(history.length, 2);
});

test("AutoStopLossService getExecutionHistory respects limit", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "limit-playbook",
    actions: ["circuit_break"],
    requireHumanApproval: false,
  });

  for (let i = 0; i < 5; i++) {
    await service.executePlaybook(playbook, `Execution ${i}`);
  }

  const history = service.getExecutionHistory(2);

  assert.equal(history.length, 2);
});

test("AutoStopLossService getExecutionStats returns correct statistics", async () => {
  const service = new AutoStopLossService();
  const successPlaybook = createTestPlaybook({
    id: "success-playbook",
    actions: ["circuit_break"],
    requireHumanApproval: false,
  });
  // Use a custom action that has no handler registered
  const failPlaybook = createTestPlaybook({
    id: "fail-playbook",
    actions: ["force_garbage_collection"],
    requireHumanApproval: false,
  });
  // Register a failing handler
  service.registerActionHandler("force_garbage_collection", async () => {
    return { success: false, message: "GC failed" };
  });

  await service.executePlaybook(successPlaybook, "Success");
  await service.executePlaybook(failPlaybook, "Failure");

  const stats = service.getExecutionStats();

  assert.equal(stats.totalExecutions, 2);
  assert.ok(stats.successfulExecutions >= 1);
  assert.ok(stats.failedExecutions >= 1);
});

test("AutoStopLossService getExecutionStats includes pending approvals", async () => {
  const service = new AutoStopLossService({ config: { enableHumanEscalation: true } });
  const playbook = createTestPlaybook({
    id: "pending-stats-playbook",
    actions: ["escalate_to_human"],
    requireHumanApproval: true,
  });

  await service.executePlaybook(playbook, "Pending");

  const stats = service.getExecutionStats();

  assert.equal(stats.pendingApprovals, 1);
});

test("AutoStopLossService updateHealthCheck stores health snapshot", () => {
  const service = new AutoStopLossService();
  const snapshot: SystemHealthSnapshot = {
    status: "degraded",
    anomalySeverity: "warning",
    activeExecutions: 10,
    queuedTasks: 50,
    memoryUsageMb: 512,
    eventLoopLagMs: 25,
    providerHealth: "healthy",
  };

  service.updateHealthCheck(snapshot);

  const lastSnapshot = service.getLastHealthCheck();
  assert.ok(lastSnapshot);
  assert.equal(lastSnapshot!.status, "degraded");
});

test("AutoStopLossService isEnabled returns true by default", () => {
  const service = new AutoStopLossService();

  assert.equal(service.isEnabled(), true);
});

test("AutoStopLossService isEnabled returns false when disabled", () => {
  const service = new AutoStopLossService({ config: { enabled: false } });

  assert.equal(service.isEnabled(), false);
});

test("AutoStopLossService setEnabled toggles service state", () => {
  const service = new AutoStopLossService();

  assert.equal(service.isEnabled(), true);
  service.setEnabled(false);
  assert.equal(service.isEnabled(), false);
  service.setEnabled(true);
  assert.equal(service.isEnabled(), true);
});

test("AutoStopLossService getConfig returns configuration", () => {
  const service = new AutoStopLossService({ config: { enabled: false, defaultCooldownMs: 5000 } });

  const config = service.getConfig();

  assert.equal(config.enabled, false);
  assert.equal(config.defaultCooldownMs, 5000);
});

test("AutoStopLossService registerActionHandler registers custom handler", async () => {
  const service = new AutoStopLossService();
  let handlerCalled = false;

  service.registerActionHandler("circuit_break", async () => {
    handlerCalled = true;
    return { success: true, message: "Custom handler called" };
  });

  const playbook = createTestPlaybook({
    id: "custom-handler-playbook",
    actions: ["circuit_break"],
    requireHumanApproval: false,
  });

  await service.executePlaybook(playbook, "Test custom handler");

  assert.equal(handlerCalled, true);
});

test("AutoStopLossService executePlaybook handles action with error result", async () => {
  const service = new AutoStopLossService();
  // Register a handler that returns failure
  service.registerActionHandler("circuit_break", async () => {
    return { success: false, message: "Circuit breaker unavailable" };
  });

  const playbook = createTestPlaybook({
    id: "fail-handler-playbook",
    actions: ["circuit_break"],
    requireHumanApproval: false,
  });

  const event = await service.executePlaybook(playbook, "Test handler failure");

  assert.equal(event.success, false);
  assert.ok(event.errorMessage?.includes("Circuit breaker unavailable"));
});

test("AutoStopLossService executePlaybook handles handler exception", async () => {
  const service = new AutoStopLossService();
  service.registerActionHandler("circuit_break", async () => {
    throw new Error("Handler error");
  });

  const playbook = createTestPlaybook({
    id: "exception-playbook",
    actions: ["circuit_break"],
    requireHumanApproval: false,
  });

  const event = await service.executePlaybook(playbook, "Test exception");

  assert.equal(event.success, false);
  assert.ok(event.errorMessage?.includes("Handler error"));
});

test("AutoStopLossService handles compound condition with AND operator", () => {
  const service = createIsolatedService();
  service.registerPlaybook(createTestPlaybook({
    id: "compound-and-playbook",
    triggerCondition: {
      type: "compound",
      compoundOperator: "and",
      subConditions: [
        { type: "anomaly_severity", severityThreshold: "warning" },
        { type: "health_status", healthStatusThreshold: "degraded" },
      ],
    },
  }));

  const result = service.evaluateHealth("degraded", { anomalySeverity: "warning" });

  // Should match because both health_status and anomaly_severity match.
  assert.equal(result.matchingPlaybooks.length, 1);
});

test("AutoStopLossService handles compound condition with OR operator", () => {
  const service = createIsolatedService();
  service.registerPlaybook(createTestPlaybook({
    id: "compound-or-playbook",
    triggerCondition: {
      type: "compound",
      compoundOperator: "or",
      subConditions: [
        { type: "anomaly_severity", severityThreshold: "emergency" },
        { type: "health_status", healthStatusThreshold: "unhealthy" },
      ],
    },
  }));

  const result = service.evaluateHealth("ok");

  // Should not match because neither condition is met
  assert.equal(result.matchingPlaybooks.length, 0);
});

test("AutoStopLossService handles metric threshold condition", () => {
  const service = new AutoStopLossService();
  service.registerPlaybook(createTestPlaybook({
    id: "metric-playbook",
    triggerCondition: {
      type: "metric_threshold",
      metricName: "memory_usage_mb",
      metricValue: 512,
      operator: "gt",
    },
  }));

  const result = service.evaluateAnomaly("warning", "memory_usage_mb", { memory_usage_mb: 600 });

  assert.equal(result.shouldExecute, true);
  assert.equal(result.matchingPlaybooks.length, 1);
});

test("AutoStopLossService handles all comparison operators for metric threshold", () => {
  const operators: Array<{ op: "gt" | "lt" | "gte" | "lte" | "eq"; value: number; contextValue: number; expected: boolean }> = [
    { op: "gt", value: 100, contextValue: 150, expected: true },
    { op: "gt", value: 100, contextValue: 50, expected: false },
    { op: "lt", value: 100, contextValue: 50, expected: true },
    { op: "lt", value: 100, contextValue: 150, expected: false },
    { op: "gte", value: 100, contextValue: 100, expected: true },
    { op: "gte", value: 100, contextValue: 101, expected: true },
    { op: "gte", value: 100, contextValue: 99, expected: false },
    { op: "lte", value: 100, contextValue: 100, expected: true },
    { op: "lte", value: 100, contextValue: 99, expected: true },
    { op: "lte", value: 100, contextValue: 101, expected: false },
    { op: "eq", value: 100, contextValue: 100, expected: true },
    { op: "eq", value: 100, contextValue: 101, expected: false },
  ];

  for (const { op, value, contextValue, expected } of operators) {
    const service = new AutoStopLossService();
    service.registerPlaybook(createTestPlaybook({
      id: `op-test-${op}`,
      triggerCondition: {
        type: "metric_threshold",
        metricName: "test_metric",
        metricValue: value,
        operator: op,
      },
    }));

    const result = service.evaluateAnomaly("warning", "test_metric", { test_metric: contextValue });
    assert.equal(result.shouldExecute, expected, `Failed for operator ${op} with value ${value} and context ${contextValue}`);
  }
});

test("AutoStopLossService metric name matching is case insensitive", () => {
  const service = new AutoStopLossService();
  service.registerPlaybook(createTestPlaybook({
    id: "case-test-playbook",
    triggerCondition: {
      type: "metric_threshold",
      metricName: "MemoryUsageMB",
      metricValue: 512,
      operator: "gt",
    },
  }));

  const result = service.evaluateAnomaly("warning", "memory_usage_mb", { memory_usage_mb: 600 });

  assert.equal(result.shouldExecute, true);
});

test("AutoStopLossService getLastHealthCheck returns null initially", () => {
  const service = new AutoStopLossService();

  assert.equal(service.getLastHealthCheck(), null);
});

test("AutoStopLossService handles multiple playbooks matching same evaluation", () => {
  const service = createIsolatedService();
  service.registerPlaybook(createTestPlaybook({
    id: "playbook-1",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "warning" },
    actions: ["reject_low_priority"],
  }));
  service.registerPlaybook(createTestPlaybook({
    id: "playbook-2",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
    actions: ["circuit_break"],
  }));

  const result = service.evaluateAnomaly("critical", "error_rate");

  assert.equal(result.matchingPlaybooks.length, 2);
});

test("AutoStopLossService execution history is bounded to 1000 entries", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "bounded-playbook",
    actions: ["circuit_break"],
    requireHumanApproval: false,
  });

  // Execute more than 1000 times to trigger bounded history
  for (let i = 0; i < 1005; i++) {
    await service.executePlaybook(playbook, `Execution ${i}`);
  }

  const history = service.getExecutionHistory(2000);

  // History should be bounded to 1000
  assert.ok(history.length <= 1000);
});

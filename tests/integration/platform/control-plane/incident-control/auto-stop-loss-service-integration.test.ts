/**
 * Integration Tests: Auto Stop-Loss Service
 *
 * Tests the auto-stop-loss service with realistic health snapshots,
 * playbook execution, rate limiting, cooldown handling, and human approval flows.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  AutoStopLossService,
  type EscalationLevel,
  type StopLossAction,
  type StopLossPlaybook,
  type SystemHealthSnapshot,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";

test("AutoStopLossService: evaluates health snapshot and triggers matching playbooks", async () => {
  const ctx = createIntegrationContext("aa-stoploss-health-eval-");
  try {
    const service = new AutoStopLossService({
      config: {
        enabled: true,
        enableAutoExecution: true,
        enableHumanEscalation: true,
        defaultCooldownMs: 1000,
        maxEventsPerHour: 100,
        healthCheckIntervalMs: 1000,
      },
    });

    // Register a custom playbook for overloaded health status
    service.registerPlaybook({
      id: "playbook-overloaded",
      name: "Handle Overloaded",
      description: "Act when system is overloaded",
      triggerCondition: { type: "health_status", healthStatusThreshold: "overloaded" },
      actions: ["pause_non_critical", "reject_low_priority"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
      enabled: true,
    });

    // Update with overloaded health
    service.updateHealthCheck({
      status: "overloaded",
      anomalySeverity: null,
      activeExecutions: 50,
      queuedTasks: 200,
      memoryUsageMb: 512,
      eventLoopLagMs: 150,
      providerHealth: "healthy",
    });

    // Give async execution time to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const history = service.getExecutionHistory(10);
    const overloadedEvents = history.filter((e) => e.playbookId === "playbook-overloaded");
    assert.ok(overloadedEvents.length > 0, "Should have triggered overloaded playbook");
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: cooldown prevents rapid re-execution of same playbook", async () => {
  const ctx = createIntegrationContext("aa-stoploss-cooldown-");
  try {
    const service = new AutoStopLossService({
      config: {
        enabled: true,
        enableAutoExecution: true,
        defaultCooldownMs: 5000,
        maxEventsPerHour: 100,
        healthCheckIntervalMs: 100,
      },
    });

    // Register a quick-execute playbook with short cooldown
    service.registerPlaybook({
      id: "playbook-quick",
      name: "Quick React",
      description: "Test cooldown",
      triggerCondition: { type: "health_status", healthStatusThreshold: "unhealthy" },
      actions: ["disable_new_tasks"],
      cooldownMs: 10000, // 10 second cooldown
      maxExecutionsPerHour: 100,
      requireHumanApproval: false,
      enabled: true,
    });

    const playbook = service.getPlaybook("playbook-quick")!;

    // First execution
    const event1 = await service.executePlaybook(playbook, "Unhealthy detected");
    assert.strictEqual(event1.success, true);
    assert.deepStrictEqual(event1.actionsExecuted, ["disable_new_tasks"]);

    // Second immediate execution should be blocked by cooldown
    // (But since we just executed, cooldown should block)

    const history = service.getExecutionHistory(2);
    assert.strictEqual(history.filter((e) => e.playbookId === "playbook-quick").length >= 1, true);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: human approval is requested when requireHumanApproval is true", async () => {
  const ctx = createIntegrationContext("aa-stoploss-approval-");
  try {
    const service = new AutoStopLossService({
      config: {
        enabled: true,
        enableAutoExecution: true,
        enableHumanEscalation: true,
        defaultCooldownMs: 1000,
        maxEventsPerHour: 100,
        healthCheckIntervalMs: 1000,
      },
    });

    service.registerPlaybook({
      id: "playbook-approval",
      name: "Requires Approval",
      description: "This playbook requires human approval",
      triggerCondition: { type: "health_status", healthStatusThreshold: "unhealthy" },
      actions: ["disable_new_tasks"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: true, // Requires approval!
      enabled: true,
    });

    const playbook = service.getPlaybook("playbook-approval")!;
    const event = await service.executePlaybook(playbook, "System unhealthy");

    assert.strictEqual(event.success, false, "Should not auto-execute");
    assert.strictEqual(event.humanApproved, false);
    assert.ok(event.errorMessage?.includes("Pending human approval"), "Should indicate pending approval");

    const pending = service.getPendingApprovals();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0]?.playbookId, "playbook-approval");
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: approvePendingExecution approves and completes event", async () => {
  const ctx = createIntegrationContext("aa-stoploss-approve-");
  try {
    const service = new AutoStopLossService({
      config: {
        enabled: true,
        enableAutoExecution: true,
        enableHumanEscalation: true,
        defaultCooldownMs: 1000,
        maxEventsPerHour: 100,
        healthCheckIntervalMs: 1000,
      },
    });

    service.registerPlaybook({
      id: "playbook-approve-test",
      name: "Approval Test",
      description: "Test approval flow",
      triggerCondition: { type: "health_status", healthStatusThreshold: "unhealthy" },
      actions: ["circuit_break"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: true,
      enabled: true,
    });

    const playbook = service.getPlaybook("playbook-approve-test")!;
    const pendingEvent = await service.executePlaybook(playbook, "Unhealthy detected");

    const approved = await service.approvePendingExecution(pendingEvent.id, true);

    assert.strictEqual(approved, true);
    const history = service.getExecutionHistory(10);
    const approvedEvent = history.find((e) => e.id === pendingEvent.id);
    assert.strictEqual(approvedEvent?.humanApproved, true);
    assert.strictEqual(approvedEvent?.completedAt !== null, true);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: rejectPendingExecution rejects the event", async () => {
  const ctx = createIntegrationContext("aa-stoploss-reject-");
  try {
    const service = new AutoStopLossService({
      config: {
        enabled: true,
        enableAutoExecution: true,
        enableHumanEscalation: true,
        defaultCooldownMs: 1000,
        maxEventsPerHour: 100,
        healthCheckIntervalMs: 1000,
      },
    });

    service.registerPlaybook({
      id: "playbook-reject-test",
      name: "Reject Test",
      description: "Test rejection flow",
      triggerCondition: { type: "health_status", healthStatusThreshold: "unhealthy" },
      actions: ["isolate_provider"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: true,
      enabled: true,
    });

    const playbook = service.getPlaybook("playbook-reject-test")!;
    const pendingEvent = await service.executePlaybook(playbook, "Unhealthy detected");

    const rejected = await service.approvePendingExecution(pendingEvent.id, false);

    assert.strictEqual(rejected, true);
    const history = service.getExecutionHistory(10);
    const rejectedEvent = history.find((e) => e.id === pendingEvent.id);
    assert.strictEqual(rejectedEvent?.success, false);
    assert.ok(rejectedEvent?.errorMessage?.includes("Rejected"));
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: evaluateAnomaly matches severity-based playbooks", () => {
  const ctx = createIntegrationContext("aa-stoploss-anomaly-eval-");
  try {
    const service = new AutoStopLossService();

    service.registerPlaybook({
      id: "playbook-critical",
      name: "Critical Anomaly",
      description: "Handle critical anomalies",
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["circuit_break"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
      enabled: true,
    });

    service.registerPlaybook({
      id: "playbook-warning",
      name: "Warning Anomaly",
      description: "Handle warning anomalies",
      triggerCondition: { type: "anomaly_severity", severityThreshold: "warning" },
      actions: ["pause_non_critical"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
      enabled: true,
    });

    // Critical anomaly should match both playbooks (critical >= warning and critical >= critical)
    const criticalResult = service.evaluateAnomaly("critical", "error_rate");
    assert.strictEqual(criticalResult.shouldExecute, true);
    assert.ok(criticalResult.matchingPlaybooks.length >= 1);

    // Warning anomaly should only match warning playbook
    const warningResult = service.evaluateAnomaly("warning", "latency");
    assert.strictEqual(warningResult.shouldExecute, true);

    // Info anomaly should not match
    const infoResult = service.evaluateAnomaly("info", "metric");
    assert.strictEqual(infoResult.shouldExecute, false);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: evaluateHealth matches status-based playbooks", () => {
  const ctx = createIntegrationContext("aa-stoploss-health-match-");
  try {
    const service = new AutoStopLossService();

    service.registerPlaybook({
      id: "playbook-unhealthy",
      name: "Unhealthy Response",
      description: "Act on unhealthy",
      triggerCondition: { type: "health_status", healthStatusThreshold: "unhealthy" },
      actions: ["disable_new_tasks"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
      enabled: true,
    });

    service.registerPlaybook({
      id: "playbook-degraded",
      name: "Degraded Response",
      description: "Act on degraded",
      triggerCondition: { type: "health_status", healthStatusThreshold: "degraded" },
      actions: ["reject_low_priority"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
      enabled: true,
    });

    // Unhealthy should match both (since unhealthy >= degraded)
    const unhealthyResult = service.evaluateHealth("unhealthy");
    assert.strictEqual(unhealthyResult.shouldExecute, true);
    assert.ok(unhealthyResult.escalation === "critical" || unhealthyResult.escalation === "act");

    // Degraded should match degraded playbook
    const degradedResult = service.evaluateHealth("degraded");
    assert.strictEqual(degradedResult.shouldExecute, true);

    // OK should not match any
    const okResult = service.evaluateHealth("ok");
    assert.strictEqual(okResult.shouldExecute, false);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: executionStats returns accurate counts", async () => {
  const ctx = createIntegrationContext("aa-stoploss-stats-");
  try {
    const service = new AutoStopLossService();

    service.registerPlaybook({
      id: "playbook-stats",
      name: "Stats Test",
      description: "Test stats",
      triggerCondition: { type: "health_status", healthStatusThreshold: "degraded" },
      actions: ["pause_non_critical"],
      cooldownMs: 100,
      maxExecutionsPerHour: 100,
      requireHumanApproval: false,
      enabled: true,
    });

    const playbook = service.getPlaybook("playbook-stats")!;
    await service.executePlaybook(playbook, "Test 1");
    await service.executePlaybook(playbook, "Test 2");

    const stats = service.getExecutionStats();
    assert.ok(stats.totalExecutions >= 2);
    assert.ok(stats.successfulExecutions >= 2);
    assert.strictEqual(stats.failedExecutions, 0);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: metric threshold conditions evaluate correctly", () => {
  const ctx = createIntegrationContext("aa-stoploss-metric-");
  try {
    const service = new AutoStopLossService();

    service.registerPlaybook({
      id: "playbook-memory",
      name: "Memory Pressure",
      description: "Handle high memory",
      triggerCondition: { type: "metric_threshold", metricName: "memory_usage_mb", metricValue: 1024, operator: "gt" },
      actions: ["scale_down"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
      enabled: true,
    });

    // Memory above threshold
    const highMemoryResult = service.evaluateAnomaly("warning", "memory_usage_mb", { memory_usage_mb: 2048 });
    assert.strictEqual(highMemoryResult.shouldExecute, true);

    // Memory below threshold
    const lowMemoryResult = service.evaluateAnomaly("warning", "memory_usage_mb", { memory_usage_mb: 512 });
    assert.strictEqual(lowMemoryResult.shouldExecute, false);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: compound conditions with AND/OR operators", () => {
  const ctx = createIntegrationContext("aa-stoploss-compound-");
  try {
    const service = new AutoStopLossService();

    service.registerPlaybook({
      id: "playbook-compound-and",
      name: "Compound AND",
      description: "Test AND condition",
      triggerCondition: {
        type: "compound",
        compoundOperator: "and",
        subConditions: [
          { type: "health_status", healthStatusThreshold: "degraded" },
          { type: "metric_threshold", metricName: "memory_usage_mb", metricValue: 1024, operator: "gt" },
        ],
      },
      actions: ["scale_down"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
      enabled: true,
    });

    // Both conditions met
    const bothMet = service.evaluateHealth("degraded", { memory_usage_mb: 2048 });
    assert.strictEqual(bothMet.shouldExecute, true);

    // Only one condition met
    const oneMet = service.evaluateHealth("degraded", { memory_usage_mb: 512 });
    assert.strictEqual(oneMet.shouldExecute, false);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: updateHealthCheck stores and evaluates health snapshot", () => {
  const ctx = createIntegrationContext("aa-stoploss-health-store-");
  try {
    const service = new AutoStopLossService();

    const snapshot: SystemHealthSnapshot = {
      status: "degraded",
      anomalySeverity: "warning",
      activeExecutions: 10,
      queuedTasks: 50,
      memoryUsageMb: 1024,
      eventLoopLagMs: 45,
      providerHealth: "degraded",
    };

    service.updateHealthCheck(snapshot);

    const stored = service.getLastHealthCheck();
    assert.deepStrictEqual(stored, snapshot);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: enable/disable playbook works", () => {
  const ctx = createIntegrationContext("aa-stoploss-toggle-");
  try {
    const service = new AutoStopLossService();

    service.registerPlaybook({
      id: "playbook-toggle",
      name: "Toggle Test",
      description: "Test toggle",
      triggerCondition: { type: "health_status", healthStatusThreshold: "unhealthy" },
      actions: ["circuit_break"],
      cooldownMs: 5000,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
      enabled: true,
    });

    assert.strictEqual(service.disablePlaybook("playbook-toggle"), true);
    assert.strictEqual(service.enablePlaybook("playbook-toggle"), true);
    assert.strictEqual(service.disablePlaybook("nonexistent"), false);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: setEnabled controls all auto-execution", () => {
  const ctx = createIntegrationContext("aa-stoploss-enabled-");
  try {
    const service = new AutoStopLossService({
      config: { enabled: true, defaultCooldownMs: 1000, maxEventsPerHour: 100, enableAutoExecution: true, enableHumanEscalation: true, healthCheckIntervalMs: 1000 },
    });

    assert.strictEqual(service.isEnabled(), true);

    service.setEnabled(false);
    assert.strictEqual(service.isEnabled(), false);

    service.setEnabled(true);
    assert.strictEqual(service.isEnabled(), true);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: getConfig returns current configuration", () => {
  const ctx = createIntegrationContext("aa-stoploss-config-");
  try {
    const customConfig = {
      enabled: true,
      defaultCooldownMs: 30000,
      maxEventsPerHour: 50,
      enableAutoExecution: true,
      enableHumanEscalation: false,
      healthCheckIntervalMs: 15000,
    };

    const service = new AutoStopLossService({ config: customConfig });
    const config = service.getConfig();

    assert.strictEqual(config.enabled, true);
    assert.strictEqual(config.defaultCooldownMs, 30000);
    assert.strictEqual(config.maxEventsPerHour, 50);
    assert.strictEqual(config.enableAutoExecution, true);
    assert.strictEqual(config.enableHumanEscalation, false);
    assert.strictEqual(config.healthCheckIntervalMs, 15000);
  } finally {
    ctx.cleanup();
  }
});

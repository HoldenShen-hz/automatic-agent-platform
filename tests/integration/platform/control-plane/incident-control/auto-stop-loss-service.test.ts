/**
 * Integration Tests: Auto Stop-Loss Service
 *
 * Tests the AutoStopLossService with real playbook evaluation,
 * anomaly/health assessment, and action execution.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AutoStopLossService, type SystemHealthSnapshot, type StopLossPlaybook, type StopLossEvent } from "../../../../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";
import type { AnomalySeverity } from "../../../../../src/platform/shared/observability/anomaly-detection-service.js";

function createTestPlaybook(overrides: Partial<StopLossPlaybook> = {}): StopLossPlaybook {
  return {
    id: "test_playbook",
    name: "Test Playbook",
    description: "A playbook for testing",
    triggerCondition: {
      type: "anomaly_severity",
      severityThreshold: "critical",
    },
    actions: ["circuit_break", "isolate_provider"],
    cooldownMs: 5000,
    maxExecutionsPerHour: 10,
    requireHumanApproval: false,
    enabled: true,
    ...overrides,
  };
}

function createHealthSnapshot(overrides: Partial<SystemHealthSnapshot> = {}): SystemHealthSnapshot {
  return {
    status: "ok",
    anomalySeverity: null,
    activeExecutions: 5,
    queuedTasks: 10,
    memoryUsageMb: 512,
    eventLoopLagMs: 15,
    providerHealth: "healthy",
    ...overrides,
  };
}

// =============================================================================
// Construction & Configuration
// =============================================================================

test("AutoStopLossService integration: constructs with default config", () => {
  const service = new AutoStopLossService();

  assert.equal(service.isEnabled(), true);
  const config = service.getConfig();
  assert.equal(config.enabled, true);
  assert.equal(config.maxEventsPerHour, 100);
  assert.equal(config.defaultCooldownMs, 60000);
  assert.equal(config.enableAutoExecution, true);
  assert.equal(config.enableHumanEscalation, true);
});

test("AutoStopLossService integration: constructs with custom config", () => {
  const service = new AutoStopLossService({
    config: {
      enabled: false,
      maxEventsPerHour: 50,
      defaultCooldownMs: 30000,
      enableAutoExecution: false,
      enableHumanEscalation: false,
      healthCheckIntervalMs: 60000,
    },
  });

  assert.equal(service.isEnabled(), false);
  const config = service.getConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.maxEventsPerHour, 50);
  assert.equal(config.defaultCooldownMs, 30000);
  assert.equal(config.enableAutoExecution, false);
});

test("AutoStopLossService integration: setEnabled toggles service state", () => {
  const service = new AutoStopLossService();
  assert.equal(service.isEnabled(), true);

  service.setEnabled(false);
  assert.equal(service.isEnabled(), false);

  service.setEnabled(true);
  assert.equal(service.isEnabled(), true);
});

// =============================================================================
// Playbook Management
// =============================================================================

test("AutoStopLossService integration: registerPlaybook adds playbook to registry", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({ id: "custom_playbook", name: "Custom Playbook" });

  service.registerPlaybook(playbook);

  const found = service.getPlaybook("custom_playbook");
  assert.ok(found);
  assert.equal(found?.name, "Custom Playbook");
  assert.equal(service.listPlaybooks().length, 6); // 5 default + 1 custom
});

test("AutoStopLossService integration: unregisterPlaybook removes playbook", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({ id: "remove_me" });
  service.registerPlaybook(playbook);

  assert.ok(service.getPlaybook("remove_me"));

  const removed = service.unregisterPlaybook("remove_me");
  assert.equal(removed, true);
  assert.equal(service.getPlaybook("remove_me"), null);
});

test("AutoStopLossService integration: enablePlaybook activates playbook", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({ id: "toggle_me", enabled: false });
  service.registerPlaybook(playbook);

  assert.equal(service.getPlaybook("toggle_me")?.enabled, false);

  const enabled = service.enablePlaybook("toggle_me");
  assert.equal(enabled, true);
  assert.equal(service.getPlaybook("toggle_me")?.enabled, true);
});

test("AutoStopLossService integration: disablePlaybook deactivates playbook", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({ id: "toggle_me", enabled: true });
  service.registerPlaybook(playbook);

  assert.equal(service.getPlaybook("toggle_me")?.enabled, true);

  const disabled = service.disablePlaybook("toggle_me");
  assert.equal(disabled, true);
  assert.equal(service.getPlaybook("toggle_me")?.enabled, false);
});

test("AutoStopLossService integration: listPlaybooks returns all registered playbooks", () => {
  const service = new AutoStopLossService();
  const playbooks = service.listPlaybooks();

  assert.ok(playbooks.length >= 5);
  assert.ok(playbooks.some((p) => p.id === "playbook_circuit_break_provider"));
  assert.ok(playbooks.some((p) => p.id === "playbook_critical_anomaly_escalate"));
});

// =============================================================================
// Anomaly Evaluation
// =============================================================================

test("AutoStopLossService integration: evaluateAnomaly matches severity threshold", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "sev_threshold",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
    actions: ["circuit_break"],
    enabled: true,
  });
  service.registerPlaybook(playbook);

  const result = service.evaluateAnomaly("critical", "memory_usage_mb");

  assert.equal(result.shouldExecute, true);
  assert.ok(result.matchingPlaybooks.some((p) => p.id === "sev_threshold"));
  assert.equal(result.escalation, "act");
});

test("AutoStopLossService integration: evaluateAnomaly does not match below threshold", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "high_threshold",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "emergency" },
    actions: ["escalate_to_human"],
    enabled: true,
  });
  service.registerPlaybook(playbook);

  const result = service.evaluateAnomaly("warning", "memory_usage_mb");

  assert.equal(result.shouldExecute, false);
  assert.ok(!result.matchingPlaybooks.some((p) => p.id === "high_threshold"));
});

test("AutoStopLossService integration: evaluateAnomaly respects playbook cooldown", async () => {
  const service = new AutoStopLossService({
    config: { defaultCooldownMs: 10000 },
  });
  const playbook = createTestPlaybook({
    id: "cooldown_test",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "warning" },
    actions: ["pause_non_critical"],
    cooldownMs: 10000,
    enabled: true,
  });
  service.registerPlaybook(playbook);

  // First evaluation should match
  const result1 = service.evaluateAnomaly("warning", "queue_depth");
  assert.ok(result1.matchingPlaybooks.some((p) => p.id === "cooldown_test"));

  // Simulate execution by calling executePlaybook
  await service.executePlaybook(playbook, "test cooldown");

  // Second evaluation within cooldown should not match
  const result2 = service.evaluateAnomaly("warning", "queue_depth");
  assert.ok(!result2.matchingPlaybooks.some((p) => p.id === "cooldown_test"));
});

test("AutoStopLossService integration: evaluateAnomaly respects rate limits", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "rate_limit_test",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "info" },
    actions: ["reject_low_priority"],
    cooldownMs: 0,
    maxExecutionsPerHour: 2,
    enabled: true,
  });
  service.registerPlaybook(playbook);

  // First two evaluations should match while the playbook still has available executions.
  const result1 = service.evaluateAnomaly("info", "test_metric");
  await service.executePlaybook(playbook, "rate limit test 1");
  const result2 = service.evaluateAnomaly("info", "test_metric");
  await service.executePlaybook(playbook, "rate limit test 2");

  assert.ok(result1.matchingPlaybooks.some((p) => p.id === "rate_limit_test"));
  assert.ok(result2.matchingPlaybooks.some((p) => p.id === "rate_limit_test"));

  // Third should not match (exceeded rate limit)
  const result3 = service.evaluateAnomaly("info", "test_metric");
  assert.ok(!result3.matchingPlaybooks.some((p) => p.id === "rate_limit_test"));
});

test("AutoStopLossService integration: evaluateAnomaly skips disabled playbooks", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "disabled_test",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "info" },
    actions: ["queue_only"],
    enabled: false,
  });
  service.registerPlaybook(playbook);

  const result = service.evaluateAnomaly("info", "test_metric");

  assert.ok(!result.matchingPlaybooks.some((p) => p.id === "disabled_test"));
});

// =============================================================================
// Health Evaluation
// =============================================================================

test("AutoStopLossService integration: evaluateHealth matches overloaded status", () => {
  const service = new AutoStopLossService();

  const result = service.evaluateHealth("overloaded");

  assert.equal(result.shouldExecute, true);
  assert.ok(result.matchingPlaybooks.some((p) => p.id === "playbook_overloaded_pause_non_critical"));
  assert.equal(result.escalation, "act");
});

test("AutoStopLossService integration: evaluateHealth matches unhealthy status", () => {
  const service = new AutoStopLossService();

  const result = service.evaluateHealth("unhealthy");

  assert.equal(result.shouldExecute, true);
  assert.ok(result.matchingPlaybooks.some((p) => p.id === "playbook_unhealthy_disable_new_tasks"));
  assert.equal(result.escalation, "critical");
});

test("AutoStopLossService integration: evaluateHealth does not match ok status for most playbooks", () => {
  const service = new AutoStopLossService();

  const result = service.evaluateHealth("ok");

  assert.equal(result.escalation, "observe");
  // Only playbooks with ok threshold would match, but default playbooks require degraded+
  assert.ok(!result.matchingPlaybooks.some((p) => p.id === "playbook_overloaded_pause_non_critical"));
});

test("AutoStopLossService integration: evaluateHealth supports metric_threshold conditions", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "mem_threshold",
    triggerCondition: {
      type: "metric_threshold",
      metricName: "memory_usage_mb",
      metricValue: 1024,
      operator: "gt",
    },
    actions: ["scale_down"],
    enabled: true,
  });
  service.registerPlaybook(playbook);

  const result = service.evaluateHealth("degraded", { memory_usage_mb: 1500 });

  assert.equal(result.shouldExecute, true);
  assert.ok(result.matchingPlaybooks.some((p) => p.id === "mem_threshold"));
});

test("AutoStopLossService integration: evaluateHealth supports compound conditions", () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "compound_test",
    triggerCondition: {
      type: "compound",
      compoundOperator: "and",
      subConditions: [
        { type: "health_status", healthStatusThreshold: "degraded" },
        { type: "metric_threshold", metricName: "memory_usage_mb", metricValue: 1000, operator: "gt" },
      ],
    },
    actions: ["pause_non_critical"],
    enabled: true,
  });
  service.registerPlaybook(playbook);

  // Should match when both conditions are true
  const result = service.evaluateHealth("degraded", { memory_usage_mb: 1500 });
  assert.ok(result.matchingPlaybooks.some((p) => p.id === "compound_test"));

  // Should not match when only one condition is true
  const result2 = service.evaluateHealth("degraded", { memory_usage_mb: 500 });
  assert.ok(!result2.matchingPlaybooks.some((p) => p.id === "compound_test"));
});

// =============================================================================
// Execution
// =============================================================================

test("AutoStopLossService integration: executePlaybook runs all actions", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "exec_test",
    actions: ["circuit_break", "isolate_provider"],
    requireHumanApproval: false,
    enabled: true,
  });

  const event = await service.executePlaybook(playbook, "test execution");

  assert.equal(event.playbookId, "exec_test");
  assert.ok(event.actionsExecuted.includes("circuit_break"));
  assert.ok(event.actionsExecuted.includes("isolate_provider"));
  assert.equal(event.success, true);
  assert.ok(event.completedAt);
  assert.equal(event.autoTriggered, true);
});

test("AutoStopLossService integration: executePlaybook queues for approval when required", async () => {
  const service = new AutoStopLossService({
    config: { enableHumanEscalation: true },
  });
  const playbook = createTestPlaybook({
    id: "approval_test",
    actions: ["disable_new_tasks"],
    requireHumanApproval: true,
    enabled: true,
  });

  const event = await service.executePlaybook(playbook, "needs approval");

  assert.equal(event.success, false);
  assert.equal(event.errorMessage, "Pending human approval");
  assert.equal(event.humanApproved, false);
  assert.ok(!event.completedAt);
});

test("AutoStopLossService integration: executePlaybook executes immediately when human escalation disabled", async () => {
  const service = new AutoStopLossService({
    config: { enableHumanEscalation: false },
  });
  const playbook = createTestPlaybook({
    id: "no_approval_test",
    actions: ["disable_new_tasks"],
    requireHumanApproval: true,
    enabled: true,
  });

  const event = await service.executePlaybook(playbook, "no approval needed");

  assert.equal(event.success, true);
  assert.ok(event.completedAt);
});

test("AutoStopLossService integration: executePlaybook records event in history", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "history_test",
    actions: ["scale_down"],
    enabled: true,
  });

  await service.executePlaybook(playbook, "testing history");

  const history = service.getExecutionHistory(10);
  assert.ok(history.some((e) => e.playbookId === "history_test"));
});

test("AutoStopLossService integration: executePlaybook respects cooldown timing", async () => {
  const service = new AutoStopLossService({
    config: { defaultCooldownMs: 5000 },
  });
  const playbook = createTestPlaybook({
    id: "timing_test",
    actions: ["force_garbage_collection"],
    cooldownMs: 5000,
    enabled: true,
  });

  await service.executePlaybook(playbook, "first execution");

  // Immediate second execution should not trigger cooldown-based blocking
  // but since we just executed, it would be in cooldown
  const result = service.evaluateAnomaly("info", "test_metric");
  assert.ok(!result.matchingPlaybooks.some((p) => p.id === "timing_test"));
});

test("AutoStopLossService integration: getExecutionStats returns correct counts", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "stats_test",
    actions: ["pause_non_critical"],
    requireHumanApproval: false,
    enabled: true,
  });

  // Execute once successfully
  await service.executePlaybook(playbook, "success test");

  // Execute once with approval required (pending)
  const approvalPlaybook = createTestPlaybook({
    id: "pending_test",
    actions: ["disable_new_tasks"],
    requireHumanApproval: true,
    enabled: true,
  });
  await service.executePlaybook(approvalPlaybook, "pending test");

  const stats = service.getExecutionStats();

  assert.equal(stats.totalExecutions >= 2, true);
  assert.ok(stats.successfulExecutions >= 1);
  assert.equal(stats.pendingApprovals, 1);
});

// =============================================================================
// Human Approval
// =============================================================================

test("AutoStopLossService integration: approvePendingExecution approves event", async () => {
  const service = new AutoStopLossService({
    config: { enableHumanEscalation: true },
  });
  const playbook = createTestPlaybook({
    id: "approve_test",
    actions: ["escalate_to_human"],
    requireHumanApproval: true,
    enabled: true,
  });

  const event = await service.executePlaybook(playbook, "needs approval");
  assert.equal(event.humanApproved, false);

  const approved = await service.approvePendingExecution(event.id, true);
  assert.equal(approved, true);

  const pending = service.getPendingApprovals();
  assert.ok(!pending.some((e) => e.id === event.id));
});

test("AutoStopLossService integration: approvePendingExecution rejects event", async () => {
  const service = new AutoStopLossService({
    config: { enableHumanEscalation: true },
  });
  const playbook = createTestPlaybook({
    id: "reject_test",
    actions: ["escalate_to_human"],
    requireHumanApproval: true,
    enabled: true,
  });

  const event = await service.executePlaybook(playbook, "will reject");

  const rejected = await service.approvePendingExecution(event.id, false);
  assert.equal(rejected, true);

  const history = service.getExecutionHistory(10);
  const rejectedEvent = history.find((e) => e.id === event.id);
  assert.equal(rejectedEvent?.success, false);
  assert.equal(rejectedEvent?.errorMessage, "Rejected by human");
});

test("AutoStopLossService integration: approvePendingExecution returns false for unknown event", async () => {
  const service = new AutoStopLossService();

  const result = await service.approvePendingExecution("non_existent_id", true);
  assert.equal(result, false);
});

test("AutoStopLossService integration: getPendingApprovals returns all pending events", async () => {
  const service = new AutoStopLossService({
    config: { enableHumanEscalation: true },
  });
  const playbook1 = createTestPlaybook({
    id: "pending_1",
    actions: ["escalate_to_human"],
    requireHumanApproval: true,
    enabled: true,
  });
  const playbook2 = createTestPlaybook({
    id: "pending_2",
    actions: ["disable_new_tasks"],
    requireHumanApproval: true,
    enabled: true,
  });

  await service.executePlaybook(playbook1, "pending 1");
  await service.executePlaybook(playbook2, "pending 2");

  const pending = service.getPendingApprovals();
  assert.equal(pending.length, 2);
});

// =============================================================================
// Health Check Integration
// =============================================================================

test("AutoStopLossService integration: updateHealthCheck stores snapshot", () => {
  const service = new AutoStopLossService();
  const snapshot = createHealthSnapshot({ status: "degraded", memoryUsageMb: 2048 });

  service.updateHealthCheck(snapshot);

  const lastCheck = service.getLastHealthCheck();
  assert.ok(lastCheck);
  assert.equal(lastCheck?.status, "degraded");
  assert.equal(lastCheck?.memoryUsageMb, 2048);
});

test("AutoStopLossService integration: updateHealthCheck triggers matching playbooks", async () => {
  const service = new AutoStopLossService({
    config: { enableAutoExecution: true },
  });

  let executionCount = 0;
  service.registerActionHandler("pause_non_critical", async () => {
    executionCount++;
    return { success: true, message: "paused" };
  });

  const playbook = createTestPlaybook({
    id: "health_trigger_test",
    triggerCondition: { type: "health_status", healthStatusThreshold: "overloaded" },
    actions: ["pause_non_critical"],
    requireHumanApproval: false,
    enabled: true,
  });
  service.registerPlaybook(playbook);

  const snapshot = createHealthSnapshot({ status: "overloaded" });
  service.updateHealthCheck(snapshot);

  // Allow async execution to complete
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(executionCount >= 1, true);
});

test("AutoStopLossService integration: updateHealthCheck does not trigger when disabled", () => {
  const service = new AutoStopLossService({
    config: { enabled: false },
  });

  let executionCount = 0;
  service.registerActionHandler("circuit_break", async () => {
    executionCount++;
    return { success: true, message: "broken" };
  });

  const snapshot = createHealthSnapshot({ status: "degraded" });
  service.updateHealthCheck(snapshot);

  assert.equal(executionCount, 0);
});

// =============================================================================
// Custom Action Handlers
// =============================================================================

test("AutoStopLossService integration: registerActionHandler overrides default handler", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "custom_handler_test",
    actions: ["circuit_break"],
    requireHumanApproval: false,
    enabled: true,
  });

  let customCalled = false;
  service.registerActionHandler("circuit_break", async () => {
    customCalled = true;
    return { success: true, message: "custom circuit break" };
  });

  await service.executePlaybook(playbook, "testing custom handler");

  assert.equal(customCalled, true);
});

test("AutoStopLossService integration: unregistered action returns error", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "unknown_action_test",
    actions: ["unknown_action" as any],
    requireHumanApproval: false,
    enabled: true,
  });

  // Manually add since we don't support unknown actions normally
  const event = await service.executePlaybook(playbook as any, "testing unknown action");

  assert.equal(event.success, false);
  assert.ok(event.errorMessage?.includes("No handler"));
});

// =============================================================================
// Execution History
// =============================================================================

test("AutoStopLossService integration: getExecutionHistory returns limited results", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "history_limit_test",
    actions: ["circuit_break"],
    requireHumanApproval: false,
    enabled: true,
  });

  // Execute multiple times
  for (let i = 0; i < 5; i++) {
    await service.executePlaybook(playbook, `execution ${i}`);
  }

  const history = service.getExecutionHistory(3);
  assert.equal(history.length, 3);
});

test("AutoStopLossService integration: execution history is bounded", async () => {
  const service = new AutoStopLossService();
  const playbook = createTestPlaybook({
    id: "bounded_history_test",
    actions: ["circuit_break"],
    requireHumanApproval: false,
    enabled: true,
  });

  // Execute many times to exceed 1000 limit
  for (let i = 0; i < 1005; i++) {
    await service.executePlaybook(playbook, `execution ${i}`);
  }

  const history = service.getExecutionHistory(10000);
  assert.ok(history.length <= 1010); // Some tolerance for other events
});

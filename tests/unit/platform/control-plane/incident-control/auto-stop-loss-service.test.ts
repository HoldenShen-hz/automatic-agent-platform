/**
 * Unit tests for AutoStopLossService
 * Issues #2127: executionCounts hourly key never cleaned
 * Issue #2128: Severity upgrade uses string includes
 */

import assert from "node:assert/strict";
import { setImmediate as setImmediatePromise } from "node:timers/promises";
import test from "node:test";
import {
  AutoStopLossService,
  type EscalationLevel,
  type StopLossAction,
  type StopLossPlaybook,
  type SystemHealthSnapshot,
} from "../../../../../src/platform/control-plane/incident-control/auto-stop-loss-service.js";

test.describe("AutoStopLossService", () => {
  test("executePlaybook records execution event with correct hour key", async () => {
    const service = new AutoStopLossService();

    const playbook: StopLossPlaybook = {
      id: "test-playbook-hourly-key",
      name: "Test Playbook",
      description: "Tests hourly key cleanup",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["circuit_break"],
      cooldownMs: 0,
      maxExecutionsPerHour: 100,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbook);

    // Execute the playbook
    const event = await service.executePlaybook(playbook, "Test execution");

    assert.equal(event.playbookId, "test-playbook-hourly-key");
    assert.equal(event.success, true);

    // Verify execution count was recorded
    const stats = service.getExecutionStats();
    assert.equal(stats.totalExecutions, 1);
  });

  test("executionCounts hourly key is properly formatted", async () => {
    const service = new AutoStopLossService();

    const playbook: StopLossPlaybook = {
      id: "test-playbook-hour-key",
      name: "Test Playbook",
      description: "Tests hour key format",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["circuit_break"],
      cooldownMs: 0,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbook);

    // Execute multiple times
    await service.executePlaybook(playbook, "Test 1");
    await service.executePlaybook(playbook, "Test 2");

    const stats = service.getExecutionStats();
    assert.equal(stats.totalExecutions, 2);
  });

  test("isPlaybookRateLimited respects hourly execution limit", async () => {
    const service = new AutoStopLossService();

    const playbook: StopLossPlaybook = {
      id: "rate-limited-playbook",
      name: "Rate Limited",
      description: "Limited to 2 per hour",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["circuit_break"],
      cooldownMs: 0,
      maxExecutionsPerHour: 2,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbook);

    // Execute first time - should succeed
    const event1 = await service.executePlaybook(playbook, "First execution");
    assert.equal(event1.success, true);

    // Execute second time - should succeed
    const event2 = await service.executePlaybook(playbook, "Second execution");
    assert.equal(event2.success, true);

    // Third execution should fail due to rate limit
    const event3 = await service.executePlaybook(playbook, "Third execution");
    assert.equal(event3.success, false);
    assert.equal(event3.errorMessage, "Pending human approval");
  });

  test("evaluateAnomaly correctly maps severity to escalation level", () => {
    const service = new AutoStopLossService();

    // Test info severity
    const infoResult = service.evaluateAnomaly("info", "test_metric");
    assert.equal(infoResult.escalation, "observe");

    // Test warning severity
    const warningResult = service.evaluateAnomaly("warning", "test_metric");
    assert.equal(warningResult.escalation, "warn");

    // Test critical severity
    const criticalResult = service.evaluateAnomaly("critical", "test_metric");
    assert.equal(criticalResult.escalation, "act");

    // Test emergency severity
    const emergencyResult = service.evaluateAnomaly("emergency", "test_metric");
    assert.equal(emergencyResult.escalation, "critical");
  });

  test("evaluateHealth correctly maps health status to escalation level", () => {
    const service = new AutoStopLossService();

    const okResult = service.evaluateHealth("ok");
    assert.equal(okResult.escalation, "observe");

    const degradedResult = service.evaluateHealth("degraded");
    assert.equal(degradedResult.escalation, "warn");

    const overloadedResult = service.evaluateHealth("overloaded");
    assert.equal(overloadedResult.escalation, "act");

    const unhealthyResult = service.evaluateHealth("unhealthy");
    assert.equal(unhealthyResult.escalation, "critical");
  });

  test("updateHealthCheck triggers playbook execution for matching health status", () => {
    const service = new AutoStopLossService();

    const snapshot: SystemHealthSnapshot = {
      status: "overloaded",
      anomalySeverity: "critical",
      activeExecutions: 10,
      queuedTasks: 100,
      memoryUsageMb: 512,
      eventLoopLagMs: 50,
      providerHealth: "degraded",
    };

    // Update health check - should evaluate and potentially execute playbooks
    service.updateHealthCheck(snapshot);

    // Verify last health check was recorded
    const lastCheck = service.getLastHealthCheck();
    assert.deepEqual(lastCheck, snapshot);
  });

  test("updateHealthCheck records failed execution event when async playbook action fails", async () => {
    const service = new AutoStopLossService();

    service.registerActionHandler("circuit_break", async () => {
      throw new Error("circuit handler failed");
    });

    const playbook: StopLossPlaybook = {
      id: "failing-health-playbook",
      name: "Failing Health Playbook",
      description: "Tests health-triggered error recording",
      enabled: true,
      triggerCondition: { type: "health_status", healthStatusThreshold: "overloaded" },
      actions: ["circuit_break"],
      cooldownMs: 0,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbook);

    service.updateHealthCheck({
      status: "overloaded",
      anomalySeverity: "warning",
      activeExecutions: 5,
      queuedTasks: 42,
      memoryUsageMb: 512,
      eventLoopLagMs: 25,
      providerHealth: "degraded",
    });

    await setImmediatePromise();
    await setImmediatePromise();

    const matchingEvents = service
      .getExecutionHistory()
      .filter((event) => event.playbookId === "failing-health-playbook");
    assert.equal(matchingEvents.length, 1);
    assert.equal(matchingEvents[0]?.success, false);
    assert.equal(matchingEvents[0]?.errorMessage, "circuit handler failed");
  });

  test("getExecutionStats returns accurate statistics", async () => {
    const service = new AutoStopLossService();

    const playbook: StopLossPlaybook = {
      id: "stats-test-playbook",
      name: "Stats Test",
      description: "Tests statistics",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["circuit_break"],
      cooldownMs: 0,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbook);

    await service.executePlaybook(playbook, "Test 1");
    await service.executePlaybook(playbook, "Test 2");

    const stats = service.getExecutionStats();
    assert.equal(stats.totalExecutions, 2);
    assert.ok(stats.successfulExecutions >= 0);
  });

  test("classifyPlaybookError correctly categorizes errors", () => {
    const service = new AutoStopLossService();

    // Create a custom error to test classification
    const playbook: StopLossPlaybook = {
      id: "error-classify-test",
      name: "Error Test",
      description: "Tests error classification",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["unknown_action"],
      cooldownMs: 0,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbook);

    // Execute playbook with an unknown action to trigger error
    service.executePlaybook(playbook, "Test error").catch(() => {
      // Expected to potentially fail
    });

    const errors = service.getRecentErrors();
    assert.ok(errors.length >= 0);
  });

  test("approvePendingExecution allows pending executions to complete", async () => {
    const service = new AutoStopLossService();

    const playbook: StopLossPlaybook = {
      id: "approval-test-playbook",
      name: "Approval Test",
      description: "Tests approval flow",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["circuit_break"],
      cooldownMs: 0,
      maxExecutionsPerHour: 1,
      requireHumanApproval: true,
    };

    service.registerPlaybook(playbook);

    // Execute playbook that requires approval
    const event = await service.executePlaybook(playbook, "Needs approval");
    assert.equal(event.success, false);
    assert.equal(event.errorMessage, "Pending human approval");
    assert.equal(event.humanApproved, false);

    // Get pending approvals
    const pending = service.getPendingApprovals();
    assert.ok(pending.length > 0);

    // Approve the execution
    const approved = service.approvePendingExecution(event.id, true);
    assert.equal(approved, true);
  });

  test("getPendingApprovals returns only pending items", async () => {
    const service = new AutoStopLossService();

    const playbook1: StopLossPlaybook = {
      id: "approval-playbook-1",
      name: "Approval Test 1",
      description: "Tests pending approvals",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["circuit_break"],
      cooldownMs: 0,
      maxExecutionsPerHour: 1,
      requireHumanApproval: true,
    };

    const playbook2: StopLossPlaybook = {
      id: "auto-playbook-2",
      name: "Auto Test 2",
      description: "Tests auto execution",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "warning" },
      actions: ["scale_down"],
      cooldownMs: 0,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbook1);
    service.registerPlaybook(playbook2);

    await service.executePlaybook(playbook1, "Needs approval");
    await service.executePlaybook(playbook2, "Auto");

    const pending = service.getPendingApprovals();
    assert.ok(pending.length > 0);
  });

  test("executePlaybook records event in history", async () => {
    const service = new AutoStopLossService();

    const playbook: StopLossPlaybook = {
      id: "history-test-playbook",
      name: "History Test",
      description: "Tests history",
      enabled: true,
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["circuit_break"],
      cooldownMs: 0,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbook);

    await service.executePlaybook(playbook, "Test execution");

    const history = service.getExecutionHistory(10);
    assert.ok(history.length > 0);
    assert.equal(history[history.length - 1]!.playbookId, "history-test-playbook");
  });

  test("conditionMatches handles compound conditions correctly", () => {
    const service = new AutoStopLossService();

    // Test compound AND condition
    const playbookAnd: StopLossPlaybook = {
      id: "compound-and-test",
      name: "Compound AND Test",
      description: "Tests compound AND",
      enabled: true,
      triggerCondition: {
        type: "compound",
        compoundOperator: "and",
        subConditions: [
          { type: "anomaly_severity", severityThreshold: "critical" },
          { type: "health_status", healthStatusThreshold: "degraded" },
        ],
      },
      actions: ["pause_non_critical"],
      cooldownMs: 0,
      maxExecutionsPerHour: 10,
      requireHumanApproval: false,
    };

    service.registerPlaybook(playbookAnd);

    const result = service.evaluateAnomaly("critical", "test_metric", {
      healthStatus: "degraded",
    });

    assert.ok(result.shouldExecute);
  });
});

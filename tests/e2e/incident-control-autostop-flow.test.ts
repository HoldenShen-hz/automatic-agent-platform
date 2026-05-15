import assert from "node:assert/strict";
import test from "node:test";

import {
  AutoStopLossService,
  type StopLossPlaybook,
} from "../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";

test("E2E: auto stop-loss health loop executes auto playbooks, queues approvals, and respects cooldowns", async () => {
  const executedActions: string[] = [];
  const playbooks: StopLossPlaybook[] = [
    {
      id: "overload_auto",
      name: "Pause On Overload",
      description: "Pause low-value work when the system is overloaded.",
      triggerCondition: {
        type: "health_status",
        healthStatusThreshold: "overloaded",
      },
      actions: ["pause_non_critical", "reject_low_priority"],
      cooldownMs: 60_000,
      maxExecutionsPerHour: 5,
      requireHumanApproval: false,
      enabled: true,
    },
    {
      id: "memory_manual",
      name: "Scale On Memory Pressure",
      description: "Require human approval before scaling down on memory pressure.",
      triggerCondition: {
        type: "metric_threshold",
        metricName: "memory_usage_mb",
        metricValue: 512,
        operator: "gt",
      },
      actions: ["scale_down"],
      cooldownMs: 60_000,
      maxExecutionsPerHour: 5,
      requireHumanApproval: true,
      enabled: true,
    },
  ];

  const service = new AutoStopLossService({
    playbooks,
    config: {
      enableHumanEscalation: true,
    },
  });

  service.registerActionHandler("pause_non_critical", async (context) => {
    executedActions.push(`pause:${String(context?.healthStatus ?? "unknown")}`);
    return { success: true, message: "paused" };
  });
  service.registerActionHandler("reject_low_priority", async (context) => {
    executedActions.push(`reject:${String(context?.queuedTasks ?? "unknown")}`);
    return { success: true, message: "rejected" };
  });
  service.registerActionHandler("scale_down", async () => {
    executedActions.push("scale_down");
    return { success: true, message: "scaled" };
  });

  service.updateHealthCheck({
    status: "overloaded",
    anomalySeverity: "critical",
    activeExecutions: 14,
    queuedTasks: 27,
    memoryUsageMb: 900,
    eventLoopLagMs: 120,
    providerHealth: "degraded",
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(executedActions, ["pause:overloaded", "reject:27"]);
  assert.equal(service.getLastHealthCheck()?.memoryUsageMb, 900);

  const firstHistory = service.getExecutionHistory(10);
  assert.equal(firstHistory.length, 2);

  const autoEvent = firstHistory.find((entry) => entry.playbookId === "overload_auto");
  assert.ok(autoEvent);
  assert.equal(autoEvent?.success, true);
  assert.deepEqual(autoEvent?.actionsExecuted, ["pause_non_critical", "reject_low_priority"]);

  const pendingApproval = service.getPendingApprovals()[0];
  assert.ok(pendingApproval);
  assert.equal(pendingApproval?.playbookId, "memory_manual");
  assert.equal(pendingApproval?.errorMessage, "Pending human approval");
  assert.equal(pendingApproval?.humanApproved, false);
  assert.ok(!executedActions.includes("scale_down"));

  service.updateHealthCheck({
    status: "overloaded",
    anomalySeverity: "critical",
    activeExecutions: 10,
    queuedTasks: 11,
    memoryUsageMb: 300,
    eventLoopLagMs: 80,
    providerHealth: "healthy",
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const autoExecutions = service
    .getExecutionHistory(10)
    .filter((entry) => entry.playbookId === "overload_auto");
  assert.equal(autoExecutions.length, 1);

  const approved = service.approvePendingExecution(pendingApproval?.id ?? "", true);
  assert.equal(approved, true);
  assert.equal(service.getPendingApprovals().length, 0);

  const approvedEvent = service
    .getExecutionHistory(10)
    .find((entry) => entry.id === pendingApproval?.id);
  assert.equal(approvedEvent?.humanApproved, true);
  assert.equal(approvedEvent?.errorMessage, undefined);
});

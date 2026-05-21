import test from "node:test";
import assert from "node:assert/strict";

// Test the types file directly by importing from it
import type {
  EscalationLevel,
  StopLossAction,
  StopLossPlaybook,
  PlaybookCondition,
  StopLossEvent,
  AutoStopLossConfig,
  SystemHealthSnapshot,
  ConditionMatchContext,
  ActionContext,
  ActionResult,
  PendingApprovalExecution,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-types.js";

test("EscalationLevel accepts all valid values", () => {
  const levels: EscalationLevel[] = ["observe", "warn", "act", "critical"];
  assert.equal(levels.length, 4);
});

test("StopLossAction accepts all valid values", () => {
  const actions: StopLossAction[] = [
    "circuit_break",
    "isolate_provider",
    "scale_down",
    "pause_non_critical",
    "queue_only",
    "reject_low_priority",
    "enable_circuit_breaker",
    "disable_new_tasks",
    "force_garbage_collection",
    "escalate_to_human",
  ];
  assert.equal(actions.length, 10);
});

test("PlaybookCondition supports anomaly_severity type", () => {
  const condition: PlaybookCondition = {
    type: "anomaly_severity",
    severityThreshold: "critical",
  };
  assert.equal(condition.type, "anomaly_severity");
  assert.equal(condition.severityThreshold, "critical");
});

test("PlaybookCondition supports health_status type", () => {
  const condition: PlaybookCondition = {
    type: "health_status",
    healthStatusThreshold: "overloaded",
  };
  assert.equal(condition.type, "health_status");
  assert.equal(condition.healthStatusThreshold, "overloaded");
});

test("PlaybookCondition supports metric_threshold type", () => {
  const condition: PlaybookCondition = {
    type: "metric_threshold",
    metricName: "cpu_usage",
    metricValue: 90,
    operator: "gt",
  };
  assert.equal(condition.metricName, "cpu_usage");
  assert.equal(condition.metricValue, 90);
  assert.equal(condition.operator, "gt");
});

test("PlaybookCondition supports compound type", () => {
  const condition: PlaybookCondition = {
    type: "compound",
    compoundOperator: "or",
    subConditions: [
      { type: "anomaly_severity", severityThreshold: "critical" },
      { type: "health_status", healthStatusThreshold: "unhealthy" },
    ],
  };
  assert.equal(condition.type, "compound");
  assert.equal(condition.compoundOperator, "or");
  assert.equal(condition.subConditions!.length, 2);
});

test("PlaybookCondition operator enum values", () => {
  const operators: PlaybookCondition["operator"][] = ["gt", "lt", "gte", "lte", "eq"];
  assert.equal(operators.length, 5);
});

test("StopLossPlaybook structure with all fields", () => {
  const playbook: StopLossPlaybook = {
    id: "playbook_test",
    name: "Test Playbook",
    description: "Testing all fields",
    triggerCondition: {
      type: "metric_threshold",
      metricName: "error_rate",
      metricValue: 0.05,
      operator: "gt",
    },
    actions: ["circuit_break", "escalate_to_human"],
    cooldownMs: 60000,
    maxExecutionsPerHour: 5,
    requireHumanApproval: true,
    enabled: true,
  };

  assert.equal(playbook.id, "playbook_test");
  assert.equal(playbook.requireHumanApproval, true);
  assert.equal(playbook.enabled, true);
  assert.equal(playbook.cooldownMs, 60000);
  assert.equal(playbook.maxExecutionsPerHour, 5);
});

test("StopLossPlaybook disabled state", () => {
  const playbook: StopLossPlaybook = {
    id: "playbook_disabled",
    name: "Disabled Playbook",
    description: "This playbook is off",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "warning" },
    actions: ["escalate_to_human"],
    cooldownMs: 30000,
    maxExecutionsPerHour: 10,
    requireHumanApproval: false,
    enabled: false,
  };

  assert.equal(playbook.enabled, false);
});

test("StopLossEvent structure with completedAt", () => {
  const event: StopLossEvent = {
    id: "event_123",
    playbookId: "playbook_456",
    playbookName: "Test Playbook",
    triggerReason: "Error rate exceeded 5%",
    actionsExecuted: ["circuit_break"],
    escalationLevel: "act",
    executedAt: "2026-04-14T00:00:00.000Z",
    completedAt: "2026-04-14T00:00:05.000Z",
    success: true,
    autoTriggered: true,
    humanApproved: false,
  };

  assert.equal(event.success, true);
  assert.equal(event.completedAt, "2026-04-14T00:00:05.000Z");
  assert.equal(event.autoTriggered, true);
  assert.equal(event.humanApproved, false);
});

test("StopLossEvent structure with null completedAt and errorMessage", () => {
  const event: StopLossEvent = {
    id: "event_pending",
    playbookId: "playbook_789",
    playbookName: "Pending Playbook",
    triggerReason: "Test trigger",
    actionsExecuted: ["scale_down"],
    escalationLevel: "warn",
    executedAt: "2026-04-14T00:00:00.000Z",
    completedAt: null,
    success: false,
    errorMessage: "Execution timed out",
    autoTriggered: true,
    humanApproved: false,
  };

  assert.equal(event.completedAt, null);
  assert.equal(event.success, false);
  assert.equal(event.errorMessage, "Execution timed out");
});

test("StopLossEvent humanApproved when autoTriggered false", () => {
  const event: StopLossEvent = {
    id: "event_manual",
    playbookId: "playbook_abc",
    playbookName: "Manual Playbook",
    triggerReason: "Operator initiated",
    actionsExecuted: ["disable_new_tasks"],
    escalationLevel: "critical",
    executedAt: "2026-04-14T00:00:00.000Z",
    completedAt: "2026-04-14T00:01:00.000Z",
    success: true,
    autoTriggered: false,
    humanApproved: true,
  };

  assert.equal(event.autoTriggered, false);
  assert.equal(event.humanApproved, true);
});

test("AutoStopLossConfig full configuration", () => {
  const config: AutoStopLossConfig = {
    enabled: true,
    defaultCooldownMs: 60000,
    maxEventsPerHour: 10,
    enableAutoExecution: true,
    enableHumanEscalation: true,
    healthCheckIntervalMs: 30000,
  };

  assert.equal(config.enabled, true);
  assert.equal(config.enableAutoExecution, true);
  assert.equal(config.enableHumanEscalation, true);
  assert.equal(config.maxEventsPerHour, 10);
});

test("AutoStopLossConfig disabled configuration", () => {
  const config: AutoStopLossConfig = {
    enabled: false,
    defaultCooldownMs: 300000,
    maxEventsPerHour: 0,
    enableAutoExecution: false,
    enableHumanEscalation: false,
    healthCheckIntervalMs: 60000,
  };

  assert.equal(config.enabled, false);
  assert.equal(config.maxEventsPerHour, 0);
  assert.equal(config.enableAutoExecution, false);
});

test("SystemHealthSnapshot all health statuses", () => {
  const statuses: SystemHealthSnapshot["status"][] = ["ok", "degraded", "overloaded", "unhealthy"];

  for (const status of statuses) {
    const snapshot: SystemHealthSnapshot = {
      status,
      anomalySeverity: status === "ok" ? null : "warning",
      activeExecutions: 10,
      queuedTasks: 50,
      memoryUsageMb: 512,
      eventLoopLagMs: 25,
      providerHealth: status === "ok" ? "healthy" : "degraded",
    };
    assert.equal(snapshot.status, status);
  }
});

test("SystemHealthSnapshot with null anomalySeverity", () => {
  const snapshot: SystemHealthSnapshot = {
    status: "ok",
    anomalySeverity: null,
    activeExecutions: 0,
    queuedTasks: 5,
    memoryUsageMb: 128,
    eventLoopLagMs: 1,
    providerHealth: "healthy",
  };

  assert.equal(snapshot.anomalySeverity, null);
  assert.equal(snapshot.providerHealth, "healthy");
});

test("ConditionMatchContext with all optional fields", () => {
  const context: ConditionMatchContext = {
    severity: "critical",
    metricName: "memory_usage_mb",
    healthStatus: "overloaded",
    context: { region: "us-east-1", tenant: "tenant_123" },
  };

  assert.equal(context.severity, "critical");
  assert.equal(context.metricName, "memory_usage_mb");
  assert.equal(context.healthStatus, "overloaded");
  assert.equal(context.context?.region, "us-east-1");
});

test("ConditionMatchContext allows minimal fields", () => {
  const context: ConditionMatchContext = {
    severity: "warning",
  };

  assert.equal(context.severity, "warning");
  assert.equal(context.metricName, undefined);
});

test("ActionContext index signature", () => {
  const context: ActionContext = {
    playbookId: "playbook_123",
    reason: "High error rate",
    provider: "aws",
    metricName: "error_rate",
    customField: "custom_value",
  };

  assert.equal(context.playbookId, "playbook_123");
  assert.equal(context.customField, "custom_value");
  // Index signature access
  const value = context["customField"];
  assert.equal(value, "custom_value");
});

test("ActionResult structure", () => {
  const result: ActionResult = {
    success: true,
    message: "Action executed successfully",
  };

  assert.equal(result.success, true);
  assert.equal(result.message, "Action executed successfully");
  assert.equal(result.requiresApproval, undefined);
});

test("ActionResult with requiresApproval flag", () => {
  const result: ActionResult = {
    success: false,
    message: "Human approval required",
    requiresApproval: true,
  };

  assert.equal(result.success, false);
  assert.equal(result.requiresApproval, true);
});

test("PendingApprovalExecution structure", () => {
  const execution: PendingApprovalExecution = {
    playbook: {
      id: "playbook_pending",
      name: "Pending Playbook",
      description: "Awaiting approval",
      triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
      actions: ["escalate_to_human"],
      cooldownMs: 60000,
      maxExecutionsPerHour: 5,
      requireHumanApproval: true,
      enabled: true,
    },
    triggerReason: "Critical anomaly detected",
    context: { taskId: "task_123", executionId: "exec_456" },
  };

  assert.equal(execution.playbook.id, "playbook_pending");
  assert.equal(execution.triggerReason, "Critical anomaly detected");
  assert.equal(execution.context?.taskId, "task_123");
});

test("ActionHandler type is a function", () => {
  const handler: ActionHandler = async (context: ActionContext) => {
    return { success: true, message: "Handled" };
  };

  assert.ok(typeof handler === "function");
});
import assert from "node:assert/strict";
import test from "node:test";

import type {
  EscalationLevel,
  StopLossAction,
  StopLossPlaybook,
  PlaybookCondition,
  StopLossEvent,
  AutoStopLossConfig,
  SystemHealthSnapshot,
} from "../../../../../src/platform/control-plane/incident-control/auto-stop-loss-service.js";
import type { AnomalySeverity } from "../../../../../src/platform/shared/observability/anomaly-detection-service.js";

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

test("PlaybookCondition structure for anomaly severity type", () => {
  const condition: PlaybookCondition = {
    type: "anomaly_severity",
    severityThreshold: "critical",
  };
  assert.equal(condition.type, "anomaly_severity");
  assert.equal(condition.severityThreshold, "critical");
});

test("PlaybookCondition structure for health status type", () => {
  const condition: PlaybookCondition = {
    type: "health_status",
    healthStatusThreshold: "degraded",
  };
  assert.equal(condition.type, "health_status");
  assert.equal(condition.healthStatusThreshold, "degraded");
});

test("PlaybookCondition structure for metric threshold type", () => {
  const condition: PlaybookCondition = {
    type: "metric_threshold",
    metricName: "error_rate",
    metricValue: 0.05,
    operator: "gt",
  };
  assert.equal(condition.metricName, "error_rate");
  assert.equal(condition.operator, "gt");
});

test("PlaybookCondition allows compound conditions", () => {
  const condition: PlaybookCondition = {
    type: "compound",
    compoundOperator: "and",
    subConditions: [
      { type: "anomaly_severity", severityThreshold: "warning" },
      { type: "health_status", healthStatusThreshold: "degraded" },
    ],
  };
  assert.equal(condition.compoundOperator, "and");
  assert.equal(condition.subConditions!.length, 2);
});

test("PlaybookCondition operator accepts all valid values", () => {
  const operators: PlaybookCondition["operator"][] = ["gt", "lt", "gte", "lte", "eq"];
  assert.equal(operators.length, 5);
});

test("StopLossPlaybook structure is correct", () => {
  const playbook: StopLossPlaybook = {
    id: "playbook_123",
    name: "High Error Rate Response",
    description: "Triggers when error rate exceeds threshold",
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
  assert.equal(playbook.name, "High Error Rate Response");
  assert.equal(playbook.actions.length, 2);
});

test("StopLossPlaybook allows disabled playbook", () => {
  const playbook: StopLossPlaybook = {
    id: "playbook_disabled",
    name: "Disabled Playbook",
    description: "This playbook is disabled",
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
    actions: ["escalate_to_human"],
    cooldownMs: 30000,
    maxExecutionsPerHour: 10,
    requireHumanApproval: false,
    enabled: false,
  };
  assert.equal(playbook.enabled, false);
});

test("StopLossEvent structure is correct", () => {
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
  assert.equal(event.escalationLevel, "act");
});

test("StopLossEvent allows null completedAt and errorMessage", () => {
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
    autoTriggered: true,
    humanApproved: false,
  };
  assert.equal(event.completedAt, null);
});

test("AutoStopLossConfig structure is correct", () => {
  const config: AutoStopLossConfig = {
    enabled: true,
    defaultCooldownMs: 60000,
    maxEventsPerHour: 10,
    enableAutoExecution: true,
    enableHumanEscalation: true,
    healthCheckIntervalMs: 30000,
  };
  assert.equal(config.enabled, true);
  assert.equal(config.defaultCooldownMs, 60000);
});

test("AutoStopLossConfig allows disabled state", () => {
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
});

test("SystemHealthSnapshot structure is correct", () => {
  const snapshot: SystemHealthSnapshot = {
    status: "degraded",
    anomalySeverity: "warning",
    activeExecutions: 10,
    queuedTasks: 50,
    memoryUsageMb: 512,
    eventLoopLagMs: 25,
    providerHealth: "degraded",
  };
  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.anomalySeverity, "warning");
});

test("SystemHealthSnapshot allows null anomalySeverity", () => {
  const snapshot: SystemHealthSnapshot = {
    status: "ok",
    anomalySeverity: null,
    activeExecutions: 5,
    queuedTasks: 10,
    memoryUsageMb: 256,
    eventLoopLagMs: 5,
    providerHealth: "healthy",
  };
  assert.equal(snapshot.anomalySeverity, null);
});

test("AnomalySeverity accepts all valid values", () => {
  const severities: AnomalySeverity[] = ["info", "warning", "critical", "emergency"];
  assert.equal(severities.length, 4);
});

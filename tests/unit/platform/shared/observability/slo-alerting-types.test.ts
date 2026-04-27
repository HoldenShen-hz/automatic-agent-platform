import assert from "node:assert/strict";
import test from "node:test";

import {
  SLO_ALERTING_DDL,
  type SliKind,
  type SloStatus,
  type AlertSeverity,
  type AlertStatus,
  type AlertChannelKind,
  type RunbookStatus,
  type SliRecord,
  type SloDefinition,
  type AlertRule,
  type AlertEvent,
  type RunbookDefinition,
  type RunbookExecution,
} from "../../../../../src/platform/shared/observability/slo-alerting/types.js";

test("SLO_ALERTING_DDL contains required table definitions", () => {
  assert.ok(SLO_ALERTING_DDL.includes("sli_samples"));
  assert.ok(SLO_ALERTING_DDL.includes("slo_definitions"));
  assert.ok(SLO_ALERTING_DDL.includes("alert_rules"));
  assert.ok(SLO_ALERTING_DDL.includes("alert_events"));
  assert.ok(SLO_ALERTING_DDL.includes("runbook_definitions"));
  assert.ok(SLO_ALERTING_DDL.includes("runbook_executions"));
});

test("SliKind accepts all valid values", () => {
  const kinds: SliKind[] = [
    "availability",
    "latency_p95",
    "latency_p99",
    "error_rate",
    "throughput",
    "saturation",
    "custom",
  ];
  assert.equal(kinds.length, 7);
});

test("SloStatus accepts all valid values", () => {
  const statuses: SloStatus[] = ["met", "at_risk", "breached", "unknown"];
  assert.equal(statuses.length, 4);
});

test("AlertSeverity accepts all valid values", () => {
  const severities: AlertSeverity[] = ["info", "warning", "critical", "page"];
  assert.equal(severities.length, 4);
});

test("AlertStatus accepts all valid values", () => {
  const statuses: AlertStatus[] = ["firing", "resolved", "acknowledged", "silenced"];
  assert.equal(statuses.length, 4);
});

test("AlertChannelKind accepts all valid values", () => {
  const channels: AlertChannelKind[] = ["log", "webhook", "pagerduty", "slack", "opsgenie", "email"];
  assert.equal(channels.length, 6);
});

test("RunbookStatus accepts all valid values", () => {
  const statuses: RunbookStatus[] = ["pending", "running", "completed", "failed", "skipped"];
  assert.equal(statuses.length, 5);
});

test("SliRecord structure is correct", () => {
  const record: SliRecord = {
    id: "sli_123",
    sloId: "slo_456",
    kind: "latency_p95",
    value: 250.5,
    unit: "ms",
    collectedAt: "2026-04-26T10:00:00.000Z",
    metadata: '{"source":"test"}',
  };

  assert.equal(record.id, "sli_123");
  assert.equal(record.sloId, "slo_456");
  assert.equal(record.kind, "latency_p95");
  assert.equal(record.value, 250.5);
  assert.equal(record.unit, "ms");
  assert.equal(record.metadata, '{"source":"test"}');
});

test("SliRecord allows null metadata", () => {
  const record: SliRecord = {
    id: "sli_null_meta",
    sloId: "slo_456",
    kind: "error_rate",
    value: 0.05,
    unit: "%",
    collectedAt: "2026-04-26T10:00:00.000Z",
    metadata: null,
  };

  assert.equal(record.metadata, null);
});

test("SloDefinition structure is correct", () => {
  const definition: SloDefinition = {
    id: "slo_def_123",
    name: "API Latency SLO",
    description: "P95 latency should be under 500ms",
    sliKind: "latency_p95",
    targetValue: 500,
    operator: "lte",
    windowMinutes: 60,
    status: "met",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(definition.id, "slo_def_123");
  assert.equal(definition.name, "API Latency SLO");
  assert.equal(definition.targetValue, 500);
  assert.equal(definition.operator, "lte");
  assert.equal(definition.windowMinutes, 60);
  assert.equal(definition.status, "met");
});

test("SloDefinition accepts all operator values", () => {
  const operators: SloDefinition["operator"][] = ["lte", "gte", "lt", "gt"];
  assert.equal(operators.length, 4);
});

test("AlertRule structure is correct", () => {
  const rule: AlertRule = {
    id: "arule_123",
    name: "High Latency Alert",
    sloId: "slo_456",
    condition: "latency > 500ms",
    severity: "warning",
    channelKind: "slack",
    channelConfig: '{"webhookUrl":"https://hooks.slack.test"}',
    cooldownMinutes: 5,
    enabled: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  assert.equal(rule.id, "arule_123");
  assert.equal(rule.name, "High Latency Alert");
  assert.equal(rule.sloId, "slo_456");
  assert.equal(rule.severity, "warning");
  assert.equal(rule.channelKind, "slack");
  assert.equal(rule.cooldownMinutes, 5);
  assert.equal(rule.enabled, true);
});

test("AlertRule allows null sloId", () => {
  const rule: AlertRule = {
    id: "arule_no_slo",
    name: "Generic Alert",
    sloId: null,
    condition: "",
    severity: "critical",
    channelKind: "pagerduty",
    channelConfig: "{}",
    cooldownMinutes: 1,
    enabled: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  assert.equal(rule.sloId, null);
});

test("AlertEvent structure is correct", () => {
  const event: AlertEvent = {
    id: "alert_123",
    ruleId: "arule_456",
    severity: "critical",
    status: "firing",
    title: "High CPU Usage",
    detail: "CPU usage exceeded 90%",
    channelKind: "pagerduty",
    deliveredAt: "2026-04-26T10:01:00.000Z",
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-26T10:00:00.000Z",
  };

  assert.equal(event.id, "alert_123");
  assert.equal(event.ruleId, "arule_456");
  assert.equal(event.severity, "critical");
  assert.equal(event.status, "firing");
  assert.equal(event.title, "High CPU Usage");
  assert.equal(event.deliveredAt, "2026-04-26T10:01:00.000Z");
  assert.equal(event.acknowledgedBy, null);
});

test("AlertEvent allows null deliveredAt", () => {
  const event: AlertEvent = {
    id: "alert_not_delivered",
    ruleId: "arule_456",
    severity: "warning",
    status: "firing",
    title: "Test Alert",
    detail: "Not delivered yet",
    channelKind: "log",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-26T10:00:00.000Z",
  };

  assert.equal(event.deliveredAt, null);
});

test("AlertEvent with acknowledged status has acknowledgedBy", () => {
  const event: AlertEvent = {
    id: "alert_acked",
    ruleId: "arule_456",
    severity: "critical",
    status: "acknowledged",
    title: "Acknowledged Alert",
    detail: "Being worked on",
    channelKind: "slack",
    deliveredAt: "2026-04-26T10:01:00.000Z",
    acknowledgedBy: "oncall-engineer",
    resolvedAt: null,
    firedAt: "2026-04-26T10:00:00.000Z",
  };

  assert.equal(event.status, "acknowledged");
  assert.equal(event.acknowledgedBy, "oncall-engineer");
});

test("AlertEvent with resolved status has resolvedAt", () => {
  const event: AlertEvent = {
    id: "alert_resolved",
    ruleId: "arule_456",
    severity: "warning",
    status: "resolved",
    title: "Resolved Alert",
    detail: "Issue fixed",
    channelKind: "log",
    deliveredAt: "2026-04-26T10:01:00.000Z",
    acknowledgedBy: "oncall-engineer",
    resolvedAt: "2026-04-26T11:00:00.000Z",
    firedAt: "2026-04-26T10:00:00.000Z",
  };

  assert.equal(event.status, "resolved");
  assert.equal(event.resolvedAt, "2026-04-26T11:00:00.000Z");
});

test("RunbookDefinition structure is correct", () => {
  const definition: RunbookDefinition = {
    id: "rbook_123",
    name: "Restart Service",
    description: "Steps to restart the service",
    alertRuleId: "arule_456",
    steps: '["stop_service","clear_cache","start_service"]',
    autoExecute: false,
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  assert.equal(definition.id, "rbook_123");
  assert.equal(definition.name, "Restart Service");
  assert.equal(definition.alertRuleId, "arule_456");
  assert.equal(definition.autoExecute, false);
});

test("RunbookDefinition allows null alertRuleId", () => {
  const definition: RunbookDefinition = {
    id: "rbook_no_rule",
    name: "Manual Runbook",
    description: "Manual steps",
    alertRuleId: null,
    steps: "[]",
    autoExecute: false,
    createdAt: "2026-04-01T00:00:00.000Z",
  };

  assert.equal(definition.alertRuleId, null);
});

test("RunbookExecution structure is correct", () => {
  const execution: RunbookExecution = {
    id: "rbexec_123",
    runbookId: "rbook_456",
    alertEventId: "alert_789",
    status: "completed",
    output: '{"steps_completed":3}',
    startedAt: "2026-04-26T10:00:00.000Z",
    completedAt: "2026-04-26T10:05:00.000Z",
    executedBy: "oncall-system",
  };

  assert.equal(execution.id, "rbexec_123");
  assert.equal(execution.runbookId, "rbook_456");
  assert.equal(execution.alertEventId, "alert_789");
  assert.equal(execution.status, "completed");
  assert.equal(execution.output, '{"steps_completed":3}');
  assert.equal(execution.executedBy, "oncall-system");
});

test("RunbookExecution allows null alertEventId", () => {
  const execution: RunbookExecution = {
    id: "rbexec_no_alert",
    runbookId: "rbook_456",
    alertEventId: null,
    status: "running",
    output: null,
    startedAt: "2026-04-26T10:00:00.000Z",
    completedAt: null,
    executedBy: "manual",
  };

  assert.equal(execution.alertEventId, null);
  assert.equal(execution.completedAt, null);
});

test("SLO_ALERTING_DDL creates indexes for performance", () => {
  assert.ok(SLO_ALERTING_DDL.includes("idx_sli_samples_slo_collected"));
  assert.ok(SLO_ALERTING_DDL.includes("idx_alert_events_status"));
  assert.ok(SLO_ALERTING_DDL.includes("idx_runbook_executions_runbook"));
});

test("SLO_ALERTING_DDL has proper column constraints", () => {
  assert.ok(SLO_ALERTING_DDL.includes("PRIMARY KEY"));
  assert.ok(SLO_ALERTING_DDL.includes("NOT NULL"));
  assert.ok(SLO_ALERTING_DDL.includes("DEFAULT"));
});

test("SLO_ALERTING_DDL uses TEXT type for timestamps", () => {
  // All timestamp columns should be TEXT type
  assert.ok(SLO_ALERTING_DDL.includes("collected_at TEXT"));
  assert.ok(SLO_ALERTING_DDL.includes("created_at TEXT"));
  assert.ok(SLO_ALERTING_DDL.includes("updated_at TEXT"));
  assert.ok(SLO_ALERTING_DDL.includes("fired_at TEXT"));
});

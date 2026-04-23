/**
 * Unit tests for SLO alerting types.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type {
  AlertChannelKind,
  AlertEvent,
  AlertRule,
  AlertSeverity,
  AlertStatus,
  RawRow,
  RunbookDefinition,
  RunbookExecution,
  RunbookStatus,
  SliKind,
  SliRecord,
  SloDefinition,
  SloStatus,
} from "../../../../../../src/platform/shared/observability/slo-alerting/types.js";

test("AlertSeverity accepts all four severity levels", () => {
  const severities: AlertSeverity[] = ["info", "warning", "critical", "page"];
  severities.forEach((s) => assert.equal(typeof s, "string"));
});

test("AlertStatus accepts all four statuses", () => {
  const statuses: AlertStatus[] = ["firing", "resolved", "acknowledged", "silenced"];
  statuses.forEach((s) => assert.equal(typeof s, "string"));
});

test("AlertChannelKind accepts expected channel types", () => {
  const channels: AlertChannelKind[] = ["log", "webhook", "pagerduty", "slack", "opsgenie", "email"];
  channels.forEach((c) => assert.equal(typeof c, "string"));
});

test("RunbookStatus accepts all five statuses", () => {
  const statuses: RunbookStatus[] = ["pending", "running", "completed", "failed", "skipped"];
  statuses.forEach((s) => assert.equal(typeof s, "string"));
});

test("SloStatus accepts expected statuses", () => {
  const statuses: SloStatus[] = ["met", "at_risk", "breached", "unknown"];
  statuses.forEach((s) => assert.equal(typeof s, "string"));
});

test("SliKind accepts expected kinds", () => {
  const kinds: SliKind[] = ["availability", "latency_p95", "latency_p99", "error_rate", "throughput", "saturation", "custom"];
  kinds.forEach((k) => assert.equal(typeof k, "string"));
});

test("SliRecord structure is valid", () => {
  const record: SliRecord = {
    id: "sli-1",
    sloId: "slo-1",
    kind: "availability",
    value: 0.999,
    unit: "ratio",
    collectedAt: "2026-04-23T10:00:00Z",
    metadata: null,
  };
  assert.equal(record.id, "sli-1");
  assert.equal(record.kind, "availability");
  assert.equal(record.value, 0.999);
});

test("SloDefinition structure is valid", () => {
  const def: SloDefinition = {
    id: "slo-1",
    name: "API Availability",
    description: "API should be available 99.9% of the time",
    sliKind: "availability",
    targetValue: 99.9,
    operator: "gte",
    windowMinutes: 60,
    status: "met",
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(def.name, "API Availability");
  assert.equal(def.operator, "gte");
  assert.equal(def.status, "met");
});

test("AlertRule structure is valid", () => {
  const rule: AlertRule = {
    id: "rule-1",
    name: "High Error Rate",
    sloId: "slo-1",
    condition: "error_rate > 0.01",
    severity: "critical",
    channelKind: "slack",
    channelConfig: '{"webhookUrl":"https://..."}',
    cooldownMinutes: 5,
    enabled: true,
    createdAt: "2026-04-01T00:00:00Z",
  };
  assert.equal(rule.name, "High Error Rate");
  assert.equal(rule.severity, "critical");
  assert.equal(rule.enabled, true);
});

test("AlertEvent structure is valid", () => {
  const event: AlertEvent = {
    id: "alert-1",
    ruleId: "rule-1",
    severity: "critical",
    status: "firing",
    title: "High Error Rate",
    detail: "Error rate exceeded threshold",
    channelKind: "slack",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-23T10:00:00Z",
  };
  assert.equal(event.id, "alert-1");
  assert.equal(event.status, "firing");
  assert.equal(event.deliveredAt, null);
});

test("RunbookDefinition structure is valid", () => {
  const def: RunbookDefinition = {
    id: "rb-1",
    name: "High Error Rate Runbook",
    description: "Steps to take when error rate is high",
    alertRuleId: "rule-1",
    steps: '["Check dashboards","Restart service"]',
    autoExecute: false,
    createdAt: "2026-04-01T00:00:00Z",
  };
  assert.equal(def.name, "High Error Rate Runbook");
  assert.equal(def.autoExecute, false);
});

test("RunbookExecution structure is valid", () => {
  const exec: RunbookExecution = {
    id: "exec-1",
    runbookId: "rb-1",
    alertEventId: "alert-1",
    status: "completed",
    output: '{"steps_completed":2}',
    startedAt: "2026-04-23T10:05:00Z",
    completedAt: "2026-04-23T10:07:00Z",
    executedBy: "system",
  };
  assert.equal(exec.status, "completed");
  assert.equal(exec.executedBy, "system");
});

test("RawRow type is a record", () => {
  const row: RawRow = { id: "1", name: "test", count: 42 };
  assert.equal(row.id, "1");
  assert.equal(row.name, "test");
  assert.equal(row.count, 42);
});
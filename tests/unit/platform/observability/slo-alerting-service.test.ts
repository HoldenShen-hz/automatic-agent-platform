/**
 * @fileoverview SloAlertingService Unit Tests
 *
 * Tests for SloAlertingService class that manages SLOs, SLIs, alert rules,
 * alert events, and runbooks.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { SloAlertingService, SLO_ALERTING_DDL } from "../../../../src/platform/shared/observability/slo-alerting-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { SloDefinition, SliRecord, AlertRule, AlertEvent } from "../../../../src/platform/shared/observability/slo-alerting/types.js";

// =============================================================================
// Test setup helpers
// =============================================================================

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SLO_ALERTING_DDL);
  return db;
}

function createMockDatabase(db: DatabaseSync): AuthoritativeSqlDatabase {
  return {
    backendType: "sqlite",
    connection: db,
    healthCheck: async () => true,
  } as unknown as AuthoritativeSqlDatabase;
}

// =============================================================================
// SLO Management
// =============================================================================

test("SloAlertingService defines and retrieves SLO", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "API Availability",
    description: "API should be available 99.9% of the time",
    sliKind: "availability",
    targetValue: 99.9,
    operator: "gte",
    windowMinutes: 60,
  });

  assert.ok(slo.id != null, "SLO should have an ID");
  assert.equal(slo.name, "API Availability");
  assert.equal(slo.sliKind, "availability");
  assert.equal(slo.targetValue, 99.9);
  assert.equal(slo.operator, "gte");
  assert.equal(slo.windowMinutes, 60);
  assert.equal(slo.status, "unknown");
});

test("SloAlertingService retrieves SLO by ID", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const created = service.defineSlo({
    name: "Test SLO",
    description: "Test description",
    sliKind: "error_rate",
    targetValue: 0.01,
    operator: "lte",
    windowMinutes: 30,
  });

  const retrieved = service.getSlo(created.id);
  assert.ok(retrieved != null, "SLO should be retrievable");
  assert.equal(retrieved!.name, "Test SLO");
  assert.equal(retrieved!.id, created.id);
});

test("SloAlertingService returns null for nonexistent SLO", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const result = service.getSlo("nonexistent_slo_id");
  assert.equal(result, null, "Should return null for nonexistent SLO");
});

test("SloAlertingService lists all SLOs", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  service.defineSlo({
    name: "SLO One",
    description: "",
    sliKind: "availability",
    targetValue: 99,
    operator: "gte",
    windowMinutes: 60,
  });

  service.defineSlo({
    name: "SLO Two",
    description: "",
    sliKind: "latency_p99",
    targetValue: 500,
    operator: "lte",
    windowMinutes: 60,
  });

  const slos = service.listSlos();
  assert.equal(slos.length, 2, "Should list all SLOs");
  assert.ok(slos.some((s) => s.name === "SLO One"), "Should include SLO One");
  assert.ok(slos.some((s) => s.name === "SLO Two"), "Should include SLO Two");
});

// =============================================================================
// SLI Collection
// =============================================================================

test("SloAlertingService collects SLI sample", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Latency SLO",
    description: "",
    sliKind: "latency_p99",
    targetValue: 500,
    operator: "lte",
    windowMinutes: 60,
  });

  const sli = service.collectSli(slo.id, 450, "ms");

  assert.ok(sli.id != null, "SLI should have an ID");
  assert.equal(sli.sloId, slo.id);
  assert.equal(sli.value, 450);
  assert.equal(sli.unit, "ms");
  assert.ok(sli.collectedAt != null, "Should have collectedAt timestamp");
});

test("SloAlertingService lists SLI samples", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Error Rate SLO",
    description: "",
    sliKind: "error_rate",
    targetValue: 0.01,
    operator: "lte",
    windowMinutes: 60,
  });

  service.collectSli(slo.id, 0.005, "%");
  service.collectSli(slo.id, 0.008, "%");
  service.collectSli(slo.id, 0.012, "%");

  const samples = service.listSliSamples(slo.id);
  assert.equal(samples.length, 3, "Should list all collected samples");
});

// =============================================================================
// SLO Evaluation
// =============================================================================

test("SloAlertingService evaluates SLO with met status", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Availability SLO",
    description: "",
    sliKind: "availability",
    targetValue: 80,
    operator: "gte",
    windowMinutes: 60,
  });

  // Average exceeds target by more than the 10% at-risk margin.
  service.collectSli(slo.id, 99.5, "%");
  service.collectSli(slo.id, 99.7, "%");
  service.collectSli(slo.id, 99.3, "%");

  const status = service.evaluateSlo(slo.id);
  assert.equal(status, "met", "SLO should be met when average exceeds target");
});

test("SloAlertingService evaluates SLO with breached status", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Low Availability SLO",
    description: "",
    sliKind: "availability",
    targetValue: 99,
    operator: "gte",
    windowMinutes: 60,
  });

  // Collect samples showing poor availability (95%)
  service.collectSli(slo.id, 95, "%");
  service.collectSli(slo.id, 94, "%");
  service.collectSli(slo.id, 96, "%");

  const status = service.evaluateSlo(slo.id);
  assert.equal(status, "breached", "SLO should be breached when average is below target");
});

test("SloAlertingService evaluates SLO with at_risk status near threshold", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Strict Availability SLO",
    description: "",
    sliKind: "availability",
    targetValue: 90,
    operator: "gte",
    windowMinutes: 60,
  });

  service.collectSli(slo.id, 95, "%");
  service.collectSli(slo.id, 95, "%");

  const status = service.evaluateSlo(slo.id);
  assert.equal(status, "at_risk", "SLO should be at_risk when within 10% of threshold");
});

test("SloAlertingService evaluates nonexistent SLO returns unknown", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const status = service.evaluateSlo("nonexistent_id");
  assert.equal(status, "unknown", "Should return unknown for nonexistent SLO");
});

test("SloAlertingService evaluates SLO with no samples returns unknown", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "No Samples SLO",
    description: "",
    sliKind: "availability",
    targetValue: 99,
    operator: "gte",
    windowMinutes: 60,
  });

  const status = service.evaluateSlo(slo.id);
  assert.equal(status, "unknown", "Should return unknown with no samples");
});

// =============================================================================
// Alert Rules
// =============================================================================

test("SloAlertingService defines alert rule", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Alert Rule Test SLO",
    description: "",
    sliKind: "error_rate",
    targetValue: 0.01,
    operator: "lte",
    windowMinutes: 60,
  });

  const rule = service.defineAlertRule({
    name: "High Error Rate Alert",
    sloId: slo.id,
    condition: "error_rate > 0.01",
    severity: "critical",
    channelKind: "pagerduty",
    channelConfig: JSON.stringify({ routingKey: "test_key" }),
    cooldownMinutes: 15,
    enabled: true,
  });

  assert.ok(rule.id != null, "Rule should have an ID");
  assert.equal(rule.name, "High Error Rate Alert");
  assert.equal(rule.sloId, slo.id);
  assert.equal(rule.severity, "critical");
  assert.equal(rule.channelKind, "pagerduty");
});

test("SloAlertingService lists alert rules", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  service.defineAlertRule({
    name: "Rule One",
    sloId: null,
    condition: "",
    severity: "warning",
    channelKind: "log",
    channelConfig: "{}",
    cooldownMinutes: 5,
    enabled: true,
  });

  service.defineAlertRule({
    name: "Rule Two",
    sloId: null,
    condition: "",
    severity: "critical",
    channelKind: "slack",
    channelConfig: "{}",
    cooldownMinutes: 10,
    enabled: true,
  });

  const rules = service.listAlertRules();
  assert.equal(rules.length, 2, "Should list all alert rules");
});

// =============================================================================
// Alert Events
// =============================================================================

test("SloAlertingService fires alert and creates event", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const rule = service.defineAlertRule({
    name: "Test Fire Alert",
    sloId: null,
    condition: "",
    severity: "critical",
    channelKind: "log",
    channelConfig: "{}",
    cooldownMinutes: 5,
    enabled: true,
  });

  const event = service.fireAlert(rule.id, "Critical Issue", "System is degraded");

  assert.ok(event != null, "Alert event should be created");
  assert.equal(event.ruleId, rule.id);
  assert.equal(event.title, "Critical Issue");
  assert.equal(event.detail, "System is degraded");
  assert.equal(event.status, "firing");
  assert.equal(event.severity, "critical");
});

test("SloAlertingService acknowledges firing alert", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const event = service.fireAlert("ack_test_rule", "Ack Test", "Testing ack");

  const result = service.acknowledgeAlert(event.id, "operator@example.com");
  assert.equal(result, true, "Acknowledge should succeed for firing alert");

  const events = service.listAlertEvents("acknowledged");
  assert.ok(events.some((e) => e.id === event.id), "Event should be acknowledged");
});

test("SloAlertingService resolves alert", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const event = service.fireAlert("resolve_test_rule", "Resolve Test", "Testing resolve");

  const result = service.resolveAlert(event.id);
  assert.equal(result, true, "Resolve should succeed");

  const events = service.listAlertEvents("resolved");
  assert.ok(events.some((e) => e.id === event.id), "Event should be resolved");
});

test("SloAlertingService lists alert events with status filter", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  service.fireAlert("filter_rule_1", "Alert 1", "Detail 1");
  service.fireAlert("filter_rule_2", "Alert 2", "Detail 2");

  const firingEvents = service.listAlertEvents("firing");
  assert.equal(firingEvents.length, 2, "Should list all firing events");
});

test("SloAlertingService lists alert events with limit", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  for (let i = 0; i < 10; i++) {
    service.fireAlert(`limit_rule_${i}`, `Alert ${i}`, `Detail ${i}`);
  }

  const events = service.listAlertEvents(undefined, 5);
  assert.equal(events.length, 5, "Should respect limit");
});

// =============================================================================
// Runbooks
// =============================================================================

test("SloAlertingService defines runbook", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const runbook = service.defineRunbook({
    name: "High Error Rate Runbook",
    description: "Steps to take when error rate is high",
    alertRuleId: null,
    steps: JSON.stringify([
      { action: "check_metrics", description: "Check error rate dashboard" },
      { action: "notify_team", description: "Notify on-call team" },
    ]),
    autoExecute: false,
  });

  assert.ok(runbook.id != null, "Runbook should have an ID");
  assert.equal(runbook.name, "High Error Rate Runbook");
  assert.equal(runbook.autoExecute, false);
});

test("SloAlertingService executes runbook", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const runbook = service.defineRunbook({
    name: "Test Runbook",
    description: "",
    alertRuleId: null,
    steps: JSON.stringify([{ action: "test" }]),
    autoExecute: false,
  });

  const execution = service.executeRunbook(runbook.id, null, "test-user");

  assert.ok(execution.id != null, "Execution should have an ID");
  assert.equal(execution.runbookId, runbook.id);
  assert.equal(execution.status, "completed");
  assert.equal(execution.executedBy, "test-user");
  assert.ok(execution.completedAt != null, "Should have completedAt");
});

test("SloAlertingService lists runbook executions", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const runbook = service.defineRunbook({
    name: "List Executions Runbook",
    description: "",
    alertRuleId: null,
    steps: JSON.stringify([]),
    autoExecute: false,
  });

  service.executeRunbook(runbook.id, null, "user1");
  service.executeRunbook(runbook.id, null, "user2");

  const executions = service.listRunbookExecutions(runbook.id);
  assert.equal(executions.length, 2, "Should list all executions");
});

// =============================================================================
// Summary
// =============================================================================

test("SloAlertingService summary returns correct counts", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Summary Test SLO",
    description: "",
    sliKind: "availability",
    targetValue: 99,
    operator: "gte",
    windowMinutes: 60,
  });
  service.collectSli(slo.id, 95, "%"); // Breached
  service.evaluateSlo(slo.id);

  service.defineAlertRule({
    name: "Summary Alert Rule",
    sloId: null,
    condition: "",
    severity: "warning",
    channelKind: "log",
    channelConfig: "{}",
    cooldownMinutes: 5,
    enabled: true,
  });

  service.fireAlert("summary_rule", "Summary Test", "Testing summary");

  const summary = service.summary();
  assert.equal(summary.sloCount, 1, "Should count 1 SLO");
  assert.equal(summary.breachedCount, 1, "Should count 1 breached SLO");
  assert.equal(summary.firingAlertCount, 1, "Should count 1 firing alert");
});

// =============================================================================
// Burn Rate
// =============================================================================

test("SloAlertingService computes burn rate for gte operator", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Availability Burn Rate",
    description: "",
    sliKind: "availability",
    targetValue: 99,
    operator: "gte",
    windowMinutes: 60,
  });

  // Error budget = 100 - 99 = 1%
  // Actual: 97% availability, so error budget consumed = 3%
  // Burn rate = 3 / 1 = 3 (fast burn)
  service.collectSli(slo.id, 97, "%");

  const burnRate = service.computeBurnRate(slo.id, 60 * 60 * 1000);
  assert.ok(burnRate > 0, "Burn rate should be positive");
});

test("SloAlertingService computes zero burn rate with no samples", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "No Samples Burn Rate",
    description: "",
    sliKind: "availability",
    targetValue: 99,
    operator: "gte",
    windowMinutes: 60,
  });

  const burnRate = service.computeBurnRate(slo.id, 60 * 60 * 1000);
  assert.equal(burnRate, 0, "Burn rate should be 0 with no samples");
});

test("SloAlertingService computes zero burn rate for nonexistent SLO", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const burnRate = service.computeBurnRate("nonexistent", 60 * 60 * 1000);
  assert.equal(burnRate, 0, "Burn rate should be 0 for nonexistent SLO");
});

// =============================================================================
// Error Budget Degradation
// =============================================================================

test("SloAlertingService triggerErrorBudgetDegradation returns not degraded when SLO met", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Good SLO",
    description: "",
    sliKind: "availability",
    targetValue: 80,
    operator: "gte",
    windowMinutes: 60,
  });

  service.collectSli(slo.id, 99.5, "%");

  const result = service.triggerErrorBudgetDegradation(slo.id);
  assert.equal(result.degraded, false, "Should not degrade when SLO is met");
  assert.equal(result.sloStatus, "met");
  assert.equal(result.alertFired, false);
});

test("SloAlertingService triggerErrorBudgetDegradation degrades when SLO breached", () => {
  const db = createTestDb();
  const mockDb = createMockDatabase(db);
  const service = new SloAlertingService(mockDb);

  const slo = service.defineSlo({
    name: "Breached SLO",
    description: "",
    sliKind: "availability",
    targetValue: 99,
    operator: "gte",
    windowMinutes: 60,
  });

  service.collectSli(slo.id, 95, "%");

  const result = service.triggerErrorBudgetDegradation(slo.id);
  assert.equal(result.degraded, true, "Should degrade when SLO is breached");
  assert.equal(result.sloStatus, "breached");
  assert.equal(result.rolloutFrozen, true, "Should freeze rollouts");
  assert.equal(result.alertFired, true, "Should fire alert");
  assert.ok(result.alertId != null, "Should have alert ID");
});

/**
 * SloAlertingService Integration Tests
 *
 * Tests for SloAlertingService with real database,
 * SLO definitions, SLI collection, alert rules, and event firing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import {
  SLO_ALERTING_DDL,
  SloAlertingService,
  type SliKind,
  type SloDefinition,
  type AlertRule,
} from "../../../../src/platform/shared/observability/slo-alerting-service.js";

// =============================================================================
// SloAlertingService with real database
// =============================================================================

test("SloAlertingService records SLI sample and queries it back", () => {
  const ctx = createIntegrationContext("aa-slo-sli-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);
    const now = new Date().toISOString();

    // Create an SLO first
    const slo = service.createSloDefinition({
      name: "Test Availability SLO",
      description: "Tests availability requirement",
      sliKind: "availability",
      targetValue: 0.99,
      operator: "gte",
      windowMinutes: 60,
    });

    // Record SLI sample
    service.recordSliSample({
      sloId: slo.id,
      kind: "availability",
      value: 0.995,
      unit: "ratio",
      collectedAt: now,
    });

    // Query samples
    const samples = service.querySliSamples(slo.id, { limit: 10 });

    assert.ok(samples.length >= 1, "Should have at least one sample");
    assert.equal(samples[0].sloId, slo.id);
    assert.equal(samples[0].value, 0.995);
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService createSloDefinition creates and stores SLO", () => {
  const ctx = createIntegrationContext("aa-slo-create-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);

    const slo = service.createSloDefinition({
      name: "Latency SLO",
      description: "P95 latency must be under 500ms",
      sliKind: "latency_p95",
      targetValue: 500,
      operator: "lte",
      windowMinutes: 30,
    });

    assert.ok(slo.id != null, "SLO should have an ID");
    assert.equal(slo.name, "Latency SLO");
    assert.equal(slo.sliKind, "latency_p95");
    assert.equal(slo.targetValue, 500);
    assert.equal(slo.operator, "lte");
    assert.equal(slo.windowMinutes, 30);
    assert.equal(slo.status, "unknown");

    // Verify persisted
    const retrieved = service.getSloDefinition(slo.id);
    assert.ok(retrieved != null, "SLO should be retrievable");
    assert.equal(retrieved.name, "Latency SLO");
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService createAlertRule creates and retrieves rule", () => {
  const ctx = createIntegrationContext("aa-slo-alert-rule-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);

    // Create SLO first
    const slo = service.createSloDefinition({
      name: "Error Rate SLO",
      description: "Error rate must be under 1%",
      sliKind: "error_rate",
      targetValue: 0.01,
      operator: "lte",
      windowMinutes: 60,
    });

    // Create alert rule
    const rule = service.createAlertRule({
      name: "Error Rate Breach Alert",
      sloId: slo.id,
      condition: "error_rate > 0.01",
      severity: "critical",
      channelKind: "log",
      cooldownMinutes: 15,
    });

    assert.ok(rule.id != null, "Rule should have an ID");
    assert.equal(rule.name, "Error Rate Breach Alert");
    assert.equal(rule.sloId, slo.id);
    assert.equal(rule.severity, "critical");
    assert.equal(rule.channelKind, "log");
    assert.equal(rule.cooldownMinutes, 15);
    assert.equal(rule.enabled, true);

    // Verify persisted
    const retrieved = service.getAlertRule(rule.id);
    assert.ok(retrieved != null, "Rule should be retrievable");
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService evaluateSlo returns correct status", () => {
  const ctx = createIntegrationContext("aa-slo-evaluate-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);
    const now = new Date().toISOString();

    // Create SLO
    const slo = service.createSloDefinition({
      name: "Eval SLO",
      description: "Test evaluation",
      sliKind: "availability",
      targetValue: 0.95,
      operator: "gte",
      windowMinutes: 60,
    });

    // Add good samples (meets SLO)
    for (let i = 0; i < 10; i++) {
      service.recordSliSample({
        sloId: slo.id,
        kind: "availability",
        value: 0.99,
        unit: "ratio",
        collectedAt: new Date(Date.now() - i * 60000).toISOString(),
      });
    }

    // Evaluate
    const result = service.evaluateSlo(slo.id);

    assert.ok(result != null, "Should return evaluation result");
    assert.equal(result.sloId, slo.id);
    assert.equal(result.status, "met", "High availability should meet 0.95 target");

    // Now add bad samples
    for (let i = 0; i < 10; i++) {
      service.recordSliSample({
        sloId: slo.id,
        kind: "availability",
        value: 0.90,
        unit: "ratio",
        collectedAt: new Date(Date.now() - i * 60000 - 7200000).toISOString(),
      });
    }

    const result2 = service.evaluateSlo(slo.id);
    assert.ok(result2.status === "at_risk" || result2.status === "breached", "Low availability should be at risk or breached");
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService fireAlert creates alert event", () => {
  const ctx = createIntegrationContext("aa-slo-fire-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);

    // Create SLO and rule
    const slo = service.createSloDefinition({
      name: "Fire Test SLO",
      description: "Test fire alert",
      sliKind: "error_rate",
      targetValue: 0.01,
      operator: "lte",
      windowMinutes: 30,
    });

    const rule = service.createAlertRule({
      name: "Fire Test Rule",
      sloId: slo.id,
      condition: "error_rate > 0.01",
      severity: "warning",
      channelKind: "log",
      cooldownMinutes: 5,
    });

    // Fire alert
    const alertEvent = service.fireAlert(rule.id, "Error rate elevated", "Error rate is 2.5%");

    assert.ok(alertEvent != null, "Should return alert event");
    assert.equal(alertEvent.ruleId, rule.id);
    assert.equal(alertEvent.title, "Error rate elevated");
    assert.equal(alertEvent.status, "firing");

    // Verify in database
    const retrieved = service.getAlertEvent(alertEvent.id);
    assert.ok(retrieved != null, "Alert should be in database");
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService getAlertEvents returns firing alerts", () => {
  const ctx = createIntegrationContext("aa-slo-alerts-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);

    // Create SLO and rules
    const slo = service.createSloDefinition({
      name: "Multi Alert SLO",
      description: "Test multiple alerts",
      sliKind: "latency_p95",
      targetValue: 500,
      operator: "lte",
      windowMinutes: 60,
    });

    const rule = service.createAlertRule({
      name: "Multi Alert Rule",
      sloId: slo.id,
      condition: "latency_p95 > 500",
      severity: "critical",
      channelKind: "log",
      cooldownMinutes: 10,
    });

    // Fire multiple alerts
    service.fireAlert(rule.id, "Latency Alert 1", "P95 latency is 600ms");
    service.fireAlert(rule.id, "Latency Alert 2", "P95 latency is 700ms");

    const firingAlerts = service.getAlertEvents({ status: "firing" });

    assert.ok(firingAlerts.length >= 2, "Should have multiple firing alerts");
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService resolveAlert updates alert status", () => {
  const ctx = createIntegrationContext("aa-slo-resolve-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);

    const slo = service.createSloDefinition({
      name: "Resolve Test SLO",
      description: "Test resolve",
      sliKind: "availability",
      targetValue: 0.99,
      operator: "gte",
      windowMinutes: 60,
    });

    const rule = service.createAlertRule({
      name: "Resolve Test Rule",
      sloId: slo.id,
      condition: "availability < 0.99",
      severity: "warning",
      channelKind: "log",
      cooldownMinutes: 5,
    });

    const alertEvent = service.fireAlert(rule.id, "Availability Low", "Availability dropped to 95%");

    // Resolve
    service.resolveAlert(alertEvent.id);

    const resolved = service.getAlertEvent(alertEvent.id);
    assert.ok(resolved != null);
    assert.equal(resolved.status, "resolved");
    assert.ok(resolved.resolvedAt != null, "Should have resolved_at timestamp");
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService listSloDefinitions returns all SLOs", () => {
  const ctx = createIntegrationContext("aa-slo-list-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);

    // Create multiple SLOs
    service.createSloDefinition({
      name: "SLO One",
      description: "First SLO",
      sliKind: "availability",
      targetValue: 0.99,
      operator: "gte",
      windowMinutes: 60,
    });

    service.createSloDefinition({
      name: "SLO Two",
      description: "Second SLO",
      sliKind: "latency_p95",
      targetValue: 500,
      operator: "lte",
      windowMinutes: 30,
    });

    const slos = service.listSloDefinitions();

    assert.ok(slos.length >= 2, "Should have at least 2 SLOs");
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService listAlertRules returns all rules", () => {
  const ctx = createIntegrationContext("aa-slo-list-rules-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);

    const slo = service.createSloDefinition({
      name: "Rules List SLO",
      description: "Test",
      sliKind: "error_rate",
      targetValue: 0.01,
      operator: "lte",
      windowMinutes: 60,
    });

    service.createAlertRule({
      name: "Rule One",
      sloId: slo.id,
      condition: "error_rate > 0.01",
      severity: "warning",
      channelKind: "log",
      cooldownMinutes: 5,
    });

    service.createAlertRule({
      name: "Rule Two",
      sloId: slo.id,
      condition: "error_rate > 0.05",
      severity: "critical",
      channelKind: "webhook",
      cooldownMinutes: 10,
    });

    const rules = service.listAlertRules();

    assert.ok(rules.length >= 2, "Should have at least 2 rules");
  } finally {
    ctx.cleanup();
  }
});

test("SloAlertingService evaluates multiple SLI kinds correctly", () => {
  const ctx = createIntegrationContext("aa-slo-kinds-");

  try {
    ctx.db.connection.exec(SLO_ALERTING_DDL);
    const service = new SloAlertingService(ctx.db);
    const now = new Date().toISOString();

    // Test latency SLI
    const latencySlo = service.createSloDefinition({
      name: "Latency P95",
      description: "P95 latency",
      sliKind: "latency_p95",
      targetValue: 500,
      operator: "lte",
      windowMinutes: 15,
    });

    service.recordSliSample({
      sloId: latencySlo.id,
      kind: "latency_p95",
      value: 450,
      unit: "ms",
      collectedAt: now,
    });

    const latencyResult = service.evaluateSlo(latencySlo.id);
    assert.equal(latencyResult.status, "met", "450ms should meet 500ms target");

    // Test error_rate SLI
    const errorSlo = service.createSloDefinition({
      name: "Error Rate",
      description: "Error rate",
      sliKind: "error_rate",
      targetValue: 0.05,
      operator: "lte",
      windowMinutes: 60,
    });

    service.recordSliSample({
      sloId: errorSlo.id,
      kind: "error_rate",
      value: 0.03,
      unit: "ratio",
      collectedAt: now,
    });

    const errorResult = service.evaluateSlo(errorSlo.id);
    assert.equal(errorResult.status, "met", "3% should meet 5% target");
  } finally {
    ctx.cleanup();
  }
});

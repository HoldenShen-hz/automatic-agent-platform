/**
 * Integration tests for Severity Types across modules
 *
 * @see src/platform/contracts/types/unified-severity.ts
 * @see src/platform/contracts/types/anomaly-event-classification.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  anomalySeverityToUnifiedSeverity,
  alertSeverityToUnifiedSeverity,
  runbookSeverityToUnifiedSeverity,
  diagnosticSeverityToUnifiedSeverity,
  UNIFIED_SEVERITY_SLA,
  type UnifiedSeverity,
} from "../../../src/platform/contracts/types/unified-severity.js";
import {
  classifyAnomalyEvent,
  type ObservabilitySeverity,
  type AlertingSeverity,
  type RunbookSeverity,
  type DiagnosticSeverity,
} from "../../../src/platform/contracts/types/anomaly-event-classification.js";
import { newId } from "../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// Severity Mapping Consistency Across All Conversion Functions
// ─────────────────────────────────────────────────────────────────────────────

test("integration: all severity types map to unified severity correctly", () => {
  // emergency maps to SEV1 across all types
  assert.strictEqual(anomalySeverityToUnifiedSeverity("emergency"), "SEV1");
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("emergency"), "SEV1");

  // critical maps to SEV2 across all types
  assert.strictEqual(anomalySeverityToUnifiedSeverity("critical"), "SEV2");
  assert.strictEqual(alertSeverityToUnifiedSeverity("critical"), "SEV2");
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("critical"), "SEV2");

  // warning maps to SEV3 across all types
  assert.strictEqual(anomalySeverityToUnifiedSeverity("warning"), "SEV3");
  assert.strictEqual(alertSeverityToUnifiedSeverity("warning"), "SEV3");
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("warning"), "SEV3");

  // info maps to SEV4 across all types
  assert.strictEqual(anomalySeverityToUnifiedSeverity("info"), "SEV4");
  assert.strictEqual(alertSeverityToUnifiedSeverity("info"), "SEV4");
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("info"), "SEV4");
});

test("integration: runbook severity maps correctly", () => {
  assert.strictEqual(runbookSeverityToUnifiedSeverity("P0"), "SEV1");
  assert.strictEqual(runbookSeverityToUnifiedSeverity("P1"), "SEV2");
  assert.strictEqual(runbookSeverityToUnifiedSeverity("P2"), "SEV3");
  assert.strictEqual(runbookSeverityToUnifiedSeverity("P3"), "SEV4");
});

test("integration: alerting page maps to SEV1 (highest priority)", () => {
  assert.strictEqual(alertSeverityToUnifiedSeverity("page"), "SEV1");
});

// ─────────────────────────────────────────────────────────────────────────────
// Severity Mapping with Anomaly Classification
// ─────────────────────────────────────────────────────────────────────────────

test("integration: anomaly classification uses severity conversion", () => {
  const event1 = classifyAnomalyEvent({
    metricName: "auth_failure_rate",
    legacySeverity: "emergency",
  });
  assert.strictEqual(event1.unifiedSeverity, "SEV1");

  const event2 = classifyAnomalyEvent({
    metricName: "cpu_usage",
    legacySeverity: "critical",
  });
  assert.strictEqual(event2.unifiedSeverity, "SEV2");

  const event3 = classifyAnomalyEvent({
    metricName: "memory_usage",
    legacySeverity: "warning",
  });
  assert.strictEqual(event3.unifiedSeverity, "SEV3");

  const event4 = classifyAnomalyEvent({
    metricName: "debug_log_count",
    legacySeverity: "info",
  });
  assert.strictEqual(event4.unifiedSeverity, "SEV4");
});

test("integration: different anomaly classes can share same severity", () => {
  const securityEvent = classifyAnomalyEvent({
    metricName: "auth_failure_rate",
    legacySeverity: "critical",
  });
  const execEvent = classifyAnomalyEvent({
    metricName: "workflow_timeout",
    legacySeverity: "critical",
  });

  assert.strictEqual(securityEvent.unifiedSeverity, "SEV2");
  assert.strictEqual(execEvent.unifiedSeverity, "SEV2");
  assert.notStrictEqual(securityEvent.anomalyEventClass, execEvent.anomalyEventClass);
});

// ─────────────────────────────────────────────────────────────────────────────
// Severity with SLA Information
// ─────────────────────────────────────────────────────────────────────────────

test("integration: unified severity has correct SLA for SEV1", () => {
  const sev1 = UNIFIED_SEVERITY_SLA["SEV1"];
  assert.strictEqual(sev1.acknowledgeWithinMinutes, 5);
  assert.strictEqual(sev1.mitigateWithinMinutes, 30);
});

test("integration: SEV1 SLA is most urgent", () => {
  const sev1 = UNIFIED_SEVERITY_SLA["SEV1"];
  const sev2 = UNIFIED_SEVERITY_SLA["SEV2"];
  const sev3 = UNIFIED_SEVERITY_SLA["SEV3"];
  const sev4 = UNIFIED_SEVERITY_SLA["SEV4"];

  // SEV1 has fastest response
  assert.ok(sev1.acknowledgeWithinMinutes < sev2.acknowledgeWithinMinutes);
  assert.ok(sev1.mitigateWithinMinutes < sev2.mitigateWithinMinutes);

  // Each level is progressively slower
  assert.ok(sev2.acknowledgeWithinMinutes < sev3.acknowledgeWithinMinutes);
  assert.ok(sev3.acknowledgeWithinMinutes < sev4.acknowledgeWithinMinutes);
});

test("integration: severity determines owner expectation", () => {
  const sev1 = UNIFIED_SEVERITY_SLA["SEV1"];
  const sev4 = UNIFIED_SEVERITY_SLA["SEV4"];

  assert.strictEqual(sev1.ownerExpectation, "page_immediately");
  assert.strictEqual(sev4.ownerExpectation, "business_hours_follow_up");
});

// ─────────────────────────────────────────────────────────────────────────────
// Severity in Event Processing Pipeline
// ─────────────────────────────────────────────────────────────────────────────

test("integration: severity flows through event classification correctly", () => {
  // Simulate processing events with different severities
  const events = [
    { metricName: "auth_breach_attempt", legacySeverity: "emergency" as ObservabilitySeverity },
    { metricName: "api_latency_spike", legacySeverity: "critical" as ObservabilitySeverity },
    { metricName: "disk_space_warning", legacySeverity: "warning" as ObservabilitySeverity },
    { metricName: "debug_log_volume", legacySeverity: "info" as ObservabilitySeverity },
  ];

  const results = events.map((e) => classifyAnomalyEvent(e));

  // Verify severity escalation
  assert.strictEqual(results[0].unifiedSeverity, "SEV1");
  assert.strictEqual(results[1].unifiedSeverity, "SEV2");
  assert.strictEqual(results[2].unifiedSeverity, "SEV3");
  assert.strictEqual(results[3].unifiedSeverity, "SEV4");
});

test("integration: multiple events can be processed with consistent severity", () => {
  const events = [
    { metricName: "rate_limit_hit", legacySeverity: "warning" as ObservabilitySeverity },
    { metricName: "another_rate_limit_hit", legacySeverity: "warning" as ObservabilitySeverity },
    { metricName: "third_rate_limit_hit", legacySeverity: "warning" as ObservabilitySeverity },
  ];

  const results = events.map((e) => classifyAnomalyEvent(e));

  // All should have same severity
  for (const result of results) {
    assert.strictEqual(result.unifiedSeverity, "SEV3");
    assert.strictEqual(result.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Module Type Usage
// ─────────────────────────────────────────────────────────────────────────────

test("integration: unified severity can be used in record creation", () => {
  const record = {
    id: newId("sev"),
    severity: "SEV1" as UnifiedSeverity,
    acknowledgedAt: null as string | null,
    resolvedAt: null as string | null,
  };

  assert.ok(UNIFIED_SEVERITY_SLA[record.severity]);
  const sla = UNIFIED_SEVERITY_SLA[record.severity];
  assert.strictEqual(sla.acknowledgeWithinMinutes, 5);
});

test("integration: alert severity can be converted and used", () => {
  const alertSeverity: AlertingSeverity = "page";
  const unified = alertSeverityToUnifiedSeverity(alertSeverity);

  assert.ok(UNIFIED_SEVERITY_SLA[unified]);
  const sla = UNIFIED_SEVERITY_SLA[unified];
  assert.strictEqual(sla.ownerExpectation, "page_immediately");
});

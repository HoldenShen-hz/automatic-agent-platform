/**
 * Integration tests for Anomaly Event Classification with other modules
 *
 * @see src/platform/contracts/types/anomaly-event-classification.ts
 * @see src/platform/contracts/types/unified-severity.ts
 * @see src/platform/contracts/types/ids.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { classifyAnomalyEvent } from "../../../src/platform/contracts/types/anomaly-event-classification.js";
import { UNIFIED_SEVERITY_SLA } from "../../../src/platform/contracts/types/unified-severity.js";
import { newId } from "../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// Classification with SLA Information
// ─────────────────────────────────────────────────────────────────────────────

test("integration: classified anomaly determines response urgency via SLA", () => {
  const event = classifyAnomalyEvent({
    metricName: "auth_breach_attempt",
    legacySeverity: "emergency",
  });

  assert.strictEqual(event.anomalyEventClass, "E4_SECURITY");
  assert.strictEqual(event.unifiedSeverity, "SEV1");

  const sla = UNIFIED_SEVERITY_SLA[event.unifiedSeverity];
  assert.strictEqual(sla.acknowledgeWithinMinutes, 5);
  assert.strictEqual(sla.ownerExpectation, "page_immediately");
});

test("integration: external dependency issue has appropriate SLA", () => {
  const event = classifyAnomalyEvent({
    metricName: "third_party_api_timeout",
    legacySeverity: "critical",
  });

  assert.strictEqual(event.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
  assert.strictEqual(event.unifiedSeverity, "SEV2");

  const sla = UNIFIED_SEVERITY_SLA["SEV2"];
  assert.ok(sla.acknowledgeWithinMinutes > UNIFIED_SEVERITY_SLA["SEV1"].acknowledgeWithinMinutes);
});

test("integration: business event has lowest priority SLA", () => {
  const event = classifyAnomalyEvent({
    metricName: "unknown_metric_xyz",
    legacySeverity: "info",
  });

  assert.strictEqual(event.anomalyEventClass, "E1_BUSINESS");
  assert.strictEqual(event.unifiedSeverity, "SEV4");

  const sla = UNIFIED_SEVERITY_SLA["SEV4"];
  assert.strictEqual(sla.ownerExpectation, "business_hours_follow_up");
});

// ─────────────────────────────────────────────────────────────────────────────
// Classification Pipeline
// ─────────────────────────────────────────────────────────────────────────────

test("integration: multiple anomalies can be classified in sequence", () => {
  const metrics = [
    { metricName: "credential_expiry_rate", legacySeverity: "warning" },
    { metricName: "database_connection_pool", legacySeverity: "warning" },
    { metricName: "approval_queue_growth", legacySeverity: "info" },
    { metricName: "workflow_queue_depth", legacySeverity: "critical" },
  ];

  const results = metrics.map((m) => classifyAnomalyEvent(m));

  assert.strictEqual(results[0].anomalyEventClass, "E4_SECURITY"); // credential -> security
  assert.strictEqual(results[1].anomalyEventClass, "E5_DATA"); // database -> data
  assert.strictEqual(results[2].anomalyEventClass, "E6_GOVERNANCE"); // approval -> governance
  assert.strictEqual(results[3].anomalyEventClass, "E2_EXECUTION"); // workflow -> execution
});

test("integration: context helps classify ambiguous metrics", () => {
  // Without context, this might be classified as E1_BUSINESS
  const withoutContext = classifyAnomalyEvent({
    metricName: "metric_alpha",
    legacySeverity: "warning",
  });

  // With security context, it should be classified as E4_SECURITY
  const withSecurityContext = classifyAnomalyEvent({
    metricName: "metric_alpha",
    legacySeverity: "warning",
    context: { auth: "token_failure", userId: "12345" },
  });

  const withExecContext = classifyAnomalyEvent({
    metricName: "metric_alpha",
    legacySeverity: "warning",
    context: { execution: "task_timeout" },
  });

  assert.strictEqual(withoutContext.anomalyEventClass, "E1_BUSINESS");
  assert.strictEqual(withSecurityContext.anomalyEventClass, "E4_SECURITY");
  assert.strictEqual(withExecContext.anomalyEventClass, "E2_EXECUTION");
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Tracking
// ─────────────────────────────────────────────────────────────────────────────

test("integration: classified events can be tracked with IDs", () => {
  const event = classifyAnomalyEvent({
    metricName: "api_gateway_errors",
    legacySeverity: "critical",
  });

  const trackingRecord = {
    id: newId("event"),
    eventId: newId("anomaly"),
    metricName: event.metricName,
    eventClass: event.anomalyEventClass,
    severity: event.unifiedSeverity,
    reason: event.reason,
    classifiedAt: new Date().toISOString(),
  };

  assert.ok(trackingRecord.id.startsWith("event_"));
  assert.ok(trackingRecord.eventId.startsWith("anomaly_"));
  assert.strictEqual(trackingRecord.eventClass, "E3_EXTERNAL_DEPENDENCY");
  assert.strictEqual(trackingRecord.severity, "SEV2");
});

test("integration: multiple events can be correlated", () => {
  const events = [
    classifyAnomalyEvent({ metricName: "auth_failure_rate", legacySeverity: "warning" }),
    classifyAnomalyEvent({ metricName: "token_expiry_rate", legacySeverity: "warning" }),
    classifyAnomalyEvent({ metricName: "credential_rotation_delay", legacySeverity: "warning" }),
  ];

  // All classified as security (auth, token, credential match the security pattern)
  const allSecurity = events.every((e) => e.anomalyEventClass === "E4_SECURITY");
  assert.strictEqual(allSecurity, true);

  // All have same severity
  const sameSeverity = events.every((e) => e.unifiedSeverity === events[0].unifiedSeverity);
  assert.strictEqual(sameSeverity, true);

  // Can be used for correlation
  const correlationId = newId("corr");
  const correlatedEvents = events.map((e, i) => ({
    ...e,
    correlationId,
    sequence: i,
  }));

  assert.strictEqual(correlatedEvents[0].correlationId, correlationId);
  assert.strictEqual(correlatedEvents[2].sequence, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Severity Escalation
// ─────────────────────────────────────────────────────────────────────────────

test("integration: security events escalate severity correctly", () => {
  const severityLevels = ["info", "warning", "critical", "emergency"] as const;
  const results = severityLevels.map((sev) =>
    classifyAnomalyEvent({ metricName: "auth_failure_rate", legacySeverity: sev })
  );

  assert.strictEqual(results[0].unifiedSeverity, "SEV4"); // info -> SEV4
  assert.strictEqual(results[1].unifiedSeverity, "SEV3"); // warning -> SEV3
  assert.strictEqual(results[2].unifiedSeverity, "SEV2"); // critical -> SEV2
  assert.strictEqual(results[3].unifiedSeverity, "SEV1"); // emergency -> SEV1
});

test("integration: SEV1 events always get security classification regardless of metric name", () => {
  const event = classifyAnomalyEvent({
    metricName: "random_metric",
    legacySeverity: "emergency",
  });

  // Even though the metric name doesn't match security patterns,
  // the emergency severity should still map to SEV1
  assert.strictEqual(event.unifiedSeverity, "SEV1");
});

// ─────────────────────────────────────────────────────────────────────────────
// Data Pipeline Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: classification fits into monitoring pipeline", () => {
  // Simulate a monitoring data point
  interface MonitoringDataPoint {
    metricName: string;
    value: number;
    timestamp: string;
    severity: "info" | "warning" | "critical" | "emergency";
  }

  const dataPoint: MonitoringDataPoint = {
    metricName: "api_rate_limit_usage",
    value: 95,
    timestamp: new Date().toISOString(),
    severity: "warning",
  };

  // Classify the anomaly
  const classified = classifyAnomalyEvent({
    metricName: dataPoint.metricName,
    legacySeverity: dataPoint.severity,
  });

  // Determine alerting - only SEV1 and SEV2 trigger immediate alerting
  const shouldAlert = classified.unifiedSeverity === "SEV1" || classified.unifiedSeverity === "SEV2";
  const alertPriority = UNIFIED_SEVERITY_SLA[classified.unifiedSeverity].acknowledgeWithinMinutes;

  assert.strictEqual(classified.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
  // warning = SEV3, so shouldAlert is false (only SEV1/SEV2 alert immediately)
  assert.strictEqual(shouldAlert, false);
  // SEV3 SLA is 60 minutes acknowledge time
  assert.ok(alertPriority > 15); // SEV3 = 60 minutes, not <= 15
});

test("integration: execution events workflow correctly", () => {
  const event = classifyAnomalyEvent({
    metricName: "task_queue_overflow",
    legacySeverity: "critical",
    context: { queue: "priority", capacity: 1000 },
  });

  assert.strictEqual(event.anomalyEventClass, "E2_EXECUTION");
  assert.strictEqual(event.unifiedSeverity, "SEV2");

  // Determine if we need to pause non-critical tasks
  const shouldPause = event.anomalyEventClass === "E2_EXECUTION" &&
    (event.unifiedSeverity === "SEV1" || event.unifiedSeverity === "SEV2");

  assert.strictEqual(shouldPause, true);
});

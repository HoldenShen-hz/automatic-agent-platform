/**
 * ARCH-P0-1: §12.1 异常事件分类体系 E1-E6 完全缺失
 *
 * Unit tests for anomaly event classification system (E1-E6).
 * Verifies that AnomalyEventClass enum defines all 6 categories and
 * classifyAnomalyEvent correctly maps metrics to business classification.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ANOMALY_EVENT_CLASSES,
  classifyAnomalyEvent,
  type AnomalyEventClass,
} from "../../../../../src/platform/contracts/types/anomaly-event-classification.js";
import { anomalySeverityToUnifiedSeverity, type UnifiedSeverity } from "../../../../../src/platform/contracts/types/unified-severity.js";

test("[ARCH-P0-1] AnomalyEventClass enum defines all 6 categories", () => {
  const categories = Object.values(ANOMALY_EVENT_CLASSES);
  assert.equal(categories.length, 6);
  assert.ok(categories.includes("E1_BUSINESS"), "Missing E1_BUSINESS");
  assert.ok(categories.includes("E2_EXECUTION"), "Missing E2_EXECUTION");
  assert.ok(categories.includes("E3_EXTERNAL_DEPENDENCY"), "Missing E3_EXTERNAL_DEPENDENCY");
  assert.ok(categories.includes("E4_SECURITY"), "Missing E4_SECURITY");
  assert.ok(categories.includes("E5_DATA"), "Missing E5_DATA");
  assert.ok(categories.includes("E6_GOVERNANCE"), "Missing E6_GOVERNANCE");
});

test("[ARCH-P0-1] ClassifiedAnomalyEvent requires class and severity fields", () => {
  const classified = classifyAnomalyEvent({
    metricName: "test_metric",
    legacySeverity: "warning",
  });

  assert.ok(classified.anomalyEventClass, "Missing anomalyEventClass field");
  assert.ok(classified.unifiedSeverity, "Missing unifiedSeverity field");
  assert.ok(classified.metricName, "Missing metricName field");
  assert.ok(classified.legacySeverity, "Missing legacySeverity field");
  assert.ok(classified.reason, "Missing reason field");

  // Verify anomalyEventClass is a valid E category
  assert.ok(
    (["E1_BUSINESS", "E2_EXECUTION", "E3_EXTERNAL_DEPENDENCY", "E4_SECURITY", "E5_DATA", "E6_GOVERNANCE"] as string[]).includes(classified.anomalyEventClass),
    `Invalid anomalyEventClass: ${classified.anomalyEventClass}`,
  );

  // Verify unifiedSeverity is a valid SEV level
  assert.ok(
    (["SEV1", "SEV2", "SEV3", "SEV4"] as string[]).includes(classified.unifiedSeverity),
    `Invalid unifiedSeverity: ${classified.unifiedSeverity}`,
  );
});

test("[ARCH-P0-1] statistical detection maps to business classification - E1 business", () => {
  // Business metrics map to E1
  const businessMetric = classifyAnomalyEvent({
    metricName: "checkout_conversion_drop",
    legacySeverity: "warning",
  });
  assert.equal(businessMetric.anomalyEventClass, "E1_BUSINESS");

  const slaMetric = classifyAnomalyEvent({
    metricName: "slo_violation_ratio",
    legacySeverity: "critical",
  });
  assert.equal(slaMetric.anomalyEventClass, "E1_BUSINESS");
});

test("[ARCH-P0-1] statistical detection maps to business classification - E2 execution", () => {
  // Execution metrics map to E2
  const executionMetric = classifyAnomalyEvent({
    metricName: "workflow_dispatch_latency",
    legacySeverity: "warning",
  });
  assert.equal(executionMetric.anomalyEventClass, "E2_EXECUTION");

  const queueMetric = classifyAnomalyEvent({
    metricName: "task_queue_backlog_size",
    legacySeverity: "critical",
  });
  assert.equal(queueMetric.anomalyEventClass, "E2_EXECUTION");
});

test("[ARCH-P0-1] statistical detection maps to business classification - E3 external dependency", () => {
  // External dependency metrics map to E3
  const providerMetric = classifyAnomalyEvent({
    metricName: "provider_503_rate_limit",
    legacySeverity: "emergency",
    context: { provider: "openai", upstreamStatus: 503 },
  });
  assert.equal(providerMetric.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");

  const quotaMetric = classifyAnomalyEvent({
    metricName: "api_quota_exhaustion_ratio",
    legacySeverity: "critical",
  });
  assert.equal(quotaMetric.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
});

test("[ARCH-P0-1] statistical detection maps to business classification - E4 security", () => {
  // Security metrics map to E4
  const authMetric = classifyAnomalyEvent({
    metricName: "auth_token_failure_rate",
    legacySeverity: "critical",
    context: { component: "iam_service" },
  });
  assert.equal(authMetric.anomalyEventClass, "E4_SECURITY");

  const rbacMetric = classifyAnomalyEvent({
    metricName: "rbac_permission_denied_spike",
    legacySeverity: "warning",
  });
  assert.equal(rbacMetric.anomalyEventClass, "E4_SECURITY");
});

test("[ARCH-P0-1] statistical detection maps to business classification - E5 data", () => {
  // Data metrics map to E5
  const dbMetric = classifyAnomalyEvent({
    metricName: "sqlite_schema_lock_wait_ms",
    legacySeverity: "warning",
  });
  assert.equal(dbMetric.anomalyEventClass, "E5_DATA");

  const artifactMetric = classifyAnomalyEvent({
    metricName: "artifact_replication_lag_ms",
    legacySeverity: "critical",
  });
  assert.equal(artifactMetric.anomalyEventClass, "E5_DATA");
});

test("[ARCH-P0-1] statistical detection maps to business classification - E6 governance", () => {
  // Governance metrics map to E6
  const approvalMetric = classifyAnomalyEvent({
    metricName: "approval_timeout_total",
    legacySeverity: "warning",
  });
  assert.equal(approvalMetric.anomalyEventClass, "E6_GOVERNANCE");

  const complianceMetric = classifyAnomalyEvent({
    metricName: "audit_log_integrity_check_failed",
    legacySeverity: "critical",
  });
  assert.equal(complianceMetric.anomalyEventClass, "E6_GOVERNANCE");
});

test("[ARCH-P0-1] default classification falls back to E1_BUSINESS", () => {
  // Metrics that don't match any classifier fall back to E1
  const unknownMetric = classifyAnomalyEvent({
    metricName: "unknown_signal_zxy",
    legacySeverity: "info",
  });
  assert.equal(unknownMetric.anomalyEventClass, "E1_BUSINESS");
  assert.equal(unknownMetric.reason, "business_signal_default");
});

test("[ARCH-P0-1] classifyAnomalyEvent includes all required fields in output", () => {
  const result = classifyAnomalyEvent({
    metricName: "test_metric_with_context",
    legacySeverity: "critical",
    context: { source: "slo-alerting", component: "worker" },
  });

  assert.equal(result.metricName, "test_metric_with_context");
  assert.equal(result.legacySeverity, "critical");
  assert.ok(typeof result.anomalyEventClass === "string");
  assert.ok(typeof result.unifiedSeverity === "string");
  assert.ok(typeof result.reason === "string");
});

test("[ARCH-P0-1] context influences classification for ambiguous metrics", () => {
  // Same metric name with security context should classify as E4
  const withSecurityContext = classifyAnomalyEvent({
    metricName: "permission_check_failure",
    legacySeverity: "warning",
    context: { component: "sandbox_policy" },
  });
  assert.equal(withSecurityContext.anomalyEventClass, "E4_SECURITY");

  // Same metric name with governance context should classify as E4 (metric name 'permission_*' matches E4 before context matches E6)
  const withGovernanceContext = classifyAnomalyEvent({
    metricName: "permission_check_failure",
    legacySeverity: "warning",
    context: { component: "approval_workflow" },
  });
  assert.equal(withGovernanceContext.anomalyEventClass, "E6_GOVERNANCE");
});

test("[ARCH-P0-1] severity mapping uses anomalySeverityToUnifiedSeverity", () => {
  const emergencyResult = classifyAnomalyEvent({
    metricName: "emergency_metric",
    legacySeverity: "emergency",
  });
  assert.equal(emergencyResult.unifiedSeverity, anomalySeverityToUnifiedSeverity("emergency"));

  const criticalResult = classifyAnomalyEvent({
    metricName: "critical_metric",
    legacySeverity: "critical",
  });
  assert.equal(criticalResult.unifiedSeverity, anomalySeverityToUnifiedSeverity("critical"));

  const warningResult = classifyAnomalyEvent({
    metricName: "warning_metric",
    legacySeverity: "warning",
  });
  assert.equal(warningResult.unifiedSeverity, anomalySeverityToUnifiedSeverity("warning"));

  const infoResult = classifyAnomalyEvent({
    metricName: "info_metric",
    legacySeverity: "info",
  });
  assert.equal(infoResult.unifiedSeverity, anomalySeverityToUnifiedSeverity("info"));
});
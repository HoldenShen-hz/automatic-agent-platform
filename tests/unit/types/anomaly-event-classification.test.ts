/**
 * Unit tests for Anomaly Event Classification
 *
 * @see src/platform/contracts/types/anomaly-event-classification.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ANOMALY_EVENT_CLASSES,
  classifyAnomalyEvent,
  type ClassifiedAnomalyEvent,
  type ClassifyAnomalyEventInput,
  type AnomalyEventClass,
} from "../../../src/platform/contracts/types/anomaly-event-classification.js";

// ─────────────────────────────────────────────────────────────────────────────
// ANOMALY_EVENT_CLASSES Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ANOMALY_EVENT_CLASSES contains expected values", () => {
  const expected = ["E1_BUSINESS", "E2_EXECUTION", "E3_EXTERNAL_DEPENDENCY", "E4_SECURITY", "E5_DATA", "E6_GOVERNANCE"] as const;
  assert.deepStrictEqual(ANOMALY_EVENT_CLASSES, expected);
});

test("AnomalyEventClass type matches ANOMALY_EVENT_CLASSES", () => {
  const validClasses: AnomalyEventClass[] = ["E1_BUSINESS", "E2_EXECUTION", "E3_EXTERNAL_DEPENDENCY", "E4_SECURITY", "E5_DATA", "E6_GOVERNANCE"];
  for (const cls of validClasses) {
    assert.ok(ANOMALY_EVENT_CLASSES.includes(cls));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - Security Classification
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent identifies security-related metrics", () => {
  const result = classifyAnomalyEvent({ metricName: "auth_failure_rate", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E4_SECURITY");
  assert.strictEqual(result.metricName, "auth_failure_rate");
  assert.strictEqual(result.reason, "security_or_identity_signal");
});

test("classifyAnomalyEvent identifies IAM-related metrics as security", () => {
  const result = classifyAnomalyEvent({ metricName: "iam_token_expiry", legacySeverity: "critical" });

  assert.strictEqual(result.anomalyEventClass, "E4_SECURITY");
});

test("classifyAnomalyEvent identifies credential-related metrics as security", () => {
  const result = classifyAnomalyEvent({ metricName: "credential_rotation_status", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E4_SECURITY");
});

test("classifyAnomalyEvent identifies policy-related metrics as security", () => {
  const result = classifyAnomalyEvent({ metricName: "policy_violation_count", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E4_SECURITY");
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - External Dependency Classification
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent identifies external dependency metrics", () => {
  const result = classifyAnomalyEvent({ metricName: "third_party_api_latency", legacySeverity: "critical" });

  assert.strictEqual(result.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
  assert.strictEqual(result.reason, "external_dependency_signal");
});

test("classifyAnomalyEvent identifies rate limit metrics as external dependency", () => {
  const result = classifyAnomalyEvent({ metricName: "api_rate_limit_remaining", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
});

test("classifyAnomalyEvent identifies gateway-related metrics as external dependency", () => {
  const result = classifyAnomalyEvent({ metricName: "gateway_502_errors", legacySeverity: "critical" });

  assert.strictEqual(result.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
});

test("classifyAnomalyEvent identifies quota-related metrics as external dependency", () => {
  const result = classifyAnomalyEvent({ metricName: "provider_quota_usage", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - Governance Classification
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent identifies governance-related metrics", () => {
  const result = classifyAnomalyEvent({ metricName: "approval_queue_depth", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E6_GOVERNANCE");
  assert.strictEqual(result.reason, "governance_signal");
});

test("classifyAnomalyEvent identifies audit-related metrics as governance", () => {
  const result = classifyAnomalyEvent({ metricName: "audit_log_gap", legacySeverity: "critical" });

  assert.strictEqual(result.anomalyEventClass, "E6_GOVERNANCE");
});

test("classifyAnomalyEvent identifies compliance-related metrics as governance", () => {
  const result = classifyAnomalyEvent({ metricName: "compliance_check_pass_rate", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E6_GOVERNANCE");
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - Data Classification
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent identifies data-related metrics", () => {
  const result = classifyAnomalyEvent({ metricName: "database_connection_pool_size", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E5_DATA");
  assert.strictEqual(result.reason, "data_signal");
});

test("classifyAnomalyEvent identifies dataset-related metrics as data", () => {
  const result = classifyAnomalyEvent({ metricName: "dataset_sync_lag", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E5_DATA");
});

test("classifyAnomalyEvent identifies artifact-related metrics as data", () => {
  const result = classifyAnomalyEvent({ metricName: "artifact_storage_usage", legacySeverity: "info" });

  assert.strictEqual(result.anomalyEventClass, "E5_DATA");
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - Execution Classification
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent identifies execution-related metrics", () => {
  const result = classifyAnomalyEvent({ metricName: "workflow_execution_time", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E2_EXECUTION");
  assert.strictEqual(result.reason, "execution_signal");
});

test("classifyAnomalyEvent identifies worker-related metrics as execution", () => {
  const result = classifyAnomalyEvent({ metricName: "worker_pool_utilization", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E2_EXECUTION");
});

test("classifyAnomalyEvent identifies queue-related metrics as execution", () => {
  const result = classifyAnomalyEvent({ metricName: "task_queue_depth", legacySeverity: "info" });

  assert.strictEqual(result.anomalyEventClass, "E2_EXECUTION");
});

test("classifyAnomalyEvent identifies recovery-related metrics as execution", () => {
  const result = classifyAnomalyEvent({ metricName: "recovery_cycle_duration", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E2_EXECUTION");
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - Business (Default) Classification
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent defaults to E1_BUSINESS for unknown metrics", () => {
  const result = classifyAnomalyEvent({ metricName: "random_metric_name", legacySeverity: "info" });

  assert.strictEqual(result.anomalyEventClass, "E1_BUSINESS");
  assert.strictEqual(result.reason, "business_signal_default");
});

test("classifyAnomalyEvent defaults to E1_BUSINESS for non-matching metrics", () => {
  const result = classifyAnomalyEvent({ metricName: "zxy_unknown_metric", legacySeverity: "warning" });

  assert.strictEqual(result.anomalyEventClass, "E1_BUSINESS");
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - Severity Mapping
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent maps emergency to SEV1", () => {
  const result = classifyAnomalyEvent({ metricName: "auth_failure_rate", legacySeverity: "emergency" });

  assert.strictEqual(result.unifiedSeverity, "SEV1");
  assert.strictEqual(result.legacySeverity, "emergency");
});

test("classifyAnomalyEvent maps critical to SEV2", () => {
  const result = classifyAnomalyEvent({ metricName: "auth_failure_rate", legacySeverity: "critical" });

  assert.strictEqual(result.unifiedSeverity, "SEV2");
});

test("classifyAnomalyEvent maps warning to SEV3", () => {
  const result = classifyAnomalyEvent({ metricName: "auth_failure_rate", legacySeverity: "warning" });

  assert.strictEqual(result.unifiedSeverity, "SEV3");
});

test("classifyAnomalyEvent maps info to SEV4", () => {
  const result = classifyAnomalyEvent({ metricName: "auth_failure_rate", legacySeverity: "info" });

  assert.strictEqual(result.unifiedSeverity, "SEV4");
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - Context Analysis
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent uses context for classification", () => {
  const result = classifyAnomalyEvent({
    metricName: "unknown_metric",
    legacySeverity: "warning",
    context: { auth: "token_expiry", user: "123" },
  });

  // Context should help identify it as security-related
  assert.strictEqual(result.anomalyEventClass, "E4_SECURITY");
});

test("classifyAnomalyEvent handles null context", () => {
  const result = classifyAnomalyEvent({
    metricName: "metric_with_null_context",
    legacySeverity: "info",
    context: null,
  });

  assert.ok(result.anomalyEventClass !== undefined);
  assert.strictEqual(result.metricName, "metric_with_null_context");
});

test("classifyAnomalyEvent handles undefined context", () => {
  const result = classifyAnomalyEvent({
    metricName: "metric_with_undefined_context",
    legacySeverity: "info",
  });

  assert.ok(result.anomalyEventClass !== undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyAnomalyEvent Tests - Result Structure
// ─────────────────────────────────────────────────────────────────────────────

test("classifyAnomalyEvent returns complete result structure", () => {
  const result = classifyAnomalyEvent({ metricName: "test_metric", legacySeverity: "warning" });

  assert.ok("metricName" in result);
  assert.ok("anomalyEventClass" in result);
  assert.ok("unifiedSeverity" in result);
  assert.ok("legacySeverity" in result);
  assert.ok("reason" in result);
});

test("classifyAnomalyEvent preserves original metricName", () => {
  const input: ClassifyAnomalyEventInput = {
    metricName: "specific_metric_name",
    legacySeverity: "critical",
  };

  const result = classifyAnomalyEvent(input);

  assert.strictEqual(result.metricName, "specific_metric_name");
});

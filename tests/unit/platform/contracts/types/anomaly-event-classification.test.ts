import assert from "node:assert/strict";
import test from "node:test";

import {
  ANOMALY_EVENT_CLASSES,
  classifyAnomalyEvent,
} from "../../../../../src/platform/contracts/types/anomaly-event-classification.js";

test("AnomalyEventClass contract exposes six canonical classes", () => {
  assert.deepEqual(ANOMALY_EVENT_CLASSES, [
    "E1_BUSINESS",
    "E2_EXECUTION",
    "E3_EXTERNAL_DEPENDENCY",
    "E4_SECURITY",
    "E5_DATA",
    "E6_GOVERNANCE",
  ]);
});

test("classifyAnomalyEvent maps security signals into E4", () => {
  const classified = classifyAnomalyEvent({
    metricName: "iam_token_failure_rate",
    legacySeverity: "critical",
    context: { component: "sandbox_policy" },
  });
  assert.equal(classified.anomalyEventClass, "E4_SECURITY");
  assert.equal(classified.unifiedSeverity, "SEV2");
});

test("classifyAnomalyEvent maps provider and quota signals into E3", () => {
  const classified = classifyAnomalyEvent({
    metricName: "provider_503_rate_limit",
    legacySeverity: "emergency",
    context: { upstreamStatus: 503, provider: "openai" },
  });
  assert.equal(classified.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
  assert.equal(classified.unifiedSeverity, "SEV1");
});

test("classifyAnomalyEvent maps data and governance signals with fallback", () => {
  const data = classifyAnomalyEvent({
    metricName: "sqlite_schema_lock_wait_ms",
    legacySeverity: "warning",
  });
  const governance = classifyAnomalyEvent({
    metricName: "approval_timeout_total",
    legacySeverity: "warning",
  });
  const business = classifyAnomalyEvent({
    metricName: "checkout_conversion_drop",
    legacySeverity: "info",
  });

  assert.equal(data.anomalyEventClass, "E5_DATA");
  assert.equal(governance.anomalyEventClass, "E6_GOVERNANCE");
  assert.equal(business.anomalyEventClass, "E1_BUSINESS");
});

/**
 * ARCH-P0-2: §12.2 统一严重度等级 SEV1-SEV4 缺失
 *
 * Unit tests for unified severity mapping.
 * Verifies that UnifiedSeverity enum defines SEV1-SEV4 and that
 * incident P0-P3 and anomaly warning/critical/emergency map correctly.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  UNIFIED_SEVERITIES,
  UNIFIED_SEVERITY_SLA,
  anomalySeverityToUnifiedSeverity,
  alertSeverityToUnifiedSeverity,
  runbookSeverityToUnifiedSeverity,
  diagnosticSeverityToUnifiedSeverity,
  type UnifiedSeverity,
} from "../../../../../src/platform/contracts/types/unified-severity.js";

test("[ARCH-P0-2] UnifiedSeverity enum defines SEV1-SEV4", () => {
  const severities = Object.values(UNIFIED_SEVERITIES);
  assert.deepEqual(severities, ["SEV1", "SEV2", "SEV3", "SEV4"]);
});

test("[ARCH-P0-2] UnifiedSeverity type accepts only valid values", () => {
  const validSeverity: UnifiedSeverity = "SEV1";
  assert.equal(validSeverity, "SEV1");

  const sev2: UnifiedSeverity = "SEV2";
  assert.equal(sev2, "SEV2");

  const sev3: UnifiedSeverity = "SEV3";
  assert.equal(sev3, "SEV3");

  const sev4: UnifiedSeverity = "SEV4";
  assert.equal(sev4, "SEV4");
});

test("[ARCH-P0-2] SEVERITY_SLA defines response times for all levels", () => {
  for (const sev of UNIFIED_SEVERITIES) {
    const sla = UNIFIED_SEVERITY_SLA[sev];
    assert.ok(sla, `SLA must exist for ${sev}`);
    assert.ok(sla.acknowledgeWithinMinutes > 0, `${sev} acknowledgeWithinMinutes must be positive`);
    assert.ok(sla.mitigateWithinMinutes > 0, `${sev} mitigateWithinMinutes must be positive`);
    assert.ok(sla.ownerExpectation, `${sev} ownerExpectation must be defined`);
  }
});

test("[ARCH-P0-2] SEV1 has fastest response time", () => {
  assert.ok(
    UNIFIED_SEVERITY_SLA.SEV1.acknowledgeWithinMinutes < UNIFIED_SEVERITY_SLA.SEV2.acknowledgeWithinMinutes,
    "SEV1 acknowledge time must be faster than SEV2",
  );
  assert.ok(
    UNIFIED_SEVERITY_SLA.SEV2.acknowledgeWithinMinutes < UNIFIED_SEVERITY_SLA.SEV3.acknowledgeWithinMinutes,
    "SEV2 acknowledge time must be faster than SEV3",
  );
  assert.ok(
    UNIFIED_SEVERITY_SLA.SEV3.acknowledgeWithinMinutes < UNIFIED_SEVERITY_SLA.SEV4.acknowledgeWithinMinutes,
    "SEV3 acknowledge time must be faster than SEV4",
  );
});

test("[ARCH-P0-2] incident P0-P3 maps to SEV1-SEV4 via runbookSeverityToUnifiedSeverity", () => {
  assert.equal(runbookSeverityToUnifiedSeverity("P0"), "SEV1");
  assert.equal(runbookSeverityToUnifiedSeverity("P1"), "SEV2");
  assert.equal(runbookSeverityToUnifiedSeverity("P2"), "SEV3");
  assert.equal(runbookSeverityToUnifiedSeverity("P3"), "SEV4");
});

test("[ARCH-P0-2] anomaly emergency maps to SEV1", () => {
  assert.equal(anomalySeverityToUnifiedSeverity("emergency"), "SEV1");
});

test("[ARCH-P0-2] anomaly critical maps to SEV2", () => {
  assert.equal(anomalySeverityToUnifiedSeverity("critical"), "SEV2");
});

test("[ARCH-P0-2] anomaly warning maps to SEV3", () => {
  assert.equal(anomalySeverityToUnifiedSeverity("warning"), "SEV3");
});

test("[ARCH-P0-2] anomaly info maps to SEV4", () => {
  assert.equal(anomalySeverityToUnifiedSeverity("info"), "SEV4");
});

test("[ARCH-P0-2] alert severity page maps to SEV1", () => {
  assert.equal(alertSeverityToUnifiedSeverity("page"), "SEV1");
});

test("[ARCH-P0-2] alert severity critical maps to SEV2", () => {
  assert.equal(alertSeverityToUnifiedSeverity("critical"), "SEV2");
});

test("[ARCH-P0-2] alert severity warning maps to SEV3", () => {
  assert.equal(alertSeverityToUnifiedSeverity("warning"), "SEV3");
});

test("[ARCH-P0-2] alert severity info maps to SEV4", () => {
  assert.equal(alertSeverityToUnifiedSeverity("info"), "SEV4");
});

test("[ARCH-P0-2] diagnostic severity emergency maps to SEV1", () => {
  assert.equal(diagnosticSeverityToUnifiedSeverity("emergency"), "SEV1");
});

test("[ARCH-P0-2] diagnostic severity critical maps to SEV2", () => {
  assert.equal(diagnosticSeverityToUnifiedSeverity("critical"), "SEV2");
});

test("[ARCH-P0-2] diagnostic severity warning maps to SEV3", () => {
  assert.equal(diagnosticSeverityToUnifiedSeverity("warning"), "SEV3");
});

test("[ARCH-P0-2] diagnostic severity info maps to SEV4", () => {
  assert.equal(diagnosticSeverityToUnifiedSeverity("info"), "SEV4");
});

test("[ARCH-P0-2] SEVERITY_SLA.SEV1 mandates immediate paging", () => {
  assert.equal(UNIFIED_SEVERITY_SLA.SEV1.ownerExpectation, "page_immediately");
  assert.equal(UNIFIED_SEVERITY_SLA.SEV1.acknowledgeWithinMinutes, 5);
  assert.equal(UNIFIED_SEVERITY_SLA.SEV1.mitigateWithinMinutes, 30);
});

test("[ARCH-P0-2] SEVERITY_SLA.SEV2 mandates urgent engagement", () => {
  assert.equal(UNIFIED_SEVERITY_SLA.SEV2.ownerExpectation, "engage_primary_oncall");
  assert.equal(UNIFIED_SEVERITY_SLA.SEV2.acknowledgeWithinMinutes, 15);
  assert.equal(UNIFIED_SEVERITY_SLA.SEV2.mitigateWithinMinutes, 120);
});

test("[ARCH-P0-2] SEVERITY_SLA.SEV3 mandates same-shift response", () => {
  assert.equal(UNIFIED_SEVERITY_SLA.SEV3.ownerExpectation, "same_shift_response");
  assert.equal(UNIFIED_SEVERITY_SLA.SEV3.acknowledgeWithinMinutes, 60);
  assert.equal(UNIFIED_SEVERITY_SLA.SEV3.mitigateWithinMinutes, 480);
});

test("[ARCH-P0-2] SEVERITY_SLA.SEV4 mandates business hours follow-up", () => {
  assert.equal(UNIFIED_SEVERITY_SLA.SEV4.ownerExpectation, "business_hours_follow_up");
  assert.equal(UNIFIED_SEVERITY_SLA.SEV4.acknowledgeWithinMinutes, 240);
  assert.equal(UNIFIED_SEVERITY_SLA.SEV4.mitigateWithinMinutes, 1440);
});

test("[ARCH-P0-2] all mapping functions cover all UnifiedSeverity values", () => {
  const allSevValues: UnifiedSeverity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];

  // Runbook severity mapping
  const runbookInputs: Array<{ input: "P0" | "P1" | "P2" | "P3"; expected: UnifiedSeverity }> = [
    { input: "P0", expected: "SEV1" },
    { input: "P1", expected: "SEV2" },
    { input: "P2", expected: "SEV3" },
    { input: "P3", expected: "SEV4" },
  ];
  for (const { input, expected } of runbookInputs) {
    const result = runbookSeverityToUnifiedSeverity(input);
    assert.ok(allSevValues.includes(result), `runbookSeverityToUnifiedSeverity(${input}) = ${result} is not a valid UnifiedSeverity`);
    assert.equal(result, expected);
  }

  // Anomaly severity mapping
  const anomalyInputs: Array<{ input: "emergency" | "critical" | "warning" | "info"; expected: UnifiedSeverity }> = [
    { input: "emergency", expected: "SEV1" },
    { input: "critical", expected: "SEV2" },
    { input: "warning", expected: "SEV3" },
    { input: "info", expected: "SEV4" },
  ];
  for (const { input, expected } of anomalyInputs) {
    const result = anomalySeverityToUnifiedSeverity(input);
    assert.ok(allSevValues.includes(result), `anomalySeverityToUnifiedSeverity(${input}) = ${result} is not a valid UnifiedSeverity`);
    assert.equal(result, expected);
  }
});

test("[ARCH-P0-2] P0 incident maps to SEV1 for immediate response", () => {
  // P0 runbook severity should map to SEV1 for page immediately
  const p0Severity = runbookSeverityToUnifiedSeverity("P0");
  assert.equal(p0Severity, "SEV1");
  assert.equal(UNIFIED_SEVERITY_SLA[p0Severity].ownerExpectation, "page_immediately");
});

test("[ARCH-P0-2] emergency anomaly maps to SEV1 for immediate response", () => {
  // Emergency should map to SEV1 for immediate paging
  const emergencySeverity = anomalySeverityToUnifiedSeverity("emergency");
  assert.equal(emergencySeverity, "SEV1");
  assert.equal(UNIFIED_SEVERITY_SLA[emergencySeverity].ownerExpectation, "page_immediately");
});

test("[ARCH-P0-2] alert page maps to SEV1 for immediate response", () => {
  // Page alert should map to SEV1 for immediate paging
  const pageSeverity = alertSeverityToUnifiedSeverity("page");
  assert.equal(pageSeverity, "SEV1");
  assert.equal(UNIFIED_SEVERITY_SLA[pageSeverity].ownerExpectation, "page_immediately");
});
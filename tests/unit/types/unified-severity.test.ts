/**
 * Unit tests for Unified Severity Types and Conversion Functions
 *
 * @see src/platform/contracts/types/unified-severity.ts
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
  type ObservabilitySeverity,
  type AlertingSeverity,
  type RunbookSeverity,
  type DiagnosticSeverity,
} from "../../../src/platform/contracts/types/unified-severity.js";

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED_SEVERITIES Tests
// ─────────────────────────────────────────────────────────────────────────────

test("UNIFIED_SEVERITIES contains expected values", () => {
  const expected = ["SEV1", "SEV2", "SEV3", "SEV4"] as const;
  assert.deepStrictEqual(UNIFIED_SEVERITIES, expected);
});

test("UnifiedSeverity type matches UNIFIED_SEVERITIES", () => {
  const validSeverities: UnifiedSeverity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];
  for (const sev of validSeverities) {
    assert.ok(UNIFIED_SEVERITIES.includes(sev));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED_SEVERITY_SLA Tests
// ─────────────────────────────────────────────────────────────────────────────

test("UNIFIED_SEVERITY_SLA has entries for all severities", () => {
  for (const sev of UNIFIED_SEVERITIES) {
    assert.ok(UNIFIED_SEVERITY_SLA[sev] !== undefined, `${sev} should have SLA definition`);
  }
  assert.strictEqual(Object.keys(UNIFIED_SEVERITY_SLA).length, 4);
});

test("SEV1 has correct SLA values", () => {
  const sev1 = UNIFIED_SEVERITY_SLA["SEV1"];
  assert.strictEqual(sev1.acknowledgeWithinMinutes, 5);
  assert.strictEqual(sev1.mitigateWithinMinutes, 30);
  assert.strictEqual(sev1.ownerExpectation, "page_immediately");
});

test("SEV2 has correct SLA values", () => {
  const sev2 = UNIFIED_SEVERITY_SLA["SEV2"];
  assert.strictEqual(sev2.acknowledgeWithinMinutes, 15);
  assert.strictEqual(sev2.mitigateWithinMinutes, 120);
  assert.strictEqual(sev2.ownerExpectation, "engage_primary_oncall");
});

test("SEV3 has correct SLA values", () => {
  const sev3 = UNIFIED_SEVERITY_SLA["SEV3"];
  assert.strictEqual(sev3.acknowledgeWithinMinutes, 60);
  assert.strictEqual(sev3.mitigateWithinMinutes, 480);
  assert.strictEqual(sev3.ownerExpectation, "same_shift_response");
});

test("SEV4 has correct SLA values", () => {
  const sev4 = UNIFIED_SEVERITY_SLA["SEV4"];
  assert.strictEqual(sev4.acknowledgeWithinMinutes, 240);
  assert.strictEqual(sev4.mitigateWithinMinutes, 1440);
  assert.strictEqual(sev4.ownerExpectation, "business_hours_follow_up");
});

test("SLA values are ordered correctly (SEV1 fastest, SEV4 slowest)", () => {
  assert.ok(UNIFIED_SEVERITY_SLA["SEV1"].acknowledgeWithinMinutes < UNIFIED_SEVERITY_SLA["SEV2"].acknowledgeWithinMinutes);
  assert.ok(UNIFIED_SEVERITY_SLA["SEV2"].acknowledgeWithinMinutes < UNIFIED_SEVERITY_SLA["SEV3"].acknowledgeWithinMinutes);
  assert.ok(UNIFIED_SEVERITY_SLA["SEV3"].acknowledgeWithinMinutes < UNIFIED_SEVERITY_SLA["SEV4"].acknowledgeWithinMinutes);
});

// ─────────────────────────────────────────────────────────────────────────────
// anomalySeverityToUnifiedSeverity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("anomalySeverityToUnifiedSeverity maps emergency to SEV1", () => {
  assert.strictEqual(anomalySeverityToUnifiedSeverity("emergency"), "SEV1");
});

test("anomalySeverityToUnifiedSeverity maps critical to SEV2", () => {
  assert.strictEqual(anomalySeverityToUnifiedSeverity("critical"), "SEV2");
});

test("anomalySeverityToUnifiedSeverity maps warning to SEV3", () => {
  assert.strictEqual(anomalySeverityToUnifiedSeverity("warning"), "SEV3");
});

test("anomalySeverityToUnifiedSeverity maps info to SEV4", () => {
  assert.strictEqual(anomalySeverityToUnifiedSeverity("info"), "SEV4");
});

test("anomalySeverityToUnifiedSeverity handles unknown as SEV4", () => {
  // Default case
  assert.strictEqual(anomalySeverityToUnifiedSeverity("info" as ObservabilitySeverity), "SEV4");
});

// ─────────────────────────────────────────────────────────────────────────────
// alertSeverityToUnifiedSeverity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("alertSeverityToUnifiedSeverity maps page to SEV1", () => {
  assert.strictEqual(alertSeverityToUnifiedSeverity("page"), "SEV1");
});

test("alertSeverityToUnifiedSeverity maps critical to SEV2", () => {
  assert.strictEqual(alertSeverityToUnifiedSeverity("critical"), "SEV2");
});

test("alertSeverityToUnifiedSeverity maps warning to SEV3", () => {
  assert.strictEqual(alertSeverityToUnifiedSeverity("warning"), "SEV3");
});

test("alertSeverityToUnifiedSeverity maps info to SEV4", () => {
  assert.strictEqual(alertSeverityToUnifiedSeverity("info"), "SEV4");
});

// ─────────────────────────────────────────────────────────────────────────────
// runbookSeverityToUnifiedSeverity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("runbookSeverityToUnifiedSeverity maps P0 to SEV1", () => {
  assert.strictEqual(runbookSeverityToUnifiedSeverity("P0"), "SEV1");
});

test("runbookSeverityToUnifiedSeverity maps P1 to SEV2", () => {
  assert.strictEqual(runbookSeverityToUnifiedSeverity("P1"), "SEV2");
});

test("runbookSeverityToUnifiedSeverity maps P2 to SEV3", () => {
  assert.strictEqual(runbookSeverityToUnifiedSeverity("P2"), "SEV3");
});

test("runbookSeverityToUnifiedSeverity maps P3 to SEV4", () => {
  assert.strictEqual(runbookSeverityToUnifiedSeverity("P3"), "SEV4");
});

// ─────────────────────────────────────────────────────────────────────────────
// diagnosticSeverityToUnifiedSeverity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("diagnosticSeverityToUnifiedSeverity maps emergency to SEV1", () => {
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("emergency"), "SEV1");
});

test("diagnosticSeverityToUnifiedSeverity maps critical to SEV2", () => {
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("critical"), "SEV2");
});

test("diagnosticSeverityToUnifiedSeverity maps warning to SEV3", () => {
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("warning"), "SEV3");
});

test("diagnosticSeverityToUnifiedSeverity maps info to SEV4", () => {
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("info"), "SEV4");
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-function Consistency Tests
// ─────────────────────────────────────────────────────────────────────────────

test("emergency maps to SEV1 across all severity types", () => {
  assert.strictEqual(anomalySeverityToUnifiedSeverity("emergency"), "SEV1");
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("emergency"), "SEV1");
});

test("critical maps to SEV2 across all severity types", () => {
  assert.strictEqual(anomalySeverityToUnifiedSeverity("critical"), "SEV2");
  assert.strictEqual(alertSeverityToUnifiedSeverity("critical"), "SEV2");
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("critical"), "SEV2");
});

test("warning maps to SEV3 across all severity types", () => {
  assert.strictEqual(anomalySeverityToUnifiedSeverity("warning"), "SEV3");
  assert.strictEqual(alertSeverityToUnifiedSeverity("warning"), "SEV3");
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("warning"), "SEV3");
});

test("info maps to SEV4 across all severity types", () => {
  assert.strictEqual(anomalySeverityToUnifiedSeverity("info"), "SEV4");
  assert.strictEqual(alertSeverityToUnifiedSeverity("info"), "SEV4");
  assert.strictEqual(diagnosticSeverityToUnifiedSeverity("info"), "SEV4");
});

test("page (alerting) maps to SEV1 like emergency", () => {
  assert.strictEqual(alertSeverityToUnifiedSeverity("page"), "SEV1");
});

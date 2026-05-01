import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  UNIFIED_SEVERITIES,
  type UnifiedSeverity,
  UNIFIED_SEVERITY_SLA,
  type UnifiedSeveritySla,
  runbookSeverityToUnifiedSeverity,
  anomalySeverityToUnifiedSeverity,
  alertSeverityToUnifiedSeverity,
  diagnosticSeverityToUnifiedSeverity,
  type ObservabilitySeverity,
  type AlertingSeverity,
  type RunbookSeverity,
  type DiagnosticSeverity,
} from "../../../../src/platform/contracts/types/unified-severity.js";

test("[ARCH-P0-2] UnifiedSeverity enum defines SEV1-SEV4", () => {
  const severities = Object.values(UNIFIED_SEVERITIES);
  assert.deepEqual(severities, ["SEV1", "SEV2", "SEV3", "SEV4"]);
});

test("[ARCH-P0-2] UnifiedSeverity type covers all four levels", () => {
  const allSev: UnifiedSeverity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];
  for (const sev of allSev) {
    assert.ok(UNIFIED_SEVERITIES.includes(sev as (typeof UNIFIED_SEVERITIES)[number]), `${sev} should be a valid UnifiedSeverity`);
  }
});

test("[ARCH-P0-2] SEVERITY_SLA defines response times for all levels", () => {
  for (const sev of UNIFIED_SEVERITIES) {
    const sla = UNIFIED_SEVERITY_SLA[sev];
    assert.ok(sla, `SLA must exist for ${sev}`);
    assert.ok(sla.acknowledgeWithinMinutes > 0, `${sev} acknowledgeWithinMinutes must be positive`);
    assert.ok(sla.mitigateWithinMinutes > 0, `${sev} mitigateWithinMinutes must be positive`);
    assert.ok(sla.ownerExpectation, `${sev} ownerExpectation must be defined`);
  }
  assert.ok(
    UNIFIED_SEVERITY_SLA.SEV1.acknowledgeWithinMinutes < UNIFIED_SEVERITY_SLA.SEV4.acknowledgeWithinMinutes,
    "SEV1 acknowledge time must be shorter than SEV4"
  );
  assert.ok(
    UNIFIED_SEVERITY_SLA.SEV1.mitigateWithinMinutes < UNIFIED_SEVERITY_SLA.SEV4.mitigateWithinMinutes,
    "SEV1 mitigate time must be shorter than SEV4"
  );
});

test("[ARCH-P0-2] incident P0-P3 maps to SEV1-SEV4", () => {
  // P0 -> SEV1, P1 -> SEV2, P2 -> SEV3, P3 -> SEV4
  const runbookSeverityTests: Array<{ input: RunbookSeverity; expected: UnifiedSeverity }> = [
    { input: "P0", expected: "SEV1" },
    { input: "P1", expected: "SEV2" },
    { input: "P2", expected: "SEV3" },
    { input: "P3", expected: "SEV4" },
  ];

  for (const { input, expected } of runbookSeverityTests) {
    const result = runbookSeverityToUnifiedSeverity(input);
    assert.equal(result, expected, `runbookSeverityToUnifiedSeverity(${input}) should return ${expected}`);
  }
});

test("[ARCH-P0-2] anomaly warning/critical/emergency maps to SEV levels", () => {
  // emergency -> SEV1, critical -> SEV2, warning -> SEV3, info -> SEV4
  const anomalySeverityTests: Array<{ input: ObservabilitySeverity; expected: UnifiedSeverity }> = [
    { input: "emergency", expected: "SEV1" },
    { input: "critical", expected: "SEV2" },
    { input: "warning", expected: "SEV3" },
    { input: "info", expected: "SEV4" },
  ];

  for (const { input, expected } of anomalySeverityTests) {
    const result = anomalySeverityToUnifiedSeverity(input);
    assert.equal(result, expected, `anomalySeverityToUnifiedSeverity(${input}) should return ${expected}`);
  }
});

test("[ARCH-P0-2] alerting severity page/critical/warning maps to SEV levels", () => {
  // page -> SEV1, critical -> SEV2, warning -> SEV3, info -> SEV4
  const alertingSeverityTests: Array<{ input: AlertingSeverity; expected: UnifiedSeverity }> = [
    { input: "page", expected: "SEV1" },
    { input: "critical", expected: "SEV2" },
    { input: "warning", expected: "SEV3" },
    { input: "info", expected: "SEV4" },
  ];

  for (const { input, expected } of alertingSeverityTests) {
    const result = alertSeverityToUnifiedSeverity(input);
    assert.equal(result, expected, `alertSeverityToUnifiedSeverity(${input}) should return ${expected}`);
  }
});

test("[ARCH-P0-2] diagnostic severity emergency/critical/warning maps to SEV levels", () => {
  // emergency -> SEV1, critical -> SEV2, warning -> SEV3, info -> SEV4
  const diagnosticSeverityTests: Array<{ input: DiagnosticSeverity; expected: UnifiedSeverity }> = [
    { input: "emergency", expected: "SEV1" },
    { input: "critical", expected: "SEV2" },
    { input: "warning", expected: "SEV3" },
    { input: "info", expected: "SEV4" },
  ];

  for (const { input, expected } of diagnosticSeverityTests) {
    const result = diagnosticSeverityToUnifiedSeverity(input);
    assert.equal(result, expected, `diagnosticSeverityToUnifiedSeverity(${input}) should return ${expected}`);
  }
});

test("[ARCH-P0-2] SLA escalation ordering is correct", () => {
  // SEV1 has the most urgent SLA, SEV4 has the least urgent
  const severityOrdering: UnifiedSeverity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];

  for (let i = 0; i < severityOrdering.length - 1; i++) {
    const current = severityOrdering[i];
    const next = severityOrdering[i + 1];
    assert.ok(
      UNIFIED_SEVERITY_SLA[current].acknowledgeWithinMinutes < UNIFIED_SEVERITY_SLA[next].acknowledgeWithinMinutes,
      `${current} acknowledge time should be less than ${next}`
    );
    assert.ok(
      UNIFIED_SEVERITY_SLA[current].mitigateWithinMinutes < UNIFIED_SEVERITY_SLA[next].mitigateWithinMinutes,
      `${current} mitigate time should be less than ${next}`
    );
  }
});

test("[ARCH-P0-2] SEVERITY_SLA ownerExpectation values are meaningful", () => {
  const expectedExpectations: Record<UnifiedSeverity, string[]> = {
    SEV1: ["page_immediately"],
    SEV2: ["engage_primary_oncall"],
    SEV3: ["same_shift_response"],
    SEV4: ["business_hours_follow_up"],
  };

  for (const sev of UNIFIED_SEVERITIES) {
    const sla = UNIFIED_SEVERITY_SLA[sev];
    assert.ok(
      expectedExpectations[sev].includes(sla.ownerExpectation),
      `${sev} ownerExpectation should be one of ${expectedExpectations[sev].join(", ")}`
    );
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_RISK_REGISTER_BASELINE,
  RiskRegister,
  listRiskRegisterRecords,
} from "../../../../src/platform/architecture/risk-register.js";

test("PLATFORM_RISK_REGISTER_BASELINE is frozen", () => {
  assert.ok(Object.isFrozen(PLATFORM_RISK_REGISTER_BASELINE), "should be frozen");
});

test("PLATFORM_RISK_REGISTER_BASELINE has expected number of records", () => {
  assert.ok(PLATFORM_RISK_REGISTER_BASELINE.length >= 4, "should have at least 4 risk records");
});

test("each risk record has required fields", () => {
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(typeof risk.riskId === "string", `${risk.riskId}: riskId should be string`);
    assert.ok(typeof risk.severity === "string", `${risk.riskId}: severity should be string`);
    assert.ok(typeof risk.likelihood === "string", `${risk.riskId}: likelihood should be string`);
    assert.ok(typeof risk.impact === "string", `${risk.riskId}: impact should be string`);
    assert.ok(typeof risk.owner === "string", `${risk.riskId}: owner should be string`);
    assert.ok(typeof risk.mitigation === "string", `${risk.riskId}: mitigation should be string`);
    assert.ok(typeof risk.testOrDrill === "string", `${risk.riskId}: testOrDrill should be string`);
    assert.ok(typeof risk.status === "string", `${risk.riskId}: status should be string`);
    assert.ok(typeof risk.reviewAfter === "string", `${risk.riskId}: reviewAfter should be string`);
    assert.ok(typeof risk.trigger === "string", `${risk.riskId}: trigger should be string`);
    assert.ok(typeof risk.linkedInvariant === "string", `${risk.riskId}: linkedInvariant should be string`);
    assert.ok(typeof risk.linkedTest === "string", `${risk.riskId}: linkedTest should be string`);
  }
});

test("all severity values are valid P0-P3", () => {
  const validSeverities = ["P0", "P1", "P2", "P3"];
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(validSeverities.includes(risk.severity), `${risk.riskId}: severity '${risk.severity}' should be valid`);
  }
});

test("all likelihood values are valid", () => {
  const validLikelihoods = ["low", "medium", "high"];
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(validLikelihoods.includes(risk.likelihood), `${risk.riskId}: likelihood '${risk.likelihood}' should be valid`);
  }
});

test("all status values are valid", () => {
  const validStatuses = ["open", "mitigated", "accepted", "transferred"];
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(validStatuses.includes(risk.status), `${risk.riskId}: status '${risk.status}' should be valid`);
  }
});

test("RiskRegister.list returns all baseline records", () => {
  const registry = new RiskRegister();
  const records = registry.list();
  assert.equal(records.length, PLATFORM_RISK_REGISTER_BASELINE.length);
});

test("RiskRegister.resolve returns correct record", () => {
  const registry = new RiskRegister();
  const risk = registry.resolve("RISK-GRAPH-001");
  assert.equal(risk.riskId, "RISK-GRAPH-001");
  assert.ok(risk.impact.includes("PlanGraph"));
});

test("RiskRegister.resolve throws for unknown riskId", () => {
  const registry = new RiskRegister();
  assert.throws(
    () => registry.resolve("RISK-UNKNOWN-001"),
    { message: /Unknown risk register record: RISK-UNKNOWN-001/ },
  );
});

test("RiskRegister.assertReleaseGateReady passes for valid records", () => {
  const registry = new RiskRegister();
  registry.assertReleaseGateReady();
});

test("listRiskRegisterRecords returns same data as registry.list", () => {
  const records = listRiskRegisterRecords();
  assert.equal(records.length, PLATFORM_RISK_REGISTER_BASELINE.length);
});

test("all impact descriptions are non-empty", () => {
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(risk.impact.length > 0, `${risk.riskId}: impact should be non-empty`);
  }
});

test("all linked invariants follow INV-XXX-### pattern", () => {
  const pattern = /^INV-[A-Z]+-\d{3}$/;
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(pattern.test(risk.linkedInvariant), `${risk.riskId}: linkedInvariant '${risk.linkedInvariant}' should match pattern`);
  }
});

test("all linked tests start with 'tests/' or 'ui/tests/'", () => {
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(
      risk.linkedTest.startsWith("tests/") || risk.linkedTest.startsWith("ui/tests/"),
      `${risk.riskId}: linkedTest should start with 'tests/' or 'ui/tests/', got ${risk.linkedTest}`,
    );
  }
});

test("reviewAfter dates are in YYYY-MM-DD format", () => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(datePattern.test(risk.reviewAfter), `${risk.riskId}: reviewAfter '${risk.reviewAfter}' should be YYYY-MM-DD`);
  }
});

test("all risk records are mitigated or accepted", () => {
  for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
    assert.ok(
      risk.status === "mitigated" || risk.status === "accepted",
      `${risk.riskId}: status should be mitigated or accepted`,
    );
  }
});

test("RISK-GRAPH-001 has correct properties", () => {
  const registry = new RiskRegister();
  const risk = registry.resolve("RISK-GRAPH-001");
  assert.equal(risk.severity, "P0");
  assert.equal(risk.likelihood, "medium");
  assert.equal(risk.linkedInvariant, "INV-GRAPH-001");
});

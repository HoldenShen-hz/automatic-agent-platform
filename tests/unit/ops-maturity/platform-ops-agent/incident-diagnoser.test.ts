import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentDiagnoserService,
  classifyOpsIncident,
  summarizeIncidentDiagnosis,
} from "../../../../src/ops-maturity/platform-ops-agent/incident-diagnoser/index.js";

test("classifyOpsIncident returns critical_incident for high error rate >= 0.2", () => {
  assert.equal(classifyOpsIncident(0.2, 0), "critical_incident");
  assert.equal(classifyOpsIncident(0.5, 0), "critical_incident");
  assert.equal(classifyOpsIncident(1.0, 0), "critical_incident");
});

test("classifyOpsIncident returns critical_incident for high backlog >= 1000", () => {
  assert.equal(classifyOpsIncident(0, 1000), "critical_incident");
  assert.equal(classifyOpsIncident(0, 5000), "critical_incident");
  assert.equal(classifyOpsIncident(0, 10000), "critical_incident");
});

test("classifyOpsIncident returns incident for moderate error rate >= 0.05", () => {
  assert.equal(classifyOpsIncident(0.05, 0), "incident");
  assert.equal(classifyOpsIncident(0.1, 0), "incident");
  assert.equal(classifyOpsIncident(0.19, 0), "incident");
});

test("classifyOpsIncident returns incident for moderate backlog >= 200", () => {
  assert.equal(classifyOpsIncident(0, 200), "incident");
  assert.equal(classifyOpsIncident(0, 500), "incident");
  assert.equal(classifyOpsIncident(0, 999), "incident");
});

test("classifyOpsIncident returns warning for low values", () => {
  assert.equal(classifyOpsIncident(0.01, 10), "warning");
  assert.equal(classifyOpsIncident(0, 100), "warning");
  assert.equal(classifyOpsIncident(0.04, 150), "warning");
});

test("classifyOpsIncident prioritizes critical_incident over incident", () => {
  // High error rate takes precedence
  assert.equal(classifyOpsIncident(0.2, 500), "critical_incident");
  // High backlog takes precedence
  assert.equal(classifyOpsIncident(0.05, 1000), "critical_incident");
});

test("classifyOpsIncident prioritizes incident over warning", () => {
  // Moderate error rate takes precedence over low backlog
  assert.equal(classifyOpsIncident(0.05, 10), "incident");
  // Moderate backlog takes precedence over low error rate
  assert.equal(classifyOpsIncident(0.01, 200), "incident");
});

test("classifyOpsIncident error rate boundary at 0.05", () => {
  assert.equal(classifyOpsIncident(0.049, 0), "warning");
  assert.equal(classifyOpsIncident(0.05, 0), "incident");
});

test("classifyOpsIncident error rate boundary at 0.2", () => {
  assert.equal(classifyOpsIncident(0.199, 0), "incident");
  assert.equal(classifyOpsIncident(0.2, 0), "critical_incident");
});

test("classifyOpsIncident backlog boundary at 200", () => {
  assert.equal(classifyOpsIncident(0, 199), "warning");
  assert.equal(classifyOpsIncident(0, 200), "incident");
});

test("classifyOpsIncident backlog boundary at 1000", () => {
  assert.equal(classifyOpsIncident(0, 999), "incident");
  assert.equal(classifyOpsIncident(0, 1000), "critical_incident");
});

test("classifyOpsIncident handles zero values", () => {
  assert.equal(classifyOpsIncident(0, 0), "warning");
});

test("summarizeIncidentDiagnosis returns formatted string", () => {
  const summary = summarizeIncidentDiagnosis(0.05, 300);
  assert.ok(typeof summary === "string");
  assert.ok(summary.includes("incident"));
  assert.ok(summary.includes("errorRate=0.05"));
  assert.ok(summary.includes("backlog=300"));
});

test("summarizeIncidentDiagnosis includes correct classification", () => {
  const warning = summarizeIncidentDiagnosis(0.01, 50);
  assert.ok(warning.includes("warning"));

  const incident = summarizeIncidentDiagnosis(0.05, 300);
  assert.ok(incident.includes("incident"));

  const critical = summarizeIncidentDiagnosis(0.2, 1000);
  assert.ok(critical.includes("critical_incident"));
});

test("IncidentDiagnoserService returns causes and escalation action", () => {
  const service = new IncidentDiagnoserService();
  const diagnosis = service.diagnose(0.3, 1200, "failed");

  assert.equal(diagnosis.level, "critical_incident");
  assert.equal(diagnosis.recommendedAction, "escalate");
  assert.ok(diagnosis.suspectedCauses.includes("ops.incident.error_rate_spike"));
  assert.ok(diagnosis.suspectedCauses.includes("ops.incident.backlog_saturation"));
  assert.ok(diagnosis.suspectedCauses.includes("ops.incident.health_failed"));
});

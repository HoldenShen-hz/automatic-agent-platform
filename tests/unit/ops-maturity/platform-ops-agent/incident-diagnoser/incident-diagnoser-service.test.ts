import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOpsIncident,
  summarizeIncidentDiagnosis,
  IncidentDiagnoserService,
} from "../../../../../src/ops-maturity/platform-ops-agent/incident-diagnoser/index.js";

test("classifyOpsIncident returns critical_incident for high error rate", () => {
  assert.equal(classifyOpsIncident(0.3, 0), "critical_incident");
  assert.equal(classifyOpsIncident(0.5, 0), "critical_incident");
  assert.equal(classifyOpsIncident(1.0, 0), "critical_incident");
});

test("classifyOpsIncident returns critical_incident for high backlog", () => {
  assert.equal(classifyOpsIncident(0, 1500), "critical_incident");
  assert.equal(classifyOpsIncident(0, 2000), "critical_incident");
});

test("classifyOpsIncident returns incident for moderate error rate", () => {
  assert.equal(classifyOpsIncident(0.05, 0), "incident");
  assert.equal(classifyOpsIncident(0.1, 0), "incident");
  assert.equal(classifyOpsIncident(0.19, 0), "incident");
});

test("classifyOpsIncident returns incident for moderate backlog", () => {
  assert.equal(classifyOpsIncident(0, 200), "incident");
  assert.equal(classifyOpsIncident(0, 500), "incident");
  assert.equal(classifyOpsIncident(0, 999), "incident");
});

test("classifyOpsIncident returns warning for low values", () => {
  assert.equal(classifyOpsIncident(0, 0), "warning");
  assert.equal(classifyOpsIncident(0, 100), "warning");
  assert.equal(classifyOpsIncident(0.04, 199), "warning");
});

test("summarizeIncidentDiagnosis formats correctly", () => {
  assert.equal(summarizeIncidentDiagnosis(0.3, 1500), "critical_incident: errorRate=0.3, backlog=1500");
  assert.equal(summarizeIncidentDiagnosis(0.05, 200), "incident: errorRate=0.05, backlog=200");
  assert.equal(summarizeIncidentDiagnosis(0.01, 50), "warning: errorRate=0.01, backlog=50");
});

test("IncidentDiagnoserService.diagnose returns critical_incident level", () => {
  const service = new IncidentDiagnoserService();
  const result = service.diagnose(0.3, 1500, "healthy");

  assert.equal(result.level, "critical_incident");
  assert.ok(result.suspectedCauses.includes("ops.incident.error_rate_spike"));
  assert.ok(result.suspectedCauses.includes("ops.incident.backlog_saturation"));
  assert.equal(result.recommendedAction, "escalate");
});

test("IncidentDiagnoserService.diagnose returns incident level", () => {
  const service = new IncidentDiagnoserService();
  const result = service.diagnose(0.08, 300, "healthy");

  assert.equal(result.level, "incident");
  assert.ok(result.suspectedCauses.includes("ops.incident.error_rate_regression"));
  assert.ok(result.suspectedCauses.includes("ops.incident.backlog_growth"));
  assert.equal(result.recommendedAction, "investigate");
});

test("IncidentDiagnoserService.diagnose returns warning level", () => {
  const service = new IncidentDiagnoserService();
  const result = service.diagnose(0.01, 50, "healthy");

  assert.equal(result.level, "warning");
  assert.equal(result.suspectedCauses.length, 0);
  assert.equal(result.recommendedAction, "monitor");
});

test("IncidentDiagnoserService.diagnose includes health status in causes", () => {
  const service = new IncidentDiagnoserService();

  const degradedResult = service.diagnose(0.01, 50, "degraded");
  assert.ok(degradedResult.suspectedCauses.includes("ops.incident.health_degraded"));

  const failedResult = service.diagnose(0.01, 50, "failed");
  assert.ok(failedResult.suspectedCauses.includes("ops.incident.health_failed"));
});

test("IncidentDiagnoserService.diagnose defaults healthStatus to healthy", () => {
  const service = new IncidentDiagnoserService();
  const result = service.diagnose(0.01, 50);

  assert.equal(result.level, "warning");
  assert.ok(!result.suspectedCauses.some((c) => c.startsWith("ops.incident.health_")));
});

test("IncidentDiagnoserService.diagnose does not duplicate error rate causes", () => {
  const service = new IncidentDiagnoserService();
  const result = service.diagnose(0.5, 1500); // Both critical thresholds

  assert.ok(result.suspectedCauses.includes("ops.incident.error_rate_spike"));
  // Should not include the regression cause when spike is present
  assert.ok(!result.suspectedCauses.includes("ops.incident.error_rate_regression"));
});

test("IncidentDiagnoserService.diagnose does not duplicate backlog causes", () => {
  const service = new IncidentDiagnoserService();
  const result = service.diagnose(0.5, 1500); // Both critical thresholds

  assert.ok(result.suspectedCauses.includes("ops.incident.backlog_saturation"));
  // Should not include the growth cause when saturation is present
  assert.ok(!result.suspectedCauses.includes("ops.incident.backlog_growth"));
});
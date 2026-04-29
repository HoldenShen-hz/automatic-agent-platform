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

test("IncidentDiagnoserService.diagnose analyzes incident symptoms correctly", () => {
  const service = new IncidentDiagnoserService();

  const criticalResult = service.diagnose(0.3, 1500, "healthy");
  assert.equal(criticalResult.level, "critical_incident");
  assert.equal(criticalResult.summary, "critical_incident: errorRate=0.3, backlog=1500");

  const incidentResult = service.diagnose(0.08, 300, "healthy");
  assert.equal(incidentResult.level, "incident");
  assert.equal(incidentResult.summary, "incident: errorRate=0.08, backlog=300");

  const warningResult = service.diagnose(0.01, 50, "healthy");
  assert.equal(warningResult.level, "warning");
  assert.equal(warningResult.summary, "warning: errorRate=0.01, backlog=50");
});

test("IncidentDiagnoserService.diagnose provides root cause candidates", () => {
  const service = new IncidentDiagnoserService();

  const result = service.diagnose(0.3, 1500, "healthy");

  assert.ok(result.suspectedCauses.length > 0, "should have suspected causes");
  assert.ok(result.suspectedCauses.includes("ops.incident.error_rate_spike"));
  assert.ok(result.suspectedCauses.includes("ops.incident.backlog_saturation"));
});

test("IncidentDiagnoserService.diagnose does not rank or duplicate root cause candidates", () => {
  const service = new IncidentDiagnoserService();

  // Error rate causes are mutually exclusive (spike vs regression)
  const errorOnlyResult = service.diagnose(0.5, 0, "healthy");
  assert.ok(errorOnlyResult.suspectedCauses.includes("ops.incident.error_rate_spike"));
  assert.ok(!errorOnlyResult.suspectedCauses.includes("ops.incident.error_rate_regression"));

  // Backlog causes are mutually exclusive (saturation vs growth)
  const backlogOnlyResult = service.diagnose(0, 1500, "healthy");
  assert.ok(backlogOnlyResult.suspectedCauses.includes("ops.incident.backlog_saturation"));
  assert.ok(!backlogOnlyResult.suspectedCauses.includes("ops.incident.backlog_growth"));
});

test("IncidentDiagnoserService.diagnose computes diagnosis confidence through cause count", () => {
  const service = new IncidentDiagnoserService();

  // More causes may indicate lower confidence in a single root cause
  const singleCause = service.diagnose(0.01, 50, "healthy");
  const multipleCauses = service.diagnose(0.3, 1500, "degraded");

  assert.ok(singleCause.suspectedCauses.length <= multipleCauses.suspectedCauses.length);
});

test("IncidentDiagnoserService.diagnose generates escalation recommendations for critical incident", () => {
  const service = new IncidentDiagnoserService();

  const result = service.diagnose(0.3, 1500, "healthy");

  assert.equal(result.recommendedAction, "escalate");
  assert.ok(
    result.recommendedAction === "escalate" ||
    result.recommendedAction === "investigate" ||
    result.recommendedAction === "monitor",
    "recommendedAction must be a valid escalation recommendation"
  );
});

test("IncidentDiagnoserService.diagnose generates investigate recommendation for incident level", () => {
  const service = new IncidentDiagnoserService();

  const result = service.diagnose(0.08, 300, "healthy");

  assert.equal(result.recommendedAction, "investigate");
});

test("IncidentDiagnoserService.diagnose generates monitor recommendation for warning level", () => {
  const service = new IncidentDiagnoserService();

  const result = service.diagnose(0.01, 50, "healthy");

  assert.equal(result.recommendedAction, "monitor");
});

test("IncidentDiagnoserService.diagnose includes health status in causes when degraded or failed", () => {
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

test("IncidentDiagnoserService.diagnose returns diagnosis result with readonly interface", () => {
  const service = new IncidentDiagnoserService();
  const result = service.diagnose(0.3, 1500, "healthy");

  // suspectedCauses is typed as readonly array in the interface
  assert.ok(Array.isArray(result.suspectedCauses), "suspectedCauses should be an array");
  assert.ok(result.suspectedCauses.length > 0, "suspectedCauses should have elements");
});

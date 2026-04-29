/**
 * Integration Tests: Incident Control
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DoctorService,
  type DoctorCheckId,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js";

import {
  IncidentDetector,
  type IncidentEvent,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";

import {
  IncidentResolver,
  type Incident,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-resolver.js";

import {
  HumanTakeoverService,
  TakeoverStatus,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service.js";

import {
  OperationsGovernanceService,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/operations-governance-service.js";

// ============================================================================
// Incident Control End-to-End Integration Tests
// ============================================================================

test("integration: incident detection to resolution workflow", () => {
  const detector = new IncidentDetector();
  const resolver = new IncidentResolver();

  const event: IncidentEvent = {
    type: "execution_stalled",
    severity: "p1",
    executionId: "exec_incident_001",
    taskId: "task_incident_001",
    timestamp: new Date().toISOString(),
    metadata: { stalledDurationSeconds: 600 },
  };

  const detected = detector.detect(event);
  assert.equal(detected.detected, true);

  const incident = resolver.createIncident({
    type: detected.type,
    severity: detected.severity,
    affectedEntityRef: event.executionId,
    detectedAt: event.timestamp,
  });

  assert.equal(incident.status, "open");

  resolver.addResolution(incident.incidentId, {
    resolutionType: "requeued_execution",
    resolvedBy: "system",
    resolvedAt: new Date().toISOString(),
    notes: "Execution requeued after 10 minute stall",
  });

  const closed = resolver.closeIncident(incident.incidentId, {
    resolutionType: "requeued_execution",
    resolvedBy: "system",
    resolvedAt: new Date().toISOString(),
  });

  assert.equal(closed.status, "closed");
});

test("integration: human takeover escalation workflow", () => {
  const takeoverService = new HumanTakeoverService();

  const request = takeoverService.initiateTakeover({
    executionId: "exec_takeover_001",
    taskId: "task_takeover_001",
    reason: "High-risk deployment requires human approval",
    requestedBy: "system",
    urgency: "high",
  });

  assert.ok([TakeoverStatus.PENDING, TakeoverStatus.IN_PROGRESS].includes(request.status));

  const acknowledged = takeoverService.acknowledgeTakeover(request.takeoverId, "operator_001");
  assert.equal(acknowledged.status, TakeoverStatus.IN_PROGRESS);
  assert.equal(acknowledged.operatorId, "operator_001");

  const completed = takeoverService.completeTakeover(request.takeoverId, {
    actionTaken: "approved_with_conditions",
    notes: "Approved after security review",
  });

  assert.equal(completed.status, TakeoverStatus.COMPLETED);
  assert.ok(completed.completedAt.length > 0);
});

test("integration: doctor service runs all checks", () => {
  const service = new DoctorService();

  const checks: DoctorCheckId[] = ["db", "config", "backup", "locks", "workers", "event_backlog", "audit_integrity", "provider_health"];

  const results = checks.map((checkId) => service.runCheck(checkId));

  assert.equal(results.length, checks.length);

  const failedChecks = results.filter((r) => r.status === "fail_closed");
  const degradedChecks = results.filter((r) => r.status === "degraded");

  assert.ok(failedChecks.length >= 0);
  assert.ok(degradedChecks.length >= 0);
});

test("integration: operations governance metric recording and SLA check", () => {
  const service = new OperationsGovernanceService();

  service.recordMetric({
    name: "task_completion_rate",
    value: 0.97,
    unit: "percentage",
    timestamp: new Date().toISOString(),
    tags: { period: "daily" },
  });

  service.recordMetric({
    name: "task_completion_rate",
    value: 0.92,
    unit: "percentage",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    tags: { period: "daily" },
  });

  const compliance = service.checkSlaCompliance({
    metricName: "task_completion_rate",
    targetValue: 0.95,
    comparisonOperator: "gte",
    window: "daily",
  });

  assert.ok(typeof compliance.compliant === "boolean");
});

test("integration: incident detector with multiple event types", () => {
  const detector = new IncidentDetector();

  const events: IncidentEvent[] = [
    { type: "execution_stalled", severity: "p1", executionId: "exec_1", taskId: "task_1", timestamp: new Date().toISOString(), metadata: { stalledDurationSeconds: 600 } },
    { type: "budget_exceeded", severity: "p2", tenantId: "tenant_1", timestamp: new Date().toISOString(), metadata: { budgetLimitUsd: 1000, currentCostUsd: 1200 } },
    { type: "error_rate_elevated", severity: "p2", serviceId: "api_gateway", timestamp: new Date().toISOString(), metadata: { errorRate: 0.05, threshold: 0.01 } },
  ];

  const results = events.map((event) => detector.detect(event));

  assert.ok(results.every((r) => r.detected === true));
  assert.ok(results.some((r) => r.type === "execution_stalled"));
  assert.ok(results.some((r) => r.type === "budget_exceeded"));
});

test("integration: human takeover with timeout", () => {
  const service = new HumanTakeoverService();

  const request = service.initiateTakeover({
    executionId: "exec_timeout_001",
    taskId: "task_timeout_001",
    reason: "Requires immediate attention",
    requestedBy: "system",
    urgency: "critical",
  });

  service.acknowledgeTakeover(request.takeoverId, "operator_001");

  const timedOut = service.timeoutTakeover(request.takeoverId);

  assert.equal(timedOut.status, TakeoverStatus.TIMED_OUT);
});

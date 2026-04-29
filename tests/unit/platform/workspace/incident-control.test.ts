/**
 * Unit Tests: Incident Control
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DoctorService,
  type DoctorCheckId,
  type DoctorCheckReport,
  type DoctorCheckStatus,
} from "../../../../src/platform/five-plane-control-plane/incident-control/doctor-service.js";

import {
  IncidentDetector,
  type IncidentEvent,
  type IncidentSeverity,
} from "../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";

import {
  IncidentResolver,
  type Incident,
  type Resolution,
} from "../../../../src/platform/five-plane-control-plane/incident-control/incident-resolver.js";

import {
  HumanTakeoverService,
  type TakeoverRequest,
  type TakeoverStatus,
} from "../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service.js";

import {
  OperationsGovernanceService,
  type GovernanceMetric,
  type SlaTarget,
} from "../../../../src/platform/five-plane-control-plane/incident-control/operations-governance-service.js";

// ============================================================================
// Doctor Service Tests
// ============================================================================

test("DoctorService runs db health check", () => {
  const service = new DoctorService();

  const report = service.runCheck("db");

  assert.equal(report.checkId, "db");
  assert.ok(["ok", "degraded", "fail_closed"].includes(report.status));
  assert.ok(report.label.length > 0);
});

test("DoctorService runs config health check", () => {
  const service = new DoctorService();

  const report = service.runCheck("config");

  assert.equal(report.checkId, "config");
  assert.ok(["ok", "degraded", "fail_closed"].includes(report.status));
});

test("DoctorService runs backup health check", () => {
  const service = new DoctorService();

  const report = service.runCheck("backup");

  assert.equal(report.checkId, "backup");
  assert.ok(["ok", "degraded", "fail_closed"].includes(report.status));
});

test("DoctorService runs workers health check", () => {
  const service = new DoctorService();

  const report = service.runCheck("workers");

  assert.equal(report.checkId, "workers");
  assert.ok(["ok", "degraded", "fail_closed"].includes(report.status));
});

test("DoctorService runs all checks", () => {
  const service = new DoctorService();

  const summary = service.runAllChecks();

  assert.ok(summary.totalChecks > 0);
  assert.ok(summary.okChecks >= 0);
  assert.ok(summary.degradedChecks >= 0);
  assert.ok(summary.failClosedChecks >= 0);
});

test("DoctorService generates self check summary", () => {
  const service = new DoctorService();

  const summary = service.getSelfCheckSummary();

  assert.equal(summary.totalChecks, 8);
  assert.ok(typeof summary.okChecks === "number");
  assert.ok(typeof summary.degradedChecks === "number");
  assert.ok(typeof summary.failClosedChecks === "number");
});

// ============================================================================
// Incident Detector Tests
// ============================================================================

test("IncidentDetector detects execution stalled incident", () => {
  const detector = new IncidentDetector();

  const event: IncidentEvent = {
    type: "execution_stalled",
    severity: "p1",
    executionId: "exec_123",
    taskId: "task_456",
    timestamp: new Date().toISOString(),
    metadata: {
      stalledDurationSeconds: 600,
    },
  };

  const incident = detector.detect(event);

  assert.equal(incident.detected, true);
  assert.equal(incident.type, "execution_stalled");
  assert.equal(incident.severity, "p1");
});

test("IncidentDetector does not detect false positive", () => {
  const detector = new IncidentDetector();

  const event: IncidentEvent = {
    type: "execution_stalled",
    severity: "p2",
    executionId: "exec_789",
    taskId: "task_101",
    timestamp: new Date().toISOString(),
    metadata: {
      stalledDurationSeconds: 10,
    },
  };

  const incident = detector.detect(event);

  assert.equal(incident.detected, false);
});

test("IncidentDetector detects budget exceeded incident", () => {
  const detector = new IncidentDetector();

  const event: IncidentEvent = {
    type: "budget_exceeded",
    severity: "p2",
    tenantId: "tenant_123",
    timestamp: new Date().toISOString(),
    metadata: {
      budgetLimitUsd: 1000,
      currentCostUsd: 1100,
    },
  };

  const incident = detector.detect(event);

  assert.equal(incident.detected, true);
  assert.equal(incident.type, "budget_exceeded");
});

test("IncidentDetector maps severity correctly", () => {
  const detector = new IncidentDetector();

  const p0Event: IncidentEvent = {
    type: "system_unavailable",
    severity: "p0",
    timestamp: new Date().toISOString(),
  };

  const p2Event: IncidentEvent = {
    type: "latency_elevated",
    severity: "p2",
    timestamp: new Date().toISOString(),
  };

  const p0Incident = detector.detect(p0Event);
  const p2Incident = detector.detect(p2Event);

  assert.equal(p0Incident.severity, "p0");
  assert.equal(p2Incident.severity, "p2");
});

// ============================================================================
// Incident Resolver Tests
// ============================================================================

test("IncidentResolver creates incident record", () => {
  const resolver = new IncidentResolver();

  const incident = resolver.createIncident({
    type: "execution_stalled",
    severity: "p1",
    affectedEntityRef: "exec_123",
    detectedAt: new Date().toISOString(),
  });

  assert.equal(incident.type, "execution_stalled");
  assert.equal(incident.status, "open");
  assert.ok(incident.incidentId.length > 0);
});

test("IncidentResolver adds resolution", () => {
  const resolver = new IncidentResolver();

  const incident = resolver.createIncident({
    type: "execution_stalled",
    severity: "p1",
    affectedEntityRef: "exec_123",
    detectedAt: new Date().toISOString(),
  });

  const resolution = resolver.addResolution(incident.incidentId, {
    resolutionType: "requeued_execution",
    resolvedBy: "system",
    resolvedAt: new Date().toISOString(),
    notes: "Execution requeued after lock timeout",
  });

  assert.equal(resolution.success, true);
  assert.equal(incident.resolutions.length, 1);
});

test("IncidentResolver closes incident", () => {
  const resolver = new IncidentResolver();

  const incident = resolver.createIncident({
    type: "budget_exceeded",
    severity: "p2",
    affectedEntityRef: "tenant_123",
    detectedAt: new Date().toISOString(),
  });

  const closed = resolver.closeIncident(incident.incidentId, {
    resolutionType: "budget_increased",
    resolvedBy: "admin",
    resolvedAt: new Date().toISOString(),
  });

  assert.equal(closed.status, "closed");
  assert.ok(closed.closedAt.length > 0);
});

// ============================================================================
// Human Takeover Service Tests
// ============================================================================

test("HumanTakeoverService initiates takeover", () => {
  const service = new HumanTakeoverService();

  const request: TakeoverRequest = {
    executionId: "exec_123",
    taskId: "task_456",
    reason: "High-risk operation requires human approval",
    requestedBy: "system",
    urgency: "high",
  };

  const takeover = service.initiateTakeover(request);

  assert.equal(takeover.executionId, "exec_123");
  assert.ok([TakeoverStatus.PENDING, TakeoverStatus.IN_PROGRESS].includes(takeover.status));
  assert.ok(takeover.takeoverId.length > 0);
});

test("HumanTakeoverService acknowledges takeover", () => {
  const service = new HumanTakeoverService();

  const request: TakeoverRequest = {
    executionId: "exec_789",
    taskId: "task_101",
    reason: "Manual intervention needed",
    requestedBy: "system",
    urgency: "medium",
  };

  const takeover = service.initiateTakeover(request);
  const acknowledged = service.acknowledgeTakeover(takeover.takeoverId, "operator_001");

  assert.equal(acknowledged.status, TakeoverStatus.IN_PROGRESS);
  assert.equal(acknowledged.operatorId, "operator_001");
  assert.ok(acknowledged.acknowledgedAt.length > 0);
});

test("HumanTakeoverService completes takeover", () => {
  const service = new HumanTakeoverService();

  const request: TakeoverRequest = {
    executionId: "exec_202",
    taskId: "task_303",
    reason: "User requested control",
    requestedBy: "user_123",
    urgency: "low",
  };

  const takeover = service.initiateTakeover(request);
  service.acknowledgeTakeover(takeover.takeoverId, "operator_001");
  const completed = service.completeTakeover(takeover.takeoverId, {
    actionTaken: "approved_manually",
    notes: "Manual approval granted after review",
  });

  assert.equal(completed.status, TakeoverStatus.COMPLETED);
  assert.ok(completed.completedAt.length > 0);
});

// ============================================================================
// Operations Governance Service Tests
// ============================================================================

test("OperationsGovernanceService records governance metric", () => {
  const service = new OperationsGovernanceService();

  const metric: GovernanceMetric = {
    name: "task_completion_rate",
    value: 0.95,
    unit: "percentage",
    timestamp: new Date().toISOString(),
    tags: {
      period: "daily",
      region: "us-east-1",
    },
  };

  const recorded = service.recordMetric(metric);

  assert.equal(recorded.success, true);
  assert.ok(recorded.recordedAt.length > 0);
});

test("OperationsGovernanceService checks SLA compliance", () => {
  const service = new OperationsGovernanceService();

  const target: SlaTarget = {
    metricName: "task_completion_rate",
    targetValue: 0.95,
    comparisonOperator: "gte",
    window: "daily",
  };

  const compliance = service.checkSlaCompliance(target);

  assert.ok(typeof compliance.compliant === "boolean");
  assert.ok(typeof compliance.currentValue === "number");
});

test("OperationsGovernanceService generates governance report", () => {
  const service = new OperationsGovernanceService();

  const report = service.generateGovernanceReport({
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-04-30T23:59:59.999Z",
    includeMetrics: ["task_completion_rate", "average_latency"],
  });

  assert.ok(report.generatedAt.length > 0);
  assert.ok(report.metrics.length >= 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentDetector,
  type IncidentDetection,
} from "../../../../../src/platform/control-plane/incident-control/incident-detector.js";

test("IncidentDetector handles unknown check ID mapping to system_health", () => {
  const detector = new IncidentDetector();

  const checks = [
    {
      checkId: "completely_unknown_check",
      status: "fail_closed",
      summary: "Unknown check failed",
      findings: [],
      metrics: {},
    },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.category, "system_health");
  assert.equal(incidents[0]!.severity, "p1");
});

test("IncidentDetector handles check with mixed case checkId", () => {
  const detector = new IncidentDetector();

  const checks = [
    {
      checkId: "PROVIDER_HEALTH",
      status: "fail_closed",
      summary: "Provider health check failed",
      findings: [],
      metrics: {},
    },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.category, "system_health");
});

test("IncidentDetector handles audit_integrity check correctly", () => {
  const detector = new IncidentDetector();

  const checks = [
    {
      checkId: "audit_integrity",
      status: "fail_closed",
      summary: "Audit integrity check failed",
      findings: ["audit_log_gap_detected"],
      metrics: { gapCount: 5 },
    },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.category, "security");
  assert.equal(incidents[0]!.severity, "p1");
});

test("IncidentDetector handles event_backlog check correctly", () => {
  const detector = new IncidentDetector();

  const checks = [
    {
      checkId: "event_backlog",
      status: "degraded",
      summary: "Event backlog growing",
      findings: ["backlog_size_exceeded"],
      metrics: { backlogSize: 10000 },
    },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.category, "performance");
  assert.equal(incidents[0]!.severity, "p2");
});

test("IncidentDetector createIncident generates unique incident IDs", () => {
  const detector = new IncidentDetector();

  const incident1 = detector.createIncident({
    category: "availability",
    severity: "p2",
    title: "Test 1",
    description: "Test description 1",
  });

  const incident2 = detector.createIncident({
    category: "availability",
    severity: "p2",
    title: "Test 2",
    description: "Test description 2",
  });

  assert.notEqual(incident1.incidentId, incident2.incidentId);
  assert.match(incident1.incidentId, /^incident_/);
  assert.match(incident2.incidentId, /^incident_/);
});

test("IncidentDetector createIncident sets detectedAt to current time", () => {
  const detector = new IncidentDetector();
  const before = new Date().toISOString();

  const incident = detector.createIncident({
    category: "availability",
    severity: "p3",
    title: "Test",
    description: "Test",
  });

  const after = new Date().toISOString();

  assert.ok(incident.detectedAt >= before);
  assert.ok(incident.detectedAt <= after);
});

test("IncidentDetector createIncident with empty symptoms array", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "configuration",
    severity: "p3",
    title: "Config issue",
    description: "Configuration problem",
    symptoms: [],
  });

  assert.deepEqual(incident.symptoms, []);
});

test("IncidentDetector createIncident with empty affectedEntities array", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "configuration",
    severity: "p3",
    title: "Config issue",
    description: "Configuration problem",
    affectedEntities: [],
  });

  assert.deepEqual(incident.affectedEntities, []);
});

test("IncidentDetector createIncident with empty metrics", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "configuration",
    severity: "p3",
    title: "Config issue",
    description: "Configuration problem",
    metrics: {},
  });

  assert.deepEqual(incident.metrics, {});
});

test("IncidentDetector shouldAutoEscalate handles edge case at exact threshold", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

  // Exactly at threshold
  const detectedAt = new Date(Date.now() - 300 * 1000).toISOString();
  const result = detector.shouldAutoEscalate(detectedAt, "p1");

  // At exactly the threshold, it should return true (>= comparison)
  assert.equal(result, true);
});

test("IncidentDetector shouldAutoEscalate handles P1 just under threshold", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

  // Just under threshold (299 seconds)
  const detectedAt = new Date(Date.now() - 299 * 1000).toISOString();
  const result = detector.shouldAutoEscalate(detectedAt, "p1");

  assert.equal(result, false);
});

test("IncidentDetector shouldAutoEscalate handles very old P1", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

  // Very old (1 hour)
  const detectedAt = new Date(Date.now() - 3600 * 1000).toISOString();
  const result = detector.shouldAutoEscalate(detectedAt, "p1");

  assert.equal(result, true);
});

test("IncidentDetector classifyUrgency is exhaustive for all severity levels", () => {
  const detector = new IncidentDetector();

  const p1Urgency = detector.classifyUrgency("p1");
  const p2Urgency = detector.classifyUrgency("p2");
  const p3Urgency = detector.classifyUrgency("p3");
  const p4Urgency = detector.classifyUrgency("p4");

  assert.equal(p1Urgency, "critical");
  assert.equal(p2Urgency, "high");
  assert.equal(p3Urgency, "medium");
  assert.equal(p4Urgency, "low");
});

test("IncidentDetector detectFromChecks handles multiple fail_closed checks", () => {
  const detector = new IncidentDetector();

  const checks = [
    { checkId: "db", status: "fail_closed", summary: "DB failed", findings: [], metrics: {} },
    { checkId: "workers", status: "fail_closed", summary: "Workers failed", findings: [], metrics: {} },
    { checkId: "backup", status: "fail_closed", summary: "Backup failed", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 3);
  assert.ok(incidents.every(i => i.severity === "p1"));
});

test("IncidentDetector detectFromChecks handles mixed status checks", () => {
  const detector = new IncidentDetector();

  const checks = [
    { checkId: "db", status: "fail_closed", summary: "DB failed", findings: [], metrics: {} },
    { checkId: "workers", status: "degraded", summary: "Workers degraded", findings: [], metrics: {} },
    { checkId: "config", status: "ok", summary: "Config OK", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 2);
  assert.equal(incidents.filter(i => i.severity === "p1").length, 1);
  assert.equal(incidents.filter(i => i.severity === "p2").length, 1);
});

test("IncidentDetector options default values are applied", () => {
  const detector = new IncidentDetector();

  // Verify default options work by creating incidents
  const incident = detector.createIncident({
    category: "availability",
    severity: "p1",
    title: "Test",
    description: "Test",
  });

  assert.equal(incident.status, "open");
});

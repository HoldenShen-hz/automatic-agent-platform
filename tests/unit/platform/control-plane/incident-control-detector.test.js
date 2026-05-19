import assert from "node:assert/strict";
import test from "node:test";

import { IncidentDetector } from "../../../../../../src/platform/control-plane/incident-control/incident-detector.js";

test("incident-detector detectFromChecks creates p1 for fail_closed", () => {
  const detector = new IncidentDetector();
  const checks = [
    {
      checkId: "db",
      status: "fail_closed",
      summary: "Database connection failed",
      findings: ["connection refused"],
      metrics: { latencyMs: 5000 },
    },
  ];

  const incidents = detector.detectFromChecks(checks);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.severity, "p1");
  assert.equal(incidents[0]!.category, "data_integrity");
  assert.equal(incidents[0]!.status, "open");
});

test("incident-detector detectFromChecks creates p2 for degraded", () => {
  const detector = new IncidentDetector();
  const checks = [
    {
      checkId: "config",
      status: "degraded",
      summary: "Config service slow",
      findings: ["timeout"],
      metrics: { latencyMs: 2000 },
    },
  ];

  const incidents = detector.detectFromChecks(checks);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.severity, "p2");
  assert.equal(incidents[0]!.category, "configuration");
});

test("incident-detector detectFromChecks handles multiple incidents", () => {
  const detector = new IncidentDetector();
  const checks = [
    { checkId: "db", status: "fail_closed", summary: "DB down", findings: [], metrics: {} },
    { checkId: "backup", status: "degraded", summary: "Backup slow", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);
  assert.equal(incidents.length, 2);
});

test("incident-detector detectFromChecks ignores passing checks", () => {
  const detector = new IncidentDetector();
  const checks = [
    { checkId: "db", status: "passing", summary: "OK", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);
  assert.equal(incidents.length, 0);
});

test("incident-detector createIncident creates valid incident", () => {
  const detector = new IncidentDetector();
  const incident = detector.createIncident({
    category: "security",
    severity: "p1",
    title: "Security breach detected",
    description: "Unauthorized access attempt",
    symptoms: ["failed_login_attempts"],
  });

  assert.ok(incident.incidentId);
  assert.ok(incident.detectedAt);
  assert.equal(incident.category, "security");
  assert.equal(incident.severity, "p1");
  assert.equal(incident.status, "open");
  assert.equal(incident.title, "Security breach detected");
});

test("incident-detector createIncident with all optional fields", () => {
  const detector = new IncidentDetector();
  const incident = detector.createIncident({
    category: "availability",
    severity: "p3",
    title: "Service degraded",
    description: "High latency detected",
    sourceCheckId: "workers",
    symptoms: ["slow_response"],
    affectedEntities: ["api-gateway-1"],
    metrics: { latencyMs: 3000 },
  });

  assert.equal(incident.sourceCheckId, "workers");
  assert.deepEqual(incident.affectedEntities, ["api-gateway-1"]);
  assert.equal(incident.metrics.latencyMs, 3000);
});

test("incident-detector classifyUrgency maps severity correctly", () => {
  const detector = new IncidentDetector();

  assert.equal(detector.classifyUrgency("p1"), "critical");
  assert.equal(detector.classifyUrgency("p2"), "high");
  assert.equal(detector.classifyUrgency("p3"), "medium");
  assert.equal(detector.classifyUrgency("p4"), "low");
});

test("incident-detector shouldAutoEscalate p1 after threshold", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

  const oldTime = new Date(Date.now() - 600000).toISOString(); // 10 min ago
  assert.equal(detector.shouldAutoEscalate(oldTime, "p1"), true);

  const recentTime = new Date(Date.now() - 60000).toISOString(); // 1 min ago
  assert.equal(detector.shouldAutoEscalate(recentTime, "p1"), false);
});

test("incident-detector shouldAutoEscalate returns false for non-p1", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

  const oldTime = new Date(Date.now() - 600000).toISOString();
  assert.equal(detector.shouldAutoEscalate(oldTime, "p2"), false);
  assert.equal(detector.shouldAutoEscalate(oldTime, "p3"), false);
  assert.equal(detector.shouldAutoEscalate(oldTime, "p4"), false);
});

test("incident-detector maps checkId to category correctly", () => {
  const detector = new IncidentDetector();

  // Access private method via public interface by testing behavior
  const dbIncident = detector.createIncident({
    category: detector["mapCheckIdToCategory"]("db"),
    severity: "p1",
    title: "test",
    description: "test",
  });
  assert.equal(dbIncident.category, "data_integrity");

  const configIncident = detector.createIncident({
    category: detector["mapCheckIdToCategory"]("config"),
    severity: "p1",
    title: "test",
    description: "test",
  });
  assert.equal(configIncident.category, "configuration");
});

test("incident-detector maxOpenIncidents option", () => {
  const detector = new IncidentDetector({ maxOpenIncidents: 50 });
  assert.equal(detector["maxOpenIncidents"], 50);

  const defaultDetector = new IncidentDetector();
  assert.equal(defaultDetector["maxOpenIncidents"], 100);
});

test("incident-detector autoEscalateP1AfterSeconds option", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 600 });
  assert.equal(detector["autoEscalateP1AfterSeconds"], 600);

  const defaultDetector = new IncidentDetector();
  assert.equal(defaultDetector["autoEscalateP1AfterSeconds"], 300);
});

test("incident-detector generates unique incident IDs", () => {
  const detector = new IncidentDetector();
  const incident1 = detector.createIncident({
    category: "system_health",
    severity: "p4",
    title: "test1",
    description: "test1",
  });
  const incident2 = detector.createIncident({
    category: "system_health",
    severity: "p4",
    title: "test2",
    description: "test2",
  });

  assert.notEqual(incident1.incidentId, incident2.incidentId);
});
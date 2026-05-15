/**
 * Integration Tests: Incident Detector Service
 *
 * Tests incident detection with realistic health check data flows,
 * threshold configurations, and integration with the broader incident control system.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  IncidentDetector,
  type IncidentDetection,
  type IncidentCategory,
  type IncidentSeverity,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";

test("IncidentDetector: detects P1 incidents from multiple fail_closed checks", () => {
  const ctx = createIntegrationContext("aa-incident-detect-multi-");
  try {
    const detector = new IncidentDetector({ maxOpenIncidents: 100 });

    const checks = [
      {
        checkId: "db",
        status: "fail_closed",
        summary: "Database write probe failed - database not writable",
        findings: ["db_write_probe_failed"],
        metrics: { dbWritable: false },
      },
      {
        checkId: "provider_health",
        status: "fail_closed",
        summary: "Provider health check failed",
        findings: ["provider_unreachable"],
        metrics: { providerHealth: "failed" },
      },
    ];

    const incidents = detector.detectFromChecks(checks);

    assert.strictEqual(incidents.length, 2);
    assert.ok(incidents.every((i) => i.severity === "p1"), "All should be P1");
    assert.ok(incidents.some((i) => i.category === "data_integrity"), "Should detect data_integrity");
    assert.ok(incidents.some((i) => i.category === "availability"), "Should detect availability");
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDetector: maps check IDs to incident categories correctly", () => {
  const ctx = createIntegrationContext("aa-incident-detect-map-");
  try {
    const detector = new IncidentDetector();

    const checks = [
      { checkId: "db", status: "fail_closed", summary: "DB failure", findings: [], metrics: {} },
      { checkId: "config", status: "fail_closed", summary: "Config failure", findings: [], metrics: {} },
      { checkId: "backup", status: "fail_closed", summary: "Backup failure", findings: [], metrics: {} },
      { checkId: "locks", status: "fail_closed", summary: "Locks failure", findings: [], metrics: {} },
      { checkId: "workers", status: "fail_closed", summary: "Workers failure", findings: [], metrics: {} },
      { checkId: "event_backlog", status: "fail_closed", summary: "Event backlog failure", findings: [], metrics: {} },
      { checkId: "audit_integrity", status: "fail_closed", summary: "Audit integrity failure", findings: [], metrics: {} },
      { checkId: "provider_health", status: "fail_closed", summary: "Provider health failure", findings: [], metrics: {} },
    ];

    const incidents = detector.detectFromChecks(checks);
    const categoryMap: Record<string, IncidentCategory> = {
      db: "data_integrity",
      config: "configuration",
      backup: "availability",
      locks: "data_integrity",
      workers: "availability",
      event_backlog: "performance",
      audit_integrity: "security",
      provider_health: "availability",
    };

    for (const incident of incidents) {
      const checkId = incident.sourceCheckId!;
      const expectedCategory = categoryMap[checkId];
      assert.strictEqual(incident.category, expectedCategory, `checkId ${checkId} should map to ${expectedCategory}`);
    }
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDetector: creates incidents with all required fields", () => {
  const ctx = createIntegrationContext("aa-incident-detect-create-");
  try {
    const detector = new IncidentDetector();

    const incident = detector.createIncident({
      category: "performance",
      severity: "p3",
      title: "High latency detected",
      description: "P95 latency exceeds 5000ms threshold",
      sourceCheckId: "event_backlog",
      symptoms: ["queue_starvation_detected", "high_dispatch_latency"],
      affectedEntities: ["queue:priority", "queue:default"],
      metrics: { p95_latency_ms: 5234, queue_depth: 150 },
    });

    // Verify structure
    assert.ok(incident.incidentId.match(/^incident_\d+_[a-z0-9]+$/), "Should have valid incident ID format");
    assert.ok(incident.detectedAt, "Should have detectedAt timestamp");
    assert.strictEqual(incident.category, "performance");
    assert.strictEqual(incident.severity, "p3");
    assert.strictEqual(incident.status, "open");
    assert.strictEqual(incident.title, "High latency detected");
    assert.strictEqual(incident.description, "P95 latency exceeds 5000ms threshold");
    assert.strictEqual(incident.sourceCheckId, "event_backlog");
    assert.deepStrictEqual(incident.symptoms, ["queue_starvation_detected", "high_dispatch_latency"]);
    assert.deepStrictEqual(incident.affectedEntities, ["queue:priority", "queue:default"]);
    assert.deepStrictEqual(incident.metrics, { p95_latency_ms: 5234, queue_depth: 150 });
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDetector: auto-escalation threshold works for P1 incidents", () => {
  const ctx = createIntegrationContext("aa-incident-detect-escalate-");
  try {
    const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

    // P1 that hasn't exceeded threshold
    const recentP1 = new Date(Date.now() - 100 * 1000).toISOString();
    assert.strictEqual(detector.shouldAutoEscalate(recentP1, "p1"), false);

    // P1 that has exceeded threshold
    const oldP1 = new Date(Date.now() - 400 * 1000).toISOString();
    assert.strictEqual(detector.shouldAutoEscalate(oldP1, "p1"), true);

    // Non-P1 incidents should never auto-escalate
    assert.strictEqual(detector.shouldAutoEscalate(oldP1, "p2"), false);
    assert.strictEqual(detector.shouldAutoEscalate(oldP1, "p3"), false);
    assert.strictEqual(detector.shouldAutoEscalate(oldP1, "p4"), false);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDetector: classifyUrgency returns correct urgency levels", () => {
  const ctx = createIntegrationContext("aa-incident-detect-urgency-");
  try {
    const detector = new IncidentDetector();

    assert.strictEqual(detector.classifyUrgency("p1"), "critical");
    assert.strictEqual(detector.classifyUrgency("p2"), "high");
    assert.strictEqual(detector.classifyUrgency("p3"), "medium");
    assert.strictEqual(detector.classifyUrgency("p4"), "low");
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDetector: handles mixed severity checks from health report", () => {
  const ctx = createIntegrationContext("aa-incident-detect-mixed-");
  try {
    const detector = new IncidentDetector();

    const checks = [
      { checkId: "db", status: "fail_closed", summary: "DB down", findings: ["db_write_probe_failed"], metrics: {} },
      { checkId: "workers", status: "degraded", summary: "Some workers stale", findings: ["stale_workers_detected"], metrics: {} },
      { checkId: "backup", status: "ok", summary: "Backup healthy", findings: [], metrics: {} },
    ];

    const incidents = detector.detectFromChecks(checks);

    assert.strictEqual(incidents.length, 2);
    assert.strictEqual(incidents.filter((i) => i.severity === "p1").length, 1);
    assert.strictEqual(incidents.filter((i) => i.severity === "p2").length, 1);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDetector: default options provide sensible thresholds", () => {
  const ctx = createIntegrationContext("aa-incident-detect-defaults-");
  try {
    const detector = new IncidentDetector();

    assert.strictEqual(detector.classifyUrgency("p1"), "critical");

    // Should not escalate non-P1
    const detectedAt = new Date(Date.now() - 10000 * 1000).toISOString();
    assert.strictEqual(detector.shouldAutoEscalate(detectedAt, "p2"), false);
    assert.strictEqual(detector.shouldAutoEscalate(detectedAt, "p3"), false);
    assert.strictEqual(detector.shouldAutoEscalate(detectedAt, "p4"), false);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDetector: createIncident uses sensible defaults", () => {
  const ctx = createIntegrationContext("aa-incident-detect-simple-");
  try {
    const detector = new IncidentDetector();

    const incident = detector.createIncident({
      category: "availability",
      severity: "p2",
      title: "Workers degraded",
      description: "Worker fleet is operating at reduced capacity",
    });

    assert.strictEqual(incident.sourceCheckId, null);
    assert.deepStrictEqual(incident.affectedEntities, []);
    assert.deepStrictEqual(incident.symptoms, []);
    assert.deepStrictEqual(incident.metrics, {});
    assert.strictEqual(incident.status, "open");
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDetector: detects incidents from degraded checks with P2 severity", () => {
  const ctx = createIntegrationContext("aa-incident-detect-degraded-");
  try {
    const detector = new IncidentDetector();

    const checks = [
      { checkId: "workers", status: "degraded", summary: "Stale workers detected", findings: ["stale_workers_detected"], metrics: {} },
      { checkId: "event_backlog", status: "degraded", summary: "Event backlog growing", findings: ["queue_starvation_detected"], metrics: {} },
    ];

    const incidents = detector.detectFromChecks(checks);

    assert.strictEqual(incidents.length, 2);
    assert.ok(incidents.every((i) => i.severity === "p2"), "Degraded checks should produce P2");
    assert.ok(incidents.every((i) => i.status === "open"), "All should be open");
  } finally {
    ctx.cleanup();
  }
});

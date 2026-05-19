import assert from "node:assert/strict";
import test from "node:test";
import { IncidentDetector, } from "../../../../../src/platform/control-plane/incident-control/incident-detector.js";
test("IncidentDetector detects incidents from fail_closed checks as P1", () => {
    const detector = new IncidentDetector();
    const checks = [
        {
            checkId: "db",
            status: "fail_closed",
            summary: "Database is not writable",
            findings: ["db_write_probe_failed"],
            metrics: { dbWritable: false },
        },
    ];
    const incidents = detector.detectFromChecks(checks);
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].severity, "p1");
    assert.equal(incidents[0].category, "data_integrity");
    assert.equal(incidents[0].status, "open");
    assert.equal(incidents[0].title, "Critical failure in db");
});
test("IncidentDetector detects incidents from degraded checks as P2", () => {
    const detector = new IncidentDetector();
    const checks = [
        {
            checkId: "workers",
            status: "degraded",
            summary: "Some workers are unhealthy",
            findings: ["stale_workers_detected"],
            metrics: { staleWorkers: 2 },
        },
    ];
    const incidents = detector.detectFromChecks(checks);
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].severity, "p2");
    assert.equal(incidents[0].category, "availability");
});
test("IncidentDetector creates incidents with correct structure", () => {
    const detector = new IncidentDetector();
    const incident = detector.createIncident({
        category: "performance",
        severity: "p3",
        title: "High latency detected",
        description: "P95 latency exceeds threshold",
        sourceCheckId: "event_backlog",
        symptoms: ["queue_starvation_detected"],
        affectedEntities: ["queue:default"],
        metrics: { p95_latency_ms: 5000 },
    });
    assert.match(incident.incidentId, /^incident_/);
    assert.equal(incident.detectedAt.length, 24); // ISO timestamp
    assert.equal(incident.category, "performance");
    assert.equal(incident.severity, "p3");
    assert.equal(incident.status, "open");
    assert.equal(incident.title, "High latency detected");
    assert.deepEqual(incident.symptoms, ["queue_starvation_detected"]);
    assert.deepEqual(incident.affectedEntities, ["queue:default"]);
    assert.deepEqual(incident.metrics, { p95_latency_ms: 5000 });
});
test("IncidentDetector classifies urgency correctly for all severity levels", () => {
    const detector = new IncidentDetector();
    assert.equal(detector.classifyUrgency("p1"), "critical");
    assert.equal(detector.classifyUrgency("p2"), "high");
    assert.equal(detector.classifyUrgency("p3"), "medium");
    assert.equal(detector.classifyUrgency("p4"), "low");
});
test("IncidentDetector shouldAutoEscalate returns true for P1 after threshold", () => {
    const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });
    const oldP1DetectedAt = new Date(Date.now() - 400 * 1000).toISOString();
    assert.equal(detector.shouldAutoEscalate(oldP1DetectedAt, "p1"), true);
    const recentP1DetectedAt = new Date(Date.now() - 100 * 1000).toISOString();
    assert.equal(detector.shouldAutoEscalate(recentP1DetectedAt, "p1"), false);
});
test("IncidentDetector shouldAutoEscalate returns false for non-P1 incidents", () => {
    const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });
    const detectedAt = new Date(Date.now() - 1000 * 1000).toISOString();
    assert.equal(detector.shouldAutoEscalate(detectedAt, "p2"), false);
    assert.equal(detector.shouldAutoEscalate(detectedAt, "p3"), false);
    assert.equal(detector.shouldAutoEscalate(detectedAt, "p4"), false);
});
test("IncidentDetector maps check IDs to correct categories", () => {
    const detector = new IncidentDetector();
    const checks = [
        { checkId: "db", status: "fail_closed", summary: "", findings: [], metrics: {} },
        { checkId: "config", status: "fail_closed", summary: "", findings: [], metrics: {} },
        { checkId: "backup", status: "fail_closed", summary: "", findings: [], metrics: {} },
        { checkId: "locks", status: "fail_closed", summary: "", findings: [], metrics: {} },
        { checkId: "workers", status: "fail_closed", summary: "", findings: [], metrics: {} },
        { checkId: "event_backlog", status: "fail_closed", summary: "", findings: [], metrics: {} },
        { checkId: "audit_integrity", status: "fail_closed", summary: "", findings: [], metrics: {} },
        { checkId: "provider_health", status: "fail_closed", summary: "", findings: [], metrics: {} },
        { checkId: "unknown_check", status: "fail_closed", summary: "", findings: [], metrics: {} },
    ];
    const incidents = detector.detectFromChecks(checks);
    const categoryMap = {
        db: "data_integrity",
        config: "configuration",
        backup: "availability",
        locks: "data_integrity",
        workers: "availability",
        event_backlog: "performance",
        audit_integrity: "security",
        provider_health: "availability",
        unknown_check: "system_health",
    };
    for (const incident of incidents) {
        const expectedCategory = categoryMap[incident.sourceCheckId];
        assert.equal(incident.category, expectedCategory, `checkId ${incident.sourceCheckId} should map to ${expectedCategory}`);
    }
});
test("IncidentDetector handles empty checks array", () => {
    const detector = new IncidentDetector();
    const incidents = detector.detectFromChecks([]);
    assert.equal(incidents.length, 0);
});
test("IncidentDetector handles checks with no findings", () => {
    const detector = new IncidentDetector();
    const checks = [
        {
            checkId: "db",
            status: "ok",
            summary: "Database is healthy",
            findings: [],
            metrics: { dbWritable: true },
        },
    ];
    const incidents = detector.detectFromChecks(checks);
    assert.equal(incidents.length, 0);
});
test("IncidentDetector detects multiple incidents from multiple checks", () => {
    const detector = new IncidentDetector();
    const checks = [
        {
            checkId: "db",
            status: "fail_closed",
            summary: "Database failure",
            findings: ["db_write_probe_failed"],
            metrics: {},
        },
        {
            checkId: "workers",
            status: "degraded",
            summary: "Worker issues",
            findings: ["stale_workers_detected"],
            metrics: {},
        },
        {
            checkId: "provider_health",
            status: "fail_closed",
            summary: "Provider missing",
            findings: ["provider_missing"],
            metrics: {},
        },
    ];
    const incidents = detector.detectFromChecks(checks);
    assert.equal(incidents.length, 3);
    assert.equal(incidents.filter((i) => i.severity === "p1").length, 2);
    assert.equal(incidents.filter((i) => i.severity === "p2").length, 1);
});
test("IncidentDetector options are applied correctly", () => {
    const detector = new IncidentDetector({
        maxOpenIncidents: 50,
        autoEscalateP1AfterSeconds: 600,
    });
    const checks = [
        {
            checkId: "db",
            status: "fail_closed",
            summary: "Database failure",
            findings: [],
            metrics: {},
        },
    ];
    const incidents = detector.detectFromChecks(checks);
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].severity, "p1");
});
test("IncidentDetector creates incident with default values", () => {
    const detector = new IncidentDetector();
    const incident = detector.createIncident({
        category: "availability",
        severity: "p2",
        title: "Test incident",
        description: "Test description",
    });
    assert.equal(incident.sourceCheckId, null);
    assert.deepEqual(incident.affectedEntities, []);
    assert.deepEqual(incident.symptoms, []);
    assert.deepEqual(incident.metrics, {});
});
//# sourceMappingURL=incident-detector.test.js.map
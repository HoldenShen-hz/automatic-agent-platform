import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentDetector,
  type IncidentSeverity,
} from "../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";
import {
  AutoStopLossService,
  type SystemHealthSnapshot,
} from "../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";

test.describe("Incident Control E2E Flow", () => {
  test("complete incident lifecycle: detection -> classification -> escalation", () => {
    const detector = new IncidentDetector();

    const incidents = detector.detectFromChecks([
      {
        checkId: "db",
        status: "fail_closed",
        summary: "Database unavailable",
        findings: ["db_write_probe_failed"],
        metrics: { dbWritable: false },
      },
    ]);

    assert.ok(incidents.length > 0);
    const incident = incidents[0]!;
    assert.equal(incident.severity, "SEV1");
    assert.equal(incident.status, "open");
    assert.equal(detector.classifyUrgency(incident.severity), "critical");
    assert.equal(detector.shouldAutoEscalate(incident.detectedAt, incident.severity), false);
  });

  test("lower-severity incidents stay low urgency and do not auto-escalate", () => {
    const detector = new IncidentDetector();

    const incident = detector.createIncident({
      category: "performance",
      severity: "SEV4",
      title: "Minor degradation",
      description: "Minor performance issue",
      sourceCheckId: "event_backlog",
      symptoms: ["minor_latency_spike"],
      metrics: { error_rate: 0.02 },
    });

    assert.equal(incident.severity, "SEV4");
    assert.equal(incident.status, "open");
    assert.equal(detector.classifyUrgency("SEV4"), "low");
    assert.equal(detector.shouldAutoEscalate(incident.detectedAt, "SEV4"), false);
  });

  test("health check to auto-stop-loss integration", () => {
    const autoStopLoss = new AutoStopLossService();

    const snapshot: SystemHealthSnapshot = {
      status: "overloaded",
      anomalySeverity: "critical",
      activeExecutions: 50,
      queuedTasks: 200,
      memoryUsageMb: 2048,
      eventLoopLagMs: 100,
      providerHealth: "degraded",
    };

    autoStopLoss.updateHealthCheck(snapshot);

    const lastCheck = autoStopLoss.getLastHealthCheck();
    assert.ok(lastCheck);
    assert.equal(lastCheck.status, "overloaded");
    assert.equal(typeof autoStopLoss.getExecutionStats().totalExecutions, "number");
  });

  test("multi-severity incident detection from health report", () => {
    const detector = new IncidentDetector();

    const incidents = detector.detectFromChecks([
      { checkId: "db", status: "fail_closed", summary: "DB down", findings: [], metrics: {} },
      { checkId: "workers", status: "degraded", summary: "Workers degraded", findings: [], metrics: {} },
      {
        checkId: "config",
        status: "warning",
        summary: "Configuration drift detected",
        findings: [],
        metrics: { config_drift_detected: true },
      },
    ]);

    const severities = incidents.map((incident) => incident.severity);
    assert.ok(incidents.length >= 3);
    assert.ok(severities.includes("SEV1"));
    assert.ok(severities.includes("SEV2"));
    assert.ok(severities.includes("SEV3"));
  });

  test("incident severity mapping to urgency remains stable", () => {
    const detector = new IncidentDetector();

    const testCases: Array<{ severity: IncidentSeverity; expected: "critical" | "high" | "medium" | "low" }> = [
      { severity: "SEV1", expected: "critical" },
      { severity: "SEV2", expected: "high" },
      { severity: "SEV3", expected: "medium" },
      { severity: "SEV4", expected: "low" },
    ];

    for (const { severity, expected } of testCases) {
      assert.equal(detector.classifyUrgency(severity), expected);
    }
  });

  test("auto-stop-loss playbook execution flow", () => {
    const autoStopLoss = new AutoStopLossService();

    const result = autoStopLoss.evaluateAnomaly("critical", "memory_usage_mb", {
      memoryUsageMb: 2048,
      healthStatus: "overloaded",
    });

    assert.equal(typeof result.shouldExecute, "boolean");
    assert.ok(Array.isArray(result.matchingPlaybooks));
    assert.ok(["observe", "warn", "act", "critical"].includes(result.escalation));
  });

  test("health status to escalation level mapping", () => {
    const autoStopLoss = new AutoStopLossService();

    const testCases: Array<{ status: SystemHealthSnapshot["status"]; expectedEscalation: string }> = [
      { status: "ok", expectedEscalation: "observe" },
      { status: "degraded", expectedEscalation: "warn" },
      { status: "overloaded", expectedEscalation: "act" },
      { status: "unhealthy", expectedEscalation: "critical" },
    ];

    for (const { status, expectedEscalation } of testCases) {
      assert.equal(autoStopLoss.evaluateHealth(status).escalation, expectedEscalation);
    }
  });
});

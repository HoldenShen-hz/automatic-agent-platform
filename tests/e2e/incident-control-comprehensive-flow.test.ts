/**
 * E2E Test: Incident Control Flow
 * Tests complete incident lifecycle from detection through resolution
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  IncidentDetector,
  type IncidentDetection,
  type IncidentSeverity,
// @ts-ignore
  type RunbookPriority,
} from "../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";
import {
  AutoStopLossService,
  type SystemHealthSnapshot,
} from "../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";

test.describe("Incident Control E2E Flow", () => {
  test("complete incident lifecycle: detection -> classification -> escalation", () => {
    // Step 1: Detect incident from health check
    const detector = new IncidentDetector();

    const checks = [
      {
        checkId: "db",
        status: "fail_closed",
        summary: "Database unavailable",
        findings: ["db_write_probe_failed"],
        metrics: { dbWritable: false },
      },
    ];

    const incidents = detector.detectFromChecks(checks);
    assert.ok(incidents.length > 0);

    const incident = incidents[0]!;
    assert.equal(incident.severity, "SEV1");
// @ts-ignore
    assert.equal(incident.runbookPriority, "P0");
    assert.equal(incident.status, "open");

    // Step 2: Classify urgency
    const urgency = detector.classifyUrgency(incident.severity);
    assert.equal(urgency, "critical");

    // Step 3: Check if should auto-escalate
    const shouldEscalate = detector.shouldAutoEscalate(incident.detectedAt, incident.severity);
    // Recent detection shouldn't trigger auto-escalate
    assert.equal(shouldEscalate, false);
  });

  test("P3/P4 incident flow with lower priority", () => {
    const detector = new IncidentDetector();

    // Create a P3 incident
    const p3Incident = detector.createIncident({
      category: "performance",
// @ts-ignore
      severity: "SEV4",
      title: "Minor degradation",
      description: "Minor performance issue",
      sourceCheckId: "event_backlog",
      symptoms: ["minor_latency_spike"],
      metrics: { error_rate: 0.02 },
    });

    assert.equal(p3Incident.severity, "SEV4");
// @ts-ignore
    assert.equal(p3Incident.runbookPriority, "P3");
    assert.equal(p3Incident.status, "open");

    // Classify urgency for P3
// @ts-ignore
    const urgency = detector.classifyUrgency("SEV4");
    assert.equal(urgency, "low");

    // P3/P4 should not auto-escalate
// @ts-ignore
    const shouldEscalate = detector.shouldAutoEscalate(p3Incident.detectedAt, "SEV4");
    assert.equal(shouldEscalate, false);
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

    // Update health check - should trigger evaluation
    autoStopLoss.updateHealthCheck(snapshot);

    // Verify health check was recorded
    const lastCheck = autoStopLoss.getLastHealthCheck();
    assert.ok(lastCheck);
    assert.equal(lastCheck.status, "overloaded");

    // Get stats to verify evaluation happened
    const stats = autoStopLoss.getExecutionStats();
    assert.ok(typeof stats.totalExecutions === "number");
  });

  test("multi-severity incident detection from health report", () => {
    const detector = new IncidentDetector();

    const healthReport = [
      { checkId: "db", status: "fail_closed", summary: "DB down", findings: [], metrics: {} },
      { checkId: "workers", status: "degraded", summary: "Workers degraded", findings: [], metrics: {} },
      { checkId: "cache", status: "warning", summary: "Cache miss rate up", findings: [], metrics: { error_rate: 0.06 } },
    ];

    const incidents = detector.detectFromChecks(healthReport);

    // Should detect at least 3 incidents with different severities
    assert.ok(incidents.length >= 3);

    const severities = incidents.map((i) => i.severity);
// @ts-ignore
    assert.ok(severities.includes("SEV1"));
// @ts-ignore
    assert.ok(severities.includes("SEV2"));
// @ts-ignore
    assert.ok(severities.includes("SEV3"));
  });

  test("incident severity mapping to runbook priority", () => {
    const detector = new IncidentDetector();

    const testCases: Array<{ severity: IncidentSeverity; expectedPriority: RunbookPriority }> = [
// @ts-ignore
      { severity: "SEV1", expectedPriority: "P0" },
// @ts-ignore
      { severity: "SEV2", expectedPriority: "P1" },
// @ts-ignore
      { severity: "SEV3", expectedPriority: "P2" },
// @ts-ignore
      { severity: "SEV4", expectedPriority: "P3" },
    ];

    for (const { severity, expectedPriority } of testCases) {
      const incident = detector.createIncident({
        category: "system_health",
        severity,
        title: `Test ${severity}`,
        description: "Test",
      });
      assert.equal(
// @ts-ignore
        incident.runbookPriority,
        expectedPriority,
        `${severity} should map to ${expectedPriority}`
      );
    }
  });

  test("auto-stop-loss playbook execution flow", async () => {
    const autoStopLoss = new AutoStopLossService();

    // Trigger anomaly evaluation
    const result = autoStopLoss.evaluateAnomaly("critical", "memory_usage_mb", {
      memoryUsageMb: 2048,
      healthStatus: "overloaded",
    });

    assert.ok(typeof result.shouldExecute === "boolean");
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
      const result = autoStopLoss.evaluateHealth(status);
      assert.equal(
        result.escalation,
        expectedEscalation,
        `${status} should map to ${expectedEscalation}`
      );
    }
  });
});

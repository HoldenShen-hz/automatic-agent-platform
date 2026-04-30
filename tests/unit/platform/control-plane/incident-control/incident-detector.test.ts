/**
 * Unit tests for IncidentDetector
 * Issue #2125: Must create P3/P4 incidents, not only P1/P2
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  IncidentDetector,
  type IncidentDetection,
  type IncidentSeverity,
  type RunbookPriority,
} from "../../../../../src/platform/control-plane/incident-control/incident-detector.js";

test.describe("IncidentDetector", () => {
  test("should create SEV3 (P2) incidents from warning threshold detection", () => {
    const detector = new IncidentDetector();

    // Create a check that triggers sev3_warning_threshold rule
    // error_rate >= 0.05 triggers SEV3
    const checks = [
      {
        checkId: "test_check",
        status: "warning",
        summary: "Error rate threshold approaching",
        findings: ["error_rate_spike"],
        metrics: { error_rate: 0.06 },
      },
    ];

    const incidents = detector.detectFromChecks(checks);

    // Find SEV3 incidents
    const sev3Incidents = incidents.filter((i) => i.severity === "SEV3");
    assert.ok(sev3Incidents.length > 0, "Should create SEV3 incident for warning threshold");

    const sev3Incident = sev3Incidents[0]!;
    assert.equal(sev3Incident.runbookPriority, "P2", "SEV3 should map to P2 runbook priority");
    assert.equal(sev3Incident.category, "system_health");
  });

  test("should create SEV4 (P3) incidents from info anomaly detection", () => {
    const detector = new IncidentDetector();

    // Create a check that triggers sev4_info_anomaly rule
    // error_rate >= 0.01 triggers SEV4
    const checks = [
      {
        checkId: "test_check",
        status: "warning",
        summary: "Minor anomaly detected",
        findings: ["minor_issue"],
        metrics: { error_rate: 0.02 },
      },
    ];

    const incidents = detector.detectFromChecks(checks);

    // Find SEV4 incidents
    const sev4Incidents = incidents.filter((i) => i.severity === "SEV4");
    assert.ok(sev4Incidents.length > 0, "Should create SEV4 incident for info anomaly");

    const sev4Incident = sev4Incidents[0]!;
    assert.equal(sev4Incident.runbookPriority, "P3", "SEV4 should map to P3 runbook priority");
  });

  test("should create incidents for all severity levels (SEV1-SEV4)", () => {
    const detector = new IncidentDetector();

    // Test each severity level creates appropriate incidents
    const checks = [
      {
        checkId: "db",
        status: "fail_closed",
        summary: "Critical failure",
        findings: ["critical_failure"],
        metrics: {},
      },
      {
        checkId: "workers",
        status: "degraded",
        summary: "Degraded performance",
        findings: ["degraded"],
        metrics: {},
      },
      {
        checkId: "event_backlog",
        status: "warning",
        summary: "Warning threshold",
        findings: ["warning"],
        metrics: { error_rate: 0.06 },
      },
      {
        checkId: "test_check",
        status: "warning",
        summary: "Minor anomaly",
        findings: ["minor"],
        metrics: { error_rate: 0.02 },
      },
    ];

    const incidents = detector.detectFromChecks(checks);

    const hasSev1 = incidents.some((i) => i.severity === "SEV1");
    const hasSev2 = incidents.some((i) => i.severity === "SEV2");
    const hasSev3 = incidents.some((i) => i.severity === "SEV3");
    const hasSev4 = incidents.some((i) => i.severity === "SEV4");

    assert.ok(hasSev1, "Should create SEV1 incident");
    assert.ok(hasSev2, "Should create SEV2 incident");
    assert.ok(hasSev3, "Should create SEV3 incident");
    assert.ok(hasSev4, "Should create SEV4 incident");
  });

  test("SEV1 maps to P0 runbook priority", () => {
    const detector = new IncidentDetector();
    const incident = detector.createIncident({
      category: "system_health",
      severity: "SEV1",
      title: "Critical incident",
      description: "Critical issue",
    });
    assert.equal(incident.runbookPriority, "P0");
  });

  test("SEV2 maps to P1 runbook priority", () => {
    const detector = new IncidentDetector();
    const incident = detector.createIncident({
      category: "system_health",
      severity: "SEV2",
      title: "High priority incident",
      description: "High priority issue",
    });
    assert.equal(incident.runbookPriority, "P1");
  });

  test("SEV3 maps to P2 runbook priority", () => {
    const detector = new IncidentDetector();
    const incident = detector.createIncident({
      category: "system_health",
      severity: "SEV3",
      title: "Medium priority incident",
      description: "Medium priority issue",
    });
    assert.equal(incident.runbookPriority, "P2");
  });

  test("SEV4 maps to P3 runbook priority", () => {
    const detector = new IncidentDetector();
    const incident = detector.createIncident({
      category: "system_health",
      severity: "SEV4",
      title: "Low priority incident",
      description: "Low priority issue",
    });
    assert.equal(incident.runbookPriority, "P3");
  });

  test("classifyUrgency returns correct mapping for SEV1-SEV4", () => {
    const detector = new IncidentDetector();

    assert.equal(detector.classifyUrgency("SEV1"), "critical");
    assert.equal(detector.classifyUrgency("SEV2"), "high");
    assert.equal(detector.classifyUrgency("SEV3"), "medium");
    assert.equal(detector.classifyUrgency("SEV4"), "low");
  });

  test("createIncident generates unique incident IDs", () => {
    const detector = new IncidentDetector();
    const incident1 = detector.createIncident({
      category: "system_health",
      severity: "SEV1",
      title: "Test 1",
      description: "Test",
    });
    const incident2 = detector.createIncident({
      category: "system_health",
      severity: "SEV2",
      title: "Test 2",
      description: "Test",
    });

    assert.notEqual(incident1.incidentId, incident2.incidentId);
    assert.match(incident1.incidentId, /^incident_/);
  });

  test("shouldAutoEscalate only returns true for SEV1 after threshold", () => {
    const detector = new IncidentDetector({ autoEscalateSev1AfterSeconds: 300 });

    const oldSev1DetectedAt = new Date(Date.now() - 400 * 1000).toISOString();
    const recentSev1DetectedAt = new Date(Date.now() - 100 * 1000).toISOString();

    assert.equal(detector.shouldAutoEscalate(oldSev1DetectedAt, "SEV1"), true);
    assert.equal(detector.shouldAutoEscalate(recentSev1DetectedAt, "SEV1"), false);
    assert.equal(detector.shouldAutoEscalate(oldSev1DetectedAt, "SEV2"), false);
    assert.equal(detector.shouldAutoEscalate(oldSev1DetectedAt, "SEV3"), false);
    assert.equal(detector.shouldAutoEscalate(oldSev1DetectedAt, "SEV4"), false);
  });

  test("custom rules can be added and evaluated", () => {
    const detector = new IncidentDetector();

    detector.addRule({
      ruleId: "custom_rule",
      name: "Custom Rule",
      description: "Custom detection rule",
      severity: "SEV3",
      condition: {
        type: "metric_threshold",
        metricName: "custom_metric",
        operator: "gte",
        threshold: 10,
      },
      autoAction: "log_alert",
      enabled: true,
    });

    const rules = detector.getRules();
    assert.ok(rules.some((r) => r.ruleId === "custom_rule"));
  });

  test("evaluateRule returns matching rule for threshold breach", () => {
    const detector = new IncidentDetector();

    const matchedRule = detector.evaluateRule({
      checkId: "test",
      status: "warning",
      summary: "Test",
      findings: [],
      metrics: { error_rate: 0.1 },
    });

    assert.ok(matchedRule !== null);
    assert.equal(matchedRule!.severity, "SEV3");
  });

  test("evaluateRule returns null when no rule matches", () => {
    const detector = new IncidentDetector();

    const matchedRule = detector.evaluateRule({
      checkId: "test",
      status: "ok",
      summary: "All good",
      findings: [],
      metrics: { error_rate: 0.0 },
    });

    assert.equal(matchedRule, null);
  });
});

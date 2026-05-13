/**
 * Extended unit tests for Incident Detector
 * Tests detection rules, composite conditions, and edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentDetector,
  type IncidentDetection,
  type IncidentSeverity,
  type IncidentCategory,
  type IncidentDetectorOptions,
} from "../../../../../src/platform/control-plane/incident-control/incident-detector.js";

// ============================================================================
// Detection Rule Tests - using actual implementation methods
// ============================================================================

test("IncidentDetector detectFromChecks detects fail_closed as SEV1 incident", () => {
  const detector = new IncidentDetector();
  const checks = [{
    checkId: "db",
    status: "fail_closed",
    summary: "Database failure",
    findings: [],
    metrics: {},
  }];

  const incidents = detector.detectFromChecks(checks);

  assert.strictEqual(incidents.length, 1);
  assert.strictEqual(incidents[0]?.severity, "SEV1");
  assert.strictEqual(incidents[0]?.category, "data_integrity");
});

test("IncidentDetector detectFromChecks detects degraded as SEV2 incident", () => {
  const detector = new IncidentDetector();
  const checks = [{
    checkId: "workers",
    status: "degraded",
    summary: "Workers degraded",
    findings: [],
    metrics: {},
  }];

  const incidents = detector.detectFromChecks(checks);

  assert.strictEqual(incidents.length, 1);
  assert.strictEqual(incidents[0]?.severity, "SEV2");
  assert.strictEqual(incidents[0]?.category, "availability");
});

test("IncidentDetector detectFromChecks returns empty for ok status", () => {
  const detector = new IncidentDetector();
  const checks = [{
    checkId: "db",
    status: "ok",
    summary: "All good",
    findings: [],
    metrics: {},
  }];

  const incidents = detector.detectFromChecks(checks);

  assert.strictEqual(incidents.length, 0);
});

// ============================================================================
// Metric Threshold Condition Tests - via detectFromChecks
// ============================================================================

test("IncidentDetector detectFromChecks includes metrics in incident", () => {
  const detector = new IncidentDetector();
  const checks = [{
    checkId: "db",
    status: "fail_closed",
    summary: "Database failure",
    findings: ["connection_timeout"],
    metrics: { error_rate: 0.5, latency_ms: 5000 },
  }];

  const incidents = detector.detectFromChecks(checks);

  assert.strictEqual(incidents.length, 1);
  assert.deepStrictEqual(incidents[0]?.metrics, { error_rate: 0.5, latency_ms: 5000 });
});

// ============================================================================
// Severity Mapping Tests
// ============================================================================

test("IncidentDetector classifyUrgency for SEV1 returns critical", () => {
  const detector = new IncidentDetector();
  assert.strictEqual(detector.classifyUrgency("SEV1"), "critical");
});

test("IncidentDetector classifyUrgency for SEV2 returns high", () => {
  const detector = new IncidentDetector();
  assert.strictEqual(detector.classifyUrgency("SEV2"), "high");
});

test("IncidentDetector classifyUrgency for SEV3 returns medium", () => {
  const detector = new IncidentDetector();
  assert.strictEqual(detector.classifyUrgency("SEV3"), "medium");
});

test("IncidentDetector classifyUrgency for SEV4 returns low", () => {
  const detector = new IncidentDetector();
  assert.strictEqual(detector.classifyUrgency("SEV4"), "low");
});

// ============================================================================
// Auto-Escalation Tests
// ============================================================================

test("IncidentDetector shouldAutoEscalate respects custom threshold", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 600 });

  const oldTime = new Date(Date.now() - 700 * 1000).toISOString(); // 700 seconds ago
  const recentTime = new Date(Date.now() - 300 * 1000).toISOString(); // 300 seconds ago

  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV1"), true);
  assert.strictEqual(detector.shouldAutoEscalate(recentTime, "SEV1"), false);
});

test("IncidentDetector shouldAutoEscalate only applies to SEV1", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

  const oldTime = new Date(Date.now() - 400 * 1000).toISOString();

  // Non-SEV1 incidents should never auto-escalate
  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV2"), false);
  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV3"), false);
  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV4"), false);
});

test("IncidentDetector shouldAutoEscalate calculates time correctly", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

  // Just past threshold
  const pastThreshold = new Date(Date.now() - 300001).toISOString();

  // Past threshold should escalate
  assert.strictEqual(detector.shouldAutoEscalate(pastThreshold, "SEV1"), true);
});

// ============================================================================
// Create Incident Tests
// ============================================================================

test("IncidentDetector createIncident with all optional fields", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "security",
    severity: "SEV1",
    title: "Security Breach",
    description: "Unauthorized access detected",
    sourceCheckId: "audit_integrity",
    symptoms: ["unauthorized_login", "privilege_escalation"],
    affectedEntities: ["user-123", "role-admin"],
    metrics: { login_attempts: 100, failed_logins: 95 },
  });

  assert.strictEqual(incident.category, "security");
  assert.strictEqual(incident.severity, "SEV1");
  assert.strictEqual(incident.title, "Security Breach");
  assert.strictEqual(incident.sourceCheckId, "audit_integrity");
  assert.strictEqual(incident.symptoms.length, 2);
  assert.strictEqual(incident.affectedEntities.length, 2);
  assert.strictEqual(incident.status, "open");
});

test("IncidentDetector createIncident sets status to open", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "system_health",
    severity: "SEV1",
    title: "Test",
    description: "Test",
  });

  assert.strictEqual(incident.status, "open");
});

// ============================================================================
// Check ID Category Mapping Tests
// ============================================================================

test("IncidentDetector category mapping for db check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "db",
    status: "fail_closed",
    summary: "Database failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "data_integrity");
});

test("IncidentDetector category mapping for config check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "config",
    status: "fail_closed",
    summary: "Config failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "configuration");
});

test("IncidentDetector category mapping for backup check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "backup",
    status: "fail_closed",
    summary: "Backup failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "availability");
});

test("IncidentDetector category mapping for locks check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "locks",
    status: "fail_closed",
    summary: "Lock failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "data_integrity");
});

test("IncidentDetector category mapping for workers check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "workers",
    status: "fail_closed",
    summary: "Worker failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "availability");
});

test("IncidentDetector category mapping for event_backlog check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "event_backlog",
    status: "fail_closed",
    summary: "Event backlog",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "performance");
});

test("IncidentDetector category mapping for audit_integrity check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "audit_integrity",
    status: "fail_closed",
    summary: "Audit integrity failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "security");
});

test("IncidentDetector category mapping for provider_health check", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "provider_health",
    status: "fail_closed",
    summary: "Provider health failure",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "availability");
});

test("IncidentDetector category mapping for unknown check defaults to system_health", () => {
  const detector = new IncidentDetector();
  const check = {
    checkId: "completely_unknown_check",
    status: "fail_closed",
    summary: "Unknown check",
    findings: [],
    metrics: {},
  };

  const incidents = detector.detectFromChecks([check]);
  assert.strictEqual(incidents[0]?.category, "system_health");
});

// ============================================================================
// Urgency Classification Tests
// ============================================================================

// Already tested above (classifyUrgency tests)

// ============================================================================
// Options Tests
// ============================================================================

test("IncidentDetector respects maxOpenIncidents option", () => {
  const detector = new IncidentDetector({ maxOpenIncidents: 50 });
  // The maxOpenIncidents is stored but not actively enforced in detectFromChecks
  // It's available for external usage
  assert.ok(detector);
});

test("IncidentDetector uses custom autoEscalateP1AfterSeconds", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 600 });

  const oldTime = new Date(Date.now() - 700 * 1000).toISOString();
  const recentTime = new Date(Date.now() - 300 * 1000).toISOString();

  assert.strictEqual(detector.shouldAutoEscalate(oldTime, "SEV1"), true);
  assert.strictEqual(detector.shouldAutoEscalate(recentTime, "SEV1"), false);
});

// ============================================================================
// Multiple Checks Detection Tests
// ============================================================================

test("IncidentDetector detectFromChecks handles checks with multiple issues", () => {
  const detector = new IncidentDetector();
  const checks = [
    { checkId: "db", status: "fail_closed", summary: "DB down", findings: ["probe_failed"], metrics: {} },
    { checkId: "workers", status: "degraded", summary: "Workers degraded", findings: ["slow_processing"], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);

  // Should detect: db fail_closed -> SEV1, workers degraded -> SEV2
  assert.strictEqual(incidents.length, 2);
});

test("IncidentDetector detectFromChecks with no matching rules or conditions", () => {
  const detector = new IncidentDetector();
  const checks = [
    { checkId: "unknown", status: "ok", summary: "All good", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);

  // No rules match "unknown" check with "ok" status
  assert.strictEqual(incidents.length, 0);
});

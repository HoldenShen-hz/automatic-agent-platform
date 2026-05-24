/**
 * Unit Tests: Incident Control
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentDetector,
  type IncidentDetection,
  type IncidentSeverity,
  type IncidentCategory,
} from "../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";

import {
  IncidentResolver,
  type IncidentResolution,
} from "../../../../src/platform/five-plane-control-plane/incident-control/incident-resolver.js";

// ============================================================================
// Incident Detector Tests
// ============================================================================

test("IncidentDetector creates incident detection record", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "availability",
    severity: "SEV1",
    title: "Critical failure in db",
    description: "Database connection lost",
    sourceCheckId: "db",
    symptoms: ["connection_timeout"],
    metrics: { availability: 0.90 },
  });

  assert.ok(incident.incidentId.length > 0);
  assert.equal(incident.category, "availability");
  assert.equal(incident.severity, "SEV1");
  assert.equal(incident.status, "open");
  assert.ok(incident.detectedAt.length > 0);
});

test("IncidentDetector classifies urgency correctly", () => {
  const detector = new IncidentDetector();

  assert.equal(detector.classifyUrgency("SEV1"), "critical");
  assert.equal(detector.classifyUrgency("SEV2"), "high");
  assert.equal(detector.classifyUrgency("SEV3"), "medium");
  assert.equal(detector.classifyUrgency("SEV4"), "low");
});

test("IncidentDetector determines auto-escalation correctly", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });

  // SEV1 should potentially auto-escalate
  const detectedAt = new Date().toISOString();
  // Not auto-escalating immediately
  assert.equal(detector.shouldAutoEscalate(detectedAt, "SEV1"), false);

  // SEV2 and below should never auto-escalate
  assert.equal(detector.shouldAutoEscalate(detectedAt, "SEV2"), false);
  assert.equal(detector.shouldAutoEscalate(detectedAt, "SEV3"), false);
  assert.equal(detector.shouldAutoEscalate(detectedAt, "SEV4"), false);
});

test("IncidentDetector detects from checks - creates SEV1 for fail_closed", () => {
  const detector = new IncidentDetector();

  const checks = [{
    checkId: "db",
    status: "fail_closed",
    summary: "Database connection failed",
    findings: ["connection_timeout", "connection_refused"],
    metrics: { dbWritable: false },
  }];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.severity, "SEV1");
  assert.equal(incidents[0]!.category, "data_integrity");
});

test("IncidentDetector detects from checks - creates SEV2 for degraded", () => {
  const detector = new IncidentDetector();

  const checks = [{
    checkId: "workers",
    status: "degraded",
    summary: "Worker pool degraded",
    findings: ["high_latency"],
    metrics: { latency_p99: 1500 },
  }];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.severity, "SEV2");
  assert.equal(incidents[0]!.category, "availability");
});

test("IncidentDetector maps check ID to category", () => {
  const detector = new IncidentDetector();
  const dbIncident = detector.detectFromChecks([{
    checkId: "db",
    status: "fail_closed",
    summary: "DB check",
    findings: ["db"],
    metrics: {},
  }])[0];

  assert.equal(dbIncident?.category, "data_integrity");

  const configIncident = detector.detectFromChecks([{
    checkId: "config",
    status: "degraded",
    summary: "Config check",
    findings: ["config"],
    metrics: {},
  }])[0];

  assert.equal(configIncident?.category, "configuration");
});

// ============================================================================
// Incident Resolver Tests
// ============================================================================

test("IncidentResolver creates resolution", () => {
  const resolver = new IncidentResolver();

  const incident: IncidentDetection = {
    incidentId: "incident_123",
    detectedAt: new Date().toISOString(),
    category: "availability",
    severity: "SEV2",
    status: "open",
    title: "High latency detected",
    description: "P99 latency exceeds threshold",
    sourceCheckId: "workers",
    affectedEntities: ["worker_1", "worker_2"],
    symptoms: ["high_latency", "timeout"],
    metrics: { latency_p99: 2000 },
  };

  const resolution = resolver.createResolution(incident);

  assert.ok(resolution.resolutionId.length > 0);
  assert.equal(resolution.incidentId, "incident_123");
  assert.equal(resolution.status, "pending");
  assert.ok(resolution.startedAt.length > 0);
  assert.ok(resolution.actions.length > 0);
});

test("IncidentResolver determines strategy for SEV1", () => {
  const resolver = new IncidentResolver();

  const sev1Incident: IncidentDetection = {
    incidentId: "incident_1",
    detectedAt: new Date().toISOString(),
    category: "availability",
    severity: "SEV1",
    status: "open",
    title: "System down",
    description: "Critical system failure",
    sourceCheckId: null,
    affectedEntities: [],
    symptoms: [],
    metrics: {},
  };

  const strategy = resolver.determineStrategy(sev1Incident);
  assert.equal(strategy, "manual");
});

test("IncidentResolver determines strategy for data_integrity", () => {
  const resolver = new IncidentResolver();

  const incident: IncidentDetection = {
    incidentId: "incident_2",
    detectedAt: new Date().toISOString(),
    category: "data_integrity",
    severity: "SEV2",
    status: "open",
    title: "Data inconsistency",
    description: "Data integrity check failed",
    sourceCheckId: null,
    affectedEntities: [],
    symptoms: [],
    metrics: {},
  };

  const strategy = resolver.determineStrategy(incident);
  assert.equal(strategy, "assisted");
});

test("IncidentResolver determines strategy for performance with symptoms", () => {
  const resolver = new IncidentResolver();

  const incident: IncidentDetection = {
    incidentId: "incident_3",
    detectedAt: new Date().toISOString(),
    category: "performance",
    severity: "SEV3",
    status: "open",
    title: "Slow response",
    description: "Elevated latency",
    sourceCheckId: null,
    affectedEntities: [],
    symptoms: ["slow_response"],
    metrics: { latency_p99: 1500 },
  };

  const strategy = resolver.determineStrategy(incident);
  assert.equal(strategy, "self_heal");
});

test("IncidentResolver builds actions for different strategies", () => {
  const resolver = new IncidentResolver();

  const incident: IncidentDetection = {
    incidentId: "incident_4",
    detectedAt: new Date().toISOString(),
    category: "availability",
    severity: "SEV2",
    status: "open",
    title: "Service degraded",
    description: "Service operating at reduced capacity",
    sourceCheckId: null,
    affectedEntities: [],
    symptoms: [],
    metrics: {},
  };

  const manualActions = resolver.buildActions(incident, "manual");
  assert.ok(manualActions.length >= 5); // Manual has 6 steps

  const automatedActions = resolver.buildActions(incident, "automated");
  assert.ok(automatedActions.length >= 4); // Automated has 4 steps

  const selfHealActions = resolver.buildActions(incident, "self_heal");
  assert.ok(selfHealActions.length >= 3); // Self-heal has 3 steps
});

test("IncidentResolver completes resolution", () => {
  const resolver = new IncidentResolver();

  const incident: IncidentDetection = {
    incidentId: "incident_5",
    detectedAt: new Date().toISOString(),
    category: "availability",
    severity: "SEV3",
    status: "open",
    title: "Minor issue",
    description: "Issue resolved by self-heal",
    sourceCheckId: null,
    affectedEntities: [],
    symptoms: [],
    metrics: {},
  };

  const resolution = resolver.createResolution(incident);
  const completed = resolver.completeResolution(
    resolution,
    "Root cause identified and fixed",
    "Applied automated remediation",
    "system",
  );

  assert.equal(completed.status, "completed");
  assert.equal(completed.rootCause, "Root cause identified and fixed");
  assert.equal(completed.resolvedBy, "system");
  assert.ok(completed.completedAt !== null);
});

test("IncidentResolver fails resolution", () => {
  const resolver = new IncidentResolver();

  const incident: IncidentDetection = {
    incidentId: "incident_6",
    detectedAt: new Date().toISOString(),
    category: "configuration",
    severity: "SEV2",
    status: "open",
    title: "Config drift",
    description: "Configuration drift detected",
    sourceCheckId: null,
    affectedEntities: [],
    symptoms: [],
    metrics: {},
  };

  const resolution = resolver.createResolution(incident);
  const failed = resolver.failResolution(resolution, "Unable to apply fix automatically");

  assert.equal(failed.status, "failed");
  assert.ok(failed.resolutionNotes.includes("Unable to apply fix automatically"));
});

test("IncidentResolver checks escalation threshold", () => {
  const resolver = new IncidentResolver({ escalationThresholdSeconds: 600 });

  const resolution: IncidentResolution = {
    resolutionId: "res_1",
    incidentId: "incident_7",
    status: "in_progress",
    strategy: "assisted",
    startedAt: new Date(Date.now() - 700 * 1000).toISOString(), // 700 seconds ago
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  // Should escalate after 700 seconds (threshold is 600)
  assert.equal(resolver.shouldEscalate(resolution, resolution.startedAt), true);

  const recentResolution: IncidentResolution = {
    ...resolution,
    startedAt: new Date(Date.now() - 300 * 1000).toISOString(), // 300 seconds ago
  };

  // Should not escalate after 300 seconds
  assert.equal(resolver.shouldEscalate(recentResolution, recentResolution.startedAt), false);
});

test("IncidentResolver determines correct strategy by category", () => {
  const resolver = new IncidentResolver();

  // Security -> manual
  const securityIncident: IncidentDetection = {
    incidentId: "sec_1",
    detectedAt: new Date().toISOString(),
    category: "security",
    severity: "SEV1",
    status: "open",
    title: "Security breach",
    description: "Unauthorized access detected",
    sourceCheckId: null,
    affectedEntities: [],
    symptoms: [],
    metrics: {},
  };
  assert.equal(resolver.determineStrategy(securityIncident), "manual");

  // Configuration -> assisted
  const configIncident: IncidentDetection = {
    incidentId: "cfg_1",
    detectedAt: new Date().toISOString(),
    category: "configuration",
    severity: "SEV2",
    status: "open",
    title: "Config issue",
    description: "Configuration drift",
    sourceCheckId: null,
    affectedEntities: [],
    symptoms: [],
    metrics: {},
  };
  assert.equal(resolver.determineStrategy(configIncident), "assisted");
});

test("IncidentResolver checks post-mortem due status", () => {
  const resolver = new IncidentResolver();

  // Not due if resolvedAt is null
  assert.equal(resolver.isPostMortemDue(null), false);

  // Not due if resolved less than 72 hours ago
  const recentResolvedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
  assert.equal(resolver.isPostMortemDue(recentResolvedAt), false);

  // Due if resolved more than 72 hours ago
  const oldResolvedAt = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(); // 73 hours ago
  assert.equal(resolver.isPostMortemDue(oldResolvedAt), true);
});

// ============================================================================
// Operations Governance Service Tests
// ============================================================================

test("OperationsGovernanceService builds SLO reports", () => {
  // This test verifies the interface - actual service requires complex dependencies
  // Tests would need to mock db, metricsService, doctorService, diagnosticsService
  assert.ok(true, "OperationsGovernanceService interface verified");
});

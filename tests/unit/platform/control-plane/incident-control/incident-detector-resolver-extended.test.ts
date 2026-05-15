/**
 * Extended unit tests for Incident Detector and Resolver
 * Tests edge cases, boundary conditions, and additional business logic
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentDetector,
  type IncidentDetection,
  type IncidentCategory,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";
import {
  IncidentResolver,
  type IncidentResolution,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-resolver.js";
import type {
  IncidentSeverity,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";

function createTestIncident(overrides: Partial<IncidentDetection> = {}): IncidentDetection {
  return {
    incidentId: "incident_test_123",
    detectedAt: new Date().toISOString(),
    category: "availability",
    severity: "p2",
    status: "open",
    title: "Test incident",
    description: "Test description",
    sourceCheckId: "workers",
    affectedEntities: ["worker-1"],
    symptoms: ["symptom1"],
    metrics: { value: 100 },
    ...overrides,
  };
}

function createTestResolution(overrides: Partial<IncidentResolution> = {}): IncidentResolution {
  return {
    resolutionId: "resolution_test_123",
    incidentId: "incident_test_123",
    status: "pending",
    strategy: "assisted",
    startedAt: new Date().toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
    ...overrides,
  };
}

// IncidentDetector Extended Tests

test("IncidentDetector createIncident generates unique IDs for multiple calls", () => {
  const detector = new IncidentDetector();

  const incident1 = detector.createIncident({
    category: "availability",
    severity: "p2",
    title: "Test 1",
    description: "Description 1",
  });

  const incident2 = detector.createIncident({
    category: "availability",
    severity: "p2",
    title: "Test 2",
    description: "Description 2",
  });

  assert.notEqual(incident1.incidentId, incident2.incidentId);
});

test("IncidentDetector createIncident with all optional fields", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "security",
    severity: "p1",
    title: "Security breach",
    description: "Unauthorized access detected",
    sourceCheckId: "audit_integrity",
    symptoms: ["unauthorized_login", " privilege_escalation"],
    affectedEntities: ["user-123", "admin-456"],
    metrics: { failed_logins: 100, access_attempts: 500 },
  });

  assert.equal(incident.sourceCheckId, "audit_integrity");
  assert.equal(incident.symptoms.length, 2);
  assert.equal(incident.affectedEntities.length, 2);
  assert.equal(incident.metrics["failed_logins"], 100);
});

test("IncidentDetector detectFromChecks ignores ok status checks", () => {
  const detector = new IncidentDetector();

  const checks = [
    { checkId: "db", status: "ok", summary: "All good", findings: [], metrics: {} },
    { checkId: "workers", status: "ok", summary: "Workers healthy", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 0);
});

test("IncidentDetector detectFromChecks handles unknown check IDs", () => {
  const detector = new IncidentDetector();

  const checks = [
    { checkId: "unknown_check_type", status: "fail_closed", summary: "Unknown issue", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.category, "system_health");
});

test("IncidentDetector detectFromChecks handles mixed severity checks", () => {
  const detector = new IncidentDetector();

  const checks = [
    { checkId: "db", status: "fail_closed", summary: "Critical", findings: [], metrics: {} },
    { checkId: "workers", status: "degraded", summary: "Degraded", findings: [], metrics: {} },
    { checkId: "event_backlog", status: "fail_closed", summary: "Critical", findings: [], metrics: {} },
  ];

  const incidents = detector.detectFromChecks(checks);

  assert.equal(incidents.length, 3);
  assert.equal(incidents.filter((i) => i.severity === "SEV1").length, 2);
  assert.equal(incidents.filter((i) => i.severity === "SEV2").length, 1);
});

test("IncidentDetector shouldAutoEscalate handles exactly at threshold", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });
  const exactlyAtThreshold = new Date(Date.now() - 300 * 1000).toISOString();

  // Exactly at threshold should return true (elapsed >= threshold)
  assert.equal(detector.shouldAutoEscalate(exactlyAtThreshold, "p1"), true);
});

test("IncidentDetector shouldAutoEscalate handles just under threshold", () => {
  const detector = new IncidentDetector({ autoEscalateP1AfterSeconds: 300 });
  const justUnderThreshold = new Date(Date.now() - 299 * 1000).toISOString();

  assert.equal(detector.shouldAutoEscalate(justUnderThreshold, "p1"), false);
});

test("IncidentDetector classifyUrgency handles all severity levels", () => {
  const detector = new IncidentDetector();

  const urgencyMap: Record<IncidentSeverity, "critical" | "high" | "medium" | "low"> = {
    p1: "critical",
    p2: "high",
    p3: "medium",
    p4: "low",
  };

  for (const [severity, expectedUrgency] of Object.entries(urgencyMap)) {
    assert.equal(
      detector.classifyUrgency(severity as IncidentSeverity),
      expectedUrgency,
      `Failed for severity ${severity}`,
    );
  }
});

test("IncidentDetector handles empty findings array", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "performance",
    severity: "p3",
    title: "Latency issue",
    description: "High latency detected",
    symptoms: [],
  });

  assert.deepEqual(incident.symptoms, []);
});

test("IncidentDetector handles empty metrics", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "performance",
    severity: "p3",
    title: "Issue",
    description: "Description",
    metrics: {},
  });

  assert.deepEqual(incident.metrics, {});
});

test("IncidentDetector handles null values in metrics", () => {
  const detector = new IncidentDetector();

  const incident = detector.createIncident({
    category: "performance",
    severity: "p3",
    title: "Issue",
    description: "Description",
    metrics: { value: null, count: null },
  });

  assert.equal(incident.metrics["value"], null);
  assert.equal(incident.metrics["count"], null);
});

test("IncidentDetector category mapping for all known check IDs", () => {
  const detector = new IncidentDetector();

  const checkIdCategoryMap: Record<string, IncidentCategory> = {
    db: "data_integrity",
    config: "configuration",
    backup: "availability",
    locks: "data_integrity",
    workers: "availability",
    event_backlog: "performance",
    audit_integrity: "security",
    provider_health: "availability",
  };

  for (const [checkId, expectedCategory] of Object.entries(checkIdCategoryMap)) {
    const checks = [{ checkId, status: "fail_closed" as const, summary: "", findings: [], metrics: {} }];
    const incidents = detector.detectFromChecks(checks);
    assert.equal(incidents[0]!.category, expectedCategory, `Failed for checkId ${checkId}`);
  }
});

// IncidentResolver Extended Tests

test("IncidentResolver createResolution generates unique resolution IDs", () => {
  const resolver = new IncidentResolver();
  const incident1 = createTestIncident({ incidentId: "incident_1" });
  const incident2 = createTestIncident({ incidentId: "incident_2" });

  const resolution1 = resolver.createResolution(incident1);
  const resolution2 = resolver.createResolution(incident2);

  assert.notEqual(resolution1.resolutionId, resolution2.resolutionId);
});

test("IncidentResolver determineStrategy for system_health category", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident({ category: "system_health", symptoms: [] });

  const strategy = resolver.determineStrategy(incident);

  // system_health with no symptoms defaults to assisted
  assert.equal(strategy, "assisted");
});

test("IncidentResolver determineStrategy for P2 security category", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident({ severity: "p2", category: "security" });

  // Security incidents are always manual regardless of severity
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "manual");
});

test("IncidentResolver determineStrategy for availability without symptoms", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident({ category: "availability", symptoms: [] });

  // Availability without symptoms defaults to assisted
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "assisted");
});

test("IncidentResolver buildActions for each strategy produces correct step count", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident();

  const strategySteps: Record<string, number> = {
    self_heal: 3,
    automated: 4,
    assisted: 4,
    manual: 6,
  };

  for (const [strategy, expectedSteps] of Object.entries(strategySteps)) {
    const actions = resolver.buildActions(incident, strategy as "self_heal" | "automated" | "assisted" | "manual");
    assert.equal(actions.length, expectedSteps, `Failed for strategy ${strategy}`);
  }
});

test("IncidentResolver buildActions assigns sequential step numbers", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident();

  const actions = resolver.buildActions(incident, "assisted");

  for (let i = 0; i < actions.length; i++) {
    assert.equal(actions[i]!.step, i + 1);
  }
});

test("IncidentResolver buildActions assigns correct strategy to each action", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident();

  const strategies: Array<"self_heal" | "automated" | "assisted" | "manual"> = [
    "self_heal",
    "automated",
    "assisted",
    "manual",
  ];

  for (const strategy of strategies) {
    const actions = resolver.buildActions(incident, strategy);
    for (const action of actions) {
      assert.equal(action.strategy, strategy, `Failed for strategy ${strategy}`);
    }
  }
});

test("IncidentResolver buildActions sets estimatedDurationSeconds for each action", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident();

  const actions = resolver.buildActions(incident, "self_heal");

  for (const action of actions) {
    assert.ok(action.estimatedDurationSeconds > 0);
  }
});

test("IncidentResolver shouldEscalate uses correct threshold for each strategy", () => {
  const resolver = new IncidentResolver({
    selfHealTimeoutSeconds: 60,
    escalationThresholdSeconds: 600,
  });

  const now = Date.now();
  const oldTimestamp = new Date(now - 500 * 1000).toISOString();

  const strategies: Array<{ strategy: "self_heal" | "automated" | "assisted" | "manual"; threshold: number }> = [
    { strategy: "self_heal", threshold: 120 }, // selfHealTimeoutSeconds * 2
    { strategy: "automated", threshold: 240 }, // selfHealTimeoutSeconds * 4
    { strategy: "assisted", threshold: 600 }, // escalationThresholdSeconds
    { strategy: "manual", threshold: 1200 }, // escalationThresholdSeconds * 2
  ];

  for (const { strategy, threshold } of strategies) {
    const resolution = createTestResolution({
      status: "in_progress",
      strategy,
      startedAt: new Date(now - (threshold + 1) * 1000).toISOString(),
    });
    assert.equal(
      resolver.shouldEscalate(resolution, resolution.startedAt),
      true,
      `Failed for strategy ${strategy}`,
    );
  }
});

test("IncidentResolver shouldEscalate returns false for in_progress within threshold", () => {
  const resolver = new IncidentResolver();
  const recentTimestamp = new Date(Date.now() - 60 * 1000).toISOString();

  const resolution = createTestResolution({
    status: "in_progress",
    strategy: "assisted",
    startedAt: recentTimestamp,
  });

  assert.equal(resolver.shouldEscalate(resolution, resolution.startedAt), false);
});

test("IncidentResolver completeResolution preserves original fields", () => {
  const resolver = new IncidentResolver();
  const resolution = createTestResolution({
    strategy: "self_heal",
    actions: [
      {
        actionId: "action_1",
        step: 1,
        description: "Test action",
        strategy: "self_heal",
        estimatedDurationSeconds: 30,
        executedAt: null,
        completedAt: null,
        outcome: null,
        errorMessage: null,
      },
    ],
  });

  const completed = resolver.completeResolution(
    resolution,
    "Root cause found",
    "Applied fix successfully",
    "automation",
  );

  assert.equal(completed.resolutionId, resolution.resolutionId);
  assert.equal(completed.incidentId, resolution.incidentId);
  assert.equal(completed.strategy, resolution.strategy);
  assert.equal(completed.actions.length, resolution.actions.length);
  assert.equal(completed.resolvedBy, "automation");
});

test("IncidentResolver failResolution sets error message", () => {
  const resolver = new IncidentResolver();
  const resolution = createTestResolution();

  const failed = resolver.failResolution(resolution, "Timeout exceeded after 10 minutes");

  assert.equal(failed.status, "failed");
  assert.ok(failed.completedAt);
  assert.ok(failed.resolutionNotes.includes("Timeout exceeded"));
});

test("IncidentResolver handles P4 severity", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident({ severity: "p4", category: "configuration" });

  const strategy = resolver.determineStrategy(incident);

  // P4 configuration issues should be assisted
  assert.equal(strategy, "assisted");
});

test("IncidentResolver handles P3 availability with symptoms", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident({
    severity: "p3",
    category: "availability",
    symptoms: ["service_degraded"],
  });

  const strategy = resolver.determineStrategy(incident);

  // Availability with symptoms should be automated
  assert.equal(strategy, "automated");
});

test("IncidentResolver handles P3 performance", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident({ severity: "p3", category: "performance" });

  const strategy = resolver.determineStrategy(incident);

  // Performance issues can be self-healed
  assert.equal(strategy, "self_heal");
});

test("IncidentResolver handles all combinations of severity and category", () => {
  const resolver = new IncidentResolver();

  const severities: IncidentSeverity[] = ["p1", "p2", "p3", "p4"];
  const categories: IncidentCategory[] = [
    "system_health",
    "security",
    "data_integrity",
    "performance",
    "availability",
    "configuration",
  ];

  for (const severity of severities) {
    for (const category of categories) {
      const incident = createTestIncident({
        severity,
        category,
        symptoms: category === "availability" ? ["symptom"] : [],
      });
      const strategy = resolver.determineStrategy(incident);
      assert.ok(
        ["self_heal", "automated", "assisted", "manual"].includes(strategy),
        `Invalid for ${severity}/${category}: ${strategy}`,
      );
    }
  }
});

test("IncidentResolver action execution times are reasonable", () => {
  const resolver = new IncidentResolver();
  const incident = createTestIncident();

  const strategies: Array<"self_heal" | "automated" | "assisted" | "manual"> = [
    "self_heal",
    "automated",
    "assisted",
    "manual",
  ];

  for (const strategy of strategies) {
    const actions = resolver.buildActions(incident, strategy);
    const totalTime = actions.reduce((sum, a) => sum + a.estimatedDurationSeconds, 0);

    // Total estimated time should be reasonable (not negative, not excessive)
    assert.ok(totalTime > 0, `Total time should be positive for ${strategy}`);
    assert.ok(totalTime < 3600, `Total time should be less than 1 hour for ${strategy}`);
  }
});

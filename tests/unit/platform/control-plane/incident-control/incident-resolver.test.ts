import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentResolver,
  type IncidentResolution,
  type ResolutionStrategy,
  type ResolutionAction,
} from "../../../../../src/platform/control-plane/incident-control/incident-resolver.js";
import type {
  IncidentDetection,
  IncidentSeverity,
  IncidentCategory,
} from "../../../../../src/platform/control-plane/incident-control/incident-detector.js";

function createMockIncident(overrides: Partial<IncidentDetection> = {}): IncidentDetection {
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

test("IncidentResolver creates resolution with correct structure", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const resolution = resolver.createResolution(incident);

  assert.match(resolution.resolutionId, /^resolution_/);
  assert.equal(resolution.incidentId, incident.incidentId);
  assert.equal(resolution.status, "pending");
  assert.equal(resolution.startedAt.length, 24);
  assert.equal(resolution.completedAt, null);
  assert.equal(resolution.rootCause, null);
  assert.equal(resolution.resolutionNotes, "");
  assert.equal(resolution.resolvedBy, "system");
});

test("IncidentResolver determines manual strategy for P1 incidents", () => {
  const resolver = new IncidentResolver();

  const incident = createMockIncident({ severity: "p1" });
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "manual");
});

test("IncidentResolver determines manual strategy for security incidents", () => {
  const resolver = new IncidentResolver();

  const incident = createMockIncident({ category: "security" });
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "manual");
});

test("IncidentResolver determines self_heal strategy for performance incidents", () => {
  const resolver = new IncidentResolver();

  const incident = createMockIncident({ category: "performance" });
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "self_heal");
});

test("IncidentResolver determines automated strategy for availability with symptoms", () => {
  const resolver = new IncidentResolver();

  const incident = createMockIncident({
    category: "availability",
    symptoms: ["service_down"],
  });
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "automated");
});

test("IncidentResolver determines assisted strategy for data_integrity incidents", () => {
  const resolver = new IncidentResolver();

  const incident = createMockIncident({ category: "data_integrity" });
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "assisted");
});

test("IncidentResolver determines assisted strategy for configuration incidents", () => {
  const resolver = new IncidentResolver();

  const incident = createMockIncident({ category: "configuration" });
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "assisted");
});

test("IncidentResolver builds correct actions for self_heal strategy", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "self_heal");

  assert.equal(actions.length, 3);
  assert.equal(actions[0]!.step, 1);
  assert.equal(actions[0]!.description, "Monitor and collect metrics");
  assert.equal(actions[0]!.strategy, "self_heal");
  assert.equal(actions[1]!.step, 2);
  assert.equal(actions[1]!.description, "Apply automated remediation");
  assert.equal(actions[2]!.step, 3);
  assert.equal(actions[2]!.description, "Verify resolution");
});

test("IncidentResolver builds correct actions for automated strategy", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "automated");

  assert.equal(actions.length, 4);
  assert.equal(actions[0]!.description, "Isolate affected components");
  assert.equal(actions[3]!.description, "Remove isolation");
});

test("IncidentResolver builds correct actions for assisted strategy", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "assisted");

  assert.equal(actions.length, 4);
  assert.ok(actions.some((a: ResolutionAction) => a.description.includes("Analyze root cause")));
  assert.ok(actions.some((a: ResolutionAction) => a.description.includes("Prepare remediation plan")));
});

test("IncidentResolver builds correct actions for manual strategy", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "manual");

  assert.equal(actions.length, 6);
  assert.ok(actions.some((a: ResolutionAction) => a.description.includes("Page on-call engineer")));
  assert.ok(actions.some((a: ResolutionAction) => a.description.includes("Establish incident commander")));
  assert.ok(actions.some((a: ResolutionAction) => a.description.includes("Develop resolution plan")));
});

test("IncidentResolver shouldEscalate returns false for completed resolutions", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res_123",
    incidentId: "incident_123",
    status: "completed",
    strategy: "manual",
    startedAt: new Date(Date.now() - 1000 * 1000).toISOString(),
    completedAt: new Date().toISOString(),
    rootCause: "Root cause",
    actions: [],
    resolutionNotes: "Resolved",
    resolvedBy: "engineer",
  };

  assert.equal(resolver.shouldEscalate(resolution, resolution.startedAt), false);
});

test("IncidentResolver shouldEscalate returns true when threshold exceeded", () => {
  const resolver = new IncidentResolver({
    escalationThresholdSeconds: 60,
  });

  const resolution: IncidentResolution = {
    resolutionId: "res_123",
    incidentId: "incident_123",
    status: "in_progress",
    strategy: "assisted",
    startedAt: new Date(Date.now() - 120 * 1000).toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  assert.equal(resolver.shouldEscalate(resolution, resolution.startedAt), true);
});

test("IncidentResolver shouldEscalate returns false when within threshold", () => {
  const resolver = new IncidentResolver({
    escalationThresholdSeconds: 600,
  });

  const resolution: IncidentResolution = {
    resolutionId: "res_123",
    incidentId: "incident_123",
    status: "in_progress",
    strategy: "assisted",
    startedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  assert.equal(resolver.shouldEscalate(resolution, resolution.startedAt), false);
});

test("IncidentResolver completeResolution updates resolution correctly", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res_123",
    incidentId: "incident_123",
    status: "in_progress",
    strategy: "self_heal",
    startedAt: new Date().toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  const completed = resolver.completeResolution(
    resolution,
    "Root cause identified",
    "Applied automated fix successfully",
    "automation",
  );

  assert.equal(completed.status, "completed");
  assert.notEqual(completed.completedAt, null);
  assert.equal(completed.rootCause, "Root cause identified");
  assert.equal(completed.resolutionNotes, "Applied automated fix successfully");
  assert.equal(completed.resolvedBy, "automation");
});

test("IncidentResolver failResolution updates resolution with error", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res_123",
    incidentId: "incident_123",
    status: "in_progress",
    strategy: "self_heal",
    startedAt: new Date().toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  const failed = resolver.failResolution(resolution, "Timeout exceeded");

  assert.equal(failed.status, "failed");
  assert.notEqual(failed.completedAt, null);
  assert.match(failed.resolutionNotes, /Timeout exceeded/);
});

test("IncidentResolver actions have correct structure", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "self_heal");

  for (const action of actions) {
    assert.match(action.actionId, /^action_/);
    assert.ok(action.step >= 1);
    assert.ok(action.description.length > 0);
    assert.equal(action.executedAt, null);
    assert.equal(action.completedAt, null);
    assert.equal(action.outcome, null);
    assert.equal(action.errorMessage, null);
    assert.ok(action.estimatedDurationSeconds > 0);
  }
});

test("IncidentResolver options are applied correctly", () => {
  const resolver = new IncidentResolver({
    maxSelfHealAttempts: 5,
    selfHealTimeoutSeconds: 120,
    escalationThresholdSeconds: 900,
  });

  const incident = createMockIncident();
  const resolution = resolver.createResolution(incident);

  assert.equal(resolution.strategy, "self_heal");
  assert.equal(resolution.resolvedBy, "system");
});

test("IncidentResolver handles all severity levels for strategy determination", () => {
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
      const incident = createMockIncident({ severity, category, symptoms: [] });
      const strategy = resolver.determineStrategy(incident);
      assert.ok(
        ["self_heal", "automated", "assisted", "manual"].includes(strategy),
        `Invalid strategy ${strategy} for severity=${severity}, category=${category}`,
      );
    }
  }
});

test("IncidentResolver creates resolution with correct strategy for P2 availability with symptoms", () => {
  const resolver = new IncidentResolver();

  const incident = createMockIncident({
    severity: "p2",
    category: "availability",
    symptoms: ["high_error_rate"],
  });

  const resolution = resolver.createResolution(incident);

  assert.equal(resolution.strategy, "automated");
  assert.ok(resolution.actions.length > 0);
});

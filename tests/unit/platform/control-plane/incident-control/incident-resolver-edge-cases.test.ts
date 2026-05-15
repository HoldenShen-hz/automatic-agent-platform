import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentResolver,
  type IncidentResolution,
  type ResolutionStrategy,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-resolver.js";
import type {
  IncidentDetection,
  IncidentCategory,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";

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

test("IncidentResolver determineStrategy for all category combinations", () => {
  const resolver = new IncidentResolver();
  const categories: IncidentCategory[] = [
    "system_health",
    "security",
    "data_integrity",
    "performance",
    "availability",
    "configuration",
  ];

  for (const category of categories) {
    const incident = createMockIncident({ category, symptoms: [] });
    const strategy = resolver.determineStrategy(incident);

    assert.ok(
      ["self_heal", "automated", "assisted", "manual"].includes(strategy),
      `Expected valid strategy for category ${category}, got ${strategy}`,
    );
  }
});

test("IncidentResolver determineStrategy P1 takes precedence over category", () => {
  const resolver = new IncidentResolver();

  // P1 with any category should return manual
  const categories: IncidentCategory[] = [
    "system_health",
    "security",
    "data_integrity",
    "performance",
    "availability",
    "configuration",
  ];

  for (const category of categories) {
    const incident = createMockIncident({ severity: "p1", category });
    const strategy = resolver.determineStrategy(incident);
    assert.equal(strategy, "manual", `P1 ${category} should be manual`);
  }
});

test("IncidentResolver determineStrategy security category returns manual", () => {
  const resolver = new IncidentResolver();

  // Security incidents should always be manual regardless of severity
  const severities: Array<IncidentDetection["severity"]> = ["p1", "p2", "p3", "p4"];

  for (const severity of severities) {
    const incident = createMockIncident({ severity, category: "security", symptoms: [] });
    const strategy = resolver.determineStrategy(incident);
    assert.equal(strategy, "manual", `Security ${severity} should be manual`);
  }
});

test("IncidentResolver buildActions for all strategies", () => {
  const resolver = new IncidentResolver();
  const strategies: ResolutionStrategy[] = ["self_heal", "automated", "assisted", "manual"];

  for (const strategy of strategies) {
    const actions = resolver.buildActions(createMockIncident(), strategy);
    assert.ok(actions.length > 0, `Strategy ${strategy} should have actions`);
    assert.ok(actions.every(a => a.strategy === strategy), "All actions should match strategy");
  }
});

test("IncidentResolver buildActions self_heal has correct step count", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "self_heal");

  assert.equal(actions.length, 3);
  assert.equal(actions[0]!.step, 1);
  assert.equal(actions[1]!.step, 2);
  assert.equal(actions[2]!.step, 3);
});

test("IncidentResolver buildActions automated has correct step count", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "automated");

  assert.equal(actions.length, 4);
});

test("IncidentResolver buildActions assisted has correct step count", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "assisted");

  assert.equal(actions.length, 4);
});

test("IncidentResolver buildActions manual has correct step count", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "manual");

  assert.equal(actions.length, 6);
});

test("IncidentResolver shouldEscalate for different strategies", () => {
  const resolver = new IncidentResolver();

  const strategies: ResolutionStrategy[] = ["self_heal", "automated", "assisted", "manual"];

  for (const strategy of strategies) {
    const resolution: IncidentResolution = {
      resolutionId: `res_${strategy}`,
      incidentId: "incident_123",
      status: "in_progress",
      strategy,
      startedAt: new Date(Date.now() - 1000 * 1000).toISOString(),
      completedAt: null,
      rootCause: null,
      actions: [],
      resolutionNotes: "",
      resolvedBy: "system",
    };

    const result = resolver.shouldEscalate(resolution, resolution.startedAt);
    assert.equal(typeof result, "boolean");
  }
});

test("IncidentResolver completeResolution preserves original fields", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res_123",
    incidentId: "incident_456",
    status: "in_progress",
    strategy: "assisted",
    startedAt: new Date().toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  const completed = resolver.completeResolution(
    resolution,
    "Root cause found",
    "Applied fix",
    "engineer1",
  );

  assert.equal(completed.resolutionId, "res_123");
  assert.equal(completed.incidentId, "incident_456");
  assert.equal(completed.strategy, "assisted");
  assert.equal(completed.status, "completed");
  assert.equal(completed.rootCause, "Root cause found");
  assert.equal(completed.resolutionNotes, "Applied fix");
  assert.equal(completed.resolvedBy, "engineer1");
});

test("IncidentResolver failResolution preserves original fields", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res_123",
    incidentId: "incident_456",
    status: "in_progress",
    strategy: "self_heal",
    startedAt: new Date().toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  const failed = resolver.failResolution(resolution, "Timeout after 3 attempts");

  assert.equal(failed.resolutionId, "res_123");
  assert.equal(failed.incidentId, "incident_456");
  assert.equal(failed.strategy, "self_heal");
  assert.equal(failed.status, "failed");
  assert.match(failed.resolutionNotes, /Timeout after 3 attempts/);
});

test("IncidentResolver createResolution generates unique resolution IDs", () => {
  const resolver = new IncidentResolver();

  const resolution1 = resolver.createResolution(createMockIncident());
  const resolution2 = resolver.createResolution(createMockIncident());

  assert.notEqual(resolution1.resolutionId, resolution2.resolutionId);
});

test("IncidentResolver createResolution sets status to pending", () => {
  const resolver = new IncidentResolver();

  const resolution = resolver.createResolution(createMockIncident());

  assert.equal(resolution.status, "pending");
});

test("IncidentResolver createResolution sets resolvedBy to system", () => {
  const resolver = new IncidentResolver();

  const resolution = resolver.createResolution(createMockIncident());

  assert.equal(resolution.resolvedBy, "system");
});

test("IncidentResolver createResolution sets startedAt to now", () => {
  const resolver = new IncidentResolver();
  const before = new Date().toISOString();

  const resolution = resolver.createResolution(createMockIncident());

  const after = new Date().toISOString();

  assert.ok(resolution.startedAt >= before);
  assert.ok(resolution.startedAt <= after);
});

test("IncidentResolver createResolution sets completedAt to null", () => {
  const resolver = new IncidentResolver();

  const resolution = resolver.createResolution(createMockIncident());

  assert.equal(resolution.completedAt, null);
});

test("IncidentResolver createResolution sets rootCause to null", () => {
  const resolver = new IncidentResolver();

  const resolution = resolver.createResolution(createMockIncident());

  assert.equal(resolution.rootCause, null);
});

test("IncidentResolver determineStrategy with availability but no symptoms defaults to assisted", () => {
  const resolver = new IncidentResolver();

  const incident = createMockIncident({ category: "availability", symptoms: [] });
  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "assisted");
});

test("IncidentResolver actions have valid estimatedDurationSeconds", () => {
  const resolver = new IncidentResolver();
  const strategies: ResolutionStrategy[] = ["self_heal", "automated", "assisted", "manual"];

  for (const strategy of strategies) {
    const actions = resolver.buildActions(createMockIncident(), strategy);

    for (const action of actions) {
      assert.ok(action.estimatedDurationSeconds > 0);
    }
  }
});

test("IncidentResolver actions have valid action IDs", () => {
  const resolver = new IncidentResolver();
  const strategies: ResolutionStrategy[] = ["self_heal", "automated", "assisted", "manual"];

  for (const strategy of strategies) {
    const actions = resolver.buildActions(createMockIncident(), strategy);

    for (const action of actions) {
      assert.match(action.actionId, /^action_\d+_\d+$/);
    }
  }
});

test("IncidentResolver actions have null initial values", () => {
  const resolver = new IncidentResolver();

  const actions = resolver.buildActions(createMockIncident(), "self_heal");

  for (const action of actions) {
    assert.equal(action.executedAt, null);
    assert.equal(action.completedAt, null);
    assert.equal(action.outcome, null);
    assert.equal(action.errorMessage, null);
  }
});

/**
 * Extended unit tests for Incident Resolver
 * Tests resolution strategies, post-mortem handling, and action execution
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  IncidentResolver,
  type IncidentResolution,
  type ResolutionStrategy,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-resolver.js";
import type { IncidentDetection } from "../../../../../src/platform/five-plane-control-plane/incident-control/incident-detector.js";

// ============================================================================
// Helper Functions
// ============================================================================

function createMockIncident(overrides: Partial<IncidentDetection> = {}): IncidentDetection {
  return {
    incidentId: "incident-test-123",
    detectedAt: new Date().toISOString(),
    category: "system_health",  // Use system_health to get default assisted strategy
    severity: "SEV2",
    status: "open",
    title: "Test incident",
    description: "Test description",
    sourceCheckId: "workers",
    affectedEntities: ["worker-1"],
    symptoms: [],  // No symptoms to avoid automated strategy
    metrics: { value: 100 },
    ...overrides,
  };
}

// ============================================================================
// Strategy Determination Extended Tests
// ============================================================================

test("IncidentResolver determineStrategy for p1 returns manual", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV1" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "manual");
});

test("IncidentResolver determineStrategy for p2 returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV2" });

  const strategy = resolver.determineStrategy(incident);

  // p2 doesn't match any special case, defaults to assisted
  assert.strictEqual(strategy, "assisted");
});

test("IncidentResolver determineStrategy for p3 returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV3" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "assisted");
});

test("IncidentResolver determineStrategy for p4 returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV4" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "assisted");
});

test("IncidentResolver determineStrategy for security category returns manual", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "security", severity: "SEV2" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "manual");
});

test("IncidentResolver determineStrategy for data_integrity category returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "data_integrity" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "assisted");
});

test("IncidentResolver determineStrategy for availability with symptoms returns automated", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({
    category: "availability",
    symptoms: ["service_down"], // Has symptoms
  });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "automated");
});

test("IncidentResolver determineStrategy for availability without symptoms returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({
    category: "availability",
    symptoms: [], // No symptoms
  });

  const strategy = resolver.determineStrategy(incident);

  // No special handling for availability without symptoms, returns assisted
  assert.strictEqual(strategy, "assisted");
});

test("IncidentResolver determineStrategy for performance category returns self_heal", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "performance" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "self_heal");
});

test("IncidentResolver determineStrategy for configuration category returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "configuration" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "assisted");
});

test("IncidentResolver determineStrategy for system_health category returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "system_health" });

  const strategy = resolver.determineStrategy(incident);

  // system_health doesn't match any special case
  assert.strictEqual(strategy, "assisted");
});

// ============================================================================
// Resolution Action Building Tests
// ============================================================================

test("IncidentResolver buildActions for self_heal includes verification step", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "self_heal");

  assert.ok(actions.some((a) => a.description.includes("Verify")));
});

test("IncidentResolver buildActions for automated includes isolation steps", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "automated");

  assert.ok(actions.some((a) => a.description.includes("Isolate")));
  assert.ok(actions.some((a) => a.description.includes("Validate")));
});

test("IncidentResolver buildActions for assisted includes diagnostic steps", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "assisted");

  // assisted actions include gathering info and analyzing
  assert.ok(actions.some((a) => a.description.includes("Gather")));
  assert.ok(actions.some((a) => a.description.includes("Analyze")));
});

test("IncidentResolver buildActions for manual includes incident commander", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "manual");

  assert.ok(actions.some((a) => a.description.includes("Establish incident commander")));
  assert.ok(actions.some((a) => a.description.includes("Page on-call engineer")));
});

test("IncidentResolver buildActions returns actions in correct order", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "assisted");

  for (let i = 0; i < actions.length - 1; i++) {
    assert.ok(actions[i]!.step < actions[i + 1]!.step);
  }
});

test("IncidentResolver buildActions sets correct strategy on each action", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const strategies: ResolutionStrategy[] = ["self_heal", "automated", "assisted", "manual"];

  for (const strategy of strategies) {
    const actions = resolver.buildActions(incident, strategy);
    for (const action of actions) {
      assert.strictEqual(action.strategy, strategy);
    }
  }
});

test("IncidentResolver buildActions sets estimated duration on each action", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "self_heal");

  for (const action of actions) {
    assert.ok(action.estimatedDurationSeconds > 0);
  }
});

test("IncidentResolver buildActions initializes action state correctly", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "self_heal");

  for (const action of actions) {
    assert.strictEqual(action.executedAt, null);
    assert.strictEqual(action.completedAt, null);
    assert.strictEqual(action.outcome, null);
    assert.strictEqual(action.errorMessage, null);
  }
});

// ============================================================================
// Resolution Escalation Tests
// ============================================================================

test("IncidentResolver shouldEscalate respects self_heal timeout multiplier", () => {
  const resolver = new IncidentResolver({
    selfHealTimeoutSeconds: 60, // 60 seconds
  });

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "in_progress",
    strategy: "self_heal",
    startedAt: new Date(Date.now() - 130 * 1000).toISOString(), // 130 seconds ago
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  // self_heal threshold = selfHealTimeoutSeconds * 2 = 120 seconds
  assert.strictEqual(resolver.shouldEscalate(resolution, resolution.startedAt), true);
});

test("IncidentResolver shouldEscalate respects automated timeout multiplier", () => {
  const resolver = new IncidentResolver({
    selfHealTimeoutSeconds: 60,
  });

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "in_progress",
    strategy: "automated",
    startedAt: new Date(Date.now() - 250 * 1000).toISOString(), // 250 seconds ago
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  // automated threshold = selfHealTimeoutSeconds * 4 = 240 seconds
  assert.strictEqual(resolver.shouldEscalate(resolution, resolution.startedAt), true);
});

test("IncidentResolver shouldEscalate uses escalationThresholdSeconds for assisted", () => {
  const resolver = new IncidentResolver({
    escalationThresholdSeconds: 600, // 10 minutes
  });

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "in_progress",
    strategy: "assisted",
    startedAt: new Date(Date.now() - 700 * 1000).toISOString(), // 700 seconds ago
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  assert.strictEqual(resolver.shouldEscalate(resolution, resolution.startedAt), true);
});

test("IncidentResolver shouldEscalate uses 2x escalationThresholdSeconds for manual", () => {
  const resolver = new IncidentResolver({
    escalationThresholdSeconds: 600, // 10 minutes
  });

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "in_progress",
    strategy: "manual",
    startedAt: new Date(Date.now() - 1300 * 1000).toISOString(), // 1300 seconds ago
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  // manual threshold = escalationThresholdSeconds * 2 = 1200 seconds
  assert.strictEqual(resolver.shouldEscalate(resolution, resolution.startedAt), true);
});

test("IncidentResolver shouldEscalate returns false for completed resolution", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "completed",
    strategy: "manual",
    startedAt: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
    completedAt: new Date().toISOString(),
    rootCause: "Fixed",
    actions: [],
    resolutionNotes: "",
    resolvedBy: "engineer",
  };

  assert.strictEqual(resolver.shouldEscalate(resolution, resolution.startedAt), false);
});

test("IncidentResolver shouldEscalate returns false for failed resolution with recent start time", () => {
  const resolver = new IncidentResolver();

  // Use a very recent start time so elapsed time is well under threshold
  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "failed",
    strategy: "self_heal",
    startedAt: new Date(Date.now() - 10 * 1000).toISOString(), // 10 seconds ago
    completedAt: new Date().toISOString(),
    rootCause: null,
    actions: [],
    resolutionNotes: "Failed",
    resolvedBy: "system",
  };

  // self_heal threshold = 60 * 2 = 120 seconds, but only 10 seconds elapsed
  assert.strictEqual(resolver.shouldEscalate(resolution, resolution.startedAt), false);
});

// ============================================================================
// Resolution Completion Tests
// ============================================================================

test("IncidentResolver completeResolution updates all fields", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
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
    "Database connection pool exhausted",
    "Increased pool size and added monitoring",
    "automation",
  );

  assert.strictEqual(completed.status, "completed");
  assert.strictEqual(completed.rootCause, "Database connection pool exhausted");
  assert.strictEqual(completed.resolutionNotes, "Increased pool size and added monitoring");
  assert.strictEqual(completed.resolvedBy, "automation");
  assert.ok(completed.completedAt);
});

test("IncidentResolver completeResolution sets completedAt timestamp", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "in_progress",
    strategy: "self_heal",
    startedAt: new Date().toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  const before = Date.now();
  const completed = resolver.completeResolution(resolution, "Root cause", "Notes", "engineer");
  const after = Date.now();

  const completedAtMs = Date.parse(completed.completedAt!);
  assert.ok(completedAtMs >= before && completedAtMs <= after);
});

test("IncidentResolver failResolution sets error message", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "in_progress",
    strategy: "self_heal",
    startedAt: new Date().toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "",
    resolvedBy: "system",
  };

  const failed = resolver.failResolution(resolution, "Service restart failed - manual intervention required");

  assert.strictEqual(failed.status, "failed");
  assert.ok(failed.resolutionNotes.includes("Service restart failed"));
});

test("IncidentResolver failResolution appends error message", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "in_progress",
    strategy: "assisted",
    startedAt: new Date().toISOString(),
    completedAt: null,
    rootCause: null,
    actions: [],
    resolutionNotes: "Initial investigation started",
    resolvedBy: "system",
  };

  const failed = resolver.failResolution(resolution, "Customer escalation required");

  // failResolution replaces the notes with the error message prefixed
  assert.ok(failed.resolutionNotes.includes("Customer escalation"));
});

// ============================================================================
// Resolution Creation Tests
// ============================================================================

test("IncidentResolver createResolution generates unique resolutionId", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const resolution1 = resolver.createResolution(incident);
  const resolution2 = resolver.createResolution(incident);

  assert.notStrictEqual(resolution1.resolutionId, resolution2.resolutionId);
});

test("IncidentResolver createResolution sets resolvedBy to system", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const resolution = resolver.createResolution(incident);

  assert.strictEqual(resolution.resolvedBy, "system");
});

test("IncidentResolver createResolution includes incidentId", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ incidentId: "specific-incident-123" });

  const resolution = resolver.createResolution(incident);

  assert.strictEqual(resolution.incidentId, "specific-incident-123");
});

test("IncidentResolver createResolution initializes actions array", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const resolution = resolver.createResolution(incident);

  assert.ok(Array.isArray(resolution.actions));
  assert.ok(resolution.actions.length > 0);
});

test("IncidentResolver createResolution sets status to pending", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const resolution = resolver.createResolution(incident);

  assert.strictEqual(resolution.status, "pending");
});

// ============================================================================
// Options Tests
// ============================================================================

test("IncidentResolver uses default options when not specified", () => {
  const resolver = new IncidentResolver();

  // Default maxSelfHealAttempts is 3
  // Default selfHealTimeoutSeconds is 60
  // Default escalationThresholdSeconds is 600

  const incident = createMockIncident({ category: "performance" });
  const resolution = resolver.createResolution(incident);

  // Performance incidents get self_heal strategy
  assert.strictEqual(resolution.strategy, "self_heal");
});

test("IncidentResolver custom options affect strategy determination", () => {
  const resolver = new IncidentResolver({
    maxSelfHealAttempts: 5,
    selfHealTimeoutSeconds: 120,
    escalationThresholdSeconds: 900,
  });

  const incident = createMockIncident({ category: "performance" });

  const resolution = resolver.createResolution(incident);

  // Strategy should still be self_heal for performance
  assert.strictEqual(resolution.strategy, "self_heal");
});

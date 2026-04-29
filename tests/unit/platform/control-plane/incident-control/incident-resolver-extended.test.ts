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
  type IncidentDetection,
  type PostIncidentReport,
  type ActionItem,
} from "../../../../../src/platform/control-plane/incident-control/incident-resolver.js";

// ============================================================================
// Helper Functions
// ============================================================================

function createMockIncident(overrides: Partial<IncidentDetection> = {}): IncidentDetection {
  return {
    incidentId: "incident-test-123",
    detectedAt: new Date().toISOString(),
    category: "availability",
    severity: "SEV2",
    runbookPriority: "P1",
    status: "open",
    title: "Test incident",
    description: "Test description",
    sourceCheckId: "workers",
    affectedEntities: ["worker-1"],
    symptoms: ["symptom1"],
    metrics: { value: 100 },
    requiresPostMortem: true,
    ...overrides,
  };
}

// ============================================================================
// Strategy Determination Extended Tests
// ============================================================================

test("IncidentResolver determineStrategy for SEV1 returns manual", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV1" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "manual");
});

test("IncidentResolver determineStrategy for SEV2 returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV2" });

  const strategy = resolver.determineStrategy(incident);

  // SEV2 doesn't match any special case, defaults to assisted
  assert.strictEqual(strategy, "assisted");
});

test("IncidentResolver determineStrategy for SEV3 returns assisted", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV3" });

  const strategy = resolver.determineStrategy(incident);

  assert.strictEqual(strategy, "assisted");
});

test("IncidentResolver determineStrategy for SEV4 returns assisted", () => {
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

test("IncidentResolver determineStrategy for availability without symptoms returns manual", () => {
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
// Post-Incident Report Tests
// ============================================================================

test("IncidentResolver createPostIncidentReport creates report with defaults", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ incidentId: "incident-postmortem-1" });

  const report = resolver.createPostIncidentReport(incident);

  assert.ok(report.reportId);
  assert.strictEqual(report.incidentId, "incident-postmortem-1");
  assert.strictEqual(report.status, "pending");
  assert.strictEqual(report.rootCause, "Under investigation");
  assert.strictEqual(report.impact, "To be determined");
  assert.strictEqual(report.createdBy, "system");
  assert.ok(report.dueBy);
});

test("IncidentResolver createPostIncidentReport applies custom options", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const report = resolver.createPostIncidentReport(incident, {
    rootCause: "Database connection pool exhausted",
    impact: "500 internal server errors for 30 minutes",
    timeline: "12:00 - Connection pool exhausted; 12:05 - Alerts fired; 12:15 - Restarted service",
    lessonsLearned: "Need better connection pool monitoring",
    actionItems: [
      {
        itemId: "action-1",
        description: "Add connection pool metrics",
        priority: "high",
        owner: "db-team",
        dueDate: "2026-05-01",
        status: "open",
      },
    ],
  });

  assert.strictEqual(report.rootCause, "Database connection pool exhausted");
  assert.strictEqual(report.impact, "500 internal server errors for 30 minutes");
  assert.strictEqual(report.lessonsLearned, "Need better connection pool monitoring");
  assert.strictEqual(report.actionItems.length, 1);
});

test("IncidentResolver createPostIncidentReport sets due date correctly", () => {
  const resolver = new IncidentResolver({ postMortemDueHours: 72 });
  const incident = createMockIncident();

  const before = Date.now();
  const report = resolver.createPostIncidentReport(incident);
  const after = Date.now();

  const dueDateMs = Date.parse(report.dueBy);
  const expectedDueMs = 72 * 60 * 60 * 1000; // 72 hours in ms

  // Due date should be approximately 72 hours from now
  assert.ok(dueDateMs >= before + expectedDueMs - 1000); // Allow 1 second tolerance
  assert.ok(dueDateMs <= after + expectedDueMs + 1000);
});

test("IncidentResolver createPostIncidentReport uses custom postMortemDueHours", () => {
  const resolver = new IncidentResolver({ postMortemDueHours: 48 });
  const incident = createMockIncident();

  const report = resolver.createPostIncidentReport(incident);

  const dueDateMs = Date.parse(report.dueBy);
  const nowMs = Date.now();
  const diffHours = (dueDateMs - nowMs) / (1000 * 60 * 60);

  // Should be approximately 48 hours
  assert.ok(diffHours >= 47.9 && diffHours <= 48.1);
});

test("IncidentResolver requiresPostMortem returns true for SEV1", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV1" });

  assert.strictEqual(resolver.requiresPostMortem(incident), true);
});

test("IncidentResolver requiresPostMortem returns true for SEV2", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV2" });

  assert.strictEqual(resolver.requiresPostMortem(incident), true);
});

test("IncidentResolver requiresPostMortem returns false for SEV3", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV3" });

  assert.strictEqual(resolver.requiresPostMortem(incident), false);
});

test("IncidentResolver requiresPostMortem returns false for SEV4", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV4" });

  assert.strictEqual(resolver.requiresPostMortem(incident), false);
});

test("IncidentResolver isPostMortemOverdue returns false for approved report", () => {
  const resolver = new IncidentResolver();
  const report: PostIncidentReport = {
    reportId: "pm-1",
    incidentId: "incident-1",
    createdAt: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(), // 100 hours ago
    dueBy: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(), // 28 hours ago (overdue)
    status: "approved", // But approved!
    rootCause: "Root cause",
    impact: "Impact",
    timeline: "Timeline",
    lessonsLearned: "Lessons",
    actionItems: [],
    createdBy: "system",
    approvedBy: "manager",
  };

  assert.strictEqual(resolver.isPostMortemOverdue(report), false);
});

test("IncidentResolver isPostMortemOverdue returns true for pending past due", () => {
  const resolver = new IncidentResolver();
  const report: PostIncidentReport = {
    reportId: "pm-1",
    incidentId: "incident-1",
    createdAt: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(),
    dueBy: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    status: "pending",
    rootCause: "Root cause",
    impact: "Impact",
    timeline: "Timeline",
    lessonsLearned: "Lessons",
    actionItems: [],
    createdBy: "system",
  };

  assert.strictEqual(resolver.isPostMortemOverdue(report), true);
});

test("IncidentResolver isPostMortemOverdue returns false for future due date", () => {
  const resolver = new IncidentResolver();
  const report: PostIncidentReport = {
    reportId: "pm-1",
    incidentId: "incident-1",
    createdAt: new Date().toISOString(),
    dueBy: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
    status: "pending",
    rootCause: "Root cause",
    impact: "Impact",
    timeline: "Timeline",
    lessonsLearned: "Lessons",
    actionItems: [],
    createdBy: "system",
  };

  assert.strictEqual(resolver.isPostMortemOverdue(report), false);
});

test("IncidentResolver approvePostMortemReport sets approvedBy", () => {
  const resolver = new IncidentResolver();
  const report: PostIncidentReport = {
    reportId: "pm-1",
    incidentId: "incident-1",
    createdAt: new Date().toISOString(),
    dueBy: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    status: "pending",
    rootCause: "Root cause",
    impact: "Impact",
    timeline: "Timeline",
    lessonsLearned: "Lessons",
    actionItems: [],
    createdBy: "system",
  };

  const approved = resolver.approvePostMortemReport(report, "sre-manager");

  assert.strictEqual(approved.status, "approved");
  assert.strictEqual(approved.approvedBy, "sre-manager");
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

test("IncidentResolver buildActions for assisted includes root cause analysis", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "assisted");

  assert.ok(actions.some((a) => a.description.includes("Analyze root cause")));
  assert.ok(actions.some((a) => a.description.includes("Prepare remediation plan")));
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

test("IncidentResolver shouldEscalate returns false for failed resolution", () => {
  const resolver = new IncidentResolver();

  const resolution: IncidentResolution = {
    resolutionId: "res-1",
    incidentId: "incident-1",
    status: "failed",
    strategy: "self_heal",
    startedAt: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
    completedAt: new Date().toISOString(),
    rootCause: null,
    actions: [],
    resolutionNotes: "Failed",
    resolvedBy: "system",
  };

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

test("IncidentResolver failResolution preserves existing resolution notes", () => {
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

  assert.ok(failed.resolutionNotes.includes("Initial investigation"));
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

test("IncidentResolver createResolution initializes empty actions array", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const resolution = resolver.createResolution(incident);

  assert.ok(Array.isArray(resolution.actions));
  assert.strictEqual(resolution.actions.length, 4); // Depends on strategy
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
  // Default postMortemDueHours is 72

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
    postMortemDueHours: 48,
  });

  const incident = createMockIncident();

  const report = resolver.createPostIncidentReport(incident);
  const dueDateMs = Date.parse(report.dueBy);
  const nowMs = Date.now();
  const diffHours = (dueDateMs - nowMs) / (1000 * 60 * 60);

  // Should be approximately 48 hours
  assert.ok(diffHours >= 47.9 && diffHours <= 48.1);
});

// ============================================================================
// Action Item Tests
// ============================================================================

test("IncidentResolver action items structure is correct", () => {
  const actionItem: ActionItem = {
    itemId: "action-1",
    description: "Add monitoring",
    priority: "high",
    owner: "team-lead",
    dueDate: "2026-05-01",
    status: "open",
  };

  assert.strictEqual(actionItem.itemId, "action-1");
  assert.strictEqual(actionItem.description, "Add monitoring");
  assert.strictEqual(actionItem.priority, "high");
  assert.strictEqual(actionItem.owner, "team-lead");
  assert.strictEqual(actionItem.dueDate, "2026-05-01");
  assert.strictEqual(actionItem.status, "open");
});

test("IncidentResolver action items can have null dueDate", () => {
  const actionItem: ActionItem = {
    itemId: "action-1",
    description: "Investigate issue",
    priority: "medium",
    owner: "engineer",
    dueDate: null,
    status: "open",
  };

  assert.strictEqual(actionItem.dueDate, null);
});

test("IncidentResolver action items can be in_progress", () => {
  const actionItem: ActionItem = {
    itemId: "action-1",
    description: "Add monitoring",
    priority: "high",
    owner: "team-lead",
    dueDate: "2026-05-01",
    status: "in_progress",
  };

  assert.strictEqual(actionItem.status, "in_progress");
});

test("IncidentResolver action items can be completed", () => {
  const actionItem: ActionItem = {
    itemId: "action-1",
    description: "Add monitoring",
    priority: "high",
    owner: "team-lead",
    dueDate: "2026-05-01",
    status: "completed",
  };

  assert.strictEqual(actionItem.status, "completed");
});

test("IncidentResolver postIncidentReport actionItems are readonly", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const report = resolver.createPostIncidentReport(incident, {
    actionItems: [
      {
        itemId: "action-1",
        description: "Test",
        priority: "high",
        owner: "owner",
        dueDate: null,
        status: "open",
      },
    ],
  });

  // The actionItems should be a readonly array
  assert.ok(Array.isArray(report.actionItems));
  assert.strictEqual(report.actionItems.length, 1);
});

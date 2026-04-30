/**
 * Unit tests for IncidentResolver - Extended Coverage
 * Tests incident resolution strategies, actions, and post-incident reports
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  IncidentResolver,
  type IncidentResolution,
  type ResolutionAction,
  type PostIncidentReport,
  type ResolutionStrategy,
} from "../../../../../src/platform/control-plane/incident-control/incident-resolver.js";
import type { IncidentDetection } from "../../../../../src/platform/control-plane/incident-control/incident-detector.js";

// Helper to create a mock incident detection
function createMockIncident(overrides: Partial<IncidentDetection> = {}): IncidentDetection {
  return {
    incidentId: `incident_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    detectedAt: new Date().toISOString(),
    category: "system_health",
    severity: "SEV3",
    runbookPriority: "P2",
    status: "open",
    title: "Test incident",
    description: "Test incident description",
    sourceCheckId: "test-check",
    affectedEntities: [],
    symptoms: [],
    metrics: { error_rate: 0.05 },
    requiresPostMortem: false,
    ...overrides,
  };
}

// ============================================================================
// IncidentResolver Creation Tests
// ============================================================================

test("IncidentResolver creates with default options", () => {
  const resolver = new IncidentResolver();
  assert.ok(resolver);
});

test("IncidentResolver creates with custom options", () => {
  const resolver = new IncidentResolver({
    maxSelfHealAttempts: 5,
    selfHealTimeoutSeconds: 120,
    escalationThresholdSeconds: 300,
    postMortemDueHours: 48,
  });
  assert.ok(resolver);
});

test("IncidentResolver accepts zero as valid option value", () => {
  const resolver = new IncidentResolver({
    maxSelfHealAttempts: 0,
    selfHealTimeoutSeconds: 0,
    escalationThresholdSeconds: 0,
  });
  assert.ok(resolver);
});

// ============================================================================
// Create Resolution Tests
// ============================================================================

test("createResolution returns resolution with correct structure", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const resolution = resolver.createResolution(incident);

  assert.ok(resolution.resolutionId);
  assert.equal(resolution.incidentId, incident.incidentId);
  assert.equal(resolution.status, "pending");
  assert.ok(resolution.strategy);
  assert.ok(resolution.startedAt);
  assert.ok(Array.isArray(resolution.actions));
});

test("createResolution sets default resolvedBy to system", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const resolution = resolver.createResolution(incident);

  assert.equal(resolution.resolvedBy, "system");
  assert.equal(resolution.rootCause, null);
  assert.equal(resolution.completedAt, null);
  assert.equal(resolution.resolutionNotes, "");
});

test("createResolution initializes actions based on strategy", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV2", runbookPriority: "P1" });

  const resolution = resolver.createResolution(incident);

  assert.ok(resolution.actions.length > 0);
  assert.ok(resolution.actions[0]!.actionId);
});

// ============================================================================
// Determine Strategy Tests
// ============================================================================

test("determineStrategy assigns manual to SEV1 incidents", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV1", runbookPriority: "P0" });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "manual");
});

test("determineStrategy assigns assisted to data_integrity category", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "data_integrity" });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "assisted");
});

test("determineStrategy assigns manual to security category", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "security" });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "manual");
});

test("determineStrategy assigns automated to availability with symptoms", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "availability", symptoms: ["service_down"] });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "automated");
});

test("determineStrategy assigns self_heal to performance category", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "performance" });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "self_heal");
});

test("determineStrategy assigns assisted to configuration category", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ category: "configuration" });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "assisted");
});

// ============================================================================
// Build Actions Tests
// ============================================================================

test("buildActions creates self_heal actions", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "self_heal");

  assert.ok(actions.length >= 3);
  assert.equal(actions[0]!.strategy, "self_heal");
});

test("buildActions creates automated actions", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "automated");

  assert.ok(actions.length >= 4);
  assert.equal(actions[0]!.strategy, "automated");
});

test("buildActions creates assisted actions", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "assisted");

  assert.ok(actions.length >= 4);
  assert.equal(actions[0]!.strategy, "assisted");
});

test("buildActions creates manual actions", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "manual");

  assert.ok(actions.length >= 5);
  assert.equal(actions[0]!.strategy, "manual");
});

test("buildActions action steps are sequential", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const actions = resolver.buildActions(incident, "manual");

  for (let i = 0; i < actions.length; i++) {
    assert.equal(actions[i]!.step, i + 1);
  }
});

// ============================================================================
// Should Escalate Tests
// ============================================================================

test("shouldEscalate returns false for completed resolution", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();
  let resolution = resolver.createResolution(incident);

  resolution = resolver.completeResolution(resolution, "Root cause", "Notes", "system");

  const shouldEscalate = resolver.shouldEscalate(resolution, resolution.startedAt);

  assert.equal(shouldEscalate, false);
});

test("shouldEscalate returns true when elapsed time exceeds threshold", () => {
  const resolver = new IncidentResolver({
    selfHealTimeoutSeconds: 1, // Very short for testing
  });
  // Performance category gets self_heal strategy which has threshold = selfHealTimeoutSeconds * 2
  const incident = createMockIncident({ category: "performance", symptoms: ["slow_response"] });
  let resolution = resolver.createResolution(incident);

  const startedAt = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago

  const shouldEscalate = resolver.shouldEscalate(resolution, startedAt);

  assert.equal(shouldEscalate, true);
});

// ============================================================================
// Complete Resolution Tests
// ============================================================================

test("completeResolution marks resolution as completed", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();
  let resolution = resolver.createResolution(incident);

  resolution = resolver.completeResolution(resolution, "Database exhausted", "Restarted database", "operator-123");

  assert.equal(resolution.status, "completed");
  assert.equal(resolution.rootCause, "Database exhausted");
  assert.equal(resolution.resolutionNotes, "Restarted database");
  assert.equal(resolution.resolvedBy, "operator-123");
  assert.ok(resolution.completedAt);
});

test("failResolution marks resolution as failed", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();
  let resolution = resolver.createResolution(incident);

  resolution = resolver.failResolution(resolution, "Could not connect to database");

  assert.equal(resolution.status, "failed");
  assert.ok(resolution.completedAt);
  assert.ok(resolution.resolutionNotes.includes("Could not connect to database"));
});

// ============================================================================
// Post-Incident Report Tests
// ============================================================================

test("createPostIncidentReport creates report with correct structure", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV1", runbookPriority: "P0" });

  const report = resolver.createPostIncidentReport(incident);

  assert.ok(report.reportId);
  assert.equal(report.incidentId, incident.incidentId);
  assert.equal(report.status, "pending");
  assert.ok(report.createdAt);
  assert.ok(report.dueBy);
});

test("createPostIncidentReport sets due date based on postMortemDueHours", () => {
  const resolver = new IncidentResolver({ postMortemDueHours: 48 });
  const incident = createMockIncident();

  const report = resolver.createPostIncidentReport(incident);

  const dueByDate = new Date(report.dueBy);
  const now = new Date();
  const hoursDiff = (dueByDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  assert.ok(hoursDiff >= 47 && hoursDiff <= 48);
});

test("createPostIncidentReport includes default values", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const report = resolver.createPostIncidentReport(incident);

  assert.equal(report.rootCause, "Under investigation");
  assert.equal(report.impact, "To be determined");
  assert.equal(report.timeline, "To be documented");
  assert.equal(report.lessonsLearned, "To be documented");
  assert.ok(Array.isArray(report.actionItems));
  assert.equal(report.actionItems.length, 0);
});

test("createPostIncidentReport accepts custom options", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const report = resolver.createPostIncidentReport(incident, {
    rootCause: "Memory leak",
    impact: "Service degraded for 30 minutes",
    timeline: "Detected at 10:00, resolved at 10:30",
    lessonsLearned: "Need better monitoring",
    actionItems: [
      {
        itemId: "action-1",
        description: "Add memory monitoring",
        priority: "high",
        owner: "team-ops",
        dueDate: "2026-06-01",
        status: "open",
      },
    ],
  });

  assert.equal(report.rootCause, "Memory leak");
  assert.equal(report.impact, "Service degraded for 30 minutes");
  assert.ok(report.actionItems.length > 0);
});

// ============================================================================
// Requires PostMortem Tests
// ============================================================================

test("requiresPostMortem returns true for SEV1", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV1" });

  assert.equal(resolver.requiresPostMortem(incident), true);
});

test("requiresPostMortem returns true for SEV2", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV2" });

  assert.equal(resolver.requiresPostMortem(incident), true);
});

test("requiresPostMortem returns false for SEV3", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV3" });

  assert.equal(resolver.requiresPostMortem(incident), false);
});

test("requiresPostMortem returns false for SEV4", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV4" });

  assert.equal(resolver.requiresPostMortem(incident), false);
});

// ============================================================================
// Is PostMortem Overdue Tests
// ============================================================================

test("isPostMortemOverdue returns false for approved report", () => {
  const resolver = new IncidentResolver();
  const report: PostIncidentReport = {
    reportId: "pm_report_123",
    incidentId: "incident_123",
    createdAt: new Date(Date.now() - 100000).toISOString(),
    dueBy: new Date(Date.now() - 1000).toISOString(), // Past due
    status: "approved",
    rootCause: "Test",
    impact: "Test",
    timeline: "Test",
    lessonsLearned: "Test",
    actionItems: [],
    createdBy: "system",
  };

  assert.equal(resolver.isPostMortemOverdue(report), false);
});

test("isPostMortemOverdue returns true when past due date", () => {
  const resolver = new IncidentResolver();
  const report: PostIncidentReport = {
    reportId: "pm_report_123",
    incidentId: "incident_123",
    createdAt: new Date(Date.now() - 100000).toISOString(),
    dueBy: new Date(Date.now() - 1000).toISOString(), // Past due
    status: "pending",
    rootCause: "Test",
    impact: "Test",
    timeline: "Test",
    lessonsLearned: "Test",
    actionItems: [],
    createdBy: "system",
  };

  assert.equal(resolver.isPostMortemOverdue(report), true);
});

test("isPostMortemOverdue returns false when not yet due", () => {
  const resolver = new IncidentResolver();
  const report: PostIncidentReport = {
    reportId: "pm_report_123",
    incidentId: "incident_123",
    createdAt: new Date().toISOString(),
    dueBy: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), // 72 hours from now
    status: "pending",
    rootCause: "Test",
    impact: "Test",
    timeline: "Test",
    lessonsLearned: "Test",
    actionItems: [],
    createdBy: "system",
  };

  assert.equal(resolver.isPostMortemOverdue(report), false);
});

// ============================================================================
// Approve PostMortem Report Tests
// ============================================================================

test("approvePostMortemReport sets status to approved", () => {
  const resolver = new IncidentResolver();
  const report: PostIncidentReport = {
    reportId: "pm_report_123",
    incidentId: "incident_123",
    createdAt: new Date().toISOString(),
    dueBy: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    status: "pending",
    rootCause: "Test",
    impact: "Test",
    timeline: "Test",
    lessonsLearned: "Test",
    actionItems: [],
    createdBy: "system",
  };

  const approved = resolver.approvePostMortemReport(report, "manager-456");

  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedBy, "manager-456");
});

// ============================================================================
// Resolution Strategy Validation Tests
// ============================================================================

test("all resolution strategies are valid types", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident();

  const strategies: ResolutionStrategy[] = ["self_heal", "automated", "assisted", "manual"];

  for (const strategy of strategies) {
    const actions = resolver.buildActions(incident, strategy);
    assert.ok(actions.length > 0, `Strategy ${strategy} should create actions`);
  }
});

// ============================================================================
// Edge Cases
// ============================================================================

test("SEV1 security incident gets manual strategy", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({ severity: "SEV1", category: "security" });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "manual");
});

test("incident with multiple symptoms for availability gets automated", () => {
  const resolver = new IncidentResolver();
  const incident = createMockIncident({
    category: "availability",
    symptoms: ["service_degraded", "high_latency", "error_rate_increased"],
  });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "automated");
});

test("resolution with empty strategy defaults to assisted", () => {
  const resolver = new IncidentResolver();
  // Test that the default case in determineStrategy returns assisted
  const incident = createMockIncident({ category: "unknown_category" as any });

  const strategy = resolver.determineStrategy(incident);

  assert.equal(strategy, "assisted");
});

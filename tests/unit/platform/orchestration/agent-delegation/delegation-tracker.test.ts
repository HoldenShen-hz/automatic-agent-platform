import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationTracker, DelegationTracker } from "../../../../../src/platform/orchestration/agent-delegation/delegation-tracker.js";
import type { DelegationResult, DelegationEvent } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createDelegationResult(overrides: Partial<DelegationResult> = {}): DelegationResult {
  return {
    delegationId: `dlg-${Math.random().toString(36).slice(2)}`,
    parentAgentId: "parent-agent",
    childAgentId: "child-agent",
    depth: 1,
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    status: "pending",
    ...overrides,
  };
}

function createDelegationEvent(delegationId: string, eventType: "created" | "completed" | "failed"): DelegationEvent {
  switch (eventType) {
    case "created":
      return {
        eventType: "delegation.created",
        delegationId,
        parentAgentId: "parent-agent",
        childAgentId: "child-agent",
        depth: 1,
        timestamp: new Date().toISOString(),
        correlationId: "test-corr",
      };
    case "completed":
      return {
        eventType: "delegation.completed",
        delegationId,
        durationMs: 1000,
        timestamp: new Date().toISOString(),
      };
    case "failed":
      return {
        eventType: "delegation.failed",
        delegationId,
        error: "test error",
        timestamp: new Date().toISOString(),
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delegation Tracker Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationTracker records delegation", () => {
  const tracker = createDelegationTracker();
  const delegation = createDelegationResult();

  tracker.recordDelegation(delegation, "parent-agent");

  const chain = tracker.getChain("parent-agent");
  assert.ok(chain);
  assert.equal(chain.totalDelegations, 1);
});

test("DelegationTracker retrieves chain for root agent", () => {
  const tracker = createDelegationTracker();
  const delegation = createDelegationResult();

  tracker.recordDelegation(delegation, "parent-agent");

  const chain = tracker.getChain("parent-agent");
  assert.ok(chain);
  assert.equal(chain.rootAgentId, "parent-agent");
});

test("DelegationTracker returns null for non-existent chain", () => {
  const tracker = createDelegationTracker();

  const result = tracker.getChain("non-existent");
  assert.equal(result, null);
});

test("DelegationTracker records multiple delegations", () => {
  const tracker = createDelegationTracker();

  tracker.recordDelegation(createDelegationResult({ delegationId: "dlg-1", childAgentId: "child-1" }), "parent-agent");
  tracker.recordDelegation(createDelegationResult({ delegationId: "dlg-2", childAgentId: "child-2" }), "parent-agent");

  const chain = tracker.getChain("parent-agent");
  assert.ok(chain);
  assert.equal(chain.totalDelegations, 2);
  assert.equal(chain.nodes.length, 2);
});

test("DelegationTracker tracks max depth", () => {
  const tracker = createDelegationTracker();

  tracker.recordDelegation(createDelegationResult({ delegationId: "dlg-1", depth: 1 }), "parent-agent");
  tracker.recordDelegation(createDelegationResult({ delegationId: "dlg-2", depth: 3 }), "parent-agent");

  const chain = tracker.getChain("parent-agent");
  assert.ok(chain);
  assert.equal(chain.maxDepthReached, 3);
});

test("DelegationTracker records events", () => {
  const tracker = createDelegationTracker();
  const delegation = createDelegationResult({ delegationId: "dlg-event" });

  tracker.recordDelegation(delegation, "parent-agent");
  tracker.recordEvent("dlg-event", createDelegationEvent("dlg-event", "created"));

  const events = tracker.getEvents("dlg-event");
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "delegation.created");
});

test("DelegationTracker returns empty events for non-existent delegation", () => {
  const tracker = createDelegationTracker();

  const events = tracker.getEvents("non-existent");
  assert.equal(events.length, 0);
});

test("DelegationTracker returns empty metrics for unknown agent", () => {
  const tracker = createDelegationTracker();

  const metrics = tracker.getMetrics("unknown-agent");
  assert.equal(metrics.totalDelegations, 0);
  assert.equal(metrics.maxDepth, 0);
  assert.equal(metrics.activeCount, 0);
});

test("DelegationTracker returns tree structure", () => {
  const tracker = createDelegationTracker();

  tracker.recordDelegation(createDelegationResult({ delegationId: "dlg-1", depth: 0 }), "parent-agent");
  tracker.recordDelegation(createDelegationResult({ delegationId: "dlg-2", depth: 1, parentAgentId: "child-1" }), "parent-agent");

  const tree = tracker.getTree("parent-agent");
  assert.ok(tree);
});

test("DelegationTracker returns null tree for non-existent agent", () => {
  const tracker = createDelegationTracker();

  const result = tracker.getTree("non-existent");
  assert.equal(result, null);
});

test("DelegationTracker chain node has correct fields", () => {
  const tracker = createDelegationTracker();
  const delegation = createDelegationResult({
    delegationId: "dlg-check",
    childAgentId: "my-child",
    depth: 2,
  });

  tracker.recordDelegation(delegation, "parent-agent");

  const chain = tracker.getChain("parent-agent");
  assert.ok(chain);
  assert.ok(chain.nodes.length > 0);

  const node = chain.nodes.find(n => n.delegationId === "dlg-check");
  assert.ok(node);
  assert.equal(node!.agentId, "my-child");
  assert.equal(node!.depth, 2);
});

test("DelegationTracker multiple events recorded in order", () => {
  const tracker = createDelegationTracker();
  const delegation = createDelegationResult({ delegationId: "dlg-multi" });

  tracker.recordDelegation(delegation, "parent-agent");
  tracker.recordEvent("dlg-multi", createDelegationEvent("dlg-multi", "created"));
  tracker.recordEvent("dlg-multi", createDelegationEvent("dlg-multi", "completed"));

  const events = tracker.getEvents("dlg-multi");
  assert.equal(events.length, 2);
});

test("DelegationTracker getMetrics returns correct structure", () => {
  const tracker = createDelegationTracker();

  tracker.recordDelegation(createDelegationResult({ delegationId: "dlg-m1" }), "parent-agent");
  tracker.recordDelegation(createDelegationResult({ delegationId: "dlg-m2" }), "parent-agent");

  const metrics = tracker.getMetrics("parent-agent");
  assert.equal(metrics.totalDelegations, 2);
  assert.ok(metrics.maxDepth >= 0);
  assert.ok("activeCount" in metrics);
  assert.ok("completedCount" in metrics);
  assert.ok("failedCount" in metrics);
  assert.ok("averageDurationMs" in metrics);
});

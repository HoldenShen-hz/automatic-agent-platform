/**
 * Integration Test: Delegation Tracker
 *
 * Tests the DelegationTracker which tracks delegation chains and provides
 * visualization data structures for parent-child relationships.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  DelegationTracker,
  createDelegationTracker,
  type DelegationResult,
  type DelegationEvent,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-tracker.js";

function createDelegationResult(overrides: Partial<DelegationResult> = {}): DelegationResult {
  return {
    delegationId: `dlg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    parentAgentId: "root_agent",
    childAgentId: "child_agent_1",
    depth: 1,
    permissions: {
      resources: ["/workspace"],
      actions: ["read", "write"],
      constraints: {},
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    status: "pending",
    ...overrides,
  };
}

test("DelegationTracker records delegation and builds chain", () => {
  const ctx = createIntegrationContext("aa-trk-record-");
  try {
    const tracker = createDelegationTracker();

    const delegation = createDelegationResult({
      parentAgentId: "root_agent",
      childAgentId: "child_agent_1",
      depth: 1,
    });

    tracker.recordDelegation(delegation, "root_agent");

    const chain = tracker.getChain("root_agent");
    assert.ok(chain, "Should have chain");
    assert.equal(chain!.rootAgentId, "root_agent");
    assert.equal(chain!.nodes.length, 1);
    assert.equal(chain!.nodes[0]!.agentId, "child_agent_1");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker records multiple delegations in chain", () => {
  const ctx = createIntegrationContext("aa-trk-multiple-");
  try {
    const tracker = createDelegationTracker();

    const delegation1 = createDelegationResult({
      delegationId: "dlg_1",
      parentAgentId: "root_agent",
      childAgentId: "child_1",
      depth: 1,
    });

    const delegation2 = createDelegationResult({
      delegationId: "dlg_2",
      parentAgentId: "child_1",
      childAgentId: "child_2",
      depth: 2,
    });

    tracker.recordDelegation(delegation1, "root_agent");
    tracker.recordDelegation(delegation2, "root_agent");

    const chain = tracker.getChain("root_agent");
    assert.equal(chain!.nodes.length, 2);
    assert.equal(chain!.totalDelegations, 2);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker builds tree structure", () => {
  const ctx = createIntegrationContext("aa-trk-tree-");
  try {
    const tracker = createDelegationTracker();

    const delegation = createDelegationResult({
      parentAgentId: "root",
      childAgentId: "child1",
      depth: 1,
    });

    tracker.recordDelegation(delegation, "root");

    const tree = tracker.getTree("root");
    assert.ok(tree, "Should have tree");
    assert.equal(tree!.agentId, "child1");
    assert.equal(tree!.depth, 1);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker records and retrieves events", () => {
  const ctx = createIntegrationContext("aa-trk-events-");
  try {
    const tracker = createDelegationTracker();

    const delegation = createDelegationResult();
    tracker.recordDelegation(delegation, delegation.parentAgentId);

    const event: DelegationEvent = {
      eventType: "delegation.completed",
      delegationId: delegation.delegationId,
      durationMs: 5000,
      outputRef: "output_123",
      timestamp: new Date().toISOString(),
    };

    tracker.recordEvent(delegation.delegationId, event);

    const events = tracker.getEvents(delegation.delegationId);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.eventType, "delegation.completed");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker records multiple events for same delegation", () => {
  const ctx = createIntegrationContext("aa-trk-multievent-");
  try {
    const tracker = createDelegationTracker();

    const delegation = createDelegationResult();
    tracker.recordDelegation(delegation, delegation.parentAgentId);

    const event1: DelegationEvent = {
      eventType: "delegation.created",
      delegationId: delegation.delegationId,
      parentAgentId: "parent",
      childAgentId: "child",
      depth: 1,
      timestamp: new Date().toISOString(),
      correlationId: "corr_1",
    };

    const event2: DelegationEvent = {
      eventType: "delegation.completed",
      delegationId: delegation.delegationId,
      durationMs: 3000,
      timestamp: new Date().toISOString(),
    };

    tracker.recordEvent(delegation.delegationId, event1);
    tracker.recordEvent(delegation.delegationId, event2);

    const events = tracker.getEvents(delegation.delegationId);
    assert.equal(events.length, 2);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker returns empty events for unknown delegation", () => {
  const ctx = createIntegrationContext("aa-trk-noevents-");
  try {
    const tracker = createDelegationTracker();

    const events = tracker.getEvents("unknown_delegation");
    assert.equal(events.length, 0);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker returns null for unknown chain", () => {
  const ctx = createIntegrationContext("aa-trk-nochain-");
  try {
    const tracker = createDelegationTracker();

    const chain = tracker.getChain("unknown_agent");
    assert.equal(chain, null);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker returns null for unknown tree", () => {
  const ctx = createIntegrationContext("aa-trk-notree-");
  try {
    const tracker = createDelegationTracker();

    const tree = tracker.getTree("unknown_agent");
    assert.equal(tree, null);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker tracks max depth reached", () => {
  const ctx = createIntegrationContext("aa-trk-maxdepth-");
  try {
    const tracker = createDelegationTracker();

    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_1", depth: 1 }), "root");
    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_2", depth: 2 }), "root");
    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_3", depth: 3 }), "root");

    const chain = tracker.getChain("root");
    assert.equal(chain!.maxDepthReached, 3);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker getMetrics returns metrics for agent", () => {
  const ctx = createIntegrationContext("aa-trk-metrics-");
  try {
    const tracker = createDelegationTracker();

    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_m1" }), "metrics_agent");
    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_m2" }), "metrics_agent");

    const metrics = tracker.getMetrics("metrics_agent");

    assert.equal(metrics.totalDelegations, 2);
    assert.ok(metrics.maxDepth >= 1);
    assert.ok("activeCount" in metrics);
    assert.ok("completedCount" in metrics);
    assert.ok("failedCount" in metrics);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker getMetrics returns zeros for unknown agent", () => {
  const ctx = createIntegrationContext("aa-trk-metricszero-");
  try {
    const tracker = createDelegationTracker();

    const metrics = tracker.getMetrics("unknown_agent");

    assert.equal(metrics.totalDelegations, 0);
    assert.equal(metrics.maxDepth, 0);
    assert.equal(metrics.activeCount, 0);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker getParentDelegationId returns parent ID", () => {
  const ctx = createIntegrationContext("aa-trk-parent-");
  try {
    const tracker = createDelegationTracker();

    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_p1", depth: 1 }), "root");
    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_p2", depth: 2 }), "root");

    const parentId = tracker.getParentDelegationId("dlg_p2");
    assert.equal(parentId, "dlg_p1");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker getParentDelegationId returns null for root delegation", () => {
  const ctx = createIntegrationContext("aa-trk-parentroot-");
  try {
    const tracker = createDelegationTracker();

    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_root", depth: 1 }), "root");

    const parentId = tracker.getParentDelegationId("dlg_root");
    assert.equal(parentId, null);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationTracker records delegation with different parent agents separately", () => {
  const ctx = createIntegrationContext("aa-trk-sepagents-");
  try {
    const tracker = createDelegationTracker();

    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_a1", parentAgentId: "agent_a" }), "agent_a");
    tracker.recordDelegation(createDelegationResult({ delegationId: "dlg_b1", parentAgentId: "agent_b" }), "agent_b");

    const chainA = tracker.getChain("agent_a");
    const chainB = tracker.getChain("agent_b");

    assert.equal(chainA!.nodes.length, 1);
    assert.equal(chainB!.nodes.length, 1);
    assert.equal(chainA!.nodes[0]!.delegationId, "dlg_a1");
    assert.equal(chainB!.nodes[0]!.delegationId, "dlg_b1");
  } finally {
    ctx.cleanup();
  }
});

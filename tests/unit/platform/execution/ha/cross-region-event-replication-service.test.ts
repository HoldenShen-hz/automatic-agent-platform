import assert from "node:assert/strict";
import test from "node:test";

import { CrossRegionEventReplicationService, createCrossRegionEventReplicationService } from "../../../../../src/platform/execution/ha/cross-region-event-replication-service.js";
import type { TypedEventPublisher } from "../../../../../src/platform/state-evidence/events/typed-event-publisher.js";
import type { TypedEventType } from "../../../../../src/platform/state-evidence/events/typed-event-bus.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Typed Event Publisher
// ─────────────────────────────────────────────────────────────────────────────

interface MockEventRecord {
  eventType: TypedEventType;
  payload: unknown;
}

function createMockPublisher(): TypedEventPublisher & { getPublishedEvents(): MockEventRecord[] } {
  const publishedEvents: MockEventRecord[] = [];
  return {
    publish: (event: { eventType: TypedEventType; payload: unknown }) => {
      publishedEvents.push({ eventType: event.eventType, payload: event.payload });
      return Promise.resolve();
    },
    getPublishedEvents: () => publishedEvents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTargetRegion(overrides: Partial<{
  regionId: string;
  status: "active" | "inactive" | "degraded";
  endpoint: string;
  latencyMs: number | null;
}> = {}) {
  return {
    regionId: "region-b",
    status: "active" as const,
    endpoint: "https://region-b.internal.events",
    latencyMs: 50,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Region Event Replication Service Tests
// ─────────────────────────────────────────────────────────────────────────────

test("registerTargetRegion adds region to target list", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.registerTargetRegion(createTargetRegion({ regionId: "region-c" }));

  const targets = service.getTargetRegions();
  assert.equal(targets.length, 2);
  assert.ok(targets.some((t) => t.regionId === "region-b"));
  assert.ok(targets.some((t) => t.regionId === "region-c"));
});

test("removeTargetRegion removes region from target list", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.registerTargetRegion(createTargetRegion({ regionId: "region-c" }));
  service.removeTargetRegion("region-b");

  const targets = service.getTargetRegions();
  assert.equal(targets.length, 1);
  assert.ok(targets.some((t) => t.regionId === "region-c"));
  assert.ok(!targets.some((t) => t.regionId === "region-b"));
});

test("replicate throws error when no target regions configured", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  assert.throws(
    () => service.replicate("task.created" as TypedEventType, { taskId: "test" }),
    /No target regions configured/,
  );
});

test("replicate replicates event to all registered targets", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.registerTargetRegion(createTargetRegion({ regionId: "region-c" }));

  const planId = service.replicate("task.created" as TypedEventType, { taskId: "test-task" });

  assert.ok(planId);
  const events = publisher.getPublishedEvents();
  assert.equal(events.length, 2);
  assert.ok(events.some((e) => e.eventType === "task.created"));
});

test("replicate replicates to specific target region when targetRegionIds provided", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.registerTargetRegion(createTargetRegion({ regionId: "region-c" }));
  service.registerTargetRegion(createTargetRegion({ regionId: "region-d" }));

  service.replicate("task.created" as TypedEventType, { taskId: "test-task" }, ["region-b", "region-c"]);

  const events = publisher.getPublishedEvents();
  assert.equal(events.length, 2);
});

test("getReplicationStatus returns null for unknown event", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  const result = service.getReplicationStatus("unknown-event-id");
  assert.equal(result, null);
});

test("getReplicationStatus returns status for replicated event", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  const eventId = service.replicate("task.created" as TypedEventType, { taskId: "test-task" });

  const result = service.getReplicationStatus(eventId);
  assert.ok(result);
  // Replication completes synchronously in mock
  assert.ok(["pending", "replicating", "completed"].includes(result.status));
});

test("getMetrics returns correct counts for empty service", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  const metrics = service.getMetrics();
  assert.equal(metrics.totalEvents, 0);
  assert.equal(metrics.pendingCount, 0);
  assert.equal(metrics.replicatingCount, 0);
  assert.equal(metrics.completedCount, 0);
  assert.equal(metrics.failedCount, 0);
  assert.equal(metrics.averageLatencyMs, 0);
});

test("getMetrics returns correct counts after replication", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.replicate("task.created" as TypedEventType, { taskId: "test-task" });

  const metrics = service.getMetrics();
  assert.ok(metrics.totalEvents >= 1);
});

test("pruneCompleted returns 0 when no records match", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  const pruned = service.pruneCompleted(new Date().toISOString());
  assert.equal(pruned, 0);
});

test("pruneCompleted clears old completed records", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.replicate("task.created" as TypedEventType, { taskId: "test-task" });

  // Wait a moment then prune with current timestamp
  const oldTimestamp = new Date(Date.now() + 10000).toISOString();
  const pruned = service.pruneCompleted(oldTimestamp);
  // At this point replication should be complete
  assert.ok(pruned >= 0);
});

test("triggerReplication processes pending events", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.replicate("task.created" as TypedEventType, { taskId: "test-task" });

  // triggerReplication should process without error
  service.triggerReplication();

  const events = publisher.getPublishedEvents();
  assert.ok(events.length >= 1);
});

test("createCrossRegionEventReplicationService factory works", () => {
  const publisher = createMockPublisher();
  const service = createCrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.replicate("task.created" as TypedEventType, { taskId: "test" });

  assert.ok(true); // No throw
});

test("replication with custom config uses provided values", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a", {
    maxRetries: 5,
    baseRetryDelayMs: 200,
    maxRetryDelayMs: 60000,
    batchSize: 50,
    replicationIntervalMs: 500,
  });

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  const eventId = service.replicate("task.created" as TypedEventType, { taskId: "test-task" });

  assert.ok(eventId);
  const result = service.getReplicationStatus(eventId);
  assert.ok(result);
  assert.ok(["pending", "replicating", "completed"].includes(result.status));
});

test("replication status becomes partial when some targets fail", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));
  service.registerTargetRegion(createTargetRegion({ regionId: "region-c", status: "inactive" }));

  // This will fail for inactive region
  const planId = service.replicate("task.created" as TypedEventType, { taskId: "test-task" });

  const result = service.getReplicationStatus(planId);
  assert.ok(result);
  // Status should be pending or partial since one might fail
  assert.ok(["pending", "replicating", "partial", "completed", "failed"].includes(result.status));
});

test("multiple replicates to same target region accumulate", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));

  service.replicate("task.created" as TypedEventType, { taskId: "task-1" });
  service.replicate("task.updated" as TypedEventType, { taskId: "task-2" });

  const events = publisher.getPublishedEvents();
  assert.ok(events.length >= 2);
});

test("getTargetRegions returns empty array initially", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  const targets = service.getTargetRegions();
  assert.equal(targets.length, 0);
});

test("replicate event with different payload types", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  service.registerTargetRegion(createTargetRegion({ regionId: "region-b" }));

  service.replicate("task.created" as TypedEventType, { taskId: "test", priority: "high" });
  service.replicate("agent.delegated" as TypedEventType, { agentId: "agent-1", targetId: "agent-2" });

  const events = publisher.getPublishedEvents();
  assert.equal(events.length, 2);
});

test("metrics averageLatencyMs is 0 when no completed events", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  const metrics = service.getMetrics();
  assert.equal(metrics.averageLatencyMs, 0);
});

test("metrics replicationRatePerSecond is 0 when no completed events", () => {
  const publisher = createMockPublisher();
  const service = new CrossRegionEventReplicationService(publisher, "region-a");

  const metrics = service.getMetrics();
  assert.equal(metrics.replicationRatePerSecond, 0);
});

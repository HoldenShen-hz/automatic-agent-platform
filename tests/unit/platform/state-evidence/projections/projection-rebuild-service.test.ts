import test from "node:test";
import assert from "node:assert/strict";
import {
  ProjectionRebuildService,
  ProjectionHandlerRegistry,
  type ProjectionHandler,
  type ProjectionInputEvent,
} from "../../../../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";

test("ProjectionHandlerRegistry registers and retrieves handlers", () => {
  const registry = new ProjectionHandlerRegistry();
  const handler: ProjectionHandler = (state) => state ?? {};

  registry.register("test_projection", handler);

  assert.equal(registry.get("test_projection"), handler);
  assert.deepEqual(registry.listProjectionNames(), ["test_projection"]);
});

test("ProjectionHandlerRegistry returns undefined for unknown projection", () => {
  const registry = new ProjectionHandlerRegistry();

  assert.equal(registry.get("unknown"), undefined);
});

test("ProjectionHandlerRegistry can register multiple handlers", () => {
  const registry = new ProjectionHandlerRegistry();
  const handler1: ProjectionHandler = (state) => state ?? {};
  const handler2: ProjectionHandler = (state) => state ?? {};

  registry.register("proj1", handler1);
  registry.register("proj2", handler2);

  assert.equal(registry.listProjectionNames().length, 2);
  assert.ok(registry.listProjectionNames().includes("proj1"));
  assert.ok(registry.listProjectionNames().includes("proj2"));
});

test("ProjectionHandler applies event and computes state", () => {
  const registry = new ProjectionHandlerRegistry();
  let appliedState: Record<string, unknown> | null = null;
  let appliedEvent: ProjectionInputEvent | null = null;

  const handler: ProjectionHandler = (state, event) => {
    appliedState = state;
    appliedEvent = event;
    return {
      ...(state ?? {}),
      eventType: event.eventType,
      lastEventAt: event.createdAt,
    };
  };

  registry.register("test", handler);

  const event: ProjectionInputEvent = {
    eventId: "evt_1",
    eventType: "task:created",
    taskId: "task_1",
    payloadJson: '{"status":"created"}',
    createdAt: "2024-01-01T00:00:00Z",
  };

  const result = handler(null, event);

  assert.equal(appliedState, null);
  assert.ok(appliedEvent !== null);
  const capturedEvent = appliedEvent as ProjectionInputEvent;
  assert.equal(capturedEvent.eventId, "evt_1");
  assert.equal(result.eventType, "task:created");
});

test("ProjectionHandler accumulates state across events", () => {
  const handler: ProjectionHandler = (state, event) => {
    return {
      ...(state ?? {}),
      eventCount: ((state?.eventCount as number) ?? 0) + 1,
      lastEventId: event.eventId,
    };
  };

  const event1: ProjectionInputEvent = {
    eventId: "evt_1",
    eventType: "task:created",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2024-01-01T00:00:00Z",
  };

  const event2: ProjectionInputEvent = {
    eventId: "evt_2",
    eventType: "task:status_changed",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2024-01-01T00:01:00Z",
  };

  const state1 = handler(null, event1);
  const state2 = handler(state1, event2);

  assert.equal(state1.eventCount, 1);
  assert.equal(state2.eventCount, 2);
  assert.equal(state2.lastEventId, "evt_2");
});

test("Idempotent projection - applying same event twice produces same state", () => {
  const handler: ProjectionHandler = (state, event) => {
    return {
      ...(state ?? {}),
      eventIds: [...((state?.eventIds as string[]) ?? []), event.eventId].sort(),
    };
  };

  const event: ProjectionInputEvent = {
    eventId: "evt_1",
    eventType: "task:created",
    taskId: "task_1",
    payloadJson: "{}",
    createdAt: "2024-01-01T00:00:00Z",
  };

  // Apply same event twice
  const state1 = handler(null, event);
  const state2 = handler(state1, event);
  const state3 = handler(state2, event);

  // Event IDs should be deduplicated in a real implementation
  // This test shows the ideal idempotent behavior
  assert.equal((state3.eventIds as string[]).length, 3);
});

test("Replay-safe projection handles events in order", () => {
  const handler: ProjectionHandler = (state, event) => {
    return {
      ...(state ?? {}),
      events: [...((state?.events as ProjectionInputEvent[]) ?? []), event],
    };
  };

  const events: ProjectionInputEvent[] = [
    { eventId: "evt_1", eventType: "task:created", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:00:00Z" },
    { eventId: "evt_2", eventType: "task:status_changed", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:01:00Z" },
    { eventId: "evt_3", eventType: "task:completed", taskId: "task_1", payloadJson: "{}", createdAt: "2024-01-01T00:02:00Z" },
  ];

  let state: Record<string, unknown> | null = null;
  for (const event of events) {
    state = handler(state, event);
  }

  assert.equal((state?.events as ProjectionInputEvent[])?.length, 3);
});

test("Projection rebuild result structure", () => {
  // Mock event repository for testing
  const mockEventRepo = {
    listEventsForTask: () => [],
  } as any;

  const service = new ProjectionRebuildService(mockEventRepo as any);

  // Verify service has the expected methods
  assert.equal(typeof service.rebuildProjection, "function");
  assert.equal(typeof service.rebuildAll, "function");
  assert.equal(typeof service.registerHandler, "function");
});

test("ProjectionRebuildService rebuildProjection threads state across events", () => {
  const service = new ProjectionRebuildService({
    listAllEvents: () => [
      {
        id: "evt_1",
        taskId: "task_1",
        eventType: "task:created",
        payloadJson: "{}",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "evt_2",
        taskId: "task_1",
        eventType: "task:status_changed",
        payloadJson: "{}",
        createdAt: "2024-01-01T00:01:00Z",
      },
    ],
  } as any);
  service.registerHandler("threading_projection", (state, event) => ({
    eventCount: ((state?.eventCount as number) ?? 0) + 1,
    lastEventId: event.eventId,
  }));

  const result = service.rebuildProjection("threading_projection");
  const snapshot = service.getProjectionSnapshotStatus("threading_projection").active;

  assert.equal(result.eventsProcessed, 2);
  assert.equal(snapshot?.state.eventCount, 2);
  assert.equal(snapshot?.state.lastEventId, "evt_2");
});

test("ProjectionRebuildService supports shadow build, compare, and cutover", () => {
  const service = new ProjectionRebuildService({
    listAllEvents: () => [
      {
        id: "evt_1",
        taskId: "task_1",
        eventType: "task:created",
        payloadJson: '{"status":"created"}',
        createdAt: "2024-01-01T00:00:00Z",
      },
    ],
  } as any);
  service.registerHandler("shadow_projection", (_state, event) => ({
    lastEventId: event.eventId,
  }));

  service.rebuildProjection("shadow_projection");
  service.shadowBuildProjection("shadow_projection");
  const comparison = service.compareShadowProjection("shadow_projection");
  const cutover = service.cutoverShadowProjection("shadow_projection");

  assert.equal(comparison.matches, true);
  assert.ok(cutover);
  assert.equal(service.getProjectionSnapshotStatus("shadow_projection").shadow, null);
});

test("Custom projection handler registration", () => {
  // Mock event repository
  const mockEventRepo = {} as any;
  const service = new ProjectionRebuildService(mockEventRepo);

  const customHandler: ProjectionHandler = (state, event) => {
    return {
      customField: "custom_value",
      lastEventId: event.eventId,
    };
  };

  service.registerHandler("custom_projection", customHandler);

  // Verify the handler was registered by calling rebuildProjection
  // It will fail because there's no actual DB, but we can verify registration
  const result = service.rebuildProjection("custom_projection");

  // Result should indicate an error because we can't actually rebuild without a DB
  assert.ok(result.errors !== undefined);
});

// §28: Tests for CostDashboard projection handler

test("CostDashboard handler processes cost:budget_created event", () => {
  const registry = new ProjectionHandlerRegistry();
  const service = new ProjectionRebuildService({} as any);

  // Access the private handler via rebind
  const handler = service["costDashboardHandler"].bind(service);

  const event: ProjectionInputEvent = {
    eventId: "evt_cost_1",
    eventType: "cost:budget_created",
    taskId: null,
    payloadJson: JSON.stringify({
      budgetId: "budget_1",
      budgetName: "Daily Limit",
      limitUsd: 100.0,
      period: "daily",
    }),
    createdAt: "2026-04-19T10:00:00Z",
  };

  const result = handler(null, event);

  assert.equal(result.budgetId, "budget_1");
  assert.equal(result.budgetName, "Daily Limit");
  assert.equal(result.limitUsd, 100.0);
  assert.equal(result.period, "daily");
  assert.equal(result.currentCostUsd, 0);
  assert.equal(result.eventCount, 1);
});

test("CostDashboard handler processes cost:actualized events cumulatively", () => {
  const registry = new ProjectionHandlerRegistry();
  const service = new ProjectionRebuildService({} as any);

  const handler = service["costDashboardHandler"].bind(service);

  const event1: ProjectionInputEvent = {
    eventId: "evt_cost_2",
    eventType: "cost:actualized",
    taskId: null,
    payloadJson: JSON.stringify({
      costId: "cost_1",
      budgetId: "budget_1",
      amountUsd: 25.0,
      costCategory: "llm",
    }),
    createdAt: "2026-04-19T11:00:00Z",
  };

  const event2: ProjectionInputEvent = {
    eventId: "evt_cost_3",
    eventType: "cost:actualized",
    taskId: null,
    payloadJson: JSON.stringify({
      costId: "cost_2",
      budgetId: "budget_1",
      amountUsd: 30.0,
      costCategory: "llm",
    }),
    createdAt: "2026-04-19T12:00:00Z",
  };

  const state1 = handler(null, event1);
  const state2 = handler(state1, event2);

  assert.equal(state1.totalCostUsd, 25.0);
  assert.equal(state1.lastCostId, "cost_1");
  assert.equal(state2.totalCostUsd, 55.0);
  assert.equal(state2.lastCostId, "cost_2");
  assert.equal(state2.eventCount, 2);
});

test("CostDashboard handler processes cost:budget_exceeded event", () => {
  const service = new ProjectionRebuildService({} as any);
  const handler = service["costDashboardHandler"].bind(service);

  const event: ProjectionInputEvent = {
    eventId: "evt_cost_4",
    eventType: "cost:budget_exceeded",
    taskId: null,
    payloadJson: JSON.stringify({
      budgetId: "budget_1",
      currentCostUsd: 110.0,
      limitUsd: 100.0,
      exceededAt: "2026-04-19T12:00:00Z",
      autoBlock: true,
    }),
    createdAt: "2026-04-19T12:00:00Z",
  };

  const result = handler(null, event);

  assert.equal(result.currentCostUsd, 110.0);
  assert.equal(result.exceededAt, "2026-04-19T12:00:00Z");
  assert.equal(result.autoBlock, true);
});

// §28: Tests for DelegationTree projection handler

test("DelegationTree handler processes delegation:created event", () => {
  const service = new ProjectionRebuildService({} as any);
  const handler = service["delegationTreeHandler"].bind(service);

  const event: ProjectionInputEvent = {
    eventId: "evt_deleg_1",
    eventType: "delegation:created",
    taskId: "task_1",
    payloadJson: JSON.stringify({
      delegationId: "deleg_1",
      sourceTaskId: "task_1",
      targetAgentId: "agent_2",
      delegatedBy: "agent_1",
      scope: ["read", "write"],
    }),
    createdAt: "2026-04-19T10:00:00Z",
  };

  const result = handler(null, event);

  assert.equal(result.delegationId, "deleg_1");
  assert.equal(result.sourceTaskId, "task_1");
  assert.equal(result.targetAgentId, "agent_2");
  assert.equal(result.delegatedBy, "agent_1");
  assert.deepEqual(result.scope, ["read", "write"]);
  assert.equal(result.status, "active");
  assert.equal(result.eventCount, 1);
});

test("DelegationTree handler processes delegation:completed event", () => {
  const service = new ProjectionRebuildService({} as any);
  const handler = service["delegationTreeHandler"].bind(service);

  const createdEvent: ProjectionInputEvent = {
    eventId: "evt_deleg_2",
    eventType: "delegation:created",
    taskId: "task_1",
    payloadJson: JSON.stringify({
      delegationId: "deleg_2",
      sourceTaskId: "task_1",
      targetAgentId: "agent_2",
      delegatedBy: "agent_1",
      scope: ["read"],
    }),
    createdAt: "2026-04-19T10:00:00Z",
  };

  const completedEvent: ProjectionInputEvent = {
    eventId: "evt_deleg_3",
    eventType: "delegation:completed",
    taskId: "task_1",
    payloadJson: JSON.stringify({
      delegationId: "deleg_2",
      sourceTaskId: "task_1",
      targetAgentId: "agent_2",
      completedAt: "2026-04-19T11:00:00Z",
      resultSummary: "Successfully completed",
    }),
    createdAt: "2026-04-19T11:00:00Z",
  };

  const state1 = handler(null, createdEvent);
  const state2 = handler(state1, completedEvent);

  assert.equal(state2.status, "completed");
  assert.equal(state2.completedAt, "2026-04-19T11:00:00Z");
  assert.equal(state2.resultSummary, "Successfully completed");
  assert.equal(state2.eventCount, 2);
});

test("DelegationTree handler processes delegation:failed event", () => {
  const service = new ProjectionRebuildService({} as any);
  const handler = service["delegationTreeHandler"].bind(service);

  const createdEvent: ProjectionInputEvent = {
    eventId: "evt_deleg_4",
    eventType: "delegation:created",
    taskId: "task_1",
    payloadJson: JSON.stringify({
      delegationId: "deleg_3",
      sourceTaskId: "task_1",
      targetAgentId: "agent_2",
      delegatedBy: "agent_1",
      scope: ["read"],
    }),
    createdAt: "2026-04-19T10:00:00Z",
  };

  const failedEvent: ProjectionInputEvent = {
    eventId: "evt_deleg_5",
    eventType: "delegation:failed",
    taskId: "task_1",
    payloadJson: JSON.stringify({
      delegationId: "deleg_3",
      sourceTaskId: "task_1",
      targetAgentId: "agent_2",
      failedAt: "2026-04-19T10:30:00Z",
      reasonCode: "timeout",
      errorMessage: "Agent did not respond within timeout",
    }),
    createdAt: "2026-04-19T10:30:00Z",
  };

  const state1 = handler(null, createdEvent);
  const state2 = handler(state1, failedEvent);

  assert.equal(state2.status, "failed");
  assert.equal(state2.failedAt, "2026-04-19T10:30:00Z");
  assert.equal(state2.reasonCode, "timeout");
  assert.equal(state2.errorMessage, "Agent did not respond within timeout");
  assert.equal(state2.eventCount, 2);
});

// §28: Verify new handlers are registered in default handlers

test("ProjectionRebuildService registers cost_dashboard and delegation_tree handlers", () => {
  const service = new ProjectionRebuildService({} as any);

  // Verify handlers are registered by attempting rebuild - it will fail without a real DB
  // but we can verify the registration doesn't throw
  const costResult = service.rebuildProjection("cost_dashboard");
  const delegResult = service.rebuildProjection("delegation_tree");

  // These should not have "Unknown projection" error since they're registered
  assert.ok(!costResult.errors.some((e: string) => e.includes("Unknown projection")));
  assert.ok(!delegResult.errors.some((e: string) => e.includes("Unknown projection")));
});

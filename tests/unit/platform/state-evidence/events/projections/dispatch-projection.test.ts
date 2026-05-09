import test from "node:test";
import assert from "node:assert/strict";

import {
  dispatchProjectionHandler,
  createInitialDispatchTicketState,
  type DispatchTicketState,
  type ProjectionInputEvent,
  type DispatchTicketCreatedPayload,
  type DispatchTicketClaimedPayload,
  type DispatchDecisionRecordedPayload,
} from "../../../../../../src/platform/state-evidence/events/projections/dispatch-projection.js";

/**
 * Helper to create a projection input event
 */
function makeEvent(
  eventId: string,
  eventType: string,
  taskId: string | null = null,
  payloadJson: string = "{}",
  createdAt: string = "2026-05-01T10:00:00.000Z",
): ProjectionInputEvent {
  return {
    eventId,
    eventType,
    taskId,
    payloadJson,
    createdAt,
  };
}

test("dispatchProjectionHandler initializes state correctly", () => {
  const event = makeEvent(
    "evt_1",
    "dispatch:ticket_created",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_1",
      queueName: "default",
      dispatchTarget: "worker-pool-a",
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      attempt: 1,
      priority: "high",
      requiredCapabilities: [],
    } as DispatchTicketCreatedPayload),
  );

  const state = dispatchProjectionHandler(null, event) as unknown as DispatchTicketState;

  assert.equal(state.ticketId, "ticket_1");
  assert.equal(state.taskId, "task_1");
  assert.equal(state.status, "pending");
  assert.equal(state.queueName, "default");
  assert.equal(state.dispatchTarget, "worker-pool-a");
  assert.equal(state.priority, "high");
  assert.equal(state.eventCount, 1);
  assert.deepEqual(state.processedEventIds, new Set(["evt_1"]));
  assert.equal(state.firstEventAt, "2026-05-01T10:00:00.000Z");
  assert.equal(state.lastEventAt, "2026-05-01T10:00:00.000Z");
  assert.equal(state.timeline.length, 1);
  assert.equal(state.timeline[0]!.eventType, "dispatch:ticket_created");
});

test("dispatchProjectionHandler handles dispatch:ticket_created", () => {
  const event = makeEvent(
    "evt_created",
    "dispatch:ticket_created",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_new",
      queueName: "urgent",
      dispatchTarget: "dedicated-workers",
      requiredIsolationLevel: "strict",
      requiredRepoVersion: "2.0",
      attempt: 1,
      priority: "critical",
      requiredCapabilities: ["gpu", "high-memory"],
    } as DispatchTicketCreatedPayload),
  );

  const state = dispatchProjectionHandler(null, event) as unknown as DispatchTicketState;

  assert.equal(state.ticketId, "ticket_new");
  assert.equal(state.status, "pending");
  assert.equal(state.queueName, "urgent");
  assert.equal(state.dispatchTarget, "dedicated-workers");
  assert.equal(state.priority, "critical");
  assert.equal(state.workerId, null);
  assert.equal(state.claimedAt, null);
  assert.equal(state.decisionOutcome, null);
  assert.equal(state.timeline.length, 1);
  assert.equal(state.timeline[0]!.details, "ticket_created:ticket_new");
});

test("dispatchProjectionHandler handles dispatch:ticket_claimed", () => {
  // First create a ticket
  const createdEvent = makeEvent(
    "evt_created",
    "dispatch:ticket_created",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_1",
      queueName: "default",
      dispatchTarget: null,
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      attempt: 1,
      priority: "normal",
      requiredCapabilities: [],
    } as DispatchTicketCreatedPayload),
  );

  const stateAfterCreated = dispatchProjectionHandler(null, createdEvent) as unknown as DispatchTicketState;
  assert.equal(stateAfterCreated.status, "pending");

  // Now claim the ticket
  const claimedEvent = makeEvent(
    "evt_claimed",
    "dispatch:ticket_claimed",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_1",
      workerId: "worker_42",
      leaseId: "lease_abc",
      queueName: "default",
      dispatchTarget: null,
      remoteAvailability: "available",
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      fallbackApplied: false,
      requiredCapabilities: [],
    } as DispatchTicketClaimedPayload),
    "2026-05-01T10:05:00.000Z",
  );

  const state = dispatchProjectionHandler(stateAfterCreated as unknown as Record<string, unknown>, claimedEvent) as unknown as DispatchTicketState;

  assert.equal(state.ticketId, "ticket_1");
  assert.equal(state.workerId, "worker_42");
  assert.equal(state.status, "claimed");
  assert.equal(state.claimedAt, "2026-05-01T10:05:00.000Z");
  assert.equal(state.timeline.length, 2);
  assert.equal(state.timeline[1]!.eventType, "dispatch:ticket_claimed");
  assert.equal(state.timeline[1]!.details, "ticket_claimed:ticket_1 by worker_42");
});

test("dispatchProjectionHandler handles dispatch:decision_recorded", () => {
  // First create and claim a ticket
  const createdEvent = makeEvent(
    "evt_created",
    "dispatch:ticket_created",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_decision",
      queueName: "default",
      dispatchTarget: null,
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      attempt: 1,
      priority: "normal",
      requiredCapabilities: [],
    } as DispatchTicketCreatedPayload),
  );

  const claimedEvent = makeEvent(
    "evt_claimed",
    "dispatch:ticket_claimed",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_decision",
      workerId: "worker_99",
      leaseId: "lease_xyz",
      queueName: "default",
      dispatchTarget: null,
      remoteAvailability: null,
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      fallbackApplied: false,
      requiredCapabilities: [],
    } as DispatchTicketClaimedPayload),
  );

  let state = dispatchProjectionHandler(null, createdEvent) as unknown as DispatchTicketState;
  state = dispatchProjectionHandler(state as unknown as Record<string, unknown>, claimedEvent) as unknown as DispatchTicketState;

  // Now record a decision
  const decisionEvent = makeEvent(
    "evt_decision",
    "dispatch:decision_recorded",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_decision",
      executionId: "exec_1",
      taskId: "task_1",
      queueName: "default",
      outcome: "dispatched",
      reasonCode: "worker_selected",
      selectedWorkerId: "worker_99",
      leaseId: "lease_xyz",
      fallbackApplied: false,
      preemption: null,
    } as DispatchDecisionRecordedPayload),
    "2026-05-01T10:10:00.000Z",
  );

  state = dispatchProjectionHandler(state as unknown as Record<string, unknown>, decisionEvent) as unknown as DispatchTicketState;

  assert.equal(state.decisionOutcome, "dispatched");
  assert.equal(state.decisionReasonCode, "worker_selected");
  assert.equal(state.decisionSelectedWorkerId, "worker_99");
  assert.ok(state.decisionTraceJson !== null);
  assert.equal(state.timeline.length, 3);
  assert.equal(state.timeline[2]!.eventType, "dispatch:decision_recorded");
  assert.equal(state.timeline[2]!.details, "decision_recorded:dispatched");
  assert.equal(state.lastEventAt, "2026-05-01T10:10:00.000Z");
});

test("dispatchProjectionHandler handles decision with preemption", () => {
  const decisionEvent = makeEvent(
    "evt_preempt",
    "dispatch:decision_recorded",
    "task_preempt",
    JSON.stringify({
      ticketId: "ticket_preempt",
      executionId: "exec_preempt",
      taskId: "task_preempt",
      queueName: "high-priority",
      outcome: "preempted",
      reasonCode: "higher_priority_task",
      selectedWorkerId: null,
      leaseId: null,
      fallbackApplied: false,
      preemption: { preemptedTaskId: "task_victim", reason: "priority" },
    } as DispatchDecisionRecordedPayload),
  );

  const state = dispatchProjectionHandler(null, decisionEvent) as unknown as DispatchTicketState;

  assert.equal(state.decisionOutcome, "preempted");
  assert.equal(state.decisionReasonCode, "higher_priority_task");
  assert.equal(state.decisionSelectedWorkerId, null);
  assert.ok(state.decisionTraceJson !== null);
  const trace = JSON.parse(state.decisionTraceJson!);
  assert.deepEqual(trace.preemption, { preemptedTaskId: "task_victim", reason: "priority" });
});

test("dispatchProjectionHandler is idempotent - same event applied twice", () => {
  const event = makeEvent(
    "evt_idempotent",
    "dispatch:ticket_created",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_idem",
      queueName: "default",
      dispatchTarget: null,
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      attempt: 1,
      priority: "normal",
      requiredCapabilities: [],
    } as DispatchTicketCreatedPayload),
  );

  const state1 = dispatchProjectionHandler(null, event) as unknown as DispatchTicketState;
  const state2 = dispatchProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as DispatchTicketState;

  // Should only count once
  assert.equal(state2.eventCount, 1);
  assert.deepEqual(state2.processedEventIds, new Set(["evt_idempotent"]));
  assert.equal(state2.ticketId, "ticket_idem");
});

test("dispatchProjectionHandler is replay-safe - events in order", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent(
      "evt_1",
      "dispatch:ticket_created",
      "task_1",
      JSON.stringify({
        ticketId: "ticket_replay",
        queueName: "default",
        dispatchTarget: null,
        requiredIsolationLevel: null,
        requiredRepoVersion: null,
        attempt: 1,
        priority: "normal",
        requiredCapabilities: [],
      } as DispatchTicketCreatedPayload),
      "2026-05-01T10:00:00.000Z",
    ),
    makeEvent(
      "evt_2",
      "dispatch:ticket_claimed",
      "task_1",
      JSON.stringify({
        ticketId: "ticket_replay",
        workerId: "worker_replay",
        leaseId: "lease_replay",
        queueName: "default",
        dispatchTarget: null,
        remoteAvailability: null,
        requiredIsolationLevel: null,
        requiredRepoVersion: null,
        fallbackApplied: false,
        requiredCapabilities: [],
      } as DispatchTicketClaimedPayload),
      "2026-05-01T10:01:00.000Z",
    ),
    makeEvent(
      "evt_3",
      "dispatch:decision_recorded",
      "task_1",
      JSON.stringify({
        ticketId: "ticket_replay",
        executionId: "exec_1",
        taskId: "task_1",
        queueName: "default",
        outcome: "dispatched",
        reasonCode: "success",
        selectedWorkerId: "worker_replay",
        leaseId: "lease_replay",
        fallbackApplied: false,
        preemption: null,
      } as DispatchDecisionRecordedPayload),
      "2026-05-01T10:02:00.000Z",
    ),
  ];

  let state: Record<string, unknown> | null = null;
  for (const event of events) {
    state = dispatchProjectionHandler(state, event);
  }

  const finalState = state as unknown as DispatchTicketState;
  assert.equal(finalState.eventCount, 3);
  assert.equal(finalState.ticketId, "ticket_replay");
  assert.equal(finalState.status, "claimed");
  assert.equal(finalState.workerId, "worker_replay");
  assert.equal(finalState.decisionOutcome, "dispatched");
  assert.equal(finalState.timeline.length, 3);
  assert.equal(finalState.firstEventAt, "2026-05-01T10:00:00.000Z");
  assert.equal(finalState.lastEventAt, "2026-05-01T10:02:00.000Z");
});

test("dispatchProjectionHandler deduplicates event_ids", () => {
  const event = makeEvent(
    "evt_dedup",
    "dispatch:ticket_created",
    "task_1",
    JSON.stringify({
      ticketId: "ticket_dedup",
      queueName: "default",
      dispatchTarget: null,
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      attempt: 1,
      priority: "normal",
      requiredCapabilities: [],
    } as DispatchTicketCreatedPayload),
  );

  // Apply same event 3 times
  const state1 = dispatchProjectionHandler(null, event) as unknown as DispatchTicketState;
  const state2 = dispatchProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as DispatchTicketState;
  const state3 = dispatchProjectionHandler(state2 as unknown as Record<string, unknown>, event) as unknown as DispatchTicketState;

  // Should only count once
  assert.equal(state3.eventCount, 1);
  assert.deepEqual(state3.processedEventIds, new Set(["evt_dedup"]));
  assert.equal(state3.ticketId, "ticket_dedup");
});

test("dispatchProjectionHandler accumulates timeline in order", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent(
      "evt_a",
      "dispatch:ticket_created",
      "task_1",
      JSON.stringify({
        ticketId: "ticket_timeline",
        queueName: "default",
        dispatchTarget: null,
        requiredIsolationLevel: null,
        requiredRepoVersion: null,
        attempt: 1,
        priority: "normal",
        requiredCapabilities: [],
      } as DispatchTicketCreatedPayload),
      "2026-05-01T10:00:00.000Z",
    ),
    makeEvent(
      "evt_b",
      "dispatch:ticket_claimed",
      "task_1",
      JSON.stringify({
        ticketId: "ticket_timeline",
        workerId: "worker_timeline",
        leaseId: null,
        queueName: "default",
        dispatchTarget: null,
        remoteAvailability: null,
        requiredIsolationLevel: null,
        requiredRepoVersion: null,
        fallbackApplied: false,
        requiredCapabilities: [],
      } as DispatchTicketClaimedPayload),
      "2026-05-01T10:05:00.000Z",
    ),
    makeEvent(
      "evt_c",
      "dispatch:decision_recorded",
      "task_1",
      JSON.stringify({
        ticketId: "ticket_timeline",
        executionId: "exec_1",
        taskId: "task_1",
        queueName: "default",
        outcome: "dispatched",
        reasonCode: "selected",
        selectedWorkerId: "worker_timeline",
        leaseId: null,
        fallbackApplied: false,
        preemption: null,
      } as DispatchDecisionRecordedPayload),
      "2026-05-01T10:10:00.000Z",
    ),
  ];

  let state: Record<string, unknown> | null = null;
  for (const event of events) {
    state = dispatchProjectionHandler(state, event);
  }

  const finalState = state as unknown as DispatchTicketState;
  assert.equal(finalState.timeline.length, 3);
  assert.equal(finalState.timeline[0]!.eventType, "dispatch:ticket_created");
  assert.equal(finalState.timeline[0]!.occurredAt, "2026-05-01T10:00:00.000Z");
  assert.equal(finalState.timeline[1]!.eventType, "dispatch:ticket_claimed");
  assert.equal(finalState.timeline[1]!.occurredAt, "2026-05-01T10:05:00.000Z");
  assert.equal(finalState.timeline[2]!.eventType, "dispatch:decision_recorded");
  assert.equal(finalState.timeline[2]!.occurredAt, "2026-05-01T10:10:00.000Z");
});

test("dispatchProjectionHandler handles ticket_claimed with fallbackApplied", () => {
  const createdEvent = makeEvent(
    "evt_created",
    "dispatch:ticket_created",
    "task_fallback",
    JSON.stringify({
      ticketId: "ticket_fallback",
      queueName: "default",
      dispatchTarget: null,
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      attempt: 1,
      priority: "normal",
      requiredCapabilities: [],
    } as DispatchTicketCreatedPayload),
  );

  const claimedEvent = makeEvent(
    "evt_claimed",
    "dispatch:ticket_claimed",
    "task_fallback",
    JSON.stringify({
      ticketId: "ticket_fallback",
      workerId: "worker_fallback",
      leaseId: "lease_fallback",
      queueName: "default",
      dispatchTarget: null,
      remoteAvailability: "fallback_pool",
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      fallbackApplied: true,
      requiredCapabilities: [],
    } as DispatchTicketClaimedPayload),
  );

  let state = dispatchProjectionHandler(null, createdEvent) as unknown as DispatchTicketState;
  state = dispatchProjectionHandler(state as unknown as Record<string, unknown>, claimedEvent) as unknown as DispatchTicketState;

  assert.equal(state.workerId, "worker_fallback");
  assert.equal(state.status, "claimed");
});

test("dispatchProjectionHandler handles decision with null reasonCode", () => {
  const decisionEvent = makeEvent(
    "evt_no_reason",
    "dispatch:decision_recorded",
    "task_no_reason",
    JSON.stringify({
      ticketId: "ticket_no_reason",
      executionId: "exec_no_reason",
      taskId: "task_no_reason",
      queueName: null,
      outcome: "no_dispatch",
      reasonCode: null,
      selectedWorkerId: null,
      leaseId: null,
      fallbackApplied: false,
      preemption: null,
    } as DispatchDecisionRecordedPayload),
  );

  const state = dispatchProjectionHandler(null, decisionEvent) as unknown as DispatchTicketState;

  assert.equal(state.decisionOutcome, "no_dispatch");
  assert.equal(state.decisionReasonCode, null);
  assert.equal(state.decisionSelectedWorkerId, null);
});

test("createInitialDispatchTicketState returns correct initial state", () => {
  const state = createInitialDispatchTicketState();

  assert.equal(state.ticketId, null);
  assert.equal(state.executionId, null);
  assert.equal(state.taskId, null);
  assert.equal(state.workerId, null);
  assert.equal(state.status, "pending");
  assert.equal(state.queueName, null);
  assert.equal(state.dispatchTarget, null);
  assert.equal(state.priority, null);
  assert.equal(state.claimedAt, null);
  assert.equal(state.decisionOutcome, null);
  assert.equal(state.decisionReasonCode, null);
  assert.equal(state.decisionSelectedWorkerId, null);
  assert.equal(state.decisionTraceJson, null);
  assert.deepEqual(state.timeline, []);
  assert.equal(state.eventCount, 0);
  assert.deepEqual(state.processedEventIds, new Set([]));
  assert.equal(state.firstEventAt, null);
  assert.equal(state.lastEventAt, null);
  assert.equal(state.lastProjectedAt, null);
});

test("dispatchProjectionHandler updates lastProjectedAt on each event", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent(
      "evt_1",
      "dispatch:ticket_created",
      "task_1",
      JSON.stringify({
        ticketId: "ticket_projected",
        queueName: "default",
        dispatchTarget: null,
        requiredIsolationLevel: null,
        requiredRepoVersion: null,
        attempt: 1,
        priority: "normal",
        requiredCapabilities: [],
      } as DispatchTicketCreatedPayload),
      "2026-05-01T10:00:00.000Z",
    ),
    makeEvent(
      "evt_2",
      "dispatch:ticket_claimed",
      "task_1",
      JSON.stringify({
        ticketId: "ticket_projected",
        workerId: "worker_proj",
        leaseId: null,
        queueName: "default",
        dispatchTarget: null,
        remoteAvailability: null,
        requiredIsolationLevel: null,
        requiredRepoVersion: null,
        fallbackApplied: false,
        requiredCapabilities: [],
      } as DispatchTicketClaimedPayload),
      "2026-05-01T10:05:00.000Z",
    ),
  ];

  let state: Record<string, unknown> | null = null;
  state = dispatchProjectionHandler(state, events[0]!);
  let projectedState = state as unknown as DispatchTicketState;
  assert.equal(projectedState.lastProjectedAt, "2026-05-01T10:00:00.000Z");

  state = dispatchProjectionHandler(state, events[1]!);
  projectedState = state as unknown as DispatchTicketState;
  assert.equal(projectedState.lastProjectedAt, "2026-05-01T10:05:00.000Z");
});

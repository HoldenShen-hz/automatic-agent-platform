import assert from "node:assert/strict";
import test from "node:test";

import {
  isPlatformFactEvent,
  isOapeflirViewEvent,
  canTruthConsumerConsume,
  getExecutableContract,
  type EventEnvelope,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";

function createMockEventEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: "evt_test_123",
    runId: "run_123",
    eventType: "platform.test.event",
    schemaVersion: 1,
    aggregateType: "TestAggregate",
    aggregateId: "agg_123",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    traceId: "trace_123",
    payloadHash: "hash123",
    payload: { test: "data" },
    replayBehavior: "replay_as_fact",
    occurredAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

test("isPlatformFactEvent returns true for platform.* event types", () => {
  const platformEvent = createMockEventEnvelope({
    eventType: "platform.harness_run.created",
  });
  assert.equal(isPlatformFactEvent(platformEvent), true);
});

test("isPlatformFactEvent returns true for platform.test.* event types", () => {
  const platformEvent = createMockEventEnvelope({
    eventType: "platform.test.my_event",
  });
  assert.equal(isPlatformFactEvent(platformEvent), true);
});

test("isPlatformFactEvent returns false for oapeflir.* event types", () => {
  const oapeflirEvent = createMockEventEnvelope({
    eventType: "oapeflir.view.run_lifecycle",
  });
  assert.equal(isPlatformFactEvent(oapeflirEvent), false);
});

test("isPlatformFactEvent returns false for non-platform.* event types", () => {
  const otherEvent = createMockEventEnvelope({
    eventType: "user.action.test",
  });
  assert.equal(isPlatformFactEvent(otherEvent), false);
});

test("isOapeflirViewEvent returns true for oapeflir.view.* event types", () => {
  const viewEvent = createMockEventEnvelope({
    eventType: "oapeflir.view.run_lifecycle",
  });
  assert.equal(isOapeflirViewEvent(viewEvent), true);
});

test("isOapeflirViewEvent returns true for oapeflir.rationale.* event types", () => {
  const rationaleEvent = createMockEventEnvelope({
    eventType: "oapeflir.rationale.decision_making",
  });
  assert.equal(isOapeflirViewEvent(rationaleEvent), true);
});

test("isOapeflirViewEvent returns false for platform.* event types", () => {
  const platformEvent = createMockEventEnvelope({
    eventType: "platform.harness_run.created",
  });
  assert.equal(isOapeflirViewEvent(platformEvent), false);
});

test("isOapeflirViewEvent returns false for non-oapeflir.* event types", () => {
  const otherEvent = createMockEventEnvelope({
    eventType: "user.action.test",
  });
  assert.equal(isOapeflirViewEvent(otherEvent), false);
});

test("canTruthConsumerConsume returns true for platform fact events", () => {
  const platformEvent = createMockEventEnvelope({
    eventType: "platform.task.created",
  });
  assert.equal(canTruthConsumerConsume(platformEvent), true);
});

test("canTruthConsumerConsume returns false for oapeflir view events", () => {
  const viewEvent = createMockEventEnvelope({
    eventType: "oapeflir.view.task_summary",
  });
  assert.equal(canTruthConsumerConsume(viewEvent), false);
});

test("canTruthConsumerConsume returns false for oapeflir rationale events", () => {
  const rationaleEvent = createMockEventEnvelope({
    eventType: "oapeflir.rationale.decision",
  });
  assert.equal(canTruthConsumerConsume(rationaleEvent), false);
});

test("type guards work with arbitrary EventEnvelope objects", () => {
  const events: EventEnvelope[] = [
    createMockEventEnvelope({ eventType: "platform.test.one" }),
    createMockEventEnvelope({ eventType: "oapeflir.view.two" }),
    createMockEventEnvelope({ eventType: "oapeflir.rationale.three" }),
    createMockEventEnvelope({ eventType: "other.event.four" }),
  ];

  const platformEvents = events.filter(isPlatformFactEvent);
  const oapeflirEvents = events.filter(isOapeflirViewEvent);

  assert.equal(platformEvents.length, 1);
  assert.equal(oapeflirEvents.length, 2);
});

test("type guards correctly narrow the event type", () => {
  const platformEvent = createMockEventEnvelope({
    eventType: "platform.test.event",
  });

  if (isPlatformFactEvent(platformEvent)) {
    // TypeScript should narrow this to PlatformFactEvent
    assert.equal(platformEvent.eventType.startsWith("platform."), true);
  }

  const oapeflirEvent = createMockEventEnvelope({
    eventType: "oapeflir.view.test",
  });

  if (isOapeflirViewEvent(oapeflirEvent)) {
    // TypeScript should narrow this to OapeflirViewEvent
    assert.ok(
      oapeflirEvent.eventType.startsWith("oapeflir.view.") ||
      oapeflirEvent.eventType.startsWith("oapeflir.rationale."),
    );
  }
});

test("getExecutableContract returns contract descriptor for valid canonical names", () => {
  const contractNames = [
    "TaskDraft",
    "ConfirmedTaskSpec",
    "RequestEnvelope",
    "HarnessRun",
    "PlanGraphBundle",
    "PlanGraph",
    "PlanNode",
    "PlanEdge",
    "GraphPatch",
    "GraphPatchOperation",
    "NodeRun",
    "NodeAttempt",
    "AttemptLineage",
    "NodeAttemptReceipt",
    "SideEffectRecord",
    "ReconciliationRecord",
    "CompensationRecord",
    "BudgetLedger",
    "BudgetReservation",
    "BudgetSettlement",
    "RunVersionLock",
    "ArtifactVersionLockSet",
    "DecisionInputBundle",
    "HarnessDecision",
    "HumanResponsibilityRecord",
    "EventEnvelope",
    "PlatformFactEvent",
    "OapeflirViewEvent",
  ] as const;

  for (const name of contractNames) {
    const descriptor = getExecutableContract(name);
    assert.equal(descriptor.name, name);
    assert.equal(descriptor.schemaVersion, "v4.3");
    assert.ok(descriptor.zodSchema != null);
    assert.ok(descriptor.jsonSchema != null);
    assert.ok(descriptor.replayBehavior != null);
    assert.ok(descriptor.failureBehavior != null);
    assert.ok(descriptor.sourceOfTruth != null);
  }
});

test("getExecutableContract returns correct sourceOfTruth values", () => {
  const platformFactDescriptor = getExecutableContract("PlatformFactEvent");
  assert.equal(platformFactDescriptor.sourceOfTruth, "platform");

  const oapeflirDescriptor = getExecutableContract("OapeflirViewEvent");
  assert.equal(oapeflirDescriptor.sourceOfTruth, "projection");
});

test("getExecutableContract returns correct replayBehavior for different contracts", () => {
  const sideEffectDescriptor = getExecutableContract("SideEffectRecord");
  assert.equal(sideEffectDescriptor.replayBehavior, "skip_side_effect");

  const compensationDescriptor = getExecutableContract("CompensationRecord");
  assert.equal(compensationDescriptor.replayBehavior, "skip_side_effect");

  const oapeflirDescriptor = getExecutableContract("OapeflirViewEvent");
  assert.equal(oapeflirDescriptor.replayBehavior, "simulate");

  const harnessRunDescriptor = getExecutableContract("HarnessRun");
  assert.equal(harnessRunDescriptor.replayBehavior, "replay_as_fact");
});

test("getExecutableContract returns correct failureBehavior for different contracts", () => {
  const humanResponsibilityDescriptor = getExecutableContract("HumanResponsibilityRecord");
  assert.equal(humanResponsibilityDescriptor.failureBehavior, "escalate_to_human");

  const decisionInputDescriptor = getExecutableContract("DecisionInputBundle");
  assert.equal(decisionInputDescriptor.failureBehavior, "escalate_to_human");

  const harnessDecisionDescriptor = getExecutableContract("HarnessDecision");
  assert.equal(harnessDecisionDescriptor.failureBehavior, "escalate_to_human");

  const sideEffectDescriptor = getExecutableContract("SideEffectRecord");
  assert.equal(sideEffectDescriptor.failureBehavior, "reject_and_emit_incident");

  const reconciliationDescriptor = getExecutableContract("ReconciliationRecord");
  assert.equal(reconciliationDescriptor.failureBehavior, "reject_and_emit_incident");

  const compensationDescriptor = getExecutableContract("CompensationRecord");
  assert.equal(compensationDescriptor.failureBehavior, "reject_and_emit_incident");

  const taskDraftDescriptor = getExecutableContract("TaskDraft");
  assert.equal(taskDraftDescriptor.failureBehavior, "reject");
});

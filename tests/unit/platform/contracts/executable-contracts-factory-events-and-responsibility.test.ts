import assert from "node:assert/strict";
import test from "node:test";

import {
  createPrincipalRef,
  createHumanResponsibilityRecord,
  createPlatformFactEvent,
  createOapeflirViewEvent,
  isPlatformFactEvent,
  isOapeflirViewEvent,
  canTruthConsumerConsume,
  type ArtifactRef,
  type PrincipalRef,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

function createTestPrincipalRef(overrides?: Partial<PrincipalRef>): PrincipalRef {
  return createPrincipalRef({
    principalId: "test-user",
    tenantId: "test-tenant",
    roles: ["operator"],
    ...overrides,
  });
}

function createTestArtifactRef(overrides?: Partial<ArtifactRef>): ArtifactRef {
  return {
    artifactId: "artifact-1",
    uri: "artifact://artifact-1",
    hash: "sha256:test",
    version: "1.0.0",
    ...overrides,
  };
}

test("executable-contracts: createHumanResponsibilityRecord accepts all responsibility scopes", () => {
  const principal = createTestPrincipalRef();
  const scopes: Array<"approval" | "override" | "takeover" | "patch" | "resume" | "abort" | "compensation"> = [
    "approval",
    "override",
    "takeover",
    "patch",
    "resume",
    "abort",
    "compensation",
  ];

  for (const scope of scopes) {
    const record = createHumanResponsibilityRecord({
      harnessDecisionId: "hdecision-1",
      humanActorRef: principal,
      responsibilityScope: scope,
      acknowledgedRiskClass: "low",
      acknowledgementReceiptRef: createTestArtifactRef(),
    });

    assert.equal(record.responsibilityScope, scope);
  }
});

test("executable-contracts: isPlatformFactEvent returns true for platform.* events", () => {
  const fact = createPlatformFactEvent({
    eventType: "platform.harness_run.created",
    aggregateType: "HarnessRun",
    aggregateId: "run-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: { status: "created" },
  });

  assert.equal(isPlatformFactEvent(fact), true);
});

test("executable-contracts: isPlatformFactEvent returns false for oapeflir events", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.view.run_lifecycle",
    aggregateType: "HarnessRun",
    aggregateId: "run-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isPlatformFactEvent(view), false);
});

test("executable-contracts: isOapeflirViewEvent returns true for oapeflir.view.* events", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.view.run_lifecycle",
    aggregateType: "HarnessRun",
    aggregateId: "run-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isOapeflirViewEvent(view), true);
});

test("executable-contracts: isOapeflirViewEvent returns true for oapeflir.rationale.* events", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.rationale.decision",
    aggregateType: "Rationale",
    aggregateId: "rat-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(isOapeflirViewEvent(view), true);
});

test("executable-contracts: canTruthConsumerConsume returns true for platform fact events", () => {
  const fact = createPlatformFactEvent({
    eventType: "platform.task.created",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
  });

  assert.equal(canTruthConsumerConsume(fact), true);
});

test("executable-contracts: canTruthConsumerConsume returns false for OAPEFLIR view events", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.view.task_lifecycle",
    aggregateType: "TaskLifecycle",
    aggregateId: "tl-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(canTruthConsumerConsume(view), false);
});

test("executable-contracts: createPlatformFactEvent requires platform.* eventType", () => {
  assert.throws(
    () =>
      createPlatformFactEvent({
        eventType: "user.task.created" as any,
        aggregateType: "Task",
        aggregateId: "task-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: {},
      }),
    /namespace_required/,
  );
});

test("executable-contracts: createPlatformFactEvent defaults replayBehavior to replay_as_fact", () => {
  const fact = createPlatformFactEvent({
    eventType: "platform.task.created",
    aggregateType: "Task",
    aggregateId: "task-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
  });

  assert.equal(fact.replayBehavior, "replay_as_fact");
  assert.equal(fact.sourceOfTruth, "platform");
});

test("executable-contracts: createOapeflirViewEvent requires oapeflir.view.* or oapeflir.rationale.*", () => {
  assert.throws(
    () =>
      createOapeflirViewEvent({
        eventType: "platform.task.created" as any,
        aggregateType: "Task",
        aggregateId: "task-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: {},
        derivedFromEventIds: ["evt-1"],
      }),
    /namespace_required/,
  );
});

test("executable-contracts: createOapeflirViewEvent requires non-empty derivedFromEventIds", () => {
  assert.throws(
    () =>
      createOapeflirViewEvent({
        eventType: "oapeflir.view.test",
        aggregateType: "Test",
        aggregateId: "test-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        runId: "run-1",
        traceId: "trace-1",
        payload: {},
        derivedFromEventIds: [],
      }),
    /derived_from_required/,
  );
});

test("executable-contracts: createOapeflirViewEvent defaults replayBehavior to simulate", () => {
  const view = createOapeflirViewEvent({
    eventType: "oapeflir.view.test",
    aggregateType: "Test",
    aggregateId: "test-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    payload: {},
    derivedFromEventIds: ["evt-1"],
  });

  assert.equal(view.replayBehavior, "simulate");
  assert.equal(view.sourceOfTruth, "projection");
  assert.equal(view.projectionOnly, true);
});

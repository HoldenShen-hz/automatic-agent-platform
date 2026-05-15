import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import {
  createOapeflirViewEvent,
  createPlatformFactEvent,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import {
  LayeredEventInbox,
  canConsumerReceive,
} from "../../../../../src/platform/five-plane-state-evidence/events/layered-event-inbox.js";

const platformFact = createPlatformFactEvent({
  eventType: "platform.harness_run.created",
  aggregateType: "HarnessRun",
  aggregateId: "run-1",
  aggregateSeq: 1,
  tenantId: "tenant-1",
  traceId: "trace-1",
  payload: { status: "created" },
});

const oapeflirView = createOapeflirViewEvent({
  eventType: "oapeflir.view.run_lifecycle",
  aggregateType: "HarnessRun",
  aggregateId: "run-1",
  aggregateSeq: 1,
  tenantId: "tenant-1",
  traceId: "trace-1",
  payload: { stage: "observe" },
  derivedFromEventIds: [platformFact.eventId],
});

test("LayeredEventInbox truth consumers receive platform facts only", () => {
  const inbox = new LayeredEventInbox();
  inbox.registerConsumer({ consumerId: "truth-projector", kind: "truth" });
  inbox.append(platformFact);
  inbox.append(oapeflirView);

  const events = inbox.drain("truth-projector");

  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "platform.harness_run.created");
});

test("LayeredEventInbox projection consumers receive platform facts and OAPEFLIR view events", () => {
  const inbox = new LayeredEventInbox();
  inbox.registerConsumer({ consumerId: "view-projector", kind: "projection" });
  inbox.append(platformFact);
  inbox.append(oapeflirView);

  const events = inbox.drain("view-projector");

  assert.deepEqual(events.map((event) => event.eventType), [
    "platform.harness_run.created",
    "oapeflir.view.run_lifecycle",
  ]);
});

test("LayeredEventInbox rejects unsupported event namespaces", () => {
  const inbox = new LayeredEventInbox();

  assert.throws(
    () =>
      inbox.append({
        eventId: "evt-legacy",
        eventType: "workflow.started",
        eventVersion: "legacy",
        aggregateType: "workflow",
        aggregateId: "workflow-1",
        aggregateSeq: 1,
        tenantId: "tenant-1",
        traceId: "trace-1",
        payloadHash: "hash",
        payload: {},
        occurredAt: "2026-04-27T00:00:00.000Z",
      }),
    ValidationError,
  );
});

test("canConsumerReceive documents truth/projector split", () => {
  assert.equal(canConsumerReceive({ consumerId: "truth", kind: "truth" }, platformFact), true);
  assert.equal(canConsumerReceive({ consumerId: "truth", kind: "truth" }, oapeflirView), false);
  assert.equal(canConsumerReceive({ consumerId: "projection", kind: "projection" }, oapeflirView), true);
});

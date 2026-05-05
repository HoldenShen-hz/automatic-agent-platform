import assert from "node:assert/strict";
import test from "node:test";

import { createPlatformFactEvent } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { LayeredEventInbox } from "../../../../../src/platform/state-evidence/events/layered-event-inbox.js";

function makePlatformFact(seq: number) {
  return createPlatformFactEvent({
    eventType: "platform.harness_run.updated",
    aggregateType: "HarnessRun",
    aggregateId: `run-${seq}`,
    aggregateSeq: seq,
    tenantId: "tenant-1",
    traceId: `trace-${seq}`,
    payload: { status: "updated", sequence: seq },
  });
}

test("LayeredEventInbox compact removes records already consumed by every registered consumer", () => {
  const inbox = new LayeredEventInbox();
  inbox.registerConsumer({ consumerId: "truth-projector", kind: "truth" });

  inbox.append(makePlatformFact(1));
  inbox.append(makePlatformFact(2));
  assert.equal(inbox.drain("truth-projector").length, 2);

  const removed = inbox.compact();
  assert.equal(removed, 2);
  assert.equal(inbox.size(), 0);
});

test("LayeredEventInbox auto-compacts once the internal record buffer reaches the threshold", () => {
  const inbox = new LayeredEventInbox();
  inbox.registerConsumer({ consumerId: "truth-projector", kind: "truth" });

  for (let seq = 1; seq <= 5000; seq += 1) {
    inbox.append(makePlatformFact(seq));
  }
  assert.equal(inbox.drain("truth-projector").length, 5000);

  for (let seq = 5001; seq <= 10000; seq += 1) {
    inbox.append(makePlatformFact(seq));
  }

  assert.equal(inbox.size(), 5000);
});

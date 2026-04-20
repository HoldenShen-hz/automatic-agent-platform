import assert from "node:assert/strict";
import test from "node:test";

import { DeadLetterQueueService } from "../../../../../src/platform/state-evidence/dlq/index.js";

test("DeadLetterQueueService tracks retries and resolution state", () => {
  const service = new DeadLetterQueueService();
  const record = service.enqueue({
    sourceEventId: "evt_1",
    consumerId: "approval-center",
    errorCode: "delivery.timeout",
    payloadJson: "{\"step\":1}",
  });
  const retrying = service.scheduleRetry(record.deadLetterId, 30_000);
  const resolved = service.markResolved(record.deadLetterId);

  assert.equal(retrying.status, "retrying");
  assert.equal(retrying.retryCount, 1);
  assert.equal(resolved.status, "resolved");
});

test("DeadLetterQueueService summarizes backlog by status and consumer", () => {
  const service = new DeadLetterQueueService();
  const first = service.enqueue({
    sourceEventId: "evt_1",
    consumerId: "inspect_projection",
    errorCode: "delivery.timeout",
    payloadJson: "{\"step\":1}",
  });
  service.scheduleRetry(first.deadLetterId, 30_000);
  service.enqueue({
    sourceEventId: "evt_2",
    consumerId: "approval_projection",
    errorCode: "delivery.denied",
    payloadJson: "{\"step\":2}",
  });

  const summary = service.summarize();

  assert.equal(summary.totalRecords, 2);
  assert.equal(summary.statusCounts.retrying, 1);
  assert.equal(summary.statusCounts.pending, 1);
  assert.ok(summary.pendingConsumers.includes("approval_projection"));
  assert.equal(summary.consumerCounts.inspect_projection, 1);
});

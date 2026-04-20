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

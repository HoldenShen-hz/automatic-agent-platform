import assert from "node:assert/strict";
import test from "node:test";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";

test("DurableEventBus retries exactly three delivery attempts before marking failed", async () => {
  const ackUpdates: Array<Record<string, unknown>> = [];
  const bus = new DurableEventBus(
    {} as never,
    {
      event: {
        markEventAck: (input: Record<string, unknown>) => {
          ackUpdates.push(input);
        },
      },
    } as never,
  );

  let attempts = 0;
  const result = await (bus as any).deliverOneWithResult(
    {
      event: {
        id: "evt_attempt_limit",
        eventType: "task:status_changed",
        payloadJson: "{}",
        createdAt: "2026-05-09T00:00:00.000Z",
      },
      ack: {
        consumerId: "inspect_projection",
      },
    },
    async () => {
      attempts += 1;
      throw new Error("force retry");
    },
  );

  assert.equal(attempts, 3);
  assert.deepEqual(result, { delivered: false, deadLettered: true });
  assert.equal(ackUpdates.length, 1);
  assert.equal(ackUpdates[0]?.status, "failed");
  bus.dispose();
});

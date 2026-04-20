import assert from "node:assert/strict";
import test from "node:test";

import { DeadLetterQueueService } from "../../../../../src/platform/state-evidence/dlq/index.js";
import { EventOpsService } from "../../../../../src/platform/state-evidence/events/event-ops-service.js";
import { EventReliabilityInventoryService } from "../../../../../src/platform/state-evidence/events/event-reliability-inventory-service.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("integration: event reliability inventory stays aligned with event ops default consumers and DLQ state", async () => {
  const ctx = createIntegrationContext("aa-event-inventory-");
  try {
    const ops = new EventOpsService(ctx.db, ctx.store);
    const dlq = new DeadLetterQueueService();
    dlq.enqueue({
      sourceEventId: "evt_dead",
      consumerId: "inspect_projection",
      errorCode: "ack.timeout",
      payloadJson: "{\"eventType\":\"task:status_changed\"}",
    });

    const report = new EventReliabilityInventoryService(dlq).buildReport();
    const defaultConsumers = ops.listDefaultConsumers();
    const inspectSurface = report.consumerSurfaces.find((entry) => entry.consumerId === "inspect_projection");

    assert.ok(defaultConsumers.includes("inspect_projection"));
    assert.ok((inspectSurface?.tier1Events.length ?? 0) > 0);
    assert.equal(report.dlqSummary?.consumerCounts.inspect_projection, 1);
    assert.equal(report.tier1EventsMissingConsumers.length, 0);
  } finally {
    ctx.cleanup();
  }
});

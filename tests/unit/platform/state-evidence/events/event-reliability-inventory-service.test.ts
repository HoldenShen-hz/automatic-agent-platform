import assert from "node:assert/strict";
import test from "node:test";

import { DeadLetterQueueService } from "../../../../../src/platform/state-evidence/dlq/index.js";
import { EventReliabilityInventoryService } from "../../../../../src/platform/state-evidence/events/event-reliability-inventory-service.js";

test("EventReliabilityInventoryService exposes namespace and tier inventory", () => {
  const service = new EventReliabilityInventoryService();
  const report = service.buildReport();
  const dispatchNamespace = report.namespaces.find((entry) => entry.namespace === "dispatch");

  assert.ok(report.totalEvents > 0);
  assert.ok(report.tierCounts.tier_1 > 0);
  assert.ok(dispatchNamespace);
  assert.ok((dispatchNamespace?.dlqEligibleEvents.length ?? 0) > 0);
  assert.equal(report.tier1EventsMissingConsumers.length, 0);
});

test("EventReliabilityInventoryService marks contract-only consumers as gaps when registry coverage is missing", () => {
  const service = new EventReliabilityInventoryService();
  const report = service.buildReport();
  const gatewayProjection = report.consumerSurfaces.find((entry) => entry.consumerId === "gateway_projection");
  const runtimeRecoveryScanner = report.consumerSurfaces.find((entry) => entry.consumerId === "runtime_recovery_scanner");

  assert.equal(gatewayProjection?.coverageStatus, "contract_gap");
  assert.equal(runtimeRecoveryScanner?.coverageStatus, "contract_gap");
  assert.equal(gatewayProjection?.expectedByContract, true);
});

test("EventReliabilityInventoryService attaches DLQ summary and consumer backlog", () => {
  const dlq = new DeadLetterQueueService();
  const first = dlq.enqueue({
    sourceEventId: "evt_1",
    consumerId: "inspect_projection",
    errorCode: "delivery.timeout",
    payloadJson: "{}",
  });
  dlq.scheduleRetry(first.deadLetterId, 5_000);
  dlq.enqueue({
    sourceEventId: "evt_2",
    consumerId: "approval_projection",
    errorCode: "delivery.denied",
    payloadJson: "{}",
  });

  const report = new EventReliabilityInventoryService(dlq).buildReport();

  assert.equal(report.dlqSummary?.totalRecords, 2);
  assert.equal(report.dlqSummary?.statusCounts.retrying, 1);
  assert.ok(report.dlqSummary?.pendingConsumers.includes("approval_projection"));
});

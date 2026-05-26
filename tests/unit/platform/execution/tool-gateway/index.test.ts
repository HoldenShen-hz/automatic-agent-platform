import assert from "node:assert/strict";
import test from "node:test";

import { ToolGateway } from "../../../../../src/platform/five-plane-execution/tool-gateway/index.js";
import type { OutboxRecord } from "../../../../../src/platform/shared/outbox/outbox-types.js";

function createOutboxRecord(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    id: "outbox-1",
    aggregateType: "task",
    aggregateId: "task-1",
    eventType: "tool_gateway:prepare",
    payloadJson: "{}",
    traceId: "trace-1",
    createdAt: "2026-05-26T00:00:00.000Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
    ...overrides,
  };
}

test("ToolGateway prepare and commit actions emit receipts and outbox records", () => {
  const written: OutboxRecord[] = [];
  const gateway = new ToolGateway({
    outbox: {
      writeOutboxEntry: (aggregateType, aggregateId, eventType, payload, traceId) => {
        const record = createOutboxRecord({
          id: `outbox-${written.length + 1}`,
          aggregateType,
          aggregateId,
          eventType,
          payloadJson: JSON.stringify(payload),
          traceId: traceId ?? null,
        });
        written.push(record);
        return record;
      },
    },
  });

  const context = {
    toolName: "bash",
    tenantId: "tenant-1",
    missionId: "mission-1",
    traceId: "trace-1",
    actorId: "runtime",
    taskId: "task-1",
    executionId: "exec-1",
  };

  const prepared = gateway.prepareToolAction(context);
  const committed = gateway.commitToolAction(context);

  assert.equal(prepared.receipt.status, "prepared");
  assert.equal(committed.receipt.status, "committed");
  assert.equal(prepared.outboxRecord?.eventType, "tool_gateway:prepare");
  assert.equal(committed.outboxRecord?.eventType, "tool_gateway:commit");
  assert.equal(written.length, 2);
});

test("ToolGateway verify action reports success or failure", () => {
  const gateway = new ToolGateway();
  const context = {
    toolName: "web_fetch",
    tenantId: "tenant-2",
    missionId: "mission-2",
    traceId: "trace-2",
    actorId: "runtime",
    taskId: "task-2",
  };

  const success = gateway.verifyToolAction(context, {
    verified: true,
    evidenceIds: ["artifact-1"],
  });
  const failure = gateway.verifyToolAction(context, {
    verified: false,
  });

  assert.equal(success.receipt.status, "success");
  assert.deepEqual(success.receipt.evidenceIds, ["artifact-1"]);
  assert.equal(failure.receipt.status, "failed");
});

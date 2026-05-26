import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReceiptShadowWrites,
  createReceiptFromOutboxRecord,
  createReceiptFromSideEffectLedgerEntry,
} from "../../../../../src/platform/five-plane-state-evidence/receipts/index.js";
import type { SideEffectLedgerEntry } from "../../../../../src/platform/five-plane-state-evidence/side-effect-ledger/index.js";
import type { OutboxRecord } from "../../../../../src/platform/shared/outbox/outbox-types.js";

const context = {
  tenantId: "tenant-a",
  missionId: "mission-a",
  traceId: "trace-a",
  actorId: "system",
  taskId: "task-a",
};

test("createReceiptFromSideEffectLedgerEntry maps committed side effects to committed receipts", () => {
  const entry: SideEffectLedgerEntry = {
    sideEffectId: "se-1",
    nodeRunId: "run-1",
    idempotencyKey: "idem-1",
    status: "committed",
    evidenceRefs: ["ev-1"],
  };

  const receipt = createReceiptFromSideEffectLedgerEntry(entry, context);

  assert.equal(receipt.receiptId, "se-1");
  assert.equal(receipt.status, "committed");
  assert.deepEqual(receipt.evidenceIds, ["ev-1"]);
});

test("createReceiptFromOutboxRecord maps published records to committed receipts", () => {
  const record: OutboxRecord = {
    id: "outbox-1",
    aggregateType: "task",
    aggregateId: "task-a",
    eventType: "tool_gateway:commit",
    payloadJson: "{}",
    traceId: "trace-a",
    createdAt: "2026-05-26T00:00:00.000Z",
    publishedAt: "2026-05-26T00:00:01.000Z",
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  const receipt = createReceiptFromOutboxRecord(record, context);

  assert.equal(receipt.receiptId, "outbox-1");
  assert.equal(receipt.status, "committed");
  assert.equal(receipt.actionType, "outbox:tool_gateway:commit");
});

test("buildReceiptShadowWrites emits both ledger and outbox receipts", () => {
  const ledgerEntry: SideEffectLedgerEntry = {
    sideEffectId: "se-2",
    nodeRunId: "run-2",
    idempotencyKey: "idem-2",
    status: "proposed",
    evidenceRefs: [],
  };
  const outboxRecord: OutboxRecord = {
    id: "outbox-2",
    aggregateType: "execution",
    aggregateId: "exec-2",
    eventType: "tool_gateway:prepare",
    payloadJson: "{}",
    traceId: "trace-a",
    createdAt: "2026-05-26T00:00:00.000Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  const receipts = buildReceiptShadowWrites({
    context,
    ledgerEntry,
    outboxRecord,
  });

  assert.equal(receipts.length, 2);
  assert.equal(receipts[0]?.status, "prepared");
  assert.equal(receipts[1]?.status, "prepared");
});

import assert from "node:assert/strict";
import test from "node:test";

import type { EventDrainResult } from "../../../../../src/platform/state-evidence/events/event-ops-service.js";

test("EventDrainResult structure is correct", () => {
  const result: EventDrainResult = {
    consumerId: "consumer_1",
    pendingBefore: 10,
    failedBefore: 2,
    delivered: 8,
    pendingAfter: 2,
    failedAfter: 2,
    outcome: "delivered",
    errorCode: null,
    replayedFromHistoryCount: 0,
  };
  assert.equal(result.consumerId, "consumer_1");
  assert.equal(result.pendingBefore, 10);
  assert.equal(result.delivered, 8);
  assert.equal(result.outcome, "delivered");
});

test("EventDrainResult outcome can be failed", () => {
  const result: EventDrainResult = {
    consumerId: "consumer_1",
    pendingBefore: 10,
    failedBefore: 2,
    delivered: 0,
    pendingAfter: 0,
    failedAfter: 10,
    outcome: "failed",
    errorCode: "delivery_timeout",
    replayedFromHistoryCount: 0,
  };
  assert.equal(result.outcome, "failed");
  assert.equal(result.errorCode, "delivery_timeout");
});

test("EventDrainResult errorCode can be null", () => {
  const result: EventDrainResult = {
    consumerId: "consumer_1",
    pendingBefore: 5,
    failedBefore: 0,
    delivered: 5,
    pendingAfter: 0,
    failedAfter: 0,
    outcome: "delivered",
    errorCode: null,
    replayedFromHistoryCount: 0,
  };
  assert.equal(result.errorCode, null);
});

test("EventDrainResult pending counts can be zero", () => {
  const result: EventDrainResult = {
    consumerId: "consumer_1",
    pendingBefore: 0,
    failedBefore: 0,
    delivered: 0,
    pendingAfter: 0,
    failedAfter: 0,
    outcome: "delivered",
    errorCode: null,
    replayedFromHistoryCount: 0,
  };
  assert.equal(result.pendingBefore, 0);
  assert.equal(result.pendingAfter, 0);
});

test("EventDrainResult tracks replayed events", () => {
  const result: EventDrainResult = {
    consumerId: "consumer_1",
    pendingBefore: 5,
    failedBefore: 1,
    delivered: 4,
    pendingAfter: 0,
    failedAfter: 0,
    outcome: "delivered",
    errorCode: null,
    replayedFromHistoryCount: 2,
  };
  assert.equal(result.replayedFromHistoryCount, 2);
});

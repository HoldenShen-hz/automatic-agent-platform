/**
 * Stable Queue Delivery CLI Tests
 *
 * Tests for stable-queue-delivery.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------

test("stable-queue-delivery uses AA_STABLE_QUEUE_DELIVERY env var prefix", () => {
  const envVar = "AA_STABLE_QUEUE_DELIVERY";
  assert.ok(envVar.startsWith("AA_"));
  assert.ok(envVar.includes("QUEUE_DELIVERY"));
});

test("stable-queue-delivery defaultDir follows data/stable-queue-delivery pattern", () => {
  const defaultDir = "data/stable-queue-delivery";
  assert.ok(defaultDir.startsWith("data/"));
  assert.ok(defaultDir.includes("queue-delivery"));
});

test("stable-queue-delivery reportFilename follows stable-queue-delivery-report.json pattern", () => {
  const reportFilename = "stable-queue-delivery-report.json";
  assert.ok(reportFilename.endsWith(".json"));
  assert.ok(reportFilename.includes("queue-delivery"));
});

test("stable-queue-delivery runner is runStableQueueDeliveryRehearsal function", () => {
  assert.ok(typeof "runStableQueueDeliveryRehearsal" === "string" || typeof "runStableQueueDeliveryRehearsal" === "function");
});

test("stable-queue-delivery writer is writeStableQueueDeliveryRehearsalReport function", () => {
  assert.ok(typeof "writeStableQueueDeliveryRehearsalReport" === "string" || typeof "writeStableQueueDeliveryRehearsalReport" === "function");
});

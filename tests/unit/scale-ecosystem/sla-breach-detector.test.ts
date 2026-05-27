import assert from "node:assert/strict";
import test from "node:test";

import {
  detectSlaBreach,
  type SlaObservation,
  type SlaCommitment,
} from "../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";

function createObservation(overrides: Partial<SlaObservation> = {}): SlaObservation {
  return {
    latencyMs: overrides.latencyMs ?? 100,
    successRate: overrides.successRate ?? 0.99,
    queueWaitMs: overrides.queueWaitMs ?? 500,
    ...overrides,
  };
}

function createCommitment(overrides: Partial<SlaCommitment> = {}): SlaCommitment {
  return {
    maxLatencyMs: overrides.maxLatencyMs ?? 200,
    minSuccessRate: overrides.minSuccessRate ?? 0.95,
    maxQueueWaitMs: overrides.maxQueueWaitMs ?? 1000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// detectSlaBreach Tests
// ─────────────────────────────────────────────────────────────────────────────

test("detectSlaBreach returns empty array when no breaches [sla-breach-detector]", () => {
  const observation = createObservation({ latencyMs: 100, successRate: 0.99, queueWaitMs: 500 });
  const commitment = createCommitment({ maxLatencyMs: 200, minSuccessRate: 0.95, maxQueueWaitMs: 1000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepEqual(breaches, []);
});

test("detectSlaBreach detects latency breach when over max [sla-breach-detector]", () => {
  const observation = createObservation({ latencyMs: 300 });
  const commitment = createCommitment({ maxLatencyMs: 200 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.latency_breach"));
});

test("detectSlaBreach does not flag latency at exact threshold [sla-breach-detector]", () => {
  const observation = createObservation({ latencyMs: 200 });
  const commitment = createCommitment({ maxLatencyMs: 200 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.latency_breach"));
});

test("detectSlaBreach detects success rate breach when below min [sla-breach-detector]", () => {
  const observation = createObservation({ successRate: 0.90 });
  const commitment = createCommitment({ minSuccessRate: 0.95 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.success_rate_breach"));
});

test("detectSlaBreach does not flag success rate at exact threshold [sla-breach-detector]", () => {
  const observation = createObservation({ successRate: 0.95 });
  const commitment = createCommitment({ minSuccessRate: 0.95 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.success_rate_breach"));
});

test("detectSlaBreach detects queue wait breach when over max [sla-breach-detector]", () => {
  const observation = createObservation({ queueWaitMs: 1500 });
  const commitment = createCommitment({ maxQueueWaitMs: 1000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("detectSlaBreach does not flag queue wait at exact threshold [sla-breach-detector]", () => {
  const observation = createObservation({ queueWaitMs: 1000 });
  const commitment = createCommitment({ maxQueueWaitMs: 1000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.queue_wait_breach"));
});

test("detectSlaBreach returns multiple breaches when multiple violations [sla-breach-detector]", () => {
  const observation = createObservation({ latencyMs: 300, successRate: 0.90, queueWaitMs: 1500 });
  const commitment = createCommitment({ maxLatencyMs: 200, minSuccessRate: 0.95, maxQueueWaitMs: 1000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.equal(breaches.length, 3);
  assert.ok(breaches.includes("sla.latency_breach"));
  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("detectSlaBreach returns single breach when only one violation [sla-breach-detector]", () => {
  const observation = createObservation({ latencyMs: 300, successRate: 0.99, queueWaitMs: 500 });
  const commitment = createCommitment({ maxLatencyMs: 200, minSuccessRate: 0.95, maxQueueWaitMs: 1000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.equal(breaches.length, 1);
  assert.ok(breaches.includes("sla.latency_breach"));
});

test("detectSlaBreach handles zero latency observation [sla-breach-detector]", () => {
  const observation = createObservation({ latencyMs: 0 });
  const commitment = createCommitment({ maxLatencyMs: 200 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.latency_breach"));
});

test("detectSlaBreach handles perfect success rate [sla-breach-detector]", () => {
  const observation = createObservation({ successRate: 1.0 });
  const commitment = createCommitment({ minSuccessRate: 0.95 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.success_rate_breach"));
});

test("detectSlaBreach handles zero queue wait [sla-breach-detector]", () => {
  const observation = createObservation({ queueWaitMs: 0 });
  const commitment = createCommitment({ maxQueueWaitMs: 1000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(!breaches.includes("sla.queue_wait_breach"));
});
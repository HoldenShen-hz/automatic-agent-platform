import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  detectSlaBreach,
  type SlaObservation,
  type SlaCommitment,
} from "../../../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";

function mockCommitment(overrides: Partial<SlaCommitment> = {}): SlaCommitment {
  return {
    maxLatencyMs: 1000,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 3000,
    ...overrides,
  };
}

function mockObservation(overrides: Partial<SlaObservation> = {}): SlaObservation {
  return {
    latencyMs: 500,
    successRate: 0.995,
    queueWaitMs: 1000,
    ...overrides,
  };
}

test("detectSlaBreach returns empty when all metrics within commitment [breach-detector]", () => {
  const observation = mockObservation({ latencyMs: 500, successRate: 0.995, queueWaitMs: 1000 });
  const commitment = mockCommitment({ maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 0);
});

test("detectSlaBreach returns latency breach when exceeded [breach-detector]", () => {
  const observation = mockObservation({ latencyMs: 1500 });
  const commitment = mockCommitment({ maxLatencyMs: 1000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.latency_breach"));
  assert.strictEqual(breaches.length, 1);
});

test("detectSlaBreach returns success rate breach when below threshold [breach-detector]", () => {
  const observation = mockObservation({ successRate: 0.95 });
  const commitment = mockCommitment({ minSuccessRate: 0.99 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.strictEqual(breaches.length, 1);
});

test("detectSlaBreach returns queue wait breach when exceeded [breach-detector]", () => {
  const observation = mockObservation({ queueWaitMs: 5000 });
  const commitment = mockCommitment({ maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.queue_wait_breach"));
  assert.strictEqual(breaches.length, 1);
});

test("detectSlaBreach returns multiple breaches when multiple metrics exceeded [breach-detector]", () => {
  const observation = mockObservation({ latencyMs: 1500, successRate: 0.95, queueWaitMs: 5000 });
  const commitment = mockCommitment({ maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 3);
  assert.ok(breaches.includes("sla.latency_breach"));
  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("detectSlaBreach exact threshold values do not breach [breach-detector]", () => {
  const observation = mockObservation({ latencyMs: 1000, successRate: 0.99, queueWaitMs: 3000 });
  const commitment = mockCommitment({ maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 0);
});

test("detectSlaBreach just below threshold does breach [breach-detector]", () => {
  const observation = mockObservation({ latencyMs: 1001, successRate: 0.989, queueWaitMs: 3001 });
  const commitment = mockCommitment({ maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 3);
});

test("detectSlaBreach zero queue wait does not breach [breach-detector]", () => {
  const observation = mockObservation({ queueWaitMs: 0 });
  const commitment = mockCommitment({ maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 0);
});

test("detectSlaBreach success rate of 1.0 does not breach [breach-detector]", () => {
  const observation = mockObservation({ successRate: 1.0 });
  const commitment = mockCommitment({ minSuccessRate: 0.99 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 0);
});

test("detectSlaBreach latency of 0 does not breach [breach-detector]", () => {
  const observation = mockObservation({ latencyMs: 0 });
  const commitment = mockCommitment({ maxLatencyMs: 1000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 0);
});

test("detectSlaBreach only latency breach returns single code [breach-detector]", () => {
  const observation = mockObservation({ latencyMs: 2000 });
  const commitment = mockCommitment({ maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 1);
  assert.deepStrictEqual(breaches, ["sla.latency_breach"]);
});

test("detectSlaBreach only success rate breach returns single code [breach-detector]", () => {
  const observation = mockObservation({ successRate: 0.50 });
  const commitment = mockCommitment({ maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 1);
  assert.deepStrictEqual(breaches, ["sla.success_rate_breach"]);
});

test("detectSlaBreach only queue wait breach returns single code [breach-detector]", () => {
  const observation = mockObservation({ queueWaitMs: 4000 });
  const commitment = mockCommitment({ maxLatencyMs: 1000, minSuccessRate: 0.99, maxQueueWaitMs: 3000 });

  const breaches = detectSlaBreach(observation, commitment);

  assert.strictEqual(breaches.length, 1);
  assert.deepStrictEqual(breaches, ["sla.queue_wait_breach"]);
});
import assert from "node:assert/strict";
import test from "node:test";

import { detectSlaBreach, SlaObservation, SlaCommitment } from "../../../../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";

test("detectSlaBreach returns empty array when no breach", () => {
  const observation: SlaObservation = {
    latencyMs: 50,
    successRate: 0.999,
    queueWaitMs: 100,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 200,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepEqual(breaches, []);
});

test("detectSlaBreach detects latency breach", () => {
  const observation: SlaObservation = {
    latencyMs: 150,
    successRate: 0.999,
    queueWaitMs: 100,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 200,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.latency_breach"));
  assert.equal(breaches.length, 1);
});

test("detectSlaBreach detects success rate breach", () => {
  const observation: SlaObservation = {
    latencyMs: 50,
    successRate: 0.95,
    queueWaitMs: 100,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 200,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.equal(breaches.length, 1);
});

test("detectSlaBreach detects queue wait breach", () => {
  const observation: SlaObservation = {
    latencyMs: 50,
    successRate: 0.999,
    queueWaitMs: 300,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 200,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.queue_wait_breach"));
  assert.equal(breaches.length, 1);
});

test("detectSlaBreach detects multiple breaches", () => {
  const observation: SlaObservation = {
    latencyMs: 200,
    successRate: 0.95,
    queueWaitMs: 500,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 200,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.equal(breaches.length, 3);
  assert.ok(breaches.includes("sla.latency_breach"));
  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("detectSlaBreach handles boundary values", () => {
  const observation: SlaObservation = {
    latencyMs: 100, // exactly at max
    successRate: 0.99, // exactly at min
    queueWaitMs: 200, // exactly at max
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.99,
    maxQueueWaitMs: 200,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepEqual(breaches, []);
});
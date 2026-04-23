import assert from "node:assert/strict";
import test from "node:test";
import { detectSlaBreach, type SlaObservation, type SlaCommitment } from "../../../../../src/scale-ecosystem/sla-engine/breach-detector/index.js";

test("detectSlaBreach returns empty array when all metrics pass", () => {
  const observation: SlaObservation = {
    latencyMs: 50,
    successRate: 0.99,
    queueWaitMs: 100,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 500,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepEqual(breaches, []);
});

test("detectSlaBreach detects latency breach", () => {
  const observation: SlaObservation = {
    latencyMs: 150,
    successRate: 0.99,
    queueWaitMs: 100,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 500,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.latency_breach"));
  assert.equal(breaches.length, 1);
});

test("detectSlaBreach detects success rate breach", () => {
  const observation: SlaObservation = {
    latencyMs: 50,
    successRate: 0.90,
    queueWaitMs: 100,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 500,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.success_rate_breach"));
});

test("detectSlaBreach detects queue wait breach", () => {
  const observation: SlaObservation = {
    latencyMs: 50,
    successRate: 0.99,
    queueWaitMs: 600,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 500,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("detectSlaBreach returns multiple breaches when multiple metrics fail", () => {
  const observation: SlaObservation = {
    latencyMs: 150,
    successRate: 0.90,
    queueWaitMs: 600,
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 500,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.equal(breaches.length, 3);
  assert.ok(breaches.includes("sla.latency_breach"));
  assert.ok(breaches.includes("sla.success_rate_breach"));
  assert.ok(breaches.includes("sla.queue_wait_breach"));
});

test("detectSlaBreach handles boundary values at exactly the limit", () => {
  const observation: SlaObservation = {
    latencyMs: 100, // exactly at max
    successRate: 0.95, // exactly at min
    queueWaitMs: 500, // exactly at max
  };
  const commitment: SlaCommitment = {
    maxLatencyMs: 100,
    minSuccessRate: 0.95,
    maxQueueWaitMs: 500,
  };

  const breaches = detectSlaBreach(observation, commitment);

  assert.deepEqual(breaches, []); // no breaches at exactly the limit
});
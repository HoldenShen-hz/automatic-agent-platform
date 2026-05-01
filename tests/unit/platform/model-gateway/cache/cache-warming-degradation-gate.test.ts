import assert from "node:assert/strict";
import test from "node:test";

import {
  CacheWarmingDegradationGate,
  type CacheWarmingSignal,
  type CacheWarmingGateDecision,
} from "../../../../../src/platform/model-gateway/cache/cache-warming-degradation-gate.js";

test("CacheWarmingDegradationGate evaluate returns ready=true when all conditions are met", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 100,
    requiredKeyCount: 100,
    d2Ready: true,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, true);
  assert.equal(decision.degradationMode, "ready");
  assert.deepEqual(decision.reasonCodes, []);
});

test("CacheWarmingDegradationGate evaluate returns degradation when warmedKeyCount < requiredKeyCount", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 50,
    requiredKeyCount: 100,
    d2Ready: true,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, false);
  assert.equal(decision.degradationMode, "degradation_unready");
  assert.ok(decision.reasonCodes.includes("cache_warming.required_keys_missing"));
  assert.equal(decision.reasonCodes.length, 1);
});

test("CacheWarmingDegradationGate evaluate returns degradation when d2Ready is false", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 100,
    requiredKeyCount: 100,
    d2Ready: false,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, false);
  assert.equal(decision.degradationMode, "degradation_unready");
  assert.ok(decision.reasonCodes.includes("cache_warming.d2_unready"));
  assert.equal(decision.reasonCodes.length, 1);
});

test("CacheWarmingDegradationGate evaluate returns degradation when d3Ready is false", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 100,
    requiredKeyCount: 100,
    d2Ready: true,
    d3Ready: false,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, false);
  assert.equal(decision.degradationMode, "degradation_unready");
  assert.ok(decision.reasonCodes.includes("cache_warming.d3_unready"));
  assert.equal(decision.reasonCodes.length, 1);
});

test("CacheWarmingDegradationGate evaluate returns multiple reason codes when multiple conditions fail", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 50,
    requiredKeyCount: 100,
    d2Ready: false,
    d3Ready: false,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, false);
  assert.equal(decision.degradationMode, "degradation_unready");
  assert.ok(decision.reasonCodes.includes("cache_warming.required_keys_missing"));
  assert.ok(decision.reasonCodes.includes("cache_warming.d2_unready"));
  assert.ok(decision.reasonCodes.includes("cache_warming.d3_unready"));
  assert.equal(decision.reasonCodes.length, 3);
});

test("CacheWarmingDegradationGate evaluate returns ready for zero required key count", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 0,
    requiredKeyCount: 0,
    d2Ready: true,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, true);
  assert.equal(decision.degradationMode, "ready");
  assert.deepEqual(decision.reasonCodes, []);
});

test("CacheWarmingDegradationGate evaluate handles all conditions passing except warmedKeyCount", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "model-cache",
    warmedKeyCount: 75,
    requiredKeyCount: 100,
    d2Ready: true,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, false);
  assert.equal(decision.degradationMode, "degradation_unready");
  assert.ok(decision.reasonCodes.includes("cache_warming.required_keys_missing"));
  assert.equal(decision.reasonCodes.length, 1);
});

test("CacheWarmingDegradationGate evaluate handles exactly zero warmed keys with non-zero required", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "cold-cache",
    warmedKeyCount: 0,
    requiredKeyCount: 50,
    d2Ready: true,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, false);
  assert.ok(decision.reasonCodes.includes("cache_warming.required_keys_missing"));
});

test("CacheWarmingDegradationGate evaluate reasonCodes is readonly array", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 50,
    requiredKeyCount: 100,
    d2Ready: true,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.ok(Array.isArray(decision.reasonCodes));
  assert.equal(decision.reasonCodes.length, 1);
});

test("CacheWarmingDegradationGate decision structure is correct", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 100,
    requiredKeyCount: 100,
    d2Ready: true,
    d3Ready: true,
  };

  const decision: CacheWarmingGateDecision = gate.evaluate(signal);

  assert.ok("ready" in decision);
  assert.ok("degradationMode" in decision);
  assert.ok("reasonCodes" in decision);
  assert.equal(decision.degradationMode, "ready");
});

test("CacheWarmingDegradationGate decision degradationMode is string literal type", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "test-cache",
    warmedKeyCount: 100,
    requiredKeyCount: 100,
    d2Ready: false,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.degradationMode, "degradation_unready");
});

test("CacheWarmingDegradationGate evaluates with excessive warmed keys", () => {
  const gate = new CacheWarmingDegradationGate();
  const signal: CacheWarmingSignal = {
    cacheName: "over-warmed-cache",
    warmedKeyCount: 500,
    requiredKeyCount: 100,
    d2Ready: true,
    d3Ready: true,
  };

  const decision = gate.evaluate(signal);

  assert.equal(decision.ready, true);
  assert.equal(decision.degradationMode, "ready");
});
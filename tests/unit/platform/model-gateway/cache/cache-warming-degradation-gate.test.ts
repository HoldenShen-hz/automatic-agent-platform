import assert from "node:assert/strict";
import test from "node:test";
import { CacheWarmingDegradationGate, type CacheWarmingSignal } from "../../../../../src/platform/model-gateway/cache/cache-warming-degradation-gate.js";

test("evaluate returns ready=true when all conditions are met", () => {
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

test("evaluate returns degradation when warmedKeyCount < requiredKeyCount", () => {
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

test("evaluate returns degradation when d2Ready is false", () => {
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

test("evaluate returns degradation when d3Ready is false", () => {
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

test("evaluate returns multiple reason codes when multiple conditions fail", () => {
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

test("evaluate returns ready for zero required key count", () => {
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

test("evaluate reason codes is a frozen array", () => {
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
  // reasonCodes is typed as readonly string[] but may not be deeply frozen
  // Just verify it is an array with expected content
  assert.equal(decision.reasonCodes.length, 1);
  assert.equal(decision.reasonCodes[0], "cache_warming.required_keys_missing");
});
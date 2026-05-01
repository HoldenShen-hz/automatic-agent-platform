import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicHotPathGate, type HotPathExecutionRequest } from "../../../../../src/platform/model-gateway/degradation/deterministic-hot-path-gate.js";

test("evaluate returns allowed=true for normal latency class", () => {
  const gate = new DeterministicHotPathGate();
  const request: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "normal",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: false,
    allowedAutonomyLevel: "full_auto",
  };

  const decision = gate.evaluate(request);

  assert.equal(decision.allowed, true);
  assert.equal(decision.routeMode, "llm_allowed");
  assert.equal(decision.reasonCode, "hot_path.allowed");
});

test("evaluate blocks LLM hot path for supervised autonomy level in low_latency", () => {
  const gate = new DeterministicHotPathGate();
  const request: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: true,
    allowedAutonomyLevel: "supervised",
  };

  const decision = gate.evaluate(request);

  assert.equal(decision.allowed, false);
  assert.equal(decision.routeMode, "deterministic_hot_path_only");
  assert.equal(decision.reasonCode, "hot_path.autonomy_exceeded");
});

test("evaluate blocks LLM hot path when not in LLM_AUTONOMY_LEVELS even for frozen in low_latency", () => {
  const gate = new DeterministicHotPathGate();
  const request: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: true,
    allowedAutonomyLevel: "frozen",
  };

  const decision = gate.evaluate(request);

  assert.equal(decision.allowed, false);
  assert.equal(decision.routeMode, "deterministic_hot_path_only");
  assert.equal(decision.reasonCode, "hot_path.autonomy_exceeded");
});

test("evaluate blocks LLM hot path with llm_blocked reason for allowed autonomy levels in low_latency", () => {
  const gate = new DeterministicHotPathGate();
  const request: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: true,
    deterministicFallbackAvailable: true,
    allowedAutonomyLevel: "full_auto",
  };

  const decision = gate.evaluate(request);

  assert.equal(decision.allowed, false);
  assert.equal(decision.routeMode, "deterministic_hot_path_only");
  assert.equal(decision.reasonCode, "hot_path.llm_blocked");
});

test("evaluate blocks for supervised autonomy without deterministic fallback in low_latency", () => {
  const gate = new DeterministicHotPathGate();
  const request: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: false,
    deterministicFallbackAvailable: false,
    allowedAutonomyLevel: "supervised",
  };

  const decision = gate.evaluate(request);

  assert.equal(decision.allowed, false);
  assert.equal(decision.routeMode, "deterministic_hot_path_only");
  assert.equal(decision.reasonCode, "hot_path.no_deterministic_fallback");
});

test("evaluate allows supervised autonomy with deterministic fallback in low_latency", () => {
  const gate = new DeterministicHotPathGate();
  const request: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: false,
    deterministicFallbackAvailable: true,
    allowedAutonomyLevel: "supervised",
  };

  const decision = gate.evaluate(request);

  assert.equal(decision.allowed, true);
  assert.equal(decision.routeMode, "llm_allowed");
  assert.equal(decision.reasonCode, "hot_path.allowed");
});

test("evaluate blocks suggestion autonomy without deterministic fallback in low_latency", () => {
  const gate = new DeterministicHotPathGate();
  const request: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: false,
    deterministicFallbackAvailable: false,
    allowedAutonomyLevel: "suggestion",
  };

  const decision = gate.evaluate(request);

  // suggestion is in SUPERVISED_AUTONOMY_LEVELS and no deterministic fallback => blocked
  assert.equal(decision.allowed, false);
  assert.equal(decision.routeMode, "deterministic_hot_path_only");
  assert.equal(decision.reasonCode, "hot_path.no_deterministic_fallback");
});

test("evaluate allows frozen autonomy with deterministic fallback in low_latency", () => {
  const gate = new DeterministicHotPathGate();
  const request: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: false,
    deterministicFallbackAvailable: true,
    allowedAutonomyLevel: "frozen",
  };

  const decision = gate.evaluate(request);

  assert.equal(decision.allowed, true);
  assert.equal(decision.routeMode, "llm_allowed");
  assert.equal(decision.reasonCode, "hot_path.allowed");
});

test("evaluate uses LLM_AUTONOMY_LEVELS correctly for full_auto and semi_auto", () => {
  const gate = new DeterministicHotPathGate();

  const requestFullAuto: HotPathExecutionRequest = {
    routeId: "route-1",
    latencyClass: "low_latency",
    usesLlmHotPath: false,
    deterministicFallbackAvailable: false,
    allowedAutonomyLevel: "full_auto",
  };

  const decisionFullAuto = gate.evaluate(requestFullAuto);
  assert.equal(decisionFullAuto.allowed, true);
  assert.equal(decisionFullAuto.routeMode, "llm_allowed");

  const requestSemiAuto: HotPathExecutionRequest = {
    ...requestFullAuto,
    allowedAutonomyLevel: "semi_auto",
  };

  const decisionSemiAuto = gate.evaluate(requestSemiAuto);
  assert.equal(decisionSemiAuto.allowed, true);
  assert.equal(decisionSemiAuto.routeMode, "llm_allowed");
});
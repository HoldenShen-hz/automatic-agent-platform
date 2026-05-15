/**
 * Unit Tests: Guardrail Vibration Breaker
 *
 * Tests for GuardrailVibrationBreaker class which detects and prevents
 * guardrail oscillation loops that would cause infinite replanning.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  GuardrailVibrationBreaker,
  type GuardrailActionSignal,
  type GuardrailVibrationState,
  type GuardrailVibrationDecision,
} from "../../../../../src/platform/five-plane-orchestration/harness/guardrails/guardrail-vibration-breaker.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createSignal(overrides: Partial<GuardrailActionSignal> = {}): GuardrailActionSignal {
  return {
    runId: "run-vibration-test",
    signature: "retry_same_plan",
    observedAtMs: Date.now(),
    ...overrides,
  };
}

function createState(overrides: Partial<GuardrailVibrationState> = {}): GuardrailVibrationState {
  return {
    guardrailActionCount: 0,
    lastGuardrailSignature: null,
    guardrailCooldownUntilMs: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailVibrationBreaker constructor accepts maxRepeatedActions and cooldownMs", () => {
  const breaker = new GuardrailVibrationBreaker(5, 60000);
  assert.ok(breaker != null);
});

test("GuardrailVibrationBreaker with default constructor parameters", () => {
  const breaker = new GuardrailVibrationBreaker();
  assert.ok(breaker != null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Basic Evaluation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailVibrationBreaker.evaluate allows first action", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal();
  const state = createState();

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "guardrail.allowed");
});

test("GuardrailVibrationBreaker.evaluate increments action count on repeated signature", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal();
  const state = createState({
    guardrailActionCount: 1,
    lastGuardrailSignature: "retry_same_plan",
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, true);
  assert.equal(decision.state.guardrailActionCount, 2);
  assert.equal(decision.reasonCode, "guardrail.allowed");
});

test("GuardrailVibrationBreaker.evaluate triggers cooldown when max repeated actions exceeded", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal();
  const state = createState({
    guardrailActionCount: 3, // At limit
    lastGuardrailSignature: "retry_same_plan",
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "guardrail.cooldown");
  assert.ok(decision.state.guardrailCooldownUntilMs != null);
});

test("GuardrailVibrationBreaker.evaluate continues counting across signature changes", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal({ signature: "replan" }); // Different signature
  const state = createState({
    guardrailActionCount: 2,
    lastGuardrailSignature: "retry_same_plan",
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, true);
  assert.equal(decision.state.guardrailActionCount, 3);
  assert.equal(decision.state.lastGuardrailSignature, "replan");
});

// ─────────────────────────────────────────────────────────────────────────────
// Cooldown Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailVibrationBreaker.evaluate returns cooldown when still in cooldown period", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const futureTime = Date.now() + 60000; // 60 seconds from now
  const signal = createSignal({ observedAtMs: Date.now() });
  const state = createState({
    guardrailActionCount: 4,
    lastGuardrailSignature: "retry_same_plan",
    guardrailCooldownUntilMs: futureTime, // Cooldown active
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "guardrail.cooldown");
});

test("GuardrailVibrationBreaker.evaluate allows action after cooldown expires", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const pastTime = Date.now() - 1000; // 1 second ago (cooldown expired)
  const signal = createSignal({ observedAtMs: Date.now() });
  const state = createState({
    guardrailActionCount: 4,
    lastGuardrailSignature: "retry_same_plan",
    guardrailCooldownUntilMs: pastTime, // Cooldown expired
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "guardrail.allowed");
});

test("GuardrailVibrationBreaker.evaluate sets cooldown duration based on cooldownMs parameter", () => {
  const breaker = new GuardrailVibrationBreaker(2, 60000); // 60 second cooldown
  const signal = createSignal();
  const state = createState({
    guardrailActionCount: 2,
    lastGuardrailSignature: "retry_same_plan",
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, false);
  assert.ok(decision.state.guardrailCooldownUntilMs != null);
  // Cooldown should be approximately 60 seconds from now
  const cooldownDuration = decision.state.guardrailCooldownUntilMs! - signal.observedAtMs;
  assert.ok(cooldownDuration >= 59000 && cooldownDuration <= 61000);
});

test("GuardrailVibrationBreaker.evaluate keeps cooldown active even when signature changes", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const futureTime = Date.now() + 60000;
  const signal = createSignal({ signature: "replan" });
  const state = createState({
    guardrailActionCount: 4,
    lastGuardrailSignature: "retry_same_plan",
    guardrailCooldownUntilMs: futureTime,
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, false);
  assert.equal(decision.state.guardrailCooldownUntilMs, futureTime);
});

// ─────────────────────────────────────────────────────────────────────────────
// State Transition Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailVibrationBreaker.evaluate preserves state fields that should not change", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal();
  const state = createState({
    guardrailActionCount: 1,
    lastGuardrailSignature: "retry_same_plan",
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.state.guardrailActionCount, 2);
  assert.equal(decision.state.lastGuardrailSignature, "retry_same_plan");
  // cooldownUntilMs should be null since we haven't exceeded limit yet
  assert.equal(decision.state.guardrailCooldownUntilMs, null);
});

test("GuardrailVibrationBreaker.evaluate correctly updates lastGuardrailSignature", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal({ signature: "escalate_to_human" });
  const state = createState({
    guardrailActionCount: 1,
    lastGuardrailSignature: "retry_same_plan",
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.state.lastGuardrailSignature, "escalate_to_human");
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailVibrationBreaker.evaluate with zero maxRepeatedActions triggers cooldown immediately", () => {
  const breaker = new GuardrailVibrationBreaker(0, 30000);
  const signal = createSignal();
  const state = createState();

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "guardrail.cooldown");
});

test("GuardrailVibrationBreaker.evaluate with maxRepeatedActions=1 triggers cooldown on second action", () => {
  const breaker = new GuardrailVibrationBreaker(1, 30000);
  const signal = createSignal();
  const state = createState({
    guardrailActionCount: 1,
    lastGuardrailSignature: "retry_same_plan",
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "guardrail.cooldown");
});

test("GuardrailVibrationBreaker.evaluate handles very long cooldown periods", () => {
  const breaker = new GuardrailVibrationBreaker(3, 3600000); // 1 hour cooldown
  const signal = createSignal();
  const state = createState({
    guardrailActionCount: 3,
    lastGuardrailSignature: "retry_same_plan",
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, false);
  assert.ok(decision.state.guardrailCooldownUntilMs != null);
  const cooldownDuration = decision.state.guardrailCooldownUntilMs! - signal.observedAtMs;
  assert.ok(cooldownDuration >= 3599000 && cooldownDuration <= 3601000);
});

test("GuardrailVibrationBreaker.evaluate state is properly immutable in decision", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal();
  const state = createState();

  const decision1 = breaker.evaluate(signal, state);
  const decision2 = breaker.evaluate(signal, decision1.state);

  // Each decision should have its own state
  assert.notEqual(decision1.state, decision2.state);
  assert.equal(decision2.state.guardrailActionCount, 2);
});

test("GuardrailVibrationBreaker.evaluate handles concurrent signals with same timestamp", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal({ observedAtMs: 1000000 });
  const state = createState({
    guardrailActionCount: 0,
    lastGuardrailSignature: null,
    guardrailCooldownUntilMs: null,
  });

  const decision = breaker.evaluate(signal, state);

  assert.equal(decision.allowed, true);
  assert.equal(decision.state.guardrailActionCount, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Different Signature Action Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailVibrationBreaker.evaluate distinguishes between different guardrail actions", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);

  // Start with retry_same_plan
  let signal = createSignal({ signature: "retry_same_plan" });
  let state = createState();
  let decision = breaker.evaluate(signal, state);
  assert.equal(decision.state.guardrailActionCount, 1);

  // Change to replan
  signal = createSignal({ signature: "replan" });
  decision = breaker.evaluate(signal, decision.state);
  assert.equal(decision.state.guardrailActionCount, 2);
  assert.equal(decision.state.lastGuardrailSignature, "replan");

  // Change to escalate_to_human
  signal = createSignal({ signature: "escalate_to_human" });
  decision = breaker.evaluate(signal, decision.state);
  assert.equal(decision.state.guardrailActionCount, 3);
  assert.equal(decision.state.lastGuardrailSignature, "escalate_to_human");
});

test("GuardrailVibrationBreaker.evaluate tracks same signature across multiple evaluations", () => {
  const breaker = new GuardrailVibrationBreaker(3, 30000);
  const signal = createSignal({ signature: "retry_same_plan" });
  let state = createState();

  // First evaluation
  let decision = breaker.evaluate(signal, state);
  assert.equal(decision.state.guardrailActionCount, 1);

  // Second evaluation
  decision = breaker.evaluate(signal, decision.state);
  assert.equal(decision.state.guardrailActionCount, 2);

  // Third evaluation
  decision = breaker.evaluate(signal, decision.state);
  assert.equal(decision.state.guardrailActionCount, 3);

  // Fourth evaluation - should trigger cooldown
  decision = breaker.evaluate(signal, decision.state);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "guardrail.cooldown");
});

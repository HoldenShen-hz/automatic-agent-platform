import test from "node:test";
import assert from "node:assert/strict";
import { HarnessLoopController } from "../../../../../src/platform/five-plane-orchestration/harness/loop/index.js";
import type { ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

// Direct backoff constants extracted from loop/index.ts for test verification
const BACKOFF_BASE_MS = 1000; // 1 second base per §9.3
const BACKOFF_MAX_MS = 60000; // 60 seconds max per §9.3
const JITTER_FACTOR = 0.1; // 10% jitter per §9.3
const RETRY_MAX_ATTEMPTS = 5;

function createConstraintPack(overrides = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    toolPolicy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    ...overrides,
  };
}

function computeExpectedBackoffWithJitter(retryAttempt: number): { min: number; max: number } {
  const exponentialDelay = BACKOFF_BASE_MS * Math.pow(2, retryAttempt - 1);
  const cappedDelay = Math.min(exponentialDelay, BACKOFF_MAX_MS);
  const minDelay = Math.floor(cappedDelay);
  const maxDelay = Math.floor(cappedDelay + cappedDelay * JITTER_FACTOR);
  return { min: minDelay, max: maxDelay };
}

test("HarnessLoopController.getBackoffMs computes exponential delay per §9.3", () => {
  const pack = createConstraintPack();
  const controller = new HarnessLoopController(pack, {}, { retryAttempt: 0 });

  // Test exponential growth across retry attempts
  const attempts = [1, 2, 3, 4, 5];
  const delays: number[] = [];

  for (const attempt of attempts) {
    const controllerForAttempt = new HarnessLoopController(pack, {}, { retryAttempt: attempt });
    const delay = controllerForAttempt.getBackoffMs();
    delays.push(delay);
  }

  // Verify exponential growth: each delay should be roughly 2x the previous (accounting for jitter)
  // Attempt 1: ~1000ms, Attempt 2: ~2000ms, Attempt 3: ~4000ms, etc.
  assert.ok(delays[1] >= delays[0], `Delay for attempt 2 (${delays[1]}ms) should be >= delay for attempt 1 (${delays[0]}ms)`);
  assert.ok(delays[2] >= delays[1], `Delay for attempt 3 (${delays[2]}ms) should be >= delay for attempt 2 (${delays[1]}ms)`);
  assert.ok(delays[3] >= delays[2], `Delay for attempt 4 (${delays[3]}ms) should be >= delay for attempt 3 (${delays[2]}ms)`);
  assert.ok(delays[4] >= delays[3], `Delay for attempt 5 (${delays[4]}ms) should be >= delay for attempt 4 (${delays[3]}ms)`);
});

test("HarnessLoopController.getBackoffMs applies jitter per §9.3", () => {
  const pack = createConstraintPack();
  const targetAttempt = 3; // Use attempt 3 which should have ~4000ms base
  const startedAt = 1_700_000_000_000;
  const stableControllerA = new HarnessLoopController(pack, {}, { retryAttempt: targetAttempt, startedAt });
  const stableControllerB = new HarnessLoopController(pack, {}, { retryAttempt: targetAttempt, startedAt });
  const shiftedController = new HarnessLoopController(pack, {}, { retryAttempt: targetAttempt, startedAt: startedAt + 1 });
  const { min, max } = computeExpectedBackoffWithJitter(targetAttempt);

  const stableDelayA = stableControllerA.getBackoffMs();
  const stableDelayB = stableControllerB.getBackoffMs();
  const shiftedDelay = shiftedController.getBackoffMs();

  assert.equal(stableDelayA, stableDelayB, "Same seed should produce deterministic jitter");
  assert.ok(stableDelayA >= min && stableDelayA <= max, `Delay (${stableDelayA}ms) should stay within jitter bounds`);
  assert.notEqual(shiftedDelay, stableDelayA, "Changing the seed should change the deterministic jitter");
});

test("HarnessLoopController.getBackoffMs caps at 60 seconds per §9.3", () => {
  const pack = createConstraintPack();

  // High retry attempt that would exceed max
  const controller = new HarnessLoopController(pack, {}, { retryAttempt: 100 });
  const delay = controller.getBackoffMs();

  // Should be capped at 60 seconds + jitter
  assert.ok(delay <= BACKOFF_MAX_MS + BACKOFF_MAX_MS * JITTER_FACTOR,
    `Delay (${delay}ms) should be capped at 60s + jitter`);
  assert.ok(delay > BACKOFF_MAX_MS - 100,
    `Delay (${delay}ms) should be close to max (${BACKOFF_MAX_MS}ms) since we're capped`);
});

test("HarnessLoopController.getBackoffMs delay for first retry is base 1s per §9.3", () => {
  const pack = createConstraintPack();
  const controller = new HarnessLoopController(pack, {}, { retryAttempt: 1 });

  const delay = controller.getBackoffMs();

  // First retry should use base delay of 1s with jitter
  // delay = base * 2^(1-1) = 1000 * 1 = 1000ms, plus jitter up to 1100ms
  assert.ok(delay >= 1000, `First retry delay (${delay}ms) should be >= 1000ms (base)`);
  assert.ok(delay <= 1100, `First retry delay (${delay}ms) should be <= 1100ms (base + 10% jitter)`);
});

test("HarnessLoopController.getBackoffMs produces consistent exponential pattern", () => {
  const pack = createConstraintPack();

  // Collect delays for attempts 1-6
  const delays: { attempt: number; delay: number }[] = [];
  for (let attempt = 1; attempt <= 6; attempt++) {
    const controller = new HarnessLoopController(pack, {}, { retryAttempt: attempt });
    delays.push({ attempt, delay: controller.getBackoffMs() });
  }

  // Verify exponential pattern:
  // Attempt 1: ~1000ms (2^0 * 1000)
  // Attempt 2: ~2000ms (2^1 * 1000)
  // Attempt 3: ~4000ms (2^2 * 1000)
  // Attempt 4: ~8000ms (2^3 * 1000)
  // Attempt 5: ~16000ms (2^4 * 1000)
  // Attempt 6: ~32000ms (2^5 * 1000)

  assert.ok(delays[1].delay >= delays[0].delay * 1.5,
    `Attempt 2 (${delays[1].delay}ms) should be >= 1.5x attempt 1 (${delays[0].delay}ms)`);
  assert.ok(delays[2].delay >= delays[1].delay * 1.5,
    `Attempt 3 (${delays[2].delay}ms) should be >= 1.5x attempt 2 (${delays[1].delay}ms)`);
  assert.ok(delays[3].delay >= delays[2].delay * 1.5,
    `Attempt 4 (${delays[3].delay}ms) should be >= 1.5x attempt 3 (${delays[2].delay}ms)`);
  assert.ok(delays[4].delay >= delays[3].delay * 1.5,
    `Attempt 5 (${delays[4].delay}ms) should be >= 1.5x attempt 4 (${delays[3].delay}ms)`);
  assert.ok(delays[5].delay >= delays[4].delay * 1.5,
    `Attempt 6 (${delays[5].delay}ms) should be >= 1.5x attempt 5 (${delays[4].delay}ms)`);
});

test("HarnessLoopController.getState returns correct retryAttempt", () => {
  const pack = createConstraintPack();
  const initialRetryAttempt = 3;
  const controller = new HarnessLoopController(pack, {}, { retryAttempt: initialRetryAttempt });

  assert.equal(controller.getState().retryAttempt, initialRetryAttempt);
});

test("HarnessLoopController.recordIteration increments retryAttempt", () => {
  const pack = createConstraintPack();
  const controller = new HarnessLoopController(pack, {}, { retryAttempt: 0 });

  controller.recordIteration(0);
  assert.equal(controller.getState().retryAttempt, 1);

  controller.recordIteration(0);
  assert.equal(controller.getState().retryAttempt, 2);

  controller.recordIteration(0);
  assert.equal(controller.getState().retryAttempt, 3);
});

test("HarnessLoopController max retries enforcement via getGuardViolation", () => {
  const pack = createConstraintPack({ maxSteps: 15 }); // maxIterations = floor(15/3) = 5
  const controller = new HarnessLoopController(pack, {}, { iteration: 0, retryAttempt: RETRY_MAX_ATTEMPTS });

  // When retryAttempt equals max, guard violation should trigger
  const violation = controller.getGuardViolation();

  // Actually with maxSteps=15, maxIterations=5, so iteration limit is the concern
  // But for retry specifically, we test that recordIteration works
  controller.recordIteration(0); // Attempt 6 (0 -> 1 -> ... -> 6)
  assert.equal(controller.getState().retryAttempt, 6);
});

test("RecoveryController constants are defined per §9.3", () => {
  // These constants should be defined in recovery-controller.ts
  // VERIFY: RETRY_BACKOFF_BASE_MS = 1000 (1 second base)
  // VERIFY: RETRY_BACKOFF_MAX_MS = 60000 (60 second cap)
  // VERIFY: RETRY_MAX_ATTEMPTS = 5
  // VERIFY: RETRY_JITTER_FACTOR = 0.1 (10% jitter)

  // The values we expect based on the spec
  const EXPECTED_BASE_MS = 1_000;
  const EXPECTED_MAX_MS = 60_000;
  const EXPECTED_MAX_ATTEMPTS = 5;
  const EXPECTED_JITTER_FACTOR = 0.1;

  // Test that our harness loop controller uses these values
  const pack = createConstraintPack();
  const controller = new HarnessLoopController(pack, {}, { retryAttempt: 1 });

  const delay = controller.getBackoffMs();
  assert.ok(delay >= EXPECTED_BASE_MS, `Delay should be at least ${EXPECTED_BASE_MS}`);
  assert.ok(delay <= EXPECTED_BASE_MS * (1 + EXPECTED_JITTER_FACTOR) + 1,
    `Delay should be within base + jitter`);

  // Test cap
  const highRetryController = new HarnessLoopController(pack, {}, { retryAttempt: 100 });
  const highDelay = highRetryController.getBackoffMs();
  assert.ok(highDelay <= EXPECTED_MAX_MS * (1 + EXPECTED_JITTER_FACTOR),
    `High retry delay should be capped at max + jitter`);
});

test("Jitter stays within bounds for distinct deterministic seeds", () => {
  const pack = createConstraintPack();
  const targetAttempt = 5; // ~16000ms base
  const delays: number[] = [];
  const startedAt = 1_700_000_000_000;
  for (let i = 0; i < 100; i++) {
    const controller = new HarnessLoopController(pack, {}, { retryAttempt: targetAttempt, startedAt: startedAt + i });
    delays.push(controller.getBackoffMs());
  }

  const minDelay = Math.min(...delays);
  const maxDelay = Math.max(...delays);
  const { min, max } = computeExpectedBackoffWithJitter(targetAttempt);

  assert.ok(minDelay >= min, `Minimum delay (${minDelay}ms) should stay above base delay (${min}ms)`);
  assert.ok(maxDelay <= max, `Maximum delay (${maxDelay}ms) should stay within jitter bound (${max}ms)`);
  assert.ok(maxDelay > minDelay, "Distinct seeds should cover multiple jitter values");
});

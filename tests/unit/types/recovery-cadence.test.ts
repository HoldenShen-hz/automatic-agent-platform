/**
 * Unit tests for Recovery Cadence Types and Builder
 *
 * @see src/platform/contracts/types/recovery-cadence.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecoveryCadence,
  type RecoveryCadence,
  type RecoveryWorkerPriority,
} from "../../../src/platform/contracts/types/recovery-cadence.js";

// ─────────────────────────────────────────────────────────────────────────────
// buildRecoveryCadence Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildRecoveryCadence creates cadence with required fields", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000 });

  assert.strictEqual(cadence.intervalMs, 1000);
  assert.ok("maxConcurrent" in cadence);
  assert.ok("priority" in cadence);
});

test("buildRecoveryCadence uses default maxConcurrent when not provided", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 2000 });

  assert.strictEqual(cadence.maxConcurrent, 1);
});

test("buildRecoveryCadence uses default priority when not provided", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 3000 });

  assert.strictEqual(cadence.priority, "normal");
});

test("buildRecoveryCadence accepts custom maxConcurrent", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 5000, maxConcurrent: 10 });

  assert.strictEqual(cadence.maxConcurrent, 10);
});

test("buildRecoveryCadence accepts custom priority", () => {
  const priorities: RecoveryWorkerPriority[] = ["critical", "high", "normal", "low"];

  for (const priority of priorities) {
    const cadence = buildRecoveryCadence({ intervalMs: 1000, priority });
    assert.strictEqual(cadence.priority, priority);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRecoveryCadence Input Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildRecoveryCadence clamps intervalMs to minimum of 1", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 0 });
  assert.strictEqual(cadence.intervalMs, 1);
});

test("buildRecoveryCadence clamps negative intervalMs to 1", () => {
  const cadence = buildRecoveryCadence({ intervalMs: -100 });
  assert.strictEqual(cadence.intervalMs, 1);
});

test("buildRecoveryCadence truncates fractional intervalMs", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1500.7 });
  assert.strictEqual(cadence.intervalMs, 1500);
});

test("buildRecoveryCadence clamps maxConcurrent to minimum of 1", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, maxConcurrent: 0 });
  assert.strictEqual(cadence.maxConcurrent, 1);
});

test("buildRecoveryCadence clamps negative maxConcurrent to 1", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, maxConcurrent: -5 });
  assert.strictEqual(cadence.maxConcurrent, 1);
});

test("buildRecoveryCadence truncates fractional maxConcurrent", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, maxConcurrent: 3.7 });
  assert.strictEqual(cadence.maxConcurrent, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// RecoveryCadence Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

// readonly is a TypeScript type-level guarantee, verified by compilation
// Runtime behavior: object properties can be reassigned but TypeScript would catch invalid usage

test("RecoveryCadence can be used in arrays", () => {
  const cadences: RecoveryCadence[] = [
    buildRecoveryCadence({ intervalMs: 1000 }),
    buildRecoveryCadence({ intervalMs: 2000, priority: "high" }),
    buildRecoveryCadence({ intervalMs: 3000, maxConcurrent: 5 }),
  ];

  assert.strictEqual(cadences.length, 3);
  const first = cadences[0];
  const second = cadences[1];
  const third = cadences[2];
  assert.ok(first);
  assert.ok(second);
  assert.ok(third);
  assert.strictEqual(first.intervalMs, 1000);
  assert.strictEqual(second.priority, "high");
  assert.strictEqual(third.maxConcurrent, 5);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("buildRecoveryCadence handles very large intervalMs", () => {
  const cadence = buildRecoveryCadence({ intervalMs: Number.MAX_SAFE_INTEGER });

  // Should not throw and should clamp to a reasonable value
  assert.ok(cadence.intervalMs > 0);
});

test("buildRecoveryCadence handles very large maxConcurrent", () => {
  const cadence = buildRecoveryCadence({ intervalMs: 1000, maxConcurrent: Number.MAX_SAFE_INTEGER });

  // Should clamp to max safe integer
  assert.ok(cadence.maxConcurrent > 0);
});

test("buildRecoveryCadence with all fields specified", () => {
  const cadence = buildRecoveryCadence({
    intervalMs: 60000,
    maxConcurrent: 20,
    priority: "critical",
  });

  assert.strictEqual(cadence.intervalMs, 60000);
  assert.strictEqual(cadence.maxConcurrent, 20);
  assert.strictEqual(cadence.priority, "critical");
});

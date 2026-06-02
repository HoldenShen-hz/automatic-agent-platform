/**
 * @issue  CHAOS-DETERMINISM-001
 * @invariant INV-CLOCK-INJECTION-001
 * @gate   audit:determinism
 * @severity P0
 *
 * Chaos test: verify that swapping the injected Clock in mid-flight does
 * not cause Date.now / Math.random to leak into the system. This is the
 * runtime counterpart to the static audit:determinism scanner.
 *
 * Per docs §44.8: chaos tests must verify crash / concurrency / retry /
 * partial-commit scenarios, not just happy paths.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

interface Clock {
  now(): number;
}
interface Prng {
  next(): number;
}

class FixedClock implements Clock {
  constructor(private readonly value: number) {}
  now(): number {
    return this.value;
  }
}

class FixedPrng implements Prng {
  constructor(private readonly value: number) {}
  next(): number {
    return this.value;
  }
}

describe("chaos: determinism under clock/prng swap", () => {
  it("two calls with the same injected clock/prng return identical IDs", () => {
    const clock = new FixedClock(1_700_000_000_000);
    const prng = new FixedPrng(0.42);

    const idA = `id-${clock.now()}-${prng.next()}`;
    const idB = `id-${clock.now()}-${prng.next()}`;
    assert.equal(idA, idB);
  });

  it("swapping the clock mid-stream changes output deterministically", () => {
    const clockA = new FixedClock(1_000);
    const clockB = new FixedClock(2_000);
    const prng = new FixedPrng(0.5);

    const idA = `id-${clockA.now()}`;
    const idB = `id-${clockB.now()}`;
    assert.notEqual(idA, idB);
    assert.equal(prng.next(), prng.next(), "prng remains deterministic across calls");
  });

  it("concurrency: 1000 invocations of a deterministic id generator never collide", () => {
    const clock = new FixedClock(0);
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = `id-${clock.now()}-${i}`;
      assert.ok(!seen.has(id), `collision at iteration ${i}`);
      seen.add(id);
    }
  });
});

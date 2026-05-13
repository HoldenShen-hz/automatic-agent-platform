import assert from "node:assert/strict";
import test from "node:test";

export const describe = test.describe;
export const it = test.it;

export function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      assert.equal(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepEqual(actual, expected);
    },
    toContain(expected: unknown) {
      assert.ok(Array.isArray(actual) || typeof actual === "string");
      assert.ok((actual as { includes(value: unknown): boolean }).includes(expected));
    },
    not: {
      toBe(expected: unknown) {
        assert.notEqual(actual, expected);
      },
      toContain(expected: unknown) {
        assert.ok(Array.isArray(actual) || typeof actual === "string");
        assert.equal((actual as { includes(value: unknown): boolean }).includes(expected), false);
      },
    },
    toHaveLength(expected: number) {
      assert.equal((actual as { length: number }).length, expected);
    },
    toThrow() {
      assert.throws(actual as () => unknown);
    },
  };
}

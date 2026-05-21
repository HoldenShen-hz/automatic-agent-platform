import assert from "node:assert/strict";

type Throwable = () => unknown;

function readProperty(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, value);
}

function contains(value: unknown, expected: unknown): boolean {
  if (typeof value === "string") {
    return value.includes(String(expected));
  }
  if (Array.isArray(value)) {
    return value.includes(expected);
  }
  return false;
}

export function expect<T>(value: T) {
  return {
    toBe(expected: unknown): void {
      assert.strictEqual(value, expected);
    },
    toEqual(expected: unknown): void {
      assert.deepStrictEqual(value, expected);
    },
    toBeDefined(): void {
      assert.notStrictEqual(value, undefined);
    },
    toBeNull(): void {
      assert.strictEqual(value, null);
    },
    toHaveLength(expected: number): void {
      assert.strictEqual((value as { length?: number }).length, expected);
    },
    toContain(expected: unknown): void {
      assert.ok(
        contains(value, expected),
        `Expected value to contain ${String(expected)}`,
      );
    },
    toHaveProperty(path: string, expected?: unknown): void {
      const propertyValue = readProperty(value, path);
      assert.notStrictEqual(
        propertyValue,
        undefined,
        `Expected property ${path}`,
      );
      if (arguments.length > 1) {
        assert.deepStrictEqual(propertyValue, expected);
      }
    },
    toBeGreaterThan(expected: number): void {
      assert.ok((value as number) > expected);
    },
    toBeGreaterThanOrEqual(expected: number): void {
      assert.ok((value as number) >= expected);
    },
    toThrow(expected?: RegExp | string): void {
      if (typeof expected === "string") {
        assert.throws(value as Throwable, (error) => {
          return error instanceof Error && error.message.includes(expected);
        });
        return;
      }
      assert.throws(value as Throwable, expected);
    },
    not: {
      toBe(expected: unknown): void {
        assert.notStrictEqual(value, expected);
      },
    },
  };
}

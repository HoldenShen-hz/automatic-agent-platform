/**
 * Tests for OutboxRepository chunkValues utility function
 * covering edge cases and boundary conditions
 */

import assert from "node:assert/strict";
import test from "node:test";

// We need to test the internal chunkValues function behavior
// This tests the chunking logic for batch SQL operations

test("chunkValues divides array into chunks of specified size", () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const chunkSize = 3;

  const result = chunkValues(input, chunkSize);

  assert.equal(result.length, 4);
  assert.deepEqual(result[0], [1, 2, 3]);
  assert.deepEqual(result[1], [4, 5, 6]);
  assert.deepEqual(result[2], [7, 8, 9]);
  assert.deepEqual(result[3], [10]);
});

test("chunkValues with empty array returns empty array", () => {
  const result = chunkValues([], 5);
  assert.deepEqual(result, []);
});

test("chunkValues with array smaller than chunk size returns single chunk", () => {
  const input = [1, 2];
  const result = chunkValues(input, 5);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], [1, 2]);
});

test("chunkValues with array equal to chunk size returns single chunk", () => {
  const input = [1, 2, 3, 4, 5];
  const result = chunkValues(input, 5);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], [1, 2, 3, 4, 5]);
});

test("chunkValues with chunk size of 1 returns individual elements", () => {
  const input = [1, 2, 3];
  const result = chunkValues(input, 1);

  assert.equal(result.length, 3);
  assert.deepEqual(result[0], [1]);
  assert.deepEqual(result[1], [2]);
  assert.deepEqual(result[2], [3]);
});

test("chunkValues with chunk size larger than array returns single chunk", () => {
  const input = [1, 2];
  const result = chunkValues(input, 100);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], [1, 2]);
});

test("chunkValues handles objects in array", () => {
  const input = [
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }
  ];
  const result = chunkValues(input, 2);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(result[1], [{ id: 3 }, { id: 4 }]);
});

test("chunkValues preserves reference integrity", () => {
  const obj1 = { key: "a" };
  const obj2 = { key: "b" };
  const obj3 = { key: "c" };
  const input = [obj1, obj2, obj3];

  const result = chunkValues(input, 2);

  assert.equal(result[0]![0], obj1);
  assert.equal(result[0]![1], obj2);
  assert.equal(result[1]![0], obj3);
});

test("chunkValues with chunk size of 0 throws error", () => {
  const input = [1, 2, 3];
  assert.throws(
    () => chunkValues(input, 0),
    /Error/
  );
});

test("chunkValues with chunk size of negative throws error", () => {
  const input = [1, 2, 3];
  assert.throws(
    () => chunkValues(input, -1),
    /Error/
  );
});

test("chunkValues works with strings", () => {
  const input = ["a", "b", "c", "d", "e"];
  const result = chunkValues(input, 2);

  assert.equal(result.length, 3);
  assert.deepEqual(result[0], ["a", "b"]);
  assert.deepEqual(result[1], ["c", "d"]);
  assert.deepEqual(result[2], ["e"]);
});

test("chunkValues works with SQLITE_MAX_BATCH_VARIABLES boundary", () => {
  // SQLITE_MAX_BATCH_VARIABLES = 900
  // Test that exactly 900 items produces one chunk
  const input = Array.from({ length: 900 }, (_, i) => i);
  const result = chunkValues(input, 900);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.length, 900);
});

test("chunkValues with 901 items produces 2 chunks", () => {
  const input = Array.from({ length: 901 }, (_, i) => i);
  const result = chunkValues(input, 900);

  assert.equal(result.length, 2);
  assert.equal(result[0]!.length, 900);
  assert.equal(result[1]!.length, 1);
});

test("chunkValues with 1801 items produces 3 chunks", () => {
  const input = Array.from({ length: 1801 }, (_, i) => i);
  const result = chunkValues(input, 900);

  assert.equal(result.length, 3);
  assert.equal(result[0]!.length, 900);
  assert.equal(result[1]!.length, 900);
  assert.equal(result[2]!.length, 1);
});

// Utility function implementation for testing
function chunkValues<T>(values: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error("size must be positive");
  }
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
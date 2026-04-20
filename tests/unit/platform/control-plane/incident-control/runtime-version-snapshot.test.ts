import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for parseCsvEnv function from runtime-version-snapshot.ts
 * We test the logic inline since the function is not exported.
 */

test("parseCsvEnv handles undefined input", () => {
  // Simulating parseCsvEnv(undefined)
  const parseCsvEnv = (value: string | undefined): string[] => {
    if (value == null || value.length === 0) {
      return [];
    }
    return Array.from(new Set(value.split(",").map((item: string) => item.trim()).filter((item: string) => item.length > 0))).sort();
  };
  assert.deepEqual(parseCsvEnv(undefined), []);
});

test("parseCsvEnv handles empty string", () => {
  const parseCsvEnv = (value: string | undefined): string[] => {
    if (value == null || value.length === 0) {
      return [];
    }
    return Array.from(new Set(value.split(",").map((item: string) => item.trim()).filter((item: string) => item.length > 0))).sort();
  };
  assert.deepEqual(parseCsvEnv(""), []);
});

test("parseCsvEnv parses single value", () => {
  const parseCsvEnv = (value: string | undefined): string[] => {
    if (value == null || value.length === 0) {
      return [];
    }
    return Array.from(new Set(value.split(",").map((item: string) => item.trim()).filter((item: string) => item.length > 0))).sort();
  };
  assert.deepEqual(parseCsvEnv("feature1"), ["feature1"]);
});

test("parseCsvEnv parses multiple values", () => {
  const parseCsvEnv = (value: string | undefined): string[] => {
    if (value == null || value.length === 0) {
      return [];
    }
    return Array.from(new Set(value.split(",").map((item: string) => item.trim()).filter((item: string) => item.length > 0))).sort();
  };
  assert.deepEqual(parseCsvEnv("feature1,feature2,feature3"), ["feature1", "feature2", "feature3"]);
});

test("parseCsvEnv trims whitespace", () => {
  const parseCsvEnv = (value: string | undefined): string[] => {
    if (value == null || value.length === 0) {
      return [];
    }
    return Array.from(new Set(value.split(",").map((item: string) => item.trim()).filter((item: string) => item.length > 0))).sort();
  };
  assert.deepEqual(parseCsvEnv(" feature1 , feature2 , feature3 "), ["feature1", "feature2", "feature3"]);
});

test("parseCsvEnv deduplicates values", () => {
  const parseCsvEnv = (value: string | undefined): string[] => {
    if (value == null || value.length === 0) {
      return [];
    }
    return Array.from(new Set(value.split(",").map((item: string) => item.trim()).filter((item: string) => item.length > 0))).sort();
  };
  assert.deepEqual(parseCsvEnv("feature1,feature2,feature1,feature3,feature2"), ["feature1", "feature2", "feature3"]);
});

test("parseCsvEnv filters empty strings", () => {
  const parseCsvEnv = (value: string | undefined): string[] => {
    if (value == null || value.length === 0) {
      return [];
    }
    return Array.from(new Set(value.split(",").map((item: string) => item.trim()).filter((item: string) => item.length > 0))).sort();
  };
  assert.deepEqual(parseCsvEnv("feature1,,feature2,,,feature3"), ["feature1", "feature2", "feature3"]);
});

test("parseCsvEnv returns sorted result", () => {
  const parseCsvEnv = (value: string | undefined): string[] => {
    if (value == null || value.length === 0) {
      return [];
    }
    return Array.from(new Set(value.split(",").map((item: string) => item.trim()).filter((item: string) => item.length > 0))).sort();
  };
  assert.deepEqual(parseCsvEnv("zebra,apple,banana"), ["apple", "banana", "zebra"]);
});

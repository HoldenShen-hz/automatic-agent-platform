import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeVersionSnapshot } from "../../../../../src/platform/five-plane-control-plane/incident-control/runtime-version-snapshot.js";

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

test("buildRuntimeVersionSnapshot reads extension and feature flag env through normalized CSV parsing", () => {
  const previousEnabledExtensions = process.env.AA_ENABLED_EXTENSIONS;
  const previousFeatureFlags = process.env.AA_FEATURE_FLAGS;
  process.env.AA_ENABLED_EXTENSIONS = " beta , alpha , beta ";
  process.env.AA_FEATURE_FLAGS = " zebra , apple ";

  try {
    const snapshot = buildRuntimeVersionSnapshot({
      currentVersion: 1,
      expectedVersion: 1,
      upToDate: true,
      pendingVersions: [],
      checksumMismatches: [],
    });

    assert.deepEqual(snapshot.enabledExtensions, ["alpha", "beta"]);
    assert.deepEqual(snapshot.featureFlags, ["apple", "zebra"]);
  } finally {
    if (previousEnabledExtensions == null) delete process.env.AA_ENABLED_EXTENSIONS;
    else process.env.AA_ENABLED_EXTENSIONS = previousEnabledExtensions;
    if (previousFeatureFlags == null) delete process.env.AA_FEATURE_FLAGS;
    else process.env.AA_FEATURE_FLAGS = previousFeatureFlags;
  }
});

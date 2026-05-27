import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  selectPreferredRegion,
  type RegionDescriptor,
} from "../../../../../src/scale-ecosystem/multi-region/region-router/index.js";

function mockRegion(overrides: Partial<RegionDescriptor> = {}): RegionDescriptor {
  return {
    regionId: "region-1",
    countryCode: "US",
    jurisdiction: "US",
    capabilities: [],
    status: "active",
    latencyScore: 100,
    residencyAllowed: true,
    ...overrides,
  };
}

test("selectPreferredRegion returns lowest latency region [region-router]", () => {
  const regions = [
    mockRegion({ regionId: "high-latency", latencyScore: 200 }),
    mockRegion({ regionId: "low-latency", latencyScore: 50 }),
    mockRegion({ regionId: "medium-latency", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "low-latency");
});

test("selectPreferredRegion ignores disabled regions [region-router]", () => {
  const regions = [
    mockRegion({ regionId: "disabled", status: "disabled", latencyScore: 10 }),
    mockRegion({ regionId: "enabled", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "enabled");
});

test("selectPreferredRegion ignores regions with residency not allowed [region-router]", () => {
  const regions = [
    mockRegion({ regionId: "not-allowed", residencyAllowed: false, latencyScore: 10 }),
    mockRegion({ regionId: "allowed", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "allowed");
});

test("selectPreferredRegion returns null for empty array [region-router]", () => {
  const result = selectPreferredRegion([]);

  assert.strictEqual(result, null);
});

test("selectPreferredRegion returns null when all regions disabled [region-router]", () => {
  const regions = [
    mockRegion({ status: "disabled" }),
    mockRegion({ status: "disabled" }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result, null);
});

test("selectPreferredRegion handles degraded status as not disabled [region-router]", () => {
  const regions = [
    mockRegion({ regionId: "degraded", status: "degraded", latencyScore: 50 }),
    mockRegion({ regionId: "active", status: "active", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "degraded");
});

test("selectPreferredRegion uses default latency of 0 when not specified [region-router]", () => {
  const regions = [
    mockRegion({ regionId: "no-latency", latencyScore: undefined }),
    mockRegion({ regionId: "with-latency", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "no-latency");
});

test("selectPreferredRegion returns first when multiple have same latency [region-router]", () => {
  const regions = [
    mockRegion({ regionId: "first", latencyScore: 50 }),
    mockRegion({ regionId: "second", latencyScore: 50 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "first");
});

test("selectPreferredRegion ignores regions with residency not allowed even if lowest latency [region-router]", () => {
  const regions = [
    mockRegion({ regionId: "eu-not-allowed", jurisdiction: "EU", residencyAllowed: false, latencyScore: 10 }),
    mockRegion({ regionId: "us-allowed", jurisdiction: "US", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "us-allowed");
});
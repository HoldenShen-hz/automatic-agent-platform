import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  selectPreferredRegion,
  type RegionDescriptor,
} from "../../../../../src/scale-ecosystem/multi-region/region-router/index.js";

function mockRegion(overrides: Partial<RegionDescriptor> = {}): RegionDescriptor {
  return {
    regionId: "region-1",
    provider: "aws",
    endpoints: {
      api: "https://api.example.com",
    },
    dataResidencyPolicy: "regional",
    countryCode: "US",
    jurisdiction: "US",
    capabilities: [],
    status: "active",
    latencyScore: 100,
    residencyAllowed: true,
    ...overrides,
  };
}

test("selectPreferredRegion returns lowest latency region", () => {
  const regions = [
    mockRegion({ regionId: "high-latency", latencyScore: 200 }),
    mockRegion({ regionId: "low-latency", latencyScore: 50 }),
    mockRegion({ regionId: "medium-latency", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "low-latency");
});

test("selectPreferredRegion ignores draining regions", () => {
  const regions = [
    mockRegion({ regionId: "draining", status: "draining", latencyScore: 10 }),
    mockRegion({ regionId: "enabled", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "enabled");
});

test("selectPreferredRegion ignores regions with residency not allowed", () => {
  const regions = [
    mockRegion({ regionId: "not-allowed", residencyAllowed: false, latencyScore: 10 }),
    mockRegion({ regionId: "allowed", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "allowed");
});

test("selectPreferredRegion returns null for empty array", () => {
  const result = selectPreferredRegion([]);

  assert.strictEqual(result, null);
});

test("selectPreferredRegion returns null when all regions are draining", () => {
  const regions = [
    mockRegion({ status: "draining" }),
    mockRegion({ status: "draining" }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result, null);
});

test("selectPreferredRegion keeps standby regions selectable", () => {
  const regions = [
    mockRegion({ regionId: "standby", status: "standby", latencyScore: 50 }),
    mockRegion({ regionId: "active", status: "active", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "standby");
});

test("selectPreferredRegion uses default latency of 0 when not specified", () => {
  const regions = [
    mockRegion({ regionId: "no-latency", latencyScore: undefined }),
    mockRegion({ regionId: "with-latency", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "no-latency");
});

test("selectPreferredRegion returns first when multiple have same latency", () => {
  const regions = [
    mockRegion({ regionId: "first", latencyScore: 50 }),
    mockRegion({ regionId: "second", latencyScore: 50 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "first");
});

test("selectPreferredRegion ignores regions with residency not allowed even if lowest latency", () => {
  const regions = [
    mockRegion({ regionId: "eu-not-allowed", jurisdiction: "EU", residencyAllowed: false, latencyScore: 10 }),
    mockRegion({ regionId: "us-allowed", jurisdiction: "US", latencyScore: 100 }),
  ];

  const result = selectPreferredRegion(regions);

  assert.strictEqual(result?.regionId, "us-allowed");
});

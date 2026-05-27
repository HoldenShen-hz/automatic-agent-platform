/**
 * Unit tests for region-router
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import assert from "node:assert/strict";
import test from "node:test";
import { selectPreferredRegion, RegionDescriptorSchema, type RegionDescriptor } from "../../../../src/scale-ecosystem/multi-region/region-router/index.js";

function createRegion(overrides: Partial<RegionDescriptor> = {}): RegionDescriptor {
  return {
    regionId: "us-east",
    countryCode: "US",
    jurisdiction: "US",
    capabilities: ["llm", "storage"],
    status: "active",
    latencyScore: 10,
    residencyAllowed: true,
    ...overrides,
  };
}

test("selectPreferredRegion returns lowest latency active region [region-router]", () => {
  const regions = [
    createRegion({ regionId: "eu-west", latencyScore: 50 }),
    createRegion({ regionId: "us-east", latencyScore: 10 }),
    createRegion({ regionId: "ap-south", latencyScore: 30 }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "us-east");
});

test("selectPreferredRegion skips disabled regions [region-router]", () => {
  const regions = [
    createRegion({ regionId: "eu-west", latencyScore: 10, status: "disabled" }),
    createRegion({ regionId: "us-east", latencyScore: 50, status: "active" }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "us-east");
  assert.equal(selected?.latencyScore, 50);
});

test("selectPreferredRegion respects residencyAllowed flag [region-router]", () => {
  const regions = [
    createRegion({ regionId: "eu-west", latencyScore: 10, residencyAllowed: false }),
    createRegion({ regionId: "us-east", latencyScore: 50, residencyAllowed: true }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "us-east");
});

test("selectPreferredRegion returns null for empty array [region-router]", () => {
  const selected = selectPreferredRegion([]);
  assert.equal(selected, null);
});

test("selectPreferredRegion returns null when all regions disabled [region-router]", () => {
  const regions = [
    createRegion({ regionId: "eu-west", status: "disabled" }),
    createRegion({ regionId: "us-east", status: "disabled" }),
  ];

  const selected = selectPreferredRegion(regions);
  assert.equal(selected, null);
});

test("selectPreferredRegion handles degraded status [region-router]", () => {
  const regions = [
    createRegion({ regionId: "eu-west", latencyScore: 5, status: "degraded" }),
    createRegion({ regionId: "us-east", latencyScore: 10, status: "active" }),
  ];

  const selected = selectPreferredRegion(regions);

  // Degraded is not "disabled", so lowest latency is selected
  assert.equal(selected?.regionId, "eu-west");
});

test("RegionDescriptorSchema parses valid input [region-router]", () => {
  const input = {
    regionId: "us-east",
    countryCode: "US",
    jurisdiction: "US",
    capabilities: ["llm"],
    status: "active" as const,
    latencyScore: 10,
    residencyAllowed: true,
  };

  const result = RegionDescriptorSchema.safeParse(input);
  assert.equal(result.success, true);
});

test("RegionDescriptorSchema applies defaults [region-router]", () => {
  const input = {
    regionId: "us-east",
    jurisdiction: "US",
  };

  const result = RegionDescriptorSchema.safeParse(input);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.countryCode, "XX");
    assert.deepEqual(result.data.capabilities, []);
    assert.equal(result.data.status, "active");
    assert.equal(result.data.latencyScore, 0);
    assert.equal(result.data.residencyAllowed, true);
  }
});

test("selectPreferredRegion returns null when all regions have residencyAllowed false [region-router]", () => {
  const regions = [
    createRegion({ regionId: "eu-west", latencyScore: 5, residencyAllowed: false }),
    createRegion({ regionId: "us-east", latencyScore: 10, residencyAllowed: false }),
  ];

  const selected = selectPreferredRegion(regions);
  assert.equal(selected, null);
});

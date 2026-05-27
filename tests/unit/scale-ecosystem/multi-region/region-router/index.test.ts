import assert from "node:assert/strict";
import test from "node:test";

import {
  RegionDescriptorSchema,
  selectPreferredRegion,
  type RegionDescriptor,
} from "../../../../../src/scale-ecosystem/multi-region/region-router/index.js";

test("RegionDescriptorSchema parses valid region descriptor [index]", () => {
  const valid = {
    regionId: "us-east-1",
    provider: "aws",
    endpoints: { api: "https://api.example.com" },
    dataResidencyPolicy: "regional",
    countryCode: "US",
    jurisdiction: "US-East",
    capabilities: ["compute", "storage"],
    status: "active",
    latencyScore: 10,
    residencyAllowed: true,
  };

  const result = RegionDescriptorSchema.parse(valid);
  assert.equal(result.regionId, "us-east-1");
  assert.equal(result.countryCode, "US");
  assert.equal(result.jurisdiction, "US-East");
  assert.deepEqual(result.capabilities, ["compute", "storage"]);
  assert.equal(result.status, "active");
  assert.equal(result.latencyScore, 10);
  assert.equal(result.residencyAllowed, true);
});

test("RegionDescriptorSchema applies defaults [index]", () => {
  // Note: Schema does NOT have defaults for required fields (provider, endpoints, dataResidencyPolicy)
  // So we need to provide complete valid input to test defaults that do exist
  const withPartialDefaults = {
    regionId: "eu-west-1",
    jurisdiction: "EU-West",
    provider: "aws",
    endpoints: { api: "https://api.example.com" },
    dataResidencyPolicy: "regional",
  };

  const result = RegionDescriptorSchema.parse(withPartialDefaults);
  assert.equal(result.regionId, "eu-west-1");
  assert.equal(result.countryCode, "XX");
  assert.deepEqual(result.capabilities, []);
  assert.equal(result.status, "active");
  assert.equal(result.latencyScore, 0);
  assert.equal(result.residencyAllowed, true);
});

test("RegionDescriptorSchema rejects invalid status [index]", () => {
  const invalid = {
    regionId: "ap-south-1",
    jurisdiction: "AP-South",
    status: "invalid_status",
  };

  assert.throws(() => RegionDescriptorSchema.parse(invalid), /invalid/i);
});

test("RegionDescriptorSchema rejects latencyScore below zero [index]", () => {
  const invalid = {
    regionId: "us-west-2",
    jurisdiction: "US-West",
    provider: "aws",
    endpoints: { api: "https://api.example.com" },
    dataResidencyPolicy: "regional",
    latencyScore: -1,
  };

  assert.throws(() => RegionDescriptorSchema.parse(invalid), /greater than or equal to 0/i);
});

test("selectPreferredRegion returns null for empty array [index]", () => {
  const result = selectPreferredRegion([]);
  assert.equal(result, null);
});

test("selectPreferredRegion returns null when all regions are disabled [index]", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east-1", jurisdiction: "US", status: "disabled" },
    { regionId: "eu-west-1", jurisdiction: "EU", status: "disabled" },
  ];

  const result = selectPreferredRegion(regions);
  assert.equal(result, null);
});

test("selectPreferredRegion returns null when no residency allowed [index]", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east-1", jurisdiction: "US", residencyAllowed: false },
    { regionId: "eu-west-1", jurisdiction: "EU", residencyAllowed: false },
  ];

  const result = selectPreferredRegion(regions);
  assert.equal(result, null);
});

test("selectPreferredRegion selects lowest latencyScore region [index]", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east-1", jurisdiction: "US", latencyScore: 50 },
    { regionId: "eu-west-1", jurisdiction: "EU", latencyScore: 20 },
    { regionId: "ap-south-1", jurisdiction: "AP", latencyScore: 10 },
  ];

  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "ap-south-1");
});

test("selectPreferredRegion skips disabled regions [index]", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east-1", jurisdiction: "US", latencyScore: 5, status: "disabled" },
    { regionId: "eu-west-1", jurisdiction: "EU", latencyScore: 20 },
  ];

  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "eu-west-1");
});

test("selectPreferredRegion skips regions without residency [index]", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east-1", jurisdiction: "US", residencyAllowed: true },
    { regionId: "eu-west-1", jurisdiction: "EU", residencyAllowed: false },
  ];

  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east-1");
});

test("selectPreferredRegion handles degraded status [index]", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east-1", jurisdiction: "US", status: "degraded", latencyScore: 5 },
    { regionId: "eu-west-1", jurisdiction: "EU", status: "active", latencyScore: 20 },
  ];

  // degraded is not "disabled", so it should still be selected if lowest latency
  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east-1");
});

test("selectPreferredRegion handles undefined optional fields with defaults [index]", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east-1", jurisdiction: "US" }, // no status, no latencyScore, no residencyAllowed
    { regionId: "eu-west-1", jurisdiction: "EU", latencyScore: 100 },
  ];

  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east-1");
});

test("selectPreferredRegion returns first when latency scores are equal [index]", () => {
  const regions: readonly RegionDescriptor[] = [
    { regionId: "us-east-1", jurisdiction: "US", latencyScore: 10 },
    { regionId: "eu-west-1", jurisdiction: "EU", latencyScore: 10 },
  ];

  const result = selectPreferredRegion(regions);
  assert.ok(result !== null);
  assert.equal(result.regionId, "us-east-1");
});

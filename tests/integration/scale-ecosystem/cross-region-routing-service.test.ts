import assert from "node:assert/strict";
import test from "node:test";

import { CrossRegionRoutingService, type CrossRegionRouteRequest } from "../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import { resolveRegionFailover, type RegionFailoverInput } from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import { selectPreferredRegion, type RegionDescriptor } from "../../../src/scale-ecosystem/multi-region/region-router/index.js";

function createMockRegionDescriptor(overrides = {}): RegionDescriptor {
  return {
    regionId: "us-east-1",
    provider: "aws",
    endpoints: { api: "https://api.us-east-1.example.com" },
    dataResidencyPolicy: "regional" as const,
    countryCode: "US",
    jurisdiction: "US",
    capabilities: ["compute", "storage"],
    status: "active",
    latencyScore: 45,
    residencyAllowed: true,
    ...overrides,
  };
}

function createRegionDescriptor(overrides = {}): RegionDescriptor {
  return createMockRegionDescriptor(overrides);
}

test("cross region routing selects preferred region when available and allowed", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createRegionDescriptor({ regionId: "us-east-1", countryCode: "US", jurisdiction: "US", capabilities: ["compute", "storage"], status: "active", latencyScore: 45, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "eu-west-1", countryCode: "IE", jurisdiction: "EU", capabilities: ["compute"], status: "active", latencyScore: 120, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "ap-south-1", countryCode: "IN", jurisdiction: "IN", capabilities: ["compute"], status: "draining", latencyScore: 180, residencyAllowed: true }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "default_policy",
      allowedJurisdictions: ["US", "EU", "IN"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      crossBorderTransferClass: "free_transfer",
    },
    primaryRegionId: "us-east-1",
    preferredRegionId: "eu-west-1",
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "eu-west-1");
  assert.equal(decision.residencyDecision, "allowed");
  assert.ok(decision.candidateRegions.includes("eu-west-1"));
  assert.ok(!decision.blockedRegions.includes("eu-west-1"));
  assert.equal(decision.recoveryTopology.primaryRegionId, "us-east-1");
  assert.equal(decision.recoveryTopology.failoverRegionId, null);
});

test("cross region routing falls back to lowest latency region when preferred is unavailable", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createRegionDescriptor({ regionId: "us-east-1", countryCode: "US", jurisdiction: "US", capabilities: ["compute", "storage"], status: "active", latencyScore: 45, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "eu-west-1", countryCode: "IE", jurisdiction: "EU", capabilities: ["compute"], status: "draining", latencyScore: 120, residencyAllowed: true }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "default_policy",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      crossBorderTransferClass: "free_transfer",
    },
    preferredRegionId: "eu-west-1",
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-east-1");
  assert.equal(decision.residencyDecision, "allowed");
  assert.ok(decision.blockedRegions.includes("eu-west-1"));
});

test("cross region routing blocks regions outside allowed jurisdictions", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createRegionDescriptor({ regionId: "us-east-1", countryCode: "US", jurisdiction: "US", capabilities: ["compute"], status: "active", latencyScore: 45, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "ru-central-1", countryCode: "RU", jurisdiction: "RU", capabilities: ["compute"], status: "active", latencyScore: 80, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "cn-north-1", countryCode: "CN", jurisdiction: "CN", capabilities: ["compute"], status: "active", latencyScore: 150, residencyAllowed: true }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "us_eu_only",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      crossBorderTransferClass: "local_only",
    },
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-east-1");
  assert.deepEqual(decision.blockedRegions, ["ru-central-1", "cn-north-1"]);
  assert.equal(decision.residencyDecision, "allowed");
});

test("cross region routing respects required capabilities", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createRegionDescriptor({ regionId: "us-east-1", countryCode: "US", jurisdiction: "US", capabilities: ["compute"], status: "active", latencyScore: 50, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "us-west-2", countryCode: "US", jurisdiction: "US", capabilities: ["compute", "storage", "gpu"], status: "active", latencyScore: 70, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "eu-west-1", countryCode: "IE", jurisdiction: "EU", capabilities: ["compute"], status: "active", latencyScore: 90, residencyAllowed: true }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "gpu_workload",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: ["gpu", "storage"],
      crossBorderTransferClass: "local_only",
    },
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-west-2");
  assert.ok(decision.blockedRegions.includes("us-east-1"));
  assert.ok(decision.blockedRegions.includes("eu-west-1"));
});

test("cross region routing blocks when no region satisfies all constraints", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createRegionDescriptor({ regionId: "us-east-1", countryCode: "US", jurisdiction: "US", capabilities: ["compute"], status: "active", latencyScore: 45, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "eu-west-1", countryCode: "IE", jurisdiction: "EU", capabilities: ["compute"], status: "active", latencyScore: 120, residencyAllowed: true }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "us_only_gpu",
      allowedJurisdictions: ["US"],
      blockedRegionIds: [],
      requiredCapabilities: ["gpu"],
      crossBorderTransferClass: "local_only",
    },
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, null);
  assert.equal(decision.residencyDecision, "blocked");
  assert.equal(decision.candidateRegions.length, 0);
});

test("cross region routing includes replication targets in recovery topology", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createRegionDescriptor({ regionId: "us-east-1", countryCode: "US", jurisdiction: "US", capabilities: ["compute", "storage"], status: "active", latencyScore: 45, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "us-west-2", countryCode: "US", jurisdiction: "US", capabilities: ["compute", "storage"], status: "active", latencyScore: 70, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "eu-west-1", countryCode: "IE", jurisdiction: "EU", capabilities: ["compute", "storage"], status: "active", latencyScore: 120, residencyAllowed: true }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "multi_region_replication",
      allowedJurisdictions: ["US", "EU"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      crossBorderTransferClass: "free_transfer",
    },
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: true,
    replicationPolicy: {
      sourceRegionId: "us-east-1",
      targetRegionIds: ["us-west-2", "eu-west-1"],
      residencyMode: "allowed_cross_border",
    },
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-east-1");
  assert.deepEqual([...decision.recoveryTopology.replicationTargets].sort(), ["us-west-2", "eu-west-1"].sort());
});

test("cross region routing respects blocked region list", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createRegionDescriptor({ regionId: "us-east-1", countryCode: "US", jurisdiction: "US", capabilities: ["compute"], status: "active", latencyScore: 45, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "us-west-2", countryCode: "US", jurisdiction: "US", capabilities: ["compute"], status: "active", latencyScore: 70, residencyAllowed: true }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "blocked_west",
      allowedJurisdictions: ["US"],
      blockedRegionIds: ["us-west-2"],
      requiredCapabilities: [],
      crossBorderTransferClass: "local_only",
    },
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-east-1");
  assert.ok(decision.blockedRegions.includes("us-west-2"));
});

test("cross region routing marks residency not allowed as blocked", () => {
  const service = new CrossRegionRoutingService();
  const regions: RegionDescriptor[] = [
    createRegionDescriptor({ regionId: "us-east-1", countryCode: "US", jurisdiction: "US", capabilities: ["compute"], status: "active", latencyScore: 45, residencyAllowed: true }),
    createRegionDescriptor({ regionId: "cn-north-1", countryCode: "CN", jurisdiction: "CN", capabilities: ["compute"], status: "active", latencyScore: 80, residencyAllowed: false }),
  ];

  const request: CrossRegionRouteRequest = {
    regions,
    policy: {
      policyId: "default_policy",
      allowedJurisdictions: ["US", "CN"],
      blockedRegionIds: [],
      requiredCapabilities: [],
      crossBorderTransferClass: "free_transfer",
    },
    primaryRegionHealthy: true,
    replicationPolicy: null,
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "us-east-1");
  assert.ok(decision.blockedRegions.includes("cn-north-1"));
});

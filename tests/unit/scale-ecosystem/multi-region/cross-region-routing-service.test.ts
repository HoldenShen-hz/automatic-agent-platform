/**
 * Unit tests for CrossRegionRoutingService
 */

import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { CrossRegionRoutingService, type CrossRegionRouteRequest, type ResidencyPolicy } from "../../../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";

// Mock helper to create a minimal RegionDescriptor
function createRegion(overrides: Partial<{
  regionId: string;
  jurisdiction: string;
  status: string;
  residencyAllowed: boolean;
  latencyScore: number;
  capabilities: readonly string[];
}> = {}): any {
  return {
    regionId: "us-east-1",
    jurisdiction: "US",
    status: "healthy",
    residencyAllowed: true,
    latencyScore: 50,
    capabilities: [],
    ...overrides,
  };
}

function createResidencyPolicy(overrides: Partial<{
  policyId: string;
  allowedJurisdictions: readonly string[];
  blockedRegionIds: readonly string[];
  requiredCapabilities: readonly string[];
  allowCrossBorder: boolean;
}> = {}): ResidencyPolicy {
  return {
    policyId: "default",
    allowedJurisdictions: ["US", "EU"],
    blockedRegionIds: [],
    requiredCapabilities: [],
    allowCrossBorder: true,
    ...overrides,
  };
}

function createRouteRequest(overrides: Partial<{
  regions: readonly any[];
  policy: ResidencyPolicy;
  primaryRegionId: string | null;
  preferredRegionId: string | null;
  primaryRegionHealthy: boolean;
}> = {}): CrossRegionRouteRequest {
  return {
    regions: [createRegion({ regionId: "us-east-1" }), createRegion({ regionId: "eu-west-1" })],
    policy: createResidencyPolicy(),
    primaryRegionId: null,
    preferredRegionId: null,
    primaryRegionHealthy: true,
    ...overrides,
  };
}

test("CrossRegionRoutingService.route selects preferred region when specified", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [
      createRegion({ regionId: "us-east-1", latencyScore: 100 }),
      createRegion({ regionId: "eu-west-1", latencyScore: 50 }),
    ],
    preferredRegionId: "eu-west-1",
  });

  const decision = service.route(request);

  assert.strictEqual(decision.selectedRegionId, "eu-west-1");
  assert.strictEqual(decision.latencyScore, 50);
});

test("CrossRegionRoutingService.route blocks regions with invalid jurisdiction", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [
      createRegion({ regionId: "us-east-1", jurisdiction: "US" }),
      createRegion({ regionId: "cn-north-1", jurisdiction: "CN" }),
    ],
    policy: createResidencyPolicy({
      allowedJurisdictions: ["US", "EU"],
    }),
  });

  const decision = service.route(request);

  assert.ok(decision.blockedRegions.includes("cn-north-1"));
  assert.ok(!decision.candidateRegions.includes("cn-north-1"));
});

test("CrossRegionRoutingService.route blocks disabled regions", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [
      createRegion({ regionId: "us-east-1", status: "healthy" }),
      createRegion({ regionId: "us-west-1", status: "disabled" }),
    ],
  });

  const decision = service.route(request);

  assert.ok(decision.blockedRegions.includes("us-west-1"));
});

test("CrossRegionRoutingService.route blocks regions with residency not allowed", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [
      createRegion({ regionId: "us-east-1", residencyAllowed: true }),
      createRegion({ regionId: "eu-west-1", residencyAllowed: false }),
    ],
  });

  const decision = service.route(request);

  assert.ok(decision.blockedRegions.includes("eu-west-1"));
});

test("CrossRegionRoutingService.route blocks explicitly blocked region IDs", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [
      createRegion({ regionId: "us-east-1" }),
      createRegion({ regionId: "eu-west-1" }),
    ],
    policy: createResidencyPolicy({
      blockedRegionIds: ["eu-west-1"],
    }),
  });

  const decision = service.route(request);

  assert.ok(decision.blockedRegions.includes("eu-west-1"));
  assert.ok(!decision.candidateRegions.includes("eu-west-1"));
});

test("CrossRegionRoutingService.route blocks regions missing required capabilities", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [
      createRegion({ regionId: "us-east-1", capabilities: ["compute", "storage"] }),
      createRegion({ regionId: "eu-west-1", capabilities: ["compute"] }),
    ],
    policy: createResidencyPolicy({
      requiredCapabilities: ["storage"],
    }),
  });

  const decision = service.route(request);

  assert.ok(decision.blockedRegions.includes("eu-west-1"));
  assert.ok(decision.candidateRegions.includes("us-east-1"));
});

test("CrossRegionRoutingService.route returns blocked residency decision when no candidates", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [
      createRegion({ regionId: "cn-north-1", jurisdiction: "CN" }),
    ],
    policy: createResidencyPolicy({
      allowedJurisdictions: ["US", "EU"],
    }),
  });

  const decision = service.route(request);

  assert.strictEqual(decision.selectedRegionId, null);
  assert.strictEqual(decision.residencyDecision, "blocked");
});

test("CrossRegionRoutingService.route includes failover region in recovery topology", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: false,
    regions: [
      createRegion({ regionId: "us-east-1", latencyScore: 30 }),
      createRegion({ regionId: "us-west-1", latencyScore: 80 }),
      createRegion({ regionId: "eu-west-1", latencyScore: 150 }),
    ],
  });

  const decision = service.route(request);

  assert.strictEqual(decision.recoveryTopology.primaryRegionId, "us-east-1");
  assert.ok(decision.recoveryTopology.failoverRegionId !== null);
});

test("CrossRegionRoutingService.route sets residencyDecision to allowed when region selected", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest();

  const decision = service.route(request);

  assert.strictEqual(decision.residencyDecision, "allowed");
});

test("CrossRegionRoutingService.route returns empty candidate list when all blocked", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [],
    policy: createResidencyPolicy({
      allowedJurisdictions: ["US"],
    }),
  });

  const decision = service.route(request);

  assert.strictEqual(decision.candidateRegions.length, 0);
  assert.strictEqual(decision.residencyDecision, "blocked");
});

test("CrossRegionRoutingService.route selects lowest latency region when no preference", () => {
  const service = new CrossRegionRoutingService();
  const request = createRouteRequest({
    regions: [
      createRegion({ regionId: "us-east-1", latencyScore: 100 }),
      createRegion({ regionId: "eu-west-1", latencyScore: 50 }),
    ],
    preferredRegionId: null,
  });

  const decision = service.route(request);

  assert.strictEqual(decision.selectedRegionId, "eu-west-1");
  assert.strictEqual(decision.latencyScore, 50);
});

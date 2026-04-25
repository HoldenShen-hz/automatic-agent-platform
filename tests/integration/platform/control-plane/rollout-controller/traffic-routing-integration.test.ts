/**
 * Integration Test: Traffic Routing Service
 *
 * Tests traffic routing for rollout controller including
 * weight distribution, region targeting, and canary routing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TrafficRoutingService } from "../../../../../src/platform/control-plane/rollout-controller/traffic-routing-service.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("traffic routing: allocates traffic weight across regions", () => {
  const service = new TrafficRoutingService();

  const allocation = service.allocateTraffic({
    serviceId: "svc-test",
    regions: [
      { region: "us-east-1", weight: 70 },
      { region: "us-west-2", weight: 30 },
    ],
    strategy: "weighted",
  });

  assert.equal(allocation.totalWeight, 100);
  assert.equal(allocation.allocations.length, 2);
  assert.equal(allocation.allocations[0]?.region, "us-east-1");
  assert.equal(allocation.allocations[0]?.weight, 70);
});

test("traffic routing: handles canary routing with small percentage", () => {
  const service = new TrafficRoutingService();

  const canary = service.allocateTraffic({
    serviceId: "svc-canary",
    regions: [
      { region: "us-east-1", weight: 95 },
      { region: "canary", weight: 5 },
    ],
    strategy: "canary",
  });

  assert.equal(canary.totalWeight, 100);
  assert.ok(canary.allocations.some((a) => a.region === "canary"));
});

test("traffic routing: blue-green deployment routing", () => {
  const service = new TrafficRoutingService();

  const bg = service.allocateTraffic({
    serviceId: "svc-bluegreen",
    regions: [
      { region: "blue", weight: 100 },
      { region: "green", weight: 0 },
    ],
    strategy: "blue_green",
  });

  assert.equal(bg.allocations.length, 2);
  const blue = bg.allocations.find((a) => a.region === "blue");
  const green = bg.allocations.find((a) => a.region === "green");
  assert.ok(blue);
  assert.ok(green);
  assert.equal(blue?.weight, 100);
  assert.equal(green?.weight, 0);
});

test("traffic routing: progressive rollout stages", () => {
  const service = new TrafficRoutingService();

  const stages = [10, 25, 50, 75, 100];
  const rolloutResults = stages.map((percent) =>
    service.allocateTraffic({
      serviceId: "svc-progressive",
      regions: [
        { region: "primary", weight: 100 - percent },
        { region: "new", weight: percent },
      ],
      strategy: "progressive",
    }),
  );

  assert.equal(rolloutResults.length, 5);
  rolloutResults.forEach((result, index) => {
    const newRegion = result.allocations.find((a) => a.region === "new");
    assert.ok(newRegion);
    assert.equal(newRegion?.weight, stages[index]);
  });
});

test("traffic routing: rollback routing redirects traffic", () => {
  const service = new TrafficRoutingService();

  const rollback = service.allocateTraffic({
    serviceId: "svc-rollback",
    regions: [
      { region: "stable", weight: 100 },
      { region: "failed", weight: 0 },
    ],
    strategy: "rollback",
  });

  assert.equal(rollback.allocations.length, 2);
  const stable = rollback.allocations.find((a) => a.region === "stable");
  assert.ok(stable);
  assert.equal(stable?.weight, 100);
});

test("traffic routing: multi-region distribution", () => {
  const service = new TrafficRoutingService();

  const multi = service.allocateTraffic({
    serviceId: "svc-global",
    regions: [
      { region: "us-east-1", weight: 40 },
      { region: "us-west-2", weight: 20 },
      { region: "eu-west-1", weight: 25 },
      { region: "ap-southeast-1", weight: 15 },
    ],
    strategy: "weighted",
  });

  assert.equal(multi.totalWeight, 100);
  assert.equal(multi.allocations.length, 4);

  const total = multi.allocations.reduce((sum, a) => sum + a.weight, 0);
  assert.equal(total, 100);
});

test("traffic routing: validates weight constraints", () => {
  const service = new TrafficRoutingService();

  const invalid = service.validateWeights([
    { region: "us-east-1", weight: 60 },
    { region: "us-west-2", weight: 60 },
  ]);

  assert.strictEqual(invalid.valid, false);
  assert.ok(invalid.error?.includes("weight"));
});

test("traffic routing: validates correct weight sum", () => {
  const service = new TrafficRoutingService();

  const valid = service.validateWeights([
    { region: "us-east-1", weight: 50 },
    { region: "us-west-2", weight: 50 },
  ]);

  assert.strictEqual(valid.valid, true);
});

test("traffic routing: computes traffic shift delta", () => {
  const service = new TrafficRoutingService();

  const delta = service.computeShiftDelta(
    [
      { region: "us-east-1", weight: 100 },
    ],
    [
      { region: "us-east-1", weight: 90 },
      { region: "us-west-2", weight: 10 },
    ],
  );

  assert.ok(delta.shifted >= 0);
  assert.ok(delta.fromRegion === "us-east-1");
  assert.ok(delta.toRegion === "us-west-2");
});

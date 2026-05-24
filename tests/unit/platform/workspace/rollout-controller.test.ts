/**
 * Unit Tests: Rollout Controller
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  TrafficRoutingService,
  type TrafficRoute,
  type RoutingRule,
  type RouteTarget,
} from "../../../../src/platform/five-plane-control-plane/rollout-controller/index.js";

// ============================================================================
// Traffic Routing Service Tests
// ============================================================================

test("TrafficRoutingService creates traffic route", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_001",
    name: "primary_route",
    targets: [
      { targetId: "target_1", weight: 80, metadata: { region: "us-east-1" } },
      { targetId: "target_2", weight: 20, metadata: { region: "us-west-1" } },
    ],
    rules: [],
    strategy: "weighted",
  });

  assert.equal(route.routeId, "route_001");
  assert.equal(route.targets.length, 2);
  assert.equal(route.status, "active");
});

test("TrafficRoutingService weights sum to 100", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_002",
    name: "balanced_route",
    targets: [
      { targetId: "target_a", weight: 50 },
      { targetId: "target_b", weight: 50 },
    ],
    rules: [],
    strategy: "weighted",
  });

  const totalWeight = route.targets.reduce((sum, t) => sum + t.weight, 0);
  assert.equal(totalWeight, 100);
});

test("TrafficRoutingService adds routing rule", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_003",
    name: "rule_based_route",
    targets: [{ targetId: "target_1", weight: 100 }],
    rules: [],
    strategy: "rule_based",
  });

  const updated = service.addRule(route.routeId, {
    matchCriteria: { header: { "x-user-tier": "premium" } },
    targetId: "target_premium",
    weight: 100,
  });

  assert.equal(updated.rules.length, 1);
  assert.ok(updated.rules[0]!.matchCriteria.header !== undefined);
});

test("TrafficRoutingService removes routing rule", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_004",
    name: "removable_rule_route",
    targets: [{ targetId: "target_1", weight: 100 }],
    rules: [
      {
        ruleId: "rule_001",
        matchCriteria: { header: { "x-region": "eu" } },
        targetId: "target_eu",
        weight: 100,
      },
    ],
    strategy: "rule_based",
  });

  const updated = service.removeRule(route.routeId, "rule_001");

  assert.equal(updated.rules.length, 0);
});

test("TrafficRoutingService evaluates route to target", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_005",
    name: "evaluation_route",
    targets: [
      { targetId: "target_1", weight: 70 },
      { targetId: "target_2", weight: 30 },
    ],
    rules: [],
    strategy: "weighted",
  });

  const result = service.evaluateRoute(route.routeId, {});

  assert.ok(result.targetId !== undefined);
  assert.ok(result.weight !== undefined);
});

test("TrafficRoutingService respects rule-based routing", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_006",
    name: "header_route",
    targets: [
      { targetId: "target_regular", weight: 100 },
      { targetId: "target_vip", weight: 100 },
    ],
    rules: [
      {
        ruleId: "rule_vip",
        matchCriteria: { header: { "x-user-type": "vip" } },
        targetId: "target_vip",
        weight: 100,
      },
    ],
    strategy: "rule_based",
  });

  const vipResult = service.evaluateRoute(route.routeId, {
    headers: { "x-user-type": "vip" },
  });

  assert.equal(vipResult.targetId, "target_vip");
});

test("TrafficRoutingService updates target weight", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_007",
    name: "update_weight_route",
    targets: [
      { targetId: "target_1", weight: 80 },
      { targetId: "target_2", weight: 20 },
    ],
    rules: [],
    strategy: "weighted",
  });

  const updated = service.updateTargetWeight(route.routeId, "target_1", 60);

  const target = updated.targets.find((t) => t.targetId === "target_1");
  assert.equal(target?.weight, 60);
});

test("TrafficRoutingService deactivates route", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_008",
    name: "deactivate_route",
    targets: [{ targetId: "target_1", weight: 100 }],
    rules: [],
    strategy: "weighted",
  });

  const deactivated = service.deactivateRoute(route.routeId);

  assert.equal(deactivated.status, "inactive");
});

test("TrafficRoutingService fails over to secondary target", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_009",
    name: "failover_route",
    targets: [
      { targetId: "primary", weight: 100, metadata: { priority: "primary" } },
      { targetId: "secondary", weight: 0, metadata: { priority: "secondary" } },
    ],
    rules: [],
    strategy: "failover",
  });

  const failover = service.initiateFailover(route.routeId, "primary");

  assert.equal(failover.activeTarget, "secondary");
  assert.ok(failover.previousTarget !== undefined);
});

test("TrafficRoutingService calculates canary percentage", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_010",
    name: "canary_route",
    targets: [
      { targetId: "stable", weight: 90 },
      { targetId: "canary", weight: 10 },
    ],
    rules: [],
    strategy: "canary",
  });

  const canaryPercentage = service.getCanaryPercentage(route.routeId);

  assert.equal(canaryPercentage, 10);
});

test("TrafficRoutingService promotes canary to stable", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_011",
    name: "promotion_route",
    targets: [
      { targetId: "stable", weight: 90 },
      { targetId: "canary", weight: 10 },
    ],
    rules: [],
    strategy: "canary",
  });

  const promoted = service.promoteCanary(route.routeId);

  const stable = promoted.targets.find((t) => t.targetId === "stable");
  const canary = promoted.targets.find((t) => t.targetId === "canary");

  assert.equal(stable?.weight, 100);
  assert.equal(canary?.weight, 0);
});

// ============================================================================
// Routing Rule Tests
// ============================================================================

test("RoutingRule matches header criteria", () => {
  const rule: RoutingRule = {
    ruleId: "rule_test",
    matchCriteria: { header: { "x-feature-flag": "enabled" } },
    targetId: "target_1",
    weight: 100,
  };

  const matches = rule.matchCriteria.header !== undefined &&
    rule.matchCriteria.header["x-feature-flag"] === "enabled";

  assert.equal(matches, true);
});

test("RoutingRule matches path criteria", () => {
  const rule: RoutingRule = {
    ruleId: "rule_path",
    matchCriteria: { path: "/api/v1/*" },
    targetId: "target_api",
    weight: 100,
  };

  assert.ok(rule.matchCriteria.path !== undefined);
});

test("RoutingRule supports multiple match criteria", () => {
  const rule: RoutingRule = {
    ruleId: "rule_multi",
    matchCriteria: {
      header: { "x-region": "eu" },
      path: "/api/*",
    },
    targetId: "target_eu_api",
    weight: 100,
  };

  assert.ok(rule.matchCriteria.header !== undefined);
  assert.ok(rule.matchCriteria.path !== undefined);
});

// ============================================================================
// Route Target Tests
// ============================================================================

test("RouteTarget has required fields", () => {
  const target: RouteTarget = {
    targetId: "target_required",
    weight: 100,
  };

  assert.equal(target.targetId, "target_required");
  assert.equal(target.weight, 100);
});

test("RouteTarget can have metadata", () => {
  const target: RouteTarget = {
    targetId: "target_meta",
    weight: 100,
    metadata: {
      region: "us-east-1",
      version: "v2",
    },
  };

  assert.equal(target.metadata?.region, "us-east-1");
  assert.equal(target.metadata?.version, "v2");
});

// ============================================================================
// Traffic Route Structure Tests
// ============================================================================

test("TrafficRoute has correct structure", () => {
  const route: TrafficRoute = {
    routeId: "route_struct",
    name: "structure_test",
    targets: [{ targetId: "t1", weight: 100 }],
    rules: [],
    strategy: "weighted",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  };

  assert.ok(route.routeId.length > 0);
  assert.ok(route.name.length > 0);
  assert.equal(route.status, "active");
  assert.ok(route.createdAt.length > 0);
});

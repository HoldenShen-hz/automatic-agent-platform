/**
 * Integration Tests: Rollout Controller
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  TrafficRoutingService,
} from "../../../../../src/platform/five-plane-control-plane/rollout-controller/index.js";

// ============================================================================
// Rollout Controller End-to-End Integration Tests
// ============================================================================

test("integration: canary rollout progression", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_canary_001",
    name: "canary_release",
    targets: [
      { targetId: "stable", weight: 100, metadata: { version: "v1.0" } },
      { targetId: "canary", weight: 0, metadata: { version: "v2.0" } },
    ],
    rules: [],
    strategy: "canary",
  });

  const initial = service.getCanaryPercentage(route.routeId);
  assert.equal(initial, 0);

  service.updateTargetWeight(route.routeId, "stable", 90);
  service.updateTargetWeight(route.routeId, "canary", 10);
  const tenPercent = service.getCanaryPercentage(route.routeId);
  assert.equal(tenPercent, 10);

  service.updateTargetWeight(route.routeId, "stable", 50);
  service.updateTargetWeight(route.routeId, "canary", 50);
  const fiftyPercent = service.getCanaryPercentage(route.routeId);
  assert.equal(fiftyPercent, 50);

  const promoted = service.promoteCanary(route.routeId);
  const promotedCanary = promoted.targets.find((t: { targetId: string }) => t.targetId === "canary");
  assert.equal(promotedCanary?.weight, 100);
});

test("integration: weighted routing with failover", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_weighted_001",
    name: "weighted_with_failover",
    targets: [
      { targetId: "primary", weight: 80, metadata: { priority: "primary" } },
      { targetId: "secondary", weight: 20, metadata: { priority: "secondary" } },
    ],
    rules: [],
    strategy: "weighted",
  });

  const results = Array.from({ length: 10 }, () =>
    service.evaluateRoute(route.routeId, {}).targetId,
  );

  const primaryCount = results.filter((id) => id === "primary").length;
  const secondaryCount = results.filter((id) => id === "secondary").length;

  assert.ok(primaryCount > secondaryCount);

  const failover = service.initiateFailover(route.routeId, "primary");
  assert.equal(failover.activeTarget, "secondary");
  assert.equal(failover.previousTarget, "primary");
});

test("integration: rule-based routing with header matching", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_rule_001",
    name: "header_based_routing",
    targets: [
      { targetId: "regular", weight: 100 },
      { targetId: "premium", weight: 100 },
      { targetId: "enterprise", weight: 100 },
    ],
    rules: [
      {
        ruleId: "rule_premium",
        matchCriteria: { header: { "x-user-tier": "premium" } },
        targetId: "premium",
        weight: 100,
      },
      {
        ruleId: "rule_enterprise",
        matchCriteria: { header: { "x-user-tier": "enterprise" } },
        targetId: "enterprise",
        weight: 100,
      },
    ],
    strategy: "rule_based",
  });

  const regularResult = service.evaluateRoute(route.routeId, { headers: { "x-user-tier": "free" } });
  const premiumResult = service.evaluateRoute(route.routeId, { headers: { "x-user-tier": "premium" } });
  const enterpriseResult = service.evaluateRoute(route.routeId, { headers: { "x-user-tier": "enterprise" } });

  assert.equal(regularResult.targetId, "regular");
  assert.equal(premiumResult.targetId, "premium");
  assert.equal(enterpriseResult.targetId, "enterprise");
});

test("integration: gradual rollout with percentage updates", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_gradual_001",
    name: "gradual_rollout",
    targets: [
      { targetId: "old_version", weight: 100 },
      { targetId: "new_version", weight: 0 },
    ],
    rules: [],
    strategy: "gradual",
  });

  const percentages = [5, 10, 25, 50, 75, 100];

  for (const pct of percentages) {
    service.updateTargetWeight(route.routeId, "old_version", 100 - pct);
    service.updateTargetWeight(route.routeId, "new_version", pct);

    const current = service.getCanaryPercentage(route.routeId);
    assert.equal(current, pct);
  }
});

test("integration: route deactivation and reactivation", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_toggle_001",
    name: "toggle_route",
    targets: [{ targetId: "target_1", weight: 100 }],
    rules: [],
    strategy: "weighted",
  });

  const deactivated = service.deactivateRoute(route.routeId);
  assert.equal(deactivated.status, "inactive");

  const reactivated = service.reactivateRoute(route.routeId);
  assert.equal(reactivated.status, "active");
});

test("integration: multiple rules with priority", () => {
  const service = new TrafficRoutingService();

  const route = service.createRoute({
    routeId: "route_multi_001",
    name: "multi_rule_route",
    targets: [
      { targetId: "default", weight: 100 },
      { targetId: "feature_a", weight: 100 },
      { targetId: "feature_b", weight: 100 },
    ],
    rules: [
      {
        ruleId: "rule_a",
        matchCriteria: { header: { "x-feature": "A" } },
        targetId: "feature_a",
        weight: 100,
      },
      {
        ruleId: "rule_b",
        matchCriteria: { header: { "x-feature": "B" } },
        targetId: "feature_b",
        weight: 100,
      },
    ],
    strategy: "rule_based",
  });

  const ruleA = service.evaluateRoute(route.routeId, { headers: { "x-feature": "A" } });
  const ruleB = service.evaluateRoute(route.routeId, { headers: { "x-feature": "B" } });
  const noRule = service.evaluateRoute(route.routeId, {});

  assert.equal(ruleA.targetId, "feature_a");
  assert.equal(ruleB.targetId, "feature_b");
  assert.equal(noRule.targetId, "default");
});

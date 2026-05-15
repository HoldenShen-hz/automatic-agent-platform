import assert from "node:assert/strict";
import test from "node:test";

import {
  CROSS_REGION_DDL,
  type Region,
  type RegionStatus,
  type RegionTopology,
  type RoutingDecision,
  type FailoverPlan,
  type RegionHealthCheck,
  type TrafficWeight,
  type RoutingStrategy,
  type RegionEvaluation,
} from "../../../../../src/platform/five-plane-execution/ha/cross-region-deployment-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tests: DDL and Constants
// ─────────────────────────────────────────────────────────────────────────────

test("CROSS_REGION_DDL is defined and contains required tables", () => {
  assert.ok(CROSS_REGION_DDL.includes("CREATE TABLE IF NOT EXISTS regions"));
  assert.ok(CROSS_REGION_DDL.includes("CREATE TABLE IF NOT EXISTS region_topologies"));
  assert.ok(CROSS_REGION_DDL.includes("CREATE TABLE IF NOT EXISTS traffic_weights"));
  assert.ok(CROSS_REGION_DDL.includes("CREATE TABLE IF NOT EXISTS region_health_checks"));
  assert.ok(CROSS_REGION_DDL.includes("CREATE TABLE IF NOT EXISTS failover_plans"));
});

test("CROSS_REGION_DDL contains required indexes", () => {
  assert.ok(CROSS_REGION_DDL.includes("CREATE INDEX IF NOT EXISTS idx_regions_status"));
  assert.ok(CROSS_REGION_DDL.includes("CREATE INDEX IF NOT EXISTS idx_topologies_active"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

test("RegionStatus type accepts valid values", () => {
  const statuses: RegionStatus[] = ["active", "draining", "failing_over", "offline", "degraded"];

  for (const status of statuses) {
    assert.equal(typeof status, "string");
  }
});

test("RoutingStrategy type accepts valid values", () => {
  const strategies: RoutingStrategy[] = ["latency_based", "weighted", "failover", "geo", "custom"];

  for (const strategy of strategies) {
    assert.equal(typeof strategy, "string");
  }
});

test("Region interface can be constructed", () => {
  const region: Region = {
    regionId: "region-1",
    name: "US East 1",
    endpoint: "https://us-east-1.example.com",
    status: "active",
    priority: 100,
    weight: 100,
    latencyMs: 50,
    healthScore: 100,
    maxConcurrency: 1000,
    currentLoad: 100,
    metadata: null,
    lastHealthCheckAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.equal(region.regionId, "region-1");
  assert.equal(region.status, "active");
  assert.ok(region.healthScore >= 0 && region.healthScore <= 100);
});

test("RegionTopology interface can be constructed", () => {
  const topology: RegionTopology = {
    topologyId: "topo-1",
    name: "Primary",
    description: "Main topology",
    regions: [],
    defaultRoutingStrategy: "latency_based",
    failoverRegionId: null,
    activeRegionId: "region-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.equal(topology.topologyId, "topo-1");
  assert.equal(topology.defaultRoutingStrategy, "latency_based");
});

test("RoutingDecision interface can be constructed", () => {
  const decision: RoutingDecision = {
    selectedRegionId: "region-1",
    routingStrategy: "latency_based",
    reasonCode: "eligible",
    allRegionEvaluations: [],
    fallbackUsed: false,
  };

  assert.equal(decision.selectedRegionId, "region-1");
  assert.equal(decision.fallbackUsed, false);
});

test("RegionEvaluation interface can be constructed", () => {
  const evaluation: RegionEvaluation = {
    regionId: "region-1",
    eligible: true,
    score: 85.5,
    reasonCode: "eligible",
    latencyMs: 50,
    healthScore: 100,
  };

  assert.equal(evaluation.eligible, true);
  assert.ok(evaluation.score !== null);
});

test("TrafficWeight interface can be constructed", () => {
  const weight: TrafficWeight = {
    regionId: "region-1",
    weight: 75,
    effectiveAt: new Date().toISOString(),
    expiresAt: null,
  };

  assert.equal(weight.weight, 75);
});

test("RegionHealthCheck interface can be constructed", () => {
  const check: RegionHealthCheck = {
    checkId: "check-1",
    regionId: "region-1",
    status: "active",
    latencyMs: 45,
    healthScore: 95,
    errorMessage: null,
    checkedAt: new Date().toISOString(),
  };

  assert.equal(check.status, "active");
  assert.ok(check.healthScore >= 0 && check.healthScore <= 100);
});

test("FailoverPlan interface can be constructed", () => {
  const plan: FailoverPlan = {
    planId: "plan-1",
    sourceRegionId: "region-1",
    targetRegionId: "region-2",
    cause: "health_check_failed",
    initiatedAt: new Date().toISOString(),
    completedAt: null,
    status: "pending",
    steps: [],
  };

  assert.equal(plan.cause, "health_check_failed");
  assert.equal(plan.status, "pending");
});

test("FailoverPlan cause type accepts valid values", () => {
  const causes: FailoverPlan["cause"][] = [
    "health_check_failed",
    "manual",
    "load_shedding",
    "network_partition",
  ];

  for (const cause of causes) {
    assert.equal(typeof cause, "string");
  }
});

test("FailoverPlan status type accepts valid values", () => {
  const statuses: FailoverPlan["status"][] = [
    "pending",
    "in_progress",
    "completed",
    "failed",
    "cancelled",
  ];

  for (const status of statuses) {
    assert.equal(typeof status, "string");
  }
});

test("Region health score is validated (0-100 range)", () => {
  const region: Region = {
    regionId: "region-1",
    name: "Test",
    endpoint: "https://test.com",
    status: "active",
    priority: 100,
    weight: 100,
    latencyMs: null,
    healthScore: 50, // Mid-range
    maxConcurrency: 100,
    currentLoad: 0,
    metadata: null,
    lastHealthCheckAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.ok(region.healthScore >= 0 && region.healthScore <= 100);
});

test("Region with null latency is allowed", () => {
  const region: Region = {
    regionId: "region-1",
    name: "Test",
    endpoint: "https://test.com",
    status: "active",
    priority: 100,
    weight: 100,
    latencyMs: null, // Unknown latency
    healthScore: 100,
    maxConcurrency: 100,
    currentLoad: 0,
    metadata: null,
    lastHealthCheckAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.equal(region.latencyMs, null);
});

test("RegionTopology with regions array", () => {
  const region: Region = {
    regionId: "region-1",
    name: "Test",
    endpoint: "https://test.com",
    status: "active",
    priority: 100,
    weight: 100,
    latencyMs: 50,
    healthScore: 100,
    maxConcurrency: 100,
    currentLoad: 0,
    metadata: null,
    lastHealthCheckAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const topology: RegionTopology = {
    topologyId: "topo-1",
    name: "Primary",
    description: "Main topology",
    regions: [region],
    defaultRoutingStrategy: "failover",
    failoverRegionId: "region-2",
    activeRegionId: "region-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.equal(topology.regions.length, 1);
  assert.equal(topology.regions[0]!.regionId, "region-1");
});

test("TrafficWeight with expiration", () => {
  const weight: TrafficWeight = {
    regionId: "region-1",
    weight: 50,
    effectiveAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
  };

  assert.ok(weight.expiresAt !== null);
  assert.ok(new Date(weight.expiresAt!).getTime() > Date.now());
});

test("RoutingDecision with fallback", () => {
  const decision: RoutingDecision = {
    selectedRegionId: "region-1",
    routingStrategy: "weighted",
    reasonCode: "fallback_no_eligible",
    allRegionEvaluations: [],
    fallbackUsed: true,
  };

  assert.equal(decision.fallbackUsed, true);
});

test("RegionEvaluation ineligible with reason", () => {
  const evaluation: RegionEvaluation = {
    regionId: "region-1",
    eligible: false,
    score: null,
    reasonCode: "region_status_offline",
    latencyMs: null,
    healthScore: 0,
  };

  assert.equal(evaluation.eligible, false);
  assert.equal(evaluation.score, null);
  assert.ok(evaluation.reasonCode.length > 0);
});

test("RegionEvaluation at capacity", () => {
  const evaluation: RegionEvaluation = {
    regionId: "region-1",
    eligible: false,
    score: null,
    reasonCode: "at_capacity",
    latencyMs: 100,
    healthScore: 100,
  };

  assert.equal(evaluation.reasonCode, "at_capacity");
});

test("RegionEvaluation health score too low", () => {
  const evaluation: RegionEvaluation = {
    regionId: "region-1",
    eligible: false,
    score: null,
    reasonCode: "health_score_too_low",
    latencyMs: 50,
    healthScore: 30,
  };

  assert.equal(evaluation.reasonCode, "health_score_too_low");
});

test("FailoverPlan with steps", () => {
  const plan: FailoverPlan = {
    planId: "plan-1",
    sourceRegionId: "region-1",
    targetRegionId: "region-2",
    cause: "manual",
    initiatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: "completed",
    steps: [
      {
        stepId: "step-1",
        stepType: "drain_traffic",
        status: "completed",
        completedAt: new Date().toISOString(),
        errorMessage: null,
      },
      {
        stepId: "step-2",
        stepType: "switch_primary",
        status: "completed",
        completedAt: new Date().toISOString(),
        errorMessage: null,
      },
    ],
  };

  assert.equal(plan.steps.length, 2);
  assert.equal(plan.status, "completed");
});

test("FailoverPlan with failed step", () => {
  const plan: FailoverPlan = {
    planId: "plan-1",
    sourceRegionId: "region-1",
    targetRegionId: "region-2",
    cause: "network_partition",
    initiatedAt: new Date().toISOString(),
    completedAt: null,
    status: "failed",
    steps: [
      {
        stepId: "step-1",
        stepType: "drain_traffic",
        status: "completed",
        completedAt: new Date().toISOString(),
        errorMessage: null,
      },
      {
        stepId: "step-2",
        stepType: "verify_target",
        status: "failed",
        completedAt: new Date().toISOString(),
        errorMessage: "Connection timeout",
      },
    ],
  };

  assert.equal(plan.status, "failed");
  const failedStep = plan.steps.find((s) => s.status === "failed");
  assert.ok(failedStep !== undefined);
  assert.equal(failedStep!.errorMessage, "Connection timeout");
});

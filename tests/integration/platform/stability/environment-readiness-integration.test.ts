/**
 * Integration Test: Environment Readiness Orchestration Service
 *
 * Verifies:
 * - Full environment promotion workflow
 * - Component readiness tracking across multiple environments
 * - Drill recording and evaluation
 * - SLO tracking and validation
 * - Resource pool management
 * - Promotion gate evaluation with all required criteria
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EnvironmentReadinessOrchestrationService } from "../../../../src/platform/stability/environment-readiness-orchestration-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Environment Readiness Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("environment readiness: full promotion workflow from dev to canary", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register provider readiness
  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-primary",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "platform-team",
  });

  // Register gateway readiness
  service.upsertReadiness({
    environment: "dev",
    componentType: "gateway",
    componentId: "gateway-primary",
    credentialReady: true,
    secondaryGates: { network_ready: true, webhook_ready: true },
    owner: "networking-team",
  });

  // Record passing drills
  service.recordDrill({
    environment: "dev",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "release-team",
    evidenceRefs: ["evidence/rolling-upgrade-logs.txt"],
  });

  service.recordDrill({
    environment: "dev",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "infra-team",
    evidenceRefs: ["evidence/maintenance-drain-report.json"],
  });

  // Record SLOs
  service.recordSlo({
    environment: "dev",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "sre-team",
  });

  // Record resource pool
  service.upsertResourcePool({
    environment: "dev",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 10,
    availableCapacityUnits: 90,
    queueDepth: 5,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "infra-team",
  });

  // Evaluate promotion
  const report = service.evaluatePromotion({
    environment: "dev",
    targetStatus: "canary",
  });

  assert.equal(report.environment, "dev");
  assert.equal(report.targetStatus, "canary");
  assert.equal(report.verdict, "promote_approved");
  assert.equal(report.blockers.length, 0);
  assert.ok(report.advisories.length === 0);
  assert.equal(report.currentStatus, "canary");

  // Verify summaries
  assert.ok(report.readinessSummaries.length >= 2);
});

test("environment readiness: promotion blocked when component not ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Provider not ready (credentialReady: false)
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-primary",
    credentialReady: false, // Not ready
    owner: "platform-team",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "release-team",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "infra-team",
  });

  service.recordSlo({
    environment: "staging",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "sre-team",
  });

  service.upsertResourcePool({
    environment: "staging",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 10,
    availableCapacityUnits: 90,
    queueDepth: 5,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "infra-team",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockers.length > 0);
  assert.ok(report.blockedComponents.length > 0);
  assert.ok(report.blockers.some((b) => b.includes("not_ready")));
});

test("environment readiness: promotion conditional with partial drill", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-primary",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "platform-team",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "release-team",
  });

  // Partial drill result
  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "partial",
    owner: "infra-team",
  });

  service.recordSlo({
    environment: "staging",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "sre-team",
  });

  service.upsertResourcePool({
    environment: "staging",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 10,
    availableCapacityUnits: 90,
    queueDepth: 5,
    maxQueueDepth: 50,
    failoverReady: false, // Advisory for non-production
    admissionReady: true,
    owner: "infra-team",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  // For canary, partial drill is advisory, and failover not ready is also advisory
  assert.equal(report.verdict, "conditional");
  assert.ok(report.advisories.length > 0);
});

test("environment readiness: production_ready requires all component types", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // All required component types for production_ready
  const componentTypes: Array<"provider" | "gateway" | "sandbox" | "worker_fleet" | "artifact_store" | "notification_channel" | "external_service"> = [
    "provider",
    "gateway",
    "sandbox",
    "worker_fleet",
    "artifact_store",
    "notification_channel",
    "external_service",
  ];

  for (const componentType of componentTypes) {
    service.upsertReadiness({
      environment: "prod",
      componentType,
      componentId: `${componentType}-1`,
      credentialReady: true,
      secondaryGates: { network_ready: true },
      owner: "platform-team",
      isActive: true,
    });
  }

  // All required drills
  const drillTypes: Array<"backup_restore" | "rolling_upgrade" | "maintenance_drain" | "tenant_gray_rollout" | "regional_failover" | "worker_reassignment" | "queue_repair"> = [
    "backup_restore",
    "rolling_upgrade",
    "maintenance_drain",
    "tenant_gray_rollout",
    "regional_failover",
    "worker_reassignment",
    "queue_repair",
  ];

  for (const drillType of drillTypes) {
    service.recordDrill({
      environment: "prod",
      drillType,
      status: "passed",
      owner: "release-team",
    });
  }

  // All required SLOs
  service.recordSlo({
    environment: "prod",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.99,
    observed: 0.995,
    owner: "sre-team",
  });

  service.recordSlo({
    environment: "prod",
    metric: "task_start_latency",
    comparator: "max",
    target: 5000,
    observed: 2000,
    unit: "ms",
    owner: "sre-team",
  });

  service.recordSlo({
    environment: "prod",
    metric: "recovery_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "sre-team",
  });

  service.recordSlo({
    environment: "prod",
    metric: "approval_delivery_availability",
    comparator: "min",
    target: 0.999,
    observed: 0.9999,
    owner: "sre-team",
  });

  service.recordSlo({
    environment: "prod",
    metric: "tier1_event_delivery_latency",
    comparator: "max",
    target: 1000,
    observed: 200,
    unit: "ms",
    owner: "sre-team",
  });

  // Resource pool with failover ready
  service.upsertResourcePool({
    environment: "prod",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 10,
    availableCapacityUnits: 90,
    queueDepth: 5,
    maxQueueDepth: 50,
    failoverReady: true, // Required for production_ready
    admissionReady: true,
    owner: "infra-team",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "production_ready",
  });

  assert.equal(report.verdict, "promote_approved");
  assert.equal(report.blockers.length, 0);
  assert.equal(report.advisories.length, 0);
  assert.equal(report.currentStatus, "production_ready");
});

test("environment readiness: summarizeEnvironment tracks stale records", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Fresh record
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-fresh",
    credentialReady: true,
    owner: "team",
    lastVerifiedAt: new Date().toISOString(),
    isActive: true,
  });

  // Stale record (verified 48 hours ago, stale after 24 hours)
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-stale",
    credentialReady: true,
    owner: "team",
    lastVerifiedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    isActive: true,
  });

  const summaries = service.summarizeEnvironment({
    environment: "staging",
    staleAfterHours: 24,
  });

  const providerSummary = summaries.find((s) => s.componentType === "provider");
  assert.ok(providerSummary);
  assert.equal(providerSummary!.total, 2);
  assert.equal(providerSummary!.ready, 2);
  assert.equal(providerSummary!.stale, 1);
  assert.equal(providerSummary!.allReady, false); // Has stale record
});

test("environment readiness: listReadiness filters by environment", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "dev-provider",
    credentialReady: true,
    owner: "team",
  });

  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "prod-provider",
    credentialReady: true,
    owner: "team",
  });

  const devRecords = service.listReadiness("dev");
  const prodRecords = service.listReadiness("prod");
  const allRecords = service.listReadiness();

  assert.equal(devRecords.length, 1);
  assert.equal(devRecords[0]!.environment, "dev");
  assert.equal(prodRecords.length, 1);
  assert.equal(prodRecords[0]!.environment, "prod");
  assert.equal(allRecords.length, 2);
});

test("environment readiness: upsertReadiness updates existing record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const first = service.upsertReadiness({
    environment: "test",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: false,
    owner: "original-owner",
  });

  const second = service.upsertReadiness({
    environment: "test",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    owner: "updated-owner",
  });

  assert.equal(second.readinessId, first.readinessId);
  assert.equal(second.credentialReady, true);
  assert.equal(second.owner, "updated-owner");
});

test("environment readiness: secondary gates false blocks promotion", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "test",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: false }, // Explicitly false
    owner: "team",
    isActive: true,
  });

  service.recordDrill({
    environment: "test",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team",
  });

  service.recordDrill({
    environment: "test",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team",
  });

  service.recordSlo({
    environment: "test",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "test",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockedComponents.length > 0);
});

test("environment readiness: missing drill blocks promotion", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "test",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });

  // Missing drill
  service.recordDrill({
    environment: "test",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team",
  });
  // maintenance_drain missing

  service.recordSlo({
    environment: "test",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "test",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockers.some((b) => b.includes("missing_drill")));
});

test("environment readiness: evaluatePromotion throws for unknown environment without records", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(
    () =>
      service.evaluatePromotion({
        environment: "prod",
        targetStatus: "canary",
      }),
    /does not have any readiness records/,
  );
});

test("environment readiness: resource pool capacity affects promotion", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });

  service.recordDrill({
    environment: "dev",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team",
  });

  service.recordDrill({
    environment: "dev",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team",
  });

  service.recordSlo({
    environment: "dev",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "team",
  });

  // Pool with no available capacity
  service.upsertResourcePool({
    environment: "dev",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 100,
    availableCapacityUnits: 0,
    queueDepth: 0,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "infra-team",
  });

  const report = service.evaluatePromotion({
    environment: "dev",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockers.some((b) => b.includes("pool_no_capacity")));
});

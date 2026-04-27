/**
 * E2E Environment Readiness Orchestration Tests
 *
 * End-to-end tests for environment readiness tracking, drill recording,
 * SLO monitoring, and promotion evaluation workflows.
 *
 * Coverage:
 * 1. Component readiness registration and tracking
 * 2. Drill recording and status management
 * 3. SLO metric recording and evaluation
 * 4. Resource pool capacity tracking
 * 5. Promotion evaluation with blockers and advisories
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EnvironmentReadinessOrchestrationService } from "../../src/platform/stability/environment-readiness-orchestration-service.js";

// ---------------------------------------------------------------------------
// Test 1: Component Readiness Registration
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: registers provider component as ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const record = service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-us-east-1",
    credentialReady: true,
    secondaryGates: {
      network_ready: true,
      webhook_ready: true,
    },
    owner: "platform-team",
  });

  assert.ok(record.readinessId, "Should have readiness ID");
  assert.equal(record.environment, "prod", "Environment should match");
  assert.equal(record.componentType, "provider", "Component type should match");
  assert.equal(record.credentialReady, true, "Credential should be ready");
  assert.equal(record.isActive, true, "Should be active by default");
  assert.ok(record.lastVerifiedAt, "Should have verification timestamp");
});

test("E2E Environment Readiness: registers multiple components with different types", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const components = [
    { type: "provider" as const, id: "provider-1" },
    { type: "gateway" as const, id: "gateway-1" },
    { type: "sandbox" as const, id: "sandbox-1" },
    { type: "worker_fleet" as const, id: "workers-1" },
    { type: "artifact_store" as const, id: "artifacts-1" },
    { type: "notification_channel" as const, id: "notifications-1" },
    { type: "external_service" as const, id: "external-1" },
  ];

  for (const comp of components) {
    service.upsertReadiness({
      environment: "prod",
      componentType: comp.type,
      componentId: comp.id,
      credentialReady: true,
      secondaryGates: { network_ready: true },
      owner: "platform-team",
    });
  }

  const records = service.listReadiness("prod");
  assert.equal(records.length, 7, "Should have 7 component records");
});

test("E2E Environment Readiness: component with failed secondary gate not ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const record = service.upsertReadiness({
    environment: "staging",
    componentType: "sandbox",
    componentId: "sandbox-staging-1",
    credentialReady: true,
    secondaryGates: {
      network_ready: true,
      webhook_ready: false, // Failed gate
    },
    owner: "sandbox-team",
  });

  const records = service.listReadiness("staging");
  assert.equal(records.length, 1, "Should have one record");

  // The component is NOT ready because secondary gate is false
  const summary = service.summarizeEnvironment({ environment: "staging" });
  const sandboxSummary = summary.find(s => s.componentType === "sandbox");
  assert.equal(sandboxSummary?.notReady, 1, "Should have 1 not ready component");
});

test("E2E Environment Readiness: updates existing readiness record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // First registration
  service.upsertReadiness({
    environment: "test",
    componentType: "provider",
    componentId: "provider-test",
    credentialReady: false,
    owner: "test-team",
  });

  // Update to ready
  service.upsertReadiness({
    environment: "test",
    componentType: "provider",
    componentId: "provider-test",
    credentialReady: true,
    owner: "test-team",
  });

  const records = service.listReadiness("test");
  assert.equal(records.length, 1, "Should still have one record (updated)");
  assert.equal(records[0].credentialReady, true, "Credential should now be ready");
});

// ---------------------------------------------------------------------------
// Test 2: Drill Recording
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: records backup_restore drill as passed", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const drill = service.recordDrill({
    environment: "staging",
    drillType: "backup_restore",
    status: "passed",
    owner: "drill-team",
    evidenceRefs: ["backup-verification-report-1", "restore-verification-report-1"],
  });

  assert.ok(drill.drillId, "Should have drill ID");
  assert.equal(drill.environment, "staging", "Environment should match");
  assert.equal(drill.drillType, "backup_restore", "Drill type should match");
  assert.equal(drill.status, "passed", "Status should be passed");
  assert.equal(drill.evidenceRefs.length, 2, "Should have 2 evidence refs");
});

test("E2E Environment Readiness: records regional_failover drill as partial", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const drill = service.recordDrill({
    environment: "pre-prod",
    drillType: "regional_failover",
    status: "partial",
    owner: "ha-team",
    notes: "Failover time exceeded SLO but within acceptable range",
  });

  assert.equal(drill.status, "partial", "Status should be partial");
  assert.equal(drill.notes, "Failover time exceeded SLO but within acceptable range");
});

test("E2E Environment Readiness: records rolling_upgrade drill as failed", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const drill = service.recordDrill({
    environment: "prod",
    drillType: "rolling_upgrade",
    status: "failed",
    owner: "release-team",
    evidenceRefs: ["upgrade-failure-log-1"],
  });

  assert.equal(drill.status, "failed", "Status should be failed");
});

test("E2E Environment Readiness: updates existing drill record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // First attempt failed
  service.recordDrill({
    environment: "dev",
    drillType: "maintenance_drain",
    status: "failed",
    owner: "devops",
  });

  // Retry passed
  const retry = service.recordDrill({
    environment: "dev",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "devops",
    evidenceRefs: ["success-log-1"],
  });

  assert.equal(retry.status, "passed", "Status should be updated to passed");
});

// ---------------------------------------------------------------------------
// Test 3: SLO Metric Recording
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: records task_success_rate SLO", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const slo = service.recordSlo({
    environment: "prod",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.97,
    unit: "ratio",
    owner: "slo-team",
  });

  assert.ok(slo.sloId, "Should have SLO ID");
  assert.equal(slo.metric, "task_success_rate", "Metric should match");
  assert.equal(slo.target, 0.95, "Target should match");
  assert.equal(slo.observed, 0.97, "Observed should match");
});

test("E2E Environment Readiness: records task_start_latency SLO with max comparator", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const slo = service.recordSlo({
    environment: "prod",
    metric: "task_start_latency",
    comparator: "max",
    target: 5000,
    observed: 3200,
    unit: "ms",
    owner: "latency-team",
  });

  assert.equal(slo.comparator, "max", "Comparator should be max");
  assert.equal(slo.unit, "ms", "Unit should be milliseconds");
});

test("E2E Environment Readiness: SLO passes when min comparator met", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register a component (required for evaluatePromotion)
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-staging",
    credentialReady: true,
    owner: "team",
  });

  service.recordSlo({
    environment: "staging",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.90,
    observed: 0.92,
    unit: "ratio",
    owner: "team",
  });

  // Evaluation should not find SLO breach
  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  const sloFindings = report.sloFindings.filter(f => f.startsWith("breached:"));
  assert.equal(sloFindings.length, 0, "Should not have breached SLOs");
});

test("E2E Environment Readiness: SLO breached when min comparator not met", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register a component (required for evaluatePromotion)
  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-prod",
    credentialReady: true,
    owner: "team",
  });

  service.recordSlo({
    environment: "prod",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.89, // Below target
    unit: "ratio",
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "production_ready",
  });

  const breached = report.sloFindings.filter(f => f.includes("breached"));
  assert.ok(breached.length > 0, "Should detect SLO breach");
  assert.ok(report.blockers.some(b => b.includes("slo_breach")), "Should have SLO breach blocker");
});

// ---------------------------------------------------------------------------
// Test 4: Resource Pool Tracking
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: tracks execution resource pool", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const pool = service.upsertResourcePool({
    environment: "prod",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 20,
    availableCapacityUnits: 80,
    queueDepth: 15,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "capacity-team",
  });

  assert.ok(pool.poolId, "Should have pool ID");
  assert.equal(pool.poolType, "execution", "Pool type should match");
  assert.equal(pool.totalCapacityUnits, 100, "Total capacity should match");
  assert.equal(pool.availableCapacityUnits, 80, "Available should match");
  assert.equal(pool.failoverReady, true, "Should be failover ready");
});

test("E2E Environment Readiness: detects pool with no capacity", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register a component (required for evaluatePromotion)
  service.upsertReadiness({
    environment: "prod",
    componentType: "sandbox",
    componentId: "sandbox-prod",
    credentialReady: true,
    owner: "team",
  });

  service.upsertResourcePool({
    environment: "prod",
    poolType: "sandbox",
    region: "us-east-1",
    totalCapacityUnits: 50,
    reservedCapacityUnits: 50,
    availableCapacityUnits: 0, // Exhausted
    queueDepth: 0,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "capacity-team",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "production_ready",
  });

  assert.ok(report.blockers.some(b => b.includes("pool_no_capacity")), "Should block due to no capacity");
});

test("E2E Environment Readiness: detects queue depth breach", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register a component (required for evaluatePromotion)
  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-prod",
    credentialReady: true,
    owner: "team",
  });

  service.upsertResourcePool({
    environment: "prod",
    poolType: "queue",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 0,
    availableCapacityUnits: 100,
    queueDepth: 75,
    maxQueueDepth: 50, // Exceeded
    failoverReady: true,
    admissionReady: true,
    owner: "queue-team",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "production_ready",
  });

  assert.ok(report.blockers.some(b => b.includes("pool_queue_breach")), "Should block due to queue breach");
});

// ---------------------------------------------------------------------------
// Test 5: Environment Summary
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: summarize environment shows component counts", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Add multiple components
  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    owner: "team",
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-2",
    credentialReady: true,
    owner: "team",
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "gateway",
    componentId: "gateway-1",
    credentialReady: false, // Not ready
    owner: "team",
  });

  const summaries = service.summarizeEnvironment({ environment: "prod" });

  const providerSummary = summaries.find(s => s.componentType === "provider");
  assert.equal(providerSummary?.total, 2, "Provider should have 2 total");
  assert.equal(providerSummary?.ready, 2, "Provider should have 2 ready");
  assert.equal(providerSummary?.notReady, 0, "Provider should have 0 not ready");

  const gatewaySummary = summaries.find(s => s.componentType === "gateway");
  assert.equal(gatewaySummary?.total, 1, "Gateway should have 1 total");
  assert.equal(gatewaySummary?.ready, 0, "Gateway should have 0 ready");
  assert.equal(gatewaySummary?.notReady, 1, "Gateway should have 1 not ready");
});

test("E2E Environment Readiness: allReady true only when all components ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // All components ready
  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-dev",
    credentialReady: true,
    owner: "team",
  });

  const summaries = service.summarizeEnvironment({ environment: "dev" });
  const providerSummary = summaries.find(s => s.componentType === "provider");
  assert.equal(providerSummary?.allReady, true, "Should be all ready");
});

// ---------------------------------------------------------------------------
// Test 6: Promotion Evaluation - Production Ready
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: evaluate promote to production - all requirements met", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register all required component types for production
  const componentTypes = ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store", "notification_channel", "external_service"] as const;
  for (const compType of componentTypes) {
    service.upsertReadiness({
      environment: "staging",
      componentType: compType,
      componentId: `${compType}-1`,
      credentialReady: true,
      secondaryGates: {
        network_ready: true,
        webhook_ready: true,
        moderation_ready: true,
        quota_ready: true,
        attestation_ready: true,
        artifact_namespace_ready: true,
      },
      owner: "team",
    });
  }

  // Record required drills
  const drillTypes = ["backup_restore", "rolling_upgrade", "maintenance_drain", "tenant_gray_rollout", "regional_failover", "worker_reassignment", "queue_repair"] as const;
  for (const drillType of drillTypes) {
    service.recordDrill({
      environment: "staging",
      drillType,
      status: "passed",
      owner: "team",
    });
  }

  // Record required SLOs
  const sloMetrics = [
    { metric: "task_success_rate", comparator: "min" as const, target: 0.95, observed: 0.97 },
    { metric: "task_start_latency", comparator: "max" as const, target: 5000, observed: 3200 },
    { metric: "recovery_success_rate", comparator: "min" as const, target: 0.90, observed: 0.95 },
    { metric: "approval_delivery_availability", comparator: "min" as const, target: 0.99, observed: 0.995 },
    { metric: "tier1_event_delivery_latency", comparator: "max" as const, target: 1000, observed: 800 },
  ];
  for (const slo of sloMetrics) {
    service.recordSlo({
      environment: "staging",
      metric: slo.metric,
      comparator: slo.comparator,
      target: slo.target,
      observed: slo.observed,
      unit: slo.comparator === "max" ? "ms" : "ratio",
      owner: "team",
    });
  }

  // Add healthy resource pools
  service.upsertResourcePool({
    environment: "staging",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 20,
    availableCapacityUnits: 80,
    queueDepth: 10,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "production_ready",
  });

  assert.equal(report.verdict, "promote_approved", "Should be approved for production");
  assert.equal(report.currentStatus, "production_ready", "Should be production ready");
  assert.equal(report.blockers.length, 0, "Should have no blockers");
});

test("E2E Environment Readiness: evaluate promote to production - missing drill blocks", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register components
  service.upsertReadiness({
    environment: "test",
    componentType: "provider",
    componentId: "provider-test",
    credentialReady: true,
    owner: "team",
  });

  // Only record one drill, missing others required for production
  service.recordDrill({
    environment: "test",
    drillType: "backup_restore",
    status: "passed",
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "test",
    targetStatus: "production_ready",
  });

  assert.equal(report.verdict, "promote_blocked", "Should be blocked");
  assert.ok(report.blockers.some(b => b.includes("missing_drill")), "Should have missing drill blocker");
});

test("E2E Environment Readiness: partial drill produces advisory for non-production", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register components
  service.upsertReadiness({
    environment: "pre-prod",
    componentType: "provider",
    componentId: "provider-preprod",
    credentialReady: true,
    owner: "team",
  });

  // Partial drill
  service.recordDrill({
    environment: "pre-prod",
    drillType: "backup_restore",
    status: "partial",
    owner: "team",
  });

  // For non-production target, partial drill is advisory
  const report = service.evaluatePromotion({
    environment: "pre-prod",
    targetStatus: "tenant_gray",
  });

  assert.ok(report.advisories.some(a => a.includes("partial_drill")), "Should have advisory for partial drill");
  assert.ok(!report.blockers.some(b => b.includes("partial_drill")), "Should NOT block for partial drill on non-production");
});

// ---------------------------------------------------------------------------
// Test 7: Promotion Evaluation - Conditional Approval
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: evaluate promotion - blockers and advisories", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register some components but not all
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    owner: "team",
  });
  // Missing gateway, sandbox, etc.

  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team",
  });

  // Drill partial
  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "partial",
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "tenant_gray",
  });

  assert.equal(report.verdict, "promote_blocked", "Should have blockers");
  assert.ok(report.blockers.length > 0, "Should have actual blockers");
});

test("E2E Environment Readiness: generate runbook references for blockers", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Pool queue breach should reference queue_backlog_breach runbook
  service.upsertResourcePool({
    environment: "prod",
    poolType: "queue",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 0,
    availableCapacityUnits: 100,
    queueDepth: 75,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "team",
  });

  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    owner: "team",
  });

  service.recordDrill({
    environment: "prod",
    drillType: "backup_restore",
    status: "passed",
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "production_ready",
  });

  assert.ok(report.runbookRefs.includes("queue_backlog_breach"), "Should reference queue backlog runbook");
});

// ---------------------------------------------------------------------------
// Test 8: Stale Detection
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: detects stale components", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Register component with old verification
  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-stale",
    credentialReady: true,
    owner: "team",
    lastVerifiedAt: "2024-01-01T00:00:00.000Z", // Very old
  });

  const summaries = service.summarizeEnvironment({
    environment: "prod",
    staleAfterHours: 24, // Consider stale after 24 hours
    asOf: "2024-01-02T12:00:00.000Z", // More than 24 hours later
  });

  const providerSummary = summaries.find(s => s.componentType === "provider");
  assert.equal(providerSummary?.stale, 1, "Should have 1 stale component");
  assert.equal(providerSummary?.allReady, false, "Should not be all ready due to staleness");
});

// ---------------------------------------------------------------------------
// Test 9: Edge Cases
// ---------------------------------------------------------------------------

test("E2E Environment Readiness: evaluatePromotion throws for unknown environment", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(
    () => service.evaluatePromotion({
      environment: "prod",
      targetStatus: "production_ready",
    }),
    /does not have any readiness records/i,
    "Should throw for environment without records",
  );
});

test("E2E Environment Readiness: filters readiness by environment", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "prod-provider",
    credentialReady: true,
    owner: "team",
  });

  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "dev-provider",
    credentialReady: true,
    owner: "team",
  });

  const prodRecords = service.listReadiness("prod");
  const devRecords = service.listReadiness("dev");

  assert.equal(prodRecords.length, 1, "Should have 1 prod record");
  assert.equal(devRecords.length, 1, "Should have 1 dev record");
  assert.equal(prodRecords[0].componentId, "prod-provider");
  assert.equal(devRecords[0].componentId, "dev-provider");
});

test("E2E Environment Readiness: listReadiness returns all when no filter", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    owner: "team",
  });

  service.upsertReadiness({
    environment: "dev",
    componentType: "gateway",
    componentId: "gateway-1",
    credentialReady: true,
    owner: "team",
  });

  const allRecords = service.listReadiness();

  assert.equal(allRecords.length, 2, "Should return all records without filter");
});

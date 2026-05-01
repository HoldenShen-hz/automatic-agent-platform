/**
 * Environment Readiness Orchestration Service Tests
 *
 * Tests for the environment readiness service that manages component
 * readiness, drills, SLOs, and environment promotion decisions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EnvironmentReadinessOrchestrationService, type EnvironmentName } from "../../../src/platform/stability/environment-readiness-orchestration-service.js";

test("EnvironmentReadinessOrchestrationService upserts readiness records", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const record = service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "dev-provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true, webhook_ready: true },
    owner: "team-a",
  });

  assert.equal(record.environment, "dev");
  assert.equal(record.componentType, "provider");
  assert.equal(record.componentId, "dev-provider-1");
  assert.equal(record.credentialReady, true);
  assert.ok(record.readinessId.length > 0);
});

test("EnvironmentReadinessOrchestrationService updates existing readiness record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const initial = service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "dev-provider-1",
    credentialReady: true,
    owner: "team-a",
  });

  const updated = service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "dev-provider-1",
    credentialReady: false,
    owner: "team-b",
  });

  assert.equal(updated.readinessId, initial.readinessId, "Should update same record");
  assert.equal(updated.credentialReady, false, "Should update credentialReady");
  assert.equal(updated.owner, "team-b", "Should update owner");
});

test("EnvironmentReadinessOrchestrationService records drills", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const drill = service.recordDrill({
    environment: "staging",
    drillType: "backup_restore",
    status: "passed",
    owner: "team-b",
    evidenceRefs: ["s3://backup/prod-2024-01-01"],
  });

  assert.equal(drill.environment, "staging");
  assert.equal(drill.drillType, "backup_restore");
  assert.equal(drill.status, "passed");
  assert.ok(drill.drillId.length > 0);
});

test("EnvironmentReadinessOrchestrationService records SLO metrics", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const slo = service.recordSlo({
    environment: "prod",
    metric: "task_success_rate",
    comparator: "min",
    target: 95,
    observed: 97,
    unit: "ratio",
    owner: "team-c",
  });

  assert.equal(slo.environment, "prod");
  assert.equal(slo.metric, "task_success_rate");
  assert.equal(slo.target, 95);
  assert.equal(slo.observed, 97);
  assert.equal(slo.comparator, "min");
});

test("EnvironmentReadinessOrchestrationService upserts resource pools", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const pool = service.upsertResourcePool({
    environment: "prod",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 20,
    availableCapacityUnits: 80,
    queueDepth: 10,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "team-d",
  });

  assert.equal(pool.environment, "prod");
  assert.equal(pool.poolType, "execution");
  assert.equal(pool.region, "us-east-1");
  assert.equal(pool.totalCapacityUnits, 100);
  assert.equal(pool.availableCapacityUnits, 80);
});

test("EnvironmentReadinessOrchestrationService lists readiness by environment", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "dev-provider-1",
    credentialReady: true,
    owner: "team-a",
  });

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "staging-provider-1",
    credentialReady: true,
    owner: "team-a",
  });

  const devRecords = service.listReadiness("dev");
  assert.equal(devRecords.length, 1);
  assert.equal(devRecords[0]?.environment, "dev");

  const allRecords = service.listReadiness();
  assert.equal(allRecords.length, 2);
});

test("EnvironmentReadinessOrchestrationService summarizes environment", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Add ready component
  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team-a",
  });

  // Add not-ready component
  service.upsertReadiness({
    environment: "dev",
    componentType: "gateway",
    componentId: "gateway-1",
    credentialReady: false,
    secondaryGates: { network_ready: false },
    owner: "team-a",
  });

  const summaries = service.summarizeEnvironment({ environment: "dev" });

  assert.ok(summaries.length > 0, "Should have summaries");

  const providerSummary = summaries.find(s => s.componentType === "provider");
  assert.ok(providerSummary, "Should have provider summary");
  assert.equal(providerSummary?.ready, 1, "Provider should have 1 ready");
  assert.equal(providerSummary?.notReady, 0, "Provider should have 0 not ready");
});

test("EnvironmentReadinessOrchestrationService evaluates promotion for canary", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team-a",
  });

  service.recordDrill({
    environment: "dev",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team-a",
  });

  service.recordDrill({
    environment: "dev",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team-a",
  });

  const report = service.evaluatePromotion({
    environment: "dev",
    targetStatus: "canary",
  });

  assert.ok(report.reportId.length > 0);
  assert.equal(report.environment, "dev");
  assert.ok(report.blockers.length >= 0, "Should have blockers array");
  assert.ok(report.advisories.length >= 0, "Should have advisories array");
});

test("EnvironmentReadinessOrchestrationService throws when evaluating promotion with no records", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(() => {
    service.evaluatePromotion({
      environment: "prod",
      targetStatus: "canary",
    });
  }, /does not have any readiness records/i);
});

test("EnvironmentReadinessOrchestrationService promotes blocked when component not ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: false, // Not ready
    secondaryGates: { network_ready: false },
    owner: "team-a",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team-a",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team-a",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "promote_blocked", "Should be blocked when component not ready");
  assert.ok(report.blockers.length > 0, "Should have blockers");
});

test("EnvironmentReadinessOrchestrationService uses SLO comparator correctly", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Add readiness record first (required for evaluatePromotion)
  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team-a",
  });

  // Add required drills for canary target
  service.recordDrill({
    environment: "dev",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team-a",
  });

  service.recordDrill({
    environment: "dev",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team-a",
  });

  // Min comparator: observed >= target passes
  service.recordSlo({
    environment: "dev",
    metric: "task_success_rate",
    comparator: "min",
    target: 95,
    observed: 97,
    owner: "team-a",
  });

  const report = service.evaluatePromotion({
    environment: "dev",
    targetStatus: "canary",
  });

  // Should not have slo_breach blocker
  const sloBreachBlockers = report.blockers.filter(b => b.startsWith("slo_breach"));
  assert.equal(sloBreachBlockers.length, 0, "Should not block on passing SLO");
});

test("EnvironmentReadinessOrchestrationService blocks when SLO breached", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team-a",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team-a",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team-a",
  });

  service.recordSlo({
    environment: "staging",
    metric: "task_success_rate",
    comparator: "min",
    target: 95,
    observed: 80, // Below target
    owner: "team-a",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "production_ready",
  });

  assert.ok(report.blockers.some(b => b.includes("slo_breach")), "Should have SLO breach blocker");
});

test("EnvironmentReadinessOrchestrationService requires drills for production_ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true, webhook_ready: true, moderation_ready: true },
    owner: "team-a",
  });

  // Missing required drills for production_ready
  service.recordDrill({
    environment: "prod",
    drillType: "backup_restore",
    status: "failed",
    owner: "team-a",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "production_ready",
  });

  assert.ok(report.blockers.length > 0, "Should have blockers for missing/failed drills");
});

test("EnvironmentReadinessOrchestrationService resource pool findings", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team-a",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team-a",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team-a",
  });

  // Add resource pool that is not admission ready
  service.upsertResourcePool({
    environment: "staging",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 20,
    availableCapacityUnits: 0, // No capacity
    queueDepth: 10,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: false, // Not ready
    owner: "team-a",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  assert.ok(report.resourcePoolFindings.some(f => f.includes("admission_blocked")), "Should detect admission not ready");
});

test("EnvironmentReadinessOrchestrationService normalizes required strings", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(() => {
    service.upsertReadiness({
      environment: "dev",
      componentType: "provider",
      componentId: "   ", // Empty after trim
      credentialReady: true,
      owner: "team",
    });
  }, /must be non-empty/i);
});

test("EnvironmentReadinessOrchestrationService normalizes optional strings", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const record = service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    owner: "team",
    notes: "   ", // Empty after trim becomes null
  });

  assert.equal(record.notes, null, "Empty notes should become null");
});

test("EnvironmentReadinessOrchestrationService dedupes evidence refs", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const drill = service.recordDrill({
    environment: "dev",
    drillType: "backup_restore",
    status: "passed",
    owner: "team",
    evidenceRefs: ["ref-1", "ref-2", "ref-1", "ref-3"], // Duplicates
  });

  assert.equal(drill.evidenceRefs.length, 3, "Should dedupe to 3 unique refs");
});

test("EnvironmentReadinessOrchestrationService throws on negative target", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(() => {
    service.recordSlo({
      environment: "dev",
      metric: "task_success_rate",
      comparator: "min",
      target: -5, // Negative should throw
      observed: 90,
      owner: "team",
    });
  }, /must be non-negative/i);
});

test("EnvironmentReadinessOrchestrationService buildRunbookRefs creates runbook links", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: false,
    secondaryGates: { network_ready: false },
    owner: "team-a",
  });

  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "failed",
    owner: "team-a",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  assert.ok(report.runbookRefs.length > 0, "Should have runbook references");
});
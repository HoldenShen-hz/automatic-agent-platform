import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  EnvironmentReadinessOrchestrationService,
} from "../../../../src/platform/stability/environment-readiness-orchestration-service.js";

test("EnvironmentReadinessOrchestrationService.upsertReadiness inserts a new record", () => {
  const service = new EnvironmentReadinessOrchestrationService();
  const outputDir = "/tmp/env-readiness-test-insert";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const record = service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "platform-team",
  });

  assert.ok(record.readinessId);
  assert.equal(record.environment, "dev");
  assert.equal(record.componentType, "provider");
  assert.equal(record.componentId, "provider-1");
  assert.equal(record.credentialReady, true);
  assert.deepEqual(record.secondaryGates, { network_ready: true });
  assert.equal(record.owner, "platform-team");
  assert.ok(record.lastVerifiedAt);
  assert.equal(record.isActive, true);
});

test("EnvironmentReadinessOrchestrationService.upsertReadiness updates existing record by key", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const first = service.upsertReadiness({
    environment: "staging",
    componentType: "gateway",
    componentId: "gateway-1",
    credentialReady: false,
    owner: "networking-team",
  });

  const second = service.upsertReadiness({
    environment: "staging",
    componentType: "gateway",
    componentId: "gateway-1",
    credentialReady: true,
    owner: "networking-team-updated",
  });

  assert.equal(second.readinessId, first.readinessId);
  assert.equal(second.credentialReady, true);
  assert.equal(second.owner, "networking-team-updated");
});

test("EnvironmentReadinessOrchestrationService.recordDrill creates a drill record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const drill = service.recordDrill({
    environment: "prod",
    drillType: "backup_restore",
    status: "passed",
    owner: "recovery-team",
    evidenceRefs: ["evidence-1", "evidence-2"],
  });

  assert.ok(drill.drillId);
  assert.equal(drill.environment, "prod");
  assert.equal(drill.drillType, "backup_restore");
  assert.equal(drill.status, "passed");
  assert.equal(drill.owner, "recovery-team");
  assert.deepEqual(drill.evidenceRefs, ["evidence-1", "evidence-2"]);
});

test("EnvironmentReadinessOrchestrationService.recordDrill deduplicates evidence refs", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const drill = service.recordDrill({
    environment: "prod",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "release-team",
    evidenceRefs: ["evidence-1", "evidence-1", "evidence-2"],
  });

  assert.deepEqual(drill.evidenceRefs, ["evidence-1", "evidence-2"]);
});

test("EnvironmentReadinessOrchestrationService.recordSlo creates an SLO record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const slo = service.recordSlo({
    environment: "prod",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.99,
    observed: 0.995,
    unit: "ratio",
    owner: "sre-team",
  });

  assert.ok(slo.sloId);
  assert.equal(slo.environment, "prod");
  assert.equal(slo.metric, "task_success_rate");
  assert.equal(slo.comparator, "min");
  assert.equal(slo.target, 0.99);
  assert.equal(slo.observed, 0.995);
  assert.equal(slo.unit, "ratio");
});

test("EnvironmentReadinessOrchestrationService.recordSlo rejects non-finite values", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(() => {
    service.recordSlo({
      environment: "prod",
      metric: "task_success_rate",
      comparator: "min",
      target: Infinity,
      observed: 0.995,
      owner: "sre-team",
    });
  }, /target.*must be finite/);

  assert.throws(() => {
    service.recordSlo({
      environment: "prod",
      metric: "task_success_rate",
      comparator: "min",
      target: 0.99,
      observed: NaN,
      owner: "sre-team",
    });
  }, /observed.*must be finite/);
});

test("EnvironmentReadinessOrchestrationService.recordSlo rejects negative target for ratio unit", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(() => {
    service.recordSlo({
      environment: "prod",
      metric: "task_success_rate",
      comparator: "min",
      target: -0.1,
      observed: 0.99,
      owner: "sre-team",
    });
  }, /target.*must be non-negative/);
});

test("EnvironmentReadinessOrchestrationService.upsertResourcePool creates a resource pool record", () => {
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
    owner: "infra-team",
  });

  assert.ok(pool.poolId);
  assert.equal(pool.environment, "prod");
  assert.equal(pool.poolType, "execution");
  assert.equal(pool.region, "us-east-1");
  assert.equal(pool.totalCapacityUnits, 100);
  assert.equal(pool.reservedCapacityUnits, 20);
  assert.equal(pool.availableCapacityUnits, 80);
  assert.equal(pool.queueDepth, 10);
  assert.equal(pool.maxQueueDepth, 50);
  assert.equal(pool.failoverReady, true);
  assert.equal(pool.admissionReady, true);
});

test("EnvironmentReadinessOrchestrationService.listReadiness returns all records when no filter", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "dev",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    owner: "team",
  });
  service.upsertReadiness({
    environment: "staging",
    componentType: "gateway",
    componentId: "gateway-1",
    credentialReady: true,
    owner: "team",
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "worker_fleet",
    componentId: "workers-1",
    credentialReady: true,
    owner: "team",
  });

  const all = service.listReadiness();
  assert.equal(all.length, 3);
});

test("EnvironmentReadinessOrchestrationService.listReadiness filters by environment", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "dev",
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

  const devRecords = service.listReadiness("dev");
  assert.equal(devRecords.length, 1);
  assert.equal(devRecords[0]!.environment, "dev");

  const prodRecords = service.listReadiness("prod");
  assert.equal(prodRecords.length, 1);
  assert.equal(prodRecords[0]!.environment, "prod");
});

test("EnvironmentReadinessOrchestrationService.summarizeEnvironment returns per-component-type summaries", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Ready provider
  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true, webhook_ready: true },
    owner: "team",
    isActive: true,
  });
  // Not-ready provider (credential not ready)
  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-2",
    credentialReady: false,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });
  // Ready gateway
  service.upsertReadiness({
    environment: "prod",
    componentType: "gateway",
    componentId: "gateway-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });

  const summaries = service.summarizeEnvironment({ environment: "prod" });

  assert.equal(summaries.length, 2);

  const providerSummary = summaries.find((s) => s.componentType === "provider");
  assert.ok(providerSummary);
  assert.equal(providerSummary.total, 2);
  assert.equal(providerSummary.ready, 1);
  assert.equal(providerSummary.notReady, 1);

  const gatewaySummary = summaries.find((s) => s.componentType === "gateway");
  assert.ok(gatewaySummary);
  assert.equal(gatewaySummary.total, 1);
  assert.equal(gatewaySummary.ready, 1);
  assert.equal(gatewaySummary.notReady, 0);
});

test("EnvironmentReadinessOrchestrationService.summarizeEnvironment marks stale records", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Recently verified record
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-fresh",
    credentialReady: true,
    owner: "team",
    lastVerifiedAt: new Date().toISOString(),
    isActive: true,
  });
  // Old verified record (stale after 24 hours by default)
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-old",
    credentialReady: true,
    owner: "team",
    lastVerifiedAt: "2020-01-01T00:00:00.000Z",
    isActive: true,
  });

  const summaries = service.summarizeEnvironment({
    environment: "staging",
    staleAfterHours: 24,
  });

  const providerSummary = summaries.find((s) => s.componentType === "provider");
  assert.ok(providerSummary);
  assert.equal(providerSummary.total, 2);
  assert.equal(providerSummary.ready, 2);
  assert.equal(providerSummary.stale, 1);
});

test("EnvironmentReadinessOrchestrationService.summarizeEnvironment allReady is false when stale exists", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "worker_fleet",
    componentId: "workers-1",
    credentialReady: true,
    owner: "team",
    lastVerifiedAt: "2020-01-01T00:00:00.000Z",
    isActive: true,
  });

  const summaries = service.summarizeEnvironment({ environment: "staging" });

  const workerSummary = summaries.find((s) => s.componentType === "worker_fleet");
  assert.ok(workerSummary);
  assert.equal(workerSummary.allReady, false);
});

test("EnvironmentReadinessOrchestrationService.summarizeEnvironment ignores inactive records", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "test",
    componentType: "sandbox",
    componentId: "sandbox-1",
    credentialReady: true,
    owner: "team",
    isActive: true,
  });
  service.upsertReadiness({
    environment: "test",
    componentType: "sandbox",
    componentId: "sandbox-2",
    credentialReady: true,
    owner: "team",
    isActive: false,
  });

  const summaries = service.summarizeEnvironment({ environment: "test" });

  const sandboxSummary = summaries.find((s) => s.componentType === "sandbox");
  assert.ok(sandboxSummary);
  assert.equal(sandboxSummary.total, 1);
});

test("EnvironmentReadinessOrchestrationService.evaluatePromotion throws when no records", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(() => {
    service.evaluatePromotion({
      environment: "prod",
      targetStatus: "canary",
    });
  }, /does not have any readiness records/);
});

test("EnvironmentReadinessOrchestrationService.evaluatePromotion approve when all ready", () => {
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
  service.upsertReadiness({
    environment: "dev",
    componentType: "gateway",
    componentId: "gateway-1",
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
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "dev",
    targetStatus: "canary",
  });

  assert.equal(report.environment, "dev");
  assert.equal(report.targetStatus, "canary");
  assert.equal(report.blockers.length, 0);
  assert.equal(report.verdict, "promote_approved");
});

test("EnvironmentReadinessOrchestrationService.evaluatePromotion blocks when component not ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: false, // Not ready
    owner: "team",
    isActive: true,
  });
  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team",
  });
  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team",
  });
  service.recordSlo({
    environment: "staging",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  assert.ok(report.blockers.length > 0);
  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockers.some((b) => b.includes("not_ready")));
});

test("EnvironmentReadinessOrchestrationService.evaluatePromotion conditional with advisories", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });
  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team",
  });
  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "partial", // Partial drill result
    owner: "team",
  });
  service.recordSlo({
    environment: "staging",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "team",
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
    failoverReady: false, // Not failover ready
    admissionReady: true,
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  // For canary, partial drill is advisory, and failover not ready is also advisory
  assert.equal(report.verdict, "conditional");
  assert.ok(report.advisories.length > 0);
});

test("EnvironmentReadinessOrchestrationService.evaluatePromotion production_ready requires failover_ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider-1",
    credentialReady: true,
    secondaryGates: { network_ready: true, webhook_ready: true, moderation_ready: true, quota_ready: true, attestation_ready: true, artifact_namespace_ready: true },
    owner: "team",
    isActive: true,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "gateway",
    componentId: "gateway-1",
    credentialReady: true,
    secondaryGates: { network_ready: true, webhook_ready: true, moderation_ready: true, quota_ready: true, attestation_ready: true, artifact_namespace_ready: true },
    owner: "team",
    isActive: true,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "sandbox",
    componentId: "sandbox-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "worker_fleet",
    componentId: "workers-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "artifact_store",
    componentId: "artifacts-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "notification_channel",
    componentId: "notifications-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "external_service",
    componentId: "external-1",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "team",
    isActive: true,
  });
  service.recordDrill({
    environment: "prod",
    drillType: "backup_restore",
    status: "passed",
    owner: "team",
  });
  service.recordDrill({
    environment: "prod",
    drillType: "rolling_upgrade",
    status: "passed",
    owner: "team",
  });
  service.recordDrill({
    environment: "prod",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team",
  });
  service.recordDrill({
    environment: "prod",
    drillType: "tenant_gray_rollout",
    status: "passed",
    owner: "team",
  });
  service.recordDrill({
    environment: "prod",
    drillType: "regional_failover",
    status: "passed",
    owner: "team",
  });
  service.recordDrill({
    environment: "prod",
    drillType: "worker_reassignment",
    status: "passed",
    owner: "team",
  });
  service.recordDrill({
    environment: "prod",
    drillType: "queue_repair",
    status: "passed",
    owner: "team",
  });
  service.recordSlo({
    environment: "prod",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.99,
    observed: 0.995,
    owner: "team",
  });
  service.recordSlo({
    environment: "prod",
    metric: "task_start_latency",
    comparator: "max",
    target: 5000,
    observed: 2000,
    unit: "ms",
    owner: "team",
  });
  service.recordSlo({
    environment: "prod",
    metric: "recovery_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "team",
  });
  service.recordSlo({
    environment: "prod",
    metric: "approval_delivery_availability",
    comparator: "min",
    target: 0.999,
    observed: 0.9999,
    owner: "team",
  });
  service.recordSlo({
    environment: "prod",
    metric: "tier1_event_delivery_latency",
    comparator: "max",
    target: 1000,
    observed: 200,
    unit: "ms",
    owner: "team",
  });
  // Pool without failover ready - should block for production_ready
  service.upsertResourcePool({
    environment: "prod",
    poolType: "execution",
    region: "us-east-1",
    totalCapacityUnits: 100,
    reservedCapacityUnits: 10,
    availableCapacityUnits: 90,
    queueDepth: 5,
    maxQueueDepth: 50,
    failoverReady: false, // Missing for production_ready
    admissionReady: true,
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "production_ready",
  });

  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockers.some((b) => b.includes("failover_not_ready")));
});

test("EnvironmentReadinessOrchestrationService evaluatePromotion validates secondary gate false", () => {
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

  const report = service.evaluatePromotion({
    environment: "test",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockedComponents.length > 0);
});

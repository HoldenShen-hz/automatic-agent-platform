/**
 * Environment Readiness Orchestration Service Integration Tests
 *
 * Tests the environment readiness orchestration service which manages
 * component readiness, drills, SLOs, and resource pools for environment promotion.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { EnvironmentReadinessOrchestrationService } from "../../../../src/platform/stability/environment-readiness-orchestration-service.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("environment-readiness: upsertReadiness creates new readiness record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const record = service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "claude_provider",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "platform_team",
  });

  assert.ok(record.readinessId.startsWith("env_ready_"));
  assert.equal(record.environment, "staging");
  assert.equal(record.componentType, "provider");
  assert.equal(record.componentId, "claude_provider");
  assert.equal(record.credentialReady, true);
  assert.deepEqual(record.secondaryGates, { network_ready: true });
  assert.equal(record.owner, "platform_team");
  assert.equal(record.isActive, true);
});

test("environment-readiness: upsertReadiness updates existing record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const first = service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "claude_provider",
    credentialReady: true,
    owner: "team_a",
  });

  const second = service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "claude_provider",
    credentialReady: false,
    owner: "team_b",
  });

  assert.equal(first.readinessId, second.readinessId);
  assert.equal(second.credentialReady, false);
  assert.equal(second.owner, "team_b");
});

test("environment-readiness: listReadiness returns all records when no filter provided", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider_1",
    credentialReady: true,
    owner: "team",
  });

  service.upsertReadiness({
    environment: "prod",
    componentType: "gateway",
    componentId: "gateway_1",
    credentialReady: true,
    owner: "team",
  });

  const all = service.listReadiness();
  assert.equal(all.length, 2);
});

test("environment-readiness: listReadiness filters by environment", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider_1",
    credentialReady: true,
    owner: "team",
  });

  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "provider_2",
    credentialReady: true,
    owner: "team",
  });

  const staging = service.listReadiness("staging");
  assert.equal(staging.length, 1);
  assert.equal(staging[0].environment, "staging");

  const prod = service.listReadiness("prod");
  assert.equal(prod.length, 1);
  assert.equal(prod[0].environment, "prod");
});

test("environment-readiness: recordDrill creates drill record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const drill = service.recordDrill({
    environment: "staging",
    drillType: "backup_restore",
    status: "passed",
    owner: "reliability_team",
    evidenceRefs: ["evidence_1", "evidence_2"],
  });

  assert.ok(drill.drillId.startsWith("env_drill_"));
  assert.equal(drill.environment, "staging");
  assert.equal(drill.drillType, "backup_restore");
  assert.equal(drill.status, "passed");
  assert.deepEqual(drill.evidenceRefs, ["evidence_1", "evidence_2"]);
});

test("environment-readiness: recordSlo creates SLO record", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  const slo = service.recordSlo({
    environment: "prod",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.99,
    observed: 0.995,
    unit: "ratio",
    owner: "sre_team",
  });

  assert.ok(slo.sloId.startsWith("env_slo_"));
  assert.equal(slo.environment, "prod");
  assert.equal(slo.metric, "task_success_rate");
  assert.equal(slo.comparator, "min");
  assert.equal(slo.target, 0.99);
  assert.equal(slo.observed, 0.995);
  assert.equal(slo.unit, "ratio");
});

test("environment-readiness: upsertResourcePool creates resource pool record", () => {
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
    owner: "infra_team",
  });

  assert.ok(pool.poolId.startsWith("env_pool_"));
  assert.equal(pool.environment, "prod");
  assert.equal(pool.poolType, "execution");
  assert.equal(pool.region, "us-east-1");
  assert.equal(pool.totalCapacityUnits, 100);
  assert.equal(pool.availableCapacityUnits, 80);
  assert.equal(pool.failoverReady, true);
});

test("environment-readiness: summarizeEnvironment returns grouped summaries", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Add ready and not-ready components
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider_1",
    credentialReady: true,
    owner: "team",
  });

  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "provider_2",
    credentialReady: false,
    owner: "team",
  });

  const summaries = service.summarizeEnvironment({
    environment: "staging",
    staleAfterHours: 24,
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].componentType, "provider");
  assert.equal(summaries[0].total, 2);
  assert.equal(summaries[0].ready, 1);
  assert.equal(summaries[0].notReady, 1);
});

test("environment-readiness: evaluatePromotion throws when no readiness records exist", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  assert.throws(
    () =>
      service.evaluatePromotion({
        environment: "staging",
        targetStatus: "canary",
      }),
    ValidationError,
  );
});

test("environment-readiness: evaluatePromotion returns promote_approved when all requirements met", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Add required components
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "primary",
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
    isActive: true,
  });

  // Add required drills for canary
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

  // Add required SLO
  service.recordSlo({
    environment: "staging",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "team",
  });

  // Add resource pool
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
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "promote_approved");
  assert.equal(report.blockers.length, 0);
});

test("environment-readiness: evaluatePromotion returns promote_blocked when components not ready", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Add a component that is not ready
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "primary",
    credentialReady: false, // Not ready
    owner: "team",
    isActive: true,
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockers.length > 0);
});

test("environment-readiness: evaluatePromotion returns conditional when blockers are minor", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Add ready components
  service.upsertReadiness({
    environment: "staging",
    componentType: "provider",
    componentId: "primary",
    credentialReady: true,
    owner: "team",
    isActive: true,
  });

  // Add required SLO
  service.recordSlo({
    environment: "staging",
    metric: "task_success_rate",
    comparator: "min",
    target: 0.95,
    observed: 0.98,
    owner: "team",
  });

  // Add drill with partial status (not blocking for canary)
  service.recordDrill({
    environment: "staging",
    drillType: "rolling_upgrade",
    status: "partial",
    owner: "team",
  });

  // Add second required drill with partial status
  service.recordDrill({
    environment: "staging",
    drillType: "maintenance_drain",
    status: "passed",
    owner: "team",
  });

  const report = service.evaluatePromotion({
    environment: "staging",
    targetStatus: "canary",
  });

  assert.equal(report.verdict, "conditional");
  assert.ok(report.advisories.length > 0);
});

test("environment-readiness: evaluatePromotion handles production_ready requiring more components", () => {
  const service = new EnvironmentReadinessOrchestrationService();

  // Add all required components for production_ready
  const requiredComponents: Array<"provider" | "gateway" | "sandbox" | "worker_fleet" | "artifact_store" | "notification_channel" | "external_service"> = [
    "provider",
    "gateway",
    "sandbox",
    "worker_fleet",
    "artifact_store",
    "notification_channel",
    "external_service",
  ];

  for (const componentType of requiredComponents) {
    service.upsertReadiness({
      environment: "prod",
      componentType,
      componentId: `${componentType}_1`,
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
      isActive: true,
    });
  }

  // Add all required drills
  const requiredDrills: Array<"backup_restore" | "rolling_upgrade" | "maintenance_drain" | "tenant_gray_rollout" | "regional_failover" | "worker_reassignment" | "queue_repair"> = [
    "backup_restore",
    "rolling_upgrade",
    "maintenance_drain",
    "tenant_gray_rollout",
    "regional_failover",
    "worker_reassignment",
    "queue_repair",
  ];

  for (const drillType of requiredDrills) {
    service.recordDrill({
      environment: "prod",
      drillType,
      status: "passed",
      owner: "team",
    });
  }

  // Add all required SLOs
  const requiredSlos = ["task_success_rate", "task_start_latency", "recovery_success_rate", "approval_delivery_availability", "tier1_event_delivery_latency"];

  for (const metric of requiredSlos) {
    service.recordSlo({
      environment: "prod",
      metric,
      comparator: "min",
      target: 0.95,
      observed: 0.99,
      owner: "team",
    });
  }

  // Add resource pools
  service.upsertResourcePool({
    environment: "prod",
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
    environment: "prod",
    targetStatus: "production_ready",
  });

  assert.equal(report.targetStatus, "production_ready");
  assert.equal(report.requiredComponentTypes.length, 7);
  assert.equal(report.requiredDrills.length, 7);
});

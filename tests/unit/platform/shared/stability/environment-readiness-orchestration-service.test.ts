import assert from "node:assert/strict";
import test from "node:test";

import { EnvironmentReadinessOrchestrationService } from "../../../../../src/platform/shared/stability/environment-readiness-orchestration-service.js";

function seedBaseline(service: EnvironmentReadinessOrchestrationService): void {
  const verifiedAt = "2026-04-20T00:00:00.000Z";
  service.upsertReadiness({
    environment: "prod",
    componentType: "provider",
    componentId: "openai-primary",
    credentialReady: true,
    secondaryGates: { network_ready: true, quota_ready: true },
    owner: "ml-oncall",
    lastVerifiedAt: verifiedAt,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "gateway",
    componentId: "gateway-main",
    credentialReady: true,
    secondaryGates: { network_ready: true, moderation_ready: true },
    owner: "platform-oncall",
    lastVerifiedAt: verifiedAt,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "sandbox",
    componentId: "sandbox-a",
    credentialReady: true,
    secondaryGates: { attestation_ready: true },
    owner: "runtime-oncall",
    lastVerifiedAt: verifiedAt,
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "worker_fleet",
    componentId: "workers-east",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "runtime-oncall",
    lastVerifiedAt: verifiedAt,
  });
}

test("EnvironmentReadinessOrchestrationService summarizes ready and stale components", () => {
  const service = new EnvironmentReadinessOrchestrationService();
  seedBaseline(service);
  service.upsertReadiness({
    environment: "prod",
    componentType: "gateway",
    componentId: "gateway-stale",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "platform-oncall",
    lastVerifiedAt: "2026-04-18T00:00:00.000Z",
  });

  const summaries = service.summarizeEnvironment({
    environment: "prod",
    staleAfterHours: 24,
    asOf: "2026-04-20T12:00:00.000Z",
  });
  const gateway = summaries.find((item) => item.componentType === "gateway");

  assert.equal(gateway?.total, 2);
  assert.equal(gateway?.ready, 2);
  assert.equal(gateway?.stale, 1);
  assert.equal(gateway?.allReady, false);
});

test("EnvironmentReadinessOrchestrationService blocks production promotion when failover and SLO coverage are missing", () => {
  const service = new EnvironmentReadinessOrchestrationService();
  seedBaseline(service);
  service.upsertReadiness({
    environment: "prod",
    componentType: "artifact_store",
    componentId: "artifact-main",
    credentialReady: true,
    secondaryGates: { artifact_namespace_ready: true },
    owner: "storage-oncall",
    lastVerifiedAt: "2026-04-20T00:00:00.000Z",
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "notification_channel",
    componentId: "pagerduty",
    credentialReady: true,
    secondaryGates: { webhook_ready: true },
    owner: "ops-oncall",
    lastVerifiedAt: "2026-04-20T00:00:00.000Z",
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "external_service",
    componentId: "billing-api",
    credentialReady: true,
    secondaryGates: { network_ready: true },
    owner: "ops-oncall",
    lastVerifiedAt: "2026-04-20T00:00:00.000Z",
  });
  service.recordDrill({ environment: "prod", drillType: "backup_restore", status: "passed", owner: "ops" });
  service.recordDrill({ environment: "prod", drillType: "rolling_upgrade", status: "passed", owner: "ops" });
  service.recordDrill({ environment: "prod", drillType: "maintenance_drain", status: "passed", owner: "ops" });
  service.recordDrill({ environment: "prod", drillType: "tenant_gray_rollout", status: "passed", owner: "ops" });
  service.recordSlo({ environment: "prod", metric: "task_success_rate", comparator: "min", target: 0.99, observed: 0.995, owner: "ops" });
  service.recordSlo({ environment: "prod", metric: "task_start_latency", comparator: "max", target: 5000, observed: 4200, unit: "ms", owner: "ops" });
  service.upsertResourcePool({
    environment: "prod",
    poolType: "execution",
    region: "cn-shanghai",
    totalCapacityUnits: 50,
    reservedCapacityUnits: 10,
    availableCapacityUnits: 8,
    queueDepth: 20,
    maxQueueDepth: 50,
    failoverReady: false,
    admissionReady: true,
    owner: "ops",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "production_ready",
    asOf: "2026-04-20T12:00:00.000Z",
  });

  assert.equal(report.verdict, "promote_blocked");
  assert.ok(report.blockers.includes("missing_drill:regional_failover"));
  assert.ok(report.blockers.includes("missing_slo:recovery_success_rate"));
  assert.ok(report.blockers.includes("pool_failover_not_ready:execution:cn-shanghai"));
  assert.equal(report.currentStatus, "contract_frozen");
});

test("EnvironmentReadinessOrchestrationService approves tenant gray when readiness, drills, SLOs, and pools align", () => {
  const service = new EnvironmentReadinessOrchestrationService();
  seedBaseline(service);
  service.upsertReadiness({
    environment: "prod",
    componentType: "artifact_store",
    componentId: "artifact-main",
    credentialReady: true,
    secondaryGates: { artifact_namespace_ready: true },
    owner: "storage-oncall",
    lastVerifiedAt: "2026-04-20T00:00:00.000Z",
  });
  service.upsertReadiness({
    environment: "prod",
    componentType: "notification_channel",
    componentId: "pagerduty",
    credentialReady: true,
    secondaryGates: { webhook_ready: true },
    owner: "ops-oncall",
    lastVerifiedAt: "2026-04-20T00:00:00.000Z",
  });
  service.recordDrill({ environment: "prod", drillType: "backup_restore", status: "passed", owner: "ops" });
  service.recordDrill({ environment: "prod", drillType: "rolling_upgrade", status: "passed", owner: "ops" });
  service.recordDrill({ environment: "prod", drillType: "maintenance_drain", status: "passed", owner: "ops" });
  service.recordDrill({ environment: "prod", drillType: "tenant_gray_rollout", status: "passed", owner: "ops" });
  service.recordSlo({ environment: "prod", metric: "task_success_rate", comparator: "min", target: 0.98, observed: 0.995, owner: "ops" });
  service.recordSlo({ environment: "prod", metric: "task_start_latency", comparator: "max", target: 5000, observed: 3500, unit: "ms", owner: "ops" });
  service.recordSlo({ environment: "prod", metric: "recovery_success_rate", comparator: "min", target: 0.95, observed: 0.99, owner: "ops" });
  service.recordSlo({ environment: "prod", metric: "rollout_success_rate", comparator: "min", target: 0.95, observed: 0.98, owner: "ops" });
  service.upsertResourcePool({
    environment: "prod",
    poolType: "execution",
    region: "cn-shanghai",
    totalCapacityUnits: 50,
    reservedCapacityUnits: 10,
    availableCapacityUnits: 12,
    queueDepth: 10,
    maxQueueDepth: 50,
    failoverReady: true,
    admissionReady: true,
    owner: "ops",
  });

  const report = service.evaluatePromotion({
    environment: "prod",
    targetStatus: "tenant_gray",
    asOf: "2026-04-20T12:00:00.000Z",
  });

  assert.equal(report.verdict, "promote_approved");
  assert.equal(report.currentStatus, "tenant_gray");
  assert.equal(report.blockers.length, 0);
});

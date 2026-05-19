import assert from "node:assert/strict";
import test from "node:test";
import { EnvironmentReadinessOrchestrationService } from "../../../src/platform/shared/stability/environment-readiness-orchestration-service.js";
test("integration: environment readiness orchestration combines readiness registry, resource pools, drills, and SLOs for production promotion", () => {
    const service = new EnvironmentReadinessOrchestrationService();
    const verifiedAt = "2026-04-20T00:00:00.000Z";
    for (const record of [
        { componentType: "provider", componentId: "openai-primary", gates: { network_ready: true, quota_ready: true }, owner: "ml-oncall" },
        { componentType: "gateway", componentId: "gateway-main", gates: { network_ready: true, moderation_ready: true }, owner: "platform-oncall" },
        { componentType: "sandbox", componentId: "sandbox-prod", gates: { attestation_ready: true }, owner: "runtime-oncall" },
        { componentType: "worker_fleet", componentId: "workers-prod", gates: { network_ready: true }, owner: "runtime-oncall" },
        { componentType: "artifact_store", componentId: "artifact-prod", gates: { artifact_namespace_ready: true }, owner: "storage-oncall" },
        { componentType: "notification_channel", componentId: "pagerduty", gates: { webhook_ready: true }, owner: "ops-oncall" },
        { componentType: "external_service", componentId: "billing-api", gates: { network_ready: true }, owner: "ops-oncall" },
    ]) {
        service.upsertReadiness({
            environment: "prod",
            componentType: record.componentType,
            componentId: record.componentId,
            credentialReady: true,
            secondaryGates: record.gates,
            owner: record.owner,
            lastVerifiedAt: verifiedAt,
        });
    }
    for (const drillType of [
        "backup_restore",
        "rolling_upgrade",
        "maintenance_drain",
        "tenant_gray_rollout",
        "regional_failover",
        "worker_reassignment",
        "queue_repair",
    ]) {
        service.recordDrill({
            environment: "prod",
            drillType,
            status: "passed",
            owner: "ops-oncall",
            evidenceRefs: [`evidence/${drillType}.json`],
        });
    }
    service.recordSlo({ environment: "prod", metric: "task_success_rate", comparator: "min", target: 0.99, observed: 0.997, owner: "ops" });
    service.recordSlo({ environment: "prod", metric: "task_start_latency", comparator: "max", target: 5000, observed: 3200, unit: "ms", owner: "ops" });
    service.recordSlo({ environment: "prod", metric: "recovery_success_rate", comparator: "min", target: 0.96, observed: 0.99, owner: "ops" });
    service.recordSlo({ environment: "prod", metric: "approval_delivery_availability", comparator: "min", target: 0.99, observed: 0.995, owner: "ops" });
    service.recordSlo({ environment: "prod", metric: "tier1_event_delivery_latency", comparator: "max", target: 2000, observed: 900, unit: "ms", owner: "ops" });
    service.upsertResourcePool({
        environment: "prod",
        poolType: "execution",
        region: "cn-shanghai",
        totalCapacityUnits: 100,
        reservedCapacityUnits: 20,
        availableCapacityUnits: 30,
        queueDepth: 40,
        maxQueueDepth: 100,
        failoverReady: true,
        admissionReady: true,
        owner: "ops",
    });
    service.upsertResourcePool({
        environment: "prod",
        poolType: "queue",
        region: "cn-shanghai",
        totalCapacityUnits: 1000,
        reservedCapacityUnits: 200,
        availableCapacityUnits: 400,
        queueDepth: 100,
        maxQueueDepth: 500,
        failoverReady: true,
        admissionReady: true,
        owner: "ops",
    });
    const report = service.evaluatePromotion({
        environment: "prod",
        targetStatus: "production_ready",
        asOf: "2026-04-20T12:00:00.000Z",
    });
    assert.equal(report.verdict, "promote_approved");
    assert.equal(report.currentStatus, "production_ready");
    assert.equal(report.blockers.length, 0);
    assert.equal(report.requiredDrills.length, 7);
    assert.equal(report.readinessSummaries.every((item) => item.allReady), true);
});
//# sourceMappingURL=environment-readiness-orchestration-integration.test.js.map
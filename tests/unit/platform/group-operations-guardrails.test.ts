import assert from "node:assert/strict";
import test from "node:test";

import { compareAutonomyLevels } from "../../../src/interaction/autonomy/level-manager/index.js";
import { assessPromotion } from "../../../src/interaction/autonomy/promotion-engine/index.js";
import { ComplianceEvidenceCollector } from "../../../src/org-governance/compliance-engine/evidence-collector.js";
import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import type { GovernanceDelegation } from "../../../src/org-governance/delegated-governance/delegation-registry/index.js";
import {
  ChineseWallAccessSaga,
} from "../../../src/org-governance/knowledge-boundary/chinese-wall-access-saga.js";
import { ScimProvisionService } from "../../../src/org-governance/sso-scim/scim-sync/scim-service.js";
import {
  CDCReplicationService,
  CdcQueueBackpressureError,
  type CDCReplicationEvent,
} from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";
import { RegionHealthCheckService } from "../../../src/scale-ecosystem/multi-region/region-health-check-service.js";
import { SlaOperationsService } from "../../../src/scale-ecosystem/sla-engine/sla-operations-service.js";

function makeScimUser(userName: string) {
  return {
    userName,
    displayName: userName,
    emails: [{ value: `${userName}@example.com`, primary: true }],
    active: true,
    groups: [],
    name: {
      formatted: userName,
      familyName: userName,
      givenName: userName,
    },
  };
}

test("R27-57 determineStatus uses the current region latency threshold instead of metrics reference equality", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion({
    regionId: "ap-south-1",
    endpoint: "https://region.example.com",
    checkIntervalMs: 1_000,
    timeoutMs: 50,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 5,
      maxErrorRate: 0.2,
      maxCpuUsage: 0.9,
      maxMemoryUsage: 0.9,
    },
  });

  (service as unknown as {
    performHealthCheck: () => Promise<{ metrics: Array<{ metricName: string; value: number; threshold: number; isHealthy: boolean }> }>;
  }).performHealthCheck = async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
    return {
      metrics: [
        { metricName: "latency", value: 6, threshold: 5, isHealthy: false },
        { metricName: "error_rate", value: 0, threshold: 0.2, isHealthy: true },
      ],
    };
  };

  const result = await service.checkRegion("ap-south-1");
  assert.equal(result.status, "degraded");
});

test("R27-58 deleteGroup emits group_deleted and R27-59 removeMemberFromGroup preserves tenant context", () => {
  const service = new ScimProvisionService();
  const user = service.createUser(makeScimUser("alice"), "tenant-r27");
  const group = service.createGroup({ displayName: "ops" }, "tenant-r27");
  service.addMemberToGroup(group.id, user.id, "tenant-r27");

  const beforeRemovalCount = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-r27").length;
  service.removeMemberFromGroup(group.id, user.id);
  const afterRemovalEvents = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-r27");

  assert.equal(afterRemovalEvents.length, beforeRemovalCount + 1);
  assert.equal(afterRemovalEvents[afterRemovalEvents.length - 1]?.action, "group_updated");

  const deleted = service.deleteGroup(group.id, "tenant-r27");
  assert.equal(deleted, true);
  const latestEvent = service.getProvisionEvents("1970-01-01T00:00:00.000Z", "tenant-r27").at(-1);
  assert.equal(latestEvent?.action, "group_deleted");
  assert.equal(latestEvent?.subjectId, group.id);
});

test("R27-60 checkOperation applies inherited org-node guardrails from lineage", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "dlg-r27-60",
      grantorId: "division-admin-1",
      granteeId: "team-lead-9",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: ["finance"],
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [
        {
          guardrailId: "division-budget-cap",
          type: "max_budget",
          value: 1000,
        },
      ],
      expiresAt: "2099-12-31T23:59:59.000Z",
      revocable: true,
      status: "active",
    } satisfies GovernanceDelegation,
  ]);

  const result = service.checkOperation(
    {
      actorId: "team-lead-9",
      actorRole: "division_admin",
      orgNodeId: "team-9",
      orgLineageNodeIds: ["department-3", "division-1"],
      domainId: "finance",
    },
    "approve_budget_increase",
    5_000,
  );

  assert.equal(result.allowed, false);
  assert.deepEqual(result.violatedGuardrails, ["division-budget-cap"]);
});

test("R27-61 compareAutonomyLevels keeps frozen below active autonomy levels", () => {
  assert.ok(compareAutonomyLevels("frozen", "suggestion") < 0);
  assert.ok(compareAutonomyLevels("full_auto", "frozen") > 0);
});

test("R27-62 ChineseWallAccessSaga exposes prepare, commit, compensate, and audit phases", () => {
  const calls: string[] = [];
  const saga = new ChineseWallAccessSaga({
    prepareGrant: () => calls.push("prepare_grant"),
    compensateGrant: () => calls.push("compensate_grant"),
    audit: () => calls.push("audit"),
  });

  const receipt = saga.execute("access-r27-62", [
    { stepId: "prepare-1", action: "prepare_grant", succeeded: true },
    { stepId: "prepare-2", action: "prepare_release", succeeded: false },
    { stepId: "audit-1", action: "audit", succeeded: true },
  ]);

  assert.equal(receipt.status, "rolled_back");
  assert.equal(receipt.rollbackRequired, true);
  assert.ok(receipt.executionLog.some((entry) => entry.outcome === "compensated"));
  assert.ok(calls.includes("prepare_grant"));
  assert.ok(calls.includes("compensate_grant"));
});

test("R27-63 preemptionCapApplied is only true for the selected top-priority tier", () => {
  const service = new SlaOperationsService();
  const lowTier = service.evaluate({
    tiers: [
      { tierId: "gold", displayName: "Gold", priority: 10, preemptionPriority: 10, targetLatencyMs: 100, targetSuccessRate: 0.99, maxQueueWaitMs: 50 },
      { tierId: "silver", displayName: "Silver", priority: 5, preemptionPriority: 1, targetLatencyMs: 200, targetSuccessRate: 0.95, maxQueueWaitMs: 100 },
    ],
    selectedTierId: "silver",
    workflowClass: "deterministic",
    observation: { latencyMs: 50, successRate: 1, queueWaitMs: 10 },
    totalCapacityUnits: 10,
    observedAt: "2026-05-11T00:00:00.000Z",
  });
  const highTier = service.evaluate({
    tiers: [
      { tierId: "gold", displayName: "Gold", priority: 10, preemptionPriority: 10, targetLatencyMs: 100, targetSuccessRate: 0.99, maxQueueWaitMs: 50 },
      { tierId: "silver", displayName: "Silver", priority: 5, preemptionPriority: 1, targetLatencyMs: 200, targetSuccessRate: 0.95, maxQueueWaitMs: 100 },
    ],
    selectedTierId: "gold",
    workflowClass: "deterministic",
    observation: { latencyMs: 50, successRate: 1, queueWaitMs: 10 },
    totalCapacityUnits: 10,
    observedAt: "2026-05-11T00:00:00.000Z",
  });

  assert.equal(lowTier.preemptionCapApplied, false);
  assert.equal(highTier.preemptionCapApplied, true);
});

test("R27-64 assessPromotion blocks exact two failures when success rate is still below threshold", () => {
  const result = assessPromotion({
    capabilityId: "cap-r27-64",
    currentAutonomy: "suggestion",
    trustScore: 0,
    totalExecutions: 60,
    successfulExecutions: 56,
    failedExecutions: 2,
    humanOverrides: 0,
    incidents: 0,
    lastIncidentAgeDays: 120,
  });

  assert.equal(result.shouldPromote, false);
  assert.ok(result.reasonCodes.includes("autonomy.promotion_threshold_not_met"));
});

test("R27-65 ComplianceEvidenceCollector rejects records missing required source or artifact context", () => {
  const collector = new ComplianceEvidenceCollector();

  assert.throws(() => {
    collector.collect({
      frameworkId: "SOC2",
      controlId: "CC1.1",
      artifactRef: "artifact-1",
      source: "",
    } as never);
  }, /compliance_evidence\.source_required/);

  assert.throws(() => {
    collector.collect({
      frameworkId: "SOC2",
      controlId: "CC1.2",
      source: "audit-log",
      artifactRef: "",
    } as never);
  }, /compliance_evidence\.artifact_ref_required/);
});

test("R27-66 CDCReplicationService enforces maxQueueDepth backpressure", () => {
  const service = new CDCReplicationService();
  service.registerReplication({
    sourceRegionId: "cn-shanghai",
    targetRegionId: "us-west",
    batchSize: 1,
    maxQueueDepth: 1,
    replicationIntervalMs: 1_000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 100 },
  });

  const firstEvent: CDCReplicationEvent[] = [{
    id: "evt-1",
    sequence: 1,
    eventType: "task.created",
    taskId: "task-1",
    payloadJson: "{}",
    createdAt: "2026-05-11T00:00:00.000Z",
  }];
  const secondEvent: CDCReplicationEvent[] = [{
    id: "evt-2",
    sequence: 2,
    eventType: "task.created",
    taskId: "task-2",
    payloadJson: "{}",
    createdAt: "2026-05-11T00:00:01.000Z",
  }];

  const batch = service.prepareBatch("cn-shanghai", "us-west", firstEvent);
  assert.ok(batch);
  assert.equal(service.getQueueDepth("cn-shanghai", "us-west"), 1);
  assert.throws(() => {
    service.prepareBatch("cn-shanghai", "us-west", secondEvent);
  }, CdcQueueBackpressureError);
});

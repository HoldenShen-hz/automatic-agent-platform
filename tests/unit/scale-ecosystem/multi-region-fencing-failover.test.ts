import assert from "node:assert/strict";
import test from "node:test";

import { StructuredLogger, type StructuredLogEntry } from "../../../src/platform/shared/observability/structured-logger.js";
import { CDCReplicationService } from "../../../src/scale-ecosystem/multi-region/cdc-replication-service.js";
import { CrossBorderTransferComplianceService } from "../../../src/scale-ecosystem/multi-region/cross-border-transfer-compliance-service.js";
import { DataReplicatorService } from "../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { RegionFailoverController } from "../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import { FailoverReconciliationJob } from "../../../src/scale-ecosystem/multi-region/failover-reconciliation-job.js";
import { RegionHealthCheckService, RegionFailoverOrchestrator } from "../../../src/scale-ecosystem/multi-region/region-health-check-service.js";
import { RegionDescriptorSchema } from "../../../src/scale-ecosystem/multi-region/region-router/index.js";
import { CrossRegionRoutingService } from "../../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import { MarketplaceCatalogEntrySchema } from "../../../src/scale-ecosystem/marketplace/catalog/index.js";
import { choosePreemptionVictim } from "../../../src/scale-ecosystem/resource-manager/preemption/index.js";
import { evaluateMultiDimensionalQuota } from "../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";
import { orderFairQueue } from "../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";
import { FairSchedulingService } from "../../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import { ResourcePoolService } from "../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";
import { SlaTierSchema } from "../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";
import { resetRpoRtoTrackingService } from "../../../src/scale-ecosystem/multi-region/rpo-rto-tracking.js";

test("R15-49 records fencing epoch and rejects stale demoted leader rejoins [multi-region-fencing-failover]", () => {
  const controller = new RegionFailoverController();
  const decision = controller.resolve({
    partitionKey: "orders",
    primaryHealthy: false,
    currentLeaderRegionId: "us-east-1",
    candidateRegionIds: ["us-west-2"],
  });

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.fencingEpoch, 1);
  assert.equal(decision.demotedRegionId, "us-east-1");

  const rejection = controller.rejectRegionJoin({
    partitionKey: "orders",
    regionId: "us-east-1",
    offeredFencingEpoch: 0,
  });
  assert.equal(rejection.accepted, false);
  assert.equal(rejection.mustRejoinAsFollower, true);
});

test("R15-50 failover reconciliation scans all required gap categories [multi-region-fencing-failover]", () => {
  const job = new FailoverReconciliationJob();
  const result = job.runReconciliation({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    promoteEpoch: 2,
    lastCheckpointSequence: 42,
    pendingWriteCount: 2,
    pendingApprovals: [{ approvalId: "ap-1", taskId: "task-1", createdAt: "2026-05-09T00:00:00.000Z" }],
    openBudgets: [{ budgetId: "budget-1", resourceType: "worker", allocatedAmount: 10 }],
    outboxMessages: [{ messageId: "msg-1", createdAt: "2026-05-09T00:00:00.000Z", retryCount: 4 }],
    restrictedWrites: [{ writeId: "write-1", resourceId: "invoice-1", blockedAt: "2026-05-09T00:00:00.000Z" }],
  });

  assert.equal(result.canProceed, false);
  assert.deepEqual(
    [...new Set(result.issues.map((issue) => issue.issueType))].sort(),
    ["open_budget", "outbox_gap", "pending_approval", "restricted_write", "unreplicated_write"],
  );
});

test("R15-51 write routing stays on the partition leader [multi-region-fencing-failover]", () => {
  const service = new CrossRegionRoutingService();
  const decision = service.route({
    regions: [
      RegionDescriptorSchema.parse({
        regionId: "us-east-1",
        provider: "aws",
        endpoints: { api: "https://api.use1.example.com" },
        dataResidencyPolicy: "regional",
        jurisdiction: "US",
        latencyScore: 50,
        residencyAllowed: true,
        isPartitionLeader: false,
      }),
      RegionDescriptorSchema.parse({
        regionId: "us-west-2",
        provider: "aws",
        endpoints: { api: "https://api.usw2.example.com" },
        dataResidencyPolicy: "regional",
        jurisdiction: "US",
        latencyScore: 30,
        residencyAllowed: true,
        isPartitionLeader: true,
      }),
    ],
    policy: {
      policyId: "policy-write",
      allowedJurisdictions: ["US"],
      crossBorderTransferClass: "jurisdiction_approved",
    },
    operationType: "write",
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: true,
  });

  assert.equal(decision.selectedRegionId, "us-west-2");
});

test("R15-52 region descriptor requires provider, endpoints, and data residency policy [multi-region-fencing-failover]", () => {
  const parsed = RegionDescriptorSchema.parse({
    regionId: "ap-southeast-1",
    provider: "aws",
    endpoints: { api: "https://api.aps1.example.com" },
    dataResidencyPolicy: "global",
    jurisdiction: "SG",
  });

  assert.equal(parsed.provider, "aws");
  assert.equal(parsed.endpoints.api, "https://api.aps1.example.com");
  assert.equal(parsed.dataResidencyPolicy, "global");
});

test("R15-53 cross-border transfer chain performs classification, minimization, scanning, and logging [multi-region-fencing-failover]", () => {
  const service = new CrossBorderTransferComplianceService();
  const assessment = service.assessTransfer({
    sourceRegionId: "eu-west-1",
    targetRegionId: "us-east-1",
    sourceJurisdiction: "EU",
    targetJurisdiction: "US",
    dataCategories: ["customer_profile"],
    containsPii: true,
    purpose: "analytics_sync",
    payload: { email: "a@example.com", ssn: "123-45-6789" },
    allowedDataFields: ["email"],
    preferredMechanism: "scc",
  });

  assert.equal(assessment.jurisdictionClassifier.isCrossBorder, true);
  assert.equal(assessment.transferImpactAssessment.riskLevel, "high");
  assert.equal(assessment.mechanismSelection.mechanism, "scc");
  assert.deepEqual(assessment.dataMinimizer.minimizedPayload, { email: "a@example.com" });
  assert.equal(assessment.outputScanner.passed, true);
  assert.equal(service.getTransferLog().length, 1);
});

test("R15-54 data replicator blocks local-only target residency [multi-region-fencing-failover]", () => {
  const service = new DataReplicatorService({
    sourceRegionId: "eu-west-1",
    targetRegionIds: ["us-east-1"],
    policy: {
      sourceRegionId: "eu-west-1",
      targetRegionIds: ["us-east-1"],
      residencyMode: "allowed_cross_border",
    },
    sourceJurisdiction: "EU",
    targetJurisdictions: { "us-east-1": "US" },
    targetDataResidencyPolicies: { "us-east-1": "local_only" },
    transferComplianceService: new CrossBorderTransferComplianceService(),
    batchSize: 10,
    flushIntervalMs: 1_000,
    retryAttempts: 1,
    checksumAlgorithm: "sha256",
  });

  const event = service.recordEvent("us-east-1", "customer_sync", "cust-1", { email: "a@example.com" });
  assert.equal(event, null);
});

test("R15-55 region health checks use a real HTTP HEAD probe [multi-region-fencing-failover]", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string | undefined }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method });
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    const service = new RegionHealthCheckService();
    service.registerRegion({
      regionId: "health-probe",
      endpoint: "https://region.example.com",
      checkIntervalMs: 1_000,
      timeoutMs: 500,
      retryCount: 2,
      thresholds: {
        maxLatencyMs: 1_000,
        maxErrorRate: 0.1,
        maxCpuUsage: 0.9,
        maxMemoryUsage: 0.9,
      },
    });

    await service.checkRegion("health-probe");
    assert.equal(calls[0]?.url, "https://region.example.com/health");
    assert.equal(calls[0]?.method, "HEAD");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R15-56 replication checkpoint stores actual pending count after partial flush failures [multi-region-fencing-failover]", async () => {
  const emitted: string[] = [];
  const service = new DataReplicatorService({
    sourceRegionId: "us-east-1",
    targetRegionIds: ["eu-west-1"],
    policy: {
      sourceRegionId: "us-east-1",
      targetRegionIds: ["eu-west-1"],
      residencyMode: "same_jurisdiction",
    },
    batchSize: 10,
    flushIntervalMs: 1_000,
    retryAttempts: 1,
    checksumAlgorithm: "sha256",
    emit: (_targetRegionId, event) => {
      emitted.push(event.aggregateId);
    },
  });
  service.onEvent("eu-west-1", async (event) => {
    if (event.aggregateId === "fail-2") {
      throw new Error("synthetic replication failure");
    }
  });

  service.recordEvent("eu-west-1", "task", "ok-1", { ok: 1 });
  service.recordEvent("eu-west-1", "task", "fail-2", { ok: 2 });
  service.recordEvent("eu-west-1", "task", "ok-3", { ok: 3 });

  const result = await service.flush("eu-west-1");
  const checkpoint = service.getCheckpoint("eu-west-1");

  assert.equal(result.success, false);
  assert.equal(result.eventsReplicated, 2);
  assert.equal(checkpoint?.pendingCount, 1);
  assert.deepEqual(emitted, ["ok-1", "ok-3"]);
});

test("R15-58 quota evaluation is multi-dimensional [multi-region-fencing-failover]", () => {
  const decision = evaluateMultiDimensionalQuota(
    {
      scope: "tenant",
      workerUnits: { hardLimit: 10, currentUsage: 4 },
      qps: { hardLimit: 100, currentUsage: 60 },
      budgetUsd: { hardLimit: 20, currentUsage: 5 },
    },
    {
      workerUnits: 2,
      qps: 45,
      budgetUsd: 10,
    },
  );

  assert.equal(decision.exceeded, true);
  assert.equal(decision.exceededDimensions.includes("qps"), true);
  assert.equal(decision.remainingByDimension.workerUnits, 4);
});

test("R15-59 preemption requires a recent checkpoint [multi-region-fencing-failover]", () => {
  const recentCheckpoint = Date.now() - 5_000;
  const victim = choosePreemptionVictim([
    { executionId: "no-checkpoint", priority: 1, progressPercent: 10 },
    { executionId: "checkpointed", priority: 1, progressPercent: 20, lastCheckpointTimestampMs: recentCheckpoint },
  ]);

  assert.equal(victim?.executionId, "checkpointed");
});

test("R15-60 fair queue ordering is score-based rather than lexicographic [multi-region-fencing-failover]", () => {
  const ordered = orderFairQueue([
    { itemId: "a-item", tenantId: "tenant-a", priority: 1, ageMs: 1_000, guaranteedQuotaShare: 1, slaTier: 0 },
    { itemId: "z-item", tenantId: "tenant-z", priority: 9, ageMs: 60_000, guaranteedQuotaShare: 3, slaTier: 2 },
  ]);

  assert.equal(ordered[0]?.itemId, "z-item");
});

test("R15-61 marketplace catalog accepts canonical entryId and backfills legacy listingId/packId [multi-region-fencing-failover]", () => {
  const parsed = MarketplaceCatalogEntrySchema.parse({
    entryId: "entry-123",
    title: "Verified Pack",
    rating: 4.7,
    installCount: 128,
    certificationStatus: "platform_certified",
  });

  assert.equal(parsed.entryId, "entry-123");
  assert.equal(parsed.listingId, "entry-123");
  assert.equal(parsed.packId, "entry-123");
  assert.equal(parsed.certificationStatus, "platform_certified");
});

test("R15-65 SLA tier schema carries approval latency, incident response, cost, and support fields [multi-region-fencing-failover]", () => {
  const parsed = SlaTierSchema.parse({
    tierId: "enterprise",
    displayName: "Enterprise",
    priority: 5,
    availability: 0.9995,
    approvalLatencySlo: 600,
    incidentResponseSlo: 300,
    costMultiplier: 2.5,
    supportLevel: "enterprise",
  });

  assert.equal(parsed.availability, 0.9995);
  assert.equal(parsed.approvalLatencySlo, 600);
  assert.equal(parsed.incidentResponseSlo, 300);
  assert.equal(parsed.costMultiplier, 2.5);
  assert.equal(parsed.supportLevel, "enterprise");
});

test("R15-66 CDC service exposes time-based lag monitoring against the 30s SLA [multi-region-fencing-failover]", () => {
  const service = new CDCReplicationService();
  service.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    batchSize: 10,
    replicationIntervalMs: 1_000,
    enabled: true,
    retryPolicy: {
      maxRetries: 1,
      backoffMs: 100,
    },
  });
  const checkpoint = service.getCheckpoint("us-east-1", "eu-west-1");
  assert.ok(checkpoint);
  const eventCreatedAt = new Date(Date.parse(checkpoint.processedAt) + 45_000).toISOString();

  const events = [
    {
      id: "evt-1",
      sequence: 1,
      eventType: "task.updated",
      taskId: "task-1",
      payloadJson: "{}",
      createdAt: eventCreatedAt,
    },
  ];
  const status = service.getReplicationLagStatus("us-east-1", "eu-west-1", events, 30_000);

  assert.equal(status.pendingEvents, 1);
  assert.equal(status.lagMs, 45_000);
  assert.equal(status.withinSlo, false);
});

test("R15-67 failover orchestration records failover history and fencing epoch events [multi-region-fencing-failover]", async () => {
  const orchestrator = new RegionFailoverOrchestrator();
  orchestrator.registerRegion({
    regionId: "us-west-2",
    endpoint: "https://usw2.example.com",
    checkIntervalMs: 1_000,
    timeoutMs: 500,
    retryCount: 2,
    metricSnapshot: { latencyMs: 20, errorRate: 0, cpuUsage: 0.2, memoryUsage: 0.2 },
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.1,
      maxCpuUsage: 0.9,
      maxMemoryUsage: 0.9,
    },
  });
  await orchestrator.getHealthCheckService().checkRegion("us-west-2");

  const result = await orchestrator.orchestrateFailover("us-east-1", ["us-east-1", "us-west-2"]);
  assert.equal(result.success, true);
  assert.equal(orchestrator.getLatestFailoverRecord()?.targetRegionId, "us-west-2");
  assert.equal(orchestrator.getFencingEpoch("us-east-1"), 1);
  assert.deepEqual(
    orchestrator.getFailoverEvents().map((event) => event.eventType),
    ["multi_region.failover_recorded", "multi_region.fencing_epoch_changed"],
  );
});

test("R15-67a CDC replication failure logs carry explicit trace and correlation ids [multi-region-fencing-failover]", () => {
  const captured: StructuredLogEntry[] = [];
  StructuredLogger.addTransport({
    name: "cdc-failure-capture",
    write(entry) {
      captured.push(entry);
    },
  });

  try {
    const service = new CDCReplicationService();
    service.registerReplication({
      sourceRegionId: "us-east-1",
      targetRegionId: "eu-west-1",
      batchSize: 10,
      replicationIntervalMs: 1_000,
      enabled: true,
      retryPolicy: {
        maxRetries: 1,
        backoffMs: 100,
      },
    });
    const batch = service.prepareBatch("us-east-1", "eu-west-1", [
      {
        id: "evt-1",
        sequence: 1,
        eventType: "task.updated",
        taskId: "task-1",
        payloadJson: "{}",
        createdAt: new Date().toISOString(),
      },
    ]);
    assert.ok(batch);

    service.recordFailure("us-east-1", "eu-west-1", batch!, "replica write failed");

    const entry = captured.find((candidate) => candidate.message === "cdc.replication_failed");
    assert.ok(entry);
    assert.equal(typeof entry.traceId, "string");
    assert.equal(typeof entry.correlationId, "string");
    assert.equal(entry.data?.["batchId"], batch!.batchId);
    assert.equal(entry.data?.["errorMessage"], "replica write failed");
  } finally {
    StructuredLogger.removeTransport("cdc-failure-capture");
  }
});

test("R15-67b failover listener errors log explicit trace and correlation ids [multi-region-fencing-failover]", async () => {
  const captured: StructuredLogEntry[] = [];
  StructuredLogger.addTransport({
    name: "failover-log-capture",
    write(entry) {
      captured.push(entry);
    },
  });

  try {
    resetRpoRtoTrackingService();
    const orchestrator = new RegionFailoverOrchestrator();
    orchestrator.registerRegion({
      regionId: "us-west-2",
      endpoint: "https://usw2.example.com",
      checkIntervalMs: 1_000,
      timeoutMs: 500,
      retryCount: 2,
      metricSnapshot: { latencyMs: 20, errorRate: 0, cpuUsage: 0.2, memoryUsage: 0.2 },
      thresholds: {
        maxLatencyMs: 100,
        maxErrorRate: 0.1,
        maxCpuUsage: 0.9,
        maxMemoryUsage: 0.9,
      },
    });
    await orchestrator.getHealthCheckService().checkRegion("us-west-2");
    orchestrator.addFailoverListener(() => {
      throw new Error("listener exploded");
    });

    const result = await orchestrator.orchestrateFailover("us-east-1", ["us-east-1", "us-west-2"]);
    assert.equal(result.success, true);

    const entry = captured.find((candidate) => candidate.message === "multi_region.failover_listener_failed");
    assert.ok(entry);
    assert.equal(typeof entry.traceId, "string");
    assert.equal(typeof entry.correlationId, "string");
    assert.equal(entry.data?.["sourceRegionId"], "us-east-1");
    assert.equal(entry.data?.["targetRegionId"], "us-west-2");
    assert.equal(entry.data?.["errorMessage"], "listener exploded");
  } finally {
    resetRpoRtoTrackingService();
    StructuredLogger.removeTransport("failover-log-capture");
  }
});

test("R15-68 fair scheduling enforces per-tenant promotion budgets [multi-region-fencing-failover]", () => {
  const service = new FairSchedulingService();
  const decision = service.schedule({
    quotaPolicy: {
      scope: "tenant",
      workerUnits: { hardLimit: 10, currentUsage: 10 },
    },
    claim: {
      claimId: "claim-1",
      schedulingClass: {
        tenantId: "tenant-1",
        domainId: "sales",
        slaTierId: "gold",
        priority: 5,
      },
      requestedUnits: 1,
    },
    queueItems: [{ itemId: "q-1", tenantId: "tenant-1", priority: 5, ageMs: 60_000 }],
    preemptionCandidates: [
      { executionId: "exec-1", priority: 1, progressPercent: 50, lastCheckpointTimestampMs: Date.now() - 1_000 },
    ],
    promotionBudget: {
      tenantId: "tenant-1",
      maxPromotionsPerHour: 1,
      maxPromotionsPerDay: 2,
      usedPromotionsThisHour: 1,
      usedPromotionsToday: 1,
    },
  });

  assert.equal(decision.promotionBudget.allowed, false);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.reason, "resource_manager.promotion_budget_exhausted");
});

test("R15-69 resource pools carry tenant scope and auto-isolate on high failure rate [multi-region-fencing-failover]", () => {
  const service = new ResourcePoolService();
  service.registerPool({
    poolId: "tenant-pool",
    resourceType: "worker",
    scopeType: "tenant",
    tenantId: "tenant-1",
    organizationId: "org-1",
    capacityUnits: 10,
    allocatedUnits: 0,
    burstUnits: 0,
    failureRateThreshold: 0.3,
    minSampleSize: 20,
    failureRate: 0,
    sampleCount: 0,
    isolationStatus: "active",
  });

  const updated = service.recordHealthObservation("tenant-pool", {
    failureRate: 0.31,
    sampleCount: 20,
  });
  const allocation = service.allocate("tenant-pool", "consumer-1", 1);

  assert.equal(updated.scopeType, "tenant");
  assert.equal(updated.tenantId, "tenant-1");
  assert.equal(updated.isolationStatus, "isolated");
  assert.equal(allocation.granted, false);
  assert.equal(allocation.reasonCodes.includes("resource_pool.isolated"), true);
});

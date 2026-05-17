import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeGovernanceService } from "../../../src/scale-ecosystem/runtime-governance-service.js";
import { FeedbackImprovementService } from "../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";

test("E2E Runtime: RuntimeGovernanceService evaluates connectors, routing, quotas, and SLA together", () => {
  const service = new RuntimeGovernanceService();
  const decision = service.evaluate({
    capability: "task.execute",
    connectors: [{
      connectorId: "connector-1",
      provider: "openai",
      capabilities: ["task.execute"],
      capabilityProfile: {},
      authMode: "api_key",
      rateLimits: {},
      supportedEvents: [],
      lifecycleState: "enabled",
    }],
    connectorHealthReports: [{
      connectorId: "connector-1",
      checkedAt: new Date().toISOString(),
      status: "healthy",
      latencyMs: 20,
    }],
    regions: [
      {
        regionId: "cn-shanghai",
        provider: "local",
        endpoints: { api: "https://cn-shanghai.example.test" },
        dataResidencyPolicy: "regional",
        countryCode: "CN",
        jurisdiction: "CN",
        capabilities: [],
        status: "active",
        latencyScore: 20,
        residencyAllowed: true,
        isPartitionLeader: true,
      },
      {
        regionId: "us-west",
        provider: "remote",
        endpoints: { api: "https://us-west.example.test" },
        dataResidencyPolicy: "regional",
        countryCode: "US",
        jurisdiction: "US",
        capabilities: [],
        status: "active",
        latencyScore: 80,
        residencyAllowed: true,
        isPartitionLeader: false,
      },
    ],
    primaryRegionHealthy: false,
    quotaPolicy: { scope: "tenant", scopeId: "tenant-001", workerUnits: { hardLimit: 10, currentUsage: 2 } },
    requestedUnits: 2,
    queueItems: [
      { itemId: "queue-1", tenantId: "tenant-001", priority: 10, ageMs: 30_000 },
      { itemId: "queue-2", tenantId: "tenant-001", priority: 50, ageMs: 10_000 },
    ],
    preemptionCandidates: [],
    tiers: [
      { tierId: "gold", displayName: "Gold", priority: 10 },
      { tierId: "silver", displayName: "Silver", priority: 1 },
    ],
    reservedCapacityPlan: [{ tierId: "gold", reservedPercent: 30 }, { tierId: "silver", reservedPercent: 20 }],
    totalCapacityUnits: 100,
    observation: { latencyMs: 200, successRate: 0.999, queueWaitMs: 100 },
    commitment: { maxLatencyMs: 500, minSuccessRate: 0.99, maxQueueWaitMs: 1000 },
  });

  assert.equal(decision.connectorId, "connector-1");
  assert.equal(decision.regionId, "cn-shanghai");
  assert.equal(decision.failoverRegionId, "us-west");
  assert.equal(decision.quotaAllowed, true);
  assert.equal(decision.highestTierId, "gold");
  assert.equal(decision.reservedCapacity["gold"], 30);
});

test("E2E Runtime: feedback improvement service builds actionable snapshot", () => {
  const service = new FeedbackImprovementService();
  const ingested = service.ingest({
    taskId: "task-runtime-feedback",
    signals: [
      {
        signalId: "runtime-feedback-1",
        taskId: "task-runtime-feedback",
        source: "user",
        category: "correction",
        severity: "warning",
        payload: { summary: "Prompt should be more explicit", reasonCode: "prompt_gap" },
        stepOutputRefs: ["step-a"],
        timestamp: Date.now(),
        trustFactors: {
          sourceReliability: 1,
          historicalAccuracy: 1,
          authenticatedSource: true,
          attackSurfaceExposure: 0,
          holdoutOverlap: 0,
        },
      },
    ],
  });

  const snapshot = service.buildSnapshot(ingested.feedback.signals);
  assert.ok(snapshot.generatedAt.length > 0);
  assert.ok(snapshot.analysis.totalSignals >= 1);
  assert.ok(snapshot.candidateCount >= ingested.candidates.length);
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ExplanationPipelineService } from "../../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import {
  ChangepointDetectorService,
  type DriftSample,
} from "../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";
import { CrossAgentAnalyzerService } from "../../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";
import {
  EdgeRuntimeSyncService,
  type EdgeRuntimeProfile,
} from "../../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";
import { ChaosExperimentScheduler } from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";
import { TimeTravelDebugService } from "../../../../src/ops-maturity/workflow-debugger/time-travel-debug-service.js";
import {
  RegionFailoverController,
} from "../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import {
  RegionHealthCheckService,
  type RegionHealthCheckConfig,
} from "../../../../src/scale-ecosystem/multi-region/region-health-check-service.js";
import { ReadReplicaService } from "../../../../src/scale-ecosystem/multi-region/read-replica-service.js";
import { CircuitState } from "../../../../src/platform/stability/circuit-breaker.js";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/tenant-platform/tenant-platform-service.js";
import type { Slo } from "../../../../src/platform/contracts/types/slo.js";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function createRegionConfig(overrides: Partial<RegionHealthCheckConfig> = {}): RegionHealthCheckConfig {
  return {
    regionId: overrides.regionId ?? "us-east",
    endpoint: overrides.endpoint ?? "https://us-east.example.com",
    checkIntervalMs: overrides.checkIntervalMs ?? 500,
    timeoutMs: overrides.timeoutMs ?? 10,
    retryCount: overrides.retryCount ?? 3,
    metricSnapshot: overrides.metricSnapshot ?? {
      latencyMs: 10,
      errorRate: 0.01,
      cpuUsage: 0.2,
      memoryUsage: 0.3,
    },
    thresholds: overrides.thresholds ?? {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  };
}

function createEdgeProfile(overrides: Partial<EdgeRuntimeProfile> = {}): EdgeRuntimeProfile {
  return {
    edgeNodeId: overrides.edgeNodeId ?? "edge-node-1",
    deviceId: overrides.deviceId ?? "device-1",
    deviceAttestation: overrides.deviceAttestation ?? {
      attestedAt: "2026-05-01T00:00:00.000Z",
      status: "valid",
    },
    capabilities: overrides.capabilities ?? ["offline-execution", "local-model"],
    connectivityMode: overrides.connectivityMode ?? "offline",
    maxLocalRetentionHours: overrides.maxLocalRetentionHours ?? 24,
    offlineMaxDuration: overrides.offlineMaxDuration ?? 60_000,
    keyLease: overrides.keyLease ?? "lease-1",
    certificateStatus: overrides.certificateStatus ?? "valid",
    allowedModels: overrides.allowedModels ?? ["model-a"],
    deploymentMode: overrides.deploymentMode ?? "edge_standard",
    syncPolicy: overrides.syncPolicy ?? {
      allowRestrictedDataUpload: false,
      requireOrdering: false,
    },
    riskLevel: overrides.riskLevel ?? "low",
  };
}

test("R21-02 and R21-03 wire split-brain fencing validation and failover reconciliation", () => {
  const source = readSource("src/scale-ecosystem/multi-region/failover-controller/index.ts");

  assert.match(source, /getSplitBrainProtectionService/);
  assert.match(source, /getFencingTokenService/);
  assert.match(source, /validateFencingTokenForFailover/);
  assert.match(source, /acquireFencingTokenForFailover/);
  assert.match(source, /FailoverReconciliationJob/);
  assert.match(source, /runReconciliation/);
  assert.match(source, /reconciliationResult/);
});

test("R21-02 and R21-03 failover controller emits reconciliation result and leader-only fencing validation", () => {
  const controller = new RegionFailoverController();

  const decision = controller.resolve({
    primaryHealthy: false,
    currentLeaderRegionId: "region-a",
    candidateRegionIds: ["region-b"],
  });

  assert.equal(decision.shouldFailover, true);
  assert.ok(decision.reconciliationResult);
  assert.equal(decision.reconciliationResult?.targetRegionId, "region-b");

  const token = controller.acquireFencingTokenForFailover("region-b");
  assert.ok(token);
  assert.equal(controller.validateFencingTokenForFailover("region-b", token!), true);
  assert.equal(controller.validateFencingTokenForFailover("region-a", token!), false);
});

test("R21-04 region health service maintains per-region circuit breaker state and reset hooks", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createRegionConfig());

  assert.equal(service.getCircuitBreakerState("us-east"), CircuitState.CLOSED);

  await service.checkRegion("us-east");
  service.resetCircuitBreaker("us-east");

  assert.equal(service.getCircuitBreakerState("us-east"), CircuitState.CLOSED);
});

test("R21-05 read replica service routes reads to followers and waits for read-after-write catchup", async () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica({
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "https://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5_000,
    healthCheckIntervalMs: 30_000,
  });
  service.registerReplica({
    replicaId: "follower",
    regionId: "us-west-2",
    endpoint: "https://follower.example.com",
    isPrimary: false,
    priority: 2,
    maxLagMs: 5_000,
    healthCheckIntervalMs: 30_000,
  });
  service.updateReplicaMetrics("primary", {
    latencyMs: 200,
    healthStatus: "healthy",
  });
  service.updateReplicaMetrics("follower", {
    latencyMs: 20,
    lagMs: 2_000,
    healthStatus: "healthy",
  });

  const routed = service.routeRead({
    operationId: "read-1",
    aggregateType: "task",
    aggregateId: "task-1",
    consistencyLevel: "session",
    routingMode: "nearest",
  });
  assert.equal(routed.selectedReplicaId, "follower");
  assert.equal(routed.waitForReplication, true);

  const waitPromise = service.waitForReadAfterWrite("task-1", ["us-west-2"], 500);
  setTimeout(() => {
    service.updateReplicaMetrics("follower", {
      lagMs: 200,
      healthStatus: "healthy",
    });
  }, 50);

  assert.equal(await waitPromise, true);
});

test("R21-06 RPO/RTO tracking source records lag and failover timing", () => {
  const source = readSource("src/scale-ecosystem/multi-region/rpo-rto-tracking.ts");

  assert.match(source, /recordReplicationLag/);
  assert.match(source, /getCurrentReplicationLag/);
  assert.match(source, /startFailover/);
  assert.match(source, /completeFailover/);
  assert.match(source, /assertSlaCompliance/);
});

test("R21-07 federation module exists with gateway trust delegation and audit components", () => {
  const files = [
    "src/scale-ecosystem/federation/federation-gateway.ts",
    "src/scale-ecosystem/federation/trust-relationship.ts",
    "src/scale-ecosystem/federation/capability-delegation.ts",
    "src/scale-ecosystem/federation/federation-audit.ts",
    "tests/unit/scale-ecosystem/federation.test.ts",
  ];

  for (const file of files) {
    assert.equal(existsSync(join(process.cwd(), file)), true, `${file} should exist`);
  }
});

test("R21-08, R21-09, and R21-10 tenant platform wires quota preemption fair scheduling and tenant SLOs", () => {
  const source = readSource("src/scale-ecosystem/tenant-platform/tenant-platform-service.ts");

  assert.match(source, /FairSchedulingService/);
  assert.match(source, /PreemptionCandidate/);
  assert.match(source, /enforceQuotaWithPreemption/);
  assert.match(source, /defineSlo/);
  assert.match(source, /getSloForTenant/);
  assert.match(source, /evaluateSlo/);
});

test("R21-10 tenant platform exposes per-tenant SLO definition and evaluation", () => {
  const service = new TenantPlatformService(
    { transaction: <T>(fn: () => T) => fn(), filePath: "/tmp/r21-tenant.db" } as any,
    {} as any,
  );
  const slo: Slo = {
    sloId: "slo-latency",
    name: "Latency P95",
    metric: "latencyMs",
    target: 200,
    window: 300_000,
    operator: "<=",
  };

  service.defineSlo("tenant-1", slo);

  assert.deepEqual(service.getSloForTenant("tenant-1"), [slo]);
  assert.equal(service.evaluateSlo("slo-latency", { latencyMs: 180 }), true);
  assert.equal(service.evaluateSlo("slo-latency", { latencyMs: 260 }), false);
});

test("R21-11 explanation pipeline binds versionLockRef on bundle and rationale", () => {
  const service = new ExplanationPipelineService();
  const bundle = service.generate({
    taskId: "task-r21-11",
    stageId: "planning",
    summary: "generated explanation",
    decision: "accept",
    decisionFactors: ["latency"],
    evidence: [],
    riskNotes: [],
  });

  assert.ok(bundle.versionLockRef.startsWith("vlock:"));
  assert.equal(bundle.versionLockRef, bundle.rationale.versionLockRef);
  assert.equal(service.verifyVersionLock(bundle.rationale.rationaleId, bundle.versionLockRef), true);
});

test("R21-12, R21-13, and R21-14 ops-maturity analyzers use multi-window detection and structured peer recommendations", () => {
  const detector = new ChangepointDetectorService({ samplesPerHour: 0.05, minSampleSize: 20 });
  const samples: DriftSample[] = Array.from({ length: 120 }, (_, index) => ({
    observedAt: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
    score: index < 80 ? 1 : 0.7,
    metrics: {
      successRate: index < 80 ? 0.95 : 0.8,
      overrideRate: index < 80 ? 0.02 : 0.08,
      averageCostUsd: index < 80 ? 0.2 : 0.35,
      toolUsageShift: index < 80 ? 0.05 : 0.2,
      incidentCount: index < 80 ? 1 : 3,
    },
  }));
  const defaultWindows = detector.detectAll(samples);
  const advancedWindows = detector.detectAll(samples, ["7d", "30d", "90d"]);

  assert.deepEqual(defaultWindows.map((result) => result.windowType), ["1h", "6h", "24h", "7d"]);
  assert.deepEqual(advancedWindows.map((result) => result.algorithm), ["cusum", "bayesian_online", "kl_js_divergence"]);

  const analyzer = new CrossAgentAnalyzerService();
  const analysis = analyzer.analyze([
    {
      agentId: "agent-a",
      domainId: "support",
      successRate: 0.95,
      averageCostUsd: 0.2,
      averageLatencyMs: 800,
      taskKindDistribution: { real: 2, synthetic: 6, keepalive: 2 },
    },
    {
      agentId: "agent-b",
      domainId: "support",
      successRate: 0.9,
      averageCostUsd: 0.3,
      averageLatencyMs: 1_000,
      taskKindDistribution: { real: 8, synthetic: 1, keepalive: 0 },
    },
  ]);

  assert.equal(analysis.recommendation.action, "anti_gaming_review");
  assert.equal(analysis.alerts[0]?.antiGamingDetected, true);
});

test("R21-15 and R21-16 edge runtime enforces risk gate and performs actual merge resolution", () => {
  const service = new EdgeRuntimeSyncService();
  const profile = createEdgeProfile();

  assert.throws(
    () => service.executeOffline(
      profile,
      [{ modelId: "model-a", modalities: ["text"], maxTokens: 4096 }],
      {
        edgeNodeId: "edge-node-1",
        taskId: "task-risk",
        modality: "text",
        createdAt: new Date().toISOString(),
        riskScore: 0.9,
        taskType: "summarize",
      },
    ),
    /edge_runtime\.risk_score_exceeds_limit/,
  );

  const envelope = service.buildSyncEnvelope(
    profile,
    {
      edgeNodeId: "edge-node-1",
      taskId: "task-sync",
      createdAt: "2026-05-01T00:00:00.000Z",
    } as any,
    "edge-payload",
    1,
    "internal",
    "2026-05-01T00:00:00.000Z",
  );
  const receipt = service.sync(
    profile,
    [envelope],
    { [envelope.recordId]: "cloud-digest" },
    { [envelope.recordId]: "cloud-payload" },
  );

  assert.equal(receipt.decisions[0]?.resolution, "merge");
  assert.ok((receipt.decisions[0]?.mergedPayload ?? "").length > 0);
});

test("R21-17 and R21-18 chaos scheduler executes injected faults and deduplicates steady-state hypotheses", () => {
  let injected = 0;
  const scheduler = new ChaosExperimentScheduler({
    faultExecutor: () => {
      injected += 1;
      return {
        applied: true,
        message: "fault-applied",
      };
    },
  });
  const experiment = scheduler.scheduleExperiment({
    name: "r21-chaos",
    description: "chaos",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 10, durationMs: 1_000, parameters: {} },
    steadyStateHypotheses: [
      { name: "latency_ok", metricName: "latency", tolerance: 100, operator: "lt" },
    ],
    scheduledAt: "2026-05-01T00:00:00.000Z",
    maxDurationMs: 10_000,
  });

  scheduler.startExperiment(experiment.experimentId);
  const injection = scheduler.injectFault(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_ok", 50, true, "ok");
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_ok", 60, true, "still ok");

  assert.equal(injected, 1);
  assert.equal(injection?.applied, true);
  assert.equal(scheduler.getExperiment(experiment.experimentId)?.results.length, 1);
});

test("R21-19 time-travel debugger returns latest variable value per name at a cursor", () => {
  const service = new TimeTravelDebugService();
  service.loadEventStore("exec-r21-19", [
    {
      stepId: "step-1",
      timestamp: "2026-05-01T00:00:00.000Z",
      variables: {
        count: { value: 1 },
        status: { value: "pending" },
      },
      scope: "step",
    },
    {
      stepId: "step-2",
      timestamp: "2026-05-01T00:00:01.000Z",
      variables: {
        count: { value: 2 },
      },
      scope: "loop",
    },
  ]);
  const session = service.createSession("task-r21-19", "exec-r21-19");

  const variables = service.getVariableState(session.sessionId, 1);
  const countValues = variables.filter((item) => item.name === "count");

  assert.equal(countValues.length, 1);
  assert.equal(countValues[0]?.value, 2);
  assert.equal(countValues[0]?.scope, "loop");
});

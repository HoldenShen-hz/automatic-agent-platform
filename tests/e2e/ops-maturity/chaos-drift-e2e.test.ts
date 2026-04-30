/**
 * E2E tests for Chaos + Drift Detection
 *
 * End-to-end scenarios that span multiple modules and
 * test the complete flow from chaos experiments through
 * drift detection to corrective action.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ChaosExperimentScheduler } from "../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";
import { SimpleReflectionEngine } from "../../../src/ops-maturity/drift-detection/reflection-engine.js";
import { SimpleRolloutManager } from "../../../src/ops-maturity/drift-detection/rollout-manager.js";
import { CrossAgentAnalyzerService } from "../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js";
import type { EvidenceRecord } from "../../../src/ops-maturity/drift-detection/evidence-store.js";
import type { ImprovementProposal } from "../../../src/ops-maturity/drift-detection/proposal-engine.js";

function createEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: overrides.id ?? "ev_1",
    taskType: overrides.taskType ?? "tool_execution",
    sessionId: overrides.sessionId ?? "sess_1",
    traceId: overrides.traceId ?? "trace_1",
    success: overrides.success ?? false,
    failureMode: overrides.failureMode ?? "type_error",
    costUsd: overrides.costUsd ?? 0.10,
    latencyMs: overrides.latencyMs ?? 500,
    toolCalls: overrides.toolCalls ?? 5,
    repairRounds: overrides.repairRounds ?? 1,
    rollback: overrides.rollback ?? false,
    createdAt: overrides.createdAt ?? "2026-04-14T00:00:00.000Z",
  };
}

function createProposal(id: string): ImprovementProposal {
  return {
    id,
    title: `Proposal ${id}`,
    description: "Test proposal",
    kind: "tool_routing_rule",
    target: "test_target",
    patch: "test_patch",
    rationale: "test rationale",
    risk: "low",
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * E2E Scenario 1: Chaos experiment reveals system weakness -> drift detected -> proposal generated
 */
test("E2E: Chaos experiment reveals latency issue -> evidence -> reflection -> proposal", async () => {
  // Step 1: Run chaos experiment
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment({
    name: "Database Latency Test",
    description: "Test database under latency injection",
    target: { targetKind: "database", targetId: "main-db", labels: {} },
    fault: { faultType: "latency", intensity: 300, durationMs: 30000, parameters: {} },
    steadyStateHypotheses: [
      { name: "query_latency", metricName: "avg_query_time_ms", tolerance: 100, operator: "lt" },
      { name: "error_rate", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
    ],
    scheduledAt: new Date().toISOString(),
    maxDurationMs: 60000,
    blastRadius: { maxAffectedServices: 1, maxAffectedNodes: 1, maxAffectedPercentage: 5, containedToLabels: null },
    rollbackStrategy: { enabled: true, rollbackOnViolation: true, autoRestoreDurationMs: 5000, notificationsEnabled: true },
  });

  scheduler.startExperiment(experiment.experimentId);

  // Simulate results - latency hypothesis fails
  scheduler.recordSteadyStateResult(experiment.experimentId, "query_latency", 250, false, "Query latency exceeded threshold");
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate", 0.005, true, "Error rate OK");

  const expResult = scheduler.getExperiment(experiment.experimentId);
  assert.equal(expResult!.status, "violated");
  assert.equal(expResult!.autoRollbackTriggered, true);

  // Step 2: Collect evidence from the failure
  const evidence: EvidenceRecord[] = [
    createEvidence({
      id: "ev_chaos_1",
      taskType: "database_query",
      failureMode: "high_latency",
      success: false,
      costUsd: 0.25,
      latencyMs: 250,
      repairRounds: 2,
    }),
    createEvidence({
      id: "ev_chaos_2",
      taskType: "database_query",
      failureMode: "high_latency",
      success: false,
      costUsd: 0.30,
      latencyMs: 280,
      repairRounds: 2,
    }),
  ];

  // Step 3: Generate reflection from evidence
  const engine = new SimpleReflectionEngine();
  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length >= 1);
  const reflection = reflections[0]!;
  assert.ok(reflection.recommendation.length > 0);

  // Step 4: Create improvement proposal based on reflection
  const proposal = createProposal("prop_chaos_1");
  proposal.rationale = reflection.recommendation;
  proposal.evidenceIds = reflection.evidenceIds;

  // Step 5: Evaluate proposal through rollout
  const rolloutManager = new SimpleRolloutManager();
  const record = await rolloutManager.start(proposal, "canary", 5);

  assert.equal(record.proposalId, "prop_chaos_1");
  assert.equal(record.stage, "canary");

  // Verify rollback was recorded
  const rollout = await rolloutManager.getRollout("prop_chaos_1");
  assert.ok(rollout !== null);
});

/**
 * E2E Scenario 2: Multiple chaos experiments across agents reveal cross-agent drift
 */
test("E2E: Multiple agents under chaos -> cross-agent drift detected -> rebalancing recommended", () => {
  // Step 1: Run chaos on multiple agents and collect metrics
  const scheduler = new ChaosExperimentScheduler();

  // Agent 1 - performs well under chaos
  const exp1 = scheduler.scheduleExperiment({
    name: "Agent1 Chaos",
    description: "Test agent 1",
    target: { targetKind: "service", targetId: "agent-1", labels: {} },
    fault: { faultType: "latency", intensity: 100, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [{ name: "success_rate", metricName: "success_rate", tolerance: 0.9, operator: "gt" }],
    scheduledAt: new Date().toISOString(),
    maxDurationMs: 30000,
    blastRadius: { maxAffectedServices: 1, maxAffectedNodes: 1, maxAffectedPercentage: 5, containedToLabels: null },
    rollbackStrategy: { enabled: false, rollbackOnViolation: false, autoRestoreDurationMs: null, notificationsEnabled: false },
  });
  scheduler.startExperiment(exp1.experimentId);
  scheduler.recordSteadyStateResult(exp1.experimentId, "success_rate", 0.95, true, "OK");

  // Agent 2 - performs poorly under same chaos
  const exp2 = scheduler.scheduleExperiment({
    name: "Agent2 Chaos",
    description: "Test agent 2",
    target: { targetKind: "service", targetId: "agent-2", labels: {} },
    fault: { faultType: "latency", intensity: 100, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [{ name: "success_rate", metricName: "success_rate", tolerance: 0.9, operator: "gt" }],
    scheduledAt: new Date().toISOString(),
    maxDurationMs: 30000,
    blastRadius: { maxAffectedServices: 1, maxAffectedNodes: 1, maxAffectedPercentage: 5, containedToLabels: null },
    rollbackStrategy: { enabled: false, rollbackOnViolation: false, autoRestoreDurationMs: null, notificationsEnabled: false },
  });
  scheduler.startExperiment(exp2.experimentId);
  scheduler.recordSteadyStateResult(exp2.experimentId, "success_rate", 0.65, false, "Degraded");

  // Step 2: Build cross-agent metrics from chaos results
  const crossAgentService = new CrossAgentAnalyzerService();
  const metrics = [
    {
      agentId: "agent-1",
      domain: "payments",
      successRate: 0.95,
      averageCostUsd: 0.10,
      averageLatencyMs: 500,
    },
    {
      agentId: "agent-2",
      domain: "payments",
      successRate: 0.65,
      averageCostUsd: 0.35,
      averageLatencyMs: 1800,
    },
  ];

  // Step 3: Analyze for drift
  const result = crossAgentService.analyze(metrics);

  assert.ok(result.bestAgentId === "agent-1");
  assert.ok(result.worstAgentId === "agent-2");
  assert.ok(result.divergenceScore > 0.2);

  // Step 4: Alert generated for drift
  if (result.alerts.length > 0) {
    const alert = result.alerts[0]!;
    assert.ok(alert.divergenceScore > 0);
    assert.ok(alert.agentsInvolved.includes("agent-1"));
    assert.ok(alert.agentsInvolved.includes("agent-2"));
  }

  // Step 5: Recommendation for rebalancing
  assert.equal(result.recommendation, "rebalance_or_rollout_review");
});

/**
 * E2E Scenario 3: Chaos game day with drift detection across multiple experiments
 */
test("E2E: Game day with mixed results -> aggregate drift analysis", async () => {
  const scheduler = new ChaosExperimentScheduler();

  // Set up game day with multiple experiments
  const gameDay = scheduler.scheduleGameDay({
    name: "Monthly Stability GameDay",
    scheduledAt: new Date().toISOString(),
    experiments: [
      {
        name: "Network Resilience",
        description: "Test network partition handling",
        target: { targetKind: "network", targetId: "internal-net", labels: {} },
        fault: { faultType: "packet_loss", intensity: 20, durationMs: 15000, parameters: {} },
        steadyStateHypotheses: [
          { name: "connectivity", metricName: "connection_count", tolerance: 50, operator: "gt" },
        ],
        scheduledAt: new Date().toISOString(),
        maxDurationMs: 30000,
        blastRadius: { maxAffectedServices: 2, maxAffectedNodes: 5, maxAffectedPercentage: 15, containedToLabels: null },
        rollbackStrategy: { enabled: true, rollbackOnViolation: true, autoRestoreDurationMs: null, notificationsEnabled: true },
      },
      {
        name: "Database HA",
        description: "Test database failover",
        target: { targetKind: "database", targetId: "main-db", labels: {} },
        fault: { faultType: "latency", intensity: 500, durationMs: 10000, parameters: {} },
        steadyStateHypotheses: [
          { name: "query_time", metricName: "avg_query_time_ms", tolerance: 200, operator: "lt" },
        ],
        scheduledAt: new Date().toISOString(),
        maxDurationMs: 30000,
        blastRadius: { maxAffectedServices: 1, maxAffectedNodes: 1, maxAffectedPercentage: 5, containedToLabels: null },
        rollbackStrategy: { enabled: true, rollbackOnViolation: true, autoRestoreDurationMs: null, notificationsEnabled: true },
      },
    ],
  });

  scheduler.startGameDay(gameDay.gameDayId);

  // Record results - one passes, one fails
  const gameDayStatus = scheduler.getGameDay(gameDay.gameDayId)!;
  const [netExp, dbExp] = gameDayStatus.experimentIds;

  // Network test passes
  scheduler.recordSteadyStateResult(netExp, "connectivity", 75, true, "Connectivity maintained");

  // Database test fails - triggers violation
  scheduler.recordSteadyStateResult(dbExp, "query_time", 450, false, "Query time exceeded threshold");

  // Refresh status
  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed!.status, "violated");

  // Generate report
  const report = scheduler.generatePanicDrillReport(gameDay.gameDayId, 200, 800, 0.75);
  assert.ok(report !== null);
  assert.ok(report!.plane_ack_success_rate === 0.75);

  // Collect evidence from game day for reflection
  const evidence: EvidenceRecord[] = [
    createEvidence({
      id: "gd_ev_1",
      taskType: "database_query",
      failureMode: "high_latency",
      success: false,
      costUsd: 0.45,
      latencyMs: 450,
      repairRounds: 3,
    }),
    createEvidence({
      id: "gd_ev_2",
      taskType: "database_query",
      failureMode: "high_latency",
      success: false,
      costUsd: 0.40,
      latencyMs: 420,
      repairRounds: 2,
    }),
  ];

  const engine = new SimpleReflectionEngine();
  const reflections = await engine.reflect(evidence);

  if (reflections.length > 0) {
    assert.ok(reflections[0].recommendation.length > 0);
  }
});

/**
 * E2E Scenario 4: Full loop from chaos -> evidence -> proposal -> rollout -> monitoring
 */
test("E2E: Complete feedback loop from chaos to monitoring", async () => {
  // Phase 1: Chaos Engineering
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment({
    name: "End-to-end Latency Test",
    description: "Complete latency testing",
    target: { targetKind: "service", targetId: "api-gateway", labels: {} },
    fault: { faultType: "latency", intensity: 200, durationMs: 20000, parameters: {} },
    steadyStateHypotheses: [
      { name: "response_time", metricName: "avg_response_time_ms", tolerance: 300, operator: "lt" },
      { name: "error_rate", metricName: "error_rate", tolerance: 0.02, operator: "lt" },
    ],
    scheduledAt: new Date().toISOString(),
    maxDurationMs: 45000,
    blastRadius: { maxAffectedServices: 1, maxAffectedNodes: 2, maxAffectedPercentage: 10, containedToLabels: null },
    rollbackStrategy: { enabled: true, rollbackOnViolation: true, autoRestoreDurationMs: 5000, notificationsEnabled: true },
  });

  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "response_time", 450, false, "Response time exceeded");
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate", 0.01, true, "Error rate OK");

  // Phase 2: Evidence Collection
  const evidence: EvidenceRecord[] = [
    createEvidence({ id: "loop_1", taskType: "api_request", failureMode: "high_latency", success: false, latencyMs: 450 }),
    createEvidence({ id: "loop_2", taskType: "api_request", failureMode: "high_latency", success: false, latencyMs: 480 }),
  ];

  // Phase 3: Reflection
  const engine = new SimpleReflectionEngine();
  const reflections = await engine.reflect(evidence);
  const reflection = reflections[0]!;

  // Phase 4: Proposal Generation
  const proposal = createProposal("prop_loop_1");
  proposal.rationale = reflection.recommendation;
  proposal.evidenceIds = reflection.evidenceIds;
  proposal.kind = "latency_optimization";

  // Phase 5: Rollout
  const rolloutManager = new SimpleRolloutManager();
  const rolloutRecord = await rolloutManager.start(proposal, "canary", 5);

  // Phase 6: Monitoring through rollout stages
  // Canary stage - good metrics
  await rolloutManager.updateMetrics("prop_loop_1", {
    successRate: 0.98,
    errorRate: 0.02,
    latencyMs: 250,
    costUsd: 0.08,
  });

  let rollout = await rolloutManager.getRollout("prop_loop_1");
  assert.equal(rollout!.status, "running");

  // Advance to partial
  await rolloutManager.complete("prop_loop_1");
  await rolloutManager.start(proposal, "partial", 25);

  rollout = await rolloutManager.getRollout("prop_loop_1");
  assert.equal(rollout!.stage, "partial");

  // Continue to stable
  await rolloutManager.complete("prop_loop_1");
  await rolloutManager.start(proposal, "stable", 100);

  rollout = await rolloutManager.getRollout("prop_loop_1");
  assert.equal(rollout!.stage, "stable");

  // Complete rollout
  await rolloutManager.complete("prop_loop_1");

  rollout = await rolloutManager.getRollout("prop_loop_1");
  assert.equal(rollout!.status, "succeeded");
});
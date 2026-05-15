/**
 * Integration tests for Chaos Engineering
 *
 * Tests chaos experiment scheduling, execution, and game day orchestration
 * across multiple components working together.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ChaosExperimentScheduler } from "../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

/**
 * Integration test: Full chaos experiment lifecycle
 * Tests scheduling -> start -> injectFault -> record results -> complete
 */
test("ChaosIntegration: Full experiment lifecycle with steady state validation", () => {
  const scheduler = new ChaosExperimentScheduler();

  // Schedule experiment with multiple hypotheses
  const experiment = scheduler.scheduleExperiment({
    name: "Latency Injection Test",
    description: "Test system resilience under latency injection",
    target: {
      targetKind: "service",
      targetId: "payment-service",
      labels: { region: "us-east-1", tier: "critical" },
    },
    fault: {
      faultType: "latency",
      intensity: 200,
      durationMs: 30000,
      parameters: { targetPort: 8080 },
    },
    steadyStateHypotheses: [
      { name: "error_rate_ok", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
      { name: "latency_ok", metricName: "p99_latency", tolerance: 500, operator: "lt" },
    ],
    scheduledAt: new Date().toISOString(),
    maxDurationMs: 60000,
    boundaryControl: {
      maxAffectedInstances: 1,
      maxAffectedPercent: 10,
      allowedTargets: [],
      blockedTargets: ["production", "primary", "master"],
      abortOnThreshold: true,
      autoRollbackOnViolation: true,
      rollbackTimeoutMs: 5000,
    },
  });

  // Start experiment
  const started = scheduler.startExperiment(experiment.experimentId);
  assert.equal(started, true);

  // Verify fault injection returns config
  const fault = scheduler.injectFault(experiment.experimentId);
  assert.ok(fault !== null);
  assert.equal(fault!.faultType, "latency");
  assert.equal(fault!.intensity, 200);

  // Record steady state results - both pass
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_ok", 0.005, true, "Error rate within tolerance");
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_ok", 350, true, "P99 latency within tolerance");

  // Verify experiment completed successfully
  const completed = scheduler.getExperiment(experiment.experimentId);
  assert.equal(completed!.status, "completed");
  assert.equal(completed!.results.length, 2);
  assert.ok(completed!.completedAt !== null);
});

/**
 * Integration test: Game day with multiple experiments
 */
test("ChaosIntegration: Game day orchestrates multiple experiments", () => {
  const scheduler = new ChaosExperimentScheduler();

  const gameDay = scheduler.scheduleGameDay({
    name: "Weekly Stability GameDay",
    scheduledAt: new Date().toISOString(),
    experiments: [
      {
        name: "Network Partition",
        description: "Simulate network partition between services",
        target: { targetKind: "network", targetId: "internal-net", labels: {} },
        fault: { faultType: "packet_loss", intensity: 30, durationMs: 10000, parameters: {} },
        steadyStateHypotheses: [
          { name: "connectivity", metricName: "connection_count", tolerance: 50, operator: "gt" },
        ],
        scheduledAt: new Date().toISOString(),
        maxDurationMs: 30000,
        boundaryControl: {
          maxAffectedInstances: 5,
          maxAffectedPercent: 20,
          allowedTargets: [],
          blockedTargets: ["production", "primary", "master"],
          abortOnThreshold: true,
          autoRollbackOnViolation: true,
          rollbackTimeoutMs: 30000,
        },
      },
      {
        name: "Database Slowdown",
        description: "Inject latency into database queries",
        target: { targetKind: "database", targetId: "main-db", labels: {} },
        fault: { faultType: "latency", intensity: 500, durationMs: 15000, parameters: {} },
        steadyStateHypotheses: [
          { name: "query_time", metricName: "avg_query_time_ms", tolerance: 200, operator: "lt" },
        ],
        scheduledAt: new Date().toISOString(),
        maxDurationMs: 30000,
        boundaryControl: {
          maxAffectedInstances: 1,
          maxAffectedPercent: 5,
          allowedTargets: [],
          blockedTargets: ["production", "primary", "master"],
          abortOnThreshold: true,
          autoRollbackOnViolation: true,
          rollbackTimeoutMs: 30000,
        },
      },
    ],
  });

  assert.equal(gameDay.experimentIds.length, 2);

  // Start game day
  const started = scheduler.startGameDay(gameDay.gameDayId);
  assert.equal(started, true);

  const gameDayStatus = scheduler.getGameDay(gameDay.gameDayId);
  assert.equal(gameDayStatus!.status, "running");
  assert.ok(gameDayStatus!.startedAt !== null);

  // Complete all experiments
  for (const experimentId of gameDayStatus!.experimentIds) {
    const exp = scheduler.getExperiment(experimentId)!;
    for (const hypothesis of exp.steadyStateHypotheses) {
      scheduler.recordSteadyStateResult(experimentId, hypothesis.name, 0, true, "Steady state maintained");
    }
  }

  // Refresh game day status
  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed!.status, "completed");
  assert.ok(refreshed!.completedAt !== null);

  // Generate panic drill report
  const report = scheduler.generatePanicDrillReport(gameDay.gameDayId, 150, 500, 0.98);
  assert.ok(report !== null);
  assert.equal(report!.planesContacted.length, 5);
  assert.equal(report!.plane_ack_success_rate, 0.98);
});

/**
 * Integration test: Auto-rollback when hypothesis fails
 */
test("ChaosIntegration: Auto-rollback triggered on hypothesis violation", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment({
    name: "Chaos Test with Rollback",
    description: "Test auto rollback behavior",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "error", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [
      { name: "availability", metricName: "availability", tolerance: 0.99, operator: "gte" },
    ],
    scheduledAt: new Date().toISOString(),
    maxDurationMs: 60000,
    boundaryControl: {
      maxAffectedInstances: 1,
      maxAffectedPercent: 5,
      allowedTargets: [],
      blockedTargets: ["production", "primary", "master"],
      abortOnThreshold: true,
      autoRollbackOnViolation: true,
      rollbackTimeoutMs: 5000,
    },
  });

  scheduler.startExperiment(experiment.experimentId);

  // Record failed hypothesis - should trigger auto-rollback
  scheduler.recordSteadyStateResult(experiment.experimentId, "availability", 0.85, false, "Availability degraded below threshold");

  const completed = scheduler.getExperiment(experiment.experimentId);
  assert.equal(completed!.status, "rollback");
  assert.equal(completed!.boundaryControl.autoRollbackOnViolation, true);
  assert.ok(completed!.violationDetectedAt !== null);
  assert.equal(scheduler.isRollbackInProgress(experiment.experimentId), true);
});

/**
 * Integration test: Chaos experiment with auto-termination
 */
test("ChaosIntegration: Experiment auto-terminates after max duration", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment({
    name: "Short Duration Test",
    description: "Test auto termination",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 100, durationMs: 1, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: new Date().toISOString(),
    maxDurationMs: 0, // Immediate expiry without relying on wall-clock delay.
  });

  scheduler.startExperiment(experiment.experimentId);

  // Trigger auto-termination check
  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);
  assert.equal(terminated, true);

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "cancelled");
  assert.ok(retrieved!.completedAt !== null);
});

/**
 * Integration test: Multiple concurrent experiments
 */
test("ChaosIntegration: Handle multiple concurrent experiments", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experiments = [
    scheduler.scheduleExperiment({
      name: "Exp1",
      description: "d",
      target: { targetKind: "service", targetId: "svc1", labels: {} },
      fault: { faultType: "latency", intensity: 100, durationMs: 1000, parameters: {} },
      steadyStateHypotheses: [],
      scheduledAt: new Date().toISOString(),
      maxDurationMs: 60000,
      boundaryControl: {
        maxAffectedInstances: 1,
        maxAffectedPercent: 5,
        allowedTargets: [],
        blockedTargets: ["production", "primary", "master"],
        abortOnThreshold: true,
        autoRollbackOnViolation: false,
        rollbackTimeoutMs: 30000,
      },
    }),
    scheduler.scheduleExperiment({
      name: "Exp2",
      description: "d",
      target: { targetKind: "service", targetId: "svc2", labels: {} },
      fault: { faultType: "error", intensity: 50, durationMs: 1000, parameters: {} },
      steadyStateHypotheses: [],
      scheduledAt: new Date().toISOString(),
      maxDurationMs: 60000,
      boundaryControl: {
        maxAffectedInstances: 1,
        maxAffectedPercent: 5,
        allowedTargets: [],
        blockedTargets: ["production", "primary", "master"],
        abortOnThreshold: true,
        autoRollbackOnViolation: false,
        rollbackTimeoutMs: 30000,
      },
    }),
    scheduler.scheduleExperiment({
      name: "Exp3",
      description: "d",
      target: { targetKind: "network", targetId: "net1", labels: {} },
      fault: { faultType: "packet_loss", intensity: 20, durationMs: 1000, parameters: {} },
      steadyStateHypotheses: [],
      scheduledAt: new Date().toISOString(),
      maxDurationMs: 60000,
      boundaryControl: {
        maxAffectedInstances: 3,
        maxAffectedPercent: 10,
        allowedTargets: [],
        blockedTargets: ["production", "primary", "master"],
        abortOnThreshold: true,
        autoRollbackOnViolation: false,
        rollbackTimeoutMs: 30000,
      },
    }),
  ];

  // Start all experiments
  for (const exp of experiments) {
    scheduler.startExperiment(exp.experimentId);
  }

  // Verify all are running
  const allRunning = scheduler.listExperiments("running");
  assert.equal(allRunning.length, 3);

  // Complete all
  for (const exp of experiments) {
    scheduler.recordSteadyStateResult(exp.experimentId, "fake", 0, true, "OK");
  }

  const completed = scheduler.listExperiments("completed");
  assert.equal(completed.length, 3);
});

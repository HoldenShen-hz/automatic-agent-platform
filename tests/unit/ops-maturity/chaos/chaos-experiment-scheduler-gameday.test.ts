import assert from "node:assert/strict";
import test from "node:test";

import {
  ChaosExperimentScheduler,
  type SteadyStateHypothesis,
  type ExperimentTarget,
  type FaultInjection,
  type ExperimentScheduleInput,
  type BlastRadiusLimits,
  type RollbackStrategy,
} from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

function makeMinimalTarget(): ExperimentTarget {
  return {
    targetKind: "service",
    targetId: "test-service",
    labels: { env: "test" },
    blastRadius: makeMinimalBlastRadius(),
    rollbackStrategy: makeMinimalRollback(),
  };
}

function makeMinimalBlastRadius(): BlastRadiusLimits {
  return {
    maxAffectedServices: 1,
    maxAffectedNodes: 1,
    maxAffectedPercentage: 10,
    containedToLabels: null,
  };
}

function makeMinimalRollback(): RollbackStrategy {
  return {
    enabled: false,
    rollbackOnViolation: false,
    autoRestoreDurationMs: null,
    notificationsEnabled: false,
  };
}

function makeExperimentInput(overrides: Partial<ExperimentScheduleInput> = {}): ExperimentScheduleInput {
  return {
    name: "Test Experiment",
    description: "Test description",
    target: makeMinimalTarget(),
    fault: { faultType: "latency", intensity: 100, durationMs: 5000, parameters: {} },
    steadyStateHypotheses: [{ name: "avail", metricName: "error_rate", tolerance: 0.01, operator: "lt" }],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 60000,
    blastRadius: makeMinimalBlastRadius(),
    rollbackStrategy: makeMinimalRollback(),
    ...overrides,
  };
}

test("ChaosExperimentScheduler: scheduleGameDay creates game day with scheduled experiments", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experimentInput = makeExperimentInput({ name: "GameDay Experiment 1" });
  const gameDay = scheduler.scheduleGameDay({
    name: "GameDay 1",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [experimentInput],
  });

  assert.ok(gameDay.gameDayId.startsWith("gameday_"));
  assert.equal(gameDay.name, "GameDay 1");
  assert.equal(gameDay.status, "scheduled");
  assert.equal(gameDay.startedAt, null);
  assert.equal(gameDay.completedAt, null);
  assert.equal(gameDay.experimentIds.length, 1);
});

test("ChaosExperimentScheduler: scheduleGameDay with multiple experiments", () => {
  const scheduler = new ChaosExperimentScheduler();

  const gameDay = scheduler.scheduleGameDay({
    name: "Multi-Experiment GameDay",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [
      makeExperimentInput({ name: "Exp 1" }),
      makeExperimentInput({ name: "Exp 2" }),
      makeExperimentInput({ name: "Exp 3" }),
    ],
  });

  assert.equal(gameDay.experimentIds.length, 3);
});

test("ChaosExperimentScheduler: startGameDay transitions all experiments to running", () => {
  const scheduler = new ChaosExperimentScheduler();

  const gameDay = scheduler.scheduleGameDay({
    name: "GameDay 1",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [makeExperimentInput()],
  });

  const result = scheduler.startGameDay(gameDay.gameDayId);
  assert.equal(result, true);

  const updated = scheduler.getGameDay(gameDay.gameDayId);
  assert.equal(updated?.status, "running");
  assert.ok(updated?.startedAt !== null);

  // Verify all experiments are running
  for (const expId of gameDay.experimentIds) {
    const exp = scheduler.getExperiment(expId);
    assert.equal(exp?.status, "running");
  }
});

test("ChaosExperimentScheduler: startGameDay returns false for unknown game day", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.startGameDay("unknown_gameday");
  assert.equal(result, false);
});

test("ChaosExperimentScheduler: startGameDay returns false for already running game day", () => {
  const scheduler = new ChaosExperimentScheduler();

  const gameDay = scheduler.scheduleGameDay({
    name: "GameDay 1",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [makeExperimentInput()],
  });

  scheduler.startGameDay(gameDay.gameDayId);
  const result = scheduler.startGameDay(gameDay.gameDayId);
  assert.equal(result, false);
});

test("ChaosExperimentScheduler: refreshGameDayStatus returns violated if any experiment violated", () => {
  const scheduler = new ChaosExperimentScheduler();

  const gameDay = scheduler.scheduleGameDay({
    name: "GameDay 1",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [makeExperimentInput()],
  });

  scheduler.startGameDay(gameDay.gameDayId);
  const expId = gameDay.experimentIds[0];
  scheduler.recordSteadyStateResult(expId, "avail", 0.5, false, "Violation detected");

  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed?.status, "violated");
  assert.ok(refreshed?.completedAt !== null);
});

test("ChaosExperimentScheduler: refreshGameDayStatus returns completed when all experiments complete", () => {
  const scheduler = new ChaosExperimentScheduler();

  const gameDay = scheduler.scheduleGameDay({
    name: "GameDay 1",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [makeExperimentInput()],
  });

  scheduler.startGameDay(gameDay.gameDayId);
  const expId = gameDay.experimentIds[0];
  scheduler.recordSteadyStateResult(expId, "avail", 0.005, true, "OK");

  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed?.status, "completed");
  assert.ok(refreshed?.completedAt !== null);
});

test("ChaosExperimentScheduler: refreshGameDayStatus returns null for unknown game day", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.refreshGameDayStatus("unknown");
  assert.equal(result, null);
});

test("ChaosExperimentScheduler: generatePanicDrillReport returns report for valid game day", () => {
  const scheduler = new ChaosExperimentScheduler();

  const gameDay = scheduler.scheduleGameDay({
    name: "Panic Drill GameDay",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [makeExperimentInput()],
  });

  scheduler.startGameDay(gameDay.gameDayId);

  const report = scheduler.generatePanicDrillReport(
    gameDay.gameDayId,
    150,
    200,
    0.95
  );

  assert.ok(report !== null);
  assert.ok(report.drillId.startsWith("panic_drill_"));
  assert.equal(report.gameDayId, gameDay.gameDayId);
  assert.equal(report.ingress_block_time_ms, 150);
  assert.equal(report.execution_quiescence_time_ms, 200);
  assert.equal(report.plane_ack_success_rate, 0.95);
  assert.deepEqual(report.planesContacted, ["P1", "P2", "P3", "P4", "P5"]);
  assert.ok(report.generatedAt !== null);
});

test("ChaosExperimentScheduler: generatePanicDrillReport returns null for unknown game day", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.generatePanicDrillReport("unknown");
  assert.equal(result, null);
});

test("ChaosExperimentScheduler: generatePanicDrillReport planesAcknowledged depends on experiment status", () => {
  const scheduler = new ChaosExperimentScheduler();

  // Game day with no experiments - should have empty acknowledged
  const gameDay1 = scheduler.scheduleGameDay({
    name: "Empty GameDay",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [],
  });
  const report1 = scheduler.generatePanicDrillReport(gameDay1.gameDayId);
  assert.deepEqual(report1?.planesAcknowledged, []);

  // Game day with completed experiment - should acknowledge all planes
  const gameDay2 = scheduler.scheduleGameDay({
    name: "Completed GameDay",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [makeExperimentInput()],
  });
  scheduler.startGameDay(gameDay2.gameDayId);
  scheduler.recordSteadyStateResult(gameDay2.experimentIds[0], "avail", 0.005, true, "OK");

  const report2 = scheduler.generatePanicDrillReport(gameDay2.gameDayId);
  assert.deepEqual(report2?.planesAcknowledged, ["P1", "P2", "P3", "P4", "P5"]);
});

test("ChaosExperimentScheduler: getGameDay retrieves game day", () => {
  const scheduler = new ChaosExperimentScheduler();

  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-21T00:00:00.000Z",
    experiments: [makeExperimentInput()],
  });

  const retrieved = scheduler.getGameDay(gameDay.gameDayId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved?.gameDayId, gameDay.gameDayId);
  assert.equal(retrieved?.name, "Test GameDay");
});

test("ChaosExperimentScheduler: getGameDay returns null for unknown", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.getGameDay("unknown");
  assert.equal(result, null);
});

test("ChaosExperimentScheduler: autoRollbackTriggered flag set on violation with rollback enabled", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment(
    makeExperimentInput({
      rollbackStrategy: {
        enabled: true,
        rollbackOnViolation: true,
        autoRestoreDurationMs: 5000,
        notificationsEnabled: true,
      },
    })
  );

  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "avail", 0.5, false, "Failed");

  const updated = scheduler.getExperiment(experiment.experimentId);
  assert.equal(updated?.status, "violated");
  assert.equal(updated?.autoRollbackTriggered, true);
  assert.ok(updated?.violationDetectedAt !== null);
});

test("ChaosExperimentScheduler: autoTerminateIfNeeded cancels experiment after max duration", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment(
    makeExperimentInput({
      maxDurationMs: 1, // 1ms duration to trigger immediate termination
    })
  );

  scheduler.startExperiment(experiment.experimentId);

  // Wait a tiny bit to ensure time has passed
  const startTime = Date.now();
  while (Date.now() - startTime < 5) {
    // busy wait
  }

  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);

  assert.equal(terminated, true);
  const updated = scheduler.getExperiment(experiment.experimentId);
  assert.equal(updated?.status, "cancelled");
  assert.ok(updated?.completedAt !== null);
});

test("ChaosExperimentScheduler: cancelExperiment works for scheduled experiment", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  const result = scheduler.cancelExperiment(experiment.experimentId);

  assert.equal(result, true);
  const updated = scheduler.getExperiment(experiment.experimentId);
  assert.equal(updated?.status, "cancelled");
});

test("ChaosExperimentScheduler: cancelExperiment works for running experiment", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);
  const result = scheduler.cancelExperiment(experiment.experimentId);

  assert.equal(result, true);
  const updated = scheduler.getExperiment(experiment.experimentId);
  assert.equal(updated?.status, "cancelled");
});

test("ChaosExperimentScheduler: cancelExperiment returns false for completed experiment", () => {
  const scheduler = new ChaosExperimentScheduler();

  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "avail", 0.005, true, "OK");

  const result = scheduler.cancelExperiment(experiment.experimentId);
  assert.equal(result, false);
});

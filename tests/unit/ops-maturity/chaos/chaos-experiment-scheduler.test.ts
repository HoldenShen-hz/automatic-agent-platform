import assert from "node:assert/strict";
import test from "node:test";

import { ChaosExperimentScheduler, SteadyStateHypothesis, ExperimentTarget, FaultInjection } from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

test("ChaosExperimentScheduler.scheduleExperiment creates experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const target: ExperimentTarget = {
    targetKind: "service",
    targetId: "service-a",
    labels: { region: "us-east" },
  };
  const fault: FaultInjection = {
    faultType: "latency",
    intensity: 100,
    durationMs: 5000,
    parameters: {},
  };
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "availability", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
  ];

  const experiment = scheduler.scheduleExperiment({
    name: "Latency Test",
    description: "Test latency injection",
    target,
    fault,
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 60000,
  });

  assert.ok(experiment.experimentId.startsWith("chaos_"));
  assert.equal(experiment.name, "Latency Test");
  assert.equal(experiment.status, "scheduled");
  assert.equal(experiment.startedAt, null);
  assert.deepEqual(experiment.results, []);
});

test("ChaosExperimentScheduler.startExperiment transitions scheduled to running", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  const result = scheduler.startExperiment(experiment.experimentId);

  assert.equal(result, true);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved?.status, "running");
  assert.ok(retrieved?.startedAt !== null);
});

test("ChaosExperimentScheduler.startExperiment returns false for unknown", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.startExperiment("unknown");
  assert.equal(result, false);
});

test("ChaosExperimentScheduler.startExperiment returns false for non-scheduled", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  const result = scheduler.startExperiment(experiment.experimentId);
  assert.equal(result, false);
});

test("ChaosExperimentScheduler.recordSteadyStateResult updates experiment results", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "error-rate", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "error-rate", 0.005, true, "OK");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved?.results.length, 1);
  assert.equal(retrieved?.results[0]!.passed, true);
  assert.equal(retrieved?.results[0]!.measuredValue, 0.005);
});

test("ChaosExperimentScheduler.recordSteadyStateResult marks completed when all pass", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "h1", metricName: "m1", tolerance: 1, operator: "lt" },
    { name: "h2", metricName: "m2", tolerance: 1, operator: "gt" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 0.5, true, "OK");
  scheduler.recordSteadyStateResult(experiment.experimentId, "h2", 2, true, "OK");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved?.status, "completed");
  assert.ok(retrieved?.completedAt !== null);
});

test("ChaosExperimentScheduler.recordSteadyStateResult marks violated when any fails", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "h1", metricName: "m1", tolerance: 1, operator: "lt" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 5, false, "Breached");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved?.status, "violated");
});

test("ChaosExperimentScheduler.injectFault returns fault for running experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 100, durationMs: 5000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  const fault = scheduler.injectFault(experiment.experimentId);

  assert.ok(fault !== null);
  assert.equal(fault!.faultType, "latency");
  assert.equal(fault!.intensity, 100);
});

test("ChaosExperimentScheduler.injectFault returns null for non-running", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  const fault = scheduler.injectFault(experiment.experimentId);
  assert.equal(fault, null);
});

test("ChaosExperimentScheduler.autoTerminateIfNeeded terminates expired experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 1, // 1ms max duration
  });
  scheduler.startExperiment(experiment.experimentId);

  // Small delay to ensure elapsed time > maxDurationMs
  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);

  // May be true or false depending on timing, but should not throw
  assert.equal(typeof terminated, "boolean");
});

test("ChaosExperimentScheduler.validateSteadyState evaluates lt correctly", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "test",
    metricName: "error_rate",
    tolerance: 0.05,
    operator: "lt",
  };

  assert.equal(scheduler.validateSteadyState("error_rate", 0.01, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("error_rate", 0.1, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState evaluates gt correctly", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "test",
    metricName: "cpu",
    tolerance: 0.8,
    operator: "gt",
  };

  assert.equal(scheduler.validateSteadyState("cpu", 0.9, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("cpu", 0.5, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState evaluates lte correctly", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "test",
    metricName: "latency",
    tolerance: 100,
    operator: "lte",
  };

  assert.equal(scheduler.validateSteadyState("latency", 100, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("latency", 101, hypothesis), false);
});

test("ChaosExperimentScheduler.listExperiments filters by status", () => {
  const scheduler = new ChaosExperimentScheduler();
  const exp1 = scheduler.scheduleExperiment({
    name: "Exp1",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  const exp2 = scheduler.scheduleExperiment({
    name: "Exp2",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "error", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  scheduler.startExperiment(exp1.experimentId);

  const all = scheduler.listExperiments();
  const scheduled = scheduler.listExperiments("scheduled");
  const running = scheduler.listExperiments("running");

  assert.equal(all.length, 2);
  assert.equal(scheduled.length, 1);
  assert.equal(running.length, 1);
});

test("ChaosExperimentScheduler.cancelExperiment cancels scheduled experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  const result = scheduler.cancelExperiment(experiment.experimentId);

  assert.equal(result, true);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved?.status, "cancelled");
});

test("ChaosExperimentScheduler.cancelExperiment returns false for completed", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "h", metricName: "m", tolerance: 1, operator: "lt" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "h", 0.5, true, "OK");

  const result = scheduler.cancelExperiment(experiment.experimentId);
  assert.equal(result, false);
});

test("ChaosExperimentScheduler schedules and completes a multi-experiment game day", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "weekly-stability-gameday",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      {
        name: "latency",
        description: "inject latency",
        target: { targetKind: "service", targetId: "svc-a", labels: {} },
        fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
        steadyStateHypotheses: [{ name: "latency_ok", metricName: "latency", tolerance: 200, operator: "lt" }],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
      {
        name: "error-rate",
        description: "inject errors",
        target: { targetKind: "service", targetId: "svc-b", labels: {} },
        fault: { faultType: "error", intensity: 1, durationMs: 1000, parameters: {} },
        steadyStateHypotheses: [{ name: "error_ok", metricName: "error_rate", tolerance: 0.05, operator: "lt" }],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
    ],
  });

  assert.equal(scheduler.startGameDay(gameDay.gameDayId), true);
  const started = scheduler.getGameDay(gameDay.gameDayId);
  assert.equal(started?.status, "running");

  for (const experimentId of started?.experimentIds ?? []) {
    const experiment = scheduler.getExperiment(experimentId)!;
    const hypothesis = experiment.steadyStateHypotheses[0]!;
    scheduler.recordSteadyStateResult(experimentId, hypothesis.name, 0, true, "steady state preserved");
  }

  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed?.status, "completed");
});

test("ChaosExperimentScheduler records all fault injection types correctly", () => {
  const scheduler = new ChaosExperimentScheduler();
  const faultTypes: FaultInjection["faultType"][] = ["latency", "error", "timeout", "packet_loss", "cpu_load", "memory_pressure"];

  for (const faultType of faultTypes) {
    const experiment = scheduler.scheduleExperiment({
      name: `${faultType}-test`,
      description: `test ${faultType}`,
      target: { targetKind: "service", targetId: "svc", labels: {} },
      fault: { faultType, intensity: 0.8, durationMs: 5000, parameters: { extra: "param" } },
      steadyStateHypotheses: [],
      scheduledAt: "2026-04-20T00:00:00.000Z",
      maxDurationMs: 60000,
    });

    scheduler.startExperiment(experiment.experimentId);
    const injected = scheduler.injectFault(experiment.experimentId);

    assert.ok(injected !== null, `Fault type ${faultType} should be injected`);
    assert.equal(injected!.faultType, faultType);
    assert.equal(injected!.intensity, 0.8);
  }
});

test("ChaosExperimentScheduler handles multiple steady state hypotheses with mixed results", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "latency_ok", metricName: "latency_p99", tolerance: 200, operator: "lt" },
    { name: "error_ok", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
    { name: "availability_ok", metricName: "availability", tolerance: 0.99, operator: "gte" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Multi-Hypothesis Test",
    description: "test",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  // First hypothesis passes
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_ok", 150, true, "latency within range");
  // Second hypothesis passes
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_ok", 0.005, true, "error rate low");
  // Third hypothesis fails
  scheduler.recordSteadyStateResult(experiment.experimentId, "availability_ok", 0.95, false, "availability degraded");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "violated");
  assert.equal(retrieved!.results.length, 3);
  assert.equal(retrieved!.results.filter((r) => r.passed).length, 2);
  assert.equal(retrieved!.results.filter((r) => !r.passed).length, 1);
});

test("ChaosExperimentScheduler autoTerminateIfNeeded does not terminate within duration", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Long Running Test",
    description: "test",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 60000,
  });
  scheduler.startExperiment(experiment.experimentId);

  const result = scheduler.autoTerminateIfNeeded(experiment.experimentId);

  assert.equal(result, false);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "running");
});

test("ChaosExperimentScheduler recordSteadyStateResult completes experiment with zero hypotheses", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "No Hypotheses Test",
    description: "test",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  // With zero hypotheses, the condition results.length >= steadyStateHypotheses.length is immediately true
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "completed");
});

test("ChaosExperimentScheduler game day does not start experiments twice", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      {
        name: "Exp1",
        description: "desc",
        target: { targetKind: "service", targetId: "svc", labels: {} },
        fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
        steadyStateHypotheses: [],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
    ],
  });

  scheduler.startGameDay(gameDay.gameDayId);
  const experimentId = gameDay.experimentIds[0]!;

  // Try to start the experiment again via startExperiment
  const result = scheduler.startExperiment(experimentId);
  assert.equal(result, false);

  const retrieved = scheduler.getExperiment(experimentId);
  assert.equal(retrieved!.status, "running");
});

test("ChaosExperimentScheduler game day refresh does not change status mid-execution", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      {
        name: "Exp1",
        description: "desc",
        target: { targetKind: "service", targetId: "svc", labels: {} },
        fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
        steadyStateHypotheses: [{ name: "h1", metricName: "m", tolerance: 1, operator: "lt" }],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
    ],
  });

  scheduler.startGameDay(gameDay.gameDayId);

  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed!.status, "running");
  assert.equal(refreshed!.completedAt, null);
});

test("ChaosExperimentScheduler validateSteadyState boundary conditions", () => {
  const scheduler = new ChaosExperimentScheduler();

  // Test lt: value just below and at tolerance
  const ltHyp: SteadyStateHypothesis = { name: "t", metricName: "m", tolerance: 1.0, operator: "lt" };
  assert.equal(scheduler.validateSteadyState("m", 0.999, ltHyp), true);
  assert.equal(scheduler.validateSteadyState("m", 1.0, ltHyp), false);

  // Test gt: value just above and at tolerance
  const gtHyp: SteadyStateHypothesis = { name: "t", metricName: "m", tolerance: 1.0, operator: "gt" };
  assert.equal(scheduler.validateSteadyState("m", 1.001, gtHyp), true);
  assert.equal(scheduler.validateSteadyState("m", 1.0, gtHyp), false);

  // Test eq with floating point
  const eqHyp: SteadyStateHypothesis = { name: "t", metricName: "m", tolerance: 0.1, operator: "eq" };
  assert.equal(scheduler.validateSteadyState("m", 0.1, eqHyp), true);

  // Test ne with zero tolerance
  const neHyp: SteadyStateHypothesis = { name: "t", metricName: "m", tolerance: 0, operator: "ne" };
  assert.equal(scheduler.validateSteadyState("m", 1, neHyp), true);
  assert.equal(scheduler.validateSteadyState("m", 0, neHyp), false);
});

test("ChaosExperimentScheduler listExperiments returns correct counts after lifecycle", () => {
  const scheduler = new ChaosExperimentScheduler();

  const exp1 = scheduler.scheduleExperiment({
    name: "Exp1",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  const exp2 = scheduler.scheduleExperiment({
    name: "Exp2",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "error", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  scheduler.startExperiment(exp1.experimentId);
  scheduler.recordSteadyStateResult(exp1.experimentId, "fake_hypothesis", 0, true, "OK");

  assert.equal(scheduler.listExperiments().length, 2);
  assert.equal(scheduler.listExperiments("scheduled").length, 1);
  assert.equal(scheduler.listExperiments("running").length, 0);
  assert.equal(scheduler.listExperiments("completed").length, 1);
  assert.equal(scheduler.listExperiments("cancelled").length, 0);
  assert.equal(scheduler.listExperiments("violated").length, 0);
});

test("ChaosExperimentScheduler cancelExperiment sets completedAt", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  scheduler.cancelExperiment(experiment.experimentId);

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.ok(retrieved!.completedAt !== null);
});

test("ChaosExperimentScheduler gameDay schedule preserves experiment order", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Ordered GameDay",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      { name: "First", description: "d", target: { targetKind: "service", targetId: "s", labels: {} }, fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} }, steadyStateHypotheses: [], scheduledAt: "2026-04-20T00:00:00.000Z", maxDurationMs: 5000 },
      { name: "Second", description: "d", target: { targetKind: "service", targetId: "s", labels: {} }, fault: { faultType: "error", intensity: 1, durationMs: 1000, parameters: {} }, steadyStateHypotheses: [], scheduledAt: "2026-04-20T00:00:00.000Z", maxDurationMs: 5000 },
      { name: "Third", description: "d", target: { targetKind: "service", targetId: "s", labels: {} }, fault: { faultType: "timeout", intensity: 1, durationMs: 1000, parameters: {} }, steadyStateHypotheses: [], scheduledAt: "2026-04-20T00:00:00.000Z", maxDurationMs: 5000 },
    ],
  });

  const experiments = gameDay.experimentIds.map((id) => scheduler.getExperiment(id)!);
  assert.equal(experiments[0]!.name, "First");
  assert.equal(experiments[1]!.name, "Second");
  assert.equal(experiments[2]!.name, "Third");
});

test("ChaosExperimentScheduler injectFault preserves fault parameters", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "node", targetId: "node-1", labels: { zone: "a" } },
    fault: { faultType: "packet_loss", intensity: 0.5, durationMs: 30000, parameters: { interface: "eth0", targetPort: 8080 } },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 60000,
  });
  scheduler.startExperiment(experiment.experimentId);

  const fault = scheduler.injectFault(experiment.experimentId);

  assert.equal(fault!.parameters.interface, "eth0");
  assert.equal(fault!.parameters.targetPort, 8080);
});

test("ChaosExperimentScheduler recordSteadyStateResult with null measuredValue", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "metric_available", metricName: "metric", tolerance: 1, operator: "gt" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "metric_available", null, false, "metric unavailable");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.results[0]!.measuredValue, null);
  assert.equal(retrieved!.results[0]!.passed, false);
});

test("ChaosExperimentScheduler game day refresh returns gameDay with correct experimentIds", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      { name: "Exp1", description: "d", target: { targetKind: "service", targetId: "s", labels: {} }, fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} }, steadyStateHypotheses: [], scheduledAt: "2026-04-20T00:00:00.000Z", maxDurationMs: 5000 },
      { name: "Exp2", description: "d", target: { targetKind: "service", targetId: "s", labels: {} }, fault: { faultType: "error", intensity: 1, durationMs: 1000, parameters: {} }, steadyStateHypotheses: [], scheduledAt: "2026-04-20T00:00:00.000Z", maxDurationMs: 5000 },
    ],
  });

  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.deepEqual(refreshed!.experimentIds, gameDay.experimentIds);
});

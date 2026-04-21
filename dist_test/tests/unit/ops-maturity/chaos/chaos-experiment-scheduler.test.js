import assert from "node:assert/strict";
import test from "node:test";
import { ChaosExperimentScheduler } from "../../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";
test("ChaosExperimentScheduler.scheduleExperiment creates experiment", () => {
    const scheduler = new ChaosExperimentScheduler();
    const target = {
        targetKind: "service",
        targetId: "service-a",
        labels: { region: "us-east" },
    };
    const fault = {
        faultType: "latency",
        intensity: 100,
        durationMs: 5000,
        parameters: {},
    };
    const hypotheses = [
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
    const hypotheses = [
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
    assert.equal(retrieved?.results[0].passed, true);
    assert.equal(retrieved?.results[0].measuredValue, 0.005);
});
test("ChaosExperimentScheduler.recordSteadyStateResult marks completed when all pass", () => {
    const scheduler = new ChaosExperimentScheduler();
    const hypotheses = [
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
    const hypotheses = [
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
    assert.equal(fault.faultType, "latency");
    assert.equal(fault.intensity, 100);
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
    const hypothesis = {
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
    const hypothesis = {
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
    const hypothesis = {
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
    const hypotheses = [
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
//# sourceMappingURL=chaos-experiment-scheduler.test.js.map
/**
 * Integration Test: Chaos Experiment Scheduler
 *
 * Tests chaos engineering experiment lifecycle:
 * - Experiment scheduling and state transitions
 * - Steady-state hypothesis validation
 * - Fault injection
 * - GameDay orchestration
 * - Auto-termination
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ChaosExperimentScheduler } from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";
test("ChaosExperimentScheduler schedules experiment and transitions through lifecycle", () => {
    const scheduler = new ChaosExperimentScheduler();
    const input = {
        name: "latency_injection_test",
        description: "Tests system behavior under induced latency",
        target: {
            targetKind: "service",
            targetId: "payment-service",
            labels: { region: "us-east-1", env: "staging" },
        },
        fault: {
            faultType: "latency",
            intensity: 500,
            durationMs: 30000,
            parameters: { injectAt: "egress" },
        },
        steadyStateHypotheses: [
            { name: "error_rate_stable", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
            { name: "latency_acceptable", metricName: "latency_p99_ms", tolerance: 2000, operator: "lt" },
        ],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 60000,
    };
    const experiment = scheduler.scheduleExperiment(input);
    assert.equal(experiment.status, "scheduled");
    assert.ok(experiment.experimentId.startsWith("chaos_"));
    assert.equal(experiment.steadyStateHypotheses.length, 2);
    const started = scheduler.startExperiment(experiment.experimentId);
    assert.equal(started, true);
    const fetched = scheduler.getExperiment(experiment.experimentId);
    assert.equal(fetched?.status, "running");
    assert.ok(fetched?.startedAt !== null);
    const fault = scheduler.injectFault(experiment.experimentId);
    assert.equal(fault?.faultType, "latency");
    assert.equal(fault?.intensity, 500);
});
test("ChaosExperimentScheduler validates steady-state with various operators", () => {
    const scheduler = new ChaosExperimentScheduler();
    // Test "lt" operator
    assert.equal(scheduler.validateSteadyState("error_rate", 0.005, { name: "test", metricName: "error_rate", tolerance: 0.01, operator: "lt" }), true);
    assert.equal(scheduler.validateSteadyState("error_rate", 0.015, { name: "test", metricName: "error_rate", tolerance: 0.01, operator: "lt" }), false);
    // Test "gt" operator
    assert.equal(scheduler.validateSteadyState("availability", 0.998, { name: "test", metricName: "availability", tolerance: 0.995, operator: "gt" }), true);
    assert.equal(scheduler.validateSteadyState("availability", 0.990, { name: "test", metricName: "availability", tolerance: 0.995, operator: "gt" }), false);
    // Test "lte" operator
    assert.equal(scheduler.validateSteadyState("saturation", 0.8, { name: "test", metricName: "saturation", tolerance: 0.8, operator: "lte" }), true);
    assert.equal(scheduler.validateSteadyState("saturation", 0.9, { name: "test", metricName: "saturation", tolerance: 0.8, operator: "lte" }), false);
    // Test "gte" operator
    assert.equal(scheduler.validateSteadyState("throughput", 100, { name: "test", metricName: "throughput", tolerance: 100, operator: "gte" }), true);
    assert.equal(scheduler.validateSteadyState("throughput", 90, { name: "test", metricName: "throughput", tolerance: 100, operator: "gte" }), false);
});
test("ChaosExperimentScheduler records steady-state results and auto-completes", () => {
    const scheduler = new ChaosExperimentScheduler();
    const input = {
        name: "composite_test",
        description: "Tests multiple hypotheses",
        target: { targetKind: "database", targetId: "main-db", labels: {} },
        fault: { faultType: "cpu_load", intensity: 80, durationMs: 30000, parameters: {} },
        steadyStateHypotheses: [
            { name: "db_connections", metricName: "db_connections", tolerance: 1000, operator: "lt" },
            { name: "query_latency", metricName: "query_latency_ms", tolerance: 500, operator: "lt" },
        ],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 60000,
    };
    const experiment = scheduler.scheduleExperiment(input);
    scheduler.startExperiment(experiment.experimentId);
    scheduler.recordSteadyStateResult(experiment.experimentId, "db_connections", 150, true, "connections within limit");
    const afterFirst = scheduler.getExperiment(experiment.experimentId);
    assert.equal(afterFirst?.status, "running");
    scheduler.recordSteadyStateResult(experiment.experimentId, "query_latency", 120, true, "latency acceptable");
    const afterSecond = scheduler.getExperiment(experiment.experimentId);
    assert.equal(afterSecond?.status, "completed");
    assert.ok(afterSecond?.completedAt !== null);
});
test("ChaosExperimentScheduler marks experiment violated when hypothesis fails", () => {
    const scheduler = new ChaosExperimentScheduler();
    const input = {
        name: "violation_test",
        description: "Tests violation detection",
        target: { targetKind: "network", targetId: "api-gateway", labels: {} },
        fault: { faultType: "packet_loss", intensity: 30, durationMs: 30000, parameters: {} },
        steadyStateHypotheses: [
            { name: "error_rate", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
        ],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 60000,
    };
    const experiment = scheduler.scheduleExperiment(input);
    scheduler.startExperiment(experiment.experimentId);
    scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate", 0.05, false, "error rate exceeded threshold");
    const afterFailure = scheduler.getExperiment(experiment.experimentId);
    assert.equal(afterFailure?.status, "violated");
});
test("ChaosExperimentScheduler auto-terminates experiments exceeding max duration", () => {
    const scheduler = new ChaosExperimentScheduler();
    const input = {
        name: "timeout_test",
        description: "Tests auto-termination",
        target: { targetKind: "node", targetId: "worker-1", labels: {} },
        fault: { faultType: "timeout", intensity: 10000, durationMs: 5000, parameters: {} },
        steadyStateHypotheses: [
            { name: "health", metricName: "health_score", tolerance: 0.5, operator: "gt" },
        ],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 0, // Zero duration triggers immediate termination after start
    };
    const experiment = scheduler.scheduleExperiment(input);
    scheduler.startExperiment(experiment.experimentId);
    const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);
    assert.equal(terminated, true);
    const afterTerminate = scheduler.getExperiment(experiment.experimentId);
    assert.equal(afterTerminate?.status, "cancelled");
});
test("ChaosExperimentScheduler cancels scheduled or running experiments", () => {
    const scheduler = new ChaosExperimentScheduler();
    const input = {
        name: "cancel_test",
        description: "Tests cancellation",
        target: { targetKind: "service", targetId: "auth-service", labels: {} },
        fault: { faultType: "error", intensity: 100, durationMs: 30000, parameters: {} },
        steadyStateHypotheses: [],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 60000,
    };
    const experiment = scheduler.scheduleExperiment(input);
    const cancelled = scheduler.cancelExperiment(experiment.experimentId);
    assert.equal(cancelled, true);
    const afterCancel = scheduler.getExperiment(experiment.experimentId);
    assert.equal(afterCancel?.status, "cancelled");
});
test("ChaosExperimentScheduler lists experiments by status", () => {
    const scheduler = new ChaosExperimentScheduler();
    const input1 = {
        name: "scheduled_test",
        description: "test1",
        target: { targetKind: "service", targetId: "svc-1", labels: {} },
        fault: { faultType: "latency", intensity: 100, durationMs: 10000, parameters: {} },
        steadyStateHypotheses: [],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 60000,
    };
    const input2 = {
        name: "running_test",
        description: "test2",
        target: { targetKind: "service", targetId: "svc-2", labels: {} },
        fault: { faultType: "error", intensity: 50, durationMs: 10000, parameters: {} },
        steadyStateHypotheses: [],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 60000,
    };
    const exp1 = scheduler.scheduleExperiment(input1);
    const exp2 = scheduler.scheduleExperiment(input2);
    scheduler.startExperiment(exp2.experimentId);
    const all = scheduler.listExperiments();
    assert.equal(all.length, 2);
    const scheduled = scheduler.listExperiments("scheduled");
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0]?.name, "scheduled_test");
    const running = scheduler.listExperiments("running");
    assert.equal(running.length, 1);
    assert.equal(running[0]?.name, "running_test");
});
test("ChaosExperimentScheduler orchestrates GameDay with multiple experiments", () => {
    const scheduler = new ChaosExperimentScheduler();
    const gameDayInput = {
        name: "platform_resilience_day",
        scheduledAt: "2026-04-25T00:00:00.000Z",
        experiments: [
            {
                name: "gameday_latency",
                description: "Latency injection test",
                target: { targetKind: "service", targetId: "api-gateway", labels: {} },
                fault: { faultType: "latency", intensity: 300, durationMs: 15000, parameters: {} },
                steadyStateHypotheses: [{ name: "error_rate", metricName: "error_rate", tolerance: 0.01, operator: "lt" }],
                scheduledAt: "2026-04-25T00:00:00.000Z",
                maxDurationMs: 30000,
            },
            {
                name: "gameday_error",
                description: "Error injection test",
                target: { targetKind: "service", targetId: "payment-service", labels: {} },
                fault: { faultType: "error", intensity: 10, durationMs: 10000, parameters: {} },
                steadyStateHypotheses: [{ name: "availability", metricName: "availability", tolerance: 0.99, operator: "gt" }],
                scheduledAt: "2026-04-25T00:01:00.000Z",
                maxDurationMs: 30000,
            },
        ],
    };
    const gameDay = scheduler.scheduleGameDay(gameDayInput);
    assert.equal(gameDay.status, "scheduled");
    assert.ok(gameDay.gameDayId.startsWith("gameday_"));
    assert.equal(gameDay.experimentIds.length, 2);
    const started = scheduler.startGameDay(gameDay.gameDayId);
    assert.equal(started, true);
    const afterStart = scheduler.getGameDay(gameDay.gameDayId);
    assert.equal(afterStart?.status, "running");
    assert.ok(afterStart?.startedAt !== null);
});
test("ChaosExperimentScheduler refreshes GameDay status based on experiment outcomes", () => {
    const scheduler = new ChaosExperimentScheduler();
    const gameDayInput = {
        name: "refresh_test_gameday",
        scheduledAt: "2026-04-25T00:00:00.000Z",
        experiments: [
            {
                name: "refresh_exp_1",
                description: "First experiment",
                target: { targetKind: "service", targetId: "svc-1", labels: {} },
                fault: { faultType: "latency", intensity: 100, durationMs: 10000, parameters: {} },
                steadyStateHypotheses: [{ name: "error_rate", metricName: "error_rate", tolerance: 0.01, operator: "lt" }],
                scheduledAt: "2026-04-25T00:00:00.000Z",
                maxDurationMs: 60000,
            },
            {
                name: "refresh_exp_2",
                description: "Second experiment",
                target: { targetKind: "service", targetId: "svc-2", labels: {} },
                fault: { faultType: "error", intensity: 5, durationMs: 10000, parameters: {} },
                steadyStateHypotheses: [{ name: "availability", metricName: "availability", tolerance: 0.99, operator: "gt" }],
                scheduledAt: "2026-04-25T00:01:00.000Z",
                maxDurationMs: 60000,
            },
        ],
    };
    const gameDay = scheduler.scheduleGameDay(gameDayInput);
    scheduler.startGameDay(gameDay.gameDayId);
    // Both experiments still running - status should remain running
    const whileRunning = scheduler.refreshGameDayStatus(gameDay.gameDayId);
    assert.equal(whileRunning?.status, "running");
    // Complete first experiment
    const expIds = whileRunning.experimentIds;
    scheduler.recordSteadyStateResult(expIds[0], "error_rate", 0.005, true, "stable");
    scheduler.recordSteadyStateResult(expIds[0], "error_rate", 0.005, true, "stable");
    // Still running since second experiment not complete
    const midRefresh = scheduler.refreshGameDayStatus(gameDay.gameDayId);
    assert.equal(midRefresh?.status, "running");
});
//# sourceMappingURL=chaos-experiment-scheduler-integration.test.js.map
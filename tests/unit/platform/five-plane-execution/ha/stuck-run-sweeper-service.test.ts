import assert from "node:assert/strict";
import test from "node:test";

import { StuckRunSweeperService } from "../../../../../src/platform/five-plane-execution/ha/stuck-run-sweeper-service.js";

test("StuckRunSweeperService can be instantiated", () => {
  const service = new StuckRunSweeperService({});
  assert.ok(service instanceof StuckRunSweeperService);
});

test("StuckRunSweeperService getWorkerId returns expected value", () => {
  const service = new StuckRunSweeperService({});
  assert.equal(service.getWorkerId(), "stuck-run-sweeper");
});

test("StuckRunSweeperService getRecoveryCadence returns structure", () => {
  const service = new StuckRunSweeperService({});
  const cadence = service.getRecoveryCadence();

  assert.ok(typeof cadence.intervalMs === "number");
  assert.ok(typeof cadence.maxConcurrent === "number");
  assert.ok(typeof cadence.priority === "string");
});

test("StuckRunSweeperService trackRun adds run to tracked runs", () => {
  const service = new StuckRunSweeperService({});
  service.trackRun("exec-1", "task-1", null);

  assert.equal(service.getTrackedRunCount(), 1);
});

test("StuckRunSweeperService trackRun does not duplicate", () => {
  const service = new StuckRunSweeperService({});
  service.trackRun("exec-1", "task-1", null);
  service.trackRun("exec-1", "task-1", null);

  assert.equal(service.getTrackedRunCount(), 1);
});

test("StuckRunSweeperService reportProgress updates lastProgressAt", () => {
  const service = new StuckRunSweeperService({});
  service.trackRun("exec-1", "task-1", null);
  service.reportProgress("exec-1", "task-1", null);

  const runs = service.getTrackedRuns();
  assert.ok(runs[0]?.lastProgressAt);
});

test("StuckRunSweeperService markRunComplete removes from tracked", () => {
  const service = new StuckRunSweeperService({});
  service.trackRun("exec-1", "task-1", null);
  service.markRunComplete("exec-1");

  assert.equal(service.getTrackedRunCount(), 0);
});

test("StuckRunSweeperService markRunComplete does nothing for unknown run", () => {
  const service = new StuckRunSweeperService({});
  service.markRunComplete("unknown-exec");

  // Should not throw
  assert.equal(service.getTrackedRunCount(), 0);
});

test("StuckRunSweeperService getConfig returns configuration", () => {
  const service = new StuckRunSweeperService({});
  const config = service.getConfig();

  assert.ok(typeof config.sweepIntervalMs === "number");
  assert.ok(typeof config.stuckThresholdMs === "number");
  assert.ok(typeof config.killAfterWarningMs === "number");
  assert.ok(typeof config.cleanupAfterKillMs === "number");
});

test("StuckRunSweeperService getMetrics returns metrics object", () => {
  const service = new StuckRunSweeperService({});
  const metrics = service.getMetrics();

  assert.ok(typeof metrics.totalDetected === "number");
  assert.ok(typeof metrics.totalWarnings === "number");
  assert.ok(typeof metrics.totalKilled === "number");
  assert.ok(typeof metrics.totalCleanedUp === "number");
});

test("StuckRunSweeperService isRunning returns false when not started", () => {
  const service = new StuckRunSweeperService({});
  assert.equal(service.isRunning(), false);
});

test("StuckRunSweeperService start sets running state", () => {
  const service = new StuckRunSweeperService({});
  service.start();
  assert.equal(service.isRunning(), true);
  service.stop();
});

test("StuckRunSweeperService stop clears running state", () => {
  const service = new StuckRunSweeperService({});
  service.start();
  service.stop();
  assert.equal(service.isRunning(), false);
});

test("StuckRunSweeperService dispose stops and clears runs", () => {
  const service = new StuckRunSweeperService({});
  service.trackRun("exec-1", "task-1", null);
  service.start();
  service.dispose();

  assert.equal(service.isRunning(), false);
  assert.equal(service.getTrackedRunCount(), 0);
});

test("StuckRunSweeperService dispose can be called multiple times", () => {
  const service = new StuckRunSweeperService({});
  service.dispose();
  service.dispose();

  assert.ok(true, "Should not throw");
});

test("StuckRunSweeperService start throws when disposed", () => {
  const service = new StuckRunSweeperService({});
  service.dispose();

  assert.throws(() => service.start(), /disposed/);
});

test("StuckRunSweeperService getTrackedRuns returns array of runs", () => {
  const service = new StuckRunSweeperService({});
  service.trackRun("exec-1", "task-1", null);
  service.trackRun("exec-2", "task-2", "session-1");

  const runs = service.getTrackedRuns();
  assert.equal(runs.length, 2);
});

test("StuckRunSweeperService with HA_1 level config", () => {
  const service = new StuckRunSweeperService({ haLevel: "HA_1" });
  const config = service.getConfig();

  assert.ok(config.sweepIntervalMs > 0);
});

test("StuckRunSweeperService custom config overrides", () => {
  const service = new StuckRunSweeperService({
    config: {
      sweepIntervalMs: 5000,
      stuckThresholdMs: 60000,
      killAfterWarningMs: 10000,
      cleanupAfterKillMs: 30000,
      maxRunsPerSweep: 50,
    },
  });
  const config = service.getConfig();

  assert.equal(config.sweepIntervalMs, 5000);
  assert.equal(config.stuckThresholdMs, 60000);
  assert.equal(config.killAfterWarningMs, 10000);
  assert.equal(config.cleanupAfterKillMs, 30000);
  assert.equal(config.maxRunsPerSweep, 50);
});

test("StuckRunSweeperService onStuckRunDetected callback is called", () => {
  let callbackCalled = false;
  const service = new StuckRunSweeperService({
    config: { stuckThresholdMs: 0 },
    onStuckRunDetected: () => {
      callbackCalled = true;
    },
  });

  service.trackRun("exec-1", "task-1", null);
  service.start();

  // Wait for sweep to detect stuck run
  setTimeout(() => {
    assert.ok(callbackCalled, "onStuckRunDetected should be called");
    service.dispose();
  }, 100);
});

test("StuckRunSweeperService runRecoveryCycle returns RecoveryReport", async () => {
  const service = new StuckRunSweeperService({});
  service.trackRun("exec-1", "task-1", null);

  const report = await service.runRecoveryCycle();

  assert.equal(report.workerId, "stuck-run-sweeper");
  assert.equal(report.workerType, "stuck_run_sweeper");
  assert.ok(Array.isArray(report.errors));
  assert.ok(typeof report.durationMs === "number");
});

test("StuckRunSweeperService runRecoveryCycle handles empty sweep", async () => {
  const service = new StuckRunSweeperService({});

  const report = await service.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
});

test("StuckRunSweeperService sweepOnce returns array", async () => {
  const service = new StuckRunSweeperService({});
  service.trackRun("exec-1", "task-1", null);

  const swept = await service.sweepOnce();

  assert.ok(Array.isArray(swept));
});

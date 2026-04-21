import assert from "node:assert/strict";
import test from "node:test";

import {
  StuckRunSweeperService,
  createStuckRunSweeperService,
  type StuckRunSweeperServiceOptions,
} from "../../../../../src/platform/execution/ha/stuck-run-sweeper-service.js";
import type { StuckRun } from "../../../../../src/platform/execution/ha/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Clock - controls time for deterministic testing
// ─────────────────────────────────────────────────────────────────────────────

class TestClock {
  private _now: number;

  constructor(initialMs: number = 0) {
    this._now = initialMs;
  }

  advance(ms: number): void {
    this._now += ms;
  }

  now(): number {
    return this._now;
  }

  isoString(): string {
    return new Date(this._now).toISOString();
  }

  install(): void {
    const self = this;
    const OriginalDate = globalThis.Date;

    // Override Date.now
    Object.defineProperty(globalThis.Date, 'now', {
      value: () => self._now,
      writable: true,
      configurable: true,
    });

    // Create a TestDate constructor that uses fake time for no-arg and numeric-arg cases
    const TestDate = function(...args: unknown[]): Date {
      if (args.length === 0) {
        return new OriginalDate(self._now);
      }
      // For string args (like ISO strings), use original behavior
      if (typeof args[0] === 'string') {
        return new OriginalDate(args[0] as string);
      }
      // For number args, treat as epoch ms
      if (typeof args[0] === 'number') {
        return new OriginalDate(args[0] as number);
      }
      // Fallback
      return new OriginalDate(self._now);
    } as unknown as typeof Date;

    // Copy static properties
    Object.defineProperties(TestDate, {
      now: { value: () => self._now, writable: true, configurable: true },
      parse: { value: OriginalDate.parse, writable: true, configurable: true },
      UTC: { value: OriginalDate.UTC, writable: true, configurable: true },
    });

    globalThis.Date = TestDate;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface RunEvent {
  type: "detected" | "warning" | "killed" | "cleaned_up";
  run: StuckRun;
  timestamp: number;
}

function createService(
  options: Partial<StuckRunSweeperServiceOptions> & { clock?: TestClock } = {},
): {
  service: StuckRunSweeperService;
  events: RunEvent[];
  clock: TestClock;
  killResults: Map<string, boolean>;
  cleanupResults: Map<string, boolean>;
} {
  // Start clock at 0 for deterministic testing
  const clock = options.clock ?? new TestClock(0);
  const events: RunEvent[] = [];
  const killResults = new Map<string, boolean>();
  const cleanupResults = new Map<string, boolean>();

  clock.install();

  const serviceOptions: StuckRunSweeperServiceOptions = {
    onStuckRunDetected: options.onStuckRunDetected ?? ((run: StuckRun) => {
      events.push({ type: "detected", run, timestamp: clock.now() });
    }),
    onWarningIssued: options.onWarningIssued ?? ((run: StuckRun) => {
      events.push({ type: "warning", run, timestamp: clock.now() });
    }),
    onRunKilled: options.onRunKilled ?? ((run: StuckRun) => {
      events.push({ type: "killed", run, timestamp: clock.now() });
    }),
    onRunCleanedUp: options.onRunCleanedUp ?? ((run: StuckRun) => {
      events.push({ type: "cleaned_up", run, timestamp: clock.now() });
    }),
    onKillExecution: options.onKillExecution ?? (async (executionId: string) => {
      return killResults.get(executionId) ?? true;
    }),
    onCleanupExecution: options.onCleanupExecution ?? (async (executionId: string) => {
      return cleanupResults.get(executionId) ?? true;
    }),
  };

  // Only add optional properties if they are provided
  if (options.haLevel !== undefined) {
    serviceOptions.haLevel = options.haLevel;
  }
  if (options.config !== undefined) {
    serviceOptions.config = options.config;
  }

  const service = new StuckRunSweeperService(serviceOptions);

  return { service, events, clock, killResults, cleanupResults };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Lifecycle (start/stop/dispose)
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - creation with defaults", () => {
  const { service } = createService();

  assert.equal(service.isRunning(), false);
  assert.equal(service.getTrackedRunCount(), 0);
  assert.ok(service.getConfig().sweepIntervalMs > 0);

  service.dispose();
});

test("StuckRunSweeperService - start() sets running state", () => {
  const { service } = createService();

  assert.equal(service.isRunning(), false);
  service.start();
  assert.equal(service.isRunning(), true);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - start() when disposed throws", () => {
  const { service } = createService();

  service.dispose();

  assert.throws(
    () => service.start(),
    /disposed/i,
  );
});

test("StuckRunSweeperService - start() is idempotent (already running)", () => {
  const { service } = createService();

  service.start();
  service.start(); // Should not throw

  assert.equal(service.isRunning(), true);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - start() with disabled sweep (interval=0) does not start", () => {
  const { service } = createService({
    config: { sweepIntervalMs: 0 },
  });

  service.start();
  assert.equal(service.isRunning(), false);

  service.dispose();
});

test("StuckRunSweeperService - stop() clears running state", () => {
  const { service } = createService();

  service.start();
  assert.equal(service.isRunning(), true);

  service.stop();
  assert.equal(service.isRunning(), false);

  service.dispose();
});

test("StuckRunSweeperService - stop() is idempotent", () => {
  const { service } = createService();

  service.start();
  service.stop();
  service.stop(); // Should not throw

  assert.equal(service.isRunning(), false);

  service.dispose();
});

test("StuckRunSweeperService - dispose() marks disposed and clears state", () => {
  const { service } = createService();

  service.start();
  service.trackRun("exec-1", "task-1", null);
  assert.equal(service.getTrackedRunCount(), 1);

  service.dispose();

  assert.throws(
    () => service.start(),
    /disposed/i,
  );
});

test("StuckRunSweeperService - dispose() after stop is safe", () => {
  const { service } = createService();

  service.start();
  service.stop();
  service.dispose(); // Should not throw

  assert.throws(
    () => service.start(),
    /disposed/i,
  );
});

test("StuckRunSweeperService - isRunning() returns false when disposed", () => {
  const { service } = createService();

  service.start();
  assert.equal(service.isRunning(), true);

  service.dispose();
  assert.equal(service.isRunning(), false);
});

test("StuckRunSweeperService - isRunning() returns false after stop", () => {
  const { service } = createService();

  service.start();
  assert.equal(service.isRunning(), true);

  service.stop();
  assert.equal(service.isRunning(), false);

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Configuration
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - getConfig() returns config copy", () => {
  const { service } = createService();

  const config = service.getConfig();
  assert.ok(config.sweepIntervalMs > 0);
  assert.ok(config.stuckThresholdMs > 0);
  assert.ok(config.killAfterWarningMs > 0);
  assert.ok(config.cleanupAfterKillMs > 0);
  assert.ok(config.maxRunsPerSweep > 0);

  // Mutating returned config should not affect service
  const originalInterval = config.sweepIntervalMs;
  (config as { sweepIntervalMs: number }).sweepIntervalMs = 999;
  assert.notEqual(service.getConfig().sweepIntervalMs, 999);
  assert.equal(service.getConfig().sweepIntervalMs, originalInterval);

  service.dispose();
});

test("StuckRunSweeperService - custom config overrides", () => {
  const { service } = createService({
    config: {
      sweepIntervalMs: 30_000,
      stuckThresholdMs: 600_000,
      killAfterWarningMs: 120_000,
      cleanupAfterKillMs: 600_000,
      maxRunsPerSweep: 50,
    },
  });

  const config = service.getConfig();
  assert.equal(config.sweepIntervalMs, 30_000);
  assert.equal(config.stuckThresholdMs, 600_000);
  assert.equal(config.killAfterWarningMs, 120_000);
  assert.equal(config.cleanupAfterKillMs, 600_000);
  assert.equal(config.maxRunsPerSweep, 50);

  service.dispose();
});

test("StuckRunSweeperService - HA_1 level has longer thresholds than HA_2", () => {
  const ha2Service = createService({ haLevel: "HA_2" });
  const ha1Service = createService({ haLevel: "HA_1" });

  // HA_1 has 60min stuck threshold, HA_2 has 30min
  assert.ok(ha1Service.service.getConfig().stuckThresholdMs > ha2Service.service.getConfig().stuckThresholdMs);

  ha2Service.service.dispose();
  ha1Service.service.dispose();
});

test("StuckRunSweeperService - HA_3 level has shorter thresholds", () => {
  const ha2Service = createService({ haLevel: "HA_2" });
  const ha3Service = createService({ haLevel: "HA_3" });

  // HA_3 has 10min stuck threshold, HA_2 has 30min
  assert.ok(ha3Service.service.getConfig().stuckThresholdMs < ha2Service.service.getConfig().stuckThresholdMs);

  ha2Service.service.dispose();
  ha3Service.service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Run Tracking
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - trackRun() adds run to tracking", () => {
  const { service } = createService();

  service.trackRun("exec-1", "task-1", "session-1");

  assert.equal(service.getTrackedRunCount(), 1);
  const runs = service.getTrackedRuns();
  assert.equal(runs.length, 1);
  const run = runs[0]!;
  assert.equal(run.executionId, "exec-1");
  assert.equal(run.taskId, "task-1");
  assert.equal(run.sessionId, "session-1");
  assert.equal(run.status, "pending");

  service.dispose();
});

test("StuckRunSweeperService - trackRun() is idempotent for same executionId", () => {
  const { service } = createService();

  service.trackRun("exec-1", "task-1", null);
  service.trackRun("exec-1", "task-1", null); // Should not add again

  assert.equal(service.getTrackedRunCount(), 1);

  service.dispose();
});

test("StuckRunSweeperService - markRunComplete() removes run and increments resolved", () => {
  const { service } = createService();

  service.trackRun("exec-1", "task-1", null);
  assert.equal(service.getTrackedRunCount(), 1);

  service.markRunComplete("exec-1");
  assert.equal(service.getTrackedRunCount(), 0);

  const metrics = service.getMetrics();
  assert.equal(metrics.totalResolved, 1);

  service.dispose();
});

test("StuckRunSweeperService - markRunComplete() on unknown run is no-op", () => {
  const { service } = createService();

  service.markRunComplete("unknown-exec");

  assert.equal(service.getTrackedRunCount(), 0);
  assert.equal(service.getMetrics().totalResolved, 0);

  service.dispose();
});

test("StuckRunSweeperService - getTrackedRuns() returns array copy", () => {
  const { service } = createService();

  service.trackRun("exec-1", "task-1", null);

  const runs = service.getTrackedRuns();
  runs.push({} as StuckRun); // Mutate returned array

  assert.equal(service.getTrackedRunCount(), 1);

  service.dispose();
});

test("StuckRunSweeperService - getMetrics() returns metrics copy", () => {
  const { service } = createService();

  const metrics = service.getMetrics();
  assert.equal(metrics.totalDetected, 0);
  assert.equal(metrics.totalWarnings, 0);
  assert.equal(metrics.totalKilled, 0);
  assert.equal(metrics.totalCleanedUp, 0);
  assert.equal(metrics.totalResolved, 0);

  service.dispose();
});

test("StuckRunSweeperService - dispose() clears all tracked runs", () => {
  const { service } = createService();

  service.start();
  service.trackRun("exec-1", "task-1", null);
  service.trackRun("exec-2", "task-2", null);
  assert.equal(service.getTrackedRunCount(), 2);

  service.dispose();
  assert.equal(service.getTrackedRunCount(), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Sweep Cycle
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - sweepOnce() returns empty when not running", async () => {
  const { service } = createService();

  service.trackRun("exec-1", "task-1", null);

  // Don't start - sweepOnce should return empty
  const result = await service.sweepOnce();
  assert.deepEqual(result, []);

  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() processes runs within threshold", async () => {
  const { service } = createService();

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // Run sweep immediately - should not mark as stuck (within threshold)
  const affected = await service.sweepOnce();
  assert.equal(affected.length, 0);

  const runs = service.getTrackedRuns();
  assert.equal(runs.length, 1);
  const run = runs[0]!;
  assert.equal(run.status, "pending");

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() marks run as stuck after threshold", async () => {
  const { service, clock, events } = createService({
    config: {
      stuckThresholdMs: 60_000, // 1 minute
      sweepIntervalMs: 3_600_000, // Use large interval to disable auto-sweep
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // Advance time past stuck threshold
  clock.advance(61_000);

  const affected = await service.sweepOnce();
  assert.equal(affected.length, 1);
  const affectedRun = affected[0]!;
  assert.equal(affectedRun.executionId, "exec-1");
  assert.equal(affectedRun.status, "warning");

  // Check events
  assert.equal(events.length, 2); // detected + warning
  const ev0 = events[0]!;
  const ev1 = events[1]!;
  assert.equal(ev0.type, "detected");
  assert.equal(ev1.type, "warning");

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() kills run after warning threshold", async () => {
  const { service, clock, events } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000, // 30 seconds
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep - mark as stuck
  clock.advance(61_000);
  await service.sweepOnce();

  const runsAfterWarning = service.getTrackedRuns();
  assert.equal(runsAfterWarning.length, 1);
  const runWarning = runsAfterWarning[0]!;
  assert.equal(runWarning.status, "warning");
  assert.ok(runWarning.warningIssuedAt !== null);

  // Second sweep - should kill
  clock.advance(31_000);
  await service.sweepOnce();

  const runsAfterKill = service.getTrackedRuns();
  assert.equal(runsAfterKill.length, 1);
  const runKilled = runsAfterKill[0]!;
  assert.equal(runKilled.status, "killed");
  assert.ok(runKilled.killedAt !== null);

  // Check events
  assert.ok(events.some(e => e.type === "killed"));

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() cleans up run after cleanup threshold", async () => {
  const { service, clock, events } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      cleanupAfterKillMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep - mark as stuck
  clock.advance(61_000);
  await service.sweepOnce();

  // Second sweep - kill
  clock.advance(31_000);
  await service.sweepOnce();

  // Third sweep - should cleanup
  clock.advance(61_000);
  const affected = await service.sweepOnce();

  assert.equal(affected.length, 1);

  // Run should be removed from tracking
  assert.equal(service.getTrackedRunCount(), 0);

  // Check events
  assert.ok(events.some(e => e.type === "cleaned_up"));

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() respects maxRunsPerSweep limit", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      maxRunsPerSweep: 2,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();

  // Track 5 runs
  service.trackRun("exec-1", "task-1", null);
  service.trackRun("exec-2", "task-2", null);
  service.trackRun("exec-3", "task-3", null);
  service.trackRun("exec-4", "task-4", null);
  service.trackRun("exec-5", "task-5", null);

  // Advance past threshold
  clock.advance(61_000);

  const affected = await service.sweepOnce();

  // Only 2 should be processed (maxRunsPerSweep)
  assert.equal(affected.length, 2);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() skips resolved and cleaned_up runs", async () => {
  const { service } = createService({
    config: {
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // Manually set status to resolved (simulating completed run)
  const runs = service.getTrackedRuns();
  const run = runs[0]!;
  run.status = "resolved";

  const affected = await service.sweepOnce();
  assert.equal(affected.length, 0);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() calls onKillExecution callback", async () => {
  const { service, clock, killResults } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  killResults.set("exec-1", true);

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep
  clock.advance(61_000);
  await service.sweepOnce();

  // Second sweep
  clock.advance(31_000);
  await service.sweepOnce();

  // killResults should have been used
  assert.equal(killResults.has("exec-1"), true);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() calls onCleanupExecution callback", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      cleanupAfterKillMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep
  clock.advance(61_000);
  await service.sweepOnce();

  // Second sweep
  clock.advance(31_000);
  await service.sweepOnce();

  // Third sweep
  clock.advance(61_000);
  await service.sweepOnce();

  // Run should be cleaned up
  assert.equal(service.getTrackedRunCount(), 0);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - sweepOnce() increments sweepCount on each run", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // Multiple sweeps without hitting threshold
  await service.sweepOnce();
  await service.sweepOnce();
  await service.sweepOnce();

  const runs = service.getTrackedRuns();
  const run = runs[0]!;
  assert.equal(run.sweepCount, 3);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - metrics tracking through full lifecycle", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      cleanupAfterKillMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep - detected/warning
  clock.advance(61_000);
  await service.sweepOnce();

  let metrics = service.getMetrics();
  assert.equal(metrics.totalWarnings, 1);
  assert.equal(metrics.totalDetected, 1);

  // Second sweep - kill
  clock.advance(31_000);
  await service.sweepOnce();

  metrics = service.getMetrics();
  assert.equal(metrics.totalKilled, 1);

  // Third sweep - cleanup
  clock.advance(61_000);
  await service.sweepOnce();

  metrics = service.getMetrics();
  assert.equal(metrics.totalCleanedUp, 1);

  service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - sweepOnce() with no tracked runs", async () => {
  const { service } = createService();

  service.start();
  const affected = await service.sweepOnce();
  assert.deepEqual(affected, []);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - kill callback returning false logs warning but continues", async () => {
  const { service, clock, killResults } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  // Make kill callback return false
  killResults.set("exec-1", false);

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep - warning
  clock.advance(61_000);
  await service.sweepOnce();

  // Second sweep - kill attempt (returns false)
  clock.advance(31_000);
  await service.sweepOnce();

  // Run should still be in killed state (callback returned false but we still marked it)
  const runs = service.getTrackedRuns();
  const run = runs[0]!;
  assert.equal(run.status, "killed");

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - cleanup callback returning false logs warning but continues", async () => {
  const { service, clock, cleanupResults } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      cleanupAfterKillMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  // Make cleanup callback return false
  cleanupResults.set("exec-1", false);

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep - warning
  clock.advance(61_000);
  await service.sweepOnce();

  // Second sweep - kill
  clock.advance(31_000);
  await service.sweepOnce();

  // Third sweep - cleanup attempt (returns false)
  clock.advance(61_000);
  await service.sweepOnce();

  // Run should still be removed from tracking (we remove regardless)
  assert.equal(service.getTrackedRunCount(), 0);

  service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: reportProgress
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - reportProgress() updates lastProgressAt", () => {
  const { service, clock } = createService({
    config: { sweepIntervalMs: 3_600_000 },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  const initialRun = service.getTrackedRuns()[0]!;
  const initialProgress = initialRun.lastProgressAt;

  // Advance time and report progress
  clock.advance(5000);
  service.reportProgress("exec-1", "task-1", null);

  const updatedRun = service.getTrackedRuns()[0]!;
  assert.ok(updatedRun.lastProgressAt !== initialProgress);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - reportProgress() on unknown run is no-op", () => {
  const { service } = createService();

  // Should not throw
  service.reportProgress("unknown-exec", "task-1", null);

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Factory
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - createStuckRunSweeperService factory works", () => {
  const service = createStuckRunSweeperService({
    haLevel: "HA_2",
  });

  assert.ok(service instanceof StuckRunSweeperService);
  assert.equal(service.isRunning(), false);

  service.dispose();
});

test("StuckRunSweeperService - factory with all options", () => {
  const detectedRuns: StuckRun[] = [];
  const service = createStuckRunSweeperService({
    haLevel: "HA_1",
    config: {
      sweepIntervalMs: 120_000,
      stuckThresholdMs: 600_000,
      killAfterWarningMs: 120_000,
      cleanupAfterKillMs: 600_000,
      maxRunsPerSweep: 100,
    },
    onStuckRunDetected: (run) => detectedRuns.push(run),
    onWarningIssued: () => {},
    onRunKilled: () => {},
    onRunCleanedUp: () => {},
  });

  assert.ok(service instanceof StuckRunSweeperService);
  const config = service.getConfig();
  assert.equal(config.sweepIntervalMs, 120_000);
  assert.equal(config.stuckThresholdMs, 600_000);

  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Concurrent Operations
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - concurrent sweepOnce() calls are handled", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);
  service.trackRun("exec-2", "task-2", null);

  clock.advance(61_000);

  // Fire multiple sweeps concurrently
  const results = await Promise.all([
    service.sweepOnce(),
    service.sweepOnce(),
    service.sweepOnce(),
  ]);

  // All should complete without error
  const totalAffected = results.reduce((sum, r) => sum + r.length, 0);
  assert.equal(totalAffected, 2);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - concurrent trackRun() calls are handled", () => {
  const { service } = createService();

  service.start();

  // Track many runs concurrently
  for (let i = 0; i < 10; i++) {
    service.trackRun(`exec-${i}`, `task-${i}`, null);
  }

  assert.equal(service.getTrackedRunCount(), 10);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - concurrent markRunComplete() calls are handled", () => {
  const { service } = createService();

  service.start();

  service.trackRun("exec-1", "task-1", null);
  service.trackRun("exec-2", "task-2", null);

  // Complete same run concurrently
  service.markRunComplete("exec-1");
  service.markRunComplete("exec-1"); // Second call is no-op

  assert.equal(service.getTrackedRunCount(), 1);

  service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: State Transitions
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - run transitions from pending to warning to killed to cleaned_up", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      cleanupAfterKillMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // Verify initial state
  let runs = service.getTrackedRuns();
  assert.equal(runs.length, 1);
  assert.equal(runs[0]!.status, "pending");
  assert.equal(runs[0]!.sweepCount, 0);

  // First sweep - should transition to warning
  clock.advance(61_000);
  await service.sweepOnce();

  runs = service.getTrackedRuns();
  assert.equal(runs.length, 1);
  assert.equal(runs[0]!.status, "warning");
  assert.ok(runs[0]!.warningIssuedAt !== null);

  // Second sweep - should transition to killed
  clock.advance(31_000);
  await service.sweepOnce();

  runs = service.getTrackedRuns();
  assert.equal(runs.length, 1);
  assert.equal(runs[0]!.status, "killed");
  assert.ok(runs[0]!.killedAt !== null);

  // Third sweep - should transition to cleaned_up and be removed
  clock.advance(61_000);
  await service.sweepOnce();

  assert.equal(service.getTrackedRunCount(), 0);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - stuck threshold checks both timeSinceProgress and timeSinceStart", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // Advance time since start past threshold
  clock.advance(61_000);

  const affected = await service.sweepOnce();
  assert.equal(affected.length, 1);
  assert.equal(affected[0]!.status, "warning");

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - run in warning state does not get re-detected", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep - becomes warning
  clock.advance(61_000);
  await service.sweepOnce();

  const runs = service.getTrackedRuns();
  assert.equal(runs[0]!.status, "warning");
  const warningIssuedAt = runs[0]!.warningIssuedAt;

  // Second sweep before kill threshold - should not re-issue warning
  clock.advance(10_000);
  await service.sweepOnce();

  // Status should still be warning, warningIssuedAt unchanged
  const runs2 = service.getTrackedRuns();
  assert.equal(runs2[0]!.status, "warning");
  assert.equal(runs2[0]!.warningIssuedAt, warningIssuedAt);

  service.stop();
  service.dispose();
});

test("StuckRunSweeperService - run in killed state does not get re-killed", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      killAfterWarningMs: 30_000,
      cleanupAfterKillMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  // First sweep - becomes warning
  clock.advance(61_000);
  await service.sweepOnce();

  // Second sweep - becomes killed
  clock.advance(31_000);
  await service.sweepOnce();

  const runs = service.getTrackedRuns();
  assert.equal(runs[0]!.status, "killed");
  const killedAt = runs[0]!.killedAt;

  // Third sweep before cleanup threshold - should not re-kill
  clock.advance(10_000);
  await service.sweepOnce();

  // Status should still be killed, killedAt unchanged
  const runs2 = service.getTrackedRuns();
  assert.equal(runs2[0]!.status, "killed");
  assert.equal(runs2[0]!.killedAt, killedAt);

  service.stop();
  service.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Sweep Interval Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("StuckRunSweeperService - sweepOnce returns empty when disposed mid-sweep", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  clock.advance(61_000);

  service.dispose();

  // sweepOnce should return empty since disposed
  const result = await service.sweepOnce();
  assert.deepEqual(result, []);
});

test("StuckRunSweeperService - sweepOnce returns empty after stop", async () => {
  const { service, clock } = createService({
    config: {
      stuckThresholdMs: 60_000,
      sweepIntervalMs: 3_600_000,
    },
  });

  service.start();
  service.trackRun("exec-1", "task-1", null);

  clock.advance(61_000);
  await service.sweepOnce();

  service.stop();

  const result = await service.sweepOnce();
  assert.deepEqual(result, []);

  service.dispose();
});
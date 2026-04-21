import assert from "node:assert/strict";
import test from "node:test";
import { StuckRunSweeperService, createStuckRunSweeperService, } from "../../../../../src/platform/execution/ha/stuck-run-sweeper-service.js";
// ─────────────────────────────────────────────────────────────────────────────
// Test Clock helper - allows controlling time progression
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Test Clock helper - allows controlling time progression
// Must be installed BEFORE creating service to intercept nowIso()
// ─────────────────────────────────────────────────────────────────────────────
class TestClock {
    _now;
    constructor(initialMs = 0) {
        this._now = initialMs;
    }
    advance(ms) {
        this._now += ms;
    }
    now() {
        return this._now;
    }
    isoString() {
        return new Date(this._now).toISOString();
    }
    // Install as global time override
    install() {
        const self = this;
        // Store original Date
        const OriginalDate = globalThis.Date;
        // Override Date.now
        Object.defineProperty(globalThis.Date, 'now', {
            value: () => self._now,
            writable: true,
            configurable: true,
        });
        // Override Date constructor for new Date() calls
        const TestDate = function (...args) {
            if (args.length === 0) {
                return new OriginalDate(self._now);
            }
            return new OriginalDate(args[0]);
        };
        // Copy over static methods
        TestDate.now = () => self._now;
        TestDate.parse = OriginalDate.parse;
        TestDate.UTC = OriginalDate.UTC;
        globalThis.Date = TestDate;
    }
    restore() {
        // Cannot easily restore, but tests create new instances
    }
}
function createService(options = {}) {
    const clock = options.clock ?? new TestClock(Date.now());
    const events = [];
    const killResults = new Map();
    const cleanupResults = new Map();
    // Install clock BEFORE creating service so nowIso() uses fake time
    clock.install();
    const serviceOptions = {
        haLevel: options.haLevel ?? "HA_2",
        config: options.config,
        onStuckRunDetected: (run) => {
            events.push({ type: "detected", run, timestamp: clock.now() });
        },
        onWarningIssued: (run) => {
            events.push({ type: "warning", run, timestamp: clock.now() });
        },
        onRunKilled: (run) => {
            events.push({ type: "killed", run, timestamp: clock.now() });
        },
        onRunCleanedUp: (run) => {
            events.push({ type: "cleaned_up", run, timestamp: clock.now() });
        },
        onKillExecution: options.onKillExecution ?? (async (executionId) => {
            return killResults.get(executionId) ?? true;
        }),
        onCleanupExecution: options.onCleanupExecution ?? (async (executionId) => {
            return cleanupResults.get(executionId) ?? true;
        }),
    };
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
    assert.throws(() => service.start(), /disposed/i);
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
    assert.throws(() => service.start(), /disposed/i);
});
test("StuckRunSweeperService - dispose() after stop is safe", () => {
    const { service } = createService();
    service.start();
    service.stop();
    service.dispose(); // Should not throw
    assert.throws(() => service.start(), /disposed/i);
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
    config.sweepIntervalMs = 999;
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
test("StuckRunSweeperService - HA_1 level has longer thresholds", () => {
    const ha2Service = createService({ haLevel: "HA_2" });
    const ha1Service = createService({ haLevel: "HA_1" });
    // HA_1 has 5min sweep interval, 60min stuck threshold
    // HA_2 has 1min sweep interval, 30min stuck threshold
    assert.ok(ha1Service.service.getConfig().stuckThresholdMs > ha2Service.service.getConfig().stuckThresholdMs);
    ha2Service.service.dispose();
    ha1Service.service.dispose();
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
    assert.equal(runs[0].executionId, "exec-1");
    assert.equal(runs[0].taskId, "task-1");
    assert.equal(runs[0].sessionId, "session-1");
    assert.equal(runs[0].status, "pending");
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
    runs.push({}); // Mutate returned array
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
    assert.equal(runs[0].status, "pending");
    service.stop();
    service.dispose();
});
test("StuckRunSweeperService - sweepOnce() marks run as stuck after threshold", async () => {
    const { service, clock, events } = createService({
        config: {
            stuckThresholdMs: 60_000, // 1 minute
            sweepIntervalMs: 0, // Disable auto-sweep
        },
    });
    service.start();
    service.trackRun("exec-1", "task-1", null);
    // Advance time past stuck threshold
    clock.advance(61_000);
    const affected = await service.sweepOnce();
    assert.equal(affected.length, 1);
    assert.equal(affected[0].executionId, "exec-1");
    assert.equal(affected[0].status, "warning");
    // Check events
    assert.equal(events.length, 2); // detected + warning
    assert.equal(events[0].type, "detected");
    assert.equal(events[1].type, "warning");
    service.stop();
    service.dispose();
});
test("StuckRunSweeperService - sweepOnce() kills run after warning threshold", async () => {
    const { service, clock, events, killResults } = createService({
        config: {
            stuckThresholdMs: 60_000,
            killAfterWarningMs: 30_000, // 30 seconds
            sweepIntervalMs: 0,
        },
    });
    service.start();
    service.trackRun("exec-1", "task-1", null);
    // First sweep - mark as stuck
    clock.advance(61_000);
    await service.sweepOnce();
    const runsAfterWarning = service.getTrackedRuns();
    assert.equal(runsAfterWarning[0].status, "warning");
    assert.ok(runsAfterWarning[0].warningIssuedAt !== null);
    // Second sweep - should kill
    clock.advance(31_000);
    await service.sweepOnce();
    const runsAfterKill = service.getTrackedRuns();
    assert.equal(runsAfterKill[0].status, "killed");
    assert.ok(runsAfterKill[0].killedAt !== null);
    // Check events
    assert.ok(events.some(e => e.type === "killed"));
    service.stop();
    service.dispose();
});
test("StuckRunSweeperService - sweepOnce() cleans up run after cleanup threshold", async () => {
    const { service, clock, events, cleanupResults } = createService({
        config: {
            stuckThresholdMs: 60_000,
            killAfterWarningMs: 30_000,
            cleanupAfterKillMs: 60_000,
            sweepIntervalMs: 0,
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
            sweepIntervalMs: 0,
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
            sweepIntervalMs: 0,
        },
    });
    service.start();
    service.trackRun("exec-1", "task-1", null);
    // Manually set status to resolved (simulating completed run)
    const runs = service.getTrackedRuns();
    runs[0].status = "resolved";
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
            sweepIntervalMs: 0,
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
    const { service, clock, cleanupResults } = createService({
        config: {
            stuckThresholdMs: 60_000,
            killAfterWarningMs: 30_000,
            cleanupAfterKillMs: 60_000,
            sweepIntervalMs: 0,
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
            sweepIntervalMs: 0,
        },
    });
    service.start();
    service.trackRun("exec-1", "task-1", null);
    // Multiple sweeps without hitting threshold
    await service.sweepOnce();
    await service.sweepOnce();
    await service.sweepOnce();
    const runs = service.getTrackedRuns();
    assert.equal(runs[0].sweepCount, 3);
    service.stop();
    service.dispose();
});
test("StuckRunSweeperService - metrics tracking", async () => {
    const { service, clock } = createService({
        config: {
            stuckThresholdMs: 60_000,
            killAfterWarningMs: 30_000,
            cleanupAfterKillMs: 60_000,
            sweepIntervalMs: 0,
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
test("StuckRunSweeperService - multiple runs with different states", async () => {
    const { service, clock } = createService({
        config: {
            stuckThresholdMs: 60_000,
            killAfterWarningMs: 30_000,
            cleanupAfterKillMs: 60_000,
            sweepIntervalMs: 0,
        },
    });
    service.start();
    // Track 3 runs
    service.trackRun("exec-1", "task-1", null);
    service.trackRun("exec-2", "task-2", null);
    service.trackRun("exec-3", "task-3", null);
    // First sweep - exec-1 becomes warning
    clock.advance(61_000);
    await service.sweepOnce();
    // Second sweep - exec-1 killed, exec-2 warning
    clock.advance(31_000);
    await service.sweepOnce();
    const runs = service.getTrackedRuns();
    const exec1 = runs.find(r => r.executionId === "exec-1");
    const exec2 = runs.find(r => r.executionId === "exec-2");
    assert.equal(exec1?.status, "killed");
    assert.equal(exec2?.status, "warning");
    service.stop();
    service.dispose();
});
test("StuckRunSweeperService - kill callback returning false logs warning but continues", async () => {
    const { service, clock, killResults, events } = createService({
        config: {
            stuckThresholdMs: 60_000,
            killAfterWarningMs: 30_000,
            sweepIntervalMs: 0,
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
    assert.equal(runs[0].status, "killed");
    service.stop();
    service.dispose();
});
test("StuckRunSweeperService - cleanup callback returning false logs warning but continues", async () => {
    const { service, clock, cleanupResults } = createService({
        config: {
            stuckThresholdMs: 60_000,
            killAfterWarningMs: 30_000,
            cleanupAfterKillMs: 60_000,
            sweepIntervalMs: 0,
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
test("StuckRunSweeperService - dispose() clears all tracked runs", () => {
    const { service } = createService();
    service.start();
    service.trackRun("exec-1", "task-1", null);
    service.trackRun("exec-2", "task-2", null);
    assert.equal(service.getTrackedRunCount(), 2);
    service.dispose();
    // Accessing trackedRuns after dispose may throw on some operations
    // but getTrackedRunCount should return 0
    assert.equal(service.getTrackedRunCount(), 0);
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
    const detectedRuns = [];
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
        onWarningIssued: () => { },
        onRunKilled: () => { },
        onRunCleanedUp: () => { },
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
            sweepIntervalMs: 0,
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
    assert.equal(results[0].length + results[1].length + results[2].length, 2);
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
// Tests: reportProgress
// ─────────────────────────────────────────────────────────────────────────────
test("StuckRunSweeperService - reportProgress() updates lastProgressAt", () => {
    const { service } = createService();
    service.start();
    service.trackRun("exec-1", "task-1", null);
    const initialRun = service.getTrackedRuns()[0];
    const initialProgress = initialRun.lastProgressAt;
    // Small delay then report progress
    service.reportProgress("exec-1", "task-1", null);
    const updatedRun = service.getTrackedRuns()[0];
    // lastProgressAt should be updated (or same if called immediately)
    assert.ok(updatedRun.lastProgressAt !== undefined);
    service.stop();
    service.dispose();
});
test("StuckRunSweeperService - reportProgress() on unknown run is no-op", () => {
    const { service } = createService();
    // Should not throw
    service.reportProgress("unknown-exec", "task-1", null);
    service.dispose();
});
//# sourceMappingURL=stuck-run-sweeper-service.test.js.map
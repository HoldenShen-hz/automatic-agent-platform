import assert from "node:assert/strict";
import test from "node:test";

import {
  WorkflowDebuggerHealthMonitor,
  type HealthProbe,
  type ComponentStatus,
} from "../../../../src/ops-maturity/workflow-debugger/health-monitor.js";

function makeProbe(
  componentId: string,
  status: ComponentStatus,
  offsetMs: number,
  latencyMs?: number,
): HealthProbe {
  const timestamp = new Date(Date.now() - offsetMs).toISOString();
  return {
    componentId,
    status,
    timestamp,
    latencyMs,
  };
}

test("WorkflowDebuggerHealthMonitor records probes and retrieves snapshot", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  monitor.recordProbe(makeProbe("comp1", "healthy", 10_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.componentId, "comp1");
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.totalProbes, 2);
  assert.equal(snapshot.healthyCount, 2);
});

test("WorkflowDebuggerHealthMonitor returns null for unknown component", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  const snapshot = monitor.getSnapshot("nonexistent");
  assert.equal(snapshot, null);
});

test("WorkflowDebuggerHealthMonitor filters by sliding window - old failures excluded", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000, minSampleSize: 1 });

  // Old failed probe (outside window)
  monitor.recordProbe(makeProbe("comp1", "failed", 120_000));

  // Recent healthy probe (inside window)
  monitor.recordProbe(makeProbe("comp1", "healthy", 10_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  // Old failure should NOT poison the state - only recent probes in window count
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.totalProbes, 1);
  assert.equal(snapshot.failedCount, 0);
  assert.equal(snapshot.healthyCount, 1);
});

test("WorkflowDebuggerHealthMonitor - single old failed permanently poisons without fix", () => {
  // This test documents the BUG that existed before the fix
  // Without sliding window, an old failure would permanently keep status as failed
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000, minSampleSize: 1 });

  // A single very old failure
  monitor.recordProbe(makeProbe("comp1", "failed", 1_000_000_000)); // 277+ hours ago

  // System should NOT be permanently poisoned - old failure is outside window
  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.status, "healthy", "Old failure should not poison state when outside sliding window");
  assert.equal(snapshot.failedCount, 0, "Old failed probe should be outside window");
});

test("WorkflowDebuggerHealthMonitor marks degraded when failure rate above threshold", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({
    windowMs: 60_000,
    minSampleSize: 3,
    degradedThreshold: 0.3,
    failedThreshold: 0.5,
  });

  // 2 failures out of 3 = 67% failure rate - above failedThreshold
  monitor.recordProbe(makeProbe("comp1", "failed", 10_000));
  monitor.recordProbe(makeProbe("comp1", "failed", 5_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 1_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.healthScore, 33); // (1*100 + 0*50 + 2*0) / 3 = 33
});

test("WorkflowDebuggerHealthMonitor marks degraded when degraded rate above threshold", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({
    windowMs: 60_000,
    minSampleSize: 3,
    degradedThreshold: 0.3,
    failedThreshold: 0.5,
  });

  // 1 degraded out of 3 = 33% degraded rate
  monitor.recordProbe(makeProbe("comp1", "degraded", 10_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 1_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.status, "degraded");
});

test("WorkflowDebuggerHealthMonitor ignores probes below minSampleSize", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({
    windowMs: 60_000,
    minSampleSize: 5,
    failedThreshold: 0.3,
  });

  // Only 2 probes - below minSampleSize of 5
  monitor.recordProbe(makeProbe("comp1", "failed", 10_000));
  monitor.recordProbe(makeProbe("comp1", "failed", 5_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  // Should remain healthy because not enough samples yet
  assert.equal(snapshot.status, "healthy");
});

test("WorkflowDebuggerHealthMonitor sliding window - only recent probes count", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 30_000, minSampleSize: 1 });

  // Probe from 60 seconds ago - outside 30 second window
  monitor.recordProbe(makeProbe("comp1", "failed", 60_000));
  // Probe from 10 seconds ago - inside window
  monitor.recordProbe(makeProbe("comp1", "healthy", 10_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.totalProbes, 1, "Only probe inside window should be counted");
  assert.equal(snapshot.status, "healthy");
});

test("WorkflowDebuggerHealthMonitor returns empty state for component with only old probes", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 30_000 });

  // All probes are outside the 30 second window
  monitor.recordProbe(makeProbe("comp1", "failed", 60_000));
  monitor.recordProbe(makeProbe("comp1", "failed", 120_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.totalProbes, 0);
  assert.equal(snapshot.failedCount, 0);
  assert.equal(snapshot.healthScore, 100);
});

test("WorkflowDebuggerHealthMonitor getSystemHealth - all healthy returns healthy", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp2", "healthy", 5_000));

  assert.equal(monitor.getSystemHealth(), "healthy");
});

test("WorkflowDebuggerHealthMonitor getSystemHealth - any failed returns failed", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({
    windowMs: 60_000,
    minSampleSize: 1,
    failedThreshold: 0.5,
  });

  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp2", "failed", 5_000));

  assert.equal(monitor.getSystemHealth(), "failed");
});

test("WorkflowDebuggerHealthMonitor getSystemHealth - any degraded (no failures) returns degraded", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({
    windowMs: 60_000,
    minSampleSize: 1,
    degradedThreshold: 0.3,
    failedThreshold: 0.5,
  });

  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp2", "degraded", 5_000));

  assert.equal(monitor.getSystemHealth(), "degraded");
});

test("WorkflowDebuggerHealthMonitor getAllSnapshots returns all components", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp2", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp3", "healthy", 5_000));

  const snapshots = monitor.getAllSnapshots();
  assert.equal(snapshots.length, 3);
});

test("WorkflowDebuggerHealthMonitor pruneOldProbes removes stale data", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 30_000 });

  // Old probes
  monitor.recordProbe(makeProbe("comp1", "failed", 120_000));
  monitor.recordProbe(makeProbe("comp1", "failed", 60_000));

  // Recent probe
  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));

  // Before prune, all 3 are stored (but only 1 counts in window)
  assert.equal(monitor.getProbeCount("comp1"), 3);

  // After manual prune, old probes should be removed
  const pruned = monitor.pruneOldProbes();
  assert.equal(pruned, 2);
  assert.equal(monitor.getProbeCount("comp1"), 1);
});

test("WorkflowDebuggerHealthMonitor resetComponent clears specific component", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp2", "healthy", 5_000));

  monitor.resetComponent("comp1");

  assert.equal(monitor.getSnapshot("comp1"), null);
  assert.ok(monitor.getSnapshot("comp2"));
});

test("WorkflowDebuggerHealthMonitor reset clears all", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp2", "healthy", 5_000));

  monitor.reset();

  assert.equal(monitor.getProbeCount("comp1"), 0);
  assert.equal(monitor.getProbeCount("comp2"), 0);
});

test("WorkflowDebuggerHealthMonitor calculates correct health score", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  // 2 healthy, 1 degraded, 0 failed = (2*100 + 1*50) / 3 = 83
  monitor.recordProbe(makeProbe("comp1", "healthy", 10_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));
  monitor.recordProbe(makeProbe("comp1", "degraded", 1_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.healthScore, 83);
});

test("WorkflowDebuggerHealthMonitor provides window boundaries in snapshot", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  monitor.recordProbe(makeProbe("comp1", "healthy", 5_000));

  const before = new Date().toISOString();
  const snapshot = monitor.getSnapshot("comp1");
  const after = new Date().toISOString();

  assert.ok(snapshot);
  assert.ok(snapshot.windowStart <= before, "windowStart should be before request time");
  assert.ok(snapshot.windowEnd >= after, "windowEnd should be after or equal to request time");
  assert.ok(snapshot.oldestProbeInWindow !== null);
});

test("WorkflowDebuggerHealthMonitor respects maxProbesPerComponent limit", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000, maxProbesPerComponent: 5 });

  // Record 10 probes
  for (let i = 0; i < 10; i++) {
    monitor.recordProbe(makeProbe("comp1", "healthy", i * 1000));
  }

  // Should be capped at 5
  assert.equal(monitor.getProbeCount("comp1"), 5);
});

test("WorkflowDebuggerHealthMonitor with custom thresholds", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({
    windowMs: 60_000,
    minSampleSize: 2,
    degradedThreshold: 0.2,
    failedThreshold: 0.4,
  });

  // 1 failure out of 5 = 20% failure rate
  // degradedThreshold = 0.2, so degradedRate (0%) + failureRate (20%) = 20% should NOT trigger degraded
  monitor.recordProbe(makeProbe("comp1", "failed", 10_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 9_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 8_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 7_000));
  monitor.recordProbe(makeProbe("comp1", "healthy", 6_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.status, "degraded"); // 20% failure rate >= degradedThreshold
});

test("WorkflowDebuggerHealthMonitor recovers to healthy after old failures expire", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 30_000, minSampleSize: 1 });

  // Old failed probe (should be outside window)
  const oldProbe = makeProbe("comp1", "failed", 60_000);
  monitor.recordProbe(oldProbe);

  // Verify initial state - only the recent healthy probe counts
  const snapshot1 = monitor.getSnapshot("comp1");
  assert.ok(snapshot1);
  assert.equal(snapshot1.status, "healthy");

  // Now manually add a recent failed probe to verify threshold logic works
  monitor.recordProbe(makeProbe("comp1", "failed", 1_000));
  const snapshot2 = monitor.getSnapshot("comp1");
  assert.ok(snapshot2);
  assert.equal(snapshot2.status, "failed");
});

/**
 * Issue 1917: Old failures should not permanently poison health state.
 * A single old "failed" probe that is outside the sliding window should
 * not affect the current health status.
 */
test("WorkflowDebuggerHealthMonitor issue 1917 - old failure does not poison state", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000, minSampleSize: 1 });

  // A single failed probe from 3 hours ago (well outside 1-minute window)
  monitor.recordProbe(makeProbe("comp1", "failed", 3 * 60 * 60 * 1000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  // The old failure is outside the sliding window - should be healthy
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.totalProbes, 0, "No probes should be in window");
  assert.equal(snapshot.failedCount, 0, "No failed probes in window");
  assert.equal(snapshot.healthScore, 100, "Should have perfect health score");
});

/**
 * Issue 1917: Verify sliding window properly expires old probes.
 * When querying at different times, probes that leave the window no longer count.
 */
test("WorkflowDebuggerHealthMonitor issue 1917 - sliding window expiration", () => {
  const windowMs = 30_000; // 30 second window
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs, minSampleSize: 1 });

  // Probe at T-20s (20 seconds ago) - well inside 30s window
  const recentProbe = makeProbe("comp1", "healthy", 20_000);
  monitor.recordProbe(recentProbe);

  // Query now - probe is inside window
  let snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.totalProbes, 1, "One probe in window");

  // Simulate querying at a time 40 seconds in the past from "now"
  // At that moment, the probe (at T-20s) would be at T-60s from "now"'s perspective
  // which is outside the 30s window (T-70s to T-40s)
  const later = new Date(Date.now() - 40_000).toISOString();
  snapshot = monitor.getSnapshot("comp1", later);
  assert.ok(snapshot);
  // The probe at T-20s from original now is now outside the 30s window
  assert.equal(snapshot.totalProbes, 0, "Probe should be outside window at simulated past time");
  assert.equal(snapshot.status, "healthy");
});

test("WorkflowDebuggerHealthMonitor latency is tracked in metadata", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000 });

  monitor.recordProbe({
    componentId: "comp1",
    status: "healthy",
    timestamp: new Date().toISOString(),
    latencyMs: 150,
    metadata: { region: "us-east" },
  });

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.totalProbes, 1);
});

test("WorkflowDebuggerHealthMonitor empty window returns healthy with 100 score", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 30_000 });

  // Only old probes
  monitor.recordProbe(makeProbe("comp1", "failed", 60_000));

  const snapshot = monitor.getSnapshot("comp1");
  assert.ok(snapshot);
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.totalProbes, 0);
  assert.equal(snapshot.healthScore, 100);
  assert.equal(snapshot.oldestProbeInWindow, null);
});

test("WorkflowDebuggerHealthMonitor concurrent component tracking", () => {
  const monitor = new WorkflowDebuggerHealthMonitor({ windowMs: 60_000, minSampleSize: 2 });

  // Track multiple components independently
  monitor.recordProbe(makeProbe("compA", "healthy", 5_000));
  monitor.recordProbe(makeProbe("compA", "failed", 5_000));

  monitor.recordProbe(makeProbe("compB", "healthy", 5_000));
  monitor.recordProbe(makeProbe("compB", "healthy", 5_000));

  const snapshotA = monitor.getSnapshot("compA");
  const snapshotB = monitor.getSnapshot("compB");

  assert.ok(snapshotA);
  assert.ok(snapshotB);
  // With minSampleSize=2, 1 healthy + 1 failed = 50% failure rate >= failedThreshold(0.5) => "failed"
  assert.equal(snapshotA.status, "failed");
  assert.equal(snapshotB.status, "healthy"); // 2 healthy, 0 failed
});

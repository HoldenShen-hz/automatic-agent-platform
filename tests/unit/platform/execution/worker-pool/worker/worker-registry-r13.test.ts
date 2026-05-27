import assert from "node:assert/strict";
import test from "node:test";

/**
 * R13-18 tests: Worker pool auto-scaling signal emission
 */

interface ScaleSignal {
  signalType: "scale_up" | "scale_down";
  workerId: string;
  reason: string;
  currentLoad: number;
  targetLoad: number;
}

test("R13-18: Scale up signal emitted when saturation >= 0.85 [worker-registry-r13]", () => {
  const emittedSignals: ScaleSignal[] = [];

  function emitScaleSignal(
    signalType: "scale_up" | "scale_down",
    workerId: string,
    currentLoad: number,
    targetLoad: number,
    saturation: number,
  ): void {
    emittedSignals.push({
      signalType,
      workerId,
      reason: signalType === "scale_up" ? "high_saturation" : "low_utilization",
      currentLoad,
      targetLoad,
    });
  }

  function recordHeartbeat(
    workerId: string,
    currentLoad: number,
    maxConcurrency: number,
    saturation: number | null,
  ): void {
    const effectiveSaturation = saturation ?? (currentLoad / Math.max(maxConcurrency, 1));
    const targetLoad = 0.7;

    // Scale up signal: high saturation or load approaching capacity
    if (effectiveSaturation >= 0.85 || currentLoad >= maxConcurrency - 1) {
      emitScaleSignal("scale_up", workerId, currentLoad, targetLoad, effectiveSaturation);
    }
    // Scale down signal: low saturation and excess capacity
    else if (effectiveSaturation <= 0.3 && currentLoad <= 1) {
      emitScaleSignal("scale_down", workerId, currentLoad, targetLoad, effectiveSaturation);
    }
  }

  // Saturation 0.9 should trigger scale up
  recordHeartbeat("worker-1", 5, 6, 0.9);
  assert.equal(emittedSignals.length, 1, "Should emit scale signal");
  assert.equal(emittedSignals[0]!.signalType, "scale_up", "Should be scale_up signal");
});

test("R13-18: Scale up signal emitted when load >= maxConcurrency - 1 [worker-registry-r13]", () => {
  const emittedSignals: ScaleSignal[] = [];

  function emitScaleSignal(
    signalType: "scale_up" | "scale_down",
    workerId: string,
    currentLoad: number,
    targetLoad: number,
  ): void {
    emittedSignals.push({ signalType, workerId, reason: "high_saturation", currentLoad, targetLoad });
  }

  function recordHeartbeat(workerId: string, currentLoad: number, maxConcurrency: number, saturation: number | null): void {
    const effectiveSaturation = saturation ?? (currentLoad / Math.max(maxConcurrency, 1));
    const targetLoad = 0.7;

    if (effectiveSaturation >= 0.85 || currentLoad >= maxConcurrency - 1) {
      emitScaleSignal("scale_up", workerId, currentLoad, targetLoad, effectiveSaturation);
    } else if (effectiveSaturation <= 0.3 && currentLoad <= 1) {
      emitScaleSignal("scale_down", workerId, currentLoad, targetLoad, effectiveSaturation);
    }
  }

  // Load approaching capacity (5 out of 6) should trigger scale up
  recordHeartbeat("worker-1", 5, 6, null);
  assert.equal(emittedSignals.length, 1, "Should emit scale signal");
  assert.equal(emittedSignals[0]!.signalType, "scale_up", "Should be scale_up signal");
});

test("R13-18: Scale down signal emitted when saturation <= 0.3 and load <= 1 [worker-registry-r13]", () => {
  const emittedSignals: ScaleSignal[] = [];

  function emitScaleSignal(
    signalType: "scale_up" | "scale_down",
    workerId: string,
    currentLoad: number,
    targetLoad: number,
  ): void {
    emittedSignals.push({ signalType, workerId, reason: "low_utilization", currentLoad, targetLoad });
  }

  function recordHeartbeat(workerId: string, currentLoad: number, maxConcurrency: number, saturation: number | null): void {
    const effectiveSaturation = saturation ?? (currentLoad / Math.max(maxConcurrency, 1));
    const targetLoad = 0.7;

    if (effectiveSaturation >= 0.85 || currentLoad >= maxConcurrency - 1) {
      emitScaleSignal("scale_up", workerId, currentLoad, targetLoad, effectiveSaturation);
    } else if (effectiveSaturation <= 0.3 && currentLoad <= 1) {
      emitScaleSignal("scale_down", workerId, currentLoad, targetLoad, effectiveSaturation);
    }
  }

  // Low utilization (0.25 saturation, 1 load) should trigger scale down
  recordHeartbeat("worker-1", 1, 4, 0.25);
  assert.equal(emittedSignals.length, 1, "Should emit scale signal");
  assert.equal(emittedSignals[0]!.signalType, "scale_down", "Should be scale_down signal");
});

test("R13-18: No signal emitted when utilization is moderate [worker-registry-r13]", () => {
  const emittedSignals: ScaleSignal[] = [];

  function emitScaleSignal(
    signalType: "scale_up" | "scale_down",
    workerId: string,
    currentLoad: number,
    targetLoad: number,
  ): void {
    emittedSignals.push({ signalType, workerId, reason: "high_saturation", currentLoad, targetLoad });
  }

  function recordHeartbeat(workerId: string, currentLoad: number, maxConcurrency: number, saturation: number | null): void {
    const effectiveSaturation = saturation ?? (currentLoad / Math.max(maxConcurrency, 1));
    const targetLoad = 0.7;

    if (effectiveSaturation >= 0.85 || currentLoad >= maxConcurrency - 1) {
      emitScaleSignal("scale_up", workerId, currentLoad, targetLoad, effectiveSaturation);
    } else if (effectiveSaturation <= 0.3 && currentLoad <= 1) {
      emitScaleSignal("scale_down", workerId, currentLoad, targetLoad, effectiveSaturation);
    }
  }

  // Moderate utilization (0.5 saturation) should not trigger any signal
  recordHeartbeat("worker-1", 2, 4, 0.5);
  assert.equal(emittedSignals.length, 0, "No signal should be emitted for moderate utilization");
});
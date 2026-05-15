import assert from "node:assert/strict";
import test from "node:test";

import type { ObservationDelta } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/types/observation-delta.js";

function createObservationDelta(overrides: Partial<ObservationDelta> = {}): ObservationDelta {
  return {
    taskId: "task-1",
    previousTimestamp: 1000,
    currentTimestamp: 2000,
    addedFields: [],
    removedFields: [],
    changedFields: [],
    previousValues: {},
    currentValues: {},
    metricDeltas: {},
    newBlockers: [],
    resolvedBlockers: [],
    significant: false,
    ...overrides,
  };
}

test("ObservationDelta has required fields", () => {
  const delta = createObservationDelta();
  assert.equal(delta.taskId, "task-1");
  assert.equal(delta.previousTimestamp, 1000);
  assert.equal(delta.currentTimestamp, 2000);
});

test("ObservationDelta tracks added fields", () => {
  const delta = createObservationDelta({
    addedFields: ["newField1", "newField2"],
    currentValues: { newField1: "value1", newField2: "value2" },
  });

  assert.deepEqual(delta.addedFields, ["newField1", "newField2"]);
  assert.equal(delta.currentValues["newField1"], "value1");
});

test("ObservationDelta tracks removed fields", () => {
  const delta = createObservationDelta({
    removedFields: ["oldField"],
    previousValues: { oldField: "oldValue" },
  });

  assert.deepEqual(delta.removedFields, ["oldField"]);
  assert.equal(delta.previousValues["oldField"], "oldValue");
});

test("ObservationDelta tracks changed fields", () => {
  const delta = createObservationDelta({
    changedFields: ["status", "progress"],
    previousValues: { status: "pending", progress: 0 },
    currentValues: { status: "running", progress: 50 },
  });

  assert.deepEqual(delta.changedFields, ["status", "progress"]);
  assert.deepEqual(delta.metricDeltas, {});
});

test("ObservationDelta tracks metric deltas", () => {
  const delta = createObservationDelta({
    metricDeltas: {
      cpuUsage: { previous: 30, current: 60, delta: 30 },
      memoryUsage: { previous: 50, current: 80, delta: 30 },
    },
  });

  assert.equal(delta.metricDeltas["cpuUsage"]?.delta, 30);
  assert.equal(delta.metricDeltas["memoryUsage"]?.current, 80);
});

test("ObservationDelta tracks blockers", () => {
  const delta = createObservationDelta({
    newBlockers: ["network_timeout", "auth_failure"],
    resolvedBlockers: ["resource_lock"],
  });

  assert.deepEqual(delta.newBlockers, ["network_timeout", "auth_failure"]);
  assert.deepEqual(delta.resolvedBlockers, ["resource_lock"]);
});

test("ObservationDelta significance flag", () => {
  const deltaSignificant = createObservationDelta({ significant: true });
  const deltaNotSignificant = createObservationDelta({ significant: false });

  assert.equal(deltaSignificant.significant, true);
  assert.equal(deltaNotSignificant.significant, false);
});
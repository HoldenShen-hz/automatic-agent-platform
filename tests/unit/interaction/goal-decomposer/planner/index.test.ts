import assert from "node:assert/strict";
import test from "node:test";

import { buildExecutionBatches } from "../../../../../src/interaction/goal-decomposer/planner/index.js";
import type { DependencyEdge } from "../../../../../src/interaction/goal-decomposer/dependency-graph/index.js";

test("buildExecutionBatches places independent tasks in same batch", () => {
  const taskIds = ["a", "b", "c"];
  const edges: DependencyEdge[] = [];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0], ["a", "b", "c"]);
});

test("buildExecutionBatches places dependent tasks in sequential batches", () => {
  const taskIds = ["a", "b", "c"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "b" },
    { fromTask: "b", toTask: "c" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 3);
  assert.deepEqual(batches[0], ["a"]);
  assert.deepEqual(batches[1], ["b"]);
  assert.deepEqual(batches[2], ["c"]);
});

test("buildExecutionBatches places parallel tasks with same dependencies in same batch", () => {
  const taskIds = ["a", "b", "c"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "b" },
    { fromTask: "a", toTask: "c" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0], ["a"]);
  // b and c should be in the same batch since they both depend only on a
  assert.ok(batches[1]!.includes("b"));
  assert.ok(batches[1]!.includes("c"));
});

test("buildExecutionBatches handles diamond dependency", () => {
  const taskIds = ["a", "b", "c", "d"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "b" },
    { fromTask: "a", toTask: "c" },
    { fromTask: "b", toTask: "d" },
    { fromTask: "c", toTask: "d" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 3);
  assert.deepEqual(batches[0], ["a"]);
  // b and c should be in batch 1 together
  assert.ok(batches[1]!.includes("b"));
  assert.ok(batches[1]!.includes("c"));
  assert.deepEqual(batches[2], ["d"]);
});

test("buildExecutionBatches handles complex DAG", () => {
  const taskIds = ["t1", "t2", "t3", "t4", "t5", "t6"];
  const edges: DependencyEdge[] = [
    { fromTask: "t1", toTask: "t2" },
    { fromTask: "t1", toTask: "t3" },
    { fromTask: "t2", toTask: "t4" },
    { fromTask: "t3", toTask: "t4" },
    { fromTask: "t4", toTask: "t5" },
    { fromTask: "t2", toTask: "t6" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  // t1 -> (t2, t3) -> t4 -> t5, t2 -> t6
  // Batch 0: t1
  // Batch 1: t2, t3 (both depend only on t1)
  // Batch 2: t4, t6 (t4 depends on t2 and t3; t6 depends on t2)
  // Batch 3: t5
  assert.deepEqual(batches[0], ["t1"]);
  assert.ok(batches[1]!.includes("t2") && batches[1]!.includes("t3"));
  assert.ok(batches[2]!.includes("t4") && batches[2]!.includes("t6"));
  assert.deepEqual(batches[3], ["t5"]);
});

test("buildExecutionBatches handles empty task list", () => {
  const batches = buildExecutionBatches([], []);
  assert.deepEqual(batches, []);
});

test("buildExecutionBatches handles single task", () => {
  const batches = buildExecutionBatches(["a"], []);
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0], ["a"]);
});

test("buildExecutionBatches handles task with no dependencies", () => {
  const taskIds = ["a", "b"];
  const edges: DependencyEdge[] = [];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 1);
  assert.ok(batches[0]!.includes("a"));
  assert.ok(batches[0]!.includes("b"));
});

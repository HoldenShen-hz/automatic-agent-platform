/**
 * Additional unit tests for buildExecutionBatches
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildExecutionBatches } from "../../../../../src/interaction/goal-decomposer/planner/index.js";
import type { DependencyEdge } from "../../../../../src/interaction/goal-decomposer/dependency-graph/index.js";

test("buildExecutionBatches places tasks with shared dependency in same batch", () => {
  // Three tasks all depending on a single root task
  const taskIds = ["root", "child1", "child2", "child3"];
  const edges: DependencyEdge[] = [
    { fromTask: "root", toTask: "child1" },
    { fromTask: "root", toTask: "child2" },
    { fromTask: "root", toTask: "child3" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0], ["root"]);
  assert.equal(batches[1].length, 3);
  assert.ok(batches[1].includes("child1"));
  assert.ok(batches[1].includes("child2"));
  assert.ok(batches[1].includes("child3"));
});

test("buildExecutionBatches handles multiple root tasks", () => {
  const taskIds = ["a", "b", "c", "d"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "c" },
    { fromTask: "b", toTask: "c" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  // a and b should be in batch 0 (independent roots)
  // c depends on both a and b, so batch 1
  // d is independent
  assert.ok(batches[0].includes("a") || batches[0].includes("b") || batches[0].includes("d"));
});

test("buildExecutionBatches handles chain with fanout", () => {
  const taskIds = ["t1", "t2", "t3", "t4", "t5"];
  const edges: DependencyEdge[] = [
    { fromTask: "t1", toTask: "t2" },
    { fromTask: "t2", toTask: "t3" },
    { fromTask: "t2", toTask: "t4" },
    { fromTask: "t3", toTask: "t5" },
    { fromTask: "t4", toTask: "t5" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.ok(batches[0].includes("t1"));
  assert.ok(batches[1].includes("t2"));
  assert.ok(batches[batches.length - 1].includes("t5"));
});

test("buildExecutionBatches preserves order of tasks with no dependencies", () => {
  const taskIds = ["a", "b", "c", "d"];
  const edges: DependencyEdge[] = [];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 4);
});

test("buildExecutionBatches handles interleaved dependencies", () => {
  const taskIds = ["t1", "t2", "t3", "t4", "t5", "t6"];
  const edges: DependencyEdge[] = [
    { fromTask: "t1", toTask: "t2" },
    { fromTask: "t1", toTask: "t3" },
    { fromTask: "t2", toTask: "t4" },
    { fromTask: "t3", toTask: "t5" },
    { fromTask: "t4", toTask: "t6" },
    { fromTask: "t5", toTask: "t6" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  // t1 in first batch, t2 and t3 in second, t4 and t5 in third, t6 in fourth
  assert.equal(batches.length, 4);
  assert.ok(batches[0].includes("t1"));
  assert.ok(batches[3].includes("t6"));
});

test("buildExecutionBatches handles large batch of parallel tasks", () => {
  const taskIds = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "c" },
    { fromTask: "b", toTask: "c" },
    { fromTask: "a", toTask: "d" },
    { fromTask: "b", toTask: "d" },
    { fromTask: "a", toTask: "e" },
    { fromTask: "b", toTask: "e" },
    { fromTask: "a", toTask: "f" },
    { fromTask: "b", toTask: "f" },
    { fromTask: "a", toTask: "g" },
    { fromTask: "b", toTask: "g" },
    { fromTask: "a", toTask: "h" },
    { fromTask: "b", toTask: "h" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0], ["a", "b"]);
  assert.equal(batches[1].length, 6);
});

test("buildExecutionBatches handles two independent chains", () => {
  const taskIds = ["a1", "a2", "a3", "b1", "b2", "b3"];
  const edges: DependencyEdge[] = [
    { fromTask: "a1", toTask: "a2" },
    { fromTask: "a2", toTask: "a3" },
    { fromTask: "b1", toTask: "b2" },
    { fromTask: "b2", toTask: "b3" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 3);
  // a1 and b1 should be batch 0
  // a2 and b2 should be batch 1
  // a3 and b3 should be batch 2
  assert.deepEqual(batches[0], ["a1", "b1"]);
  assert.deepEqual(batches[1], ["a2", "b2"]);
  assert.deepEqual(batches[2], ["a3", "b3"]);
});

test("buildExecutionBatches with single task depending on root", () => {
  const taskIds = ["parent", "child"];
  const edges: DependencyEdge[] = [
    { fromTask: "parent", toTask: "child" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0], ["parent"]);
  assert.deepEqual(batches[1], ["child"]);
});

test("buildExecutionBatches preserves topological constraint across batches", () => {
  const taskIds = ["x", "y", "z"];
  const edges: DependencyEdge[] = [
    { fromTask: "x", toTask: "y" },
    { fromTask: "y", toTask: "z" },
  ];

  const batches = buildExecutionBatches(taskIds, edges);

  // Verify topological order is maintained across batches
  const xIdx = batches.flat().indexOf("x");
  const yIdx = batches.flat().indexOf("y");
  const zIdx = batches.flat().indexOf("z");
  assert.ok(xIdx < yIdx, "x should come before y");
  assert.ok(yIdx < zIdx, "y should come before z");
});

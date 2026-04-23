import assert from "node:assert/strict";
import test from "node:test";

import {
  detectDependencyCycle,
  topologicallySortTaskIds,
  type DependencyEdge,
} from "../../../../../src/interaction/goal-decomposer/dependency-graph/index.js";

test("topologicallySortTaskIds returns tasks in topological order", () => {
  const taskIds = ["a", "b", "c"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "b" },
    { fromTask: "b", toTask: "c" },
  ];

  const sorted = topologicallySortTaskIds(taskIds, edges);

  assert.equal(sorted.length, 3);
  const aIdx = sorted.indexOf("a");
  const bIdx = sorted.indexOf("b");
  const cIdx = sorted.indexOf("c");
  assert.ok(aIdx < bIdx, "a should come before b");
  assert.ok(bIdx < cIdx, "b should come before c");
});

test("topologicallySortTaskIds handles multiple roots", () => {
  const taskIds = ["a", "b", "c"];
  const edges: DependencyEdge[] = [];

  const sorted = topologicallySortTaskIds(taskIds, edges);

  assert.equal(sorted.length, 3);
  // All should be present
  assert.ok(sorted.includes("a"));
  assert.ok(sorted.includes("b"));
  assert.ok(sorted.includes("c"));
});

test("topologicallySortTaskIds handles diamond dependency", () => {
  const taskIds = ["a", "b", "c", "d"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "b" },
    { fromTask: "a", toTask: "c" },
    { fromTask: "b", toTask: "d" },
    { fromTask: "c", toTask: "d" },
  ];

  const sorted = topologicallySortTaskIds(taskIds, edges);

  assert.equal(sorted.length, 4);
  const aIdx = sorted.indexOf("a");
  const bIdx = sorted.indexOf("b");
  const cIdx = sorted.indexOf("c");
  const dIdx = sorted.indexOf("d");
  assert.ok(aIdx < bIdx, "a before b");
  assert.ok(aIdx < cIdx, "a before c");
  assert.ok(bIdx < dIdx, "b before d");
  assert.ok(cIdx < dIdx, "c before d");
});

test("topologicallySortTaskIds handles parallel tasks", () => {
  const taskIds = ["a", "b", "c", "d"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "b" },
    { fromTask: "a", toTask: "c" },
  ];

  const sorted = topologicallySortTaskIds(taskIds, edges);

  assert.equal(sorted.length, 4);
  assert.ok(sorted.indexOf("a") < sorted.indexOf("b"));
  assert.ok(sorted.indexOf("a") < sorted.indexOf("c"));
});

test("topologicallySortTaskIds handles empty task list", () => {
  const sorted = topologicallySortTaskIds([], []);
  assert.deepEqual(sorted, []);
});

test("topologicallySortTaskIds handles task list with no edges", () => {
  const taskIds = ["a", "b", "c"];
  const sorted = topologicallySortTaskIds(taskIds, []);

  assert.equal(sorted.length, 3);
});

test("detectDependencyCycle returns false when no cycle", () => {
  const taskIds = ["a", "b", "c"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "b" },
    { fromTask: "b", toTask: "c" },
  ];

  assert.equal(detectDependencyCycle(taskIds, edges), false);
});

test("detectDependencyCycle returns true when cycle exists", () => {
  const taskIds = ["a", "b", "c"];
  const edges: DependencyEdge[] = [
    { fromTask: "a", toTask: "b" },
    { fromTask: "b", toTask: "c" },
    { fromTask: "c", toTask: "a" },
  ];

  assert.equal(detectDependencyCycle(taskIds, edges), true);
});

test("detectDependencyCycle handles self-loop", () => {
  const taskIds = ["a"];
  const edges: DependencyEdge[] = [{ fromTask: "a", toTask: "a" }];

  assert.equal(detectDependencyCycle(taskIds, edges), true);
});

test("detectDependencyCycle handles empty inputs", () => {
  assert.equal(detectDependencyCycle([], []), false);
});

test("topologicallySortTaskIds with complex DAG", () => {
  const taskIds = ["task1", "task2", "task3", "task4", "task5", "task6"];
  const edges: DependencyEdge[] = [
    { fromTask: "task1", toTask: "task2" },
    { fromTask: "task1", toTask: "task3" },
    { fromTask: "task2", toTask: "task4" },
    { fromTask: "task3", toTask: "task4" },
    { fromTask: "task4", toTask: "task5" },
    { fromTask: "task2", toTask: "task6" },
  ];

  const sorted = topologicallySortTaskIds(taskIds, edges);

  assert.equal(sorted.length, 6);
  const idx = (t: string) => sorted.indexOf(t);
  assert.ok(idx("task1") < idx("task2"));
  assert.ok(idx("task1") < idx("task3"));
  assert.ok(idx("task2") < idx("task4"));
  assert.ok(idx("task3") < idx("task4"));
  assert.ok(idx("task4") < idx("task5"));
  assert.ok(idx("task2") < idx("task6"));
});

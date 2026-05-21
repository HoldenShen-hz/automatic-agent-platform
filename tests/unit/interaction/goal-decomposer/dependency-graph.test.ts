import { describe, it } from "node:test";
import assert from "node:assert";
import {
  topologicallySortTaskIds,
  detectDependencyCycle,
  type DependencyEdge,
} from "../../../../../src/interaction/goal-decomposer/dependency-graph/index.js";

describe("goal-decomposer/dependency-graph", () => {
  describe("topologicallySortTaskIds", () => {
    it("returns empty array for empty task list", () => {
      const result = topologicallySortTaskIds([], []);
      assert.deepStrictEqual(result, []);
    });

    it("returns single task when no edges", () => {
      const taskIds = ["task:1"];
      const result = topologicallySortTaskIds(taskIds, []);
      assert.deepStrictEqual(result, ["task:1"]);
    });

    it("returns tasks in topological order with sequential dependencies", () => {
      const taskIds = ["task:1", "task:2", "task:3"];
      const edges: DependencyEdge[] = [
        { fromTask: "task:1", toTask: "task:2" },
        { fromTask: "task:2", toTask: "task:3" },
      ];
      const result = topologicallySortTaskIds(taskIds, edges);
      assert.deepStrictEqual(result, ["task:1", "task:2", "task:3"]);
    });

    it("handles diamond dependency pattern", () => {
      const taskIds = ["task:A", "task:B", "task:C", "task:D"];
      const edges: DependencyEdge[] = [
        { fromTask: "task:A", toTask: "task:B" },
        { fromTask: "task:A", toTask: "task:C" },
        { fromTask: "task:B", toTask: "task:D" },
        { fromTask: "task:C", toTask: "task:D" },
      ];
      const result = topologicallySortTaskIds(taskIds, edges);
      assert.ok(result.indexOf("task:A") < result.indexOf("task:D"));
      assert.ok(result.indexOf("task:B") < result.indexOf("task:D"));
      assert.ok(result.indexOf("task:C") < result.indexOf("task:D"));
      assert.ok(result.indexOf("task:A") < result.indexOf("task:B"));
      assert.ok(result.indexOf("task:A") < result.indexOf("task:C"));
    });

    it("handles parallel tasks with same depth", () => {
      const taskIds = ["t1", "t2", "t3", "t4"];
      const edges: DependencyEdge[] = [
        { fromTask: "t1", toTask: "t3" },
        { fromTask: "t2", toTask: "t3" },
        { fromTask: "t3", toTask: "t4" },
      ];
      const result = topologicallySortTaskIds(taskIds, edges);
      const t1Idx = result.indexOf("t1");
      const t2Idx = result.indexOf("t2");
      const t3Idx = result.indexOf("t3");
      const t4Idx = result.indexOf("t4");
      assert.ok(t1Idx < t3Idx, "t1 should come before t3");
      assert.ok(t2Idx < t3Idx, "t2 should come before t3");
      assert.ok(t3Idx < t4Idx, "t3 should come before t4");
    });

    it("handles disconnected task graph", () => {
      const taskIds = ["a", "b", "c", "d"];
      const edges: DependencyEdge[] = [
        { fromTask: "a", toTask: "b" },
      ];
      const result = topologicallySortTaskIds(taskIds, edges);
      assert.ok(result.indexOf("a") < result.indexOf("b"), "a should come before b");
      assert.ok(result.includes("c"), "c should be in result");
      assert.ok(result.includes("d"), "d should be in result");
    });

    it("returns all tasks when edges reference non-existent tasks are filtered out", () => {
      const taskIds = ["t1", "t2"];
      const edges: DependencyEdge[] = [
        { fromTask: "t1", toTask: "t3" }, // t3 does not exist
      ];
      const result = topologicallySortTaskIds(taskIds, edges);
      assert.deepStrictEqual(result, ["t1", "t2"]);
    });
  });

  describe("detectDependencyCycle", () => {
    it("returns false for empty graph", () => {
      const result = detectDependencyCycle([], []);
      assert.strictEqual(result, false);
    });

    it("returns false for acyclic graph", () => {
      const taskIds = ["t1", "t2", "t3"];
      const edges: DependencyEdge[] = [
        { fromTask: "t1", toTask: "t2" },
        { fromTask: "t2", toTask: "t3" },
      ];
      const result = detectDependencyCycle(taskIds, edges);
      assert.strictEqual(result, false);
    });

    it("returns true for self-referencing cycle", () => {
      const taskIds = ["t1"];
      const edges: DependencyEdge[] = [
        { fromTask: "t1", toTask: "t1" },
      ];
      const result = detectDependencyCycle(taskIds, edges);
      assert.strictEqual(result, true);
    });

    it("returns true for simple cycle", () => {
      const taskIds = ["t1", "t2", "t3"];
      const edges: DependencyEdge[] = [
        { fromTask: "t1", toTask: "t2" },
        { fromTask: "t2", toTask: "t3" },
        { fromTask: "t3", toTask: "t1" },
      ];
      const result = detectDependencyCycle(taskIds, edges);
      assert.strictEqual(result, true);
    });

    it("returns true for cycle in complex graph", () => {
      const taskIds = ["a", "b", "c", "d", "e"];
      const edges: DependencyEdge[] = [
        { fromTask: "a", toTask: "b" },
        { fromTask: "b", toTask: "c" },
        { fromTask: "c", toTask: "d" },
        { fromTask: "d", toTask: "e" },
        { fromTask: "e", toTask: "b" }, // creates cycle: b -> c -> d -> e -> b
      ];
      const result = detectDependencyCycle(taskIds, edges);
      assert.strictEqual(result, true);
    });

    it("returns false for disconnected graph without cycles", () => {
      const taskIds = ["a", "b", "c"];
      const edges: DependencyEdge[] = [];
      const result = detectDependencyCycle(taskIds, edges);
      assert.strictEqual(result, false);
    });

    it("returns false for parallel tasks with convergent edge but no cycle", () => {
      const taskIds = ["start", "p1", "p2", "end"];
      const edges: DependencyEdge[] = [
        { fromTask: "start", toTask: "p1" },
        { fromTask: "start", toTask: "p2" },
        { fromTask: "p1", toTask: "end" },
        { fromTask: "p2", toTask: "end" },
      ];
      const result = detectDependencyCycle(taskIds, edges);
      assert.strictEqual(result, false);
    });
  });
});
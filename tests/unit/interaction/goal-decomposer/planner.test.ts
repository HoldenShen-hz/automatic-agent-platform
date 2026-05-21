import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildExecutionBatches,
  type BuildExecutionBatchesOptions,
  type DependencyEdge,
} from "../../../../../src/interaction/goal-decomposer/planner/index.js";

describe("goal-decomposer/planner", () => {
  describe("buildExecutionBatches", () => {
    it("returns empty array for empty taskIds", () => {
      const result = buildExecutionBatches([], []);
      assert.deepStrictEqual(result, []);
    });

    it("returns single batch for single task with no dependencies", () => {
      const result = buildExecutionBatches(["task:1"], []);
      assert.deepStrictEqual(result, [["task:1"]]);
    });

    it("groups independent tasks in single batch", () => {
      const taskIds = ["task:1", "task:2", "task:3"];
      const edges: DependencyEdge[] = [];
      const result = buildExecutionBatches(taskIds, edges);
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], taskIds);
    });

    it("groups tasks with no edges as single batch", () => {
      const taskIds = ["a", "b", "c"];
      const result = buildExecutionBatches(taskIds, []);
      assert.strictEqual(result.length, 1);
      assert.ok(result[0].includes("a") && result[0].includes("b") && result[0].includes("c"));
    });

    it("respects topological order for sequential dependencies", () => {
      const taskIds = ["t1", "t2", "t3"];
      const edges: DependencyEdge[] = [
        { fromTask: "t1", toTask: "t2" },
        { fromTask: "t2", toTask: "t3" },
      ];
      const result = buildExecutionBatches(taskIds, edges);
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0][0], "t1");
      assert.strictEqual(result[1][0], "t2");
      assert.strictEqual(result[2][0], "t3");
    });

    it("handles diamond dependency with parallel branches", () => {
      const taskIds = ["start", "a", "b", "end"];
      const edges: DependencyEdge[] = [
        { fromTask: "start", toTask: "a" },
        { fromTask: "start", toTask: "b" },
        { fromTask: "a", toTask: "end" },
        { fromTask: "b", toTask: "end" },
      ];
      const result = buildExecutionBatches(taskIds, edges);
      assert.strictEqual(result[0][0], "start");
      assert.strictEqual(result[result.length - 1][0], "end");
      // a and b should be in same batch (second)
      const aBatchIdx = result.findIndex((batch) => batch.includes("a"));
      const bBatchIdx = result.findIndex((batch) => batch.includes("b"));
      assert.strictEqual(aBatchIdx, bBatchIdx, "a and b should be in same batch");
    });

    it("sorts tasks by priority within same batch", () => {
      const taskIds = ["low", "high", "critical", "normal"];
      const edges: DependencyEdge[] = [];
      const options: BuildExecutionBatchesOptions = {
        taskPriorities: {
          low: "low",
          high: "high",
          critical: "critical",
          normal: "normal",
        },
      };
      const result = buildExecutionBatches(taskIds, edges, options);
      assert.strictEqual(result.length, 1);
      const batch = result[0];
      const criticalIdx = batch.indexOf("critical");
      const highIdx = batch.indexOf("high");
      const normalIdx = batch.indexOf("normal");
      const lowIdx = batch.indexOf("low");
      assert.ok(criticalIdx < highIdx, "critical should come before high");
      assert.ok(highIdx < normalIdx, "high should come before normal");
      assert.ok(normalIdx < lowIdx, "normal should come before low");
    });

    it("respects explicit priorities over label weights", () => {
      const taskIds = ["task:low", "task:high"];
      const edges: DependencyEdge[] = [];
      const options: BuildExecutionBatchesOptions = {
        priorities: {
          "task:high": 500,
          "task:low": 100,
        },
      };
      const result = buildExecutionBatches(taskIds, edges, options);
      assert.strictEqual(result.length, 1);
      const batch = result[0];
      assert.ok(batch.indexOf("task:high") < batch.indexOf("task:low"), "high priority should come first");
    });

    it("handles complex multi-level graph", () => {
      const taskIds = ["L1:A", "L1:B", "L2:A", "L2:B", "L3:A"];
      const edges: DependencyEdge[] = [
        { fromTask: "L1:A", toTask: "L2:A" },
        { fromTask: "L1:B", toTask: "L2:B" },
        { fromTask: "L2:A", toTask: "L3:A" },
        { fromTask: "L2:B", toTask: "L3:A" },
      ];
      const result = buildExecutionBatches(taskIds, edges);
      assert.ok(result.length >= 3, "Should have at least 3 batches");
      // Level 1 tasks should be in first batch
      assert.ok(result[0].includes("L1:A") && result[0].includes("L1:B"));
      // Level 3 task should be in last batch
      assert.ok(result[result.length - 1].includes("L3:A"));
    });

    it("uses original topological order as tiebreaker", () => {
      const taskIds = ["first", "second", "third", "fourth"];
      const edges: DependencyEdge[] = []; // No dependencies - all same priority
      const options: BuildExecutionBatchesOptions = {
        taskPriorities: {
          first: "normal",
          second: "normal",
          third: "normal",
          fourth: "normal",
        },
      };
      const result = buildExecutionBatches(taskIds, edges, options);
      assert.strictEqual(result.length, 1);
      const batch = result[0];
      assert.ok(batch.indexOf("first") < batch.indexOf("second"));
      assert.ok(batch.indexOf("second") < batch.indexOf("third"));
      assert.ok(batch.indexOf("third") < batch.indexOf("fourth"));
    });

    it("handles disconnected components", () => {
      const taskIds = ["a1", "a2", "b1", "b2"];
      const edges: DependencyEdge[] = [
        { fromTask: "a1", toTask: "a2" },
        { fromTask: "b1", toTask: "b2" },
      ];
      const result = buildExecutionBatches(taskIds, edges);
      // a1 -> a2, b1 -> b2 are separate chains
      assert.ok(result.length >= 2);
    });

    it("applies priority boost factor correctly", () => {
      const taskIds = ["normal", "high", "critical"];
      const edges: DependencyEdge[] = [];
      const options: BuildExecutionBatchesOptions = {
        taskPriorities: {
          normal: "normal",
          high: "high",
          critical: "critical",
        },
      };
      const result = buildExecutionBatches(taskIds, edges, options);
      const batch = result[0];
      const criticalIdx = batch.indexOf("critical");
      const highIdx = batch.indexOf("high");
      const normalIdx = batch.indexOf("normal");
      assert.ok(criticalIdx < highIdx, "critical should come before high");
      assert.ok(highIdx < normalIdx, "high should come before normal");
    });

    it("handles complex priority with dependencies", () => {
      const taskIds = ["low:a", "low:b", "high:c"];
      const edges: DependencyEdge[] = [
        { fromTask: "low:a", toTask: "high:c" },
        { fromTask: "low:b", toTask: "high:c" },
      ];
      const options: BuildExecutionBatchesOptions = {
        taskPriorities: {
          "low:a": "low",
          "low:b": "low",
          "high:c": "high",
        },
      };
      const result = buildExecutionBatches(taskIds, edges, options);
      // low:a and low:b should be in first batch (no dependencies)
      assert.ok(result[0].includes("low:a"));
      assert.ok(result[0].includes("low:b"));
      // high:c should be in last batch (depends on both)
      assert.ok(result[result.length - 1].includes("high:c"));
    });
  });
});
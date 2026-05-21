/**
 * Unit tests for buildLegacyEdgeExecutionPlan function
 *
 * @see src/ops-maturity/edge-runtime/edge-orchestrator/index.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildLegacyEdgeExecutionPlan } from "../../../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";

describe("buildLegacyEdgeExecutionPlan", () => {
  test("returns orderedTaskIds with single task", () => {
    const result = buildLegacyEdgeExecutionPlan(["task-1"]);

    assert.deepStrictEqual(result.orderedTaskIds, ["task-1"]);
    assert.equal(result.syncRequired, true);
    assert.equal(result.priority, "normal");
  });

  test("returns orderedTaskIds with multiple tasks", () => {
    const result = buildLegacyEdgeExecutionPlan(["task-1", "task-2", "task-3"]);

    assert.deepStrictEqual(result.orderedTaskIds, ["task-1", "task-2", "task-3"]);
  });

  test("returns empty orderedTaskIds for empty input", () => {
    const result = buildLegacyEdgeExecutionPlan([]);

    assert.deepStrictEqual(result.orderedTaskIds, []);
  });

  test("sets syncRequired to true", () => {
    const result = buildLegacyEdgeExecutionPlan(["task-1"]);

    assert.equal(result.syncRequired, true);
  });

  test("accepts low priority", () => {
    const result = buildLegacyEdgeExecutionPlan(["task-1"], "low");

    assert.equal(result.priority, "low");
  });

  test("accepts normal priority", () => {
    const result = buildLegacyEdgeExecutionPlan(["task-1"], "normal");

    assert.equal(result.priority, "normal");
  });

  test("accepts high priority", () => {
    const result = buildLegacyEdgeExecutionPlan(["task-1"], "high");

    assert.equal(result.priority, "high");
  });

  test("defaults to normal priority", () => {
    const result = buildLegacyEdgeExecutionPlan(["task-1"]);

    assert.equal(result.priority, "normal");
  });

  test("does not include planGraph (distinguishes from modern buildEdgeExecutionPlan)", () => {
    const result = buildLegacyEdgeExecutionPlan(["task-1"]);

    assert.strictEqual((result as any).planGraph, undefined);
    assert.strictEqual((result as any).planGraphBundle, undefined);
  });

  test("returns a new array instance (does not mutate input)", () => {
    const input = Object.freeze(["task-1", "task-2"]);
    const result = buildLegacyEdgeExecutionPlan(input);

    assert.notStrictEqual(result.orderedTaskIds, input);
  });

  test("handles single task with all priority levels", () => {
    const lowResult = buildLegacyEdgeExecutionPlan(["task-1"], "low");
    const normalResult = buildLegacyEdgeExecutionPlan(["task-1"], "normal");
    const highResult = buildLegacyEdgeExecutionPlan(["task-1"], "high");

    assert.equal(lowResult.priority, "low");
    assert.equal(normalResult.priority, "normal");
    assert.equal(highResult.priority, "high");
  });

  test("preserves taskId order correctly", () => {
    const taskIds = ["z-task", "a-task", "m-task"];
    const result = buildLegacyEdgeExecutionPlan(taskIds);

    assert.deepStrictEqual(result.orderedTaskIds, ["z-task", "a-task", "m-task"]);
  });
});